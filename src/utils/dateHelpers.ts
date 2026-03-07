import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import 'dayjs/locale/fr';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Get organization timezone from localStorage
 */
export const getOrgTimezone = (): string => {
  return localStorage.getItem('organizationTimezone') || 'Africa/Cairo';
};

/**
 * Format date in organization timezone
 */
export const formatDateInOrgTz = (
  date: Date | string | number | dayjs.Dayjs | null | undefined,
  format: string = 'YYYY-MM-DD HH:mm:ss',
  locale: string = 'ar'
): string => {
  if (!date) return '';
  
  const tz = getOrgTimezone();
  return dayjs(date).tz(tz).locale(locale).format(format);
};

/**
 * Get current time in organization timezone
 */
export const nowInOrgTz = (): dayjs.Dayjs => {
  const tz = getOrgTimezone();
  return dayjs().tz(tz);
};

/**
 * Convert date to organization timezone
 */
export const toOrgTz = (date: Date | string | number | dayjs.Dayjs): dayjs.Dayjs => {
  const tz = getOrgTimezone();
  return dayjs(date).tz(tz);
};

/**
 * Parse date string in organization timezone
 */
export const parseInOrgTz = (dateString: string, format?: string): dayjs.Dayjs => {
  const tz = getOrgTimezone();
  return format 
    ? dayjs.tz(dateString, format, tz)
    : dayjs.tz(dateString, tz);
};

/**
 * Get start of day in organization timezone
 */
export const startOfDayInOrgTz = (date?: Date | string | number | dayjs.Dayjs): dayjs.Dayjs => {
  const tz = getOrgTimezone();
  if (!date) return dayjs().tz(tz).startOf('day');
  return dayjs(date).tz(tz).startOf('day');
};

/**
 * Get end of day in organization timezone
 */
export const endOfDayInOrgTz = (date?: Date | string | number | dayjs.Dayjs): dayjs.Dayjs => {
  const tz = getOrgTimezone();
  if (!date) return dayjs().tz(tz).endOf('day');
  return dayjs(date).tz(tz).endOf('day');
};

/**
 * Format date for display (short format)
 */
export const formatDateShort = (
  date: Date | string | number | dayjs.Dayjs | null | undefined,
  locale: string = 'ar'
): string => {
  return formatDateInOrgTz(date, 'DD/MM/YYYY', locale);
};

/**
 * Format date and time for display
 */
export const formatDateTime = (
  date: Date | string | number | dayjs.Dayjs | null | undefined,
  locale: string = 'ar'
): string => {
  return formatDateInOrgTz(date, 'DD/MM/YYYY HH:mm', locale);
};

/**
 * Format time only
 */
export const formatTime = (
  date: Date | string | number | dayjs.Dayjs | null | undefined,
  locale: string = 'ar'
): string => {
  return formatDateInOrgTz(date, 'HH:mm', locale);
};

/**
 * Format date for API (ISO format in org timezone)
 */
export const formatDateForAPI = (date: Date | string | number | dayjs.Dayjs): string => {
  const tz = getOrgTimezone();
  return dayjs(date).tz(tz).toISOString();
};

/**
 * Get date range for today in organization timezone
 */
export const getTodayRange = (): { start: dayjs.Dayjs; end: dayjs.Dayjs } => {
  return {
    start: startOfDayInOrgTz(),
    end: endOfDayInOrgTz(),
  };
};

/**
 * Get date range for yesterday in organization timezone
 */
export const getYesterdayRange = (): { start: dayjs.Dayjs; end: dayjs.Dayjs } => {
  const yesterday = nowInOrgTz().subtract(1, 'day');
  return {
    start: startOfDayInOrgTz(yesterday),
    end: endOfDayInOrgTz(yesterday),
  };
};

/**
 * Get date range for this week in organization timezone
 */
export const getThisWeekRange = (): { start: dayjs.Dayjs; end: dayjs.Dayjs } => {
  const tz = getOrgTimezone();
  const now = dayjs().tz(tz);
  return {
    start: now.startOf('week'),
    end: now.endOf('week'),
  };
};

/**
 * Get date range for this month in organization timezone
 */
export const getThisMonthRange = (): { start: dayjs.Dayjs; end: dayjs.Dayjs } => {
  const tz = getOrgTimezone();
  const now = dayjs().tz(tz);
  return {
    start: now.startOf('month'),
    end: now.endOf('month'),
  };
};

/**
 * Get date range for this year in organization timezone
 */
export const getThisYearRange = (): { start: dayjs.Dayjs; end: dayjs.Dayjs } => {
  const tz = getOrgTimezone();
  const now = dayjs().tz(tz);
  return {
    start: now.startOf('year'),
    end: now.endOf('year'),
  };
};

/**
 * Check if date is today in organization timezone
 */
export const isToday = (date: Date | string | number | dayjs.Dayjs): boolean => {
  const tz = getOrgTimezone();
  const dateInTz = dayjs(date).tz(tz);
  const todayInTz = dayjs().tz(tz);
  return dateInTz.isSame(todayInTz, 'day');
};

/**
 * Get relative time (e.g., "منذ ساعتين")
 */
export const getRelativeTime = (
  date: Date | string | number | dayjs.Dayjs,
  locale: string = 'ar'
): string => {
  const tz = getOrgTimezone();
  return dayjs(date).tz(tz).locale(locale).fromNow();
};
