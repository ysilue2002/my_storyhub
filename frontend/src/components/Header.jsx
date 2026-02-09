export default function Header({ t, lang, rightSlot, hubmatesCount = 0, messagesCount = 0 }) {
  const hubmatesActive = hubmatesCount > 0;
  const messagesActive = messagesCount > 0;
  const isAuthed = Boolean(localStorage.getItem('authToken'));

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    window.location.href = '/';
  };
  return (
    <header className="bg-white/80 backdrop-blur border-b border-slate-100 sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            M
          </div>
          <h1 className={`text-2xl font-semibold text-slate-900 ${lang === 'ar' ? 'font-arabic' : 'font-heading'}`}>
            {t.title}
          </h1>
        </div>
        <nav className={`hidden md:flex items-center gap-6 text-sm text-slate-600 ${lang === 'ar' ? 'font-arabic' : ''}`}>
          <a href="/" className="hover:text-slate-900">{t.nav_home}</a>
          <a href="/#goals" className="hover:text-slate-900">{t.nav_goals}</a>
          <a
            href="/hubmates"
            className={`hover:text-slate-900 flex items-center gap-2 ${hubmatesActive ? 'text-amber-700' : ''}`}
          >
            {hubmatesActive && (
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500 text-white text-[10px]">
                {hubmatesCount}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              {hubmatesActive && (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                  <path d="M9 17a3 3 0 0 0 6 0" />
                </svg>
              )}
              {t.nav_people}
            </span>
          </a>
          <a
            href="/messages"
            className={`hover:text-slate-900 flex items-center gap-2 ${messagesActive ? 'text-rose-700' : ''}`}
          >
            {messagesActive && (
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-rose-500 text-white text-[10px]">
                {messagesCount}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              {messagesActive && (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                  <path d="M9 17a3 3 0 0 0 6 0" />
                </svg>
              )}
              {t.nav_messages}
            </span>
          </a>
          <a
            href="/profile"
            className="hover:text-slate-900"
          >
            {t.nav_profile}
          </a>
          <div className="flex items-center gap-3">
            {rightSlot}
            {isAuthed && (
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm text-slate-700 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50"
              >
                {t.auth_logout}
              </button>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
