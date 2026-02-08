export default function NotificationCenter({
  notifications,
  onClear,
  title,
  emptyLabel,
  clearLabel,
}) {
  return (
    <div className="fixed top-4 left-6 z-30 w-72">
      <div className="bg-white/90 border border-slate-100 rounded-2xl shadow-[var(--shadow-soft)] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {notifications.length > 0 && (
            <button
              onClick={onClear}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              {clearLabel}
            </button>
          )}
        </div>
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-xs text-slate-500">{emptyLabel}</p>
          ) : (
            notifications.map((item) => (
              <div key={item.id} className="border border-slate-100 rounded-xl p-3">
                <p className="text-xs uppercase tracking-wide text-amber-600">{item.title}</p>
                <p className="text-sm text-slate-700 mt-1">{item.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
