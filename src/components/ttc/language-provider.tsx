'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
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
  const { status } = useSession();
  const isAuthed = status === 'authenticated';

  useEffect(() => {
    let cancelled = false;
    // The DB-backed preference only exists for signed-in users. Anonymous
    // visitors on the public marketing site would otherwise fire an
    // unauthenticated request that always 401s — a wasted round-trip and a
    // console error on every single page view.
    (async () => {
      if (isAuthed) {
        try {
          const res = await fetch('/api/users/preferences');
          if (res.ok) {
            const prefs = await res.json();
            const ui = prefs.uiState as { language?: string } | null;
            if ((ui?.language === 'en' || ui?.language === 'es') && !cancelled) {
              setLanguageState(ui.language);
              return;
            }
          }
        } catch {
          // network error — fall through to localStorage
        }
      }
      try {
        const saved = localStorage.getItem('ttc-language') as Language | null;
        if (saved && (saved === 'en' || saved === 'es') && !cancelled) {
          setLanguageState(saved);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('ttc-language', lang);
    } catch {
      // ignore
    }
    if (!isAuthed) return;
    fetch('/api/users/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uiState: { language: lang } }),
    }).catch(() => { /* ignore */ });
  }, [isAuthed]);

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
