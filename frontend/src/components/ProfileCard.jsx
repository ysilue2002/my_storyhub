export default function ProfileCard({ user, t, lang, onConnect, showProfileLink = true }) {
  return (
    <div className="bg-white/90 border border-slate-100 rounded-2xl p-5 shadow-[var(--shadow-soft)] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-100 overflow-hidden">
              {user.avatarUrl && <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />}
            </div>
            <h3 className={`text-lg font-semibold text-slate-900 ${lang === 'ar' ? 'font-arabic' : 'font-heading'}`}>
              {user.name}
            </h3>
          </div>
          <p className="text-sm text-slate-500">{user.handle} · {user.city}</p>
        </div>
        <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">
          {user.availability}
        </span>
      </div>
      <p className={`text-sm text-slate-600 ${lang === 'ar' ? 'font-arabic' : ''}`}>{user.bio}</p>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">{t.profile_goals_label}</p>
        <div className="flex flex-wrap gap-2">
          {(user.goals || []).map((goal) => (
            <span key={goal} className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
              {goal}
            </span>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">{t.profile_interests_label}</p>
        <div className="flex flex-wrap gap-2">
          {(user.interests || []).map((interest) => (
            <span key={interest} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
              {interest}
            </span>
          ))}
        </div>
      </div>
      <button
        onClick={() => onConnect(user)}
        className="mt-2 bg-slate-900 text-white py-2.5 rounded-xl hover:bg-slate-800 transition"
      >
        {t.connect_button}
      </button>
      {showProfileLink && (
        <a
          href={`/profile?user=${user.id}`}
          className="text-sm text-slate-600 text-center underline"
        >
          {t.profile_view_public}
        </a>
      )}
    </div>
  );
}
