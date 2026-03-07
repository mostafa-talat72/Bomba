import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ar from './locales/ar.json';
import en from './locales/en.json';
import fr from './locales/fr.json';

// Language resources
const resources = {
  ar: { translation: ar },
  en: { translation: en },
  fr: { translation: fr },
};

// Supported languages configuration
export const languages = [
  { code: 'ar', name: 'العربية', dir: 'rtl', flag: '🇸🇦' },
  { code: 'en', name: 'English', dir: 'ltr', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', dir: 'ltr', flag: '🇫🇷' },
];

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
