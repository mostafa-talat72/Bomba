import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
import { formatDateInTimezone } from '../utils/timezoneHelper';

interface OrganizationContextType {
  currency: string;
  timezone: string;
  setCurrency: (currency: string) => void;
  setTimezone: (timezone: string) => void;
  formatCurrency: (amount: number) => string;
  getCurrencySymbol: (language?: string) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (date: Date | string) => string;
  formatTime: (date: Date | string) => string;
  refreshOrganizationSettings: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<string>('EGP');
  const [timezone, setTimezoneState] = useState<string>('Africa/Cairo');

  // Load organization settings on mount
  useEffect(() => {
    loadOrganizationSettings();
  }, []);

  const loadOrganizationSettings = async () => {
    try {
      // Try to load from localStorage first (faster)
      const savedCurrency = localStorage.getItem('organizationCurrency');
      const savedTimezone = localStorage.getItem('organizationTimezone');
      
      
      if (savedCurrency) setCurrencyState(savedCurrency);
      if (savedTimezone) setTimezoneState(savedTimezone);

      // Then load from database to ensure sync
      const token = localStorage.getItem('token');
      if (token) {
        const response = await api.getOrganization();
        if (response.success && response.data) {
          const { currency: dbCurrency, timezone: dbTimezone } = response.data;
          
          
          if (dbCurrency) {
            setCurrencyState(dbCurrency);
            localStorage.setItem('organizationCurrency', dbCurrency);
          }
          
          if (dbTimezone) {
            setTimezoneState(dbTimezone);
            localStorage.setItem('organizationTimezone', dbTimezone);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load organization settings:', error);
    }
  };

  const refreshOrganizationSettings = async () => {
    await loadOrganizationSettings();
  };

  const setCurrency = (newCurrency: string) => {
    setCurrencyState(newCurrency);
    localStorage.setItem('organizationCurrency', newCurrency);
  };

  const setTimezone = (newTimezone: string) => {
    setTimezoneState(newTimezone);
    localStorage.setItem('organizationTimezone', newTimezone);
  };

  const getCurrencySymbol = (language?: string): string => {
    // Get current language from localStorage if not provided
    const currentLang = language || localStorage.getItem('i18nextLng') || 'ar';
    
    const symbols: { [key: string]: { [lang: string]: string } } = {
      'EGP': {
        'ar': 'ج.م',
        'en': 'EGP',
        'fr': 'EGP'
      },
      'SAR': {
        'ar': 'ر.س',
        'en': 'SAR',
        'fr': 'SAR'
      },
      'AED': {
        'ar': 'د.إ',
        'en': 'AED',
        'fr': 'AED'
      },
      'USD': {
        'ar': '$',
        'en': '$',
        'fr': '$'
      },
      'EUR': {
        'ar': '€',
        'en': '€',
        'fr': '€'
      },
      'GBP': {
        'ar': '£',
        'en': '£',
        'fr': '£'
      }
    };
    
    return symbols[currency]?.[currentLang] || currency;
  };

  const formatCurrency = (amount: number): string => {
    const currentLang = localStorage.getItem('i18nextLng') || 'ar';
    const symbol = getCurrencySymbol(currentLang);
    const formatted = new Intl.NumberFormat('ar-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    
    // Always show number on left, currency on right
    return `${formatted} ${symbol}`;
  };

  const formatDate = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
    const currentLang = localStorage.getItem('i18nextLng') || 'ar';
    const locale = currentLang === 'ar' ? 'ar-EG' : currentLang === 'fr' ? 'fr-FR' : 'en-US';
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options
    };
    
    return formatDateInTimezone(date, timezone, locale, defaultOptions);
  };

  const formatDateTime = (date: Date | string): string => {
    const currentLang = localStorage.getItem('i18nextLng') || 'ar';
    const locale = currentLang === 'ar' ? 'ar-EG' : currentLang === 'fr' ? 'fr-FR' : 'en-US';
    
    
    const result = formatDateInTimezone(date, timezone, locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    
    return result;
  };

  const formatTime = (date: Date | string): string => {
    const currentLang = localStorage.getItem('i18nextLng') || 'ar';
    const locale = currentLang === 'ar' ? 'ar-EG' : currentLang === 'fr' ? 'fr-FR' : 'en-US';
    
    return formatDateInTimezone(date, timezone, locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <OrganizationContext.Provider
      value={{
        currency,
        timezone,
        setCurrency,
        setTimezone,
        formatCurrency,
        getCurrencySymbol,
        formatDate,
        formatDateTime,
        formatTime,
        refreshOrganizationSettings,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
