import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import Footer from './components/Footer';
import LanguageSwitcher from './components/LanguageSwitcher';
import GoalCard from './components/GoalCard';
import ProfileCard from './components/ProfileCard';
import ConversationCard from './components/ConversationCard';
import AuthCard from './components/AuthCard';
import NotificationCenter from './components/NotificationCenter';

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
  const [notifications, setNotifications] = useState([]);
  const [profileStatus, setProfileStatus] = useState({ error: '', success: '' });
  const [goalStatus, setGoalStatus] = useState({ error: '', success: '' });
  const [uploadStatus, setUploadStatus] = useState({ error: '', avatar: false, cover: false, goal: false });
  const [profileForm, setProfileForm] = useState({
    name: '',
    city: '',
    bio: '',
    availability: '',
    goals: '',
    interests: '',
  });
  const [myGoals, setMyGoals] = useState([]);
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
  const [requestsPendingOnly, setRequestsPendingOnly] = useState(true);
  const [requestsStatusFilter, setRequestsStatusFilter] = useState('pending');
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
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [toast, setToast] = useState('');
  const [currentHash, setCurrentHash] = useState(window.location.hash || '');
  const [viewMode, setViewMode] = useState('simple');
  const isSimple = viewMode === 'simple';

  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

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

  useEffect(() => {
    const loadPublicData = async () => {
      try {
        setStatus({ loading: true, error: '' });
        const [goalsRes, usersRes] = await Promise.all([
          fetch(`${API_BASE}/api/goals`),
          fetch(`${API_BASE}/api/users`),
        ]);

        const goalsData = await goalsRes.json();
        const usersData = await usersRes.json();

        setGoals(goalsData);
        setUsers(usersData);
        setStatus({ loading: false, error: '' });
      } catch (error) {
        setStatus({ loading: false, error: 'Erreur de chargement.' });
      }
    };

    loadPublicData();
  }, []);

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
    const loadNotifications = async () => {
      if (!authToken) {
        setNotifications([]);
        return;
      }
      try {
        const response = await authFetch(`${API_BASE}/api/notifications`);
        const data = await response.json();
        setNotifications(Array.isArray(data) ? data : []);
      } catch (error) {
        setNotifications([]);
      }
    };
    loadNotifications();
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
    });

    socket.on('notification:new', (notification) => {
      setNotifications((prev) => {
        if (prev.some((item) => item.id === notification.id)) return prev;
        return [notification, ...prev].slice(0, 50);
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
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
    if (!normalizedQuery) {
      return goals.slice(0, 6);
    }

    return goals.filter((goal) => {
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
  }, [goals, normalizedQuery]);

  const goalsToShow = isSimple ? filteredGoals.slice(0, 4) : filteredGoals;

  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) {
      return users.slice(0, 6);
    }

    return users.filter((user) => {
      const haystack = [
        user.name,
        user.handle,
        user.city,
        ...(user.goals || []),
        ...(user.interests || []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [users, normalizedQuery]);

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchQuery('');
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

  const handleGoalEdit = (goal) => {
    setGoalForm({
      id: goal.id,
      title: goal.title || '',
      description: goal.description || '',
      category: goal.category || '',
      progress: goal.progress || 0,
      tags: (goal.tags || []).join(', '),
      imageUrl: goal.imageUrl || '',
      startDate: goal.startDate ? String(goal.startDate).slice(0, 10) : '',
      endDate: goal.endDate ? String(goal.endDate).slice(0, 10) : '',
      priority: goal.priority || 'normal',
      steps: Array.isArray(goal.steps) && goal.steps.length > 0 ? goal.steps.slice(0, 5) : [{ title: '', done: false }],
    });
  };

  const handleGoalDelete = async (goalId) => {
    if (!authToken) return;
    await authFetch(`${API_BASE}/api/goals/${goalId}`, { method: 'DELETE' });
    setMyGoals((prev) => prev.filter((goal) => goal.id !== goalId));
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

  const handleRegister = async ({ name, email, password }) => {
    try {
      setAuthState({ loading: true, error: '' });
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
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
    setNotifications([]);
    localStorage.removeItem('authToken');
  };

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const pendingRequests = notifications.filter(
    (item) =>
      item.type === 'connection_request' &&
      (item.metadata?.requestStatus || 'pending') === 'pending'
  ).length;
  const requestNotifications = notifications.filter((item) => item.type === 'connection_request');
  const requestsSummary = requestNotifications.slice(0, 3);
  const visibleRequests = requestsPendingOnly
    ? requestNotifications.filter((item) => (item.metadata?.requestStatus || 'pending') === 'pending')
    : requestNotifications;
  const filteredRequests =
    requestsStatusFilter === 'all'
      ? requestNotifications
      : requestNotifications.filter(
          (item) => (item.metadata?.requestStatus || 'pending') === requestsStatusFilter
        );
  const requestCounts = {
    pending: requestNotifications.filter((item) => (item.metadata?.requestStatus || 'pending') === 'pending')
      .length,
    accepted: requestNotifications.filter((item) => (item.metadata?.requestStatus || 'pending') === 'accepted')
      .length,
    declined: requestNotifications.filter((item) => (item.metadata?.requestStatus || 'pending') === 'declined')
      .length,
    all: requestNotifications.length,
  };

  const showToast = (message) => {
    if (!message) return;
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  };
  const visibleNotifications = showUnreadOnly
    ? notifications.filter((item) => !item.isRead)
    : notifications;

  const markNotificationRead = async (notificationId) => {
    if (!authToken) return;
    await authFetch(`${API_BASE}/api/notifications/${notificationId}/read`, { method: 'PUT' });
    setNotifications((prev) =>
      prev.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item))
    );
  };

  const markAllRead = async () => {
    if (!authToken) return;
    await authFetch(`${API_BASE}/api/notifications/read-all`, { method: 'PUT' });
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  useEffect(() => {
    const markConversationMessagesRead = async () => {
      if (!authToken || !selectedConversation?.id) return;
      const unreadMessageNotifs = notifications.filter(
        (item) =>
          !item.isRead &&
          item.type === 'message' &&
          item.metadata?.conversationId === selectedConversation.id
      );
      if (unreadMessageNotifs.length === 0) return;
      await Promise.all(
        unreadMessageNotifs.map((item) =>
          authFetch(`${API_BASE}/api/notifications/${item.id}/read`, { method: 'PUT' })
        )
      );
      setNotifications((prev) =>
        prev.map((item) =>
          item.type === 'message' && item.metadata?.conversationId === selectedConversation.id
            ? { ...item, isRead: true }
            : item
        )
      );
    };
    markConversationMessagesRead();
  }, [authToken, selectedConversation, notifications]);

  const acceptHubmateRequest = async (notification) => {
    const requestId = notification?.metadata?.requestId;
    if (!authToken || !requestId) return;
    await authFetch(`${API_BASE}/api/connection-requests/${requestId}/accept`, {
      method: 'POST',
    });
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notification.id
          ? {
              ...item,
              isRead: true,
              metadata: { ...(item.metadata || {}), requestStatus: 'accepted' },
            }
          : item
      )
    );
  };

  const declineHubmateRequest = async (notification) => {
    const requestId = notification?.metadata?.requestId;
    if (!authToken || !requestId) return;
    const confirmed = window.confirm(t.notifications_decline_confirm);
    if (!confirmed) return;
    await authFetch(`${API_BASE}/api/connection-requests/${requestId}/decline`, {
      method: 'POST',
    });
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notification.id
          ? {
              ...item,
              isRead: true,
              metadata: { ...(item.metadata || {}), requestStatus: 'declined' },
            }
          : item
      )
    );
  };

  const openConversationFromNotification = async (notification) => {
    const conversationId = notification?.metadata?.conversationId;
    if (!authToken || !conversationId) return;
    await refreshConversations(conversationId);
    await markNotificationRead(notification.id);
    showToast(t.notifications_opened_conversation);
    window.location.hash = '#messages';
  };

  const replyToHubmate = async (notification) => {
    if (!authToken) return;
    if (notification?.type === 'message' && notification?.metadata?.conversationId) {
      await openConversationFromNotification(notification);
      return;
    }

    const toUserId = notification?.metadata?.fromUserId;
    if (!toUserId) return;
    const text = window.prompt(t.notifications_reply_prompt);
    if (!text) return;
    const response = await authFetch(`${API_BASE}/api/conversations/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUserId, text }),
    });
    const data = await response.json();
    if (data?.conversationId) {
      await refreshConversations(data.conversationId);
      await markNotificationRead(notification.id);
      window.location.hash = '#messages';
    }
  };


  const backgroundImageUrl = 'https://wallpapers.com/images/hd/inspirational-2560-x-1440-background-bgnodhf38mjuz41d.jpg';

  return (
    <div
      className="min-h-screen text-slate-900"
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
      <NotificationCenter
        notifications={notifications}
        onClear={() => setNotifications([])}
        title={t.notifications_title}
        emptyLabel={t.notifications_empty}
        clearLabel={t.notifications_clear}
      />
      <Header t={t} lang={lang} unreadCount={unreadCount} pendingRequests={pendingRequests} />

      <main id="home" className="max-w-6xl mx-auto px-6 pb-16 pt-6">
        {status.error && (
          <div className="text-sm text-rose-600 mb-6">
            {status.error}
          </div>
        )}

        <div className="bg-white/90 border border-slate-100 rounded-2xl p-4 mb-6 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-600">{t.view_title}</p>
              <p className="text-sm text-slate-600 mt-1">{t.view_description}</p>
            </div>
            <div className="inline-flex rounded-full bg-slate-100 p-1">
              <button
                onClick={() => setViewMode('simple')}
                className={`px-4 py-2 text-sm rounded-full transition ${
                  isSimple ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.view_simple}
              </button>
              <button
                onClick={() => setViewMode('full')}
                className={`px-4 py-2 text-sm rounded-full transition ${
                  !isSimple ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.view_full}
              </button>
            </div>
          </div>
        </div>

        {isSimple && (
          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6 mb-6">
            <div className="bg-white/90 border border-slate-100 rounded-2xl p-4 shadow-[var(--shadow-soft)]">
              <h3 className={`text-sm font-semibold mb-3 ${lang === 'ar' ? 'font-arabic text-right' : 'font-heading'}`}>
                {t.view_search_title}
              </h3>
              <SearchBar
                placeholder={t.search_placeholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onSearch={handleSearch}
                buttonText={t.search_button}
                lang={lang}
              />
              <p className={`text-xs text-slate-500 mt-3 ${lang === 'ar' ? 'font-arabic text-right' : ''}`}>
                {t.search_hint}
              </p>
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide text-amber-600">{t.view_quick_actions}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href="#goals" className="text-xs text-slate-600 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50">
                    {t.nav_goals}
                  </a>
                  <a href="#people" className="text-xs text-slate-600 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50">
                    {t.nav_people}
                  </a>
                  <a href="#messages" className="text-xs text-slate-600 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50">
                    {t.nav_messages}
                  </a>
                  <a href="#notifications" className="text-xs text-slate-600 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50">
                    {t.nav_notifications}
                  </a>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className={`text-sm font-semibold mb-3 ${lang === 'ar' ? 'font-arabic text-right' : 'font-heading'}`}>
                  {t.view_account_title}
                </h3>
                <AuthCard
                  t={t}
                  lang={lang}
                  user={currentUser}
                  onLogin={handleLogin}
                  onRegister={handleRegister}
                  onLogout={handleLogout}
                  loading={authState.loading}
                  error={authState.error}
                />
              </div>
              <div className="bg-white/90 border border-slate-100 rounded-2xl p-4 shadow-[var(--shadow-soft)]" id="people">
                <h3 className="text-sm font-semibold mb-3">{t.section_people_title}</h3>
                <div className="space-y-3">
                  {filteredUsers.slice(0, 3).map((user) => (
                    <div key={user.id} className="flex items-center justify-between text-sm text-slate-600">
                      <span>{user.name}</span>
                      <button
                        onClick={() => handleConnect(user)}
                        className="text-xs text-slate-700 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50"
                      >
                        {t.connect_button}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={`grid gap-6 ${isSimple ? 'lg:grid-cols-1' : 'lg:grid-cols-[0.7fr_1.6fr_0.7fr]'}`}>
          {!isSimple && (
            <aside className="space-y-4">
            <div className="bg-white/90 border border-slate-100 rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-amber-600 mb-3">MyStoryHub</p>
              <div className="flex flex-col gap-2 text-sm text-slate-600">
                <a href="#home" className="hover:text-slate-900">{t.nav_home}</a>
                <a href="#goals" className="hover:text-slate-900">{t.nav_goals}</a>
                <a href="#people" className="hover:text-slate-900">{t.nav_people}</a>
                <a href="#messages" className="hover:text-slate-900">{t.nav_messages}</a>
                <a href="#notifications" className="hover:text-slate-900">{t.nav_notifications}</a>
              </div>
            </div>
            <div className="bg-white/90 border border-slate-100 rounded-2xl p-4">
              <h3 className="text-sm font-semibold mb-2">{t.section_people_title}</h3>
              <div className="space-y-2">
                {filteredUsers.slice(0, 3).map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleConnect(user)}
                    className="w-full text-left text-sm text-slate-600 hover:text-slate-900"
                  >
                    {user.name}
                  </button>
                ))}
              </div>
            </div>
            </aside>
          )}

          <section id="goals" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className={`text-xl font-semibold ${lang === 'ar' ? 'font-arabic text-right' : 'font-heading'}`}>
                {t.section_goals_title}
              </h2>
              <span className="text-sm text-slate-500">{filteredGoals.length} {t.results_title}</span>
            </div>
            {status.loading ? (
              <div className="text-slate-500">{t.loading}</div>
            ) : filteredGoals.length === 0 ? (
              <div className="text-slate-500">{t.no_results}</div>
            ) : (
              <div className="flex flex-col gap-4">
                {goalsToShow.map((goal) => {
                  const owner = users.find((user) => user.id === goal.ownerId);
                  return <GoalCard key={goal.id} goal={goal} owner={owner} lang={lang} />;
                })}
              </div>
            )}
            {isSimple && filteredGoals.length > goalsToShow.length && (
              <button
                onClick={() => setViewMode('full')}
                className="text-sm text-slate-700 border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50"
              >
                {t.view_show_full}
              </button>
            )}
            {!isSimple && sponsorOfDay && (
              <div className="border border-amber-100 bg-amber-50/60 rounded-2xl p-4 transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-wide text-amber-600">{t.ads_sponsor_of_day}</p>
                  <span className="text-[10px] text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                    {t.ads_label}
                  </span>
                </div>
                <a
                  href={sponsorOfDay.linkUrl || '#'}
                  target={sponsorOfDay.linkUrl ? '_blank' : undefined}
                  rel={sponsorOfDay.linkUrl ? 'noreferrer' : undefined}
                  className="flex flex-col sm:flex-row gap-4 items-center"
                >
                  {sponsorOfDay.imageUrl && (
                    <img
                      src={sponsorOfDay.imageUrl}
                      alt={sponsorOfDay.title}
                      className="h-20 w-full sm:w-40 rounded-xl object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{sponsorOfDay.title}</p>
                    {sponsorOfDay.body && <p className="text-xs text-slate-600 mt-1">{sponsorOfDay.body}</p>}
                  </div>
                  <div className="text-xs text-amber-700 border border-amber-200 px-3 py-1 rounded-full">
                    {t.ads_cta}
                  </div>
                </a>
              </div>
            )}
            {!isSimple && feedAd && (
              <div className="border border-amber-100 bg-amber-50/60 rounded-2xl p-4 transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-wide text-amber-600">{t.ads_label}</p>
                  <span className="text-[10px] text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                    {t.ads_label}
                  </span>
                </div>
                <a
                  href={feedAd.linkUrl || '#'}
                  target={feedAd.linkUrl ? '_blank' : undefined}
                  rel={feedAd.linkUrl ? 'noreferrer' : undefined}
                  className="flex flex-col sm:flex-row gap-4 items-center"
                >
                  {feedAd.imageUrl && (
                    <img
                      src={feedAd.imageUrl}
                      alt={feedAd.title}
                      className="h-20 w-full sm:w-40 rounded-xl object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{feedAd.title}</p>
                    {feedAd.body && <p className="text-xs text-slate-600 mt-1">{feedAd.body}</p>}
                  </div>
                  <div className="text-xs text-amber-700 border border-amber-200 px-3 py-1 rounded-full">
                    {t.ads_cta}
                  </div>
                </a>
              </div>
            )}
          </section>

          {!isSimple && (
            <aside className="space-y-4" id="people">
              <div className="bg-white/90 border border-slate-100 rounded-2xl p-4">
                <h3 className="text-sm font-semibold mb-3">{t.search_button}</h3>
                <SearchBar
                  placeholder={t.search_placeholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onSearch={handleSearch}
                  buttonText={t.search_button}
                  lang={lang}
                />
                <p className={`text-xs text-slate-500 mt-3 ${lang === 'ar' ? 'font-arabic text-right' : ''}`}>
                  {t.search_hint}
                </p>
              </div>
              <AuthCard
                t={t}
                lang={lang}
                user={currentUser}
                onLogin={handleLogin}
                onRegister={handleRegister}
                onLogout={handleLogout}
                loading={authState.loading}
                error={authState.error}
              />
              {authToken && requestNotifications.length > 0 && (
                <div className="bg-white/90 border border-slate-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold">{t.notifications_requests_title}</p>
                    {pendingRequests > 0 && (
                      <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full">
                        {pendingRequests}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={() => setRequestsPendingOnly((prev) => !prev)}
                      className={`text-xs border px-2 py-1 rounded-lg ${
                        requestsPendingOnly
                          ? 'border-amber-300 bg-amber-100 text-amber-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {requestsPendingOnly
                        ? t.notifications_requests_filter_all
                        : t.notifications_requests_filter_pending}
                    </button>
                    <span className="text-xs text-slate-500">{visibleRequests.length}</span>
                  </div>
                  <div className="space-y-3">
                    {visibleRequests.map((item) => {
                      const requestStatus = item.metadata?.requestStatus || 'pending';
                      const isPendingRequest = requestStatus === 'pending';
                      const statusLabel =
                        requestStatus === 'accepted'
                          ? t.notifications_request_accepted
                          : requestStatus === 'declined'
                            ? t.notifications_request_declined
                            : t.notifications_request_pending;
                      const statusClass =
                        requestStatus === 'accepted'
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : requestStatus === 'declined'
                            ? 'text-rose-700 bg-rose-50 border-rose-200'
                            : 'text-slate-600 bg-slate-100 border-slate-200';
                      return (
                        <div
                          key={`request-mini-${item.id}`}
                          className={`border rounded-xl p-3 ${
                            item.isRead ? 'border-slate-100 bg-white' : 'border-amber-200 bg-amber-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs uppercase tracking-wide text-amber-600">{item.title}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 mt-2">{item.body}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              onClick={() => markNotificationRead(item.id)}
                              disabled={item.isRead}
                              className="text-xs text-slate-600 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50 disabled:opacity-60"
                            >
                              {t.notifications_mark}
                            </button>
                            {isPendingRequest && (
                              <>
                                <button
                                  onClick={() => acceptHubmateRequest(item)}
                                  className="text-xs text-emerald-700 border border-emerald-200 px-3 py-1 rounded-lg hover:bg-emerald-50"
                                >
                                  {t.notifications_accept}
                                </button>
                                <button
                                  onClick={() => declineHubmateRequest(item)}
                                  className="text-xs text-rose-700 border border-rose-200 px-3 py-1 rounded-lg hover:bg-rose-50"
                                >
                                  {t.notifications_decline}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => replyToHubmate(item)}
                              className="text-xs text-slate-700 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50"
                            >
                              {t.notifications_reply}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="bg-white/90 border border-slate-100 rounded-2xl p-4">
                <h3 className="text-sm font-semibold mb-3">{t.hubmates_suggestions}</h3>
                <div className="mb-4 space-y-3">
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={hubmateFilters.sameCityOnly}
                      onChange={(event) =>
                        setHubmateFilters((prev) => ({ ...prev, sameCityOnly: event.target.checked }))
                      }
                    />
                    {t.hubmates_same_city}
                  </label>
                  <div>
                    <label className="text-xs text-slate-600 flex items-center justify-between">
                      <span>{t.hubmates_min_score}</span>
                      <span className="font-semibold">{hubmateFilters.minScore}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      value={hubmateFilters.minScore}
                      onChange={(event) =>
                        setHubmateFilters((prev) => ({ ...prev, minScore: Number(event.target.value) }))
                      }
                      className="w-full"
                    />
                  </div>
                  <button
                    onClick={() => setHubmateFilters({ sameCityOnly: false, minScore: 0 })}
                    className="text-xs text-slate-600 border border-slate-200 px-2 py-1 rounded hover:bg-slate-50"
                  >
                    {t.hubmates_reset}
                  </button>
                </div>
                <div className="space-y-3">
                  {(hubmateSuggestions.length > 0 ? hubmateSuggestions : filteredUsers.slice(0, 2)).map((user) => (
                    <div key={user.id} className="border border-slate-100 rounded-xl p-3 bg-white/70">
                      <ProfileCard user={user} t={t} lang={lang} onConnect={handleConnect} />
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>{t.hubmates_score}: {user.score ?? 0}</span>
                        <span>{t.hubmates_city}: {user.city || '-'}</span>
                      </div>
                      <button
                        onClick={() => reportTarget('profile', user.id)}
                        className="mt-2 text-[11px] text-rose-600 border border-rose-200 px-2 py-1 rounded hover:bg-rose-50"
                      >
                        {t.report_profile}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              {featuredAds.length > 0 && (
                <div className="bg-white/90 border border-slate-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">{t.ads_title}</h3>
                    <span className="text-[10px] uppercase tracking-wide text-amber-600">{t.ads_label}</span>
                  </div>
                  <div className="space-y-3">
                    {featuredAds.map((ad) => (
                      <a
                        key={ad.id}
                        href={ad.linkUrl || '#'}
                        target={ad.linkUrl ? '_blank' : undefined}
                        rel={ad.linkUrl ? 'noreferrer' : undefined}
                        className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white/80 p-3 transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md"
                      >
                        {ad.imageUrl && (
                          <img src={ad.imageUrl} alt={ad.title} className="h-12 w-12 rounded-lg object-cover" />
                        )}
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-slate-800 group-hover:text-slate-900">{ad.title}</p>
                          {ad.body && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{ad.body}</p>}
                        </div>
                        <span className="text-[10px] text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                          {t.ads_cta}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>

        {!isSimple && ads.length > 0 && (
          <section className="py-12">
            <div className="max-w-6xl mx-auto px-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-2xl font-semibold ${lang === 'ar' ? 'font-arabic text-right' : 'font-heading'}`}>
                  {t.ads_title}
                </h2>
                <span className="text-xs uppercase tracking-[0.3em] text-amber-600">{t.ads_label}</span>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ads.map((ad) => (
                  <a
                    key={ad.id}
                    href={ad.linkUrl || '#'}
                    className="bg-white/90 border border-slate-100 rounded-2xl overflow-hidden shadow-[var(--shadow-soft)] hover:shadow-lg transition"
                    target={ad.linkUrl ? '_blank' : undefined}
                    rel={ad.linkUrl ? 'noreferrer' : undefined}
                  >
                    {ad.imageUrl && (
                      <img src={ad.imageUrl} alt={ad.title} className="h-36 w-full object-cover" />
                    )}
                    <div className="p-4">
                      <p className="text-sm font-semibold">{ad.title}</p>
                      {ad.body && <p className="text-xs text-slate-500 mt-2">{ad.body}</p>}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        <section id="messages" className="py-12">
          <div className="max-w-6xl mx-auto px-6">
            <div className="bg-white/90 border border-slate-100 rounded-3xl shadow-[var(--shadow-soft)] overflow-hidden">
              <div className="grid lg:grid-cols-[0.38fr_0.62fr]">
                <div className="border-r border-slate-100">
                  <div className="p-4 border-b border-slate-100">
                    <h2 className={`text-lg font-semibold ${lang === 'ar' ? 'font-arabic text-right' : 'font-heading'}`}>
                      {t.conversations_title}
                    </h2>
                  </div>
                  <div className="max-h-[520px] overflow-y-auto">
                    {conversations.length === 0 && (
                      <p className="text-sm text-slate-500 p-4">{t.notifications_empty}</p>
                    )}
                    {conversations.map((conv) => {
                      const initials = conv.title
                        ? conv.title
                            .split(' ')
                            .slice(0, 2)
                            .map((word) => word[0])
                            .join('')
                        : 'CH';
                      return (
                        <button
                          key={conv.id}
                          onClick={() => setSelectedConversation(conv)}
                          className={`w-full text-left flex items-center gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${
                            selectedConversation?.id === conv.id ? 'bg-amber-50/60' : ''
                          }`}
                        >
                          <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-semibold">
                            {initials}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-800">{conv.title}</p>
                            <p className="text-xs text-slate-500 truncate">{conv.lastMessage || t.message_placeholder}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col h-[600px]">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">{t.nav_messages}</p>
                      <h3 className={`text-lg font-semibold ${lang === 'ar' ? 'font-arabic text-right' : 'font-heading'}`}>
                        {selectedConversation?.title || t.conversations_title}
                      </h3>
                    </div>
                    <span className="text-xs text-slate-400">{messagesList.length} messages</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-white to-slate-50">
                    {messagesList.length === 0 && (
                      <p className="text-sm text-slate-500">{t.message_placeholder}</p>
                    )}
                    {messagesList.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.fromUserId === currentUser?.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                            message.fromUserId === currentUser?.id
                              ? 'bg-slate-900 text-white rounded-br-md'
                              : 'bg-white text-slate-700 border border-slate-100 rounded-bl-md'
                          }`}
                        >
                          {message.text}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t border-slate-100">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {quickEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => appendEmoji(emoji)}
                          className="text-lg hover:scale-110 transition"
                          aria-label={`emoji-${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={messageText}
                        onChange={(event) => setMessageText(event.target.value)}
                        placeholder={t.message_placeholder}
                        disabled={!authToken}
                        className={`flex-1 px-4 py-3 border border-slate-200 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                          lang === 'ar' ? 'font-arabic text-right' : ''
                        }`}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!authToken}
                        className="bg-amber-600 text-white px-5 py-3 rounded-full hover:bg-amber-500 transition disabled:opacity-60"
                      >
                        {t.send_button}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="notifications" className="py-12">
          <div className="max-w-6xl mx-auto px-6">
            {isSimple ? (
              <div className="bg-white/90 border border-slate-100 rounded-2xl p-4 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-lg font-semibold ${lang === 'ar' ? 'font-arabic text-right' : 'font-heading'}`}>
                    {t.notifications_requests_title}
                  </h2>
                  <span className="text-xs text-slate-500">{requestNotifications.length}</span>
                </div>
                {requestNotifications.length === 0 ? (
                  <p className="text-sm text-slate-500">{t.notifications_empty}</p>
                ) : (
                  <div className="space-y-3">
                    {requestsSummary.map((item) => {
                      const requestStatus = item.metadata?.requestStatus || 'pending';
                      const isPendingRequest = requestStatus === 'pending';
                      const statusLabel =
                        requestStatus === 'accepted'
                          ? t.notifications_request_accepted
                          : requestStatus === 'declined'
                            ? t.notifications_request_declined
                            : t.notifications_request_pending;
                      const statusClass =
                        requestStatus === 'accepted'
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : requestStatus === 'declined'
                            ? 'text-rose-700 bg-rose-50 border-rose-200'
                            : 'text-slate-600 bg-slate-100 border-slate-200';
                      return (
                        <div
                          key={`request-simple-${item.id}`}
                          className={`border rounded-xl p-3 ${
                            item.isRead ? 'border-slate-100 bg-white' : 'border-amber-200 bg-amber-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs uppercase tracking-wide text-amber-600">{item.title}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 mt-2">{item.body}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              onClick={() => markNotificationRead(item.id)}
                              disabled={item.isRead}
                              className="text-xs text-slate-600 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50 disabled:opacity-60"
                            >
                              {t.notifications_mark}
                            </button>
                            {isPendingRequest && (
                              <>
                                <button
                                  onClick={() => acceptHubmateRequest(item)}
                                  className="text-xs text-emerald-700 border border-emerald-200 px-3 py-1 rounded-lg hover:bg-emerald-50"
                                >
                                  {t.notifications_accept}
                                </button>
                                <button
                                  onClick={() => declineHubmateRequest(item)}
                                  className="text-xs text-rose-700 border border-rose-200 px-3 py-1 rounded-lg hover:bg-rose-50"
                                >
                                  {t.notifications_decline}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => replyToHubmate(item)}
                              className="text-xs text-slate-700 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50"
                            >
                              {t.notifications_reply}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {requestNotifications.length > requestsSummary.length && (
                  <button
                    onClick={() => setViewMode('full')}
                    className="mt-4 text-sm text-slate-700 border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50"
                  >
                    {t.view_show_full}
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-2xl font-semibold ${lang === 'ar' ? 'font-arabic text-right' : 'font-heading'}`}>
                    {t.notifications_requests_title}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowUnreadOnly((prev) => !prev)}
                      className={`text-sm border px-3 py-1 rounded-lg ${
                        showUnreadOnly
                          ? 'border-amber-300 bg-amber-100 text-amber-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {showUnreadOnly ? t.notifications_show_all : t.notifications_show_unread}
                    </button>
                    <button
                      onClick={markAllRead}
                      disabled={!authToken || notifications.length === 0}
                      className="text-sm text-slate-600 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50 disabled:opacity-60"
                    >
                      {t.notifications_mark_all}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {['pending', 'accepted', 'declined', 'all'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setRequestsStatusFilter(status)}
                      className={`text-xs border px-3 py-1 rounded-lg ${
                        requestsStatusFilter === status
                          ? 'border-amber-300 bg-amber-100 text-amber-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {status === 'pending'
                        ? t.requests_filter_pending
                        : status === 'accepted'
                          ? t.requests_filter_accepted
                          : status === 'declined'
                            ? t.requests_filter_declined
                            : t.requests_filter_all}
                    </button>
                  ))}
                </div>
                {visibleRequests.length === 0 ? (
                  <p className="text-sm text-slate-500">{t.notifications_empty}</p>
                ) : (
                  <div className="flex flex-col gap-6">
                    {visibleRequests.length > 0 && (
                      <div className="border border-slate-100 rounded-2xl p-4 bg-white/90">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold">{t.notifications_requests_title}</p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          {visibleRequests
                            .filter((item) =>
                              requestsStatusFilter === 'all'
                                ? true
                                : (item.metadata?.requestStatus || 'pending') === requestsStatusFilter
                            )
                            .map((item) => {
                              const requestStatus = item.metadata?.requestStatus || 'pending';
                              const isPendingRequest = requestStatus === 'pending';
                              const requester = users.find((user) => user.id === item.metadata?.fromUserId);
                              const createdAt = new Date(item.createdAt);
                              const isNew = !Number.isNaN(createdAt.getTime())
                                ? Date.now() - createdAt.getTime() < 1000 * 60 * 60 * 24
                                : false;
                              const statusLabel =
                                requestStatus === 'accepted'
                                  ? t.notifications_request_accepted
                                  : requestStatus === 'declined'
                                    ? t.notifications_request_declined
                                    : t.notifications_request_pending;
                              const statusClass =
                                requestStatus === 'accepted'
                                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                  : requestStatus === 'declined'
                                    ? 'text-rose-700 bg-rose-50 border-rose-200'
                                    : 'text-slate-600 bg-slate-100 border-slate-200';
                              return (
                                <div
                                  key={`request-${item.id}`}
                                  className={`border rounded-2xl p-4 ${
                                    item.isRead ? 'border-slate-100 bg-white' : 'border-amber-200 bg-amber-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="h-10 w-10 rounded-full bg-slate-100 overflow-hidden">
                                      {requester?.avatarUrl && (
                                        <img src={requester.avatarUrl} alt={requester.name} className="h-full w-full object-cover" />
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm font-semibold text-slate-800">
                                        {requester?.name || t.report_profile}
                                      </p>
                                      {requester?.handle && (
                                        <p className="text-xs text-slate-500">{requester.handle}</p>
                                      )}
                                      {requester?.city && (
                                        <p className="text-[11px] text-slate-400">{requester.city}</p>
                                      )}
                                    </div>
                                    {requester?.id && (
                                      <a
                                        href={`/profile?user=${requester.id}`}
                                        className="text-xs text-slate-700 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50"
                                      >
                                        {t.notifications_view_profile}
                                      </a>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs uppercase tracking-wide text-amber-600">{item.title}</p>
                                    <div className="flex items-center gap-2">
                                      {isNew && (
                                        <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full">
                                          {t.notifications_new}
                                        </span>
                                      )}
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusClass}`}>
                                        {statusLabel}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-sm text-slate-700 mt-2">{item.body}</p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      onClick={() => markNotificationRead(item.id)}
                                      disabled={item.isRead}
                                      className="text-xs text-slate-600 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50 disabled:opacity-60"
                                    >
                                      {t.notifications_mark}
                                    </button>
                                    {isPendingRequest && (
                                      <>
                                        <button
                                          onClick={() => acceptHubmateRequest(item)}
                                          className="text-xs text-white bg-emerald-600 px-3 py-1 rounded-lg hover:bg-emerald-500"
                                        >
                                          {t.notifications_accept}
                                        </button>
                                        <button
                                          onClick={() => declineHubmateRequest(item)}
                                          className="text-xs text-rose-700 border border-rose-200 px-3 py-1 rounded-lg hover:bg-rose-50"
                                        >
                                          {t.notifications_decline}
                                        </button>
                                      </>
                                    )}
                                    <button
                                      onClick={() => replyToHubmate(item)}
                                      className="text-xs text-slate-700 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50"
                                    >
                                      {t.notifications_reply}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>



        {currentHash !== '#notifications' && currentHash !== '#hubmates-requests' && (
        <section className="py-12">
          <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-[0.45fr_0.55fr] gap-6">
            <div className="bg-white/90 border border-slate-100 rounded-2xl p-6 shadow-[var(--shadow-soft)]">
              <h2 className={`text-lg font-semibold mb-4 ${lang === 'ar' ? 'font-arabic text-right' : 'font-heading'}`}>
                {t.profile_title}
              </h2>
              {profileStatus.error && (
                <div className="text-sm text-rose-600 mb-3">{profileStatus.error}</div>
              )}
              {profileStatus.success && (
                <div className="text-sm text-emerald-600 mb-3">{profileStatus.success}</div>
              )}
              {uploadStatus.error && (
                <div className="text-sm text-rose-600 mb-3">{uploadStatus.error}</div>
              )}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-slate-100 overflow-hidden">
                    {currentUser?.avatarUrl && (
                      <img src={currentUser.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-slate-500">{t.profile_avatar}</label>
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={!authToken} />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-24 rounded-2xl bg-slate-100 overflow-hidden">
                    {currentUser?.coverUrl && (
                      <img src={currentUser.coverUrl} alt="cover" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-slate-500">{t.profile_cover}</label>
                    <input type="file" accept="image/*" onChange={handleCoverUpload} disabled={!authToken} />
                  </div>
                </div>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })}
                  placeholder={t.auth_name}
                  disabled={!authToken}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                />
                <input
                  type="text"
                  value={profileForm.city}
                  onChange={(event) => setProfileForm({ ...profileForm, city: event.target.value })}
                  placeholder={t.profile_city}
                  disabled={!authToken}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                />
                <input
                  type="text"
                  value={profileForm.availability}
                  onChange={(event) => setProfileForm({ ...profileForm, availability: event.target.value })}
                  placeholder={t.profile_availability}
                  disabled={!authToken}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                />
                <textarea
                  rows={3}
                  value={profileForm.bio}
                  onChange={(event) => setProfileForm({ ...profileForm, bio: event.target.value })}
                  placeholder={t.profile_bio}
                  disabled={!authToken}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                />
                <input
                  type="text"
                  value={profileForm.goals}
                  onChange={(event) => setProfileForm({ ...profileForm, goals: event.target.value })}
                  placeholder={t.profile_goals_input}
                  disabled={!authToken}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                />
                <input
                  type="text"
                  value={profileForm.interests}
                  onChange={(event) => setProfileForm({ ...profileForm, interests: event.target.value })}
                  placeholder={t.profile_interests_input}
                  disabled={!authToken}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                />
                <button
                  onClick={handleProfileSave}
                  disabled={!authToken}
                  className="bg-slate-900 text-white px-4 py-3 rounded-xl hover:bg-slate-800 transition disabled:opacity-60"
                >
                  {t.profile_save}
                </button>
                <button
                  onClick={handleProfileDelete}
                  disabled={!authToken}
                  className="text-rose-600 border border-rose-200 px-4 py-3 rounded-xl hover:bg-rose-50 transition disabled:opacity-60"
                >
                  {t.profile_delete}
                </button>
              </div>
            </div>

            <div className="bg-white/90 border border-slate-100 rounded-2xl p-6 shadow-[var(--shadow-soft)]">
              <h2 className={`text-lg font-semibold mb-4 ${lang === 'ar' ? 'font-arabic text-right' : 'font-heading'}`}>
                {t.goals_title}
              </h2>
              {goalStatus.error && (
                <div className="text-sm text-rose-600 mb-3">{goalStatus.error}</div>
              )}
              {goalStatus.success && (
                <div className="text-sm text-emerald-600 mb-3">{goalStatus.success}</div>
              )}
              <form onSubmit={handleGoalSubmit} className="grid gap-3">
                <input
                  type="text"
                  value={goalForm.title}
                  onChange={(event) => setGoalForm({ ...goalForm, title: event.target.value })}
                  placeholder={t.goal_title}
                  disabled={!authToken}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                />
                <textarea
                  rows={3}
                  value={goalForm.description}
                  onChange={(event) => setGoalForm({ ...goalForm, description: event.target.value })}
                  placeholder={t.goal_description}
                  disabled={!authToken}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                />
                <input
                  type="text"
                  value={goalForm.category}
                  onChange={(event) => setGoalForm({ ...goalForm, category: event.target.value })}
                  placeholder={t.goal_category}
                  disabled={!authToken}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                />
                <select
                  value={goalForm.priority}
                  onChange={(event) => setGoalForm({ ...goalForm, priority: event.target.value })}
                  disabled={!authToken}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                >
                  <option value="high">{t.goal_priority_high}</option>
                  <option value="normal">{t.goal_priority_normal}</option>
                  <option value="low">{t.goal_priority_low}</option>
                </select>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={goalForm.progress}
                  onChange={(event) => setGoalForm({ ...goalForm, progress: event.target.value })}
                  placeholder={t.goal_progress}
                  disabled={!authToken}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                />
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-slate-500">{t.goal_start_date}</label>
                    <input
                      type="date"
                      value={goalForm.startDate}
                      onChange={(event) => setGoalForm({ ...goalForm, startDate: event.target.value })}
                      disabled={!authToken}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-slate-500">{t.goal_end_date}</label>
                    <input
                      type="date"
                      value={goalForm.endDate}
                      onChange={(event) => setGoalForm({ ...goalForm, endDate: event.target.value })}
                      disabled={!authToken}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                    />
                  </div>
                </div>
                <input
                  type="text"
                  value={goalForm.tags}
                  onChange={(event) => setGoalForm({ ...goalForm, tags: event.target.value })}
                  placeholder={t.goal_tags}
                  disabled={!authToken}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                />
                <div className="border border-slate-200 rounded-xl p-3 bg-white/80">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-slate-500">{t.goal_steps}</label>
                    <button
                      type="button"
                      onClick={addGoalStep}
                      disabled={!authToken || (goalForm.steps || []).length >= 5}
                      className="text-xs text-slate-600 border border-slate-200 px-2 py-1 rounded hover:bg-slate-50 disabled:opacity-60"
                    >
                      {t.goal_steps_add}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(goalForm.steps || []).map((step, index) => (
                      <div key={`step-${index}`} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(step.done)}
                          onChange={(event) => updateGoalStep(index, { done: event.target.checked })}
                          disabled={!authToken}
                        />
                        <input
                          type="text"
                          value={step.title}
                          onChange={(event) => updateGoalStep(index, { title: event.target.value })}
                          placeholder={`${t.goal_step_label} ${index + 1}`}
                          disabled={!authToken}
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => removeGoalStep(index)}
                          disabled={!authToken}
                          className="text-xs text-rose-600 border border-rose-200 px-2 py-1 rounded hover:bg-rose-50"
                        >
                          {t.goal_step_remove}
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">{t.goal_steps_hint}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-500">{t.goal_image}</label>
                  <input type="file" accept="image/*" onChange={handleGoalImageUpload} disabled={!authToken} />
                  {goalForm.imageUrl && (
                    <img src={goalForm.imageUrl} alt="goal" className="h-28 w-full rounded-xl object-cover" />
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={!authToken}
                    className="flex-1 bg-amber-600 text-white px-4 py-3 rounded-xl hover:bg-amber-500 transition disabled:opacity-60"
                  >
                    {goalForm.id ? t.goal_update : t.goal_create}
                  </button>
                  {goalForm.id && (
                    <button
                      type="button"
                      onClick={resetGoalForm}
                      className="flex-1 border border-slate-200 px-4 py-3 rounded-xl hover:bg-slate-50 transition"
                    >
                      {t.goal_reset}
                    </button>
                  )}
                </div>
              </form>

              <div className="mt-6 flex flex-col gap-3">
                {myGoals.length === 0 ? (
                  <p className="text-sm text-slate-500">{t.goal_empty}</p>
                ) : (
                  myGoals.map((goal) => (
                    <div key={goal.id} className="border border-slate-100 rounded-xl p-4">
                      {goal.imageUrl && (
                        <img src={goal.imageUrl} alt={goal.title} className="h-28 w-full rounded-xl object-cover mb-3" />
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{goal.title}</p>
                          <p className="text-xs text-slate-500">{goal.category}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                            {goal.progress}%
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getMotivationBadge(goal).className}`}>
                            {getMotivationBadge(goal).label}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="px-2 py-0.5 rounded-full border border-slate-200">
                          {t.goal_status_label}: {getGoalStatus(goal) === 'done' ? t.goal_status_done : getGoalStatus(goal) === 'not_started' ? t.goal_status_not_started : t.goal_status_in_progress}
                        </span>
                        <span className="px-2 py-0.5 rounded-full border border-slate-200">
                          {t.goal_priority_label}: {goal.priority === 'high' ? t.goal_priority_high : goal.priority === 'low' ? t.goal_priority_low : t.goal_priority_normal}
                        </span>
                        {(goal.startDate || goal.endDate) && (
                          <span className="px-2 py-0.5 rounded-full border border-slate-200">
                            {t.goal_time_window}: {goal.startDate ? String(goal.startDate).slice(0, 10) : '--'} → {goal.endDate ? String(goal.endDate).slice(0, 10) : '--'}
                          </span>
                        )}
                      </div>
                      {(goal.startDate && goal.endDate) && (
                        <div className="mt-3">
                          {(() => {
                            const start = new Date(goal.startDate);
                            const end = new Date(goal.endDate);
                            const total = end.getTime() - start.getTime();
                            const elapsed = Date.now() - start.getTime();
                            const ratio = total > 0 ? Math.min(Math.max(elapsed / total, 0), 1) : 0;
                            const percent = Math.round(ratio * 100);
                            const steps = Array.isArray(goal.steps) ? goal.steps : [];
                            return (
                              <div>
                                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                                  <span>{t.goal_time_progress}</span>
                                  <span>{percent}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                  <div className="h-full bg-amber-500" style={{ width: `${percent}%` }} />
                                </div>
                                {steps.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {steps.map((step, idx) => (
                                      <span
                                        key={`goal-step-${goal.id}-${idx}`}
                                        className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                          step.done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'
                                        }`}
                                      >
                                        {step.title}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      <p className="text-xs text-slate-500 mt-2">{goal.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(goal.tags || []).map((tag) => (
                          <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleGoalEdit(goal)}
                          className="text-sm text-slate-700 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50"
                        >
                          {t.goal_update}
                        </button>
                        <button
                          onClick={() => handleGoalDelete(goal.id)}
                          className="text-sm text-rose-600 border border-rose-200 px-3 py-1 rounded-lg hover:bg-rose-50"
                        >
                          {t.goal_delete}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
        )}
      </main>

      {!isSimple && (
        <section id="hubmates-requests" className="py-16 bg-white/70 border-t border-slate-100">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-2xl font-semibold ${lang === 'ar' ? 'font-arabic text-right' : 'font-heading'}`}>
                {t.requests_page_title}
              </h2>
              <span className="text-xs text-slate-500">{requestNotifications.length}</span>
            </div>
            {requestNotifications.length === 0 ? (
              <p className="text-sm text-slate-500">{t.requests_empty}</p>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap gap-2">
                  {['pending', 'accepted', 'declined', 'all'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setRequestsStatusFilter(status)}
                      className={`text-xs border px-3 py-1 rounded-lg ${
                        requestsStatusFilter === status
                          ? 'border-amber-300 bg-amber-100 text-amber-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {status === 'pending'
                        ? `${t.requests_filter_pending} (${requestCounts.pending})`
                        : status === 'accepted'
                          ? `${t.requests_filter_accepted} (${requestCounts.accepted})`
                          : status === 'declined'
                            ? `${t.requests_filter_declined} (${requestCounts.declined})`
                            : `${t.requests_filter_all} (${requestCounts.all})`}
                    </button>
                  ))}
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {filteredRequests.map((item) => {
                    const requestStatus = item.metadata?.requestStatus || 'pending';
                    const isPendingRequest = requestStatus === 'pending';
                    const statusLabel =
                      requestStatus === 'accepted'
                        ? t.notifications_request_accepted
                        : requestStatus === 'declined'
                          ? t.notifications_request_declined
                          : t.notifications_request_pending;
                    const statusClass =
                      requestStatus === 'accepted'
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : requestStatus === 'declined'
                          ? 'text-rose-700 bg-rose-50 border-rose-200'
                          : 'text-slate-600 bg-slate-100 border-slate-200';
                    return (
                      <div
                        key={`request-page-${item.id}`}
                        className={`border rounded-2xl p-4 ${
                          item.isRead ? 'border-slate-100 bg-white/80' : 'border-amber-200 bg-amber-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs uppercase tracking-wide text-amber-600">{item.title}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 mt-2">{item.body}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => markNotificationRead(item.id)}
                            disabled={item.isRead}
                            className="text-xs text-slate-600 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50 disabled:opacity-60"
                          >
                            {t.notifications_mark}
                          </button>
                          {isPendingRequest && (
                            <>
                              <button
                                onClick={() => acceptHubmateRequest(item)}
                                className="text-xs text-emerald-700 border border-emerald-200 px-3 py-1 rounded-lg hover:bg-emerald-50"
                              >
                                {t.notifications_accept}
                              </button>
                              <button
                                onClick={() => declineHubmateRequest(item)}
                                className="text-xs text-rose-700 border border-rose-200 px-3 py-1 rounded-lg hover:bg-rose-50"
                              >
                                {t.notifications_decline}
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => replyToHubmate(item)}
                            className="text-xs text-slate-700 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50"
                          >
                            {t.notifications_reply}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <Footer t={t} lang={lang} />
    </div>
  );
}
