export default function GoalCard({ goal, owner, lang }) {
  return (
    <div className="bg-white/90 border border-slate-100 rounded-2xl p-5 shadow-[var(--shadow-soft)]">
      {goal.imageUrl && (
        <img src={goal.imageUrl} alt={goal.title} className="h-32 w-full rounded-xl object-cover mb-4" />
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{goal.category}</p>
          <h3 className={`text-lg font-semibold text-slate-900 mt-1 ${lang === 'ar' ? 'font-arabic' : 'font-heading'}`}>
            {goal.title}
          </h3>
        </div>
        <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full">
          {goal.progress}%
        </span>
      </div>
      <p className={`text-sm text-slate-600 mt-3 ${lang === 'ar' ? 'font-arabic' : ''}`}>
        {goal.description}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(goal.tags || []).map((tag) => (
          <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
            {tag}
          </span>
        ))}
      </div>
      {owner && (
        <div className="mt-4 text-sm text-slate-600">
          <span className="font-medium text-slate-700">{owner.name}</span> · {owner.city}
        </div>
      )}
    </div>
  );
}
