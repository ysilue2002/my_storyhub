import React, { useEffect, useState } from 'react';
import AuthCard from './components/AuthCard';
import LanguageSwitcher from './components/LanguageSwitcher';
import Footer from './components/Footer';

import fr from './lang/fr.json';
import en from './lang/en.json';
import ar from './lang/ar.json';

const messages = { fr, en, ar };
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';

export default function Login() {
  const [lang, setLang] = useState('fr');
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [authState, setAuthState] = useState({ loading: false, error: '' });

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fff6e8] via-[#f4f7f2] to-[#e9f2f7] text-slate-900">
      <LanguageSwitcher lang={lang} setLang={setLang} />
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
