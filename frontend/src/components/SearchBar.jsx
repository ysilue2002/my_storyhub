export default function SearchBar({ placeholder, value, onChange, onSearch, buttonText, lang }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSearch();
      }}
      className="flex flex-col sm:flex-row gap-2"
    >
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        aria-label={placeholder}
        className={`w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/90 focus:outline-none focus:ring-2 focus:ring-amber-400 ${
          lang === 'ar' ? 'font-arabic text-right' : ''
        }`}
      />
      <button
        type="button"
        onClick={onSearch}
        className="bg-amber-600 text-white px-6 py-3 rounded-xl hover:bg-amber-500 transition"
      >
        {buttonText}
      </button>
    </form>
  );
}
