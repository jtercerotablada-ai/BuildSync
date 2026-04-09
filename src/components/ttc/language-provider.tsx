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
    const saved = localStorage.getItem('ttc-language') as Language | null;
    if (saved && (saved === 'en' || saved === 'es')) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('ttc-language', lang);
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
