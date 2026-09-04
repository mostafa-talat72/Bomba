import { Bill } from '../../services/api';
import { formatCurrency as formatCurrencyUtil, formatDecimal } from '../../utils/formatters';

export interface LocalOrderItem {
  menuItem: string;
  name: string;
  price: number;
  variant?: string | null;
  quantity: number;
  notes?: string;
  isService?: boolean;
  showInPrint?: boolean;
}

export const getTableDisplay = (v: string | number | undefined | null, lang = 'ar'): string => {
  if (v === undefined || v === null) return '';
  const n = Number(v);
  if (!isNaN(n) && v.toString().trim() !== '') return formatDecimal(n, lang);
  return v.toString();
};

export const toArabicNumbers = (str: string | number) =>
  str.toString().replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);

export const formatCurrencyArabic = (amount: number) => toArabicNumbers(formatCurrencyUtil(amount));

/** Returns elapsed milliseconds since the oldest unpaid bill on this table */
const getTableAgeMs = (bills: Bill[]): number | null => {
  if (!bills || bills.length === 0) return null;
  const unpaid = bills.filter(b => ['draft', 'partial', 'overdue'].includes(b.status));
  if (unpaid.length === 0) return null;
  const earliest = unpaid.reduce((min, b) => {
    const d = new Date(b.createdAt).getTime();
    return d < min ? d : min;
  }, Infinity);
  return Date.now() - earliest;
};

export const getTableAgeColor = (bills: Bill[]): 'green' | 'yellow' | 'orange' | 'red' | null => {
  const ms = getTableAgeMs(bills);
  if (ms === null) return null;
  const minutes = ms / 60000;
  if (minutes < 30)  return 'green';   // < 30 min
  if (minutes < 60)  return 'yellow';  // 30 min – 1 hr
  if (minutes < 120) return 'orange';  // 1 – 2 hrs
  return 'red';                        // > 2 hrs (includes days / months)
};

export const getAgeLabel = (bills: Bill[]): string => {
  const ms = getTableAgeMs(bills);
  if (ms === null) return '';

  const totalSeconds  = Math.floor(ms / 1000);
  const totalMinutes  = Math.floor(totalSeconds / 60);
  const totalHours    = Math.floor(totalMinutes / 60);
  const totalDays     = Math.floor(totalHours   / 24);
  const totalWeeks    = Math.floor(totalDays    / 7);
  const totalMonths   = Math.floor(totalDays    / 30);

  // < 1 minute
  if (totalMinutes < 1)  return `${totalSeconds}ث`;

  // < 1 hour  → show minutes (+ remaining seconds if < 10 min)
  if (totalHours < 1) {
    const secs = totalSeconds % 60;
    if (totalMinutes < 10 && secs > 0) return `${totalMinutes}د ${secs}ث`;
    return `${totalMinutes}د`;
  }

  // < 24 hours → show hours + remaining minutes
  if (totalDays < 1) {
    const mins = totalMinutes % 60;
    return mins > 0 ? `${totalHours}س ${mins}د` : `${totalHours}س`;
  }

  // < 7 days → show days + remaining hours
  if (totalWeeks < 1) {
    const hrs = totalHours % 24;
    return hrs > 0 ? `${totalDays}ي ${hrs}س` : `${totalDays}ي`;
  }

  // < 4 weeks → show weeks + remaining days
  if (totalMonths < 1) {
    const days = totalDays % 7;
    return days > 0 ? `${totalWeeks}أ ${days}ي` : `${totalWeeks}أ`;
  }

  // ≥ 1 month → show months + remaining days
  const remainingDays = totalDays % 30;
  return remainingDays > 0 ? `${totalMonths}ش ${remainingDays}ي` : `${totalMonths}ش`;
};
