import React from 'react';

export default function LanguageSwitcher({ lang, setLang }) {
  return (
    <div className="fixed top-24 right-6 z-30">
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="bg-white border border-slate-200 rounded-xl px-3 py-1 text-sm shadow-sm"
      >
        <option value="fr">Français</option>
        <option value="en">English</option>
        <option value="ar">العربية</option>
      </select>
    </div>
  );
}
