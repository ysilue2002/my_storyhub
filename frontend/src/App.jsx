import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import PostCard from './components/PostCard';
import Footer from './components/Footer';
import LanguageSwitcher from './components/LanguageSwitcher';

// Import des fichiers de traduction
import fr from './lang/fr.json';
import en from './lang/en.json';
import ar from './lang/ar.json';

const messages = { fr, en, ar };

export default function App() {
  const [lang, setLang] = useState('fr');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);

  const t = messages[lang]; // Traductions actuelles

  // Données simulées
  const mockResults = [
    {
      id: 1,
      platform: 'instagram',
      user: '@ayoub_media',
      content: 'https://placehold.co/600x400?text=Instagram+Post',
      timestamp: 'Il y a 2h',
      type: 'image',
    },
    {
      id: 2,
      platform: 'youtube',
      user: '@fatima_vlogs',
      content: 'https://placehold.co/600x400?text=YouTube+Video',
      timestamp: 'Hier',
      type: 'video',
    },
    {
      id: 3,
      platform: 'tiktok',
      user: '@youssef_dance',
      content: 'https://placehold.co/600x400?text=TikTok+Clip',
      timestamp: 'Il y a 5h',
      type: 'video',
    },
  ];

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setResults(mockResults);
    }
  };

  // Mise à jour de la direction du texte + gestion de la police arabe
  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  // Charger la police arabe uniquement si nécessaire
  useEffect(() => {
    let link;
    if (lang === 'ar') {
      link = document.createElement('link');
      link.href = 'https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }

    return () => {
      if (link) {
        document.head.removeChild(link); // Nettoyage si on change de langue
      }
    };
  }, [lang]);

  return (
    <div className="bg-gray-50 min-h-screen font-sans" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <LanguageSwitcher lang={lang} setLang={setLang} />

      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-br from-indigo-50 to-white text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className={`text-4xl md:text-5xl font-bold mb-6 ${lang === 'ar' ? 'font-arabic' : ''}`}>
            {t.hero_title}
          </h1>
          <p className={`text-lg text-gray-600 mb-8 ${lang === 'ar' ? 'text-right' : ''}`}>
            {t.hero_subtitle}
          </p>
          <SearchBar
            placeholder={t.search_placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={handleSearch}
            buttonText={t.search_button}
            lang={lang}
          />
        </div>
      </section>

      {/* Results Section */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className={`text-2xl font-semibold mb-6 ${lang === 'ar' ? 'text-right' : ''}`}>
            {t.hero_title}
          </h2>
          {results.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((post) => (
                <PostCard key={post.id} post={post} lang={lang} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">
              {t.no_results}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <Footer copyright={t.footer_copyright} lang={lang} />
    </div>
  );
}