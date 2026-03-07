import { useOrganization } from '../context/OrganizationContext';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Hook to work with dates based on organization timezone
 * @returns Object with timezone utilities
 */
export const useTimezone = () => {
  const { timezone: orgTimezone } = useOrganization();

  /**
   * Convert a date to organization timezone
   */
  const toOrgTimezone = (date?: Date | string | number | dayjs.Dayjs) => {
    if (!date) return dayjs().tz(orgTimezone);
    return dayjs(date).tz(orgTimezone);
  };

  /**
   * Format a date in organization timezone
   */
  const formatInOrgTimezone = (date: Date | string | number | dayjs.Dayjs, format: string = 'YYYY-MM-DD HH:mm:ss') => {
    return dayjs(date).tz(orgTimezone).format(format);
  };

  /**
   * Get current time in organization timezone
   */
  const nowInOrgTimezone = () => {
    return dayjs().tz(orgTimezone);
  };

  /**
   * Parse a date string in organization timezone
   */
  const parseInOrgTimezone = (dateString: string, format?: string) => {
    return format 
      ? dayjs.tz(dateString, format, orgTimezone)
      : dayjs.tz(dateString, orgTimezone);
  };

  /**
   * Get start of day in organization timezone
   */
  const startOfDayInOrgTimezone = (date?: Date | string | number | dayjs.Dayjs) => {
    if (!date) return dayjs().tz(orgTimezone).startOf('day');
    return dayjs(date).tz(orgTimezone).startOf('day');
  };

  /**
   * Get end of day in organization timezone
   */
  const endOfDayInOrgTimezone = (date?: Date | string | number | dayjs.Dayjs) => {
    if (!date) return dayjs().tz(orgTimezone).endOf('day');
    return dayjs(date).tz(orgTimezone).endOf('day');
  };

  return {
    timezone: orgTimezone,
    toOrgTimezone,
    formatInOrgTimezone,
    nowInOrgTimezone,
    parseInOrgTimezone,
    startOfDayInOrgTimezone,
    endOfDayInOrgTimezone,
  };
};
