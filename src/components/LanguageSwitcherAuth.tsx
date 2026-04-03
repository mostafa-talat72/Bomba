import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Search, X } from 'lucide-react';
import { languages } from '../i18n/config';

const LanguageSwitcherAuth: React.FC = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  // Filter languages based on search query
  const filteredLanguages = languages.filter(lang => 
    lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    setSearchQuery('');
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

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
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
        <div className={`absolute top-full mt-2 ${isRTL ? 'left-0' : 'right-0'} w-80 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 overflow-hidden z-50 animate-fadeIn`}>
          {/* Search Box */}
          <div className="p-3 border-b border-gray-200 bg-white/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search languages..."
                className="w-full pl-10 pr-8 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Languages List with Scroll */}
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {filteredLanguages.length > 0 ? (
              filteredLanguages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => handleLanguageChange(language.code)}
                  className={`w-full px-4 py-3 ${language.dir === 'rtl' ? 'text-right' : 'text-left'} flex items-center gap-3 transition-colors ${
                    currentLanguage.code === language.code
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  } ${language.dir === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}
                  dir={language.dir}
                >
                  <span className="text-2xl flex-shrink-0">{language.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{language.nativeName}</div>
                    <div className="text-xs text-gray-500 truncate">{language.name}</div>
                  </div>
                  {currentLanguage.code === language.code && (
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No languages found</p>
              </div>
            )}
          </div>

          {/* Footer with count */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 text-center">
            {filteredLanguages.length} of {languages.length} languages
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
    </div>
  );
};

export default LanguageSwitcherAuth;
