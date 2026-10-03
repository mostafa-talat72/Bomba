import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ConfigProvider, Table, DatePicker, Tabs, Spin, Empty } from 'antd';
import LocalizedTimePicker from '../components/common/LocalizedTimePicker';
import {
  ShoppingCartOutlined,
  CoffeeOutlined,
  FireOutlined,
  ShoppingFilled,
  ReloadOutlined,
  DownloadOutlined,
  BarChartOutlined,
  ExclamationCircleOutlined,
  PrinterOutlined,
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import dayjs, { Dayjs } from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import 'dayjs/locale/fr';
import 'dayjs/locale/es';
import 'dayjs/locale/de';
import 'dayjs/locale/it';
import 'dayjs/locale/pt';
import 'dayjs/locale/ru';
import 'dayjs/locale/zh';
import 'dayjs/locale/ja';
import 'dayjs/locale/ko';
import 'dayjs/locale/hi';
import 'dayjs/locale/tr';
import 'dayjs/locale/vi';
import 'dayjs/locale/th';
import 'dayjs/locale/pl';
import 'dayjs/locale/nl';
import 'dayjs/locale/he';
import 'dayjs/locale/fa';
import 'dayjs/locale/ur';
import arEG from 'antd/locale/ar_EG';
import enUS from 'antd/locale/en_US';
import frFR from 'antd/locale/fr_FR';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useApp } from '../context/AppContext';
import { useRTL } from '../hooks/useRTL';
import api from '../services/api';
import { formatDecimal, formatCurrency as formatCurrencyUtil, replaceAMPM } from '../utils/formatters';
import { canEditDateFilters, getMaxDateRangeDays, isDateRangeAllowed } from '../utils/permissionHelper';
import { paymentMethodLabel, paymentMethodIcon, paymentCountLabel } from '../utils/paymentMethod';
import { billsCountLabel } from '../utils/formatters';
import { drawerLabel, drawerIcon } from '../utils/paymentDrawer';
import { getCachedDevicePrinter, printThroughLocalBridge } from '../utils/localPrintBridge';
import { resolveDocLayout, brandHtml, layoutCss, printFontImport, resolveDocCopyPrinters } from '../utils/printLayout';
import { getEffectivePrintSettingsFresh } from '../utils/freshPrintSettings';
import { isMobileDevice } from '../utils/deviceDetect';
import { PaymentsByMethodCards, DrawerBreakdownCards, DeliveryFeesCards } from '../components/reports/PaymentsByMethodCards';

// Extend dayjs with plugins
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// Helper function to get Ant Design locale based on language
const getAntdLocale = (language: string) => {
  switch (language) {
    case 'ar': return arEG;
    case 'en': return enUS;
    case 'fr': return frFR;
    default: return arEG;
  }
};

interface ConsumptionItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  category: string;
  menuCategory?: string | null;
  key: string;
}

const OTHER_SECTION_KEY = '__OTHER__';

const ConsumptionReport = () => {
  const { t, i18n } = useTranslation();
  const rtl = useRTL();
  const { menuSections, fetchMenuSections, user, logout } = useApp();
  const location = useLocation();
  const logoutPrintHandled = useRef(false);
  
  // Helper function to format currency with organization settings
  const formatCurrency = useCallback((amount: number) => {
    const currency = localStorage.getItem('organizationCurrency') || 'EGP';
    return formatCurrencyUtil(amount, i18n.language, currency);
  }, [i18n.language]);
  
  // Helper function to format duration (hours and minutes)
  const formatDuration = useCallback((totalHours: number, language: string) => {
    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);
    
    if (language === 'ar') {
      if (hours > 0 && minutes > 0) {
        return `${formatDecimal(hours, language)} س ${formatDecimal(minutes, language)} د`;
      } else if (hours > 0) {
        return `${formatDecimal(hours, language)} س`;
      } else {
        return `${formatDecimal(minutes, language)} د`;
      }
    } else if (language === 'fr') {
      if (hours > 0 && minutes > 0) {
        return `${formatDecimal(hours, language)}h ${formatDecimal(minutes, language)}m`;
      } else if (hours > 0) {
        return `${formatDecimal(hours, language)}h`;
      } else {
        return `${formatDecimal(minutes, language)}m`;
      }
    } else {
      if (hours > 0 && minutes > 0) {
        return `${formatDecimal(hours, language)}h ${formatDecimal(minutes, language)}m`;
      } else if (hours > 0) {
        return `${formatDecimal(hours, language)}h`;
      } else {
        return `${formatDecimal(minutes, language)}m`;
      }
    }
  }, []);
  
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(() => {
    const now = dayjs();
    const start = now.hour() < 7
      ? now.subtract(1, 'day').hour(7).minute(0).second(0).millisecond(0)
      : now.hour(7).minute(0).second(0).millisecond(0);
    const end = start.add(1, 'day').subtract(1, 'millisecond');
    return [start, end];
  });
  const [timeRange, setTimeRange] = useState<[Dayjs, Dayjs]>([
    dayjs().set('hour', 7).set('minute', 0),
    dayjs().set('hour', 7).set('minute', 0),
  ]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [pageSize, setPageSize] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [logoutPrintLoading, setLogoutPrintLoading] = useState(() => Boolean(location.state?.printOnLogout));
  const [consumptionData, setConsumptionData] = useState<Record<string, ConsumptionItem[]>>({});
  const [discounts, setDiscounts] = useState<{ fixedDiscount: number; manualDiscount: number; totalDiscounts: number }>({ fixedDiscount: 0, manualDiscount: 0, totalDiscounts: 0 });
  const [sectionDiscounts, setSectionDiscounts] = useState<Record<string, { fixedDiscount: number; manualDiscount: number; totalDiscount: number; subtotalBeforeDiscount: number }>>({});
  const [paymentsByMethod, setPaymentsByMethod] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTotalSales, setShowTotalSales] = useState(false);
  const [showSectionTotals, setShowSectionTotals] = useState<Record<string, boolean>>({});
  const [catFilter, setCatFilter] = useState<Record<string, string>>({});
  
  // Track if initial data has been loaded
  const hasLoadedInitialData = useRef(false);

  // تعديل التاريخ/التوقيت لمن يملك صلاحية تعديل التواريخ (المدير/المالك ضمناً) — غيرهم عرض فقط.
  const canEditDateRange = useMemo(() => canEditDateFilters(user as any), [user]);

  const guardRangePair = (s: Dayjs, e: Dayjs): boolean => {
    if (!isDateRangeAllowed(s.toDate(), e.toDate(), user as any)) {
      const max = getMaxDateRangeDays(user as any) ?? 0;
      toast.warn(t('common.dateRangeTooLong', 'أقصى مدى مسموح لك: {{days}} يوم', { days: max }));
      return false;
    }
    return true;
  };

  // Update dayjs locale when language changes
  useEffect(() => {
    dayjs.locale(i18n.language);
  }, [i18n.language]);

  const allItems = useMemo(() => Object.values(consumptionData).flat(), [consumptionData]);
  const totalSales = useMemo(() => allItems.reduce((sum, item) => sum + item.total, 0), [allItems]);

  const columns = useMemo(() => [
    {
      title: t('consumptionReport.table.itemName'),
      dataIndex: 'name',
      key: 'name',
      align: (rtl.isRTL ? 'right' : 'left') as 'right' | 'left',
      render: (text: string) => <span className="font-semibold text-gray-900 dark:text-gray-100">{text}</span>,
    },
    {
      title: t('consumptionReport.table.quantity'),
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center' as const,
      sorter: (a: ConsumptionItem, b: ConsumptionItem) => a.quantity - b.quantity,
      render: (quantity: number, record: ConsumptionItem) => {
        const isGamingDevice = record.category === '__PLAYSTATION__' || 
                               record.category === '__COMPUTER__';
        
        // For Gaming Devices, show formatted duration (hours and minutes)
        if (isGamingDevice) {
          return (
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {formatDuration(quantity, i18n.language)}
            </span>
          );
        }
        
        // For other items, show as integer
        return (
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {formatDecimal(Math.round(quantity), i18n.language)}
          </span>
        );
      },
    },
    {
      title: t('consumptionReport.table.unitPrice'),
      dataIndex: 'price',
      key: 'price',
      align: 'center' as const,
      render: (price: number, record: ConsumptionItem) => {
        const isGamingDevice = record.category === '__PLAYSTATION__' || 
                               record.category === '__COMPUTER__';
        
        // For Gaming Devices, show "-" instead of price
        if (isGamingDevice) {
          return (
            <span className="font-semibold text-gray-500 dark:text-gray-400">
              -
            </span>
          );
        }
        
        return (
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {formatCurrency(price)}
          </span>
        );
      },
      sorter: (a: ConsumptionItem, b: ConsumptionItem) => a.price - b.price,
    },
    {
      title: t('consumptionReport.table.total'),
      dataIndex: 'total',
      key: 'total',
      align: 'center' as const,
      render: (total: number) => (
        <span className="font-bold text-blue-600 dark:text-blue-400">
          {formatCurrency(total)}
        </span>
      ),
      sorter: (a: ConsumptionItem, b: ConsumptionItem) => a.total - b.total,
    },
  ], [t, rtl.isRTL, i18n.language]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!dateRange[0] || !dateRange[1]) return;

    try {
      setLoading(true);
      setDataReady(false);
      setError(null);

      // Tabs still need the section list; the aggregated rows themselves come
      // from the server (single implementation shared with the Reports page).
      if (!hasLoadedInitialData.current || forceRefresh) {
        if (menuSections.length === 0) {
          await fetchMenuSections();
        }

        hasLoadedInitialData.current = true;
      }

      // Convert dayjs to Date object to preserve local timezone, then to ISO string
      // This ensures the backend receives the correct local time
      const startDateISO = dateRange[0].toDate().toISOString();
      const endDateISO = dateRange[1].toDate().toISOString();

      const response = await api.getConsumptionReport({
        startDate: startDateISO,
        endDate: endDateISO,
      });

      if (response.success && response.data) {
        setConsumptionData(response.data);
        if (response.discounts) {
          setDiscounts(response.discounts);
        }
        if (response.sectionDiscounts) {
          setSectionDiscounts(response.sectionDiscounts);
        }
        // المدفوعات حسب النوع — نفس الفترة الزمنية (غير حاجب: فشلها لا يعطل التقرير)
        try {
          const payRes: any = await (api as any).getPaymentsByMethod({
            startDate: startDateISO,
            endDate: endDateISO,
          });
          if (payRes?.success && payRes?.data) setPaymentsByMethod(payRes.data);
          else setPaymentsByMethod(null);
        } catch {
          setPaymentsByMethod(null);
        }
        setDataReady(true);
        // ⚡ سخّن كاش الطابعة في الخلفية: زر الطباعة يجد كل شيء جاهزاً.
        try { void getCachedDevicePrinter(); } catch {}
      } else {
        console.error('❌ Failed to fetch data:', response.message);
        toast.error(t('consumptionReport.messages.loadError'));
        setDataReady(false);
        setLogoutPrintLoading(false);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('consumptionReport.messages.unexpectedError');
      setError(errorMessage);
      toast.error(t('consumptionReport.messages.loadErrorDetail', { error: errorMessage }));
      console.error('❌ Error fetching data:', error);
      setDataReady(false);
      setLogoutPrintLoading(false);
    } finally {
      setLoading(false);
    }
  }, [dateRange, fetchMenuSections, menuSections, t]);


  const calculateTotal = (items: ConsumptionItem[]): number => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  // sectionKey: undefined أو 'all' = طباعة كل الأقسام، وغير ذلك طباعة القسم المحدد فقط.
  const printReport = useCallback(async (sectionKey?: string | null): Promise<boolean> => {
    // ⚡ إشعار فوري: الطباعة بدأت لحظة الضغط.
    try { toast.info(t('consumptionReport.messages.printOpening')); } catch {}
    let reportData: any = null;
    try {
      reportData = {
        consumptionData,
        dateRange,
        totalSales: Object.values(consumptionData).flat().reduce((sum, item) => sum + item.total, 0),
        totalConsumption: Object.values(consumptionData).flat().reduce((sum, item) => sum + item.total, 0),
        discounts,
        sectionDiscounts,
      };

    } catch (error: any) {
      console.error('Print preparation failed:', error);
    }

    // Fallback (ويب فقط): استخدام الطريقة القديمة إذا فشلت الطباعة المباشرة
    try {
      const isRTL = i18n.language === 'ar';
      const dir = isRTL ? 'rtl' : 'ltr';
      
      // Format date with locale and translated AM/PM
      const formatDate = (date: Dayjs) => {
        const formatted = date.locale(i18n.language).format('YYYY/MM/DD - hh:mm A');
        return replaceAMPM(formatted);
      };

      // Get organization name from user or use default
      const organizationName = user?.organizationName || t('consumptionReport.print.organization');

      // ⚡ الإعدادات الفعالة الطازجة أولاً (طابعتي ثم المنشأة — كاش 10 ثوانٍ):
      // المحفوظ حديثاً يُطبق فوراً، واللقطة القديمة ملاذ فقط.
      const [savedPrinter, freshSettings, organizationResponse] = await Promise.all([
        getCachedDevicePrinter(),
        getEffectivePrintSettingsFresh(user).catch(() => null),
        (user as any)?.organization?.printSettings
          ? Promise.resolve({ success: true, data: (user as any).organization })
          : api.getOrganization().catch(() => null),
      ]);
      const settings = freshSettings && Object.keys(freshSettings).length
        ? freshSettings
        : organizationResponse?.success === true ? organizationResponse.data?.printSettings : undefined;
      const consLayout = resolveDocLayout(settings, 'consumption');
      const consLogo = (organizationResponse as any)?.data?.logo as string | undefined;
      const reportCopyIds = resolveDocCopyPrinters(settings, 'consumptionReport');
      const reportCopies = reportCopyIds.length;
      const reportCopyPrinters = reportCopyIds.map((id) => (id ? settings?.printers?.find((p: any) => p.id === id)?.printerName : undefined));

      // Create separate pages for each category — تُقتصر على القسم المختار عند تحديده
      const categories = Object.entries(consumptionData).filter(([key, items]) =>
        items.length > 0 && (!sectionKey || sectionKey === 'all' || key === sectionKey)
      );
      if (categories.length === 0) {
        toast.error(t('consumptionReport.messages.noData'));
        return false;
      }
      
      const categoryPages = categories
        .map(([category, items]) => {
          const categoryTotal = calculateTotal(items);
          // صافي القسم = الخام − خصمه (ليطابق صافي الشاشة بدل الخام)
          const categoryDiscount = Number((sectionDiscounts as any)?.[category]?.totalDiscount) || 0;
          const categoryNet = categoryTotal - categoryDiscount;
          
          // Translate category name if it's a gaming device
          const displayCategory = category === OTHER_SECTION_KEY
            ? 'أخرى'
            : category === '__PLAYSTATION__'
            ? t('consumptionReport.categories.playstation')
            : category === '__COMPUTER__'
            ? t('consumptionReport.categories.computer')
            : category;
          
          // Split the section page by menu category: one titled table + total per category.
          const catGroups: Array<{ key: string; name: string; items: any[]; total: number }> = [];
          const catMap = new Map<string, number>();
          for (const it of items) {
            const ck = (it as any).menuCategory || category;
            let gi = catMap.get(ck);
            if (gi === undefined) {
              gi = catGroups.length;
              catMap.set(ck, gi);
              catGroups.push({ key: ck, name: ck === category ? displayCategory : ck, items: [], total: 0 });
            }
            catGroups[gi].items.push(it);
          }
          for (const g of catGroups) g.total = calculateTotal(g.items);
          const itemRow = (item: any) => {
            const isGamingDevice = item.category === '__PLAYSTATION__' || item.category === '__COMPUTER__';
            const quantityDisplay = isGamingDevice
              ? formatDuration(item.quantity, i18n.language)
              : formatDecimal(Math.round(item.quantity), i18n.language);
            const unitPriceDisplay = isGamingDevice ? '-' : formatCurrency(item.price);
            return `
              <tr>
                <td class="item-name">${item.name}</td>
                <td class="item-quantity">${quantityDisplay}</td>
                <td class="item-price">${unitPriceDisplay}</td>
                <td class="item-total">${formatCurrency(item.total)}</td>
              </tr>
            `;
          };
          const catBlocks = catGroups.map((g) => `
            ${consLayout.showSectionTitle !== false ? `<div class="category-name">${g.name}</div>` : ''}
            <table class="items-table">
              <thead>
                    <tr>
                      <th class="item-name">${t('consumptionReport.table.itemName')}</th>
                      <th class="item-quantity">${t('consumptionReport.table.quantity')}</th>
                      <th class="item-price">${t('consumptionReport.table.unitPrice')}</th>
                      <th class="item-total">${t('consumptionReport.table.total')}</th>
                    </tr>
              </thead>
              <tbody>
                ${g.items.map(itemRow).join('')}
              </tbody>
            </table>
            <div class="category-total">
              <strong>${t('consumptionReport.print.categoryTotal', { category: g.name })}:</strong> ${formatCurrency(g.total)}
            </div>
          `).join('');

          return `
            <div class="page">
              <div class="page-content">
                <div class="header">
                  ${brandHtml(consLogo, consLayout, organizationName)}
                  <div class="title">${t('consumptionReport.print.title')}</div>
                  ${consLayout.showSectionTitle !== false ? `<div class="category-name">${displayCategory}</div>` : ''}
                  ${consLayout.showDate !== false ? `
                  <div class="date-info"><strong>${t('consumptionReport.print.from')}:</strong> ${formatDate(dateRange[0])}</div>
                  <div class="date-info"><strong>${t('consumptionReport.print.to')}:</strong> ${formatDate(dateRange[1])}</div>
                  <div class="date-info"><strong>${t('consumptionReport.print.date')}:</strong> ${formatDate(dayjs())}</div>` : ''}
                </div>

                ${consLayout.showDividers !== false ? `<div class="divider"></div>` : ''}
                
                ${catBlocks}

                ${consLayout.showDividers !== false ? `<div class="divider"></div>` : ''}

                <div class="category-total">
                  <strong>${t('consumptionReport.print.categoryTotal', { category: displayCategory })}:</strong> ${formatCurrency(categoryTotal)}
                </div>
                ${categoryDiscount > 0 ? `
                <div class="category-total">
                  <strong>${t('consumptionReport.print.categoryDiscount', { category: displayCategory })}:</strong> -${formatCurrency(categoryDiscount)}
                </div>
                <div class="category-total">
                  <strong>${t('consumptionReport.print.categoryNet', { category: displayCategory })}:</strong> ${formatCurrency(categoryNet)}
                </div>` : ''}

                ${consLayout.showThanks !== false ? `<div class="thank-you">${(settings as any)?.customFooterConsumption || t('consumptionReport.print.thankYou')}</div>` : ''}
              </div>
              
              <div class="dev-sign" style="margin-top:auto;text-align:center;font-size:1em;color:#333;border-top:2px dashed #000;padding-top:10px;padding-bottom:10px;font-weight:900;">
                <div><strong>${t('consumptionReport.print.footer')}</strong></div>
              </div>
            </div>
          `;
        }).join('');

      // صفحة ملخص المدفوعات حسب النوع — نفس الفترة الزمنية
      const paySummaryPage = (() => {
        const pm: any = paymentsByMethod?.methods;
        if (!pm) return '';
        const row = (label: string, v: any) => `<tr><td style="border:1px solid #000;padding:5px;font-weight:900;">${label}</td><td style="border:1px solid #000;padding:5px;font-weight:900;">${formatCurrency(Number(v?.total) || 0)}</td><td style="border:1px solid #000;padding:5px;font-weight:900;">${paymentCountLabel(v?.count, i18n.language)}</td></tr>`;
        const otherRow = ((pm.other?.total || 0) > 0 || (pm.other?.count || 0) > 0) ? row(t('reports.paymentsByMethod.other', 'أخرى'), pm.other) : '';
        const discTotal = Number((paymentsByMethod as any)?.discounts?.totalDiscounts) || 0;
        const collectedTotal = Number((paymentsByMethod as any)?.total) || 0;
        const recvTotal = Number((paymentsByMethod as any)?.outstanding) || 0;
        const recvRow = recvTotal > 0
          ? `<tr><td style="border:1px solid #000;padding:5px;font-weight:900;">${t('reports.paymentsByMethod.outstanding', 'المستحق')}</td><td style="border:1px solid #000;padding:5px;font-weight:900;">${formatCurrency(recvTotal)}</td><td style="border:1px solid #000;padding:5px;font-weight:900;">—</td></tr>`
          : '';
        const grossRow = discTotal > 0
          ? `<tr><td style="border:2px solid #000;padding:6px;font-weight:900;background:#e0e0e0;">${t('reports.paymentsByMethod.total', 'الإجمالي')}</td><td style="border:2px solid #000;padding:6px;font-weight:900;background:#e0e0e0;">${formatCurrency(collectedTotal + discTotal)}</td><td style="border:2px solid #000;padding:6px;font-weight:900;background:#e0e0e0;">${paymentCountLabel((paymentsByMethod as any)?.count, i18n.language)}</td></tr>`
          + `<tr><td style="border:1px solid #000;padding:5px;font-weight:900;">${t('reports.paymentsByMethod.discount', 'الخصم')}</td><td style="border:1px solid #000;padding:5px;font-weight:900;">−${formatCurrency(discTotal)}</td><td style="border:1px solid #000;padding:5px;font-weight:900;">—</td></tr>`
          + `<tr><td style="border:2px solid #000;padding:6px;font-weight:900;background:#e0e0e0;">${t('reports.paymentsByMethod.net', 'الصافي')}</td><td style="border:2px solid #000;padding:6px;font-weight:900;background:#e0e0e0;">${formatCurrency(collectedTotal)}</td><td style="border:2px solid #000;padding:6px;font-weight:900;background:#e0e0e0;">${paymentCountLabel((paymentsByMethod as any)?.count, i18n.language)}</td></tr>`
          + recvRow
          : `<tr><td style="border:2px solid #000;padding:6px;font-weight:900;background:#e0e0e0;">${t('reports.paymentsByMethod.total', 'الإجمالي')}</td><td style="border:2px solid #000;padding:6px;font-weight:900;background:#e0e0e0;">${formatCurrency(collectedTotal)}</td><td style="border:2px solid #000;padding:6px;font-weight:900;background:#e0e0e0;">${paymentCountLabel((paymentsByMethod as any)?.count, i18n.language)}</td></tr>`
          + recvRow;
        return `<div class="page"><div class="page-content">
          <div class="header">
            <div class="org-name">${organizationName}</div>
            <div class="title">${t('reports.paymentsByMethod.title', 'المدفوعات حسب النوع')}</div>
            <div class="date-info">${t('consumptionReport.print.from')}: ${formatDate(dateRange[0])} — ${t('consumptionReport.print.to')}: ${formatDate(dateRange[1])}</div>
          </div>
          <div class="divider"></div>
          <table style="width:100%;border-collapse:collapse;border:2px solid #000;" dir="${dir}">
            <thead><tr>
              <th style="border:1.5px solid #000;padding:5px;background:#e0e0e0;">${t('reports.paymentsByMethod.colMethod', 'النوع')}</th>
              <th style="border:1.5px solid #000;padding:5px;background:#e0e0e0;">${t('reports.paymentsByMethod.colAmount', 'الإجمالي')}</th>
              <th style="border:1.5px solid #000;padding:5px;background:#e0e0e0;">${t('reports.paymentsByMethod.colCount', 'العدد')}</th>
            </tr></thead>
            <tbody>
              ${row(`${paymentMethodIcon('cash')} ${paymentMethodLabel('cash', t)}`, pm.cash)}
              ${row(`${paymentMethodIcon('card')} ${paymentMethodLabel('card', t)}`, pm.card)}
              ${row(`${paymentMethodIcon('transfer')} ${paymentMethodLabel('transfer', t)}`, pm.transfer)}
              ${row(`${paymentMethodIcon('e_wallet')} ${paymentMethodLabel('e_wallet', t)}`, pm.e_wallet)}
              ${otherRow}
              ${grossRow}
            </tbody>
          </table>
          <div class="divider"></div>
          <div class="title">${t('reports.paymentsByDrawer.title', 'المدفوعات حسب الدرج')}</div>
          <table style="width:100%;border-collapse:collapse;border:2px solid #000;" dir="${dir}">
            <thead><tr>
              <th style="border:1.5px solid #000;padding:5px;background:#e0e0e0;">${t('reports.paymentsByMethod.colMethod', 'النوع')}</th>
              <th style="border:1.5px solid #000;padding:5px;background:#e0e0e0;">${t('reports.paymentsByMethod.colAmount', 'الإجمالي')}</th>
              <th style="border:1.5px solid #000;padding:5px;background:#e0e0e0;">${t('reports.paymentsByMethod.colCount', 'العدد')}</th>
            </tr></thead>
            <tbody>
              ${['cashier', 'hall', 'takeaway', 'delivery', 'safe'].map((d: string) => row(`${drawerIcon(d)} ${drawerLabel(d, t)}`, (paymentsByMethod as any)?.drawers?.[d])).join('')}
              ${grossRow}
            </tbody>
          </table>
          <div class="divider"></div>
          <div class="title">🛵 ${t('reports.deliveryFees.title', 'رسوم التوصيل')}</div>
          <table style="width:100%;border-collapse:collapse;border:2px solid #000;" dir="${dir}">
            <thead><tr>
              <th style="border:1.5px solid #000;padding:5px;background:#e0e0e0;">${t('reports.paymentsByMethod.colAmount', 'الإجمالي')}</th>
              <th style="border:1.5px solid #000;padding:5px;background:#e0e0e0;">${t('reports.paymentsByMethod.colCount', 'العدد')}</th>
            </tr></thead>
            <tbody>
              <tr><td style="border:2px solid #000;padding:6px;font-weight:900;">${formatCurrency(Number((paymentsByMethod as any)?.deliveryFees?.total) || 0)}</td><td style="border:2px solid #000;padding:6px;font-weight:900;">${billsCountLabel((paymentsByMethod as any)?.deliveryFees?.count, i18n.language)}</td></tr>
            </tbody>
          </table>
        </div></div>`;
      })();

      const printContent = `
        <!DOCTYPE html>
        <html dir="${dir}" lang="${i18n.language}">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${t('consumptionReport.print.title')}</title>
          <style>${layoutCss(consLayout, 'consumption')}
            @import url('https://fonts.googleapis.com/css2?family=${printFontImport((settings as any)?.printFont)}&display=swap');
            * { 
              font-family: '${(settings as any)?.printFont || 'Tajawal'}', sans-serif; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              box-sizing: border-box;
            }
            body { 
              margin: 0; 
              padding: 0;
              font-size: 11px; 
              color: #000; 
              font-weight: 600;
              width: 100%;
              max-width: 100%;
              overflow-x: hidden;
              text-align: center;
              direction: ${dir};
            }
            .page {
              width: 100%;
              max-width: 100%;
              padding: 8px 4px;
              overflow: hidden;
            }
            .page-content {
              width: 100%;
            }
            .header { 
              text-align: center; 
              margin-bottom: 8px;
              margin-top: 0;
              font-weight: 900;
              border-bottom: 2px dashed #000;
              padding-bottom: 6px;
            }
            .org-name { 
              font-size: 1.5em; 
              font-weight: 900; 
              margin-bottom: 6px; 
              color: #000;
            }
            .title { 
              font-size: 1.2em; 
              font-weight: 900; 
              margin-bottom: 6px; 
              color: #000;
            }
            .category-name {
              font-size: 1.3em;
              font-weight: 900;
              margin-bottom: 8px;
              color: #000;
              background: #e0e0e0;
              padding: 8px;
              border-radius: 4px;
            }
            .date-info { 
              margin-bottom: 4px; 
              font-weight: 900;
              font-size: 1.05em;
            }
            .divider { 
              border-top: 2px dashed #000; 
              margin: 10px 0; 
            }
            .items-table { 
              width: 100%;
              border-collapse: collapse;
              margin: 2px 0;
              font-size: 1.1em;
              border: 2px solid #000;
              table-layout: fixed;
              direction: ${dir};
            }
            .items-table thead {
              background: #e0e0e0;
              font-weight: 900;
            }
            .items-table th {
              padding: 1px 0;
              text-align: center;
              border: 1.5px solid #000;
              font-size: 1.1em;
              word-wrap: break-word;
            }
            .items-table td {
              padding: 1px 0;
              text-align: center;
              border: 1px solid #000;
              font-weight: 900;
              word-wrap: break-word;
              overflow-wrap: break-word;
            }
            .items-table th {
              width: 16.67% !important;
            }
            .items-table th:first-child {
              text-align: center;
              padding-${isRTL ? 'left' : 'right'}: 0;
              width: 50% !important;
            }
            .items-table td {
              width: 16.67% !important;
            }
            .items-table .item-name {
              text-align: center;
              font-weight: 900;
              font-size: 1.05em;
              padding-${isRTL ? 'left' : 'right'}: 0;
              width: 50% !important;
            }
            .items-table .item-quantity {
              font-weight: 900;
              font-size: 1.3em;
            }
            .items-table .item-price {
              font-weight: 900;
              font-size: 1.3em;
            }
            .items-table .item-total {
              font-weight: 900;
              font-size: 1.3em;
              color: #000;
            }
            .category-total {
              text-align: center;
              font-size: 1.35em;
              font-weight: 900;
              color: #000;
              padding: 12px;
              background: #f0f0f0;
              border-radius: 4px;
              margin-top: 10px;
            }
            .footer { 
              margin-top: auto;
              text-align: center; 
              font-size: 1em; 
              color: #333;
              border-top: 2px dashed #000;
              padding-top: 10px;
              padding-bottom: 10px;
              font-weight: 900;
            }
            .thank-you { 
              text-align: center; 
              margin-top: 12px; 
              margin-bottom: 10px;
              font-size: 1.2em; 
              font-weight: 800; 
            }
            strong { 
              font-weight: 900; 
            }
            
            @media print {
              @page { 
                size: auto;
                margin: 0; 
              }
              html, body { 
                margin: 0; 
                padding: 0;
                width: 100%;
                max-width: 100%;
                overflow-x: hidden;
              }
              body { 
                padding: 0;
                font-weight: 900;
                direction: ${dir};
              }
              .no-print { 
                display: none !important; 
              }
              .page {
                padding: 0 !important;
                page-break-after: always !important;
                -webkit-page-break-after: always !important;
                break-after: page !important;
                page-break-inside: avoid !important;
                -webkit-page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .page:last-child {
                page-break-after: auto !important;
                -webkit-page-break-after: auto !important;
                break-after: auto !important;
              }
              .items-table {
                border: 2px solid #000 !important;
              }
              .items-table th,
              .items-table td {
                border: 1px solid #000 !important;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
            
            @media screen {
              body {
                max-width: 100%;
                margin: 0 auto;
                background: #fff;
              }
            }
          </style>
        </head>
        <body>
          ${categoryPages}
          ${paySummaryPage}
        </body>
        </html>
      `;

      // (الإعدادات والشعار محلولة أعلاه قبل بناء القالب)
      // الهاتف/التابلت: لا يوجد agent محلي (127.0.0.1 هو الهاتف نفسه)، فنرسل
      // نفس HTML المصمم للديسكتوب إلى الجهاز الرئيسي الذي يرحّله لوكيله
      // المحلي (نفس الشكل 100%). الفشل يسقط على الجسر/طابعات الهاتف أدناه.
      if (reportData && isMobileDevice()) {
        try {
          const res: any = await api.printConsumptionReport({
            reportData,
            organization: (user as any)?.organization ?? null,
            language: i18n.language,
            html: printContent,
            copies: reportCopies,
            copyPrinters: reportCopyPrinters,
            printKey: `consumption:${dayjs(dateRange[0]).format('YYYYMMDD')}-${dayjs(dateRange[1]).format('YYYYMMDD')}`,
          });
          if (res?.success) {
            toast.success(i18n.language === 'ar' ? 'تم إرسال التقرير للطباعة على الجهاز الرئيسي' : 'Report sent to the main device printer');
            return true;
          }
        } catch {}
        // ملاذ أخير: طابعات الهاتف نفسه (الكود أدناه).
      }

      const profile = settings?.printers?.find((item: any) => item.id === settings?.documentPrinterMap?.consumptionReport);
      const printerName = profile?.printerName || savedPrinter?.data?.printerName || savedPrinter?.data?.name;
      if (await printThroughLocalBridge(printContent, printerName, { copies: reportCopies, copyPrinters: reportCopyPrinters })) {
        toast.success(t('consumptionReport.messages.printOpening'));
        return true;
      }
      throw new Error('Print Agent rejected the report');

    } catch (error) {
      toast.error(t('consumptionReport.messages.printFailed'));
      console.error('Print error:', error);
      return false;
    }
  }, [consumptionData, dateRange, user, i18n.language, t, paymentsByMethod]);

  useEffect(() => {
    if (!location.state?.printOnLogout || loading || !dataReady || logoutPrintHandled.current) return;
    logoutPrintHandled.current = true;
    setLogoutPrintLoading(true);
    void (async () => {
      const printed = await printReport();
      if (printed) {
        try { sessionStorage.removeItem('bombaExitGuard'); } catch {}
        await logout();
      } else {
        logoutPrintHandled.current = false;
        setLogoutPrintLoading(false);
      }
    })();
  }, [location.state, loading, dataReady, printReport, logout]);

  const exportToPDF = () => {
    setLoading(true);
    try {
      // Create a new PDF document
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();

      // Add title
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text('تقرير الاستهلاك', pageWidth / 2, 20, { align: 'center' });

      // Add date range with translated AM/PM
      doc.setFontSize(12);
      const startFormatted = replaceAMPM(dateRange[0].format('YYYY/MM/DD hh:mm A'));
      const endFormatted = replaceAMPM(dateRange[1].format('YYYY/MM/DD hh:mm A'));
      const dateRangeText = `الفترة من ${startFormatted} إلى ${endFormatted}`;
      doc.text(dateRangeText, pageWidth / 2, 30, { align: 'center' });

      // Add total sales
      doc.setFontSize(14);
      const finalTotal = totalSales - discounts.totalDiscounts;
      doc.text(`إجمالي المبيعات: ${finalTotal.toFixed(2)} ج.م`, 20, 45);
      if (discounts.totalDiscounts > 0) {
        doc.setFontSize(10);
        doc.text(`(المجموع: ${totalSales.toFixed(2)} | الخصومات: -${discounts.totalDiscounts.toFixed(2)})`, 20, 52);
      }
      doc.text(`عدد الأصناف: ${allItems.length}`, pageWidth - 20, 45, { align: 'right' });

      // Add a line separator
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 50, pageWidth - 20, 50);

      // Function to add a table for a category
      const addCategoryTable = (category: string, items: ConsumptionItem[], startY: number) => {
        const headers = [['الكمية', 'سعر الوحدة', 'الإجمالي', 'اسم الصنف']];
        const data = items.map(item => {
          const isGamingDevice = item.category === '__PLAYSTATION__' || item.category === '__COMPUTER__';
          const quantityDisplay = isGamingDevice 
            ? formatDuration(item.quantity, i18n.language)
            : formatDecimal(Math.round(item.quantity), i18n.language);
          const priceDisplay = isGamingDevice 
            ? '-' 
            : item.price.toFixed(2) + ' ج.م';
          
          return [
            quantityDisplay,
            priceDisplay,
            item.total.toFixed(2) + ' ج.م',
            item.name
          ];
        });

        // Add category title
        doc.setFontSize(14);
        doc.text(category, 20, startY + 10);

        // Add table
        (doc as any).autoTable({
          startY: startY + 15,
          head: headers,
          body: data,
          margin: { left: 20, right: 20 },
          styles: {
            font: 'tajawal',
            textColor: [0, 0, 0],
            halign: 'right',
            cellPadding: 3,
            fontSize: 10
          },
          headStyles: {
            fillColor: [41, 128, 185],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          },
          columnStyles: {
            0: { cellWidth: 20, halign: 'center' },
            1: { cellWidth: 30, halign: 'left' },
            2: { cellWidth: 30, halign: 'left' },
            3: { cellWidth: 'auto', halign: 'right' }
          }
        });

        // Add total for the category
        const categoryTotal = calculateTotal(items);
        doc.setFontSize(12);
        doc.text(`إجمالي ${category}: ${categoryTotal.toFixed(2)} ج.م`, pageWidth - 20, (doc as any).lastAutoTable.finalY + 10, { align: 'right' });

        return (doc as any).lastAutoTable.finalY + 15;
      };

      let currentY = 60;

      // Add all items table
      if (allItems.length > 0) {
        currentY = addCategoryTable('الكل', allItems, currentY);
      }

      // Add tables for each category
      Object.entries(consumptionData).forEach(([category, items]) => {
        if (items.length > 0) {
          // Add new page if needed
          if (currentY > 250) {
            doc.addPage();
            currentY = 30;
          }
          currentY = addCategoryTable(category, items, currentY);
        }
      });

      // Save the PDF
      doc.save(`تقرير_الاستهلاك_${dateRange[0].format('YYYY-MM-DD')}_${dateRange[1].format('YYYY-MM-DD')}.pdf`);

      toast.success(t('consumptionReport.messages.exportSuccess'));
    } catch (error) {
      toast.error(t('consumptionReport.messages.exportError'));
    } finally {
      setLoading(false);
    }
  };

  // Update handlers to work with separate date and time pickers
  const handleDateChange = (newDates: [Dayjs | null, Dayjs | null] | null, type: 'start' | 'end') => {
    if (!canEditDateRange) return;
    if (!newDates) return;

    if (type === 'start' && newDates[0]) {
      const startDate = newDates[0]
        .set('hour', timeRange[0].hour())
        .set('minute', timeRange[0].minute())
        .set('second', 0);
      if (!guardRangePair(startDate, dateRange[1])) return;
      setDateRange([startDate, dateRange[1]]);
    } else if (type === 'end' && newDates[1]) {
      const endDate = newDates[1]
        .set('hour', timeRange[1].hour())
        .set('minute', timeRange[1].minute())
        .set('second', 59);
      if (!guardRangePair(dateRange[0], endDate)) return;
      setDateRange([dateRange[0], endDate]);
    }
  };

  const handleTimeChange = (time: Dayjs | null, type: 'start' | 'end') => {
    if (!canEditDateRange) return;
    if (!time) return;

    if (type === 'start') {
      const newStartTime = time;
      const newStartDate = dateRange[0]
        .set('hour', newStartTime.hour())
        .set('minute', newStartTime.minute());
      if (!guardRangePair(newStartDate, dateRange[1])) return;
      setTimeRange([newStartTime, timeRange[1]]);
      setDateRange([newStartDate, dateRange[1]]);
    } else {
      const newEndTime = time;
      const newEndDate = dateRange[1]
        .set('hour', newEndTime.hour())
        .set('minute', newEndTime.minute());
      if (!guardRangePair(dateRange[0], newEndDate)) return;
      setTimeRange([timeRange[0], newEndTime]);
      setDateRange([dateRange[0], newEndDate]);
    }
  };

  // Fetch data when date range changes or on initial load
  useEffect(() => {
    if (dateRange[0] && dateRange[1]) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange[0]?.valueOf(), dateRange[1]?.valueOf()]); // Only re-run when dates actually change


  const getCategoryIcon = (category: string) => {
    const lowerCategory = category.toLowerCase();
    
    if (lowerCategory.includes('بلايستيشن') || lowerCategory.includes('playstation')) {
      return <span className="ml-1">🎮</span>;
    }
    
    if (lowerCategory.includes('كمبيوتر') || lowerCategory.includes('computer')) {
      return <span className="ml-1">💻</span>;
    }
    
    switch (lowerCategory) {
      case 'مشروبات ساخنة':
      case 'قهوة':
      case 'هوت كوفي':
        return <CoffeeOutlined className="ml-1" />;
      case 'طعام':
      case 'وجبات':
        return <ShoppingFilled className="ml-1" />;
      case 'شيشة':
        return <FireOutlined className="ml-1" />;
      default:
        return <ShoppingCartOutlined className="ml-1" />;
    }
  };

  const tabItems = useMemo(() => {
    // Sections order shared by the "all" tab and section tabs
    const orderedSections = [
      ...menuSections.filter(s => s.name !== 'أخرى').map(s => s.name),
      OTHER_SECTION_KEY,
      '__PLAYSTATION__',
      '__COMPUTER__'
    ];

    // Group section rows by their menu category (فئة المنيو — order of first appearance).
    // Rows without a menu category (sessions, legacy items) fall back to the section itself.
    const groupByCategory = (rows: ConsumptionItem[]) => {
      const map = new Map<string, ConsumptionItem[]>();
      for (const it of rows) {
        const k = it.menuCategory || it.category || OTHER_SECTION_KEY;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(it);
      }
      return Array.from(map.entries()).map(([cat, items]) => ({
        key: cat,
        name: cat === OTHER_SECTION_KEY ? 'أخرى'
          : cat === '__PLAYSTATION__' ? t('consumptionReport.categories.playstation')
          : cat === '__COMPUTER__' ? t('consumptionReport.categories.computer')
          : cat,
        items,
        total: calculateTotal(items),
      }));
    };

    const pagerLocale = {
      items_per_page: t('consumptionReport.pagination.itemsPerPage'),
      jump_to: t('consumptionReport.pagination.jumpTo'),
      jump_to_confirm: t('consumptionReport.pagination.confirm'),
      page: t('consumptionReport.pagination.page'),
      prev_page: t('consumptionReport.pagination.prevPage'),
      next_page: t('consumptionReport.pagination.nextPage'),
      prev_5: t('consumptionReport.pagination.prev5'),
      next_5: t('consumptionReport.pagination.next5'),
      prev_3: t('consumptionReport.pagination.prev3'),
      next_3: t('consumptionReport.pagination.next3'),
    };

    // Section totals footer (discount + net + show/hide + print).
    // When a category filter is active, totals reflect the shown rows only.
    const renderSectionFooter = (sectionName: string, sectionTotal: number, filteredTotal?: number) => (
      <div className="mx-2 sm:mx-3 mb-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-700 dark:to-blue-600 border-t-2 border-blue-700 dark:border-blue-500 px-4 py-4 flex flex-wrap items-center justify-between gap-2 text-white">
        <span className="flex items-center gap-2 font-bold text-lg">
          {t('consumptionReport.table.total')}
        </span>
        <span className="flex items-center gap-3">
          {(() => {
            const sd = sectionDiscounts[sectionName];
            if (filteredTotal !== undefined) return null;
            if (sd && sd.totalDiscount > 0) {
              return (
                <div className="text-center">
                  <span className="text-sm text-blue-200 line-through block">{showSectionTotals[sectionName] ? formatCurrency(sd.subtotalBeforeDiscount) : '••••••'}</span>
                  <span className="text-sm text-purple-200 block">خصم: -{showSectionTotals[sectionName] ? formatCurrency(sd.totalDiscount) : '••••••'}</span>
                </div>
              );
            }
            return null;
          })()}
          <span className="text-xl">{showSectionTotals[sectionName] ? formatCurrency(filteredTotal !== undefined ? filteredTotal : sectionTotal - (sectionDiscounts[sectionName]?.totalDiscount || 0)) : '••••••'}</span>
          <button
            onClick={() => setShowSectionTotals(prev => ({ ...prev, [sectionName]: !prev[sectionName] }))}
            title={showSectionTotals[sectionName] ? t('consumptionReport.stats.hideAmount') : t('consumptionReport.stats.showAmount')}
            className="p-2 hover:bg-blue-700 dark:hover:bg-blue-800 rounded-lg transition-colors text-white"
          >
            {showSectionTotals[sectionName] ? <EyeInvisibleOutlined className="text-lg" /> : <EyeOutlined className="text-lg" />}
          </button>
          <button
            onClick={() => void printReport(sectionName)}
            title="طباعة هذا القسم"
            className="p-2 hover:bg-blue-700 dark:hover:bg-blue-800 rounded-lg transition-colors text-white"
          >
            <PrinterOutlined className="text-lg" />
          </button>
        </span>
      </div>
    );

    const allTab = {
      key: 'all',
      label: (
        <div className="flex items-center">
          <ShoppingCartOutlined className="ml-1.5 text-blue-500" />
          <span className="font-medium">{t('consumptionReport.tabs.all')}</span>
          {allItems.length > 0 && (
            <span className="bg-blue-100 text-blue-600 text-xs font-medium px-2 py-0.5 rounded-full mr-2">
              {formatDecimal(allItems.length, i18n.language)}
            </span>
          )}
        </div>
      ),
      children: (() => {
        const allCats = groupByCategory(allItems);
        const activeAllCat = catFilter['__ALL__'] || 'all';
        const shownAll = activeAllCat === 'all' ? allItems : allItems.filter((it) => (it.menuCategory || it.category || OTHER_SECTION_KEY) === activeAllCat);
        return (
        <div className="border-t border-gray-100">
          {allCats.length > 0 && (
            <div className="flex gap-1 overflow-x-auto px-3 sm:px-4 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setCatFilter((p) => ({ ...p, __ALL__: 'all' }))}
                className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px whitespace-nowrap transition-colors ${activeAllCat === 'all' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400'}`}
              >
                {t('consumptionReport.tabs.all')}
                <span className={`mr-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeAllCat === 'all' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                  {formatDecimal(allItems.length, i18n.language)}
                </span>
              </button>
              {allCats.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCatFilter((p) => ({ ...p, __ALL__: c.key }))}
                  className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px whitespace-nowrap transition-colors ${activeAllCat === c.key ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400'}`}
                >
                  {c.name}
                  <span className={`mr-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeAllCat === c.key ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                    {formatDecimal(c.items.length, i18n.language)}
                  </span>
                </button>
              ))}
            </div>
          )}
            <Table
              columns={columns}
              dataSource={shownAll}
              rowKey="id"
              scroll={{ x: 'max-content' }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => (
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  {t('consumptionReport.pagination.total', { count: total })}
                </span>
              ),
              position: ['bottomCenter'],
              className: 'px-4 py-3',
              locale: {
                items_per_page: t('consumptionReport.pagination.itemsPerPage'),
                jump_to: t('consumptionReport.pagination.jumpTo'),
                jump_to_confirm: t('consumptionReport.pagination.confirm'),
                page: t('consumptionReport.pagination.page'),
                prev_page: t('consumptionReport.pagination.prevPage'),
                next_page: t('consumptionReport.pagination.nextPage'),
                prev_5: t('consumptionReport.pagination.prev5'),
                next_5: t('consumptionReport.pagination.next5'),
                prev_3: t('consumptionReport.pagination.prev3'),
                next_3: t('consumptionReport.pagination.next3'),
              },
            }}
            loading={loading}
            className="report-table"
            locale={{
              emptyText: (
                <div className="py-12">
                  <Empty
                    description={
                      <span className="text-gray-500">
                        {t('consumptionReport.messages.noData')}
                      </span>
                    }
                  />
                </div>
              )
            }}
            summary={() => allItems.length > 0 && (
              <>
                {discounts.totalDiscounts > 0 && (
                  <Table.Summary.Row className="bg-purple-50 dark:bg-purple-900/20">
                    <Table.Summary.Cell index={0} colSpan={3} align={rtl.isRTL ? 'right' : 'left'} className="text-purple-700 dark:text-purple-300 py-2">
                      <span className="flex items-center gap-2">
                        💰 الخصومات
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="center" className="py-2">
                      <div className="text-purple-700 dark:text-purple-300 font-medium">
                        <span>الخصومات: -{formatCurrency(discounts.totalDiscounts)}</span>
                      </div>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              <Table.Summary.Row className="bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-700 dark:to-blue-600 hover:from-blue-700 hover:to-blue-600 dark:hover:from-blue-800 dark:hover:to-blue-700 border-t-2 border-blue-700 dark:border-blue-500">
                <Table.Summary.Cell
                  index={0}
                  colSpan={3}
                  align={rtl.isRTL ? 'right' : 'left'}
                  className="font-bold text-lg text-white py-4"
                >
                  <span className="flex items-center gap-2">
                    <BarChartOutlined className="text-white" />
                    {t('consumptionReport.table.grandTotal')}
                  </span>
                </Table.Summary.Cell>
                <Table.Summary.Cell
                  index={1}
                  align="center"
                  className="font-bold text-lg text-white py-4"
                >
                  <div className="flex items-center justify-center gap-3">
                    {discounts.totalDiscounts > 0 && activeAllCat === 'all' && (
                      <div className="text-center">
                        <span className="text-sm text-blue-200 line-through block">{showTotalSales ? formatCurrency(totalSales) : '••••••'}</span>
                        <span className="text-sm text-purple-200 block">خصم: -{showTotalSales ? formatCurrency(discounts.totalDiscounts) : '••••••'}</span>
                      </div>
                    )}
                    <span className="text-xl">{showTotalSales ? formatCurrency(activeAllCat === 'all' ? totalSales - discounts.totalDiscounts : calculateTotal(shownAll)) : '••••••'}</span>
                    <button
                      onClick={() => setShowTotalSales(!showTotalSales)}
                      title={showTotalSales ? t('consumptionReport.stats.hideAmount') : t('consumptionReport.stats.showAmount')}
                      className="p-2 hover:bg-blue-700 dark:hover:bg-blue-800 rounded-lg transition-colors text-white"
                    >
                      {showTotalSales ? <EyeInvisibleOutlined className="text-lg" /> : <EyeOutlined className="text-lg" />}
                    </button>
                    <button
                      onClick={() => void printReport()}
                      title="طباعة كل الأقسام"
                      className="p-2 hover:bg-blue-700 dark:hover:bg-blue-800 rounded-lg transition-colors text-white"
                    >
                      <PrinterOutlined className="text-lg" />
                    </button>
                  </div>
                </Table.Summary.Cell>
              </Table.Summary.Row>
              </>
            )}
          />
        </div>
        );
      })(),
    };

    // Create tabs for menu sections + PlayStation + Computer
    const allSections = [
      ...menuSections.filter(s => s.name !== 'أخرى').map(s => s.name),
      OTHER_SECTION_KEY,
      '__PLAYSTATION__',
      '__COMPUTER__'
    ];
    
    const sectionTabs = allSections.map(sectionName => {
      const items = consumptionData[sectionName] || [];
      const sectionTotal = calculateTotal(items);
      const hasItems = items.length > 0;
      
      // Get translated name for gaming sections
      const displayName = sectionName === OTHER_SECTION_KEY
        ? 'أخرى'
        : sectionName === '__PLAYSTATION__'
        ? t('consumptionReport.categories.playstation')
        : sectionName === '__COMPUTER__'
        ? t('consumptionReport.categories.computer')
        : sectionName;

      return {
        key: sectionName,
        label: (
          <div className="flex items-center">
            {getCategoryIcon(displayName)}
            <span className={!hasItems ? 'opacity-60' : 'font-medium'}>
              {displayName}
            </span>
            {hasItems && (
              <span className="bg-blue-100 text-blue-600 text-xs font-medium px-2 py-0.5 rounded-full mr-2">
                {formatDecimal(items.length, i18n.language)}
              </span>
            )}
          </div>
        ),
        children: (() => {
          const cats = groupByCategory(items);
          const activeCat = catFilter[sectionName] || 'all';
          const shown = activeCat === 'all' ? items : items.filter((it) => (it.menuCategory || it.category || OTHER_SECTION_KEY) === activeCat);
          return (
            <div className="border-t border-gray-100">
              {cats.length > 0 && (
                <div className="flex gap-1 overflow-x-auto px-3 sm:px-4 border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setCatFilter((p) => ({ ...p, [sectionName]: 'all' }))}
                    className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px whitespace-nowrap transition-colors ${activeCat === 'all' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400'}`}
                  >
                    {t('consumptionReport.tabs.all')}
                    <span className={`mr-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeCat === 'all' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                      {formatDecimal(items.length, i18n.language)}
                    </span>
                  </button>
                  {cats.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setCatFilter((p) => ({ ...p, [sectionName]: c.key }))}
                      className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px whitespace-nowrap transition-colors ${activeCat === c.key ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400'}`}
                    >
                      {c.name}
                      <span className={`mr-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeCat === c.key ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                        {formatDecimal(c.items.length, i18n.language)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <Table
                columns={columns}
                dataSource={shown}
                rowKey="id"
                scroll={{ x: 'max-content' }}
                pagination={{
                  pageSize: pageSize,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '20', '50', '100'],
                  onShowSizeChange: (_current, size) => setPageSize(size),
                  showTotal: (total) => (
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                      {t('consumptionReport.pagination.total', { count: total })}
                    </span>
                  ),
                  position: ['bottomCenter'],
                  className: 'px-4 py-3',
                  locale: pagerLocale,
                }}
                loading={loading}
                className="report-table"
                locale={{
                  emptyText: (
                    <div className="py-12">
                      <Empty
                        description={
                          <span className="text-gray-500">
                            {t('consumptionReport.messages.noCategoryData')}
                          </span>
                        }
                      />
                    </div>
                  )
                }}
              />
              {hasItems && renderSectionFooter(sectionName, sectionTotal, activeCat === 'all' ? undefined : calculateTotal(shown))}
            </div>
          );
        })(),
      };
    });

    return [allTab, ...sectionTabs];
  }, [allItems, columns, consumptionData, discounts, sectionDiscounts, error, loading, totalSales, showTotalSales, showSectionTotals, catFilter, menuSections, pageSize, t, i18n.language, printReport]);


  // Add custom styles
  const tableStyles = `
    .report-table .ant-table {
      border-radius: 0;
      background: transparent;
    }

    .report-table .ant-table-thead > tr > th {
      background: #f9fafb;
      color: #374151;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
      border-bottom: 2px solid #e5e7eb;
      padding: 16px 12px;
    }

    .dark .report-table .ant-table-thead > tr > th {
      background: #1f2937;
      color: #f3f4f6;
      border-bottom: 2px solid #374151;
    }

    .report-table .ant-table-thead > tr > th.ant-table-column-has-sorters:hover,
    .report-table .ant-table-thead > tr > th.ant-table-column-sort {
      background: #f3f4f6;
    }

    .dark .report-table .ant-table-thead > tr > th.ant-table-column-has-sorters:hover,
    .dark .report-table .ant-table-thead > tr > th.ant-table-column-sort,
    .dark .report-table .ant-table-thead > tr > th.ant-table-cell-scrollbar {
      background: #374151 !important;
      color: #f3f4f6 !important;
    }

    .report-table .ant-table-tbody > tr > td,
    .report-table .ant-table-tbody > tr > td.ant-table-column-sort,
    .report-table .ant-table-tbody > tr > td.ant-table-cell-row-hover {
      border-bottom: 1px solid #f3f4f6;
      transition: background 0.2s;
      padding: 14px 12px;
      background: white;
    }

    .dark .report-table .ant-table-tbody > tr > td,
    .dark .report-table .ant-table-tbody > tr > td.ant-table-column-sort,
    .dark .report-table .ant-table-tbody > tr > td.ant-table-cell-row-hover {
      border-bottom: 1px solid #374151;
      background: #1f2937 !important;
    }

    .report-table .ant-table-tbody > tr.ant-table-row:hover > td,
    .report-table .ant-table-tbody > tr:hover > td {
      background: #f9fafb !important;
    }

    .dark .report-table .ant-table-tbody > tr.ant-table-row:hover > td,
    .dark .report-table .ant-table-tbody > tr:hover > td,
    .dark .report-table .ant-table-tbody > tr > td.ant-table-cell-row-hover {
      background: #374151 !important;
    }

    .report-tabs .ant-tabs-nav {
      margin: 0;
      padding: 0 1rem;
    }

    .report-tabs .ant-tabs-tab {
      padding: 1rem 1rem;
      margin: 0 0.25rem;
      font-weight: 600;
      color: #6b7280;
      transition: all 0.2s;
    }

    .dark .report-tabs .ant-tabs-tab {
      color: #9ca3af;
    }

    .report-tabs .ant-tabs-tab:hover {
      color: #3b82f6;
    }

    .dark .report-tabs .ant-tabs-tab:hover {
      color: #60a5fa;
    }

    .report-tabs .ant-tabs-tab-active {
      color: #3b82f6 !important;
      font-weight: 700;
    }

    .dark .report-tabs .ant-tabs-tab-active {
      color: #60a5fa !important;
    }

    .report-tabs .ant-tabs-ink-bar {
      background: #3b82f6;
      height: 3px !important;
    }

    .dark .report-tabs .ant-tabs-ink-bar {
      background: #60a5fa;
    }
  `;

  // Add styles to the document head
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = tableStyles;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);



  return (
    <>
      {location.state?.printOnLogout && logoutPrintLoading && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-sm flex-col items-center rounded-2xl bg-white p-7 text-center shadow-2xl dark:bg-gray-900">
            <Spin size="large" />
            <h2 className="mt-5 text-lg font-bold text-gray-900 dark:text-white">
              {loading
                ? t('consumptionReport.logoutLoadingData', 'جاري جلب بيانات تقرير الاستهلاك...')
                : t('consumptionReport.logoutPrinting', 'جاري طباعة تقرير الاستهلاك...')}
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {t('consumptionReport.logoutPleaseWait', 'برجاء الانتظار حتى انتهاء الطباعة')}
            </p>
          </div>
        </div>
      )}
      <ConfigProvider
      direction={rtl.dir as 'ltr' | 'rtl'}
      locale={getAntdLocale(i18n.language)}
      theme={{
        token: {
          fontFamily: 'Tajawal, sans-serif',
        },
      }}
      >
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-2 sm:p-4 md:p-6 transition-colors duration-300" dir={rtl.dir}>
      {/* Header Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-200 dark:border-gray-700 transition-all duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <BarChartOutlined className="text-white text-2xl sm:text-3xl" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">{t('consumptionReport.title')}</h1>
              <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{t('consumptionReport.subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              onClick={() => {
                hasLoadedInitialData.current = false;
                fetchData(true);
              }}
              disabled={loading}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 font-medium disabled:opacity-50"
            >
              <ReloadOutlined spin={loading} />
              <span>{t('consumptionReport.buttons.refresh')}</span>
            </button>
            <button
              onClick={() => printReport()}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 font-medium"
            >
              <PrinterOutlined />
              <span>{t('consumptionReport.buttons.print')}</span>
            </button>
            <button
              onClick={() => exportToPDF()}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 font-medium border-0"
            >
              <DownloadOutlined />
              <span>{t('consumptionReport.buttons.export')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date/Time Filter — Bills style */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{t('consumptionReport.dateRange.startTime')}</div>
              <div className="flex gap-1.5 items-center">
                <DatePicker
                  value={dateRange[0]}
                  onChange={(date) => handleDateChange([date, dateRange[1]], 'start')}
                  className="flex-1 min-w-0"
                  format="YYYY/MM/DD"
                  allowClear={false}
                  placeholder={t('consumptionReport.dateRange.startDatePlaceholder')}
                  disabled={!canEditDateRange}
                />
                <LocalizedTimePicker
                  value={timeRange[0]}
                  onChange={(time) => handleTimeChange(time, 'start')}
                  className="w-24"
                  minuteStep={15}
                  placeholder={t('consumptionReport.dateRange.startTimePlaceholder')}
                  disabled={!canEditDateRange}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{t('consumptionReport.dateRange.endTime')}</div>
              <div className="flex gap-1.5 items-center">
                <DatePicker
                  value={dateRange[1]}
                  onChange={(date) => handleDateChange([dateRange[0], date], 'end')}
                  className="flex-1 min-w-0"
                  format="YYYY/MM/DD"
                  allowClear={false}
                  placeholder={t('consumptionReport.dateRange.endDatePlaceholder')}
                  disabled={!canEditDateRange}
                />
                <LocalizedTimePicker
                  value={timeRange[1]}
                  onChange={(time) => handleTimeChange(time, 'end')}
                  className="w-24"
                  minuteStep={15}
                  placeholder={t('consumptionReport.dateRange.endTimePlaceholder')}
                  disabled={!canEditDateRange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards — Bills style */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4 sm:mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-center">
          <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
            {t('consumptionReport.stats.totalSales')}
            <button
              onClick={() => setShowTotalSales(!showTotalSales)}
              title={showTotalSales ? t('consumptionReport.stats.hideAmount') : t('consumptionReport.stats.showAmount')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              {showTotalSales ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            </button>
          </div>
          <div className="text-base sm:text-lg font-extrabold text-blue-600 dark:text-blue-400">
            {showTotalSales ? formatCurrency(totalSales - discounts.totalDiscounts) : '••••••'}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-center">
          <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{t('consumptionReport.stats.itemsSold')}</div>
          <div className="text-base sm:text-lg font-extrabold text-green-600 dark:text-green-400">
            {formatDecimal(allItems.length, i18n.language)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-center col-span-2 sm:col-span-1">
          <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{t('consumptionReport.stats.categoriesCount')}</div>
          <div className="text-base sm:text-lg font-extrabold text-purple-600 dark:text-purple-400">
            {formatDecimal(Object.keys(consumptionData).length, i18n.language)}
          </div>
        </div>
      </div>

      {/* المدفوعات حسب النوع — نفس فلتر التاريخ */}
      {paymentsByMethod && (
        <div className="mb-4 sm:mb-6">
          <PaymentsByMethodCards data={paymentsByMethod} formatCurrency={formatCurrency} />
          <DrawerBreakdownCards
            data={{ drawers: (paymentsByMethod as any)?.drawers, discounts: (paymentsByMethod as any)?.discounts, outstanding: (paymentsByMethod as any)?.outstanding, total: (paymentsByMethod as any)?.total, count: (paymentsByMethod as any)?.count }}
            formatCurrency={formatCurrency}
          />
          <DeliveryFeesCards
            data={(paymentsByMethod as any)?.deliveryFees || null}
            formatCurrency={formatCurrency}
          />
        </div>
      )}

      {/* Data Table Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 transition-all duration-300">
        <Spin spinning={loading} tip={t('consumptionReport.messages.loading')}>
          {error ? (
            <div className="py-12">
              <Empty
                description={
                  <div className="space-y-4">
                    <div className="text-red-500 dark:text-red-400 text-lg font-medium">
                      <ExclamationCircleOutlined className="ml-2" />
                      {t('consumptionReport.messages.loadErrorOccurred')}
                    </div>
                    <button
                      onClick={() => fetchData(true)}
                      disabled={loading}
                      className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 font-medium disabled:opacity-50"
                    >
                      <ReloadOutlined spin={loading} />
                      {t('consumptionReport.buttons.retry')}
                    </button>
                  </div>
                }
              />
            </div>
          ) : (
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={tabItems}
              tabBarExtraContent={{
    left: (
      <div className="flex items-center text-sm text-gray-700 dark:text-gray-300 font-medium">
        <span className="ml-2">{t('consumptionReport.pagination.show')}</span>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="mr-2 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm w-20 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-all duration-200"
        >
          <option value="10">{formatDecimal(10, i18n.language)}</option>
          <option value="20">{formatDecimal(20, i18n.language)}</option>
          <option value="50">{formatDecimal(50, i18n.language)}</option>
          <option value="100">{formatDecimal(100, i18n.language)}</option>
        </select>
        <span>{t('consumptionReport.pagination.perPage')}</span>
      </div>
    )
  }}
              className="report-tabs"
              tabBarStyle={{
                padding: '0 16px',
                margin: 0,
                background: 'transparent',
                borderBottom: '1px solid',
                borderColor: 'rgb(229 231 235 / 1)'
              }}
            />
          )}
        </Spin>
      </div>
    </div>
      </ConfigProvider>
    </>
  );
};

export default ConsumptionReport;
