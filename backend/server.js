// backend/server.js

// Charger les variables d'environnement
require('dotenv').config();

// Import des modules
const express = require('express');
const axios = require('axios');

// Créer l'app
const app = express();
const PORT = process.env.PORT || 3001;

// Récupérer les clés API depuis .env
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const INSTAGRAM_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

// Route exemple : recherche YouTube
app.get('/api/youtube/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Appel à l'API YouTube
    const response = await axios.get(
      `https://www.googleapis.com/youtube/v3/channels?forUsername=${username}&key=${YOUTUBE_API_KEY}`
    );

    res.json(response.data);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Erreur lors de la récupération des données YouTube' });
  }
});

// Route exemple : Instagram
app.get('/api/instagram/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Exemple d’appel à une API externe
    const response = await axios.get(
      `https://graph.instagram.com/v12.0/me/media?access_token=${INSTAGRAM_TOKEN}&fields=id,caption,media_url`
    );

    res.json(response.data);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Erreur lors de la récupération des données Instagram' });
  }
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur Express lancé sur http://localhost:${PORT}`);
});