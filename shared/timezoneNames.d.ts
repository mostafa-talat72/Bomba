/**
 * TypeScript declarations for timezoneNames.js
 */

export const TIMEZONE_NAMES: {
  [timezone: string]: {
    ar: string;
    en: string;
    fr: string;
  };
};

export function getTimezoneName(timezone: string, language?: string): string;
