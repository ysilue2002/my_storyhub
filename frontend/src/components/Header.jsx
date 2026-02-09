export default function Header({ t, lang, rightSlot }) {
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
        </nav>
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
