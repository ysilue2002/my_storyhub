// backend/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const USE_SSL = process.env.DATABASE_SSL === 'true';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
const ALLOWED_ORIGINS =
  FRONTEND_ORIGIN === '*'
    ? '*'
    : FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || `http://localhost:${PORT}`;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: USE_SSL ? { rejectUnauthorized: false } : undefined,
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS === '*') return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.options('*', cors());
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(morgan('dev'));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    credentials: true,
  },
});

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const createUploader = (subdir) => {
  const destination = path.join(__dirname, 'uploads', subdir);
  ensureDir(destination);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, destination),
    filename: (req, file, cb) => {
      const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
      cb(null, safeName);
    },
  });

  return multer({
    storage,
    fileFilter: (req, file, cb) => {
      if (file.mimetype && file.mimetype.startsWith('image/')) {
        return cb(null, true);
      }
      return cb(new Error('Type de fichier non autorisé.'));
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  });
};

const avatarUpload = createUploader('avatars');
const coverUpload = createUploader('covers');
const goalUpload = createUploader('goals');

const safeUnlink = (fileUrl) => {
  if (!fileUrl) return;
  const uploadsIndex = fileUrl.indexOf('/uploads/');
  if (uploadsIndex === -1) return;
  const relativePath = fileUrl.slice(uploadsIndex + '/uploads/'.length);
  const absolutePath = path.join(__dirname, 'uploads', relativePath);
  if (absolutePath.startsWith(path.join(__dirname, 'uploads'))) {
    fs.unlink(absolutePath, () => {});
  }
};

const normalizeFileUrl = (fileUrl) => {
  if (!fileUrl) return fileUrl;
  const uploadsIndex = fileUrl.indexOf('/uploads/');
  if (uploadsIndex === -1) return fileUrl;
  return `${SERVER_BASE_URL}${fileUrl.slice(uploadsIndex)}`;
};

const authRequired = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Token requis.' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide.' });
  }
};

const ensureNotSuspended = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT suspended_until FROM users WHERE id = $1',
      [req.user.id]
    );
    const suspendedUntil = result.rows[0]?.suspended_until;
    if (suspendedUntil && new Date(suspendedUntil) > new Date()) {
      return res.status(403).json({ error: 'Compte suspendu temporairement.' });
    }
    return next();
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
};

const adminRequired = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès admin requis.' });
  }
  return next();
};

const socketAuth = (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Token requis.'));

  try {
    const user = jwt.verify(token, JWT_SECRET);
    socket.user = user;
    return next();
  } catch (error) {
    return next(new Error('Token invalide.'));
  }
};

io.use(socketAuth);

io.on('connection', async (socket) => {
  socket.join(`user:${socket.user.id}`);
  try {
    const result = await pool.query(
      `
        SELECT c.id
        FROM conversations c
        JOIN conversation_participants cp ON cp.conversation_id = c.id
        WHERE cp.user_id = $1
      `,
      [socket.user.id]
    );
    result.rows.forEach((row) => socket.join(`conversation:${row.id}`));
  } catch (error) {
    // no-op for MVP
  }

  socket.on('webrtc:offer', ({ conversationId, offer, toUserId }) => {
    if (conversationId) {
      io.to(`conversation:${conversationId}`).emit('webrtc:offer', {
        conversationId,
        offer,
        fromUserId: socket.user.id,
      });
    } else if (toUserId) {
      io.to(`user:${toUserId}`).emit('webrtc:offer', {
        offer,
        fromUserId: socket.user.id,
      });
    }
  });

  socket.on('webrtc:answer', ({ conversationId, answer, toUserId }) => {
    if (conversationId) {
      io.to(`conversation:${conversationId}`).emit('webrtc:answer', {
        conversationId,
        answer,
        fromUserId: socket.user.id,
      });
    } else if (toUserId) {
      io.to(`user:${toUserId}`).emit('webrtc:answer', {
        answer,
        fromUserId: socket.user.id,
      });
    }
  });

  socket.on('webrtc:ice', ({ conversationId, candidate, toUserId }) => {
    if (conversationId) {
      io.to(`conversation:${conversationId}`).emit('webrtc:ice', {
        conversationId,
        candidate,
        fromUserId: socket.user.id,
      });
    } else if (toUserId) {
      io.to(`user:${toUserId}`).emit('webrtc:ice', {
        candidate,
        fromUserId: socket.user.id,
      });
    }
  });

  socket.on('webrtc:hangup', ({ conversationId, toUserId }) => {
    if (conversationId) {
      io.to(`conversation:${conversationId}`).emit('webrtc:hangup', {
        conversationId,
        fromUserId: socket.user.id,
      });
    } else if (toUserId) {
      io.to(`user:${toUserId}`).emit('webrtc:hangup', {
        fromUserId: socket.user.id,
      });
    }
  });

  socket.on('disconnect', () => {
    // no-op
  });
});

const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      handle TEXT,
      gender TEXT,
      age INTEGER,
      country TEXT,
      city TEXT,
      bio TEXT,
      availability TEXT,
      avatar_url TEXT,
      cover_url TEXT,
      suspended_until TIMESTAMP,
      goals TEXT[] DEFAULT '{}',
      interests TEXT[] DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS goals (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      progress INTEGER DEFAULT 0,
      image_url TEXT,
      start_date DATE,
      end_date DATE,
      steps JSONB DEFAULT '[]'::jsonb,
      priority TEXT DEFAULT 'normal',
      tags TEXT[] DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      image_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_likes (
      post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ads (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT,
      image_url TEXT,
      link_url TEXT,
      is_sponsor_of_day BOOLEAN DEFAULT FALSE,
      sponsor_start DATE,
      sponsor_end DATE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMP;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;`);
  await pool.query(`ALTER TABLE goals ADD COLUMN IF NOT EXISTS image_url TEXT;`);
  await pool.query(`ALTER TABLE goals ADD COLUMN IF NOT EXISTS start_date DATE;`);
  await pool.query(`ALTER TABLE goals ADD COLUMN IF NOT EXISTS end_date DATE;`);
  await pool.query(`ALTER TABLE goals ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]'::jsonb;`);
  await pool.query(`ALTER TABLE goals ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';`);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_by INTEGER[] DEFAULT '{}';`);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by INTEGER[] DEFAULT '{}';`);
  await pool.query(`UPDATE messages SET read_by = '{}' WHERE read_by IS NULL;`);
  await pool.query(`UPDATE messages SET deleted_by = '{}' WHERE deleted_by IS NULL;`);
  await pool.query(`ALTER TABLE ads ADD COLUMN IF NOT EXISTS is_sponsor_of_day BOOLEAN DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE ads ADD COLUMN IF NOT EXISTS sponsor_start DATE;`);
  await pool.query(`ALTER TABLE ads ADD COLUMN IF NOT EXISTS sponsor_end DATE;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      last_message TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversation_participants (
      conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (conversation_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
      from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      sent_at TIMESTAMP DEFAULT NOW(),
      read_by INTEGER[] DEFAULT '{}',
      deleted_by INTEGER[] DEFAULT '{}'
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS blocked_users (
      blocker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      blocked_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (blocker_id, blocked_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS connection_requests (
      id SERIAL PRIMARY KEY,
      from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      message TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      metadata JSONB DEFAULT '{}'::jsonb
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'open',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (rows[0].count > 0) return;

  const passwordHash = await bcrypt.hash('password123', 10);
  const demoUsers = [
    {
      name: 'Yasmine',
      email: 'yasmine@demo.com',
      handle: '@yasmine_focus',
      city: 'Casablanca',
      bio: 'Je prépare un lancement e-commerce et je cherche des partenaires de travail réguliers.',
      availability: 'Soirs',
      goals: ['E-commerce', 'Branding', 'Productivité'],
      interests: ['Marketing', 'Notion', 'Photos'],
      role: 'admin',
    },
    {
      name: 'Karim',
      email: 'karim@demo.com',
      handle: '@karim_dev',
      city: 'Rabat',
      bio: 'Développeur web passionné par l’UX, je monte un portfolio et un blog technique.',
      availability: 'Week-end',
      goals: ['Portfolio', 'Next.js', 'SEO'],
      interests: ['Design', 'React', 'AI'],
      role: 'user',
    },
    {
      name: 'Salma',
      email: 'salma@demo.com',
      handle: '@salma_fit',
      city: 'Tunis',
      bio: 'Coach sportif, je travaille sur un programme de 12 semaines pour femmes actives.',
      availability: 'Matins',
      goals: ['Coaching', 'Programme 12 semaines', 'Communauté'],
      interests: ['Santé', 'Nutrition', 'Yoga'],
      role: 'user',
    },
    {
      name: 'Omar',
      email: 'omar@demo.com',
      handle: '@omar_writer',
      city: 'Paris',
      bio: 'J’écris un livre sur le leadership pour les créatifs et je cherche des bêta-lecteurs.',
      availability: 'Soirs',
      goals: ['Écriture', 'Leadership', 'Livre'],
      interests: ['Édition', 'Storytelling', 'Podcasts'],
      role: 'user',
    },
    {
      name: 'Lina',
      email: 'lina@demo.com',
      handle: '@lina_growth',
      city: 'Lyon',
      bio: 'Je monte une agence de contenu et je cherche des partenaires pour co-créer.',
      availability: 'Après-midi',
      goals: ['Agence', 'Ventes', 'Équipe'],
      interests: ['Growth', 'LinkedIn', 'Copywriting'],
      role: 'user',
    },
    {
      name: 'Nadia',
      email: 'nadia@demo.com',
      handle: '@nadia_study',
      city: 'Alger',
      bio: 'Étudiante en data, je prépare mes certifications et je veux une accountability team.',
      availability: 'Matins',
      goals: ['Data', 'Certifications', 'Routine'],
      interests: ['Python', 'ML', 'Cours en ligne'],
      role: 'user',
    },
  ];

  const userIds = [];
  for (const user of demoUsers) {
    const result = await pool.query(
      `
        INSERT INTO users (name, email, password_hash, handle, city, bio, availability, goals, interests, role)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `,
      [
        user.name,
        user.email,
        passwordHash,
        user.handle,
        user.city,
        user.bio,
        user.availability,
        user.goals,
        user.interests,
        user.role || 'user',
      ]
    );
    userIds.push(result.rows[0].id);
  }

  const demoGoals = [
    {
      ownerIndex: 0,
      title: 'Lancer une boutique en ligne en 60 jours',
      description: 'Stratégie de marque, photos produits, pages de vente et automatisations.',
      category: 'Business',
      progress: 45,
      tags: ['Shopify', 'Branding', 'Marketing'],
    },
    {
      ownerIndex: 1,
      title: 'Construire un portfolio Webflow + blog',
      description: 'Architecture du site, refonte UX, SEO et publications hebdo.',
      category: 'Tech',
      progress: 30,
      tags: ['Portfolio', 'SEO', 'Design'],
    },
    {
      ownerIndex: 2,
      title: 'Programme fitness 12 semaines',
      description: 'Créer des routines, vidéos explicatives et un suivi communautaire.',
      category: 'Bien-être',
      progress: 60,
      tags: ['Coaching', 'Communauté', 'Santé'],
    },
    {
      ownerIndex: 3,
      title: 'Écrire un livre sur le leadership créatif',
      description: 'Plan du livre, interviews, chapitres et relectures.',
      category: 'Création',
      progress: 25,
      tags: ['Écriture', 'Leadership', 'Podcast'],
    },
    {
      ownerIndex: 4,
      title: 'Développer une agence de contenu',
      description: 'Offres, process de vente et création d’une équipe créative.',
      category: 'Business',
      progress: 50,
      tags: ['Ventes', 'Growth', 'Copywriting'],
    },
    {
      ownerIndex: 5,
      title: 'Obtenir 2 certifications data',
      description: 'Plan d’étude, projets GitHub et sessions d’accountability.',
      category: 'Études',
      progress: 70,
      tags: ['Data', 'Python', 'Routine'],
    },
  ];

  for (const goal of demoGoals) {
    await pool.query(
      `
        INSERT INTO goals (owner_id, title, description, category, progress, tags)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        userIds[goal.ownerIndex],
        goal.title,
        goal.description,
        goal.category,
        goal.progress,
        goal.tags,
      ]
    );
  }

  const convResult = await pool.query(
    `INSERT INTO conversations (title, last_message) VALUES ($1, $2) RETURNING id`,
    ['Yasmine & Karim', 'On se cale une session ce soir ?']
  );
  const convId = convResult.rows[0].id;

  await pool.query(
    `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
    [convId, userIds[0], userIds[1]]
  );

  await pool.query(
    `INSERT INTO messages (conversation_id, from_user_id, text) VALUES ($1, $2, $3)`,
    [convId, userIds[1], 'Salut Yasmine, tu avances sur ta page produit ?']
  );
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, gender, age, country, city, bio, availability, goals, interests } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email et password requis.' });
  }
  const parsedAge = age !== undefined && age !== null && `${age}` !== ''
    ? Number(age)
    : null;
  if (parsedAge !== null && Number.isNaN(parsedAge)) {
    return res.status(400).json({ error: 'age invalide.' });
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(400).json({ error: 'Email déjà utilisé.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const handle = `@${email.split('@')[0]}`;
  const result = await pool.query(
    `
      INSERT INTO users (name, email, password_hash, handle, role, gender, age, country, city, bio, availability, goals, interests)
      VALUES ($1, $2, $3, $4, 'user', $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, name, email, handle, gender, age, country, city, bio, availability,
                goals, interests, avatar_url AS "avatarUrl", cover_url AS "coverUrl", role
    `,
    [
      name,
      email,
      passwordHash,
      handle,
      gender || null,
      parsedAge,
      country || null,
      city || null,
      bio || null,
      availability || null,
      goals || [],
      interests || [],
    ]
  );

  const user = result.rows[0];
  user.avatarUrl = normalizeFileUrl(user.avatarUrl);
  user.coverUrl = normalizeFileUrl(user.coverUrl);
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });

  res.status(201).json({ user, token });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email et password requis.' });
  }

  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }

  const user = result.rows[0];
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    handle: user.handle,
    gender: user.gender,
    age: user.age,
    country: user.country,
    city: user.city,
    bio: user.bio,
    availability: user.availability,
    goals: user.goals || [],
    interests: user.interests || [],
    avatarUrl: normalizeFileUrl(user.avatar_url) || null,
    coverUrl: normalizeFileUrl(user.cover_url) || null,
    role: user.role || 'user',
  };

  res.json({ user: safeUser, token });
});

app.get('/api/me', authRequired, async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, handle, gender, age, country, city, bio, availability, goals, interests, avatar_url AS "avatarUrl", cover_url AS "coverUrl", role FROM users WHERE id = $1',
    [req.user.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }
  const row = result.rows[0];
  row.avatarUrl = normalizeFileUrl(row.avatarUrl);
  row.coverUrl = normalizeFileUrl(row.coverUrl);
  res.json(row);
});

app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    `
      SELECT id, name, handle, gender, age, country, city, bio, availability, goals, interests,
             avatar_url AS "avatarUrl", cover_url AS "coverUrl"
      FROM users
      WHERE id = $1
    `,
    [id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }
  const row = result.rows[0];
  row.avatarUrl = normalizeFileUrl(row.avatarUrl);
  row.coverUrl = normalizeFileUrl(row.coverUrl);
  res.json(row);
});

app.put('/api/me', authRequired, async (req, res) => {
  const { name, gender, age, country, city, bio, availability, goals, interests } = req.body || {};
  const parsedAge = age !== undefined && age !== null && `${age}` !== ''
    ? Number(age)
    : null;
  if (parsedAge !== null && Number.isNaN(parsedAge)) {
    return res.status(400).json({ error: 'age invalide.' });
  }
  const result = await pool.query(
    `
      UPDATE users
      SET name = COALESCE($1, name),
          gender = COALESCE($2, gender),
          age = COALESCE($3, age),
          country = COALESCE($4, country),
          city = COALESCE($5, city),
          bio = COALESCE($6, bio),
          availability = COALESCE($7, availability),
          goals = COALESCE($8, goals),
          interests = COALESCE($9, interests)
      WHERE id = $10
      RETURNING id, name, email, handle, gender, age, country, city, bio, availability, goals, interests, avatar_url AS "avatarUrl", cover_url AS "coverUrl", role
    `,
    [name, gender, parsedAge, country, city, bio, availability, goals, interests, req.user.id]
  );
  res.json(result.rows[0]);
});

app.delete('/api/me', authRequired, async (req, res) => {
  const userResult = await pool.query(
    'SELECT avatar_url AS "avatarUrl", cover_url AS "coverUrl" FROM users WHERE id = $1',
    [req.user.id]
  );
  const goalsResult = await pool.query(
    'SELECT image_url AS "imageUrl" FROM goals WHERE owner_id = $1',
    [req.user.id]
  );

  await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);

  if (userResult.rows[0]) {
    safeUnlink(userResult.rows[0].avatarUrl);
    safeUnlink(userResult.rows[0].coverUrl);
  }
  goalsResult.rows.forEach((row) => safeUnlink(row.imageUrl));

  res.status(204).send();
});

app.post('/api/me/avatar', authRequired, avatarUpload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Fichier requis.' });
  }
  const current = await pool.query(
    'SELECT avatar_url AS "avatarUrl" FROM users WHERE id = $1',
    [req.user.id]
  );
  const avatarUrl = `${SERVER_BASE_URL}/uploads/avatars/${req.file.filename}`;
  const result = await pool.query(
    `
      UPDATE users
      SET avatar_url = $1
      WHERE id = $2
      RETURNING avatar_url AS "avatarUrl"
    `,
    [avatarUrl, req.user.id]
  );
  safeUnlink(current.rows[0]?.avatarUrl);
  res.json(result.rows[0]);
});

app.post('/api/me/cover', authRequired, coverUpload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Fichier requis.' });
  }
  const current = await pool.query(
    'SELECT cover_url AS "coverUrl" FROM users WHERE id = $1',
    [req.user.id]
  );
  const coverUrl = `${SERVER_BASE_URL}/uploads/covers/${req.file.filename}`;
  const result = await pool.query(
    `
      UPDATE users
      SET cover_url = $1
      WHERE id = $2
      RETURNING cover_url AS "coverUrl"
    `,
    [coverUrl, req.user.id]
  );
  safeUnlink(current.rows[0]?.coverUrl);
  res.json(result.rows[0]);
});

app.get('/api/users', async (req, res) => {
  const query = String(req.query.q || '').trim();
  let result;
  if (query) {
    const likeQuery = `%${query}%`;
    result = await pool.query(
      `
        SELECT id, name, handle, gender, age, country, city, bio, availability, goals, interests,
               avatar_url AS "avatarUrl", cover_url AS "coverUrl", role
        FROM users
        WHERE name ILIKE $1
           OR email ILIKE $1
           OR handle ILIKE $1
           OR city ILIKE $1
           OR country ILIKE $1
           OR array_to_string(goals, ' ') ILIKE $1
           OR array_to_string(interests, ' ') ILIKE $1
        ORDER BY name ASC
        LIMIT 50
      `,
      [likeQuery]
    );
  } else {
    result = await pool.query(
      `
        SELECT id, name, handle, gender, age, country, city, bio, availability, goals, interests,
               avatar_url AS "avatarUrl", cover_url AS "coverUrl", role
        FROM users
        ORDER BY name ASC
      `
    );
  }
  const data = result.rows;
  res.json(
    data.map((user) => ({
      ...user,
      avatarUrl: normalizeFileUrl(user.avatarUrl),
      coverUrl: normalizeFileUrl(user.coverUrl),
    }))
  );
});

// Hubmates suggestions based on shared goals/interests (simple similarity score)
app.get('/api/hubmates/suggestions', authRequired, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 20);
  const sameCityOnly = String(req.query.sameCityOnly || 'false') === 'true';
  const minScore = Math.max(Number(req.query.minScore) || 0, 0);
  const meResult = await pool.query(
    'SELECT id, goals, interests, city FROM users WHERE id = $1',
    [req.user.id]
  );
  if (meResult.rows.length === 0) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  const me = meResult.rows[0];
  const myGoals = (me.goals || []).map((v) => String(v).toLowerCase());
  const myInterests = (me.interests || []).map((v) => String(v).toLowerCase());
  const goalSet = new Set(myGoals);
  const interestSet = new Set(myInterests);

  const contactedResult = await pool.query(
    `
      SELECT DISTINCT to_user_id AS "userId"
      FROM connection_requests
      WHERE from_user_id = $1
    `,
    [req.user.id]
  );
  const contactedSet = new Set(contactedResult.rows.map((row) => row.userId));

  const contactedBackResult = await pool.query(
    `
      SELECT DISTINCT from_user_id AS "userId"
      FROM connection_requests
      WHERE to_user_id = $1
    `,
    [req.user.id]
  );
  const contactedBackSet = new Set(contactedBackResult.rows.map((row) => row.userId));

  const othersResult = await pool.query(
    'SELECT id, name, handle, city, bio, availability, goals, interests, avatar_url AS "avatarUrl" FROM users WHERE id <> $1',
    [req.user.id]
  );

  const scored = othersResult.rows
    .filter((user) => !contactedSet.has(user.id) && !contactedBackSet.has(user.id))
    .map((user) => {
      const otherGoals = (user.goals || []).map((v) => String(v).toLowerCase());
      const otherInterests = (user.interests || []).map((v) => String(v).toLowerCase());

      const goalOverlap = otherGoals.filter((v) => goalSet.has(v));
      const interestOverlap = otherInterests.filter((v) => interestSet.has(v));

      const goalScore = goalOverlap.length * 2;
      const interestScore = interestOverlap.length * 1;
      const cityBoost = me.city && user.city && me.city.toLowerCase() === user.city.toLowerCase() ? 1 : 0;

      const score = goalScore + interestScore + cityBoost;
      return {
        ...user,
        score,
        sharedGoals: goalOverlap,
        sharedInterests: interestOverlap,
        sameCity: cityBoost === 1,
      };
    })
    .filter((user) => (sameCityOnly ? user.sameCity : true))
    .filter((user) => user.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  res.json(scored);
});

app.get('/api/goals', async (req, res) => {
  const query = (req.query.q || '').toLowerCase();
  const ownerId = req.query.ownerId ? Number(req.query.ownerId) : null;
  const result = await pool.query(
    `SELECT id, owner_id AS "ownerId", title, description, category, progress, tags,
            image_url AS "imageUrl", start_date AS "startDate", end_date AS "endDate",
            steps, priority
     FROM goals`
  );
  const data = query
    ? result.rows.filter((goal) => {
        const haystack = [goal.title, goal.category, goal.description, ...(goal.tags || [])]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
    : result.rows;
  const filtered = ownerId ? data.filter((goal) => goal.ownerId === ownerId) : data;
  res.json(filtered.map((goal) => ({ ...goal, imageUrl: normalizeFileUrl(goal.imageUrl) })));
});

app.get('/api/my-goals', authRequired, async (req, res) => {
  const result = await pool.query(
    `
      SELECT id, owner_id AS "ownerId", title, description, category, progress, tags,
             image_url AS "imageUrl", start_date AS "startDate", end_date AS "endDate",
             steps, priority
      FROM goals
      WHERE owner_id = $1
      ORDER BY created_at DESC
    `,
    [req.user.id]
  );
  res.json(result.rows.map((goal) => ({ ...goal, imageUrl: normalizeFileUrl(goal.imageUrl) })));
});

app.post('/api/goals', authRequired, async (req, res) => {
  const { title, description, category, progress, tags, imageUrl, startDate, endDate, steps, priority } = req.body || {};
  if (!title) {
    return res.status(400).json({ error: 'title requis.' });
  }
  if (progress !== undefined && (progress < 0 || progress > 100)) {
    return res.status(400).json({ error: 'progress invalide.' });
  }
  if (Array.isArray(steps) && steps.length > 5) {
    return res.status(400).json({ error: 'max 5 étapes.' });
  }

  const result = await pool.query(
    `
      INSERT INTO goals (owner_id, title, description, category, progress, tags, image_url, start_date, end_date, steps, priority)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, owner_id AS "ownerId", title, description, category, progress, tags,
                image_url AS "imageUrl", start_date AS "startDate", end_date AS "endDate",
                steps, priority
    `,
    [
      req.user.id,
      title,
      description || '',
      category || '',
      progress || 0,
      tags || [],
      imageUrl || null,
      startDate || null,
      endDate || null,
      Array.isArray(steps) ? steps : [],
      priority || 'normal',
    ]
  );
  const row = result.rows[0];
  row.imageUrl = normalizeFileUrl(row.imageUrl);
  res.status(201).json(row);
});

app.put('/api/goals/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { title, description, category, progress, tags, imageUrl, startDate, endDate, steps, priority } = req.body || {};
  if (progress !== undefined && (progress < 0 || progress > 100)) {
    return res.status(400).json({ error: 'progress invalide.' });
  }
  if (Array.isArray(steps) && steps.length > 5) {
    return res.status(400).json({ error: 'max 5 étapes.' });
  }

  const current = await pool.query(
    'SELECT image_url AS "imageUrl" FROM goals WHERE id = $1 AND owner_id = $2',
    [id, req.user.id]
  );

  const result = await pool.query(
    `
      UPDATE goals
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          category = COALESCE($3, category),
          progress = COALESCE($4, progress),
          tags = COALESCE($5, tags),
          image_url = COALESCE($6, image_url),
          start_date = COALESCE($7, start_date),
          end_date = COALESCE($8, end_date),
          steps = COALESCE($9, steps),
          priority = COALESCE($10, priority)
      WHERE id = $11 AND owner_id = $12
      RETURNING id, owner_id AS "ownerId", title, description, category, progress, tags,
                image_url AS "imageUrl", start_date AS "startDate", end_date AS "endDate",
                steps, priority
    `,
    [title, description, category, progress, tags, imageUrl, startDate, endDate, Array.isArray(steps) ? steps : null, priority, id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Objectif introuvable.' });
  }

  if (imageUrl && current.rows[0]?.imageUrl && current.rows[0].imageUrl !== imageUrl) {
    safeUnlink(current.rows[0].imageUrl);
  }

  const row = result.rows[0];
  row.imageUrl = normalizeFileUrl(row.imageUrl);
  res.json(row);
});

app.delete('/api/goals/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const current = await pool.query(
    'SELECT image_url AS "imageUrl" FROM goals WHERE id = $1 AND owner_id = $2',
    [id, req.user.id]
  );
  const result = await pool.query(
    'DELETE FROM goals WHERE id = $1 AND owner_id = $2 RETURNING id',
    [id, req.user.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Objectif introuvable.' });
  }
  safeUnlink(current.rows[0]?.imageUrl);
  res.status(204).send();
});

app.post('/api/uploads/goal-image', authRequired, goalUpload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Fichier requis.' });
  }
  const imageUrl = `${SERVER_BASE_URL}/uploads/goals/${req.file.filename}`;
  res.json({ imageUrl });
});

app.delete('/api/posts/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const current = await pool.query(
    'SELECT image_url AS "imageUrl" FROM posts WHERE id = $1 AND user_id = $2',
    [id, req.user.id]
  );
  const result = await pool.query(
    'DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, req.user.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Publication introuvable.' });
  }
  safeUnlink(current.rows[0]?.imageUrl);
  res.status(204).send();
});

app.post('/api/uploads/post-image', authRequired, goalUpload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Fichier requis.' });
  }
  const imageUrl = `${SERVER_BASE_URL}/uploads/goals/${req.file.filename}`;
  res.json({ imageUrl });
});

app.get('/api/posts', async (req, res) => {
  const { userId, limit = 10, offset = 0 } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'userId requis.' });
  }
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const result = await pool.query(
    `
      SELECT p.id, p.user_id AS "userId", p.body, p.image_url AS "imageUrl",
             p.created_at AS "createdAt", u.name AS "userName", u.avatar_url AS "userAvatar",
             (SELECT COUNT(*)::int FROM post_likes pl WHERE pl.post_id = p.id) AS "likesCount",
             (SELECT COUNT(*)::int FROM post_comments pc WHERE pc.post_id = p.id) AS "commentsCount"
      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `,
    [userId, safeLimit, safeOffset]
  );
  res.json(
    result.rows.map((row) => ({
      ...row,
      imageUrl: normalizeFileUrl(row.imageUrl),
      userAvatar: normalizeFileUrl(row.userAvatar),
    }))
  );
});

app.post('/api/posts', authRequired, ensureNotSuspended, async (req, res) => {
  const { body, imageUrl } = req.body || {};
  if (!body) {
    return res.status(400).json({ error: 'body requis.' });
  }
  const result = await pool.query(
    `
      INSERT INTO posts (user_id, body, image_url)
      VALUES ($1, $2, $3)
      RETURNING id, user_id AS "userId", body, image_url AS "imageUrl", created_at AS "createdAt"
    `,
    [req.user.id, body, imageUrl || null]
  );
  const row = result.rows[0];
  row.imageUrl = normalizeFileUrl(row.imageUrl);
  res.status(201).json(row);
});

app.put('/api/posts/:id', authRequired, ensureNotSuspended, async (req, res) => {
  const { id } = req.params;
  const { body, imageUrl } = req.body || {};
  if (!body) {
    return res.status(400).json({ error: 'body requis.' });
  }
  const result = await pool.query(
    `
      UPDATE posts
      SET body = $1,
          image_url = $2
      WHERE id = $3 AND user_id = $4
      RETURNING id, user_id AS "userId", body, image_url AS "imageUrl", created_at AS "createdAt"
    `,
    [body, imageUrl || null, id, req.user.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Publication introuvable.' });
  }
  const row = result.rows[0];
  row.imageUrl = normalizeFileUrl(row.imageUrl);
  res.json(row);
});

app.post('/api/posts/:id/like', authRequired, ensureNotSuspended, async (req, res) => {
  const { id } = req.params;
  await pool.query(
    `INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [id, req.user.id]
  );
  const count = await pool.query(
    `SELECT COUNT(*)::int AS count FROM post_likes WHERE post_id = $1`,
    [id]
  );
  res.json({ likesCount: count.rows[0].count });
});

app.delete('/api/posts/:id/like', authRequired, ensureNotSuspended, async (req, res) => {
  const { id } = req.params;
  await pool.query(
    `DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`,
    [id, req.user.id]
  );
  const count = await pool.query(
    `SELECT COUNT(*)::int AS count FROM post_likes WHERE post_id = $1`,
    [id]
  );
  res.json({ likesCount: count.rows[0].count });
});

app.get('/api/posts/:id/comments', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    `
      SELECT pc.id, pc.post_id AS "postId", pc.user_id AS "userId", pc.body,
             pc.created_at AS "createdAt", u.name AS "userName"
      FROM post_comments pc
      JOIN users u ON u.id = pc.user_id
      WHERE pc.post_id = $1
      ORDER BY pc.created_at ASC
    `,
    [id]
  );
  res.json(result.rows);
});

app.post('/api/posts/:id/comments', authRequired, ensureNotSuspended, async (req, res) => {
  const { id } = req.params;
  const { body } = req.body || {};
  if (!body) {
    return res.status(400).json({ error: 'body requis.' });
  }
  const result = await pool.query(
    `
      INSERT INTO post_comments (post_id, user_id, body)
      VALUES ($1, $2, $3)
      RETURNING id, post_id AS "postId", user_id AS "userId", body, created_at AS "createdAt"
    `,
    [id, req.user.id, body]
  );
  res.status(201).json(result.rows[0]);
});

app.delete('/api/posts/comments/:id', authRequired, ensureNotSuspended, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    'DELETE FROM post_comments WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, req.user.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Commentaire introuvable.' });
  }
  res.status(204).send();
});

app.get('/api/posts/likes', authRequired, async (req, res) => {
  const result = await pool.query(
    'SELECT post_id AS "postId" FROM post_likes WHERE user_id = $1',
    [req.user.id]
  );
  res.json(result.rows);
});

app.delete('/api/posts/comments', authRequired, ensureNotSuspended, async (req, res) => {
  const result = await pool.query(
    'DELETE FROM post_comments WHERE user_id = $1 RETURNING id',
    [req.user.id]
  );
  res.json({ deleted: result.rows.length });
});

app.post('/api/connect', authRequired, ensureNotSuspended, async (req, res) => {
  const { toUserId, message } = req.body || {};
  if (!toUserId) {
    return res.status(400).json({ error: 'toUserId requis.' });
  }

  const result = await pool.query(
    `
      INSERT INTO connection_requests (from_user_id, to_user_id, message)
      VALUES ($1, $2, $3)
      RETURNING id, from_user_id AS "fromUserId", to_user_id AS "toUserId", message, status, created_at AS "createdAt"
    `,
    [req.user.id, toUserId, message || '']
  );
  const request = result.rows[0];
  const notificationResult = await pool.query(
    `
      INSERT INTO notifications (user_id, type, title, body, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id AS "userId", type, title, body, is_read AS "isRead", created_at AS "createdAt", metadata
    `,
    [
      toUserId,
      'connection_request',
      'Nouvelle demande',
      request.message || 'Nouvelle demande de contact',
      JSON.stringify({ fromUserId: request.fromUserId, requestId: request.id }),
    ]
  );
  const notification = notificationResult.rows[0];
  io.to(`user:${toUserId}`).emit('notification:new', notification);
  res.status(201).json(request);
});

app.get('/api/conversations', authRequired, async (req, res) => {
  const result = await pool.query(
    `
      SELECT c.id, c.title, c.last_message AS "lastMessage"
      FROM conversations c
      JOIN conversation_participants cp ON cp.conversation_id = c.id
      WHERE cp.user_id = $1
    `,
    [req.user.id]
  );
  res.json(result.rows);
});

app.post('/api/conversations/start', authRequired, ensureNotSuspended, async (req, res) => {
  const { toUserId, text } = req.body || {};
  if (!toUserId || !text) {
    return res.status(400).json({ error: 'toUserId et text requis.' });
  }

  const existing = await pool.query(
    `
      SELECT c.id
      FROM conversations c
      JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
      JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
      LIMIT 1
    `,
    [req.user.id, toUserId]
  );

  let conversationId;
  if (existing.rows.length > 0) {
    conversationId = existing.rows[0].id;
  } else {
    const title = `Conversation ${req.user.id} & ${toUserId}`;
    const convResult = await pool.query(
      `INSERT INTO conversations (title, last_message) VALUES ($1, $2) RETURNING id`,
      [title, text]
    );
    conversationId = convResult.rows[0].id;
    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [conversationId, req.user.id, toUserId]
    );
  }

  const msgResult = await pool.query(
    `
      INSERT INTO messages (conversation_id, from_user_id, text, read_by)
      VALUES ($1, $2, $3, ARRAY[$2]::int[])
      RETURNING id, conversation_id AS "conversationId", from_user_id AS "fromUserId",
                text, sent_at AS "sentAt", read_by AS "readBy"
    `,
    [conversationId, req.user.id, text]
  );

  await pool.query(
    `UPDATE conversations SET last_message = $1 WHERE id = $2`,
    [text, conversationId]
  );

  res.status(201).json({ conversationId, message: msgResult.rows[0] });
});

app.post('/api/conversations/ensure', authRequired, async (req, res) => {
  const { toUserId } = req.body || {};
  if (!toUserId) {
    return res.status(400).json({ error: 'toUserId requis.' });
  }

  const existing = await pool.query(
    `
      SELECT c.id
      FROM conversations c
      JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
      JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
      LIMIT 1
    `,
    [req.user.id, toUserId]
  );

  if (existing.rows.length > 0) {
    return res.json({ conversationId: existing.rows[0].id });
  }

  const title = `Conversation ${req.user.id} & ${toUserId}`;
  const convResult = await pool.query(
    `INSERT INTO conversations (title, last_message) VALUES ($1, $2) RETURNING id`,
    [title, '']
  );
  const conversationId = convResult.rows[0].id;
  await pool.query(
    `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
    [conversationId, req.user.id, toUserId]
  );

  res.status(201).json({ conversationId });
});

app.get('/api/messages', authRequired, async (req, res) => {
  const { conversationId } = req.query;
  if (!conversationId) {
    return res.status(400).json({ error: 'conversationId requis.' });
  }

  await pool.query(
    `
      UPDATE messages
      SET read_by = array_append(read_by, $2)
      WHERE conversation_id = $1 AND NOT (read_by @> ARRAY[$2]::int[]) AND from_user_id <> $2
    `,
    [conversationId, req.user.id]
  );

  const result = await pool.query(
    `
      SELECT m.id, m.conversation_id AS "conversationId", m.from_user_id AS "fromUserId",
             m.text, m.sent_at AS "sentAt", m.read_by AS "readBy",
             u.name AS "fromUserName"
      FROM messages m
      LEFT JOIN users u ON u.id = m.from_user_id
      WHERE m.conversation_id = $1 AND NOT (m.deleted_by @> ARRAY[$2]::int[])
      ORDER BY m.sent_at ASC
    `,
    [conversationId, req.user.id]
  );
  res.json(result.rows);
});

app.post('/api/messages', authRequired, ensureNotSuspended, async (req, res) => {
  const { conversationId, text } = req.body || {};
  if (!conversationId || !text) {
    return res.status(400).json({ error: 'conversationId et text requis.' });
  }

  const result = await pool.query(
    `
      INSERT INTO messages (conversation_id, from_user_id, text, read_by)
      VALUES ($1, $2, $3, ARRAY[$2]::int[])
      RETURNING id, conversation_id AS "conversationId", from_user_id AS "fromUserId",
                text, sent_at AS "sentAt", read_by AS "readBy"
    `,
    [conversationId, req.user.id, text]
  );

  await pool.query(
    `UPDATE conversations SET last_message = $1 WHERE id = $2`,
    [text, conversationId]
  );

  const message = {
    ...result.rows[0],
    fromUserName: req.user.name || null,
  };
  io.to(`conversation:${conversationId}`).emit('message:new', message);

  const participants = await pool.query(
    `SELECT user_id FROM conversation_participants WHERE conversation_id = $1`,
    [conversationId]
  );
  for (const row of participants.rows) {
    if (row.user_id === req.user.id) continue;
    const notificationResult = await pool.query(
      `
        INSERT INTO notifications (user_id, type, title, body, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, user_id AS "userId", type, title, body, is_read AS "isRead", created_at AS "createdAt", metadata
      `,
      [
        row.user_id,
        'message',
        'Nouveau message',
        message.text,
        JSON.stringify({ conversationId, fromUserId: req.user.id }),
      ]
    );
    const notification = notificationResult.rows[0];
    io.to(`user:${row.user_id}`).emit('notification:new', notification);
  }

  res.status(201).json(message);
});

app.delete('/api/messages/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    `
      UPDATE messages m
      SET deleted_by = array_append(deleted_by, $1)
      FROM conversation_participants cp
      WHERE m.id = $2
        AND cp.conversation_id = m.conversation_id
        AND cp.user_id = $1
        AND NOT (deleted_by @> ARRAY[$1]::int[])
      RETURNING m.id
    `,
    [req.user.id, id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Message introuvable.' });
  }
  res.status(204).send();
});

app.get('/api/messages/threads', authRequired, async (req, res) => {
  const box = String(req.query.box || 'inbox');
  const blockedResult = await pool.query(
    'SELECT blocked_id AS "blockedId" FROM blocked_users WHERE blocker_id = $1',
    [req.user.id]
  );
  const blockedIds = blockedResult.rows.map((row) => row.blockedId);

  const result = await pool.query(
    `
      SELECT c.id,
             COALESCE(u.name, c.title) AS title,
             (SELECT m.text FROM messages m
              WHERE m.conversation_id = c.id AND NOT (m.deleted_by @> ARRAY[$1]::int[])
              ORDER BY m.sent_at DESC LIMIT 1) AS "lastMessage",
             (SELECT m.from_user_id FROM messages m
              WHERE m.conversation_id = c.id AND NOT (m.deleted_by @> ARRAY[$1]::int[])
              ORDER BY m.sent_at DESC LIMIT 1) AS "lastFromUserId",
             (SELECT m.sent_at FROM messages m
              WHERE m.conversation_id = c.id AND NOT (m.deleted_by @> ARRAY[$1]::int[])
              ORDER BY m.sent_at DESC LIMIT 1) AS "lastSentAt",
             (SELECT COUNT(*) FROM messages m
              WHERE m.conversation_id = c.id
                AND m.from_user_id <> $1
                AND NOT (m.read_by @> ARRAY[$1]::int[])
                AND NOT (m.deleted_by @> ARRAY[$1]::int[])
             ) AS "unreadCount"
      FROM conversations c
      JOIN conversation_participants cp ON cp.conversation_id = c.id
      LEFT JOIN LATERAL (
        SELECT u.name
        FROM conversation_participants cp2
        JOIN users u ON u.id = cp2.user_id
        WHERE cp2.conversation_id = c.id AND cp2.user_id <> $1
        ORDER BY u.name ASC
        LIMIT 1
      ) u ON TRUE
      WHERE cp.user_id = $1
    `,
    [req.user.id]
  );

  let threads = result.rows.map((row) => ({
    ...row,
    unreadCount: Number(row.unreadCount) || 0,
  }));

  if (blockedIds.length > 0) {
    if (box === 'spam') {
      threads = threads.filter((item) => blockedIds.includes(item.lastFromUserId));
    } else {
      threads = threads.filter((item) => !blockedIds.includes(item.lastFromUserId));
    }
  } else if (box === 'spam') {
    threads = [];
  }

  threads.sort((a, b) => new Date(b.lastSentAt || 0) - new Date(a.lastSentAt || 0));
  res.json(threads);
});

app.get('/api/alerts-summary', authRequired, async (req, res) => {
  const pendingResult = await pool.query(
    'SELECT COUNT(*)::int AS count FROM connection_requests WHERE to_user_id = $1 AND status = $2',
    [req.user.id, 'pending']
  );
  const blockedResult = await pool.query(
    'SELECT blocked_id AS "blockedId" FROM blocked_users WHERE blocker_id = $1',
    [req.user.id]
  );
  const blockedIds = blockedResult.rows.map((row) => row.blockedId);
  const unreadResult = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM messages m
      JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE cp.user_id = $1
        AND m.from_user_id <> $1
        AND NOT (m.read_by @> ARRAY[$1]::int[])
        AND NOT (m.deleted_by @> ARRAY[$1]::int[])
        AND ($2::int[] IS NULL OR NOT (m.from_user_id = ANY($2::int[])))
    `,
    [req.user.id, blockedIds.length ? blockedIds : null]
  );
  res.json({
    pendingRequests: pendingResult.rows[0]?.count || 0,
    unreadMessages: unreadResult.rows[0]?.count || 0,
  });
});

app.get('/api/notifications', authRequired, async (req, res) => {
  const result = await pool.query(
    `
      SELECT id, user_id AS "userId", type, title, body, is_read AS "isRead",
             created_at AS "createdAt", metadata
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `,
    [req.user.id]
  );
  res.json(result.rows);
});

app.post('/api/reports', authRequired, ensureNotSuspended, async (req, res) => {
  const { targetType, targetId, reason } = req.body || {};
  if (!targetType || !targetId) {
    return res.status(400).json({ error: 'targetType et targetId requis.' });
  }
  const result = await pool.query(
    `
      INSERT INTO reports (reporter_id, target_type, target_id, reason)
      VALUES ($1, $2, $3, $4)
      RETURNING id, reporter_id AS "reporterId", target_type AS "targetType",
                target_id AS "targetId", reason, status, created_at AS "createdAt"
    `,
    [req.user.id, targetType, targetId, reason || '']
  );
  res.status(201).json(result.rows[0]);
});

app.get('/api/connection-requests', authRequired, async (req, res) => {
  const result = await pool.query(
    `
      SELECT id, from_user_id AS "fromUserId", to_user_id AS "toUserId",
             message, status, created_at AS "createdAt"
      FROM connection_requests
      WHERE to_user_id = $1
      ORDER BY created_at DESC
    `,
    [req.user.id]
  );
  res.json(result.rows);
});

app.get('/api/hubmates', authRequired, async (req, res) => {
  const result = await pool.query(
    `
      SELECT u.id, u.name, u.handle, u.city, u.bio, u.avatar_url AS "avatarUrl"
      FROM connection_requests cr
      JOIN users u ON u.id = CASE
        WHEN cr.from_user_id = $1 THEN cr.to_user_id
        ELSE cr.from_user_id
      END
      WHERE (cr.from_user_id = $1 OR cr.to_user_id = $1)
        AND cr.status = 'accepted'
      ORDER BY u.name ASC
    `,
    [req.user.id]
  );
  res.json(result.rows.map((row) => ({ ...row, avatarUrl: normalizeFileUrl(row.avatarUrl) })));
});

app.get('/api/hubmates/requests', authRequired, async (req, res) => {
  const result = await pool.query(
    `
      SELECT cr.id, cr.message, cr.status, cr.created_at AS "createdAt",
             u.id AS "userId", u.name, u.handle, u.city, u.avatar_url AS "avatarUrl"
      FROM connection_requests cr
      JOIN users u ON u.id = cr.from_user_id
      WHERE cr.to_user_id = $1 AND cr.status = 'pending'
      ORDER BY cr.created_at DESC
    `,
    [req.user.id]
  );
  res.json(result.rows.map((row) => ({ ...row, avatarUrl: normalizeFileUrl(row.avatarUrl) })));
});

app.delete('/api/hubmates/:userId', authRequired, async (req, res) => {
  const { userId } = req.params;
  const result = await pool.query(
    `
      DELETE FROM connection_requests
      WHERE status = 'accepted'
        AND ((from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1))
      RETURNING id
    `,
    [req.user.id, userId]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Hubmate introuvable.' });
  }
  res.status(204).send();
});

app.get('/api/blocks', authRequired, async (req, res) => {
  const result = await pool.query(
    `
      SELECT u.id, u.name, u.handle, u.city, u.avatar_url AS "avatarUrl"
      FROM blocked_users b
      JOIN users u ON u.id = b.blocked_id
      WHERE b.blocker_id = $1
      ORDER BY u.name ASC
    `,
    [req.user.id]
  );
  res.json(result.rows.map((row) => ({ ...row, avatarUrl: normalizeFileUrl(row.avatarUrl) })));
});

app.post('/api/blocks', authRequired, async (req, res) => {
  const { blockedUserId } = req.body || {};
  if (!blockedUserId) {
    return res.status(400).json({ error: 'blockedUserId requis.' });
  }
  await pool.query(
    `
      INSERT INTO blocked_users (blocker_id, blocked_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `,
    [req.user.id, blockedUserId]
  );
  res.status(201).json({ ok: true });
});

app.delete('/api/blocks/:blockedUserId', authRequired, async (req, res) => {
  const { blockedUserId } = req.params;
  await pool.query(
    `DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2`,
    [req.user.id, blockedUserId]
  );
  res.status(204).send();
});

app.post('/api/connection-requests/:id/accept', authRequired, async (req, res) => {
  const { id } = req.params;
  const reqResult = await pool.query(
    `
      UPDATE connection_requests
      SET status = 'accepted'
      WHERE id = $1 AND to_user_id = $2 AND status = 'pending'
      RETURNING id, from_user_id AS "fromUserId", to_user_id AS "toUserId", status
    `,
    [id, req.user.id]
  );
  if (reqResult.rows.length === 0) {
    return res.status(404).json({ error: 'Demande introuvable.' });
  }

  const fromUserId = reqResult.rows[0].fromUserId;
  const existing = await pool.query(
    `
      SELECT c.id
      FROM conversations c
      JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
      JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
      LIMIT 1
    `,
    [req.user.id, fromUserId]
  );

  let conversationId = existing.rows[0]?.id || null;
  if (!conversationId) {
    const title = `Conversation ${req.user.id} & ${fromUserId}`;
    const convResult = await pool.query(
      `INSERT INTO conversations (title, last_message) VALUES ($1, $2) RETURNING id`,
      [title, '']
    );
    conversationId = convResult.rows[0].id;
    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [conversationId, req.user.id, fromUserId]
    );
  }

  await pool.query(
    `
      UPDATE notifications
      SET metadata = jsonb_set(metadata, '{requestStatus}', '"accepted"', true)
      WHERE user_id = $1 AND type = 'connection_request' AND metadata->>'requestId' = $2
    `,
    [req.user.id, String(id)]
  );

  const notificationResult = await pool.query(
    `
      INSERT INTO notifications (user_id, type, title, body, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id AS "userId", type, title, body, is_read AS "isRead",
                created_at AS "createdAt", metadata
    `,
    [
      fromUserId,
      'connection_response',
      'Demande acceptée',
      `${req.user.name || 'Un utilisateur'} a accepté votre demande`,
      JSON.stringify({ requestId: id, status: 'accepted', fromUserId: req.user.id, conversationId }),
    ]
  );
  const notification = notificationResult.rows[0];
  io.to(`user:${fromUserId}`).emit('notification:new', notification);

  res.json({ ok: true, conversationId });
});

app.post('/api/connection-requests/:id/decline', authRequired, async (req, res) => {
  const { id } = req.params;
  const reqResult = await pool.query(
    `
      UPDATE connection_requests
      SET status = 'declined'
      WHERE id = $1 AND to_user_id = $2 AND status = 'pending'
      RETURNING id, from_user_id AS "fromUserId", to_user_id AS "toUserId", status
    `,
    [id, req.user.id]
  );
  if (reqResult.rows.length === 0) {
    return res.status(404).json({ error: 'Demande introuvable.' });
  }

  const fromUserId = reqResult.rows[0].fromUserId;
  await pool.query(
    `
      UPDATE notifications
      SET metadata = jsonb_set(metadata, '{requestStatus}', '"declined"', true)
      WHERE user_id = $1 AND type = 'connection_request' AND metadata->>'requestId' = $2
    `,
    [req.user.id, String(id)]
  );
  const notificationResult = await pool.query(
    `
      INSERT INTO notifications (user_id, type, title, body, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id AS "userId", type, title, body, is_read AS "isRead",
                created_at AS "createdAt", metadata
    `,
    [
      fromUserId,
      'connection_response',
      'Demande refusée',
      `${req.user.name || 'Un utilisateur'} a refusé votre demande`,
      JSON.stringify({ requestId: id, status: 'declined', fromUserId: req.user.id }),
    ]
  );
  const notification = notificationResult.rows[0];
  io.to(`user:${fromUserId}`).emit('notification:new', notification);

  res.json({ ok: true });
});

app.put('/api/notifications/:id/read', authRequired, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    `
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id AS "userId", type, title, body, is_read AS "isRead",
                created_at AS "createdAt", metadata
    `,
    [id, req.user.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Notification introuvable.' });
  }
  res.json(result.rows[0]);
});

app.put('/api/notifications/read-all', authRequired, async (req, res) => {
  await pool.query(
    `
      UPDATE notifications
      SET is_read = TRUE
      WHERE user_id = $1
    `,
    [req.user.id]
  );
  res.status(204).send();
});

// Admin API
app.get('/api/admin/users', authRequired, adminRequired, async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, role, handle, city, bio, availability, goals, interests, created_at AS "createdAt" FROM users ORDER BY created_at DESC'
  );
  res.json(result.rows);
});

app.put('/api/admin/users/:id', authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  const { role, name } = req.body || {};
  const result = await pool.query(
    `
      UPDATE users
      SET role = COALESCE($1, role),
          name = COALESCE($2, name)
      WHERE id = $3
      RETURNING id, name, email, role, handle, city, bio, availability, goals, interests
    `,
    [role, name, id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }
  res.json(result.rows[0]);
});

app.delete('/api/admin/users/:id', authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    'DELETE FROM users WHERE id = $1 RETURNING id',
    [id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }
  res.status(204).send();
});

app.get('/api/admin/goals', authRequired, adminRequired, async (req, res) => {
  const result = await pool.query(
    `
      SELECT id, owner_id AS "ownerId", title, category, progress, created_at AS "createdAt"
      FROM goals
      ORDER BY created_at DESC
    `
  );
  res.json(result.rows);
});

app.delete('/api/admin/goals/:id', authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  const current = await pool.query('SELECT image_url AS "imageUrl" FROM goals WHERE id = $1', [id]);
  const result = await pool.query('DELETE FROM goals WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Objectif introuvable.' });
  }
  safeUnlink(current.rows[0]?.imageUrl);
  res.status(204).send();
});

app.get('/api/admin/comments', authRequired, adminRequired, async (req, res) => {
  const result = await pool.query(
    `
      SELECT id, user_id AS "userId", goal_id AS "goalId", body, created_at AS "createdAt"
      FROM comments
      ORDER BY created_at DESC
    `
  );
  res.json(result.rows);
});

app.delete('/api/admin/comments/:id', authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query('DELETE FROM comments WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Commentaire introuvable.' });
  }
  res.status(204).send();
});

app.get('/api/admin/ads', authRequired, adminRequired, async (req, res) => {
  const result = await pool.query(
    `
      SELECT id, title, body, image_url AS "imageUrl", link_url AS "linkUrl",
             is_active AS "isActive", is_sponsor_of_day AS "isSponsorOfDay",
             sponsor_start AS "sponsorStart", sponsor_end AS "sponsorEnd",
             created_at AS "createdAt"
      FROM ads
      ORDER BY created_at DESC
    `
  );
  res.json(result.rows);
});

// Public ads
app.get('/api/ads', async (req, res) => {
  const result = await pool.query(
    `
      SELECT id, title, body, image_url AS "imageUrl", link_url AS "linkUrl",
             is_sponsor_of_day AS "isSponsorOfDay",
             sponsor_start AS "sponsorStart", sponsor_end AS "sponsorEnd"
      FROM ads
      WHERE is_active = TRUE
      ORDER BY created_at DESC
      LIMIT 6
    `
  );
  res.json(result.rows);
});

app.post('/api/admin/ads', authRequired, adminRequired, async (req, res) => {
  const { title, body, imageUrl, linkUrl, isActive, isSponsorOfDay, sponsorStart, sponsorEnd } = req.body || {};
  if (!title) {
    return res.status(400).json({ error: 'title requis.' });
  }
  if (isSponsorOfDay && isActive === false) {
    return res.status(400).json({ error: 'Sponsor du jour doit être actif.' });
  }
  const today = new Date().toISOString().slice(0, 10);
  const finalSponsorStart = isSponsorOfDay ? (sponsorStart || today) : sponsorStart || null;
  const finalSponsorEnd = isSponsorOfDay ? (sponsorEnd || finalSponsorStart) : sponsorEnd || null;
  if (isSponsorOfDay) {
    await pool.query(`UPDATE ads SET is_sponsor_of_day = FALSE`);
  }
  const result = await pool.query(
    `
      INSERT INTO ads (title, body, image_url, link_url, is_active, is_sponsor_of_day, sponsor_start, sponsor_end)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, title, body, image_url AS "imageUrl", link_url AS "linkUrl",
                is_active AS "isActive", is_sponsor_of_day AS "isSponsorOfDay",
                sponsor_start AS "sponsorStart", sponsor_end AS "sponsorEnd",
                created_at AS "createdAt"
    `,
    [
      title,
      body || '',
      imageUrl || null,
      linkUrl || null,
      isActive !== false,
      Boolean(isSponsorOfDay),
      finalSponsorStart,
      finalSponsorEnd,
    ]
  );
  res.status(201).json(result.rows[0]);
});

app.put('/api/admin/ads/:id', authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  const { title, body, imageUrl, linkUrl, isActive, isSponsorOfDay, sponsorStart, sponsorEnd } = req.body || {};
  if (isSponsorOfDay === true && isActive === false) {
    return res.status(400).json({ error: 'Sponsor du jour doit être actif.' });
  }
  const today = new Date().toISOString().slice(0, 10);
  const finalSponsorStart =
    isSponsorOfDay === true ? sponsorStart || today : sponsorStart !== undefined ? sponsorStart : null;
  const finalSponsorEnd =
    isSponsorOfDay === true ? sponsorEnd || finalSponsorStart : sponsorEnd !== undefined ? sponsorEnd : null;
  if (isSponsorOfDay === true) {
    await pool.query(`UPDATE ads SET is_sponsor_of_day = FALSE`);
  }
  const result = await pool.query(
    `
      UPDATE ads
      SET title = COALESCE($1, title),
          body = COALESCE($2, body),
          image_url = COALESCE($3, image_url),
          link_url = COALESCE($4, link_url),
          is_active = COALESCE($5, is_active),
          is_sponsor_of_day = COALESCE($6, is_sponsor_of_day),
          sponsor_start = COALESCE($7, sponsor_start),
          sponsor_end = COALESCE($8, sponsor_end)
      WHERE id = $9
      RETURNING id, title, body, image_url AS "imageUrl", link_url AS "linkUrl",
                is_active AS "isActive", is_sponsor_of_day AS "isSponsorOfDay",
                sponsor_start AS "sponsorStart", sponsor_end AS "sponsorEnd",
                created_at AS "createdAt"
    `,
    [
      title,
      body,
      imageUrl,
      linkUrl,
      isActive,
      isSponsorOfDay,
      finalSponsorStart,
      finalSponsorEnd,
      id,
    ]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Publicité introuvable.' });
  }
  res.json(result.rows[0]);
});

app.post('/api/admin/ads/:id/sponsor', authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  const { sponsorStart, sponsorEnd } = req.body || {};
  const today = new Date().toISOString().slice(0, 10);
  const finalSponsorStart = sponsorStart || today;
  const finalSponsorEnd = sponsorEnd || finalSponsorStart;
  const adCheck = await pool.query(
    `SELECT is_active AS "isActive" FROM ads WHERE id = $1`,
    [id]
  );
  if (adCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Publicité introuvable.' });
  }
  if (!adCheck.rows[0].isActive) {
    return res.status(400).json({ error: 'Sponsor du jour doit être actif.' });
  }
  await pool.query(`UPDATE ads SET is_sponsor_of_day = FALSE`);
  const result = await pool.query(
    `
      UPDATE ads
      SET is_sponsor_of_day = TRUE,
          sponsor_start = $2,
          sponsor_end = $3
      WHERE id = $1
      RETURNING id, title, body, image_url AS "imageUrl", link_url AS "linkUrl",
                is_active AS "isActive", is_sponsor_of_day AS "isSponsorOfDay",
                sponsor_start AS "sponsorStart", sponsor_end AS "sponsorEnd",
                created_at AS "createdAt"
    `,
    [id, finalSponsorStart, finalSponsorEnd]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Publicité introuvable.' });
  }
  res.json(result.rows[0]);
});

app.delete('/api/admin/ads/:id', authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query('DELETE FROM ads WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Publicité introuvable.' });
  }
  res.status(204).send();
});

app.get('/api/admin/messages', authRequired, adminRequired, async (req, res) => {
  const result = await pool.query(
    `
      SELECT id, conversation_id AS "conversationId", from_user_id AS "fromUserId",
             text, sent_at AS "sentAt"
      FROM messages
      ORDER BY sent_at DESC
      LIMIT 200
    `
  );
  res.json(result.rows);
});

app.delete('/api/admin/messages/:id', authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query('DELETE FROM messages WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Message introuvable.' });
  }
  res.status(204).send();
});

app.get('/api/admin/notifications', authRequired, adminRequired, async (req, res) => {
  const result = await pool.query(
    `
      SELECT id, user_id AS "userId", type, title, body, is_read AS "isRead", created_at AS "createdAt"
      FROM notifications
      ORDER BY created_at DESC
      LIMIT 200
    `
  );
  res.json(result.rows);
});

app.get('/api/admin/reports', authRequired, adminRequired, async (req, res) => {
  const result = await pool.query(
    `
      SELECT r.id,
             r.reporter_id AS "reporterId",
             reporter.name AS "reporterName",
             r.target_type AS "targetType",
             r.target_id AS "targetId",
             r.reason,
             r.status,
             r.created_at AS "createdAt",
             target_user.name AS "targetUserName",
             target_user.id AS "targetUserId"
      FROM reports r
      LEFT JOIN users reporter ON reporter.id = r.reporter_id
      LEFT JOIN users target_user
        ON (
          (r.target_type = 'profile' AND target_user.id = r.target_id)
          OR
          (r.target_type = 'comment' AND target_user.id = (SELECT user_id FROM post_comments WHERE id = r.target_id))
          OR
          (r.target_type = 'message' AND target_user.id = (SELECT from_user_id FROM messages WHERE id = r.target_id))
        )
      ORDER BY r.created_at DESC
      LIMIT 200
    `
  );
  res.json(result.rows);
});

app.put('/api/admin/reports/:id', authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const result = await pool.query(
    `
      UPDATE reports
      SET status = COALESCE($1, status)
      WHERE id = $2
      RETURNING id, reporter_id AS "reporterId", target_type AS "targetType",
                target_id AS "targetId", reason, status, created_at AS "createdAt"
    `,
    [status, id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Signalement introuvable.' });
  }
  res.json(result.rows[0]);
});

app.post('/api/admin/users/:id/suspend', authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  const { days = 7 } = req.body || {};
  const until = new Date();
  until.setDate(until.getDate() + Number(days || 7));
  const result = await pool.query(
    `
      UPDATE users
      SET suspended_until = $1
      WHERE id = $2
      RETURNING id, name, email, role, suspended_until AS "suspendedUntil"
    `,
    [until.toISOString(), id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }
  res.json(result.rows[0]);
});

app.delete('/api/admin/posts/comments/:id', authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query('DELETE FROM post_comments WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Commentaire introuvable.' });
  }
  res.status(204).send();
});

app.post('/api/admin/users/:id/unsuspend', authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    `
      UPDATE users
      SET suspended_until = NULL
      WHERE id = $1
      RETURNING id, name, email, role, suspended_until AS "suspendedUntil"
    `,
    [id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }
  res.json(result.rows[0]);
});

app.delete('/api/admin/notifications/:id', authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query('DELETE FROM notifications WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Notification introuvable.' });
  }
  res.status(204).send();
});

initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`✅ Serveur Express lancé sur http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ Erreur init DB:', error.message);
  });
