import React, { useState, useEffect, useRef } from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { languages } from '../i18n/config';

const LanguageSwitcherBillView: React.FC = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [localLanguage, setLocalLanguage] = useState(localStorage.getItem('billViewLanguage') || 'ar');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set initial language from localStorage
    const savedLang = localStorage.getItem('billViewLanguage') || 'ar';
    if (i18n.language !== savedLang) {
      i18n.changeLanguage(savedLang);
    }
    setLocalLanguage(savedLang);
    
    // Apply direction
    const language = languages.find(l => l.code === savedLang);
    if (language) {
      document.documentElement.dir = language.dir;
      document.documentElement.lang = savedLang;
      document.body.dir = language.dir;
    }
  }, []);

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

  const handleLanguageChange = async (langCode: string) => {
    try {
      await i18n.changeLanguage(langCode);
      setLocalLanguage(langCode);
      
      const language = languages.find(l => l.code === langCode);
      if (language) {
        document.documentElement.dir = language.dir;
        document.documentElement.lang = langCode;
        document.body.dir = language.dir;
        
        // Save to localStorage for BillView only
        localStorage.setItem('billViewLanguage', langCode);
      }
      
      setIsOpen(false);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  const currentLanguage = languages.find(l => l.code === localLanguage);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        aria-label="Change language"
      >
        <Globe className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {currentLanguage?.flag} {currentLanguage?.name}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[150px] z-50">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`w-full text-right px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                localLanguage === lang.code
                  ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-medium'
                  : 'text-gray-700 dark:text-gray-200'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
              {localLanguage === lang.code && (
                <span className="mr-auto text-orange-600 dark:text-orange-400">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcherBillView;
