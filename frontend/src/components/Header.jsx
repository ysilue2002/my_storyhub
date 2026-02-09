export default function Header({ t, lang, unreadCount, pendingRequests, rightSlot }) {
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
        <nav className={`hidden md:flex gap-6 text-sm text-slate-600 ${lang === 'ar' ? 'font-arabic' : ''}`}>
          <a href="#home" className="hover:text-slate-900">{t.nav_home}</a>
          <a href="#goals" className="hover:text-slate-900">{t.nav_goals}</a>
          <a href="#people" className="hover:text-slate-900 flex items-center gap-2">
            {t.nav_people}
            {pendingRequests > 0 && (
              <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                {pendingRequests}
              </span>
            )}
          </a>
          <a href="#messages" className="hover:text-slate-900">{t.nav_messages}</a>
          <a href="#notifications" className="hover:text-slate-900 flex items-center gap-2">
            <span className="relative">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                <path d="M9 17a3 3 0 0 0 6 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 text-[10px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </span>
            {t.nav_notifications}
          </a>
        </nav>
        <div className="md:hidden flex items-center gap-3">
          <a
            href="#hubmates-requests"
            className="relative text-slate-700 hover:text-slate-900"
            aria-label={t.notifications_requests_title}
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {pendingRequests > 0 && (
              <span className="absolute -top-2 -right-2 text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                {pendingRequests}
              </span>
            )}
          </a>
          <a
            href="#notifications"
            className="relative text-slate-700 hover:text-slate-900"
            aria-label={t.nav_notifications}
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
              <path d="M9 17a3 3 0 0 0 6 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 text-[10px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </a>
        </div>
        <div className="flex items-center gap-3">
          {rightSlot}
          <a
            href="/profile"
            className="hidden md:inline-flex text-sm text-slate-700 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 transition"
          >
            {t.nav_profile}
          </a>
        </div>
      </div>
    </header>
  );
}
