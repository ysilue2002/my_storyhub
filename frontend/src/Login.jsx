import React, { useEffect, useState } from 'react';
import AuthCard from './components/AuthCard';
import LanguageSwitcher from './components/LanguageSwitcher';
import Footer from './components/Footer';
import SearchBar from './components/SearchBar';
import { API_BASE } from './config';

import fr from './lang/fr.json';
import en from './lang/en.json';
import ar from './lang/ar.json';

const messages = { fr, en, ar };
export default function Login() {
  const [lang, setLang] = useState('fr');
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [authState, setAuthState] = useState({ loading: false, error: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode') || 'simple');
  const isSimple = viewMode === 'simple';

  const t = messages[lang];

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

  useEffect(() => {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    fetch(`${API_BASE}/api/navigation-event`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        page: 'login',
        path: window.location.pathname + window.location.hash,
        referrer: document.referrer || '',
      }),
    }).catch(() => {});
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
      } catch (error) {
        setCurrentUser(null);
        setAuthToken('');
        localStorage.removeItem('authToken');
      }
    };
    loadMe();
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
      <main className="min-h-[70vh] flex items-center justify-center px-6">
        <div className="w-full max-w-md">
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
      </main>
      <Footer t={t} lang={lang} />
    </div>
  );
}
