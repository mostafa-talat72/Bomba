/**
 * Date formatting utilities with timezone support
 */

/**
 * Format date with organization timezone
 */
export const formatDateWithTimezone = (
  date: Date | string,
  language: string = 'ar',
  timezone: string = 'Africa/Cairo',
  options?: Intl.DateTimeFormatOptions
): string => {
  try {
    const dateObj = new Date(date);
    const locale = language === 'ar' ? 'ar-EG' : language === 'fr' ? 'fr-FR' : 'en-US';
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options
    };
    
    return dateObj.toLocaleString(locale, {
      timeZone: timezone,
      ...defaultOptions
    });
  } catch (error) {
    console.error('Error formatting date with timezone:', error);
    return new Date(date).toLocaleString();
  }
};

/**
 * Format date and time with organization timezone
 */
export const formatDateTimeWithTimezone = (
  date: Date | string,
  language: string = 'ar',
  timezone: string = 'Africa/Cairo'
): string => {
  return formatDateWithTimezone(date, language, timezone, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Format time only with organization timezone
 */
export const formatTimeWithTimezone = (
  date: Date | string,
  language: string = 'ar',
  timezone: string = 'Africa/Cairo'
): string => {
  return formatDateWithTimezone(date, language, timezone, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Format date only (no time) with organization timezone
 */
export const formatDateOnlyWithTimezone = (
  date: Date | string,
  language: string = 'ar',
  timezone: string = 'Africa/Cairo'
): string => {
  return formatDateWithTimezone(date, language, timezone, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Format short date with organization timezone
 */
export const formatShortDateWithTimezone = (
  date: Date | string,
  language: string = 'ar',
  timezone: string = 'Africa/Cairo'
): string => {
  return formatDateWithTimezone(date, language, timezone, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Get current date/time in organization timezone
 */
export const getCurrentTimeInTimezone = (timezone: string = 'Africa/Cairo'): Date => {
  try {
    const now = new Date();
    const timeString = now.toLocaleString('en-US', { timeZone: timezone });
    return new Date(timeString);
  } catch (error) {
    console.error('Error getting current time in timezone:', error);
    return new Date();
  }
};
