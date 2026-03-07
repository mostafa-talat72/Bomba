import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { languages } from '../i18n/config';

const LanguageSwitcherAuth: React.FC = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const handleLanguageChange = (languageCode: string) => {
    const selectedLanguage = languages.find(lang => lang.code === languageCode);
    
    if (selectedLanguage) {
      i18n.changeLanguage(languageCode);
      localStorage.setItem('language', languageCode);
      
      // Update document direction
      document.documentElement.dir = selectedLanguage.dir;
      document.documentElement.lang = languageCode;
      
      // For auth pages (not logged in), always keep body as ltr
      // Check if user is on auth pages
      const isAuthPage = window.location.pathname.match(/^\/(login|register|verify-email|reset-password|email-actions)/);
      document.body.dir = isAuthPage ? 'ltr' : selectedLanguage.dir;
    }
    
    setIsOpen(false);
  };

  // Set initial direction on mount
  useEffect(() => {
    const language = languages.find(lang => lang.code === i18n.language);
    if (language) {
      document.documentElement.dir = language.dir;
      document.documentElement.lang = i18n.language;
      
      // For auth pages (not logged in), always keep body as ltr
      const isAuthPage = window.location.pathname.match(/^\/(login|register|verify-email|reset-password|email-actions)/);
      document.body.dir = isAuthPage ? 'ltr' : language.dir;
    }
  }, [i18n.language]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const isRTL = currentLanguage.dir === 'rtl';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-xl transition-all duration-200 text-white"
        aria-label="Change language"
      >
        <Globe className="w-5 h-5" />
        <span className="text-sm font-medium">{currentLanguage.flag} {currentLanguage.name}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className={`absolute top-full mt-2 ${isRTL ? 'left-0' : 'right-0'} w-48 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 overflow-hidden z-50 animate-fadeIn`}>
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => handleLanguageChange(language.code)}
              className={`w-full px-4 py-3 ${language.dir === 'rtl' ? 'text-right' : 'text-left'} flex items-center gap-3 transition-colors ${
                currentLanguage.code === language.code
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
              dir={language.dir}
            >
              <span className="text-2xl">{language.flag}</span>
              <div className="flex-1">
                <div className="font-medium">{language.name}</div>
              </div>
              {currentLanguage.code === language.code && (
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcherAuth;
