import i18n from '../i18n/config';

interface ActivityDetails {
  deviceName?: string;
  customerName?: string;
  tableNumber?: number | string;
  [key: string]: unknown;
}

interface Activity {
  type: 'session' | 'order' | 'payment';
  details: ActivityDetails & {
    status: string;
  };
}

/**
 * Translate activity messages based on type and status
 * Uses translation keys from i18n files
 */
export const translateActivityMessage = (activity: Activity | string): string => {
  // Backward compatibility: if activity is a string (old format), return as is
  if (typeof activity === 'string') {
    return activity;
  }

  const { type, details } = activity;
  const status = details.status;
  const t = i18n.t.bind(i18n);

  // Map payment type to bill for translation keys
  const translationType = type === 'payment' ? 'bill' : type;

  // Get the base translation key
  const translationKey = `dashboard.activity.${translationType}.${status}`;
  let message = t(translationKey);

  // Add entity information based on type
  if (type === 'session' && details.deviceName) {
    message = `${message} - ${details.deviceName}`;
  } else if (type === 'order' || type === 'payment') {
    // Add customer or table information
    const entityName = details.customerName || 
      (details.tableNumber ? `${t('dashboard.activity.table')} ${details.tableNumber}` : t('dashboard.activity.customer'));
    message = `${message} - ${entityName}`;
  }

  return message;
};
