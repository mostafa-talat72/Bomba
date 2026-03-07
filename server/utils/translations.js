/**
 * Translation helper for backend
 * Provides translations for common strings used in backend operations
 */

const translations = {
    ar: {
        customer: 'عميل',
        table: 'طاولة',
        playstationCustomer: 'عميل بلايستيشن',
        computerCustomer: 'عميل كمبيوتر',
        sessionBill: 'فاتورة جلسة',
        unlinkedFromTable: 'تم فك الربط من طاولة',
        linkedToTable: 'تم ربط الفاتورة بالطاولة',
        customerNameRequired: 'اسم العميل مطلوب عند فك الربط من الطاولة',
        customerNameRequiredForNonTable: 'اسم العميل مطلوب للجلسات غير المرتبطة بطاولة',
        mergedEmptyBill: 'تم دمج فاتورة فارغة'
    },
    en: {
        customer: 'Customer',
        table: 'Table',
        playstationCustomer: 'PlayStation Customer',
        computerCustomer: 'Computer Customer',
        sessionBill: 'Session Bill',
        unlinkedFromTable: 'Unlinked from table',
        linkedToTable: 'Linked to table',
        customerNameRequired: 'Customer name required when unlinking from table',
        customerNameRequiredForNonTable: 'Customer name required for non-table sessions',
        mergedEmptyBill: 'Merged empty bill'
    },
    fr: {
        customer: 'Client',
        table: 'Table',
        playstationCustomer: 'Client PlayStation',
        computerCustomer: 'Client Ordinateur',
        sessionBill: 'Facture de session',
        unlinkedFromTable: 'Délié de la table',
        linkedToTable: 'Lié à la table',
        customerNameRequired: 'Nom du client requis lors de la dissociation de la table',
        customerNameRequiredForNonTable: 'Nom du client requis pour les sessions sans table',
        mergedEmptyBill: 'Facture vide fusionnée'
    }
};

/**
 * Get translated text
 * @param {string} key - Translation key
 * @param {string} language - Language code (ar, en, fr)
 * @returns {string} Translated text
 */
export const t = (key, language = 'ar') => {
    const lang = ['ar', 'en', 'fr'].includes(language) ? language : 'ar';
    return translations[lang][key] || translations['ar'][key] || key;
};

/**
 * Get customer name for bill based on device type and language
 * @param {string} deviceType - Device type (playstation, computer, etc.)
 * @param {string} deviceName - Device name
 * @param {string} language - Language code (ar, en, fr)
 * @returns {string} Customer name
 */
export const getCustomerNameForDevice = (deviceType, deviceName, language = 'ar') => {
    const lang = ['ar', 'en', 'fr'].includes(language) ? language : 'ar';
    
    if (deviceType === 'playstation') {
        return `${t('playstationCustomer', lang)} ${deviceName}`;
    } else if (deviceType === 'computer') {
        return `${t('computerCustomer', lang)} ${deviceName}`;
    } else {
        return `${t('customer', lang)} (${deviceName})`;
    }
};

/**
 * Get table name based on language
 * @param {string|number} tableNumber - Table number
 * @param {string} language - Language code (ar, en, fr)
 * @returns {string} Table name
 */
export const getTableName = (tableNumber, language = 'ar') => {
    const lang = ['ar', 'en', 'fr'].includes(language) ? language : 'ar';
    return `${t('table', lang)} ${tableNumber}`;
};

/**
 * Get session bill note based on language
 * @param {string} deviceName - Device name
 * @param {string} deviceType - Device type
 * @param {string|number} tableNumber - Table number
 * @param {string} language - Language code (ar, en, fr)
 * @returns {string} Bill note
 */
export const getSessionBillNote = (deviceName, deviceType, tableNumber, language = 'ar') => {
    const lang = ['ar', 'en', 'fr'].includes(language) ? language : 'ar';
    return `${t('sessionBill', lang)} ${deviceName} - ${deviceType} (${t('unlinkedFromTable', lang)} ${tableNumber})`;
};

/**
 * Get bill note for new session (with or without table)
 * @param {string} tableName - Table name or device name
 * @param {string} deviceType - Device type
 * @param {string|number} tableNumber - Table number (optional)
 * @param {string} language - Language code (ar, en, fr)
 * @returns {string} Bill note
 */
export const getNewSessionBillNote = (tableName, deviceType, tableNumber, language = 'ar') => {
    const lang = ['ar', 'en', 'fr'].includes(language) ? language : 'ar';
    if (tableNumber) {
        return `${t('sessionBill', lang)} ${tableName} - ${deviceType} (${t('table', lang)} ${tableNumber})`;
    } else {
        return `${t('sessionBill', lang)} ${tableName} - ${deviceType}`;
    }
};

export default {
    t,
    getCustomerNameForDevice,
    getTableName,
    getSessionBillNote,
    getNewSessionBillNote
};
