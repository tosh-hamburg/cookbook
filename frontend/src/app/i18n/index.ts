import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Language, Translations } from './types';
import { en } from './en';
import { de } from './de';

// Translation dictionaries
const translations: Record<Language, Translations> = {
  en,
  de,
};

// Language detection
function detectLanguage(): Language {
  // Check localStorage first
  const stored = localStorage.getItem('cookbook-language');
  if (stored === 'en' || stored === 'de') {
    return stored;
  }
  
  // Detect from browser
  const browserLang = navigator.language || (navigator as any).userLanguage || 'en';
  const langCode = browserLang.split('-')[0].toLowerCase();
  
  // Return German for German-speaking regions, English for everything else
  if (langCode === 'de') {
    return 'de';
  }
  
  return 'en';
}

// Context
interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType | null>(null);

// Provider component
interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => detectLanguage());
  
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('cookbook-language', lang);
  };
  
  // Update document language attribute
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  
  const value: I18nContextType = {
    language,
    setLanguage,
    t: translations[language],
  };
  
  return React.createElement(I18nContext.Provider, { value }, children);
}

// Hook for using translations
export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}

// Export types
export type { Language, Translations } from './types';
