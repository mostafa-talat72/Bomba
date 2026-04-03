import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Search, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface LanguageSwitcherProps {
  className?: string;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = '' }) => {
  const { i18n, t } = useTranslation();
  const { changeLanguage, languages: availableLanguages } = useLanguage();
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentLanguage = availableLanguages.find(lang => lang.code === i18n.language) || availableLanguages[0];

  // Filter languages based on search query
  const filteredLanguages = availableLanguages.filter(lang => 
    lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.nativeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLanguageChange = async (langCode: string) => {
    await changeLanguage(langCode, true);
    setIsOpen(false);
    setSearchQuery('');
  };

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

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-all duration-200 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600"
        title={t('auth.changeLanguage')}
      >
        <Globe className="w-5 h-5" />
        <span className="text-sm font-medium hidden sm:inline">{currentLanguage.flag} {currentLanguage.name}</span>
        <span className="text-lg sm:hidden">{currentLanguage.flag}</span>
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-fadeIn">
          {/* Search Box */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('auth.searchLanguages') || 'Search languages...'}
                className="w-full pl-10 pr-8 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Languages List with Scroll */}
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {filteredLanguages.length > 0 ? (
              filteredLanguages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full px-4 py-3 ${lang.dir === 'rtl' ? 'text-right' : 'text-left'} hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 ${
                    i18n.language === lang.code ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                  } ${lang.dir === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}
                  dir={lang.dir}
                >
                  <span className="text-2xl flex-shrink-0">{lang.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{lang.nativeName || lang.name}</div>
                    {lang.nativeName && lang.nativeName !== lang.name && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{lang.name}</div>
                    )}
                  </div>
                  {i18n.language === lang.code && (
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('auth.noLanguagesFound') || 'No languages found'}</p>
              </div>
            )}
          </div>

          {/* Footer with count */}
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 text-center">
            {filteredLanguages.length} {t('auth.of') || 'of'} {availableLanguages.length} {t('auth.languages') || 'languages'}
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.3);
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
};

export default LanguageSwitcher;
