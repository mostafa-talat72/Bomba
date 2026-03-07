import { useOrganization } from '../context/OrganizationContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency as formatCurrencyUtil } from '../utils/formatters';

/**
 * Hook to format currency values based on organization settings
 * @returns Object with formatCurrency function and currency symbol
 */
export const useCurrency = () => {
  const { formatCurrency: orgFormatCurrency, getCurrencySymbol, currency } = useOrganization();
  const { currentLanguage } = useLanguage();

  /**
   * Format currency using organization settings and current language
   */
  const formatCurrency = (amount: number | string | null | undefined): string => {
    return orgFormatCurrency(Number(amount || 0));
  };

  /**
   * Format currency using utils function with organization currency
   * Useful when you need more control over formatting
   */
  const formatCurrencyWithLocale = (amount: number | string | null | undefined): string => {
    return formatCurrencyUtil(amount, currentLanguage, currency);
  };

  return {
    formatCurrency,
    formatCurrencyWithLocale,
    getCurrencySymbol,
    currency,
  };
};
