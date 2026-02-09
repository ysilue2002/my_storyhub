import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import LanguageSwitcher from './components/LanguageSwitcher';
import Footer from './components/Footer';
import Header from './components/Header';
import AuthCard from './components/AuthCard';

import fr from './lang/fr.json';
import en from './lang/en.json';
import ar from './lang/ar.json';

const messages = { fr, en, ar };
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';
const WS_BASE = process.env.REACT_APP_WS_BASE || API_BASE;

export default function Hubmates() {
  const [lang, setLang] = useState('fr');
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [authState, setAuthState] = useState({ loading: false, error: '' });
  const [hubmates, setHubmates] = useState([]);
  const [requests, setRequests] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [alerts, setAlerts] = useState({ pendingRequests: 0, unreadMessages: 0 });
  const [socketRef, setSocketRef] = useState(null);

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

  const loadHubmates = async () => {
    if (!authToken) {
      setHubmates([]);
      setRequests([]);
      setBlocked([]);
      return;
    }
    try {
      const [hubRes, reqRes, blockRes] = await Promise.all([
        authFetch(`${API_BASE}/api/hubmates`),
        authFetch(`${API_BASE}/api/hubmates/requests`),
        authFetch(`${API_BASE}/api/blocks`),
      ]);
      const [hubData, reqData, blockData] = await Promise.all([
        hubRes.json(),
        reqRes.json(),
        blockRes.json(),
      ]);
      setHubmates(Array.isArray(hubData) ? hubData : []);
      setRequests(Array.isArray(reqData) ? reqData : []);
      setBlocked(Array.isArray(blockData) ? blockData : []);
    } catch (error) {
      setHubmates([]);
      setRequests([]);
      setBlocked([]);
    }
  };

  useEffect(() => {
    loadMe();
    loadHubmates();
    loadAlerts();
  }, [authToken]);

  useEffect(() => {
    if (!authToken) {
      if (socketRef) {
        socketRef.disconnect();
        setSocketRef(null);
      }
      return;
    }
    const socket = io(WS_BASE, { auth: { token: authToken } });
    setSocketRef(socket);
    socket.on('message:new', () => loadAlerts());
    socket.on('notification:new', () => loadAlerts());
    return () => {
      socket.disconnect();
      setSocketRef(null);
    };
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
    localStorage.removeItem('authToken');
  };

  const handleAccept = async (requestId) => {
    await authFetch(`${API_BASE}/api/connection-requests/${requestId}/accept`, { method: 'POST' });
    loadHubmates();
    loadAlerts();
  };

  const handleBlock = async (userId, requestId = null) => {
    if (requestId) {
      await authFetch(`${API_BASE}/api/connection-requests/${requestId}/decline`, { method: 'POST' });
    }
    await authFetch(`${API_BASE}/api/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockedUserId: userId }),
    });
    loadHubmates();
    loadAlerts();
  };

  const handleUnblock = async (userId) => {
    await authFetch(`${API_BASE}/api/blocks/${userId}`, { method: 'DELETE' });
    loadHubmates();
  };

  const handleRemove = async (userId) => {
    await authFetch(`${API_BASE}/api/hubmates/${userId}`, { method: 'DELETE' });
    loadHubmates();
  };

  const handleAddHubmate = async () => {
    const toUserId = window.prompt(t.hubmates_add_prompt);
    if (!toUserId) return;
    await authFetch(`${API_BASE}/api/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUserId: Number(toUserId), message: t.hubmates_add_message }),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fff6e8] via-[#f4f7f2] to-[#e9f2f7] text-slate-900">
      <LanguageSwitcher lang={lang} setLang={setLang} />
      <Header
        t={t}
        lang={lang}
        hubmatesCount={alerts.pendingRequests}
        messagesCount={alerts.unreadMessages}
      />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {!currentUser ? (
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
          <div className="grid gap-6">
            <div className="flex items-center justify-between">
              <h1 className={`text-2xl font-semibold ${lang === 'ar' ? 'font-arabic text-right' : 'font-heading'}`}>
                {t.nav_people}
              </h1>
              <button
                onClick={handleAddHubmate}
                className="text-sm text-slate-700 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50"
              >
                {t.hubmates_add}
              </button>
            </div>

            <section className="bg-white/90 border border-slate-100 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{t.hubmates_requests_title}</h2>
                <span className="text-xs text-slate-500">{requests.length}</span>
              </div>
              {requests.length === 0 ? (
                <p className="text-sm text-slate-500">{t.hubmates_requests_empty}</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {requests.map((req) => (
                    <div key={req.id} className="border border-slate-100 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 overflow-hidden">
                          {req.avatarUrl && (
                            <img src={req.avatarUrl} alt={req.name} className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{req.name}</p>
                          <p className="text-xs text-slate-500">{req.handle || '-'}</p>
                        </div>
                      </div>
                      {req.message && <p className="text-xs text-slate-600 mt-2">{req.message}</p>}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleAccept(req.id)}
                          className="text-xs text-emerald-700 border border-emerald-200 px-3 py-1 rounded-lg hover:bg-emerald-50"
                        >
                          {t.notifications_accept}
                        </button>
                        <button
                          onClick={() => handleBlock(req.userId, req.id)}
                          className="text-xs text-rose-600 border border-rose-200 px-3 py-1 rounded-lg hover:bg-rose-50"
                        >
                          {t.hubmates_block}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white/90 border border-slate-100 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{t.hubmates_list_title}</h2>
                <span className="text-xs text-slate-500">{hubmates.length}</span>
              </div>
              {hubmates.length === 0 ? (
                <p className="text-sm text-slate-500">{t.hubmates_empty}</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {hubmates.map((mate) => (
                    <div key={mate.id} className="border border-slate-100 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 overflow-hidden">
                          {mate.avatarUrl && (
                            <img src={mate.avatarUrl} alt={mate.name} className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{mate.name}</p>
                          <p className="text-xs text-slate-500">{mate.handle || '-'}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleRemove(mate.id)}
                          className="text-xs text-slate-700 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50"
                        >
                          {t.hubmates_remove}
                        </button>
                        <button
                          onClick={() => handleBlock(mate.id)}
                          className="text-xs text-rose-600 border border-rose-200 px-3 py-1 rounded-lg hover:bg-rose-50"
                        >
                          {t.hubmates_block}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white/90 border border-slate-100 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{t.hubmates_blocked_title}</h2>
                <span className="text-xs text-slate-500">{blocked.length}</span>
              </div>
              {blocked.length === 0 ? (
                <p className="text-sm text-slate-500">{t.hubmates_blocked_empty}</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {blocked.map((item) => (
                    <div key={item.id} className="border border-slate-100 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 overflow-hidden">
                          {item.avatarUrl && (
                            <img src={item.avatarUrl} alt={item.name} className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.handle || '-'}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <button
                          onClick={() => handleUnblock(item.id)}
                          className="text-xs text-slate-700 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50"
                        >
                          {t.hubmates_unblock}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <Footer t={t} lang={lang} />
    </div>
  );
}
