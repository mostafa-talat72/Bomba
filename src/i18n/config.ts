import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { WORLD_LANGUAGES } from '../../shared/languages';

// Dynamically import all translation files
const translationModules = import.meta.glob('./locales/*.json', { eager: true });

// Language resources - dynamically load all available translations
const resources: Record<string, { translation: any }> = {};

// Load all translation files
Object.entries(translationModules).forEach(([path, module]: [string, any]) => {
  // Extract language code from path (e.g., './locales/ar.json' -> 'ar')
  const langCode = path.match(/\.\/locales\/(.+)\.json$/)?.[1];
  if (langCode && module.default) {
    resources[langCode] = { translation: module.default };
  }
});

console.log(`✅ Loaded ${Object.keys(resources).length} language translations:`, Object.keys(resources).sort());

/**
 * Detect user's preferred language based on browser locale and timezone
 */
const detectUserLanguage = (): string => {
  // Check if user has already selected a language
  const savedLanguage = localStorage.getItem('language');
  if (savedLanguage && resources[savedLanguage]) {
    return savedLanguage;
  }

  // Get browser language (e.g., 'ar-EG', 'en-US', 'fr-FR')
  const browserLang = navigator.language || (navigator as any).userLanguage;
  const primaryLang = browserLang.split('-')[0]; // Extract primary language code

  // Check if we have translation for this language
  if (resources[primaryLang]) {
    console.log(`🌍 Auto-detected language: ${primaryLang} (from browser: ${browserLang})`);
    return primaryLang;
  }

  // Fallback to English if language not supported
  console.log(`🌍 Browser language '${primaryLang}' not supported, using English`);
  return 'en';
};

// Supported languages configuration - use all world languages
export const languages = WORLD_LANGUAGES.map(lang => ({
  code: lang.code,
  name: lang.name,
  nativeName: lang.nativeName,
  dir: lang.rtl ? 'rtl' : 'ltr',
  flag: lang.flag,
}));

i18n
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    resources,
    fallbackLng: 'en', // Default fallback language
    lng: detectUserLanguage(), // Auto-detect user's language
    
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
