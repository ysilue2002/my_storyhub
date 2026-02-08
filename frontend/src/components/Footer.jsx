export default function Footer({ t, lang }) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-slate-100 py-8 text-center text-sm text-slate-600">
      <p className={`${lang === 'ar' ? 'font-arabic' : ''}`}>
        &copy; {year} MyStoryHub. {t.footer_copyright}
      </p>
      <p className={`mt-2 ${lang === 'ar' ? 'font-arabic' : ''}`}>
        {t.footer_privacy} · {t.footer_terms} · {t.footer_contact}
      </p>
      <p className={`mt-2 text-xs ${lang === 'ar' ? 'font-arabic' : ''}`}>
        {t.footer_attribution_text}{' '}
        <a href={t.footer_attribution_link} className="underline" target="_blank" rel="noreferrer">
          {t.footer_attribution_source}
        </a>
      </p>
    </footer>
  );
}
