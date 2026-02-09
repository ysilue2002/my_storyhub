import React, { useEffect, useState } from 'react';
import AuthCard from './components/AuthCard';
import LanguageSwitcher from './components/LanguageSwitcher';
import Footer from './components/Footer';
import SearchBar from './components/SearchBar';

import fr from './lang/fr.json';
import en from './lang/en.json';
import ar from './lang/ar.json';

const messages = { fr, en, ar };
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';

export default function Admin() {
  const [lang, setLang] = useState('fr');
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [authState, setAuthState] = useState({ loading: false, error: '' });
  const [adminGateOpen, setAdminGateOpen] = useState(
    sessionStorage.getItem('adminGateOpen') === 'true'
  );
  const [adminCodeInput, setAdminCodeInput] = useState('');
  const [adminCodeError, setAdminCodeError] = useState('');
  const [adminData, setAdminData] = useState({
    users: [],
    goals: [],
    comments: [],
    ads: [],
    messages: [],
    notifications: [],
    reports: [],
  });
  const [adminForm, setAdminForm] = useState({
    title: '',
    body: '',
    imageUrl: '',
    linkUrl: '',
    isActive: true,
    isSponsorOfDay: false,
    sponsorStart: '',
    sponsorEnd: '',
  });
  const [sponsorQuickWeek, setSponsorQuickWeek] = useState(false);
  const [sponsorDateError, setSponsorDateError] = useState('');
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode') || 'simple');
  const isSimple = viewMode === 'simple';
  const [searchQuery, setSearchQuery] = useState('');

  const t = messages[lang];
  const ADMIN_CODE = process.env.REACT_APP_ADMIN_CODE || '';

  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchQuery('');
    }
  };

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  const authFetch = (url, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    return fetch(url, { ...options, headers });
  };

  const handleAdminGate = (event) => {
    event.preventDefault();
    setAdminCodeError('');
    if (!ADMIN_CODE || adminCodeInput === ADMIN_CODE) {
      sessionStorage.setItem('adminGateOpen', 'true');
      setAdminGateOpen(true);
      return;
    }
    setAdminCodeError(t.admin_code_error);
  };

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
    } catch (error) {
      setCurrentUser(null);
      setAuthToken('');
      localStorage.removeItem('authToken');
    }
  };

  const loadAdminData = async () => {
    if (!authToken || currentUser?.role !== 'admin') return;
    try {
      const [usersRes, goalsRes, commentsRes, adsRes, messagesRes, notifRes, reportsRes] = await Promise.all([
        authFetch(`${API_BASE}/api/admin/users`),
        authFetch(`${API_BASE}/api/admin/goals`),
        authFetch(`${API_BASE}/api/admin/comments`),
        authFetch(`${API_BASE}/api/admin/ads`),
        authFetch(`${API_BASE}/api/admin/messages`),
        authFetch(`${API_BASE}/api/admin/notifications`),
        authFetch(`${API_BASE}/api/admin/reports`),
      ]);
      const [users, goals, comments, ads, messages, notifications, reports] = await Promise.all([
        usersRes.json(),
        goalsRes.json(),
        commentsRes.json(),
        adsRes.json(),
        messagesRes.json(),
        notifRes.json(),
        reportsRes.json(),
      ]);
      setAdminData({
        users: Array.isArray(users) ? users : [],
        goals: Array.isArray(goals) ? goals : [],
        comments: Array.isArray(comments) ? comments : [],
        ads: Array.isArray(ads) ? ads : [],
        messages: Array.isArray(messages) ? messages : [],
        notifications: Array.isArray(notifications) ? notifications : [],
        reports: Array.isArray(reports) ? reports : [],
      });
    } catch (error) {
      setAdminData({
        users: [],
        goals: [],
        comments: [],
        ads: [],
        messages: [],
        notifications: [],
        reports: [],
      });
    }
  };

  useEffect(() => {
    loadMe();
  }, [authToken]);

  useEffect(() => {
    loadAdminData();
  }, [currentUser, authToken]);

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

  const adminUpdateUserRole = async (userId, role) => {
    await authFetch(`${API_BASE}/api/admin/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    loadAdminData();
  };

  const adminDeleteUser = async (userId) => {
    await authFetch(`${API_BASE}/api/admin/users/${userId}`, { method: 'DELETE' });
    loadAdminData();
  };

  const adminDeleteGoal = async (goalId) => {
    await authFetch(`${API_BASE}/api/admin/goals/${goalId}`, { method: 'DELETE' });
    loadAdminData();
  };

  const adminDeleteMessage = async (messageId) => {
    await authFetch(`${API_BASE}/api/admin/messages/${messageId}`, { method: 'DELETE' });
    loadAdminData();
  };

  const adminDeleteNotification = async (notificationId) => {
    await authFetch(`${API_BASE}/api/admin/notifications/${notificationId}`, { method: 'DELETE' });
    loadAdminData();
  };

  const adminResolveReport = async (reportId, status) => {
    await authFetch(`${API_BASE}/api/admin/reports/${reportId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadAdminData();
  };

  const adminSuspendUser = async (userId, days) => {
    await authFetch(`${API_BASE}/api/admin/users/${userId}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    });
    loadAdminData();
  };

  const adminUnsuspendUser = async (userId) => {
    await authFetch(`${API_BASE}/api/admin/users/${userId}/unsuspend`, {
      method: 'POST',
    });
    loadAdminData();
  };

  const adminDeleteComment = async (commentId) => {
    await authFetch(`${API_BASE}/api/admin/posts/comments/${commentId}`, { method: 'DELETE' });
    loadAdminData();
  };

  const adminSaveAd = async (event) => {
    event.preventDefault();
    if (!adminForm.title.trim()) return;
    if (adminForm.isSponsorOfDay) {
      if (!adminForm.sponsorStart || !adminForm.sponsorEnd) {
        setSponsorDateError(t.admin_ad_sponsor_missing);
        return;
      }
    }
    setSponsorDateError('');
    await authFetch(`${API_BASE}/api/admin/ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...adminForm,
        sponsorStart: adminForm.sponsorStart || null,
        sponsorEnd: adminForm.sponsorEnd || null,
      }),
    });
    setAdminForm({
      title: '',
      body: '',
      imageUrl: '',
      linkUrl: '',
      isActive: true,
      isSponsorOfDay: false,
      sponsorStart: '',
      sponsorEnd: '',
    });
    setSponsorQuickWeek(false);
    loadAdminData();
  };

  const adminSetSponsor = async (ad) => {
    await authFetch(`${API_BASE}/api/admin/ads/${ad.id}/sponsor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sponsorStart: ad.sponsorStart,
        sponsorEnd: ad.sponsorEnd,
      }),
    });
    loadAdminData();
  };

  const adminDeleteAd = async (adId) => {
    await authFetch(`${API_BASE}/api/admin/ads/${adId}`, { method: 'DELETE' });
    loadAdminData();
  };

  return (
    <div className={`min-h-screen bg-gradient-to-b from-[#fff6e8] via-[#f4f7f2] to-[#e9f2f7] text-slate-900 ${isSimple ? 'view-simple' : ''}`}>
      <LanguageSwitcher lang={lang} setLang={setLang} />
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="flex justify-end">
          <div className="w-72">
            <SearchBar
              placeholder={t.search_placeholder}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onSearch={handleSearch}
              buttonText={t.search_button}
              lang={lang}
            />
          </div>
        </div>
      </div>
      <header className="bg-white/80 backdrop-blur border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className={`text-2xl font-semibold ${lang === 'ar' ? 'font-arabic' : 'font-heading'}`}>
            {t.admin_title}
          </h1>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-full bg-slate-100 p-1">
              <button
                onClick={() => setViewMode('simple')}
                className={`px-3 py-1 text-xs rounded-full transition ${
                  isSimple ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.view_simple}
              </button>
              <button
                onClick={() => setViewMode('full')}
                className={`px-3 py-1 text-xs rounded-full transition ${
                  !isSimple ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.view_full}
              </button>
            </div>
            <button className="text-sm text-slate-600 border border-slate-200 px-3 py-1 rounded-lg" onClick={handleLogout}>
              {t.auth_logout}
            </button>
          </div>
        </div>
      </header>

      <main className="py-10">
        <div className="max-w-6xl mx-auto px-6">
          {!adminGateOpen ? (
            <div className="max-w-md bg-white/90 border border-slate-100 rounded-2xl p-6 shadow-[var(--shadow-soft)]">
              <h2 className="text-lg font-semibold mb-3">{t.admin_code_title}</h2>
              <p className="text-sm text-slate-500 mb-4">{t.admin_code_subtitle}</p>
              <form onSubmit={handleAdminGate} className="grid gap-3">
                <input
                  type="password"
                  value={adminCodeInput}
                  onChange={(event) => setAdminCodeInput(event.target.value)}
                  placeholder={t.admin_code_placeholder}
                  className="border border-slate-200 rounded px-3 py-2"
                />
                {adminCodeError && <div className="text-sm text-rose-600">{adminCodeError}</div>}
                <button className="bg-slate-900 text-white px-4 py-2 rounded">
                  {t.admin_code_submit}
                </button>
              </form>
            </div>
          ) : (
          <div className={`grid gap-6 items-start ${isSimple ? '' : 'lg:grid-cols-[0.25fr_0.75fr]'}`}>
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
            {currentUser?.role !== 'admin' ? (
              <div className="bg-white/90 border border-rose-200 rounded-2xl p-6 text-center">
                <p className="text-sm text-rose-600 font-semibold">{t.admin_403_title}</p>
                <p className="text-xs text-slate-500 mt-2">{t.admin_forbidden}</p>
              </div>
            ) : (
              <div className={`grid gap-6 ${isSimple ? '' : 'lg:grid-cols-[0.25fr_0.75fr]'}`}>
                <aside className={`bg-white/90 border border-slate-100 rounded-2xl p-5 ${isSimple ? '' : 'sticky top-24 h-fit'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">{t.admin_menu_title}</h3>
                    <button
                      className="lg:hidden text-xs text-slate-600 border border-slate-200 px-2 py-1 rounded"
                      onClick={() => setAdminMenuOpen((prev) => !prev)}
                    >
                      {adminMenuOpen ? t.admin_menu_hide : t.admin_menu_show}
                    </button>
                  </div>
                  <nav className={`flex flex-col gap-2 text-sm text-slate-600 ${adminMenuOpen ? '' : 'hidden lg:flex'}`}>
                    <a href="#admin-users" className="hover:text-slate-900 flex items-center justify-between gap-2">
                      <span>👤 {t.admin_users}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {adminData.users.length}
                      </span>
                    </a>
                    <a href="#admin-goals" className="hover:text-slate-900 flex items-center justify-between gap-2">
                      <span>🎯 {t.admin_goals}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {adminData.goals.length}
                      </span>
                    </a>
                    <a href="#admin-comments" className="hover:text-slate-900 flex items-center justify-between gap-2">
                      <span>💬 {t.admin_comments}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {adminData.comments.length}
                      </span>
                    </a>
                    <a href="#admin-ads" className="hover:text-slate-900 flex items-center justify-between gap-2">
                      <span>📢 {t.admin_ads}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {adminData.ads.length}
                      </span>
                    </a>
                    <a href="#admin-messages" className="hover:text-slate-900 flex items-center justify-between gap-2">
                      <span>✉️ {t.admin_messages}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {adminData.messages.length}
                      </span>
                    </a>
                    <a
                      href="#admin-notifications"
                      className="hover:text-slate-900 flex items-center justify-between gap-2"
                    >
                      <span>🔔 {t.admin_notifications}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {adminData.notifications.length}
                      </span>
                    </a>
                    <a
                      href="#admin-reports"
                      className="hover:text-slate-900 flex items-center justify-between gap-2"
                    >
                      <span>🚩 {t.admin_reports}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {adminData.reports.length}
                      </span>
                    </a>
                  </nav>
                </aside>
                <div className={`grid gap-6 ${isSimple ? '' : 'lg:grid-cols-2'}`}>
                <div id="admin-users" className="bg-white/90 border border-slate-100 rounded-2xl p-5 scroll-mt-24">
                  <h3 className="text-lg font-semibold mb-3">{t.admin_users}</h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {adminData.users.map((user) => (
                      <div key={user.id} className="border border-slate-100 rounded-xl p-3">
                        <p className="text-sm font-semibold">{user.name} <span className="text-xs text-slate-500">({user.email})</span></p>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <select
                            value={user.role}
                            onChange={(e) => adminUpdateUserRole(user.id, e.target.value)}
                            className="border border-slate-200 rounded px-2 py-1 text-sm"
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                          </select>
                          {[1, 7, 30].map((days) => (
                            <button
                              key={days}
                              onClick={() => adminSuspendUser(user.id, days)}
                              className="text-xs text-amber-700 border border-amber-200 px-2 py-1 rounded"
                            >
                              {days} {t.admin_days}
                            </button>
                          ))}
                          <button
                            onClick={() => adminUnsuspendUser(user.id)}
                            className="text-xs text-slate-600 border border-slate-200 px-2 py-1 rounded"
                          >
                            {t.admin_unsuspend}
                          </button>
                          <button
                            onClick={() => adminDeleteUser(user.id)}
                            className="text-xs text-rose-600 border border-rose-200 px-2 py-1 rounded"
                          >
                            {t.admin_delete}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div id="admin-goals" className="bg-white/90 border border-slate-100 rounded-2xl p-5 scroll-mt-24">
                  <h3 className="text-lg font-semibold mb-3">{t.admin_goals}</h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {adminData.goals.map((goal) => (
                      <div key={goal.id} className="border border-slate-100 rounded-xl p-3">
                        <p className="text-sm font-semibold">{goal.title}</p>
                        <p className="text-xs text-slate-500">{goal.category} · {goal.progress}%</p>
                        <button
                          onClick={() => adminDeleteGoal(goal.id)}
                          className="mt-2 text-xs text-rose-600 border border-rose-200 px-2 py-1 rounded"
                        >
                          {t.admin_delete}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div id="admin-comments" className="bg-white/90 border border-slate-100 rounded-2xl p-5 scroll-mt-24">
                  <h3 className="text-lg font-semibold mb-3">{t.admin_comments}</h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {adminData.comments.map((comment) => (
                      <div key={comment.id} className="border border-slate-100 rounded-xl p-3">
                        <p className="text-sm text-slate-700">{comment.body}</p>
                        <button
                          onClick={() => adminDeleteComment(comment.id)}
                          className="mt-2 text-xs text-rose-600 border border-rose-200 px-2 py-1 rounded"
                        >
                          {t.admin_delete}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div id="admin-ads" className="bg-white/90 border border-slate-100 rounded-2xl p-5 scroll-mt-24">
                  <h3 className="text-lg font-semibold mb-3">{t.admin_ads}</h3>
                  <form onSubmit={adminSaveAd} className="grid gap-2 mb-4">
                    <input
                      type="text"
                      value={adminForm.title}
                      onChange={(e) => setAdminForm({ ...adminForm, title: e.target.value })}
                      placeholder={t.admin_ad_title}
                      className="border border-slate-200 rounded px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={adminForm.body}
                      onChange={(e) => setAdminForm({ ...adminForm, body: e.target.value })}
                      placeholder={t.admin_ad_body}
                      className="border border-slate-200 rounded px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={adminForm.imageUrl}
                      onChange={(e) => setAdminForm({ ...adminForm, imageUrl: e.target.value })}
                      placeholder={t.admin_ad_image}
                      className="border border-slate-200 rounded px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={adminForm.linkUrl}
                      onChange={(e) => setAdminForm({ ...adminForm, linkUrl: e.target.value })}
                      placeholder={t.admin_ad_link}
                      className="border border-slate-200 rounded px-3 py-2 text-sm"
                    />
                    <label className="text-xs text-slate-500 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={adminForm.isActive}
                        onChange={(e) => setAdminForm({ ...adminForm, isActive: e.target.checked })}
                      />
                      {t.admin_ad_active}
                    </label>
                    <label className="text-xs text-slate-500 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={adminForm.isSponsorOfDay}
                        onChange={(e) => setAdminForm({ ...adminForm, isSponsorOfDay: e.target.checked })}
                        disabled={!adminForm.isActive}
                      />
                      {t.admin_ad_sponsor}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={adminForm.sponsorStart}
                        onChange={(e) => setAdminForm({ ...adminForm, sponsorStart: e.target.value })}
                        placeholder={t.admin_ad_sponsor_start}
                        className="border border-slate-200 rounded px-3 py-2 text-xs"
                      />
                      <input
                        type="date"
                        value={adminForm.sponsorEnd}
                        onChange={(e) => setAdminForm({ ...adminForm, sponsorEnd: e.target.value })}
                        placeholder={t.admin_ad_sponsor_end}
                        min={adminForm.sponsorStart || undefined}
                        className="border border-slate-200 rounded px-3 py-2 text-xs"
                      />
                    </div>
                    {sponsorDateError && (
                      <p className="text-xs text-rose-600">{sponsorDateError}</p>
                    )}
                    <label className="text-xs text-slate-500 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={sponsorQuickWeek}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSponsorQuickWeek(checked);
                          if (checked) {
                            const today = new Date();
                            const start = today.toISOString().slice(0, 10);
                            const endDate = new Date(today);
                            endDate.setDate(endDate.getDate() + 6);
                            const end = endDate.toISOString().slice(0, 10);
                            setAdminForm((prev) => ({
                              ...prev,
                              isSponsorOfDay: true,
                              sponsorStart: start,
                              sponsorEnd: end,
                            }));
                          }
                        }}
                      />
                      {t.admin_ad_sponsor_quick_week}
                    </label>
                    <button className="bg-slate-900 text-white px-3 py-2 rounded text-sm">
                      {t.admin_create}
                    </button>
                  </form>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {adminData.ads.map((ad) => {
                      const today = new Date().toISOString().slice(0, 10);
                      const expired =
                        ad.isSponsorOfDay &&
                        ad.sponsorEnd &&
                        new Date(`${ad.sponsorEnd}T23:59:59`) < new Date();
                      return (
                      <div key={ad.id} className="border border-slate-100 rounded-xl p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{ad.title}</p>
                          {ad.isSponsorOfDay && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                              {t.admin_ad_sponsor}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {ad.isActive ? 'active' : 'inactive'}
                          {ad.sponsorStart && ad.sponsorEnd ? ` • ${ad.sponsorStart} → ${ad.sponsorEnd}` : ''}
                        </p>
                        {expired && (
                          <p className="text-xs text-rose-600 mt-1">
                            {t.admin_ad_sponsor_expired}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            onClick={() => adminSetSponsor(ad)}
                            className="text-xs text-emerald-700 border border-emerald-200 px-2 py-1 rounded disabled:opacity-60"
                            disabled={!ad.isActive}
                          >
                            {t.admin_ad_set_sponsor}
                          </button>
                          <button
                            onClick={() => {
                              const start = ad.sponsorStart || new Date().toISOString().slice(0, 10);
                              const endDate = new Date(start);
                              endDate.setDate(endDate.getDate() + 6);
                              const end = endDate.toISOString().slice(0, 10);
                              adminSetSponsor({ ...ad, sponsorStart: start, sponsorEnd: end });
                            }}
                            className="text-xs text-slate-700 border border-slate-200 px-2 py-1 rounded"
                            disabled={!ad.isActive}
                          >
                            {t.admin_ad_extend_week}
                          </button>
                          <button
                            onClick={() => adminDeleteAd(ad.id)}
                            className="text-xs text-rose-600 border border-rose-200 px-2 py-1 rounded"
                          >
                            {t.admin_delete}
                          </button>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>

                <div id="admin-messages" className="bg-white/90 border border-slate-100 rounded-2xl p-5 scroll-mt-24">
                  <h3 className="text-lg font-semibold mb-3">{t.admin_messages}</h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {adminData.messages.map((msg) => (
                      <div key={msg.id} className="border border-slate-100 rounded-xl p-3">
                        <p className="text-sm text-slate-700">{msg.text}</p>
                        <button
                          onClick={() => adminDeleteMessage(msg.id)}
                          className="mt-2 text-xs text-rose-600 border border-rose-200 px-2 py-1 rounded"
                        >
                          {t.admin_delete}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div id="admin-notifications" className="bg-white/90 border border-slate-100 rounded-2xl p-5 scroll-mt-24">
                  <h3 className="text-lg font-semibold mb-3">{t.admin_notifications}</h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {adminData.notifications.map((notif) => (
                      <div key={notif.id} className="border border-slate-100 rounded-xl p-3">
                        <p className="text-sm font-semibold">{notif.title}</p>
                        <p className="text-xs text-slate-500">{notif.body}</p>
                        <button
                          onClick={() => adminDeleteNotification(notif.id)}
                          className="mt-2 text-xs text-rose-600 border border-rose-200 px-2 py-1 rounded"
                        >
                          {t.admin_delete}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div id="admin-reports" className="bg-white/90 border border-slate-100 rounded-2xl p-5 scroll-mt-24">
                  <h3 className="text-lg font-semibold mb-3">{t.admin_reports}</h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {adminData.reports.map((report) => (
                      <div key={report.id} className="border border-slate-100 rounded-xl p-3">
                        <p className="text-sm font-semibold">
                          {report.targetType} #{report.targetId}
                        </p>
                        <p className="text-xs text-slate-500">
                          {t.admin_reporter}: {report.reporterName || report.reporterId || '-'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {t.admin_target}: {report.targetUserName || report.targetUserId || '-'}
                        </p>
                        {report.reason && <p className="text-xs text-slate-500">{report.reason}</p>}
                        <p className="text-[10px] text-slate-400 mt-1">{report.status}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {report.targetType === 'comment' && (
                            <button
                              onClick={() => adminDeleteComment(report.targetId)}
                              className="text-xs text-rose-600 border border-rose-200 px-2 py-1 rounded"
                            >
                              {t.admin_delete_comment}
                            </button>
                          )}
                          {report.targetType === 'message' && (
                            <button
                              onClick={() => adminDeleteMessage(report.targetId)}
                              className="text-xs text-rose-600 border border-rose-200 px-2 py-1 rounded"
                            >
                              {t.admin_delete_message}
                            </button>
                          )}
                          <button
                            onClick={() => adminResolveReport(report.id, 'resolved')}
                            className="text-xs text-emerald-700 border border-emerald-200 px-2 py-1 rounded"
                          >
                            {t.admin_report_resolve}
                          </button>
                          <button
                            onClick={() => adminResolveReport(report.id, 'dismissed')}
                            className="text-xs text-slate-600 border border-slate-200 px-2 py-1 rounded"
                          >
                            {t.admin_report_dismiss}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </main>
      <Footer t={t} lang={lang} />
    </div>
  );
}
