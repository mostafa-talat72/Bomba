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

/** عرض الرقم بدون مقطع التاريخ للطباعة فقط (BILL-426D13-260909-001 → BILL-426D13-001).
 *  مثبّت بنهاية السلسلة حتى لا يحذف معرّفاً رقمياً بالخطأ. التخزين لا يتغير. */
/** الرقم الكامل للعرض/الطباعة — يظهر كما هو مخزناً شاملاً التاريخ.
 *  مع الترقيم اليومي (001 كل يوم) لا يجوز إخفاء التاريخ وإلا تكرر الرقم عبر الأيام. */
export const getDisplayNumber = (num: string): string => {
    return num ?? '';
};

/** تقسيم الرقم إلى البادئة + التسلسل اليومي (لتمييز التسلسل في الطباعة).
 *  BILL-C90835-260915-002 → { head: 'BILL-C90835-260915-', seq: '002' } */
export const splitDailySeq = (num: any): { head: string; seq: string } => {
    const s = String(num ?? '').replace(/^#/, '');
    const m = s.match(/^(.*-)(\d+)$/);
    if (m) return { head: m[1], seq: m[2] };
    return { head: '', seq: s };
};

/** الرقم المختصر للكروت (BILL-C90835-260915-002 → C90835-002). التخزين لا يتغير. */
export const getShortBillNumber = (num: any): string => {
    if (num === null || num === undefined) return '';
    const s = String(num).replace(/^#/, '');
    const m = s.match(/^(BILL|ORD|SES|INV)-([^-]+)-(?:\d{6}-)?(\d+)$/i);
    if (m) return `${m[2]}-${m[3]}`;
    return s.replace(/^(BILL|ORD|SES|INV)-/i, '');
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
