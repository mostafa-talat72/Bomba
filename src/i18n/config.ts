import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { WORLD_LANGUAGES } from '../../shared/languages';

import ar from './locales/ar.json';
import en from './locales/en.json';
import fr from './locales/fr.json';

// Create a base translation object with common keys
const createBaseTranslation = () => {
  // For languages without full translations, use English as fallback
  return en;
};

// Language resources - dynamically create resources for all languages
const resources: Record<string, { translation: any }> = {
  ar: { translation: ar },
  en: { translation: en },
  fr: { translation: fr },
};

// Add all other languages with English as fallback
WORLD_LANGUAGES.forEach((lang) => {
  if (!resources[lang.code]) {
    resources[lang.code] = { translation: createBaseTranslation() };
  }
});

// Supported languages configuration - use all world languages
export const languages = WORLD_LANGUAGES.map(lang => ({
  code: lang.code,
  name: lang.nativeName,
  dir: lang.rtl ? 'rtl' : 'ltr',
  flag: '', // Can be added later if needed
}));

i18n
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    resources,
    fallbackLng: 'ar', // Default language
    lng: localStorage.getItem('language') || 'ar', // Get saved language or use default
    
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    
    react: {
      useSuspense: false,
    },
  });

// Update HTML attributes when language changes
i18n.on('languageChanged', (lng) => {
  const language = languages.find(l => l.code === lng);
  if (language) {
    document.documentElement.lang = lng;
    document.documentElement.dir = language.dir;
    
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    // For auth pages or not logged in, keep body as ltr
    const isAuthPage = window.location.pathname.match(/^\/(login|register|verify-email|reset-password|email-actions)/);
    document.body.dir = (!token || isAuthPage) ? 'ltr' : language.dir;
    
    localStorage.setItem('language', lng);
  }
});

// Make i18n available globally for AppContext
declare global {
  interface Window {
    i18n: typeof i18n;
  }
}
window.i18n = i18n;

export default i18n;
