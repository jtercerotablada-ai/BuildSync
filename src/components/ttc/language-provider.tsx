'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { dictionaries, type Language, type TranslationKey } from '@/lib/i18n';

interface LanguageContextType {
  language: Language;
  t: (key: TranslationKey) => string;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    // Try API first (DB-persisted), fall back to localStorage
    (async () => {
      try {
        const res = await fetch('/api/users/preferences');
        if (res.ok) {
          const prefs = await res.json();
          const ui = prefs.uiState as { language?: string } | null;
          if (ui?.language === 'en' || ui?.language === 'es') {
            setLanguageState(ui.language);
            return;
          }
        }
      } catch {
        // network error — fall through
      }
      try {
        const saved = localStorage.getItem('ttc-language') as Language | null;
        if (saved && (saved === 'en' || saved === 'es')) {
          setLanguageState(saved);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('ttc-language', lang);
    } catch {
      // ignore
    }
    fetch('/api/users/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uiState: { language: lang } }),
    }).catch(() => { /* ignore */ });
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'es' : 'en');
  }, [language, setLanguage]);

  const t = useCallback(
    (key: TranslationKey): string => {
      return dictionaries[language][key] || key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, t, toggleLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
