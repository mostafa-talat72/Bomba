import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { languages } from '../i18n/config';
import api from '../services/api';

interface LanguageContextType {
  currentLanguage: string;
  changeLanguage: (lang: string, saveToDatabase?: boolean) => Promise<void>;
  languages: typeof languages;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || 'ar');
  const [isRTL, setIsRTL] = useState(true);

  // Listen to i18n language changes
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setCurrentLanguage(lng);
      const language = languages.find(l => l.code === lng);
      if (language) {
        setIsRTL(language.dir === 'rtl');
        
        // Apply direction to document
        document.documentElement.dir = language.dir;
        document.documentElement.lang = lng;
        
        // Check if user is authenticated
        const token = localStorage.getItem('token');
        // For auth pages or not logged in, keep body as ltr
        const isAuthPage = window.location.pathname.match(/^\/(login|register|verify-email|reset-password|email-actions)/);
        document.body.dir = (!token || isAuthPage) ? 'ltr' : language.dir;
        
        // Store in localStorage
        localStorage.setItem('language', lng);
      }
    };

    // Set initial language
    handleLanguageChange(i18n.language);

    // Subscribe to language changes
    i18n.on('languageChanged', handleLanguageChange);

    // Cleanup
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  useEffect(() => {
    const language = languages.find(l => l.code === currentLanguage);
    if (language) {
      setIsRTL(language.dir === 'rtl');
    }
  }, [currentLanguage]);

  const changeLanguage = async (lang: string, saveToDatabase: boolean = true) => {
    try {
      await i18n.changeLanguage(lang);
      setCurrentLanguage(lang);
      
      const language = languages.find(l => l.code === lang);
      if (language) {
        // Apply language and direction to document
        document.documentElement.lang = lang;
        document.documentElement.dir = language.dir;
        
        // Check if user is authenticated
        const token = localStorage.getItem('token');
        // For auth pages or not logged in, keep body as ltr
        const isAuthPage = window.location.pathname.match(/^\/(login|register|verify-email|reset-password|email-actions)/);
        document.body.dir = (!token || isAuthPage) ? 'ltr' : language.dir;
        
        setIsRTL(language.dir === 'rtl');
        
        // Store in localStorage
        localStorage.setItem('language', lang);
        
        // Save to database if requested (default: true)
        if (saveToDatabase) {
          try {
            if (token) {
              await api.updateGeneralSettings({ language: lang });
            }
          } catch (dbError) {
            console.warn('Failed to save language to database:', dbError);
            // Don't throw error, language is still applied locally
          }
        }
      }
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        changeLanguage,
        languages,
        isRTL,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
