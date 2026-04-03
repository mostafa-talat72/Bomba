import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ConfigProvider, Table, DatePicker, Tabs, Spin, Empty, TimePicker } from 'antd';
import {
  ShoppingCartOutlined,
  CoffeeOutlined,
  FireOutlined,
  ShoppingFilled,
  ReloadOutlined,
  DownloadOutlined,
  CalendarOutlined,
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
import { Order, Session } from '../services/api';
import api from '../services/api';
import { formatDecimal, formatCurrency as formatCurrencyUtil, replaceAMPM } from '../utils/formatters';

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
}

const ConsumptionReport = () => {
  const { t, i18n } = useTranslation();
  const rtl = useRTL();
  const { menuItems, fetchMenuItems, menuSections, fetchMenuSections, user } = useApp();
  
  // Helper function to format currency with organization settings
  const formatCurrency = useCallback((amount: number) => {
    const currency = localStorage.getItem('organizationCurrency') || 'EGP';
    return formatCurrencyUtil(amount, i18n.language, currency);
  }, [i18n.language]);
  
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().set('hour', 0).set('minute', 0).set('second', 0),
    dayjs().set('hour', 23).set('minute', 59).set('second', 59)
  ]);
  const [timeRange, setTimeRange] = useState<[Dayjs, Dayjs]>([
    dayjs().set('hour', 0).set('minute', 0),
    dayjs().set('hour', 23).set('minute', 59)
  ]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [pageSize, setPageSize] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [consumptionData, setConsumptionData] = useState<Record<string, ConsumptionItem[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [showTotalSales, setShowTotalSales] = useState(false);
  const [showSectionTotals, setShowSectionTotals] = useState<Record<string, boolean>>({});
  
  // Track if initial data has been loaded
  const hasLoadedInitialData = useRef(false);

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
      align: (rtl.isRTL ? 'right' : 'left') as const,
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
        
        // For Gaming Devices, show hours
        if (isGamingDevice) {
          // Check if hours is integer
          const isInteger = quantity % 1 === 0;
          const formatted = isInteger ? quantity.toFixed(0) : quantity.toFixed(2);
          const localizedNumber = formatDecimal(parseFloat(formatted), i18n.language);
          
          return (
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {localizedNumber} {t('consumptionReport.units.hours')}
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

  const processOrdersAndSessions = useCallback((ordersToProcess: Order[], sessionsToProcess: Session[]) => {
    const itemsBySection: Record<string, ConsumptionItem[]> = {};

    // Initialize all menu sections with empty arrays
    menuSections.forEach(section => {
      itemsBySection[section.name] = [];
    });

    // Add separate sections for PlayStation and Computer using keys
    itemsBySection['__PLAYSTATION__'] = [];
    itemsBySection['__COMPUTER__'] = [];

    // Process cafe orders directly
    ordersToProcess.forEach((order) => {
      if (!order.items || !Array.isArray(order.items)) return;

      order.items.forEach((item) => {
        if (!item.name) return;

        // البحث عن MenuItem - أولاً بـ ID إذا كان متوفراً، ثم بالاسم كـ fallback
        let menuItem = null;
        
        // إذا كان العنصر يحتوي على menuItemId، استخدمه
        if ((item as any).menuItemId) {
          menuItem = menuItems.find((m) => m._id === (item as any).menuItemId || m.id === (item as any).menuItemId);
        }
        
        // Fallback: البحث بالاسم (للتوافق مع البيانات القديمة)
        if (!menuItem && item.name) {
          menuItem = menuItems.find((m) => m.name === item.name);
        }
        
        if (!menuItem) return;

        // Get the section name from the menu item's category
        let sectionName = 'أخرى';
        if (menuItem.category) {
          const categoryObj = typeof menuItem.category === 'string' 
            ? null 
            : menuItem.category;
          
          if (categoryObj && categoryObj.section) {
            const sectionObj = typeof categoryObj.section === 'string'
              ? menuSections.find(s => s._id === categoryObj.section || s.id === categoryObj.section)
              : categoryObj.section;
            
            if (sectionObj) {
              sectionName = sectionObj.name;
            }
          }
        }

        const itemPrice = Number(item.price) || 0;
        const itemQuantity = Number(item.quantity) || 0;

        if (!itemsBySection[sectionName]) {
          itemsBySection[sectionName] = [];
        }

        const existingItem = itemsBySection[sectionName].find(i => i.name === item.name);
        if (existingItem) {
          existingItem.quantity += itemQuantity;
          existingItem.total = existingItem.quantity * existingItem.price;
        } else {
          itemsBySection[sectionName].push({
            id: (item as any)._id || Math.random().toString(),
            name: item.name,
            price: itemPrice,
            quantity: itemQuantity,
            total: itemPrice * itemQuantity,
            category: sectionName
          });
        }
      });
    });

   
    sessionsToProcess.forEach((session) => {
      // Process both PlayStation and Computer sessions
      if (session.deviceType !== 'playstation' && session.deviceType !== 'computer') return;
      
      // Only include completed sessions
      if (session.status !== 'completed') return;

      // Skip sessions without endTime
      if (!session.endTime) return;

      const deviceName = session.deviceName || `جهاز ${session.deviceNumber}`;
      
      // Use finalCost (after discount) as the session cost
      // finalCost = totalCost - discount
      const sessionCost = Number(session.finalCost) || 0;
      
      // Calculate total hours from controllersHistory if available
      let totalHours = 0;
      
      if (session.controllersHistory && Array.isArray(session.controllersHistory) && session.controllersHistory.length > 0) {
        // Use controllersHistory for accurate hour calculation
        session.controllersHistory.forEach((period: any) => {
          const periodStart = new Date(period.from).getTime();
          const periodEnd = period.to ? new Date(period.to).getTime() : (session.endTime ? new Date(session.endTime).getTime() : Date.now());
          const periodDurationMs = periodEnd - periodStart;
          const periodHours = periodDurationMs / (1000 * 60 * 60);
          totalHours += periodHours;
        });
      } else {
        // Fallback: Calculate from startTime and endTime
        const startTime = new Date(session.startTime).getTime();
        const endTime = new Date(session.endTime).getTime();
        const durationMs = endTime - startTime;
        totalHours = durationMs / (1000 * 60 * 60);
      }


      // Determine which section to add to based on device type
      const sectionName = session.deviceType === 'computer' ? '__COMPUTER__' : '__PLAYSTATION__';
      
      // Group by device name - sum hours and costs for each device
      const existingItem = itemsBySection[sectionName].find(i => i.name === deviceName);
      
      if (existingItem) {
        existingItem.quantity += totalHours; // Add hours
        existingItem.total += sessionCost; // Add total cost
      } else {
        itemsBySection[sectionName].push({
          id: session._id || session.id || Math.random().toString(),
          name: deviceName,
          price: 0, // Will show as "-" in the table
          quantity: totalHours, // Total hours from controllersHistory
          total: sessionCost, // Total cost
          category: sectionName
        });
      }
    });

    // Sort items by total (descending) within each section
    Object.values(itemsBySection).forEach(items => {
      items.sort((a, b) => b.total - a.total);
    });

    // Remove empty sections
    Object.keys(itemsBySection).forEach(section => {
      if (itemsBySection[section].length === 0) {
        delete itemsBySection[section];
      }
    });

    return itemsBySection;
  }, [menuItems, menuSections]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!dateRange[0] || !dateRange[1]) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch basic data (menu items, sections)
      if (!hasLoadedInitialData.current || forceRefresh) {
        
        await Promise.all([
          menuItems.length === 0 ? fetchMenuItems() : Promise.resolve(),
          menuSections.length === 0 ? fetchMenuSections() : Promise.resolve(),
        ]);
        
        hasLoadedInitialData.current = true;
      }

      // Fetch orders and sessions directly from API with date filtering
      // Convert dayjs to Date object to preserve local timezone, then to ISO string
      // This ensures the backend receives the correct local time
      const startDateISO = dateRange[0].toDate().toISOString();
      const endDateISO = dateRange[1].toDate().toISOString();
      
      
      const [ordersResponse, sessionsResponse] = await Promise.all([
        api.getOrders({ 
          limit: 10000,
          startDate: startDateISO,
          endDate: endDateISO
        }), // Fetch orders in date range
        api.getSessions({ 
          status: 'completed', 
          limit: 10000,
          startDate: startDateISO,
          endDate: endDateISO
        }) // Fetch completed sessions in date range
      ]);
      
      if (ordersResponse.success && ordersResponse.data && sessionsResponse.success && sessionsResponse.data) {
        // Data is already filtered by backend based on date range
        const filteredOrders = ordersResponse.data;
        const allSessions = sessionsResponse.data;
        
        // Filter gaming sessions (PlayStation & Computer) only (backend already filtered by date and status)
        const filteredSessions = allSessions.filter((session) => {
          return (session.deviceType === 'playstation' || session.deviceType === 'computer') && session.endTime;
        });
        
        
      
        const processedData = processOrdersAndSessions(filteredOrders, filteredSessions);
        setConsumptionData(processedData);
      } else {
        console.error('❌ Failed to fetch data:', {
          orders: ordersResponse.message,
          sessions: sessionsResponse.message
        });
        toast.error(t('consumptionReport.messages.loadError'));
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('consumptionReport.messages.unexpectedError');
      setError(errorMessage);
      toast.error(t('consumptionReport.messages.loadErrorDetail', { error: errorMessage }));
      console.error('❌ Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, fetchMenuItems, fetchMenuSections, menuItems, menuSections, processOrdersAndSessions, t]);


  const calculateTotal = (items: ConsumptionItem[]): number => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const printReport = () => {
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

      // Create separate pages for each category
      const categories = Object.entries(consumptionData).filter(([_, items]) => items.length > 0);
      
      const categoryPages = categories
        .map(([category, items]) => {
          const categoryTotal = calculateTotal(items);
          
          // Translate category name if it's a gaming device
          const displayCategory = category === '__PLAYSTATION__' 
            ? t('consumptionReport.categories.playstation')
            : category === '__COMPUTER__'
            ? t('consumptionReport.categories.computer')
            : category;
          
          return `
            <div class="page">
              <div class="page-content">
                <div class="header">
                  <div class="org-name">${organizationName}</div>
                  <div class="title">${t('consumptionReport.print.title')}</div>
                  <div class="category-name">${displayCategory}</div>
                  <div class="date-info"><strong>${t('consumptionReport.print.from')}:</strong> ${formatDate(dateRange[0])}</div>
                  <div class="date-info"><strong>${t('consumptionReport.print.to')}:</strong> ${formatDate(dateRange[1])}</div>
                  <div class="date-info"><strong>${t('consumptionReport.print.date')}:</strong> ${formatDate(dayjs())}</div>
                </div>

                <div class="divider"></div>
                
                <table class="items-table">
                  <thead>
                    <tr>
                      <th>${t('consumptionReport.table.itemName')}</th>
                      <th>${t('consumptionReport.table.quantity')}</th>
                      <th>${t('consumptionReport.table.unitPrice')}</th>
                      <th>${t('consumptionReport.table.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.map(item => {
                      const isGamingDevice = item.category === '__PLAYSTATION__' || item.category === '__COMPUTER__';
                      const quantityDisplay = isGamingDevice 
                        ? `${formatDecimal(item.quantity, i18n.language)} ${t('consumptionReport.units.hours')}`
                        : formatDecimal(Math.round(item.quantity), i18n.language);
                      const unitPriceDisplay = isGamingDevice 
                        ? '-' 
                        : formatCurrency(item.price);
                      
                      return `
                        <tr>
                          <td class="item-name">${item.name}</td>
                          <td class="item-quantity">${quantityDisplay}</td>
                          <td class="item-price">${unitPriceDisplay}</td>
                          <td class="item-total">${formatCurrency(item.total)}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>

                <div class="divider"></div>

                <div class="category-total">
                  <strong>${t('consumptionReport.print.categoryTotal', { category: displayCategory })}:</strong> ${formatCurrency(categoryTotal)}
                </div>

                <div class="thank-you">${t('consumptionReport.print.thankYou')}</div>
              </div>
              
              <div class="footer">
                <div><strong>${t('consumptionReport.print.footer')}</strong></div>
              </div>
            </div>
          `;
        }).join('');

      const printContent = `
        <!DOCTYPE html>
        <html dir="${dir}" lang="${i18n.language}">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${t('consumptionReport.print.title')}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
            * { 
              font-family: 'Tajawal', sans-serif; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              box-sizing: border-box;
            }
            body { 
              margin: 0; 
              padding: ${isRTL ? '0 12px 0 4px' : '0 4px 0 12px'}; 
              font-size: 11px; 
              color: #000; 
              font-weight: 600;
              width: auto;
              max-width: auto;
              text-align: center;
              direction: ${dir};
            }
            .page {
              padding: ${isRTL ? '8px 10px 8px 4px' : '8px 4px 8px 10px'};
            }
            .page-content {
              width: 100%;
            }
            .header { 
              text-align: center; 
              margin-bottom: 8px;
              margin-top: 0;
              font-weight: 700;
              border-bottom: 2px dashed #000;
              padding-bottom: 6px;
            }
            .org-name { 
              font-size: 1.4em; 
              font-weight: 900; 
              margin-bottom: 6px; 
              color: #000;
            }
            .title { 
              font-size: 1.1em; 
              font-weight: 800; 
              margin-bottom: 6px; 
              color: #000;
            }
            .category-name {
              font-size: 1.2em;
              font-weight: 800;
              margin-bottom: 8px;
              color: #000;
              background: #e0e0e0;
              padding: 6px;
              border-radius: 4px;
            }
            .date-info { 
              margin-bottom: 4px; 
              font-weight: 600;
              font-size: 0.9em;
            }
            .divider { 
              border-top: 2px dashed #000; 
              margin: 10px 0; 
            }
            .items-table { 
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 10px;
              font-size: 0.85em;
              border: 2px solid #000;
              table-layout: fixed;
              direction: ${dir};
            }
            .items-table thead {
              background: #e0e0e0;
              font-weight: 800;
            }
            .items-table th {
              padding: 4px 3px;
              text-align: center;
              border: 1.5px solid #000;
              font-size: 0.9em;
              word-wrap: break-word;
            }
            .items-table td {
              padding: 3px 3px;
              text-align: center;
              border: 1px solid #000;
              font-weight: 600;
              word-wrap: break-word;
              overflow-wrap: break-word;
            }
            .items-table th {
              width: 16.67% !important;
            }
            .items-table th:first-child {
              text-align: center;
              padding-${isRTL ? 'left' : 'right'}: 5px;
              width: 50% !important;
            }
            .items-table td {
              width: 16.67% !important;
            }
            .items-table .item-name {
              text-align: center;
              font-weight: 700;
              padding-${isRTL ? 'left' : 'right'}: 5px;
              width: 50% !important;
            }
            .items-table .item-quantity {
              font-weight: 600;
            }
            .items-table .item-price {
              font-weight: 600;
            }
            .items-table .item-total {
              font-weight: 800;
              color: #000;
            }
            .category-total {
              text-align: center;
              font-size: 1.2em;
              font-weight: 800;
              color: #000;
              padding: 10px;
              background: #f0f0f0;
              border-radius: 4px;
              margin-top: 10px;
            }
            .footer { 
              margin-top: auto;
              text-align: center; 
              font-size: 0.85em; 
              color: #333;
              border-top: 2px dashed #000;
              padding-top: 8px;
              padding-bottom: 8px;
              font-weight: 700;
            }
            .thank-you { 
              text-align: center; 
              margin-top: 12px; 
              margin-bottom: 10px;
              font-size: 1.1em; 
              font-weight: 700; 
            }
            strong { 
              font-weight: 800; 
            }
            
            @media print {
              @page { 
                size: auto;
                margin: 0; 
              }
              html, body { 
                margin: 0; 
                padding: 0;
                width: auto;
              }
              body { 
                padding: ${isRTL ? '4px 8px 4px 2px' : '4px 2px 4px 8px'}; 
                font-weight: 600;
                direction: ${dir};
              }
              .no-print { 
                display: none !important; 
              }
              .page {
                padding: 4px 6px !important;
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
                max-width: auto;
                margin: 0 auto;
                background: #fff;
              }
            }
          </style>
        </head>
        <body>
          ${categoryPages}
          
          <div class="no-print" style="margin-top: 20px; text-align: center; padding: 10px;">
            <button onclick="window.print()" style="
              background: #4CAF50;
              color: white;
              border: none;
              padding: 10px 20px;
              text-align: center;
              text-decoration: none;
              display: inline-block;
              font-size: 14px;
              font-weight: 700;
              cursor: pointer;
              border-radius: 4px;
            ">
              ${t('consumptionReport.print.printButton')}
            </button>
          </div>
        </body>
        </html>
      `;

      // Create hidden iframe for printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
      
      const iframeDoc = iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(printContent);
        iframeDoc.close();
        
        
        // Wait for content and fonts to load then print
        iframe.contentWindow?.addEventListener('load', () => {
          
          setTimeout(() => {
            // Give extra time for rendering
            setTimeout(() => {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
              
              // Remove iframe after printing
              setTimeout(() => {
                if (document.body.contains(iframe)) {
                  document.body.removeChild(iframe);
                }
              }, 1000);
            }, 800);
          }, 500);
        });
        
        toast.success(t('consumptionReport.messages.printOpening'));
      } else {
        toast.error(t('consumptionReport.messages.printError'));
        document.body.removeChild(iframe);
      }
    } catch (error) {
      toast.error(t('consumptionReport.messages.printFailed'));
      console.error('Print error:', error);
    }
  };

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
      doc.text(`إجمالي المبيعات: ${totalSales.toFixed(2)} ج.م`, 20, 45);
      doc.text(`عدد الأصناف: ${allItems.length}`, pageWidth - 20, 45, { align: 'right' });

      // Add a line separator
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 50, pageWidth - 20, 50);

      // Function to add a table for a category
      const addCategoryTable = (category: string, items: ConsumptionItem[], startY: number) => {
        const headers = [['الكمية', 'سعر الوحدة', 'الإجمالي', 'اسم الصنف']];
        const data = items.map(item => [
          item.quantity.toString(),
          item.price.toFixed(2) + ' ج.م',
          item.total.toFixed(2) + ' ج.م',
          item.name
        ]);

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
    if (!newDates) return;

    if (type === 'start' && newDates[0]) {
      const startDate = newDates[0]
        .set('hour', timeRange[0].hour())
        .set('minute', timeRange[0].minute())
        .set('second', 0);
      setDateRange([startDate, dateRange[1]]);
    } else if (type === 'end' && newDates[1]) {
      const endDate = newDates[1]
        .set('hour', timeRange[1].hour())
        .set('minute', timeRange[1].minute())
        .set('second', 59);
      setDateRange([dateRange[0], endDate]);
    }
  };

  const handleTimeChange = (time: Dayjs | null, type: 'start' | 'end') => {
    if (!time) return;

    if (type === 'start') {
      const newStartTime = time;
      const newStartDate = dateRange[0]
        .set('hour', newStartTime.hour())
        .set('minute', newStartTime.minute());
      setTimeRange([newStartTime, timeRange[1]]);
      setDateRange([newStartDate, dateRange[1]]);
    } else {
      const newEndTime = time;
      const newEndDate = dateRange[1]
        .set('hour', newEndTime.hour())
        .set('minute', newEndTime.minute());
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
      children: (
        <div className="border-t border-gray-100">
          <Table
            columns={columns}
            dataSource={allItems}
            rowKey="id"
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
                    <span className="text-xl">{showTotalSales ? formatCurrency(totalSales) : '••••••'}</span>
                    <button
                      onClick={() => setShowTotalSales(!showTotalSales)}
                      title={showTotalSales ? t('consumptionReport.stats.hideAmount') : t('consumptionReport.stats.showAmount')}
                      className="p-2 hover:bg-blue-700 dark:hover:bg-blue-800 rounded-lg transition-colors text-white"
                    >
                      {showTotalSales ? <EyeInvisibleOutlined className="text-lg" /> : <EyeOutlined className="text-lg" />}
                    </button>
                  </div>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
        </div>
      ),
    };

    // Create tabs for menu sections + PlayStation + Computer
    const allSections = [...menuSections.map(s => s.name), '__PLAYSTATION__', '__COMPUTER__'];
    
    const sectionTabs = allSections.map(sectionName => {
      const items = consumptionData[sectionName] || [];
      const sectionTotal = calculateTotal(items);
      const hasItems = items.length > 0;
      
      // Get translated name for gaming sections
      const displayName = sectionName === '__PLAYSTATION__' 
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
        children: (
          <div className="border-t border-gray-100">
            <Table
              columns={columns}
              dataSource={items}
              rowKey="id"
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
                          {t('consumptionReport.messages.noCategoryData')}
                        </span>
                      }
                    />
                  </div>
                )
              }}
              summary={() => hasItems && (
                <Table.Summary.Row className="bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-700 dark:to-blue-600 hover:from-blue-700 hover:to-blue-600 dark:hover:from-blue-800 dark:hover:to-blue-700 border-t-2 border-blue-700 dark:border-blue-500">
                  <Table.Summary.Cell
                    index={0}
                    colSpan={3}
                    align={rtl.isRTL ? 'right' : 'left'}
                    className="font-bold text-lg text-white py-4"
                  >
                    <span className="flex items-center gap-2">
                      {getCategoryIcon(displayName)}
                      {t('consumptionReport.table.categoryTotal', { category: displayName })}
                    </span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell
                    index={1}
                    align="center"
                    className="font-bold text-lg text-white py-4"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-xl">{showSectionTotals[sectionName] ? formatCurrency(sectionTotal) : '••••••'}</span>
                      <button
                        onClick={() => setShowSectionTotals(prev => ({ ...prev, [sectionName]: !prev[sectionName] }))}
                        title={showSectionTotals[sectionName] ? t('consumptionReport.stats.hideAmount') : t('consumptionReport.stats.showAmount')}
                        className="p-2 hover:bg-blue-700 dark:hover:bg-blue-800 rounded-lg transition-colors text-white"
                      >
                        {showSectionTotals[sectionName] ? <EyeInvisibleOutlined className="text-lg" /> : <EyeOutlined className="text-lg" />}
                      </button>
                    </div>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </div>
        ),
      };
    });

    return [allTab, ...sectionTabs];
  }, [allItems, columns, consumptionData, error, loading, totalSales, showTotalSales, showSectionTotals, menuSections, pageSize, t, i18n.language]);


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

    .report-table .ant-table-tbody > tr > td {
      border-bottom: 1px solid #f3f4f6;
      transition: background 0.2s;
      padding: 14px 12px;
      background: white;
    }

    .dark .report-table .ant-table-tbody > tr > td {
      border-bottom: 1px solid #374151;
      background: #1f2937;
    }

    .report-table .ant-table-tbody > tr:hover > td {
      background: #f9fafb !important;
    }

    .dark .report-table .ant-table-tbody > tr:hover > td {
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
    <ConfigProvider
      direction={rtl.dir}
      locale={getAntdLocale(i18n.language)}
      theme={{
        token: {
          fontFamily: 'Tajawal, sans-serif',
        },
      }}
    >
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6 transition-colors duration-300" dir={rtl.dir}>
      {/* Header Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700 transition-all duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-2xl flex items-center justify-center shadow-lg">
              <BarChartOutlined className="text-white text-3xl" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{t('consumptionReport.title')}</h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{t('consumptionReport.subtitle')}</p>
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

      {/* Date/Time Picker and Stats Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6" dir={rtl.dir}>
        {/* Date/Time Picker Card */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300">
            <div className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700">
              <h3 className="text-xl font-bold text-white flex items-center">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center ml-3">
                  <CalendarOutlined className="text-white text-lg" />
                </div>
                {t('consumptionReport.dateRange.title')}
              </h3>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-900">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Start Date/Time */}
                <div className="space-y-3">
                  <div className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <div className="w-3 h-3 bg-blue-500 dark:bg-blue-400 rounded-full ml-2"></div>
                    <span>{t('consumptionReport.dateRange.startTime')}</span>
                  </div>
                  <div className="space-y-3">
                    <DatePicker
                      value={dateRange[0]}
                      onChange={(date) => handleDateChange([date, dateRange[1]], 'start')}
                      className="w-full"
                      format="YYYY/MM/DD"
                      allowClear={false}
                      placeholder={t('consumptionReport.dateRange.startDatePlaceholder')}
                      size="large"
                    />
                    <TimePicker
                      value={timeRange[0]}
                      onChange={(time) => handleTimeChange(time, 'start')}
                      className="w-full"
                      format="hh:mm A"
                      minuteStep={15}
                      placeholder={t('consumptionReport.dateRange.startTimePlaceholder')}
                      size="large"
                    />
                  </div>
                </div>

                {/* End Date/Time */}
                <div className="space-y-3">
                  <div className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <div className="w-3 h-3 bg-green-500 dark:bg-green-400 rounded-full ml-2"></div>
                    <span>{t('consumptionReport.dateRange.endTime')}</span>
                  </div>
                  <div className="space-y-3">
                    <DatePicker
                      value={dateRange[1]}
                      onChange={(date) => handleDateChange([dateRange[0], date], 'end')}
                      className="w-full"
                      format="YYYY/MM/DD"
                      allowClear={false}
                      placeholder={t('consumptionReport.dateRange.endDatePlaceholder')}
                      size="large"
                    />
                    <TimePicker
                      value={timeRange[1]}
                      onChange={(time) => handleTimeChange(time, 'end')}
                      className="w-full"
                      format="hh:mm A"
                      minuteStep={15}
                      placeholder={t('consumptionReport.dateRange.endTimePlaceholder')}
                      size="large"
                    />
                  </div>
                </div>
              </div>

              {/* Selected Range Summary */}
              <div className="mt-6 p-5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">{t('consumptionReport.dateRange.from')}</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {replaceAMPM(dateRange[0]?.locale(i18n.language).format('dddd، D MMMM YYYY [' + t('consumptionReport.dateRange.at') + '] hh:mm A'))}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">{t('consumptionReport.dateRange.to')}</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {replaceAMPM(dateRange[1]?.locale(i18n.language).format('dddd، D MMMM YYYY [' + t('consumptionReport.dateRange.at') + '] hh:mm A'))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="space-y-4">
          {/* Total Sales Card */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-2xl shadow-lg p-6 text-white transition-all duration-300 hover:shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <BarChartOutlined className="text-2xl" />
              </div>
              <button
                onClick={() => setShowTotalSales(!showTotalSales)}
                title={showTotalSales ? t('consumptionReport.stats.hideAmount') : t('consumptionReport.stats.showAmount')}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors duration-200"
              >
                {showTotalSales ? <EyeInvisibleOutlined className="text-lg" /> : <EyeOutlined className="text-lg" />}
              </button>
            </div>
            <div className="text-3xl font-bold mb-2">
              {showTotalSales ? formatCurrency(totalSales) : '••••••'}
            </div>
            <div className="text-blue-100 text-sm font-medium">{t('consumptionReport.stats.totalSales')}</div>
          </div>

          {/* Items Count Card */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 rounded-2xl shadow-lg p-6 text-white transition-all duration-300 hover:shadow-xl">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-4">
              <ShoppingCartOutlined className="text-2xl" />
            </div>
            <div className="text-3xl font-bold mb-2">
              {formatDecimal(allItems.length, i18n.language)}
            </div>
            <div className="text-green-100 text-sm font-medium">{t('consumptionReport.stats.itemsSold')}</div>
          </div>

          {/* Categories Count Card */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 rounded-2xl shadow-lg p-6 text-white transition-all duration-300 hover:shadow-xl">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-4">
              <ShoppingFilled className="text-2xl" />
            </div>
            <div className="text-3xl font-bold mb-2">
              {formatDecimal(Object.keys(consumptionData).length, i18n.language)}
            </div>
            <div className="text-purple-100 text-sm font-medium">{t('consumptionReport.stats.categoriesCount')}</div>
          </div>
        </div>
      </div>

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
  );
};

export default ConsumptionReport;
