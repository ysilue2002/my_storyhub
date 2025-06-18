import { useState, useEffect } from 'react';

// Import des fichiers de traduction
import fr from '../lang/fr.json';
import en from '../lang/en.json';
import ar from '../lang/ar.json';

const messages = { fr, en, ar };

export default function useTranslation() {
  const savedLang = localStorage.getItem('lang') || 'fr';
  const [lang, setLang] = useState(savedLang);

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const t = messages[lang];

  return { t, lang, setLang };
}