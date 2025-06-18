import React from 'react';

export default function LanguageSwitcher({ lang, setLang }) {
  return (
    <div className="absolute top-4 right-6">
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="bg-white border border-gray-300 rounded px-3 py-1 text-sm"
      >
        <option value="fr">Français</option>
        <option value="en">English</option>
        <option value="ar">العربية</option>
      </select>
    </div>
  );
}