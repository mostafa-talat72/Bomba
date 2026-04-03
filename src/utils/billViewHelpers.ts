import { TFunction } from 'i18next';
import { getLocaleFromLanguage } from './localeMapper';
import { formatDecimal } from './formatters';

export const getDeviceTypeText = (deviceType: string, t: TFunction): string => {
  if (deviceType === 'playstation') return t('billView.playstation');
  if (deviceType === 'computer') return t('billView.computer');
  return deviceType;
};

export const getSessionStatusText = (status: string, t: TFunction): string => {
  if (status === 'active') return t('billView.active');
  if (status === 'completed') return t('billView.completed');
  return status;
};

export const getPaymentMethodText = (method: string, t: TFunction): string => {
  if (method === 'cash') return t('billView.cash');
  if (method === 'card') return t('billView.card');
  if (method === 'transfer') return t('billView.transfer');
  return method;
};

export const formatDuration = (hours: number, minutes: number, t: TFunction): string => {
  const lang = localStorage.getItem('billViewLanguage') || 'ar';
  
  // Format numbers according to language
  const hoursStr = formatDecimal(hours, lang);
  const minutesStr = formatDecimal(minutes, lang);
  
  if (lang === 'ar') {
    const hoursText = hours > 0 ? `${hoursStr} ساعة` : '';
    const minutesText = minutes > 0 ? `${minutesStr} دقيقة` : '';
    return `${hoursText}${hoursText && minutesText ? ' ' : ''}${minutesText}`;
  } else if (lang === 'fr') {
    const hoursText = hours > 0 ? `${hoursStr}h` : '';
    const minutesText = minutes > 0 ? `${minutesStr}min` : '';
    return `${hoursText}${hoursText && minutesText ? ' ' : ''}${minutesText}`;
  } else {
    const hoursText = hours > 0 ? `${hoursStr}h` : '';
    const minutesText = minutes > 0 ? `${minutesStr}m` : '';
    return `${hoursText}${hoursText && minutesText ? ' ' : ''}${minutesText}`;
  }
};
