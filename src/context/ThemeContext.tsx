import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: (saveToDatabase?: boolean) => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | 'auto', saveToDatabase?: boolean) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // التحقق من التخزين المحلي
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    // التحقق من تفضيل النظام
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // حفظ التفضيل في التخزين المحلي
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));

    // تطبيق الكلاسات على document
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = async (saveToDatabase: boolean = true) => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    
    // Save to database if requested (default: true)
    if (saveToDatabase) {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const theme = newMode ? 'dark' : 'light';
          await api.updateGeneralSettings({ theme });
        }
      } catch (dbError) {
        console.warn('Failed to save theme to database:', dbError);
        // Don't throw error, theme is still applied locally
      }
    }
  };

  const setTheme = async (theme: 'light' | 'dark' | 'auto', saveToDatabase: boolean = true) => {
    let newMode: boolean;
    
    if (theme === 'dark') {
      newMode = true;
    } else if (theme === 'light') {
      newMode = false;
    } else {
      // auto mode: follow system preference
      newMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    setIsDarkMode(newMode);
    
    // Save to database if requested (default: true)
    if (saveToDatabase) {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          await api.updateGeneralSettings({ theme });
        }
      } catch (dbError) {
        console.warn('Failed to save theme to database:', dbError);
        // Don't throw error, theme is still applied locally
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
