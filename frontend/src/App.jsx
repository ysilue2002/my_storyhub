import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import Footer from './components/Footer';
import LanguageSwitcher from './components/LanguageSwitcher';

import fr from './lang/fr.json';
import en from './lang/en.json';
import ar from './lang/ar.json';

const messages = { fr, en, ar };
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';
const WS_BASE = process.env.REACT_APP_WS_BASE || API_BASE;

export default function App() {
  const [lang, setLang] = useState('fr');
  const [searchQuery, setSearchQuery] = useState('');
  const [goals, setGoals] = useState([]);
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messagesList, setMessagesList] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [status, setStatus] = useState({ loading: true, error: '' });
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [authState, setAuthState] = useState({ loading: false, error: '' });
  const socketRef = useRef(null);
  const selectedConversationRef = useRef(null);
  const [profileStatus, setProfileStatus] = useState({ error: '', success: '' });
  const [goalStatus, setGoalStatus] = useState({ error: '', success: '' });
  const [uploadStatus, setUploadStatus] = useState({ error: '', avatar: false, cover: false, goal: false });
  const [profileForm, setProfileForm] = useState({
    name: '',
    gender: '',
    age: '',
    country: '',
    city: '',
    bio: '',
    availability: '',
    goals: '',
    interests: '',
  });
  const [myGoals, setMyGoals] = useState([]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedGoalIds, setSelectedGoalIds] = useState([]);
  const [goalForm, setGoalForm] = useState({
    id: null,
    title: '',
    description: '',
    category: '',
    progress: 0,
    tags: '',
    imageUrl: '',
    startDate: '',
    endDate: '',
    priority: 'normal',
    steps: [{ title: '', done: false }],
  });
  const [ads, setAds] = useState([]);
  const [hubmateSuggestions, setHubmateSuggestions] = useState([]);
  const [hubmateIds, setHubmateIds] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [hubmateFilters, setHubmateFilters] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('hubmateFilters') || '{}');
      return {
        sameCityOnly: Boolean(saved.sameCityOnly),
        minScore: Number(saved.minScore) || 0,
      };
    } catch (error) {
      return { sameCityOnly: false, minScore: 0 };
    }
  });

  const t = messages[lang];
  const [toast, setToast] = useState('');
  const [currentHash, setCurrentHash] = useState(window.location.hash || '');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode') || 'simple');
  const isSimple = viewMode === 'simple';
  const [alerts, setAlerts] = useState({ pendingRequests: 0, unreadMessages: 0 });

  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || '');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const authFetch = (url, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    return fetch(url, { ...options, headers });
  };

  const loadAlerts = async () => {
    if (!authToken) {
      setAlerts({ pendingRequests: 0, unreadMessages: 0 });
      return;
    }
    try {
      const response = await authFetch(`${API_BASE}/api/alerts-summary`);
      const data = await response.json();
      setAlerts({
        pendingRequests: Number(data.pendingRequests) || 0,
        unreadMessages: Number(data.unreadMessages) || 0,
      });
    } catch (error) {
      setAlerts({ pendingRequests: 0, unreadMessages: 0 });
    }
  };

  useEffect(() => {
    const loadGoals = async () => {
      try {
        setStatus({ loading: true, error: '' });
        const goalsRes = await fetch(`${API_BASE}/api/goals`);
        const goalsData = await goalsRes.json();
        setGoals(goalsData);
        setStatus({ loading: false, error: '' });
      } catch (error) {
        setStatus({ loading: false, error: 'Erreur de chargement.' });
      }
    };

    loadGoals();
  }, []);

  const fetchUsers = async (queryValue) => {
    try {
      const query = String(queryValue || '').trim();
      const url = query
        ? `${API_BASE}/api/users?q=${encodeURIComponent(query)}`
        : `${API_BASE}/api/users`;
      const response = await fetch(url);
      const data = await response.json();
      setUsers(Array.isArray(data) ? data : []);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      setUsers([]);
      return [];
    }
  };

  useEffect(() => {
    let active = true;
    const loadUsers = async () => {
      const data = await fetchUsers(searchQuery);
      if (!active) return;
      setUsers(Array.isArray(data) ? data : []);
    };

    loadUsers();
    return () => {
      active = false;
    };
  }, [searchQuery]);

  useEffect(() => {
    const loadAds = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/ads`);
        const data = await response.json();
        setAds(Array.isArray(data) ? data : []);
      } catch (error) {
        setAds([]);
      }
    };
    loadAds();
  }, []);

  const featuredAds = ads.slice(0, 2);
  const feedAd = ads[2] || null;
  const isSponsorActive = (ad) => {
    if (!ad?.isSponsorOfDay) return false;
    if (!ad.sponsorStart && !ad.sponsorEnd) return true;
    const today = new Date();
    const start = ad.sponsorStart ? new Date(`${ad.sponsorStart}T00:00:00`) : null;
    const end = ad.sponsorEnd ? new Date(`${ad.sponsorEnd}T23:59:59`) : null;
    if (start && today < start) return false;
    if (end && today > end) return false;
    return true;
  };
  const sponsorOfDay =
    ads.find((ad) => isSponsorActive(ad)) ||
    (ads.length > 0 ? ads[new Date().getDate() % ads.length] : null);

  useEffect(() => {
    localStorage.setItem('hubmateFilters', JSON.stringify(hubmateFilters));
  }, [hubmateFilters]);

  useEffect(() => {
    if (!deleteMode) {
      setSelectedGoalIds([]);
    }
  }, [deleteMode]);

  useEffect(() => {
    const loadSuggestions = async () => {
      if (!authToken) {
        setHubmateSuggestions([]);
        return;
      }
      try {
        const query = new URLSearchParams({
          limit: '6',
          sameCityOnly: String(hubmateFilters.sameCityOnly),
          minScore: String(hubmateFilters.minScore),
        });
        const response = await authFetch(`${API_BASE}/api/hubmates/suggestions?${query.toString()}`);
        const data = await response.json();
        setHubmateSuggestions(Array.isArray(data) ? data : []);
      } catch (error) {
        setHubmateSuggestions([]);
      }
    };
    loadSuggestions();
  }, [authToken, hubmateFilters]);

  useEffect(() => {
    const loadMe = async () => {
      if (!authToken) {
        setCurrentUser(null);
        setProfileForm({
          name: '',
          gender: '',
          age: '',
          country: '',
          city: '',
          bio: '',
          availability: '',
          goals: '',
          interests: '',
        });
        setMyGoals([]);
        return;
      }

      try {
        const response = await authFetch(`${API_BASE}/api/me`);
        if (!response.ok) throw new Error('Auth failed');
        const data = await response.json();
        setCurrentUser(data);
        setProfileForm({
          name: data.name || '',
          gender: data.gender || '',
          age: data.age ?? '',
          country: data.country || '',
          city: data.city || '',
          bio: data.bio || '',
          availability: data.availability || '',
          goals: (data.goals || []).join(', '),
          interests: (data.interests || []).join(', '),
        });
      } catch (error) {
        setCurrentUser(null);
        setAuthToken('');
        localStorage.removeItem('authToken');
      }
    };

    loadMe();
  }, [authToken]);


  useEffect(() => {
    const loadMyGoals = async () => {
      if (!authToken) {
        setMyGoals([]);
        return;
      }
      try {
        const response = await authFetch(`${API_BASE}/api/my-goals`);
        const data = await response.json();
        setMyGoals(Array.isArray(data) ? data : []);
      } catch (error) {
        setMyGoals([]);
      }
    };
    loadMyGoals();
  }, [authToken]);

  useEffect(() => {
    const loadHubmateIds = async () => {
      if (!authToken) {
        setHubmateIds([]);
        return;
      }
      try {
        const response = await authFetch(`${API_BASE}/api/hubmates`);
        const data = await response.json();
        const ids = Array.isArray(data) ? data.map((item) => item.id).filter(Boolean) : [];
        setHubmateIds(ids);
      } catch (error) {
        setHubmateIds([]);
      }
    };
    loadHubmateIds();
  }, [authToken]);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    if (!authToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(WS_BASE, {
      auth: { token: authToken },
    });
    socketRef.current = socket;

    socket.on('message:new', (message) => {
      setMessagesList((prev) => {
        if (prev.some((item) => item.id === message.id)) return prev;
        if (
          selectedConversationRef.current &&
          message.conversationId !== selectedConversationRef.current.id
        )
          return prev;
        return [...prev, message];
      });

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === message.conversationId ? { ...conv, lastMessage: message.text } : conv
        )
      );
      loadAlerts();
    });

    socket.on('notification:new', () => {
      loadAlerts();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authToken]);

  useEffect(() => {
    loadAlerts();
  }, [authToken]);

  useEffect(() => {
    const loadConversations = async () => {
      if (!currentUser || !authToken) {
        setConversations([]);
        setSelectedConversation(null);
        return;
      }

      try {
        const response = await authFetch(`${API_BASE}/api/conversations`);
        const data = await response.json();
        setConversations(data);
        setSelectedConversation(data[0] || null);
      } catch (error) {
        setConversations([]);
        setSelectedConversation(null);
      }
    };

    loadConversations();
  }, [currentUser, authToken]);

  const refreshConversations = async (selectConversationId = null) => {
    if (!currentUser || !authToken) {
      setConversations([]);
      setSelectedConversation(null);
      return;
    }

    try {
      const response = await authFetch(`${API_BASE}/api/conversations`);
      const data = await response.json();
      setConversations(data);
      if (selectConversationId) {
        const found = data.find((conv) => conv.id === selectConversationId);
        setSelectedConversation(found || data[0] || null);
      } else {
        setSelectedConversation(data[0] || null);
      }
    } catch (error) {
      setConversations([]);
      setSelectedConversation(null);
    }
  };


  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedConversation || !authToken) {
        setMessagesList([]);
        return;
      }

      try {
        const response = await authFetch(
          `${API_BASE}/api/messages?conversationId=${selectedConversation.id}`
        );
        const data = await response.json();
        setMessagesList(data);
      } catch (error) {
        setMessagesList([]);
      }
    };

    loadMessages();
  }, [selectedConversation, authToken]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredGoals = useMemo(() => {
    const hubmatesGoals = authToken
      ? goals.filter((goal) => hubmateIds.includes(goal.ownerId))
      : [];
    if (!normalizedQuery) {
      return hubmatesGoals.slice(0, 20);
    }

    return hubmatesGoals.filter((goal) => {
      const haystack = [
        goal.title,
        goal.category,
        goal.description,
        ...(goal.tags || []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [goals, hubmateIds, normalizedQuery, authToken]);

  const priorityRank = { high: 0, normal: 1, low: 2 };
  const sortedGoalsByPriority = useMemo(
    () =>
      [...filteredGoals].sort((a, b) => {
        const pa = priorityRank[a.priority] ?? 3;
        const pb = priorityRank[b.priority] ?? 3;
        if (pa !== pb) return pa - pb;
        const ga = Number(a.progress) || 0;
        const gb = Number(b.progress) || 0;
        return gb - ga;
      }),
    [filteredGoals]
  );

  const goalsToShow = isSimple ? sortedGoalsByPriority.slice(0, 4) : sortedGoalsByPriority;

  const usersById = useMemo(() => {
    const map = new Map();
    users.forEach((user) => map.set(user.id, user));
    return map;
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) {
      return users.slice(0, 6);
    }
    return users;
  }, [users, normalizedQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchQuery('');
      setSearchModalOpen(false);
      setSelectedUser(null);
      return;
    }
    const results = await fetchUsers(searchQuery);
    if (results.length > 0) {
      setSelectedUser(results[0]);
      setSearchModalOpen(true);
    } else {
      setSelectedUser(null);
      setSearchModalOpen(true);
    }
  };

  const reportTarget = async (targetType, targetId) => {
    if (!authToken) {
      setAuthState({ loading: false, error: t.auth_required });
      return;
    }
    const reason = window.prompt(t.report_prompt) || '';
    await authFetch(`${API_BASE}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType, targetId, reason }),
    });
    showToast(t.report_sent);
  };

  const handleConnect = async (user) => {
    if (!authToken) {
      setAuthState({ loading: false, error: t.auth_required });
      return;
    }
    try {
      await authFetch(`${API_BASE}/api/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: user.id,
          message: `${t.cta_secondary} - ${user.name}`,
        }),
      });
    } catch (error) {
      // MVP: on ne bloque pas l'UX
    }
  };

  const handleStartConversation = async (user) => {
    if (!authToken) {
      setAuthState({ loading: false, error: t.auth_required });
      return;
    }
    const text = window.prompt(t.message_prompt || 'Votre message ?') || '';
    if (!text.trim()) return;
    try {
      await authFetch(`${API_BASE}/api/conversations/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: user.id, text: text.trim() }),
      });
      showToast(t.message_sent || 'Message envoyé.');
    } catch (error) {
      showToast(t.error_generic || 'Erreur.');
    }
  };

  const handleSendDirectMessage = async (user) => {
    if (!authToken) {
      setAuthState({ loading: false, error: t.auth_required });
      return;
    }
    const text = window.prompt(t.messages_send_placeholder || 'Votre message') || '';
    if (!text.trim()) return;
    try {
      await authFetch(`${API_BASE}/api/conversations/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: user.id, text: text.trim() }),
      });
      showToast(t.messages_sent || 'Message envoyé');
    } catch (error) {
      showToast(t.error_required || 'Erreur');
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation || !authToken) return;

    try {
      const response = await authFetch(`${API_BASE}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          text: messageText.trim(),
        }),
      });
      const data = await response.json();
      setMessagesList((prev) => (prev.some((item) => item.id === data.id) ? prev : [...prev, data]));
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === selectedConversation.id
            ? { ...conv, lastMessage: data.text }
            : conv
        )
      );
      setMessageText('');
    } catch (error) {
      // MVP: ignore pour rester fluide
    }
  };

  const quickEmojis = ['😀', '😂', '😍', '👍', '🙏', '🔥', '🎯', '💪'];
  const appendEmoji = (emoji) => {
    setMessageText((prev) => `${prev}${emoji}`);
  };

  const updateGoalStep = (index, patch) => {
    setGoalForm((prev) => {
      const nextSteps = (prev.steps || []).slice(0, 5).map((step, idx) =>
        idx === index ? { ...step, ...patch } : step
      );
      return { ...prev, steps: nextSteps };
    });
  };

  const addGoalStep = () => {
    setGoalForm((prev) => {
      const current = prev.steps || [];
      if (current.length >= 5) return prev;
      return { ...prev, steps: [...current, { title: '', done: false }] };
    });
  };

  const removeGoalStep = (index) => {
    setGoalForm((prev) => {
      const current = prev.steps || [];
      const nextSteps = current.filter((_, idx) => idx !== index);
      return { ...prev, steps: nextSteps.length > 0 ? nextSteps : [{ title: '', done: false }] };
    });
  };

  const getGoalStatus = (goal) => {
    if (Number(goal.progress) >= 100) return 'done';
    if (Number(goal.progress) <= 0) return 'not_started';
    return 'in_progress';
  };

  const getMotivationBadge = (goal) => {
    const statusKey = getGoalStatus(goal);
    if (statusKey === 'done') return { label: t.badge_congrats, className: 'bg-emerald-100 text-emerald-700' };
    if (statusKey === 'not_started') return { label: t.badge_motivation, className: 'bg-amber-100 text-amber-700' };
    return { label: t.badge_encourage, className: 'bg-sky-100 text-sky-700' };
  };

  const handleProfileSave = async () => {
    if (!authToken) return;
    if (!profileForm.name.trim()) {
      setProfileStatus({ error: t.error_required, success: '' });
      return;
    }
    const payload = {
      name: profileForm.name,
      gender: profileForm.gender,
      age: profileForm.age,
      country: profileForm.country,
      city: profileForm.city,
      bio: profileForm.bio,
      availability: profileForm.availability,
      goals: profileForm.goals
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      interests: profileForm.interests
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    };
    const response = await authFetch(`${API_BASE}/api/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      setProfileStatus({ error: data.error || t.error_required, success: '' });
      return;
    }
    setCurrentUser(data);
    setProfileStatus({ error: '', success: t.profile_saved });
  };

  const handleProfileDelete = async () => {
    if (!authToken) return;
    await authFetch(`${API_BASE}/api/me`, { method: 'DELETE' });
    handleLogout();
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !authToken) return;
    setUploadStatus({ error: '', avatar: true, cover: false, goal: false });
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await authFetch(`${API_BASE}/api/me/avatar`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setCurrentUser((prev) => ({ ...prev, avatarUrl: data.avatarUrl }));
    } catch (error) {
      setUploadStatus({ error: t.error_upload, avatar: false, cover: false, goal: false });
    } finally {
      setUploadStatus((prev) => ({ ...prev, avatar: false }));
    }
  };

  const handleCoverUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !authToken) return;
    setUploadStatus({ error: '', avatar: false, cover: true, goal: false });
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await authFetch(`${API_BASE}/api/me/cover`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setCurrentUser((prev) => ({ ...prev, coverUrl: data.coverUrl }));
    } catch (error) {
      setUploadStatus({ error: t.error_upload, avatar: false, cover: false, goal: false });
    } finally {
      setUploadStatus((prev) => ({ ...prev, cover: false }));
    }
  };

  const handleGoalImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !authToken) return;
    setUploadStatus({ error: '', avatar: false, cover: false, goal: true });
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await authFetch(`${API_BASE}/api/uploads/goal-image`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setGoalForm((prev) => ({ ...prev, imageUrl: data.imageUrl }));
    } catch (error) {
      setUploadStatus({ error: t.error_upload, avatar: false, cover: false, goal: false });
    } finally {
      setUploadStatus((prev) => ({ ...prev, goal: false }));
    }
  };

  const handleLogin = async ({ email, password }) => {
    try {
      setAuthState({ loading: true, error: '' });
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erreur de connexion.');
      }
      setAuthToken(data.token);
      localStorage.setItem('authToken', data.token);
      setAuthState({ loading: false, error: '' });
    } catch (error) {
      setAuthState({ loading: false, error: error.message });
    }
  };

  const handleRegister = async ({ name, email, password, gender, age, country, city, bio, availability, goals, interests }) => {
    try {
      setAuthState({ loading: true, error: '' });
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          gender,
          age,
          country,
          city,
          bio,
          availability,
          goals: String(goals || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          interests: String(interests || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erreur de création.');
      }
      setAuthToken(data.token);
      localStorage.setItem('authToken', data.token);
      setAuthState({ loading: false, error: '' });
    } catch (error) {
      setAuthState({ loading: false, error: error.message });
    }
  };

  const handleLogout = () => {
    setAuthToken('');
    setCurrentUser(null);
    localStorage.removeItem('authToken');
  };

  const showToast = (message) => {
    if (!message) return;
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  };

  const resetGoalForm = () => {
    setGoalForm({
      id: null,
      title: '',
      description: '',
      category: '',
      progress: 0,
      tags: '',
      imageUrl: '',
      startDate: '',
      endDate: '',
      priority: 'normal',
      steps: [{ title: '', done: false }],
    });
  };

  const handleGoalSubmit = async (event) => {
    event.preventDefault();
    if (!authToken) return;
    if (!goalForm.title.trim()) {
      setGoalStatus({ error: t.error_required, success: '' });
      return;
    }
    if (Number(goalForm.progress) < 0 || Number(goalForm.progress) > 100) {
      setGoalStatus({ error: t.error_progress, success: '' });
      return;
    }
    const cleanedSteps = (goalForm.steps || [])
      .map((step) => ({ title: String(step.title || '').trim(), done: Boolean(step.done) }))
      .filter((step) => step.title);
    if (cleanedSteps.length > 5) {
      setGoalStatus({ error: t.error_steps_limit, success: '' });
      return;
    }
    const payload = {
      title: goalForm.title,
      description: goalForm.description,
      category: goalForm.category,
      progress: Number(goalForm.progress) || 0,
      tags: goalForm.tags
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      imageUrl: goalForm.imageUrl || null,
      startDate: goalForm.startDate || null,
      endDate: goalForm.endDate || null,
      priority: goalForm.priority || 'normal',
      steps: cleanedSteps,
    };

    if (goalForm.id) {
      const response = await authFetch(`${API_BASE}/api/goals/${goalForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setGoalStatus({ error: data.error || t.error_required, success: '' });
        return;
      }
      setMyGoals((prev) => prev.map((goal) => (goal.id === data.id ? data : goal)));
    } else {
      const response = await authFetch(`${API_BASE}/api/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setGoalStatus({ error: data.error || t.error_required, success: '' });
        return;
      }
      setMyGoals((prev) => [data, ...prev]);
    }
    resetGoalForm();
    setGoalStatus({ error: '', success: t.goal_saved });
  };

  const handleGoalDelete = async (goalId) => {
    if (!authToken) return;
    await authFetch(`${API_BASE}/api/goals/${goalId}`, { method: 'DELETE' });
    setMyGoals((prev) => prev.filter((goal) => goal.id !== goalId));
  };

  const handleGoalEdit = (goal) => {
    setGoalForm({
      id: goal.id,
      title: goal.title || '',
      description: goal.description || '',
      category: goal.category || '',
      progress: Number(goal.progress) || 0,
      tags: Array.isArray(goal.tags) ? goal.tags.join(', ') : '',
      imageUrl: goal.imageUrl || '',
      startDate: goal.startDate ? String(goal.startDate).slice(0, 10) : '',
      endDate: goal.endDate ? String(goal.endDate).slice(0, 10) : '',
      priority: goal.priority || 'normal',
      steps:
        Array.isArray(goal.steps) && goal.steps.length > 0
          ? goal.steps.slice(0, 5).map((step) => ({
              title: String(step?.title || ''),
              done: Boolean(step?.done),
            }))
          : [{ title: '', done: false }],
    });
    setShowGoalForm(true);
    setGoalStatus({ error: '', success: '' });
  };

  const handleDeleteButton = async () => {
    if (!deleteMode) {
      setDeleteMode(true);
      return;
    }
    if (selectedGoalIds.length === 0) {
      showToast(t.goal_delete_confirm);
      return;
    }
    await Promise.all(selectedGoalIds.map((id) => handleGoalDelete(id)));
    setSelectedGoalIds([]);
    setDeleteMode(false);
  };


  const backgroundImageUrl = 'https://wallpapers.com/images/hd/inspirational-2560-x-1440-background-bgnodhf38mjuz41d.jpg';
  const headerSearch = (
    <div className="hidden md:block w-72">
      <SearchBar
        placeholder={t.search_placeholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onSearch={handleSearch}
        buttonText={t.search_button}
        lang={lang}
      />
    </div>
  );

  return (
    <div
      className={`min-h-screen text-slate-900 ${isSimple ? 'view-simple' : ''}`}
      style={{
        backgroundImage: `linear-gradient(rgba(255, 246, 232, 0.9), rgba(233, 242, 247, 0.9)), url(${backgroundImageUrl})`,
        backgroundSize: 'cover',
        backgroundAttachment: 'fixed',
        backgroundPosition: 'center',
      }}
    >
      <LanguageSwitcher lang={lang} setLang={setLang} />
      {toast && (
        <div className="fixed top-24 right-6 z-40 bg-slate-900 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
      <Header
        t={t}
        lang={lang}
        rightSlot={headerSearch}
        hubmatesCount={alerts.pendingRequests}
        messagesCount={alerts.unreadMessages}
      />

      {searchModalOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 flex items-center justify-center px-6"
          onClick={() => setSearchModalOpen(false)}
        >
          <div
            className="bg-white w-full max-w-xl rounded-2xl shadow-xl p-6 relative"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSearchModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-700"
            >
              ✕
            </button>
            {selectedUser ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-slate-100 overflow-hidden">
                    {selectedUser.avatarUrl ? (
                      <img src={selectedUser.avatarUrl} alt={selectedUser.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-slate-400 text-xl">
                        {selectedUser.name?.slice(0, 1) || '?'}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedUser.name}</h3>
                    <p className="text-sm text-slate-500">{selectedUser.handle}</p>
                    <p className="text-sm text-slate-500">
                      {[selectedUser.city, selectedUser.country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
                {selectedUser.bio && (
                  <p className="text-sm text-slate-600">{selectedUser.bio}</p>
                )}
                <div className="flex flex-wrap gap-2 text-xs">
                  {(selectedUser.goals || []).map((goal) => (
                    <span key={`goal-${goal}`} className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                      {goal}
                    </span>
                  ))}
                  {(selectedUser.interests || []).map((interest) => (
                    <span key={`interest-${interest}`} className="px-2 py-1 rounded-full bg-sky-50 text-sky-700">
                      {interest}
                    </span>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      await handleConnect(selectedUser);
                      showToast(t.hubmate_request_sent || 'Demande envoyée.');
                    }}
                    disabled={!authToken}
                    className="flex-1 bg-amber-600 text-white px-4 py-3 rounded-xl hover:bg-amber-500 transition disabled:opacity-60"
                  >
                    {t.hubmate_add || 'Ajouter Hubmate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartConversation(selectedUser)}
                    disabled={!authToken}
                    className="flex-1 border border-slate-200 px-4 py-3 rounded-xl hover:bg-slate-50 transition disabled:opacity-60"
                  >
                    {t.message_send || 'Envoyer message'}
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  {t.hubmate_request_note || 'La demande doit être acceptée avant de devenir Hubmates.'}
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500">{t.search_no_results || 'Aucun résultat.'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <main id="home" className="max-w-6xl mx-auto px-6 pb-16 pt-6">
        {status.error && (
          <div className="text-sm text-rose-600 mb-6">
            {status.error}
          </div>
        )}

        <section id="feed" className="space-y-4 mb-8">
          <h2 className={`text-xl font-semibold ${lang === 'ar' ? 'font-arabic text-right' : 'font-heading'}`}>
            Objectifs Hubmates
          </h2>
          {!authToken ? (
            <div className="bg-white/90 border border-slate-100 rounded-2xl p-5 text-sm text-slate-500">
              {t.auth_required}
            </div>
          ) : goalsToShow.length === 0 ? (
            <div className="bg-white/90 border border-slate-100 rounded-2xl p-5 text-sm text-slate-500">
              {t.goal_empty}
            </div>
          ) : (
            <div className="space-y-4">
              {goalsToShow.map((goal) => {
                const owner = usersById.get(goal.ownerId);
                const ownerName = owner?.name || `User #${goal.ownerId}`;
                const ownerAvatar = owner?.avatarUrl || null;
                return (
                  <article key={`feed-${goal.id}`} className="bg-white/90 border border-slate-100 rounded-2xl p-5 shadow-[var(--shadow-soft)]">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-11 w-11 rounded-full bg-slate-100 overflow-hidden">
                        {ownerAvatar ? (
                          <img src={ownerAvatar} alt={ownerName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-400 font-semibold">
                            {ownerName.slice(0, 1)}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{ownerName}</p>
                        <p className="text-xs text-slate-500">{goal.category || t.goals_title}</p>
                      </div>
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">{goal.title}</h3>
                    {goal.description && (
                      <p className="text-sm text-slate-600 mt-2">{goal.description}</p>
                    )}
                    {goal.imageUrl && (
                      <img src={goal.imageUrl} alt={goal.title} className="mt-3 h-56 w-full rounded-xl object-cover" />
                    )}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span>{t.goal_progress}</span>
                        <span>{Number(goal.progress) || 0}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: `${Math.max(0, Math.min(Number(goal.progress) || 0, 100))}%` }} />
                      </div>
                    </div>
                    {(goal.tags || []).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(goal.tags || []).map((tag) => (
                          <span key={`feed-tag-${goal.id}-${tag}`} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Footer t={t} lang={lang} />
    </div>
  );
}
