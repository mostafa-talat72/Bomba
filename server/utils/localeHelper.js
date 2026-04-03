import { getCurrencySymbol as getCurrencySymbolShared } from '../../shared/currencySymbols.js';
import { ar } from 'date-fns/locale/ar';
import { enUS } from 'date-fns/locale/en-US';
import { fr } from 'date-fns/locale/fr';

/**
 * Get currency symbol based on currency code and language
 * Re-export from shared module for convenience
 */
export const getCurrencySymbol = getCurrencySymbolShared;

/**
 * Get user's locale string for date formatting
 * @param {Object} user - User object with preferences
 * @returns {string} Locale string (ar-EG, en-US, fr-FR, he-IL, etc.)
 */
export const getUserLocale = (user) => {
    const language = user?.preferences?.language || 'ar';
    
    // Map common languages to their locales
    const localeMap = {
        'ar': 'ar-EG',
        'en': 'en-US',
        'fr': 'fr-FR',
        'he': 'he-IL',  // Hebrew
        'es': 'es-ES',  // Spanish
        'de': 'de-DE',  // German
        'it': 'it-IT',  // Italian
        'pt': 'pt-PT',  // Portuguese
        'ru': 'ru-RU',  // Russian
        'zh': 'zh-CN',  // Chinese
        'ja': 'ja-JP',  // Japanese
        'ko': 'ko-KR',  // Korean
        'tr': 'tr-TR',  // Turkish
        'nl': 'nl-NL',  // Dutch
        'pl': 'pl-PL',  // Polish
        'sv': 'sv-SE',  // Swedish
        'da': 'da-DK',  // Danish
        'no': 'no-NO',  // Norwegian
        'fi': 'fi-FI',  // Finnish
        'cs': 'cs-CZ',  // Czech
        'hu': 'hu-HU',  // Hungarian
        'ro': 'ro-RO',  // Romanian
        'uk': 'uk-UA',  // Ukrainian
        'el': 'el-GR',  // Greek
        'th': 'th-TH',  // Thai
        'vi': 'vi-VN',  // Vietnamese
        'id': 'id-ID',  // Indonesian
        'ms': 'ms-MY',  // Malay
        'hi': 'hi-IN',  // Hindi
        'bn': 'bn-BD',  // Bengali
        'ur': 'ur-PK',  // Urdu
        'fa': 'fa-IR',  // Persian
    };
    
    // Return mapped locale or default to en-US for unknown languages
    // This ensures numbers display in Western format for non-Arabic languages
    return localeMap[language] || 'en-US';
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
    // List of RTL languages
    const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'yi', 'iw'];
    return rtlLanguages.includes(language);
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
 * @param {string} language - Language code (ar, en, fr, he, etc.)
 * @returns {string} Locale string (ar-EG, en-US, fr-FR, he-IL, etc.)
 */
export const getLocaleFromLanguage = (language) => {
    // Map common languages to their locales
    const localeMap = {
        'ar': 'ar-EG',
        'en': 'en-US',
        'fr': 'fr-FR',
        'he': 'he-IL',  // Hebrew
        'es': 'es-ES',  // Spanish
        'de': 'de-DE',  // German
        'it': 'it-IT',  // Italian
        'pt': 'pt-PT',  // Portuguese
        'ru': 'ru-RU',  // Russian
        'zh': 'zh-CN',  // Chinese
        'ja': 'ja-JP',  // Japanese
        'ko': 'ko-KR',  // Korean
        'tr': 'tr-TR',  // Turkish
        'nl': 'nl-NL',  // Dutch
        'pl': 'pl-PL',  // Polish
        'sv': 'sv-SE',  // Swedish
        'da': 'da-DK',  // Danish
        'no': 'no-NO',  // Norwegian
        'fi': 'fi-FI',  // Finnish
        'cs': 'cs-CZ',  // Czech
        'hu': 'hu-HU',  // Hungarian
        'ro': 'ro-RO',  // Romanian
        'uk': 'uk-UA',  // Ukrainian
        'el': 'el-GR',  // Greek
        'th': 'th-TH',  // Thai
        'vi': 'vi-VN',  // Vietnamese
        'id': 'id-ID',  // Indonesian
        'ms': 'ms-MY',  // Malay
        'hi': 'hi-IN',  // Hindi
        'bn': 'bn-BD',  // Bengali
        'ur': 'ur-PK',  // Urdu
        'fa': 'fa-IR',  // Persian
    };
    
    // Return mapped locale or default to en-US for unknown languages
    return localeMap[language] || 'en-US';
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
 * @param {string} language - Language code (ar, he, fa, ur, etc.)
 * @returns {boolean} True if RTL, false otherwise
 */
export const isLanguageRTL = (language) => {
    // List of RTL languages
    const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'yi', 'iw'];
    return rtlLanguages.includes(language);
};
