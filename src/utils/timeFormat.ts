/**
 * Time formatting utilities with proper AM/PM translation support
 */
import dayjs, { Dayjs } from 'dayjs';
import i18n from '../i18n/config';

/**
 * Convert English numbers to Arabic numbers
 */
const convertToArabicNumbers = (str: string): string => {
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[0-9]/g, (match) => arabicNumbers[parseInt(match)]);
};

/**
 * Get translated AM/PM labels
 */
export const getTimeLabels = () => {
  return {
    am: i18n.t('reports.timeLabels.am'),
    pm: i18n.t('reports.timeLabels.pm'),
    at: i18n.t('reports.timeLabels.at')
  };
};

/**
 * Format time with translated AM/PM
 * @param date - Dayjs object or date string
 * @param format - Format string (use 'a' for am/pm)
 * @returns Formatted time string with translated AM/PM
 */
export const formatTimeWithTranslation = (date: Dayjs | string, format: string = 'hh:mm a'): string => {
  const dayjsDate = typeof date === 'string' ? dayjs(date) : date;
  const labels = getTimeLabels();
  
  // Format the date
  let formatted = dayjsDate.locale(i18n.language).format(format);
  
  // Replace AM/PM with translated versions
  formatted = formatted
    .replace(/AM/gi, labels.am)
    .replace(/PM/gi, labels.pm);
  
  // Convert to Arabic numbers if language is Arabic
  if (i18n.language === 'ar') {
    formatted = convertToArabicNumbers(formatted);
  }
  
  return formatted;
};

/**
 * Format date and time with translated AM/PM
 * @param date - Dayjs object or date string
 * @param includeTime - Whether to include time
 * @returns Formatted date/time string
 */
export const formatDateTime = (
  date: Dayjs | string,
  includeTime: boolean = true
): string => {
  const dayjsDate = typeof date === 'string' ? dayjs(date) : date;
  const labels = getTimeLabels();
  
  if (includeTime) {
    let formatted = dayjsDate
      .locale(i18n.language)
      .format(`DD/MM/YYYY - hh:mm A`);
    
    // Replace AM/PM with translated versions
    formatted = formatted
      .replace(/AM/gi, labels.am)
      .replace(/PM/gi, labels.pm);
    
    // Convert to Arabic numbers if language is Arabic
    if (i18n.language === 'ar') {
      formatted = convertToArabicNumbers(formatted);
    }
    
    return formatted;
  }
  
  let formatted = dayjsDate.locale(i18n.language).format('DD/MM/YYYY');
  
  // Convert to Arabic numbers if language is Arabic
  if (i18n.language === 'ar') {
    formatted = convertToArabicNumbers(formatted);
  }
  
  return formatted;
};

/**
 * Format date range with translated AM/PM
 */
export const formatDateRange = (
  startDate: Dayjs,
  endDate: Dayjs,
  includeTime: boolean = true
): string => {
  const labels = getTimeLabels();
  
  if (includeTime) {
    let startFormatted = startDate
      .locale(i18n.language)
      .format(`dddd، D MMMM YYYY [${labels.at}] hh:mm A`);
    
    let endFormatted = endDate
      .locale(i18n.language)
      .format(`dddd، D MMMM YYYY [${labels.at}] hh:mm A`);
    
    // Replace AM/PM with translated versions
    startFormatted = startFormatted
      .replace(/AM/gi, labels.am)
      .replace(/PM/gi, labels.pm);
    
    endFormatted = endFormatted
      .replace(/AM/gi, labels.am)
      .replace(/PM/gi, labels.pm);
    
    // Convert to Arabic numbers if language is Arabic
    if (i18n.language === 'ar') {
      startFormatted = convertToArabicNumbers(startFormatted);
      endFormatted = convertToArabicNumbers(endFormatted);
    }
    
    return `${startFormatted} - ${endFormatted}`;
  }
  
  let startFormatted = startDate.locale(i18n.language).format('DD/MM/YYYY');
  let endFormatted = endDate.locale(i18n.language).format('DD/MM/YYYY');
  
  // Convert to Arabic numbers if language is Arabic
  if (i18n.language === 'ar') {
    startFormatted = convertToArabicNumbers(startFormatted);
    endFormatted = convertToArabicNumbers(endFormatted);
  }
  
  return `${startFormatted} - ${endFormatted}`;
};

/**
 * Get TimePicker format string with translated AM/PM
 * This is used for Ant Design TimePicker component
 */
export const getTimePickerFormat = (): string => {
  // Return format without 'A' since we'll handle translation in display
  return 'hh:mm a';
};
