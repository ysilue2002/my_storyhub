import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import LanguageSwitcher from './components/LanguageSwitcher';
import Footer from './components/Footer';
import AuthCard from './components/AuthCard';
import Header from './components/Header';
import SearchBar from './components/SearchBar';

import fr from './lang/fr.json';
import en from './lang/en.json';
import ar from './lang/ar.json';

const messages = { fr, en, ar };
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';
const WS_BASE = process.env.REACT_APP_WS_BASE || API_BASE;

export default function Profile() {
  const [lang, setLang] = useState('fr');
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [authState, setAuthState] = useState({ loading: false, error: '' });
  const [profileStatus, setProfileStatus] = useState({ error: '', success: '' });
  const [uploadStatus, setUploadStatus] = useState({ error: '', avatar: false, cover: false });
  const [showOnboarding, setShowOnboarding] = useState(
    localStorage.getItem('onboardingDone') !== 'true'
  );
  const [onboardingForm, setOnboardingForm] = useState({
    objective: '',
    pace: '',
    interests: '',
  });
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
  const [posts, setPosts] = useState([]);
  const [postBody, setPostBody] = useState('');
  const [postImageUrl, setPostImageUrl] = useState('');
  const [editingPostId, setEditingPostId] = useState(null);
  const [editingBody, setEditingBody] = useState('');
  const [likedPosts, setLikedPosts] = useState({});
  const [comments, setComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [pagination, setPagination] = useState({ limit: 5, offset: 0, hasMore: true });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const loadMoreRef = useRef(null);
  const [openComments, setOpenComments] = useState({});
  const [publicProfile, setPublicProfile] = useState(null);
  const [publicGoals, setPublicGoals] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [messageStatus, setMessageStatus] = useState('');
  const socketRef = useRef(null);
  const [alerts, setAlerts] = useState({ pendingRequests: 0, unreadMessages: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode') || 'simple');
  const isSimple = viewMode === 'simple';

  const t = messages[lang];

  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

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

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchQuery('');
    }
  };

  useEffect(() => {
    if (!authToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(WS_BASE, { auth: { token: authToken } });
    socketRef.current = socket;
    socket.on('message:new', () => loadAlerts());
    socket.on('notification:new', () => loadAlerts());

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authToken]);

  useEffect(() => {
    loadAlerts();
  }, [authToken]);

  useEffect(() => {
    const loadMe = async () => {
      if (!authToken) {
        setCurrentUser(null);
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
        if (data.goals?.length || data.interests?.length || data.availability) {
          localStorage.setItem('onboardingDone', 'true');
          setShowOnboarding(false);
        }
      } catch (error) {
        setCurrentUser(null);
        setAuthToken('');
        localStorage.removeItem('authToken');
      }
    };
    loadMe();
  }, [authToken]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const publicId = urlParams.get('user');
    if (!publicId) {
      setPublicProfile(null);
      setPublicGoals([]);
      return;
    }
    const loadPublic = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/users/${publicId}`);
        if (!response.ok) throw new Error('Not found');
        const data = await response.json();
        setPublicProfile(data);
      } catch (error) {
        setPublicProfile({ error: true });
      }
    };
    loadPublic();
  }, []);

  useEffect(() => {
    const loadGoals = async (userId) => {
      if (!userId) {
        setPublicGoals([]);
        return;
      }
      const response = await fetch(`${API_BASE}/api/goals?ownerId=${userId}`);
      const data = await response.json();
      setPublicGoals(Array.isArray(data) ? data : []);
    };
    if (publicProfile && publicProfile.id) {
      loadGoals(publicProfile.id);
    } else {
      setPublicGoals([]);
    }
  }, [publicProfile]);

  const loadPosts = async (userId, reset = false) => {
    if (!userId) {
      setPosts([]);
      return;
    }
    const offset = reset ? 0 : pagination.offset;
    if (reset) {
      setLoadingInitial(true);
    }
    setLoadingMore(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/posts?userId=${userId}&limit=${pagination.limit}&offset=${offset}`
      );
      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      setPosts((prev) => (reset ? list : [...prev, ...list]));
      setPagination((prev) => ({
        ...prev,
        offset: offset + list.length,
        hasMore: list.length === prev.limit,
      }));
    } catch (error) {
      setPosts([]);
    } finally {
      setLoadingMore(false);
      if (reset) {
        setLoadingInitial(false);
      }
    }
  };

  useEffect(() => {
    if (publicProfile && publicProfile.id) {
      setPagination((prev) => ({ ...prev, offset: 0, hasMore: true }));
      loadPosts(publicProfile.id, true);
    } else if (currentUser?.id) {
      setPagination((prev) => ({ ...prev, offset: 0, hasMore: true }));
      loadPosts(currentUser.id, true);
    }
  }, [publicProfile, currentUser]);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    if (!pagination.hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          loadPosts(publicProfile?.id || currentUser?.id, false);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [pagination.hasMore, loadingMore, publicProfile, currentUser]);

  useEffect(() => {
    const loadLikes = async () => {
      if (!authToken) {
        setLikedPosts({});
        return;
      }
      const response = await authFetch(`${API_BASE}/api/posts/likes`);
      const data = await response.json();
      const likedMap = {};
      (Array.isArray(data) ? data : []).forEach((item) => {
        likedMap[item.postId] = true;
      });
      setLikedPosts(likedMap);
    };
    loadLikes();
  }, [authToken]);

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

  const handleOnboardingSave = async () => {
    if (!authToken) return;
    if (!onboardingForm.objective.trim() || !onboardingForm.pace.trim()) {
      setProfileStatus({ error: t.error_required, success: '' });
      return;
    }
    const payload = {
      availability: onboardingForm.pace.trim(),
      goals: [onboardingForm.objective.trim()],
      interests: onboardingForm.interests
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
    setProfileForm({
      name: data.name || '',
      city: data.city || '',
      bio: data.bio || '',
      availability: data.availability || '',
      goals: (data.goals || []).join(', '),
      interests: (data.interests || []).join(', '),
    });
    localStorage.setItem('onboardingDone', 'true');
    setShowOnboarding(false);
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !authToken) return;
    setUploadStatus({ error: '', avatar: true, cover: false });
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
      setUploadStatus({ error: t.error_upload, avatar: false, cover: false });
    } finally {
      setUploadStatus((prev) => ({ ...prev, avatar: false }));
    }
  };

  const handleCoverUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !authToken) return;
    setUploadStatus({ error: '', avatar: false, cover: true });
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
      setUploadStatus({ error: t.error_upload, avatar: false, cover: false });
    } finally {
      setUploadStatus((prev) => ({ ...prev, cover: false }));
    }
  };

  const handlePostImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !authToken || publicProfile) return;
    const formData = new FormData();
    formData.append('file', file);
    const response = await authFetch(`${API_BASE}/api/uploads/post-image`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    setPostImageUrl(data.imageUrl || '');
  };

  const handleCreatePost = async () => {
    if (!authToken || publicProfile) return;
    if (!postBody.trim()) return;
    const response = await authFetch(`${API_BASE}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: postBody, imageUrl: postImageUrl || null }),
    });
    const data = await response.json();
    if (!response.ok) return;
    setPosts((prev) => [data, ...prev]);
    setPagination((prev) => ({ ...prev, offset: prev.offset + 1 }));
    setPostBody('');
    setPostImageUrl('');
  };

  const handleSendFriendRequest = async () => {
    if (!authToken || !publicProfile?.id) return;
    await authFetch(`${API_BASE}/api/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUserId: publicProfile.id, message: t.profile_friend_request }),
    });
    setMessageStatus(t.profile_request_sent);
  };

  const handleSendMessage = async () => {
    if (!authToken || !publicProfile?.id || !messageText.trim()) return;
    await authFetch(`${API_BASE}/api/conversations/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUserId: publicProfile.id, text: messageText.trim() }),
    });
    setMessageText('');
    setMessageStatus(t.profile_message_sent);
  };

  const handleEditPost = async (postId) => {
    if (!authToken || publicProfile) return;
    if (!editingBody.trim()) return;
    if (!window.confirm(t.profile_post_save_confirm)) return;
    const response = await authFetch(`${API_BASE}/api/posts/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: editingBody }),
    });
    const data = await response.json();
    if (!response.ok) return;
    setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, body: data.body } : post)));
    setEditingPostId(null);
    setEditingBody('');
  };

  const handleDeletePost = async (postId) => {
    if (!authToken || publicProfile) return;
    if (!window.confirm(t.profile_post_delete_confirm)) return;
    await authFetch(`${API_BASE}/api/posts/${postId}`, { method: 'DELETE' });
    setPosts((prev) => prev.filter((post) => post.id !== postId));
  };

  const toggleLike = async (postId) => {
    if (!authToken) return;
    const liked = likedPosts[postId] === true;
    const response = await authFetch(`${API_BASE}/api/posts/${postId}/like`, {
      method: liked ? 'DELETE' : 'POST',
    });
    const data = await response.json();
    setLikedPosts((prev) => ({ ...prev, [postId]: !liked }));
    setPosts((prev) =>
      prev.map((post) => (post.id === postId ? { ...post, likesCount: data.likesCount } : post))
    );
  };

  const loadComments = async (postId) => {
    const response = await fetch(`${API_BASE}/api/posts/${postId}/comments`);
    const data = await response.json();
    setComments((prev) => ({ ...prev, [postId]: Array.isArray(data) ? data : [] }));
    setOpenComments((prev) => ({ ...prev, [postId]: true }));
  };

  const addComment = async (postId) => {
    if (!authToken) return;
    const body = (commentInputs[postId] || '').trim();
    if (!body) return;
    const response = await authFetch(`${API_BASE}/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    const data = await response.json();
    if (!response.ok) return;
    setComments((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), data],
    }));
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, commentsCount: (post.commentsCount || 0) + 1 } : post
      )
    );
    setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
  };

  const reportTarget = async (targetType, targetId) => {
    if (!authToken) {
      setMessageStatus(t.auth_required);
      return;
    }
    const reason = window.prompt(t.report_prompt) || '';
    await authFetch(`${API_BASE}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType, targetId, reason }),
    });
    setMessageStatus(t.report_sent);
  };

  const deleteComment = async (commentId, postId) => {
    if (!authToken) return;
    await authFetch(`${API_BASE}/api/posts/comments/${commentId}`, { method: 'DELETE' });
    setComments((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).filter((item) => item.id !== commentId),
    }));
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, commentsCount: Math.max(0, (post.commentsCount || 1) - 1) } : post
      )
    );
  };

  const deleteAllMyComments = async () => {
    if (!authToken) return;
    if (!window.confirm(t.profile_comment_delete_all_confirm)) return;
    const response = await authFetch(`${API_BASE}/api/posts/comments`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) return;
    setComments({});
    setPosts((prev) =>
      prev.map((post) => ({
        ...post,
        commentsCount: 0,
      }))
    );
    if (data?.deleted >= 0) {
      // no-op, counts already updated
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-b from-[#fff6e8] via-[#f4f7f2] to-[#e9f2f7] text-slate-900 ${isSimple ? 'view-simple' : ''}`}>
      <LanguageSwitcher lang={lang} setLang={setLang} />
      <Header
        t={t}
        lang={lang}
        hubmatesCount={alerts.pendingRequests}
        messagesCount={alerts.unreadMessages}
        rightSlot={(
          <div className="w-72">
            <SearchBar
              placeholder={t.search_placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={handleSearch}
              buttonText={t.search_button}
              lang={lang}
            />
          </div>
        )}
      />

      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="bg-white/90 border border-slate-100 rounded-2xl p-4 shadow-[var(--shadow-soft)]">
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
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {currentUser && !publicProfile && showOnboarding && (
          <div className="mb-6 bg-white/90 border border-amber-200 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-2">{t.onboarding_title}</h2>
            <p className="text-sm text-slate-500 mb-4">{t.onboarding_subtitle}</p>
            <div className="mb-4">
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((onboardingForm.objective ? 1 : 0) +
                          (onboardingForm.pace ? 1 : 0) +
                          (onboardingForm.interests ? 1 : 0)) /
                          3 *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {t.onboarding_progress}
              </p>
            </div>
            <div className="grid gap-3">
              <input
                type="text"
                value={onboardingForm.objective}
                onChange={(e) => setOnboardingForm({ ...onboardingForm, objective: e.target.value })}
                placeholder={t.onboarding_q1}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
              />
              <input
                type="text"
                value={onboardingForm.pace}
                onChange={(e) => setOnboardingForm({ ...onboardingForm, pace: e.target.value })}
                placeholder={t.onboarding_q2}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
              />
              <input
                type="text"
                value={onboardingForm.interests}
                onChange={(e) => setOnboardingForm({ ...onboardingForm, interests: e.target.value })}
                placeholder={t.onboarding_q3}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
              />
              <button
                onClick={handleOnboardingSave}
                className="bg-amber-600 text-white px-4 py-3 rounded-xl hover:bg-amber-500 transition"
              >
                {t.onboarding_submit}
              </button>
            </div>
          </div>
        )}
        <div className="mb-4">
          <a href="/" className="text-sm text-slate-600 underline">
            {t.profile_back_home}
          </a>
        </div>
        {!currentUser && !publicProfile ? (
          <div className="max-w-md mx-auto">
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
        ) : (
          <div className={`grid gap-6 ${isSimple ? 'simple-stack' : 'lg:grid-cols-[0.6fr_0.4fr]'}`}>
            <section className="bg-white/90 border border-slate-100 rounded-2xl overflow-hidden">
              <div className="h-40 bg-slate-100 relative">
                {(publicProfile?.coverUrl || currentUser?.coverUrl) && (
                  <img src={(publicProfile?.coverUrl || currentUser?.coverUrl)} alt="cover" className="h-full w-full object-cover" />
                )}
                {!publicProfile && (
                  <label className="absolute right-4 bottom-4 bg-white/90 text-xs px-3 py-1 rounded cursor-pointer">
                    {t.profile_cover}
                    <input type="file" className="hidden" accept="image/*" onChange={handleCoverUpload} />
                  </label>
                )}
              </div>
              <div className="p-6">
                <div className="flex items-center gap-4 -mt-14">
                  <div className="h-24 w-24 rounded-2xl border-4 border-white bg-slate-100 overflow-hidden">
                    {(publicProfile?.avatarUrl || currentUser?.avatarUrl) && (
                      <img src={(publicProfile?.avatarUrl || currentUser?.avatarUrl)} alt="avatar" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold">{publicProfile?.name || currentUser?.name}</h1>
                    <p className="text-sm text-slate-500">{publicProfile?.handle || currentUser?.handle}</p>
                  </div>
                </div>
                {!publicProfile && currentUser?.id && (
                  <div className="mt-4">
                    <a
                      href={`/profile?user=${currentUser.id}`}
                      className="text-sm text-slate-600 underline"
                    >
                      {t.profile_view_public}
                    </a>
                  </div>
                )}
                {publicProfile && (
                  <div className="mt-4 space-y-3">
                    {messageStatus && (
                      <div className="text-xs text-emerald-600">{messageStatus}</div>
                    )}
                    {!authToken && (
                      <div className="text-xs text-rose-600">{t.auth_required}</div>
                    )}
                    <textarea
                      rows={2}
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
                      placeholder={t.profile_message_placeholder}
                      disabled={!authToken}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={handleSendMessage}
                        disabled={!authToken}
                        className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm"
                      >
                        {t.profile_message_button}
                      </button>
                      <button
                        onClick={handleSendFriendRequest}
                        disabled={!authToken}
                        className="border border-slate-200 px-4 py-2 rounded-lg text-sm"
                      >
                        {t.profile_request_button}
                      </button>
                      <button
                        onClick={() => reportTarget('profile', publicProfile?.id)}
                        disabled={!authToken}
                        className="border border-rose-200 text-rose-600 px-4 py-2 rounded-lg text-sm"
                      >
                        {t.report_profile}
                      </button>
                    </div>
                  </div>
                )}

                {profileStatus.error && (
                  <div className="text-sm text-rose-600 mt-4">{profileStatus.error}</div>
                )}
                {profileStatus.success && (
                  <div className="text-sm text-emerald-600 mt-4">{profileStatus.success}</div>
                )}
                {uploadStatus.error && (
                  <div className="text-sm text-rose-600 mt-4">{uploadStatus.error}</div>
                )}

                {!publicProfile && (
                  <div className="mt-6 grid gap-3">
                  <label className="text-xs text-slate-500">{t.profile_avatar}</label>
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} />
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })}
                    placeholder={t.auth_name}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                  />
                  <select
                    value={profileForm.gender}
                    onChange={(event) => setProfileForm({ ...profileForm, gender: event.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                  >
                    <option value="">{t.profile_gender}</option>
                    <option value="female">{t.gender_female}</option>
                    <option value="male">{t.gender_male}</option>
                    <option value="other">{t.gender_other}</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={profileForm.age}
                    onChange={(event) => setProfileForm({ ...profileForm, age: event.target.value })}
                    placeholder={t.profile_age}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                  />
                  <input
                    type="text"
                    value={profileForm.country}
                    onChange={(event) => setProfileForm({ ...profileForm, country: event.target.value })}
                    placeholder={t.profile_country}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                  />
                  <input
                    type="text"
                    value={profileForm.city}
                    onChange={(event) => setProfileForm({ ...profileForm, city: event.target.value })}
                    placeholder={t.profile_city}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                  />
                  <input
                    type="text"
                    value={profileForm.availability}
                    onChange={(event) => setProfileForm({ ...profileForm, availability: event.target.value })}
                    placeholder={t.profile_availability}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                  />
                  <textarea
                    rows={3}
                    value={profileForm.bio}
                    onChange={(event) => setProfileForm({ ...profileForm, bio: event.target.value })}
                    placeholder={t.profile_bio}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                  />
                  <input
                    type="text"
                    value={profileForm.goals}
                    onChange={(event) => setProfileForm({ ...profileForm, goals: event.target.value })}
                    placeholder={t.profile_goals_input}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                  />
                  <input
                    type="text"
                    value={profileForm.interests}
                    onChange={(event) => setProfileForm({ ...profileForm, interests: event.target.value })}
                    placeholder={t.profile_interests_input}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80"
                  />
                  <button
                    onClick={handleProfileSave}
                    className="bg-slate-900 text-white px-4 py-3 rounded-xl hover:bg-slate-800 transition"
                  >
                    {t.profile_save}
                  </button>
                </div>
                )}

                <div className={`mt-8 ${isSimple ? 'simple-hide' : ''}`}>
                  <h2 className="text-lg font-semibold mb-3">{t.profile_posts_title}</h2>
                  {!publicProfile && (
                    <button
                      onClick={deleteAllMyComments}
                      className="text-xs text-rose-600 border border-rose-200 px-3 py-1 rounded mb-3"
                    >
                      {t.profile_comment_delete_all}
                    </button>
                  )}
                  {!publicProfile && (
                    <div className="bg-white border border-slate-100 rounded-xl p-4 mb-4">
                      <textarea
                        rows={3}
                        value={postBody}
                        onChange={(event) => setPostBody(event.target.value)}
                        placeholder={t.profile_post_placeholder}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      />
                      <div className="mt-3 flex items-center gap-3">
                        <input type="file" accept="image/*" onChange={handlePostImageUpload} />
                        <button
                          onClick={handleCreatePost}
                          className="bg-slate-900 text-white px-4 py-2 rounded-lg"
                        >
                          {t.profile_post_button}
                        </button>
                      </div>
                      {postImageUrl && (
                        <img src={postImageUrl} alt="post" className="mt-3 h-40 w-full object-cover rounded-lg" />
                      )}
                    </div>
                  )}
                  <div className="space-y-3">
                    {loadingInitial && (
                      <div className="space-y-3">
                        {[1, 2, 3].map((item) => (
                          <div key={item} className="border border-slate-100 rounded-xl p-4 animate-pulse">
                            <div className="h-3 bg-slate-200 rounded w-3/4" />
                            <div className="h-3 bg-slate-200 rounded w-1/2 mt-3" />
                            <div className="h-32 bg-slate-200 rounded mt-4" />
                          </div>
                        ))}
                      </div>
                    )}
                    {posts.map((post) => (
                      <div key={post.id} className="border border-slate-100 rounded-xl p-4">
                        {editingPostId === post.id ? (
                          <div className="space-y-2">
                            <textarea
                              rows={3}
                              value={editingBody}
                              onChange={(event) => setEditingBody(event.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditPost(post.id)}
                                className="bg-slate-900 text-white px-3 py-1 rounded"
                              >
                                {t.profile_post_save}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingPostId(null);
                                  setEditingBody('');
                                }}
                                className="border border-slate-200 px-3 py-1 rounded"
                              >
                                {t.profile_post_cancel}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-700">{post.body}</p>
                        )}
                        {post.imageUrl && (
                          <img src={post.imageUrl} alt="post" className="mt-3 h-40 w-full object-cover rounded-lg" />
                        )}
                        <div className="mt-3 flex items-center gap-4 text-sm text-slate-600 flex-wrap">
                          <button onClick={() => toggleLike(post.id)} className="hover:text-slate-900">
                            {likedPosts[post.id] ? t.profile_liked : t.profile_like} · {post.likesCount || 0}
                          </button>
                          <span className="text-xs text-slate-500">
                            {post.likesCount || 0} {t.profile_likes_count}
                          </span>
                          <button
                            onClick={() => (openComments[post.id] ? toggleComments(post.id) : loadComments(post.id))}
                            className="hover:text-slate-900"
                          >
                            {t.profile_comment} · {post.commentsCount || 0}
                          </button>
                          <span className="text-xs text-slate-500">
                            {post.commentsCount || 0} {t.profile_comments_count}
                          </span>
                          {(comments[post.id] || []).length > 0 && (
                            <button
                              onClick={() => toggleComments(post.id)}
                              className="text-xs text-slate-500 underline"
                            >
                              {openComments[post.id] ? t.profile_comments_hide : t.profile_comments_show}
                            </button>
                          )}
                          {!publicProfile && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingPostId(post.id);
                                  setEditingBody(post.body);
                                }}
                                className="hover:text-slate-900"
                              >
                                {t.profile_post_edit}
                              </button>
                              <button
                                onClick={() => handleDeletePost(post.id)}
                                className="text-rose-600 hover:text-rose-700"
                              >
                                {t.profile_post_delete}
                              </button>
                            </>
                          )}
                        </div>
                        {openComments[post.id] && (comments[post.id] || []).length > 0 && (
                          <div className="mt-3 space-y-2">
                            {comments[post.id].map((comment) => (
                              <div key={comment.id} className="text-xs text-slate-600 flex items-center justify-between">
                                <span>
                                  <strong>{comment.userName || 'User'}:</strong> {comment.body}
                                </span>
                                <div className="flex items-center gap-2">
                                  {!publicProfile && comment.userId === currentUser?.id && (
                                    <button
                                      onClick={() => deleteComment(comment.id, post.id)}
                                      className="text-[10px] text-rose-600"
                                    >
                                      {t.profile_comment_delete}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => reportTarget('comment', comment.id)}
                                    className="text-[10px] text-rose-600"
                                  >
                                    {t.report_comment}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 flex gap-2">
                          <input
                            type="text"
                            value={commentInputs[post.id] || ''}
                            onChange={(event) =>
                              setCommentInputs((prev) => ({ ...prev, [post.id]: event.target.value }))
                            }
                            placeholder={t.profile_comment_placeholder}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                          />
                          <button
                            onClick={() => addComment(post.id)}
                            className="bg-slate-900 text-white px-3 py-2 rounded-lg text-sm"
                          >
                            {t.profile_comment_button}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {pagination.hasMore && (
                    <div className="pt-4">
                      <button
                        onClick={() =>
                          loadPosts(publicProfile?.id || currentUser?.id, false)
                        }
                        className="w-full text-sm border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50"
                      >
                        {t.profile_posts_more}
                      </button>
                    </div>
                  )}
                  {loadingMore && (
                    <div className="pt-3 text-center text-sm text-slate-500">
                      {t.profile_posts_loading}
                    </div>
                  )}
                  <div ref={loadMoreRef} className="h-6" />
                </div>
              </div>
            </section>

            <aside className="bg-white/90 border border-slate-100 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4">{t.profile_about}</h2>
              <div className="text-sm text-slate-600 space-y-2">
                <p><strong>{t.profile_gender}:</strong> {(publicProfile?.gender || currentUser?.gender) || '-'}</p>
                <p><strong>{t.profile_age}:</strong> {(publicProfile?.age ?? currentUser?.age) || '-'}</p>
                <p><strong>{t.profile_country}:</strong> {(publicProfile?.country || currentUser?.country) || '-'}</p>
                <p><strong>{t.profile_city}:</strong> {(publicProfile?.city || currentUser?.city) || '-'}</p>
                <p><strong>{t.profile_availability}:</strong> {(publicProfile?.availability || currentUser?.availability) || '-'}</p>
                <p><strong>{t.profile_bio}:</strong> {(publicProfile?.bio || currentUser?.bio) || '-'}</p>
                <p><strong>{t.profile_goals_label}:</strong> {(publicProfile?.goals || currentUser?.goals || []).join(', ') || '-'}</p>
                <p><strong>{t.profile_interests_label}:</strong> {(publicProfile?.interests || currentUser?.interests || []).join(', ') || '-'}</p>
              </div>
              {publicProfile && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold mb-2">{t.profile_goals_title}</h3>
                  <div className="space-y-2">
                    {publicGoals.length === 0 ? (
                      <p className="text-xs text-slate-500">-</p>
                    ) : (
                      publicGoals.map((goal) => (
                        <div key={goal.id} className="border border-slate-100 rounded-lg p-2 text-xs">
                          <p className="font-semibold">{goal.title}</p>
                          <p className="text-slate-500">{goal.category} · {goal.progress}%</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
      <Footer t={t} lang={lang} />
    </div>
  );
}








