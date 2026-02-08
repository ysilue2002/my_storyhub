import { useState } from 'react';

export default function AuthCard({ t, lang, user, onLogin, onRegister, onLogout, loading, error }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError('');
    if (mode === 'register' && !name.trim()) {
      setLocalError(t.error_required);
      return;
    }
    if (!email.includes('@')) {
      setLocalError(t.error_invalid_email);
      return;
    }
    if (password.length < 6) {
      setLocalError(t.error_password_length);
      return;
    }
    if (mode === 'login') {
      await onLogin({ email, password });
    } else {
      await onRegister({ name, email, password });
    }
  };

  if (user) {
    return (
      <div className="bg-white/90 border border-slate-100 rounded-3xl p-6 shadow-[var(--shadow-soft)]">
        <h2 className={`text-lg font-semibold mb-4 ${lang === 'ar' ? 'font-arabic text-right' : 'font-heading'}`}>
          {user.name}
        </h2>
        <p className="text-sm text-slate-500">{user.email}</p>
        <p className="text-sm text-slate-500 mt-2">{user.handle}</p>
        <button
          onClick={onLogout}
          className="mt-6 w-full bg-slate-900 text-white px-4 py-3 rounded-xl hover:bg-slate-800 transition"
        >
          {t.auth_logout}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white/90 border border-slate-100 rounded-3xl p-6 shadow-[var(--shadow-soft)]">
      <div className="flex gap-3 mb-4">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`flex-1 py-2 rounded-xl text-sm ${
            mode === 'login' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {t.auth_login}
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          className={`flex-1 py-2 rounded-xl text-sm ${
            mode === 'register' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {t.auth_register}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === 'register' && (
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t.auth_name}
            className={`w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80 focus:outline-none focus:ring-2 focus:ring-amber-400 ${
              lang === 'ar' ? 'font-arabic text-right' : ''
            }`}
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t.auth_email}
          className={`w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80 focus:outline-none focus:ring-2 focus:ring-amber-400 ${
            lang === 'ar' ? 'font-arabic text-right' : ''
          }`}
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t.auth_password}
          className={`w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80 focus:outline-none focus:ring-2 focus:ring-amber-400 ${
            lang === 'ar' ? 'font-arabic text-right' : ''
          }`}
        />
        {localError && <div className="text-sm text-rose-600">{localError}</div>}
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="bg-amber-600 text-white px-4 py-3 rounded-xl hover:bg-amber-500 transition disabled:opacity-60"
        >
          {loading ? '...' : mode === 'login' ? t.auth_submit_login : t.auth_submit_register}
        </button>
      </form>
      <p className="text-xs text-slate-500 mt-4">
        {t.auth_demo_label}: <span className="font-medium">password123</span>
      </p>
    </div>
  );
}
