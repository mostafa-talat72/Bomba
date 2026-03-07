import { ar } from 'date-fns/locale/ar';
import { enUS } from 'date-fns/locale/en-US';
import { fr } from 'date-fns/locale/fr';

/**
 * Get user's locale string for date formatting
 * @param {Object} user - User object with preferences
 * @returns {string} Locale string (ar-EG, en-US, fr-FR)
 */
export const getUserLocale = (user) => {
    const language = user?.preferences?.language || 'ar';
    switch(language) {
        case 'ar': return 'ar-EG';
        case 'en': return 'en-US';
        case 'fr': return 'fr-FR';
        default: return 'ar-EG';
    }
};

/**
 * Get date-fns locale object for formatting
 * @param {Object} user - User object with preferences
 * @returns {Object} date-fns locale object
 */
export const getDateFnsLocale = (user) => {
    const language = user?.preferences?.language || 'ar';
    switch(language) {
        case 'ar': return ar;
        case 'en': return enUS;
        case 'fr': return fr;
        default: return ar;
    }
};

/**
 * Check if user's language is RTL
 * @param {Object} user - User object with preferences
 * @returns {boolean} True if RTL, false otherwise
 */
export const isRTL = (user) => {
    const language = user?.preferences?.language || 'ar';
    return language === 'ar';
};

/**
 * Get language code from user
 * @param {Object} user - User object with preferences
 * @returns {string} Language code (ar, en, fr)
 */
export const getUserLanguage = (user) => {
    return user?.preferences?.language || 'ar';
};

/**
 * Get language from request (for public pages)
 * Priority: query param > cookie > Accept-Language header > default
 * @param {Object} req - Express request object
 * @returns {string} Language code (ar, en, fr)
 */
export const getLanguageFromRequest = (req) => {
    // 1. Check query parameter
    if (req.query.lang && ['ar', 'en', 'fr'].includes(req.query.lang)) {
        return req.query.lang;
    }
    
    // 2. Check cookie
    if (req.cookies?.language && ['ar', 'en', 'fr'].includes(req.cookies.language)) {
        return req.cookies.language;
    }
    
    // 3. Check Accept-Language header
    const acceptLanguage = req.headers['accept-language'];
    if (acceptLanguage) {
        if (acceptLanguage.includes('ar')) return 'ar';
        if (acceptLanguage.includes('fr')) return 'fr';
        if (acceptLanguage.includes('en')) return 'en';
    }
    
    // 4. Default to Arabic
    return 'ar';
};

/**
 * Get locale string from language code
 * @param {string} language - Language code (ar, en, fr)
 * @returns {string} Locale string (ar-EG, en-US, fr-FR)
 */
export const getLocaleFromLanguage = (language) => {
    switch(language) {
        case 'ar': return 'ar-EG';
        case 'en': return 'en-US';
        case 'fr': return 'fr-FR';
        default: return 'ar-EG';
    }
};

/**
 * Get date-fns locale from language code
 * @param {string} language - Language code (ar, en, fr)
 * @returns {Object} date-fns locale object
 */
export const getDateFnsLocaleFromLanguage = (language) => {
    switch(language) {
        case 'ar': return ar;
        case 'en': return enUS;
        case 'fr': return fr;
        default: return ar;
    }
};

/**
 * Check if language is RTL
 * @param {string} language - Language code (ar, en, fr)
 * @returns {boolean} True if RTL, false otherwise
 */
export const isLanguageRTL = (language) => {
    return language === 'ar';
};

/**
 * Get currency symbol based on currency code and language
 * @param {string} currencyCode - Currency code (EGP, SAR, AED, USD, EUR, GBP)
 * @param {string} language - Language code (ar, en, fr)
 * @returns {string} Currency symbol
 */
export const getCurrencySymbol = (currencyCode, language = 'ar') => {
    const symbols = {
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
    
    return symbols[currencyCode]?.[language] || currencyCode;
};
