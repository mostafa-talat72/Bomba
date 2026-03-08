/**
 * TypeScript declarations for currencyNames.js
 */

export const CURRENCY_NAMES: {
  [currencyCode: string]: {
    ar: string;
    en: string;
    fr: string;
  };
};

export function getCurrencyName(currencyCode: string, language?: string): string;
