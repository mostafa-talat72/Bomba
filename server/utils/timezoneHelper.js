/**
 * Timezone helper utilities
 */

// قائمة المناطق الزمنية المدعومة
export const supportedTimezones = [
    // Africa
    { value: 'Africa/Cairo', label: 'القاهرة (GMT+2)', labelEn: 'Cairo (GMT+2)', labelFr: 'Le Caire (GMT+2)', offset: '+02:00' },
    { value: 'Africa/Casablanca', label: 'الدار البيضاء (GMT+1)', labelEn: 'Casablanca (GMT+1)', labelFr: 'Casablanca (GMT+1)', offset: '+01:00' },
    { value: 'Africa/Tunis', label: 'تونس (GMT+1)', labelEn: 'Tunis (GMT+1)', labelFr: 'Tunis (GMT+1)', offset: '+01:00' },
    { value: 'Africa/Algiers', label: 'الجزائر (GMT+1)', labelEn: 'Algiers (GMT+1)', labelFr: 'Alger (GMT+1)', offset: '+01:00' },
    { value: 'Africa/Tripoli', label: 'طرابلس (GMT+2)', labelEn: 'Tripoli (GMT+2)', labelFr: 'Tripoli (GMT+2)', offset: '+02:00' },
    
    // Middle East
    { value: 'Asia/Riyadh', label: 'الرياض (GMT+3)', labelEn: 'Riyadh (GMT+3)', labelFr: 'Riyad (GMT+3)', offset: '+03:00' },
    { value: 'Asia/Dubai', label: 'دبي (GMT+4)', labelEn: 'Dubai (GMT+4)', labelFr: 'Dubaï (GMT+4)', offset: '+04:00' },
    { value: 'Asia/Kuwait', label: 'الكويت (GMT+3)', labelEn: 'Kuwait (GMT+3)', labelFr: 'Koweït (GMT+3)', offset: '+03:00' },
    { value: 'Asia/Bahrain', label: 'البحرين (GMT+3)', labelEn: 'Bahrain (GMT+3)', labelFr: 'Bahreïn (GMT+3)', offset: '+03:00' },
    { value: 'Asia/Qatar', label: 'قطر (GMT+3)', labelEn: 'Qatar (GMT+3)', labelFr: 'Qatar (GMT+3)', offset: '+03:00' },
    { value: 'Asia/Muscat', label: 'مسقط (GMT+4)', labelEn: 'Muscat (GMT+4)', labelFr: 'Mascate (GMT+4)', offset: '+04:00' },
    { value: 'Asia/Baghdad', label: 'بغداد (GMT+3)', labelEn: 'Baghdad (GMT+3)', labelFr: 'Bagdad (GMT+3)', offset: '+03:00' },
    { value: 'Asia/Damascus', label: 'دمشق (GMT+3)', labelEn: 'Damascus (GMT+3)', labelFr: 'Damas (GMT+3)', offset: '+03:00' },
    { value: 'Asia/Beirut', label: 'بيروت (GMT+3)', labelEn: 'Beirut (GMT+3)', labelFr: 'Beyrouth (GMT+3)', offset: '+03:00' },
    { value: 'Asia/Amman', label: 'عمان (GMT+3)', labelEn: 'Amman (GMT+3)', labelFr: 'Amman (GMT+3)', offset: '+03:00' },
    { value: 'Asia/Jerusalem', label: 'القدس (GMT+3)', labelEn: 'Jerusalem (GMT+3)', labelFr: 'Jérusalem (GMT+3)', offset: '+03:00' },
    
    // Europe
    { value: 'Europe/London', label: 'لندن (GMT+0)', labelEn: 'London (GMT+0)', labelFr: 'Londres (GMT+0)', offset: '+00:00' },
    { value: 'Europe/Paris', label: 'باريس (GMT+1)', labelEn: 'Paris (GMT+1)', labelFr: 'Paris (GMT+1)', offset: '+01:00' },
    { value: 'Europe/Berlin', label: 'برلين (GMT+1)', labelEn: 'Berlin (GMT+1)', labelFr: 'Berlin (GMT+1)', offset: '+01:00' },
    { value: 'Europe/Rome', label: 'روما (GMT+1)', labelEn: 'Rome (GMT+1)', labelFr: 'Rome (GMT+1)', offset: '+01:00' },
    { value: 'Europe/Madrid', label: 'مدريد (GMT+1)', labelEn: 'Madrid (GMT+1)', labelFr: 'Madrid (GMT+1)', offset: '+01:00' },
    { value: 'Europe/Istanbul', label: 'إسطنبول (GMT+3)', labelEn: 'Istanbul (GMT+3)', labelFr: 'Istanbul (GMT+3)', offset: '+03:00' },
    
    // Americas
    { value: 'America/New_York', label: 'نيويورك (GMT-5)', labelEn: 'New York (GMT-5)', labelFr: 'New York (GMT-5)', offset: '-05:00' },
    { value: 'America/Los_Angeles', label: 'لوس أنجلوس (GMT-8)', labelEn: 'Los Angeles (GMT-8)', labelFr: 'Los Angeles (GMT-8)', offset: '-08:00' },
    { value: 'America/Chicago', label: 'شيكاغو (GMT-6)', labelEn: 'Chicago (GMT-6)', labelFr: 'Chicago (GMT-6)', offset: '-06:00' },
    
    // Asia
    { value: 'Asia/Tokyo', label: 'طوكيو (GMT+9)', labelEn: 'Tokyo (GMT+9)', labelFr: 'Tokyo (GMT+9)', offset: '+09:00' },
    { value: 'Asia/Shanghai', label: 'شنغهاي (GMT+8)', labelEn: 'Shanghai (GMT+8)', labelFr: 'Shanghai (GMT+8)', offset: '+08:00' },
    { value: 'Asia/Singapore', label: 'سنغافورة (GMT+8)', labelEn: 'Singapore (GMT+8)', labelFr: 'Singapour (GMT+8)', offset: '+08:00' },
    { value: 'Asia/Kolkata', label: 'كولكاتا (GMT+5:30)', labelEn: 'Kolkata (GMT+5:30)', labelFr: 'Calcutta (GMT+5:30)', offset: '+05:30' },
    
    // Australia
    { value: 'Australia/Sydney', label: 'سيدني (GMT+10)', labelEn: 'Sydney (GMT+10)', labelFr: 'Sydney (GMT+10)', offset: '+10:00' },
];

/**
 * Get timezone label by language
 * @param {string} timezone - Timezone value
 * @param {string} language - Language code (ar, en, fr)
 * @returns {string} Timezone label
 */
export const getTimezoneLabel = (timezone, language = 'ar') => {
    const tz = supportedTimezones.find(t => t.value === timezone);
    if (!tz) return timezone;
    
    switch (language) {
        case 'en':
            return tz.labelEn;
        case 'fr':
            return tz.labelFr;
        default:
            return tz.label;
    }
};

/**
 * Convert date to organization timezone
 * @param {Date|string} date - Date to convert
 * @param {string} timezone - Target timezone
 * @returns {Date} Converted date
 */
export const convertToTimezone = (date, timezone = 'Africa/Cairo') => {
    try {
        const dateObj = new Date(date);
        return new Date(dateObj.toLocaleString('en-US', { timeZone: timezone }));
    } catch (error) {
        console.error('Error converting timezone:', error);
        return new Date(date);
    }
};

/**
 * Get current time in organization timezone
 * @param {string} timezone - Organization timezone
 * @returns {Date} Current time in timezone
 */
export const getCurrentTimeInTimezone = (timezone = 'Africa/Cairo') => {
    return convertToTimezone(new Date(), timezone);
};

/**
 * Format date in organization timezone
 * @param {Date|string} date - Date to format
 * @param {string} timezone - Organization timezone
 * @param {string} locale - Locale for formatting
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDateInTimezone = (date, timezone = 'Africa/Cairo', locale = 'ar-EG', options = {}) => {
    try {
        const dateObj = new Date(date);
        return dateObj.toLocaleString(locale, {
            timeZone: timezone,
            ...options
        });
    } catch (error) {
        console.error('Error formatting date in timezone:', error);
        return new Date(date).toLocaleString(locale);
    }
};

/**
 * Get start and end of day in organization timezone
 * @param {Date|string} date - Date
 * @param {string} timezone - Organization timezone
 * @returns {object} { startOfDay, endOfDay }
 */
export const getDayBoundariesInTimezone = (date, timezone = 'Africa/Cairo') => {
    try {
        const dateObj = new Date(date);
        
        // Get the date string in the target timezone
        const dateString = dateObj.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD format
        
        // Create start of day (00:00:00) in target timezone
        const startOfDayString = `${dateString}T00:00:00`;
        const startOfDay = new Date(new Date(startOfDayString).toLocaleString('en-US', { timeZone: timezone }));
        
        // Create end of day (23:59:59.999) in target timezone
        const endOfDayString = `${dateString}T23:59:59.999`;
        const endOfDay = new Date(new Date(endOfDayString).toLocaleString('en-US', { timeZone: timezone }));
        
        return { startOfDay, endOfDay };
    } catch (error) {
        console.error('Error getting day boundaries:', error);
        const dateObj = new Date(date);
        return {
            startOfDay: new Date(dateObj.setHours(0, 0, 0, 0)),
            endOfDay: new Date(dateObj.setHours(23, 59, 59, 999))
        };
    }
};
