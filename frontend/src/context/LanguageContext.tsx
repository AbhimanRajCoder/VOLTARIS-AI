'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language } from '@/lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'gridwise-lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    // 1. Check localStorage
    const savedLang = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (savedLang && (savedLang === 'en' || savedLang === 'kn')) {
      setLanguageState(savedLang);
      document.documentElement.setAttribute('data-lang', savedLang);
    } else {
      // 2. Detect browser language
      const browserLang = navigator.language.startsWith('kn') ? 'kn' : 'en';
      setLanguageState(browserLang);
      document.documentElement.setAttribute('data-lang', browserLang);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.setAttribute('data-lang', lang);
  };

  const toggleLanguage = () => {
    const nextLang = language === 'en' ? 'kn' : 'en';
    setLanguage(nextLang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
