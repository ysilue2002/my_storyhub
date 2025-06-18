export default function SearchBar({ placeholder, value, onChange, onSearch, buttonText }) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
          lang === 'ar' ? 'font-arabic text-right' : ''
        }`}
      />
      <button
        onClick={onSearch}
        className="bg-indigo-700 text-white px-6 py-3 rounded-lg hover:bg-indigo-600 transition"
      >
        {buttonText}
      </button>
    </div>
  );
}