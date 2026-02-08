export default function ConversationCard({ conversation, active, onSelect }) {
  return (
    <button
      onClick={() => onSelect(conversation)}
      className={`w-full text-left px-4 py-3 rounded-xl border transition ${
        active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-100 bg-white hover:border-slate-200'
      }`}
    >
      <p className="text-sm font-medium">{conversation.title}</p>
      <p className={`text-xs mt-1 ${active ? 'text-white/80' : 'text-slate-500'}`}>
        {conversation.lastMessage}
      </p>
    </button>
  );
}
