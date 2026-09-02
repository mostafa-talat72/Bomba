import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { WORLD_LANGUAGES } from '../../shared/languages';

// Dynamically import all translation files (non-eager - lazy loaded)
const localeModules = import.meta.glob('./locales/*.json');

// Preload commonly used locales
const preloadLocales = ['en', 'ar'];

// Load locale on demand
const loadLocaleResources = async (lng: string) => {
    const mod = localeModules[`./locales/${lng}.json`];
    if (mod) {
        const resources = await mod() as Record<string, Record<string, string>>;
        i18n.addResourceBundle(lng, 'translation', resources.default || resources, true, true);
    }
};

/**
 * Detect user's preferred language based on browser locale and timezone
 */
const detectUserLanguage = (): string => {
  const savedLanguage = localStorage.getItem('language');
  if (savedLanguage) {
    return savedLanguage;
  }

  const browserLang = navigator.language || (navigator as any).userLanguage;
  const primaryLang = browserLang.split('-')[0];

  return primaryLang || 'en';
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
    resources: {},
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

// Load preloaded locales eagerly (only English and Arabic)
for (const lng of preloadLocales) {
    const mod = localeModules[`./locales/${lng}.json`];
    if (mod) {
        mod().then((resources) => {
            const loadedResources = resources as Record<string, Record<string, string>>;
            i18n.addResourceBundle(lng, 'translation', loadedResources.default || loadedResources, true, true);
        });
    }
}

// Load on language change
i18n.on('languageChanged', (lng) => {
    if (!i18n.hasResourceBundle(lng, 'translation')) {
        loadLocaleResources(lng);
    }

    const language = languages.find(l => l.code === lng);
    if (language) {
      document.documentElement.lang = lng;
      document.documentElement.dir = language.dir;
      
      const token = localStorage.getItem('token');
      const isAuthPage = window.location.pathname.match(/^\/(login|register|verify-email|reset-password|email-actions)/);
      
      if (token && !isAuthPage) {
        document.body.dir = language.dir;
      } else {
        document.body.dir = 'ltr';
      }
      
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
