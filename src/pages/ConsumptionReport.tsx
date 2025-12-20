import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ConfigProvider, Table, DatePicker, Tabs, Spin, message, Empty, TimePicker } from 'antd';
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
import arEG from 'antd/locale/ar_EG';
import { useApp } from '../context/AppContext';
import { Order, Session } from '../services/api';
import api from '../services/api';

// تعيين اللغة الافتراضية ليوم جي إس إلى العربية
dayjs.locale('ar');

// دالة لتحويل الأرقام إلى العربية
const toArabicNumbers = (num: number | string): string => {
  if (num === null || num === undefined) return '';
  const arabicNumbers = '۰١٢٣٤٥٦٧٨٩';
  return String(num).replace(/[0-9]/g, (digit) => arabicNumbers[parseInt(digit)]);
};

// دالة لتنسيق الأرقام مع فواصل الآلاف وتحويلها للعربية - بدون أرقام عشرية
const formatNumber = (num: number): string => {
  const rounded = Math.round(num);
  const formatted = new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(rounded);
  
  // Convert to Arabic numbers
  return toArabicNumbers(formatted);
};

// Extend dayjs with plugins
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// Removed static CATEGORIES - will use dynamic menu sections instead

interface ConsumptionItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  category: string;
}

const ConsumptionReport = () => {
  const { menuItems, fetchMenuItems, menuSections, fetchMenuSections, user } = useApp();
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

  const allItems = useMemo(() => Object.values(consumptionData).flat(), [consumptionData]);
  const totalSales = useMemo(() => allItems.reduce((sum, item) => sum + item.total, 0), [allItems]);

  const columns = useMemo(() => [
    {
      title: 'اسم الصنف',
      dataIndex: 'name',
      key: 'name',
      align: 'right' as const,
      render: (text: string) => <span className="font-semibold text-gray-900 dark:text-gray-100">{text}</span>,
    },
    {
      title: 'الكمية',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center' as const,
      sorter: (a: ConsumptionItem, b: ConsumptionItem) => a.quantity - b.quantity,
      render: (quantity: number, record: ConsumptionItem) => {
        const isPlayStation = record.category === 'البلايستيشن';
        
        // For PlayStation, show hours
        if (isPlayStation) {
          // Check if hours is integer
          const isInteger = quantity % 1 === 0;
          const formatted = isInteger ? quantity.toFixed(0) : quantity.toFixed(2);
          // Replace dot with Arabic comma
          const arabicFormatted = toArabicNumbers(formatted.replace('.', '،'));
          
          return (
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {arabicFormatted} ساعة
            </span>
          );
        }
        
        // For other items, show as integer
        return (
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {toArabicNumbers(Math.round(quantity))}
          </span>
        );
      },
    },
    {
      title: 'سعر الوحدة',
      dataIndex: 'price',
      key: 'price',
      align: 'center' as const,
      render: (price: number, record: ConsumptionItem) => {
        const isPlayStation = record.category === 'البلايستيشن';
        
        // For PlayStation, show "-" instead of price
        if (isPlayStation) {
          return (
            <span className="font-semibold text-gray-500 dark:text-gray-400">
              -
            </span>
          );
        }
        
        return (
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {formatNumber(price)} ج.م
          </span>
        );
      },
      sorter: (a: ConsumptionItem, b: ConsumptionItem) => a.price - b.price,
    },
    {
      title: 'الإجمالي',
      dataIndex: 'total',
      key: 'total',
      align: 'center' as const,
      render: (total: number) => (
        <span className="font-bold text-blue-600 dark:text-blue-400">
          {formatNumber(total)} ج.م
        </span>
      ),
      sorter: (a: ConsumptionItem, b: ConsumptionItem) => a.total - b.total,
    },
  ], []);

  const processOrdersAndSessions = useCallback((ordersToProcess: Order[], sessionsToProcess: Session[]) => {
    const itemsBySection: Record<string, ConsumptionItem[]> = {};

    // Initialize all menu sections with empty arrays
    menuSections.forEach(section => {
      itemsBySection[section.name] = [];
    });

    // Add PlayStation section
    itemsBySection['البلايستيشن'] = [];

    // Process cafe orders directly
    ordersToProcess.forEach((order) => {
      if (!order.items || !Array.isArray(order.items)) return;

      order.items.forEach((item) => {
        if (!item.name) return;

        const menuItem = menuItems.find((m) => m.name === item.name);
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
      // Only process PlayStation sessions
      if (session.deviceType !== 'playstation') return;
      
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


      // Group by device name - sum hours and costs for each device
      const existingItem = itemsBySection['البلايستيشن'].find(i => i.name === deviceName);
      
      if (existingItem) {
        existingItem.quantity += totalHours; // Add hours
        existingItem.total += sessionCost; // Add total cost
      } else {
        itemsBySection['البلايستيشن'].push({
          id: session._id || session.id || Math.random().toString(),
          name: deviceName,
          price: 0, // Will show as "-" in the table
          quantity: totalHours, // Total hours from controllersHistory
          total: sessionCost, // Total cost
          category: 'البلايستيشن'
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
        
        // Filter PlayStation sessions only (backend already filtered by date and status)
        const filteredSessions = allSessions.filter((session) => {
          return session.deviceType === 'playstation' && session.endTime;
        });
        
        
      
        const processedData = processOrdersAndSessions(filteredOrders, filteredSessions);
        setConsumptionData(processedData);
      } else {
        console.error('❌ Failed to fetch data:', {
          orders: ordersResponse.message,
          sessions: sessionsResponse.message
        });
        message.error('فشل في تحميل البيانات');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
      setError(errorMessage);
      message.error(`فشل في تحميل البيانات: ${errorMessage}`);
      console.error('❌ Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, fetchMenuItems, fetchMenuSections, menuItems, menuSections, processOrdersAndSessions]);


  const calculateTotal = (items: ConsumptionItem[]): number => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const printReport = () => {
    try {
      // Format date like in bill print
      const formatDate = (date: Dayjs) => {
        return date.format('YYYY/MM/DD - hh:mm A');
      };

      // Get organization name from user or use default
      const organizationName = user?.organizationName || 'المنشأة';

      // Create separate pages for each category
      const categories = Object.entries(consumptionData).filter(([_, items]) => items.length > 0);
      
      const categoryPages = categories
        .map(([category, items]) => {
          const categoryTotal = calculateTotal(items);
          
          return `
            <div class="page">
              <div class="page-content">
                <div class="header">
                  <div class="org-name">${organizationName}</div>
                  <div class="title">تقرير الاستهلاك</div>
                  <div class="category-name">${category}</div>
                  <div class="date-info"><strong>من:</strong> ${formatDate(dateRange[0])}</div>
                  <div class="date-info"><strong>إلى:</strong> ${formatDate(dateRange[1])}</div>
                  <div class="date-info"><strong>تاريخ:</strong> ${formatDate(dayjs())}</div>
                </div>

                <div class="divider"></div>
                
                <table class="items-table">
                  <thead>
                    <tr>
                      <th>الصنف</th>
                      <th>الكمية</th>
                      <th>السعر</th>
                      <th>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.map(item => {
                      const isPlayStation = item.category === 'البلايستيشن';
                      const quantityDisplay = isPlayStation 
                        ? `${toArabicNumbers(item.quantity.toFixed(2).replace('.', '،'))} س`
                        : toArabicNumbers(Math.round(item.quantity));
                      const unitPriceDisplay = isPlayStation 
                        ? '-' 
                        : formatNumber(item.price);
                      
                      return `
                        <tr>
                          <td class="item-name">${item.name}</td>
                          <td class="item-quantity">${quantityDisplay}</td>
                          <td class="item-price">${unitPriceDisplay}</td>
                          <td class="item-total">${formatNumber(item.total)}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>

                <div class="divider"></div>

                <div class="category-total">
                  <strong>إجمالي ${category}:</strong> ${formatNumber(categoryTotal)} ج.م
                </div>

                <div class="thank-you">شكراً لكم</div>
              </div>
              
              <div class="footer">
                <div><strong>العبيلى</strong> لإدارة الكافيهات والمطاعم والترفيه</div>
              </div>
            </div>
          `;
        }).join('');

      const printContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>تقرير الاستهلاك</title>
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
              padding: 0 12px 0 4px; 
              font-size: 11px; 
              color: #000; 
              font-weight: 600;
              width: 80mm;
              max-width: 80mm;
              text-align: center;
              direction: rtl;
            }
            .page {
              padding: 8px 10px 8px 4px;
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
              direction: rtl;
            }
            .items-table thead {
              background: #e0e0e0;
              font-weight: 800;
            }
            .items-table th {
              padding: 4px 3px;
              text-align: right;
              border: 1.5px solid #000;
              font-size: 0.9em;
              word-wrap: break-word;
            }
            .items-table td {
              padding: 3px 3px;
              text-align: right;
              border: 1px solid #000;
              font-weight: 600;
              word-wrap: break-word;
              overflow-wrap: break-word;
            }
            .items-table th {
              width: 16.67% !important;
            }
            .items-table th:first-child {
              text-align: left;
              padding-left: 5px;
              width: 50% !important;
            }
            .items-table td {
              width: 16.67% !important;
            }
            .items-table .item-name {
              text-align: left;
              font-weight: 700;
              padding-left: 5px;
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
                size: 80mm auto;
                margin: 0; 
              }
              html, body { 
                margin: 0; 
                padding: 0;
                width: 80mm;
              }
              body { 
                padding: 4px 8px 4px 2px; 
                font-weight: 600;
                direction: rtl;
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
                max-width: 80mm;
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
              طباعة التقرير
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
        
        message.success('جاري فتح نافذة الطباعة...');
      } else {
        message.error('فشل في إنشاء نافذة الطباعة.');
        document.body.removeChild(iframe);
      }
    } catch (error) {
      message.error('حدث خطأ أثناء الطباعة');
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

      // Add date range
      doc.setFontSize(12);
      const dateRangeText = `الفترة من ${dateRange[0].format('YYYY/MM/DD HH:mm')} إلى ${dateRange[1].format('YYYY/MM/DD HH:mm')}`;
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

      message.success('تم تصدير التقرير بنجاح');
    } catch (error) {
      message.error('حدث خطأ أثناء تصدير التقرير');
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
          <span className="font-medium">الكل</span>
          {allItems.length > 0 && (
            <span className="bg-blue-100 text-blue-600 text-xs font-medium px-2 py-0.5 rounded-full mr-2">
              {toArabicNumbers(allItems.length)}
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
                  إجمالي {toArabicNumbers(total)} عنصر
                </span>
              ),
              position: ['bottomCenter'],
              className: 'px-4 py-3',
              locale: {
                items_per_page: '/ صفحة',
                jump_to: 'الذهاب إلى',
                jump_to_confirm: 'تأكيد',
                page: 'صفحة',
                prev_page: 'الصفحة السابقة',
                next_page: 'الصفحة التالية',
                prev_5: 'خمس صفحات سابقة',
                next_5: 'خمس صفحات تالية',
                prev_3: 'ثلاث صفحات سابقة',
                next_3: 'ثلاث صفحات تالية',
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
                        لا توجد بيانات متاحة للفترة المحددة
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
                  align="right"
                  className="font-bold text-lg text-white py-4"
                >
                  <span className="flex items-center gap-2">
                    <BarChartOutlined className="text-white" />
                    الإجمالي الكلي:
                  </span>
                </Table.Summary.Cell>
                <Table.Summary.Cell
                  index={1}
                  align="center"
                  className="font-bold text-lg text-white py-4"
                >
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-xl">{showTotalSales ? `${formatNumber(totalSales)} ج.م` : '••••••'}</span>
                    <button
                      onClick={() => setShowTotalSales(!showTotalSales)}
                      title={showTotalSales ? 'إخفاء المبلغ' : 'إظهار المبلغ'}
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

    // Create tabs for menu sections + PlayStation
    const allSections = [...menuSections.map(s => s.name), 'البلايستيشن'];
    
    const sectionTabs = allSections.map(sectionName => {
      const items = consumptionData[sectionName] || [];
      const sectionTotal = calculateTotal(items);
      const hasItems = items.length > 0;

      return {
        key: sectionName,
        label: (
          <div className="flex items-center">
            {getCategoryIcon(sectionName)}
            <span className={!hasItems ? 'opacity-60' : 'font-medium'}>
              {sectionName}
            </span>
            {hasItems && (
              <span className="bg-blue-100 text-blue-600 text-xs font-medium px-2 py-0.5 rounded-full mr-2">
                {toArabicNumbers(items.length)}
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
                    إجمالي {toArabicNumbers(total)} عنصر
                  </span>
                ),
                position: ['bottomCenter'],
                className: 'px-4 py-3',
                locale: {
                  items_per_page: '/ صفحة',
                  jump_to: 'الذهاب إلى',
                  jump_to_confirm: 'تأكيد',
                  page: 'صفحة',
                  prev_page: 'الصفحة السابقة',
                  next_page: 'الصفحة التالية',
                  prev_5: 'خمس صفحات سابقة',
                  next_5: 'خمس صفحات تالية',
                  prev_3: 'ثلاث صفحات سابقة',
                  next_3: 'ثلاث صفحات تالية',
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
                          لا توجد عناصر في هذه الفئة للفترة المحددة
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
                    align="right"
                    className="font-bold text-lg text-white py-4"
                  >
                    <span className="flex items-center gap-2">
                      {getCategoryIcon(sectionName)}
                      إجمالي {sectionName}:
                    </span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell
                    index={1}
                    align="center"
                    className="font-bold text-lg text-white py-4"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-xl">{showSectionTotals[sectionName] ? `${formatNumber(sectionTotal)} ج.م` : '••••••'}</span>
                      <button
                        onClick={() => setShowSectionTotals(prev => ({ ...prev, [sectionName]: !prev[sectionName] }))}
                        title={showSectionTotals[sectionName] ? 'إخفاء المبلغ' : 'إظهار المبلغ'}
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
  }, [allItems, columns, consumptionData, error, loading, totalSales, showTotalSales, showSectionTotals, menuSections, pageSize]);


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
      direction="rtl"
      locale={arEG}
      theme={{
        token: {
          fontFamily: 'Tajawal, sans-serif',
        },
      }}
    >
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6 transition-colors duration-300" dir="rtl">
      {/* Header Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700 transition-all duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-2xl flex items-center justify-center shadow-lg">
              <BarChartOutlined className="text-white text-3xl" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">تقرير الاستهلاك</h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">عرض وتحليل بيانات المبيعات والاستهلاك</p>
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
              <span>تحديث البيانات</span>
            </button>
            <button
              onClick={() => printReport()}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 font-medium"
            >
              <PrinterOutlined />
              <span>طباعة</span>
            </button>
            <button
              onClick={() => exportToPDF()}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 font-medium border-0"
            >
              <DownloadOutlined />
              <span>تصدير التقرير</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date/Time Picker and Stats Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6" dir="rtl">
        {/* Date/Time Picker Card */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300">
            <div className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700">
              <h3 className="text-xl font-bold text-white flex items-center">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center ml-3">
                  <CalendarOutlined className="text-white text-lg" />
                </div>
                نطاق التقرير
              </h3>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-900">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Start Date/Time */}
                <div className="space-y-3">
                  <div className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <div className="w-3 h-3 bg-blue-500 dark:bg-blue-400 rounded-full ml-2"></div>
                    <span>وقت البدء</span>
                  </div>
                  <div className="space-y-3">
                    <DatePicker
                      value={dateRange[0]}
                      onChange={(date) => handleDateChange([date, dateRange[1]], 'start')}
                      className="w-full"
                      format="YYYY/MM/DD"
                      allowClear={false}
                      placeholder="تاريخ البدء"
                      size="large"
                    />
                    <TimePicker
                      value={timeRange[0]}
                      onChange={(time) => handleTimeChange(time, 'start')}
                      className="w-full"
                      format="hh:mm A"
                      minuteStep={15}
                      placeholder="وقت البدء"
                      size="large"
                    />
                  </div>
                </div>

                {/* End Date/Time */}
                <div className="space-y-3">
                  <div className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <div className="w-3 h-3 bg-green-500 dark:bg-green-400 rounded-full ml-2"></div>
                    <span>وقت الانتهاء</span>
                  </div>
                  <div className="space-y-3">
                    <DatePicker
                      value={dateRange[1]}
                      onChange={(date) => handleDateChange([dateRange[0], date], 'end')}
                      className="w-full"
                      format="YYYY/MM/DD"
                      allowClear={false}
                      placeholder="تاريخ الانتهاء"
                      size="large"
                    />
                    <TimePicker
                      value={timeRange[1]}
                      onChange={(time) => handleTimeChange(time, 'end')}
                      className="w-full"
                      format="hh:mm A"
                      minuteStep={15}
                      placeholder="وقت الانتهاء"
                      size="large"
                    />
                  </div>
                </div>
              </div>

              {/* Selected Range Summary */}
              <div className="mt-6 p-5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">من</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {toArabicNumbers(dateRange[0]?.format('dddd، D MMMM YYYY [عند] hh:mm A'))}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">إلى</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {toArabicNumbers(dateRange[1]?.format('dddd، D MMMM YYYY [عند] hh:mm A'))}
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
                title={showTotalSales ? 'إخفاء المبلغ' : 'إظهار المبلغ'}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors duration-200"
              >
                {showTotalSales ? <EyeInvisibleOutlined className="text-lg" /> : <EyeOutlined className="text-lg" />}
              </button>
            </div>
            <div className="text-3xl font-bold mb-2">
              {showTotalSales ? `${toArabicNumbers(formatNumber(totalSales))} ج.م` : '••••••'}
            </div>
            <div className="text-blue-100 text-sm font-medium">إجمالي المبيعات</div>
          </div>

          {/* Items Count Card */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 rounded-2xl shadow-lg p-6 text-white transition-all duration-300 hover:shadow-xl">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-4">
              <ShoppingCartOutlined className="text-2xl" />
            </div>
            <div className="text-3xl font-bold mb-2">
              {toArabicNumbers(allItems.length)}
            </div>
            <div className="text-green-100 text-sm font-medium">عدد الأصناف المباعة</div>
          </div>

          {/* Categories Count Card */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 rounded-2xl shadow-lg p-6 text-white transition-all duration-300 hover:shadow-xl">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-4">
              <ShoppingFilled className="text-2xl" />
            </div>
            <div className="text-3xl font-bold mb-2">
              {toArabicNumbers(Object.keys(consumptionData).length)}
            </div>
            <div className="text-purple-100 text-sm font-medium">عدد الفئات</div>
          </div>
        </div>
      </div>

      {/* Data Table Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 transition-all duration-300">
        <Spin spinning={loading} tip="جاري تحميل البيانات...">
          {error ? (
            <div className="py-12">
              <Empty
                description={
                  <div className="space-y-4">
                    <div className="text-red-500 dark:text-red-400 text-lg font-medium">
                      <ExclamationCircleOutlined className="ml-2" />
                      حدث خطأ أثناء تحميل البيانات
                    </div>
                    <button
                      onClick={() => fetchData(true)}
                      disabled={loading}
                      className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 font-medium disabled:opacity-50"
                    >
                      <ReloadOutlined spin={loading} />
                      إعادة المحاولة
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
        <span className="ml-2">عرض</span>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="mr-2 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm w-20 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-all duration-200"
        >
          <option value="10">{toArabicNumbers('10')}</option>
          <option value="20">{toArabicNumbers('20')}</option>
          <option value="50">{toArabicNumbers('50')}</option>
          <option value="100">{toArabicNumbers('100')}</option>
        </select>
        <span>عنصر في الصفحة</span>
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
