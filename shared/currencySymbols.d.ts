/**
 * TypeScript declarations for currencySymbols.js
 */

export const CURRENCY_SYMBOLS: {
  [currencyCode: string]: {
    ar: string;
    en: string;
    fr: string;
  };
};

export function getCurrencySymbol(currencyCode: string, language?: string): string;
