import { CURRENCY_SYMBOLS } from '../../shared/currencySymbols.js';
import i18n from '../i18n/config';

/**
 * تحويل الأرقام الإنجليزية إلى العربية
 */
const convertToArabicNumbers = (str: string): string => {
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return str.replace(/[0-9]/g, (match) => arabicNumbers[parseInt(match)]);
};

/**
 * Get translated AM/PM labels from i18n
 */
const getTimeLabels = () => {
    return {
        am: i18n.t('reports.timeLabels.am'),
        pm: i18n.t('reports.timeLabels.pm'),
        at: i18n.t('reports.timeLabels.at')
    };
};

/**
 * Replace AM/PM in formatted time string with translated versions
 */
export const replaceAMPM = (formattedTime: string): string => {
    const labels = getTimeLabels();
    return formattedTime
        .replace(/AM/gi, labels.am)
        .replace(/PM/gi, labels.pm);
};

/**
 * Get currency symbol based on currency code and language
 */
export const getCurrencySymbol = (currencyCode: string, language: string = 'ar'): string => {
    const currencyData = CURRENCY_SYMBOLS[currencyCode];
    if (!currencyData) return currencyCode;
    
    // Try to get symbol for the requested language, fallback to 'en', then 'ar'
    if (language in currencyData) {
        return currencyData[language as keyof typeof currencyData];
    }
    
    // Fallback: try 'en' first, then 'ar'
    return currencyData['en'] || currencyData['ar'] || currencyCode;
};

/**
 * تنسيق الأرقام العشرية - تظهر العلامة العشرية فقط إذا كانت موجودة
 * وإذا كانت موجودة تظهر رقمين فقط بعد العلامة العشرية
 * مع دعم تحويل الأرقام حسب اللغة
 */
export const formatDecimal = (value: number | string | null | undefined, locale: string = 'ar'): string => {
    if (value === null || value === undefined || value === '') {
        return locale === 'ar' ? '٠' : '0';
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numValue)) {
        return locale === 'ar' ? '٠' : '0';
    }

    // تحويل الرقم إلى رقمين عشريين
    const formatted = numValue.toFixed(2);

    // إزالة الأصفار غير الضرورية بعد العلامة العشرية
    const trimmed = formatted.replace(/\.?0+$/, '');

    // تحويل الأرقام إلى العربية إذا كانت اللغة عربية
    return locale === 'ar' ? convertToArabicNumbers(trimmed) : trimmed;
};

/**
 * تنسيق الأرقام العشرية مع إضافة رمز العملة
 * مع دعم تحويل الأرقام حسب اللغة
 * الرقم دائماً على اليسار والعملة على اليمين
 * 
 * @param value - القيمة المراد تنسيقها
 * @param locale - اللغة (ar, en, fr) - default: 'ar'
 * @param currency - رمز العملة (EGP, SAR, AED, USD, EUR, GBP) - إذا لم يتم تحديده، يتم استخدام العملة من localStorage
 */
export const formatCurrency = (
  value: number | string | null | undefined, 
  locale: string = 'ar',
  currency?: string
): string => {
    const formatted = formatDecimal(value, locale);
    
    // Get currency from localStorage if not provided
    // This ensures all currency displays use the organization's currency setting
    const currencyToUse = currency || localStorage.getItem('organizationCurrency') || 'EGP';
    
    // Get currency symbol based on language
    const currencySymbol = getCurrencySymbol(currencyToUse, locale);
    
    // الرقم على اليسار والعملة على اليمين في جميع اللغات
    return `${formatted} ${currencySymbol}`;
};

/**
 * تنسيق الأرقام العشرية مع إضافة وحدة القياس
 * مع دعم تحويل الأرقام حسب اللغة
 */
export const formatQuantity = (value: number | string | null | undefined, unit: string = '', locale: string = 'ar'): string => {
    const formatted = formatDecimal(value, locale);
    return unit ? `${formatted} ${unit}` : formatted;
};
