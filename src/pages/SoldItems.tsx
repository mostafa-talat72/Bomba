import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import { Package, FileText, Table as TableIcon, Search, ChevronDown, ChevronUp, Eye, EyeOff, Bike, ShoppingBag, Phone } from 'lucide-react';
import { formatDateInTimezone } from '../utils/timezoneHelper';
import { formatCurrency as formatCurrencyUtil, formatDecimal } from '../utils/formatters';
import { WORLD_LANGUAGES } from '../../shared/languages';
import { DatePicker, ConfigProvider } from 'antd';
import LocalizedTimePicker from '../components/common/LocalizedTimePicker';
import dayjs, { Dayjs } from 'dayjs';
import arEG from 'antd/locale/ar_EG';
import enUS from 'antd/locale/en_US';
import frFR from 'antd/locale/fr_FR';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import 'dayjs/locale/fr';

interface SoldItemDetail {
  orderId: string;
  orderNumber: string;
  billId: string;
  billNumber: string;
  tableName: string;
  tableSection: string;
  fulfillmentType?: string;
  customerPhone?: string;
  quantity: number;
  price: number;
  total: number;
  orderDate: string;
  customerName: string;
}

interface SoldItem {
  itemName: string;
  variant?: string | null;
  totalQuantity: number;
  totalRevenue: number;
  totalDiscount: number;
  orderCount: number;
  details: SoldItemDetail[];
}

// Variant-aware helpers: different sizes of same menu item should be separate rows
const getDisplayName = (item: SoldItem): string => {
  if (item.variant && item.variant !== 'عادي' && String(item.variant).trim() !== '') {
    return `${item.itemName} (${item.variant})`;
  }
  return item.itemName;
};

const getItemKey = (item: Pick<SoldItem, 'itemName' | 'variant'>): string => `${item.itemName}|${item.variant || ''}`;

interface Category {
  categoryId: string;
  categoryName: string;
  categorySortOrder: number;
  totalQuantity: number;
  totalRevenue: number;
  totalDiscount: number;
  items: SoldItem[];
}

interface Section {
  sectionId: string;
  sectionName: string;
  sectionSortOrder: number;
  totalQuantity: number;
  totalRevenue: number;
  totalDiscount: number;
  categories: Category[];
}

const SoldItems: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { currentLanguage } = useLanguage();
  const [sections, setSections] = useState<Section[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  // فلترة حرة بالتاريخ والوقت (مثل تقرير الاستهلاك — بدون فترات جاهزة تخفيفاً على الصفحة)
  // الافتراضي: اليوم الحالي من 00:00 حتى الآن
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(() => ([
    dayjs().set('hour', 0).set('minute', 0).set('second', 0).set('millisecond', 0),
    dayjs(),
  ]));
  const [timeRange, setTimeRange] = useState<[Dayjs, Dayjs]>(() => ([
    dayjs().set('hour', 0).set('minute', 0),
    dayjs(),
  ]));
  const [loading, setLoading] = useState(true);
  const [showMoney, setShowMoney] = useState(false); // State to show/hide money
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set()); // Track loading items
  const [loadingCategories, setLoadingCategories] = useState<Set<string>>(new Set()); // Track loading categories
  const [loadingSections, setLoadingSections] = useState<Set<string>>(new Set()); // Track loading sections
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'revenue' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Get RTL status directly from WORLD_LANGUAGES
  const currentLang = WORLD_LANGUAGES.find(lang => lang.code === i18n.language);
  // للعربية: نستخدم direction: rtl فقط، بدون row-reverse
  const isRTL = currentLang?.rtl || false;
  const dir = isRTL ? 'rtl' : 'ltr'; // direction attribute
  const textAlign = isRTL ? 'right' : 'left';

  // Get Ant Design locale
  const getAntdLocale = () => {
    switch (i18n.language) {
      case 'ar': return arEG;
      case 'fr': return frFR;
      default: return enUS;
    }
  };

  // Update dayjs locale when language changes
  useEffect(() => {
    dayjs.locale(i18n.language);
  }, [i18n.language]);

  // Debug: Monitor language changes
  useEffect(() => {
    
    // Force set direction
    if (isRTL) {
      document.documentElement.dir = 'rtl';
      document.body.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
      document.body.dir = 'ltr';
    }
  }, [currentLanguage, isRTL, i18n.language]);

  // Get organization timezone and locale
  const organizationTimezone = localStorage.getItem('organizationTimezone') || 'Africa/Cairo';
  const getLocale = () => {
    switch (i18n.language) {
      case 'ar':
        return 'ar-EG';
      case 'fr':
        return 'fr-FR';
      default:
        return 'en-US';
    }
  };

  useEffect(() => {
    if (dateRange[0] && dateRange[1]) fetchSoldItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange[0]?.valueOf(), dateRange[1]?.valueOf()]);

  // Sorting function - variant-aware display name
  const applySorting = (data: Section[]): Section[] => {
    return data.map(section => ({
      ...section,
      categories: section.categories.map(category => ({
        ...category,
        items: [...category.items].sort((a, b) => {
          let comparison = 0;
          
          switch (sortBy) {
            case 'name':
              comparison = getDisplayName(a).localeCompare(getDisplayName(b), i18n.language);
              break;
            case 'quantity':
              comparison = a.totalQuantity - b.totalQuantity;
              break;
            case 'revenue':
              comparison = a.totalRevenue - b.totalRevenue;
              break;
            case 'date':
              // Sort by most recent order date in details
              const aLatestDate = a.details.length > 0 
                ? new Date(a.details[0].orderDate).getTime() 
                : 0;
              const bLatestDate = b.details.length > 0 
                ? new Date(b.details[0].orderDate).getTime() 
                : 0;
              comparison = aLatestDate - bLatestDate;
              break;
          }
          
          return sortOrder === 'asc' ? comparison : -comparison;
        })
      }))
    }));
  };

  // Re-apply sorting when sort options change
  useEffect(() => {
    if (sections.length > 0) {
      setSections(prevSections => applySorting(prevSections));
    }
  }, [sortBy, sortOrder]);

  useEffect(() => {
    // Re-render when language changes
  }, [isRTL]);

  // دمج التاريخ والوقت (مثل تقرير الاستهلاك)
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

  const fetchSoldItems = async () => {
    if (!dateRange[0] || !dateRange[1]) return;
    setLoading(true);
    try {
      // النطاق من منتقي التاريخ والوقت مباشرة (دائماً مخصص)
      const startDate = dateRange[0].toISOString();
      const endDate = dateRange[1].toISOString();
      const response = await api.getSoldItems('custom', startDate, endDate);
      
      if (response.success && response.data) {
        let sectionsData: Section[] = response.data;
        
        // Apply search filter if needed - variant-aware (search in "name (variant)")
        if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          sectionsData = sectionsData.map(section => ({
            ...section,
            categories: section.categories.map(category => ({
              ...category,
              items: category.items.filter(item =>
                getDisplayName(item).toLowerCase().includes(lower)
              )
            })).filter(category => category.items.length > 0)
          })).filter(section => section.categories.length > 0);
        }

        // Apply sorting
        sectionsData = applySorting(sectionsData);

        setSections(sectionsData);
      }
    } catch (error) {
      console.error('Error fetching sold items:', error);
      setSections([]);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when search changes
  useEffect(() => {
    if (sections.length > 0 || searchTerm) {
      fetchSoldItems();
    }
  }, [searchTerm]);

  const toggleSection = async (sectionId: string) => {
    // If closing the section, just close it
    if (expandedSection === sectionId) {
      setExpandedSection(null);
      setExpandedCategory(null);
      setExpandedItem(null);
      return;
    }

    // Add loading state for this section
    setLoadingSections(prev => new Set(prev).add(sectionId));
    
    // Simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Expand the section
    setExpandedSection(sectionId);
    setExpandedCategory(null);
    setExpandedItem(null);
    
    // Remove loading state
    setLoadingSections(prev => {
      const newSet = new Set(prev);
      newSet.delete(sectionId);
      return newSet;
    });
  };

  const toggleCategory = async (categoryId: string) => {
    // If closing the category, just close it
    if (expandedCategory === categoryId) {
      setExpandedCategory(null);
      setExpandedItem(null);
      return;
    }

    // Add loading state for this category
    setLoadingCategories(prev => new Set(prev).add(categoryId));
    
    // Simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 250));
    
    // Expand the category
    setExpandedCategory(categoryId);
    setExpandedItem(null);
    
    // Remove loading state
    setLoadingCategories(prev => {
      const newSet = new Set(prev);
      newSet.delete(categoryId);
      return newSet;
    });
  };

  const toggleItem = async (itemKey: string) => {
    // If closing the item, just close it - variant-aware key: name|variant
    if (expandedItem === itemKey) {
      setExpandedItem(null);
      return;
    }

    // Add loading state for this item
    setLoadingItems(prev => new Set(prev).add(itemKey));
    
    // Simulate loading delay (you can remove this if data is already loaded)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Expand the item
    setExpandedItem(itemKey);
    
    // Remove loading state
    setLoadingItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(itemKey);
      return newSet;
    });
  };

  const formatCurrency = (amount: number) => {
    const locale = i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : 'en';
    return formatCurrencyUtil(amount, locale);
  };

  const formatDate = (dateString: string) => {
    const locale = getLocale();
    
    // Format with 12-hour time and organization timezone
    const formatted = formatDateInTimezone(
      new Date(dateString),
      organizationTimezone,
      locale,
      {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true // Use 12-hour format
      }
    );

    // Replace AM/PM with Arabic equivalents if needed
    if (i18n.language === 'ar') {
      return formatted.replace('AM', 'ص').replace('PM', 'م');
    }
    
    return formatted;
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 md:p-6" 
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ direction: isRTL ? 'rtl' : 'ltr' }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap" style={{ direction: dir }}>
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0" style={{ direction: dir }}>
              <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-2 sm:p-2.5 rounded-xl shadow-md shadow-indigo-500/20 flex-shrink-0">
                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div style={{ textAlign: textAlign }} className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-extrabold text-gray-900 dark:text-white leading-tight">
                  {t('soldItems.title')}
                </h1>
                <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {t('soldItems.filters.from')} <span className="font-bold text-gray-700 dark:text-gray-300" dir="auto">{dateRange[0]?.format('YYYY/MM/DD HH:mm')}</span>
                  {' · '}
                  {t('soldItems.filters.to')} <span className="font-bold text-gray-700 dark:text-gray-300" dir="auto">{dateRange[1]?.format('YYYY/MM/DD HH:mm')}</span>
                </p>
              </div>
            </div>

            {/* Toggle Money Visibility Button */}
            <button
              onClick={() => setShowMoney(!showMoney)}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-full font-bold transition-all text-xs sm:text-sm border ${
                showMoney
                  ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
              }`}
              style={{ direction: dir }}
            >
              {showMoney ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span>{showMoney ? t('soldItems.hideMoney') : t('soldItems.showMoney')}</span>
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <ConfigProvider locale={getAntdLocale()} direction={isRTL ? 'rtl' : 'ltr'}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 md:p-5 mb-4 sm:mb-5 border border-gray-200 dark:border-gray-700" style={{ direction: dir }}>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4" style={{ direction: dir }}>
              {/* Search */}
              <div className="relative" style={{ direction: dir }}>
                <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none`} />
                <input
                  type="text"
                  placeholder={t('soldItems.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full ${isRTL ? 'pr-10 pl-9' : 'pl-10 pr-9'} py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all text-sm`}
                  style={{ textAlign: textAlign, direction: dir }}
                />
                {searchTerm ? (
                  <button onClick={() => setSearchTerm('')} className={`absolute ${isRTL ? 'left-2.5' : 'right-2.5'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none`} aria-label="×">×</button>
                ) : null}
              </div>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={`px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all`}
                style={{ textAlign: textAlign, direction: dir }}
              >
                <option value="name" dir="auto">{t('soldItems.sort.byName')}</option>
                <option value="quantity" dir="auto">{t('soldItems.sort.byQuantity')}</option>
                <option value="revenue" dir="auto">{t('soldItems.sort.byRevenue')}</option>
                <option value="date" dir="auto">{t('soldItems.sort.byDate')}</option>
              </select>

              {/* Sort Order */}
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className={`px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all`}
                style={{ textAlign: textAlign, direction: dir }}
              >
                <option value="asc" dir="auto">{t('soldItems.sort.ascending')}</option>
                <option value="desc" dir="auto">{t('soldItems.sort.descending')}</option>
              </select>
            </div>

            {/* Date/Time Filter — free range like consumption report */}
            <div className="mt-4 grid gap-2 sm:grid-cols-2" style={{ direction: dir }}>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{t('soldItems.filters.startTime')}</div>
                  <div className="flex gap-1.5 items-center">
                    <DatePicker
                      value={dateRange[0]}
                      onChange={(date) => handleDateChange([date, dateRange[1]], 'start')}
                      className="flex-1 min-w-0"
                      format="YYYY/MM/DD"
                      allowClear={false}
                      placeholder={t('soldItems.filters.startDate')}
                    />
                    <LocalizedTimePicker
                      value={timeRange[0]}
                      onChange={(time) => handleTimeChange(time, 'start')}
                      className="w-24"
                      minuteStep={15}
                      placeholder={t('soldItems.filters.startTimePlaceholder')}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{t('soldItems.filters.endTime')}</div>
                  <div className="flex gap-1.5 items-center">
                    <DatePicker
                      value={dateRange[1]}
                      onChange={(date) => handleDateChange([dateRange[0], date], 'end')}
                      className="flex-1 min-w-0"
                      format="YYYY/MM/DD"
                      allowClear={false}
                      placeholder={t('soldItems.filters.endDate')}
                    />
                    <LocalizedTimePicker
                      value={timeRange[1]}
                      onChange={(time) => handleTimeChange(time, 'end')}
                      className="w-24"
                      minuteStep={15}
                      placeholder={t('soldItems.filters.endTimePlaceholder')}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ConfigProvider>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-5">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 border-t-4 border-t-blue-500 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2" style={{ direction: dir }}>
              <div style={{ textAlign: textAlign }} className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">{t('soldItems.summary.totalSections')}</p>
                <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tabular-nums truncate">{formatDecimal(sections.length, i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : 'en')}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-xl flex-shrink-0">
                <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 border-t-4 border-t-emerald-500 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2" style={{ direction: dir }}>
              <div style={{ textAlign: textAlign }} className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">{t('soldItems.summary.totalQuantity')}</p>
                <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tabular-nums truncate">
                  {formatDecimal(sections.reduce((sum, section) => sum + section.totalQuantity, 0), i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : 'en')}
                </p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-xl flex-shrink-0">
                <Package className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 border-t-4 border-t-violet-500 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2" style={{ direction: dir }}>
              <div style={{ textAlign: textAlign }} className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">{t('soldItems.summary.totalRevenue')}</p>
                {(() => {
                  const totalRev = sections.reduce((sum, section) => sum + section.totalRevenue, 0);
                  const totalDisc = sections.reduce((sum, section) => sum + (section.totalDiscount || 0), 0);
                  return (
                    <>
                      <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tabular-nums truncate">
                        {showMoney ? formatCurrency(totalRev - totalDisc) : '••••••'}
                      </p>
                      {showMoney && totalDisc > 0 && (
                        <p className="text-[11px] text-purple-600 dark:text-purple-400 font-bold mt-0.5 line-through">{formatCurrency(totalRev)} خصم: -{formatCurrency(totalDisc)}</p>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="bg-violet-50 dark:bg-violet-900/30 p-3 rounded-xl flex-shrink-0">
                <Package className="w-6 h-6 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Sections List */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-14 w-14 border-4 border-indigo-500 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-sm font-bold text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
          </div>
        ) : sections.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-14 text-center border border-dashed border-gray-300 dark:border-gray-600">
            <div className="bg-gray-100 dark:bg-gray-700 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-bold">{t('soldItems.noItems')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sections.map((section) => (
              <div
                key={section.sectionId}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
              >
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.sectionId)}
                  className={`w-full p-4 sm:p-5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-gray-700/40 transition-colors border-b-4 border-blue-500 ${expandedSection === section.sectionId ? 'bg-slate-50/60 dark:bg-gray-700/30' : ''}`}
                  style={{ direction: dir }}
                  disabled={loadingSections.has(section.sectionId)}
                >
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0" style={{ direction: dir }}>
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl shadow-md shadow-blue-500/20 flex-shrink-0">
                      <Package className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0" style={{ textAlign: textAlign }}>
                      <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white mb-1.5 truncate" dir="auto">
                        {section.sectionName}
                      </h2>
                      <div className="flex gap-2 text-xs text-gray-600 dark:text-gray-400 flex-wrap" style={{ direction: dir }}>
                        <span className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full font-bold" style={{ direction: dir }}>
                          <Package className="w-3.5 h-3.5" />
                          <span className="tabular-nums">{t('soldItems.quantity')}: {formatDecimal(section.totalQuantity, i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : 'en')}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full font-bold" style={{ direction: dir }}>
                          <FileText className="w-3.5 h-3.5" />
                          <span className="tabular-nums">{formatDecimal(section.categories.length, i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : 'en')} {t('soldItems.categories')}</span>
                        </span>
                        <span className="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full tabular-nums">
                          {showMoney ? formatCurrency(section.totalRevenue - (section.totalDiscount || 0)) : '••••••'}
                          {showMoney && (section.totalDiscount || 0) > 0 && (
                            <span className="text-[11px] text-purple-500 dark:text-purple-400 font-bold block line-through">{formatCurrency(section.totalRevenue)} خصم: -{formatCurrency(section.totalDiscount)}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  {loadingSections.has(section.sectionId) ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent flex-shrink-0"></div>
                  ) : expandedSection === section.sectionId ? (
                    <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    </span>
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    </span>
                  )}
                </button>

                {/* Categories */}
                {expandedSection === section.sectionId && !loadingSections.has(section.sectionId) && (
                  <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 space-y-4">
                    {section.categories.map((category) => (
                      <div
                        key={category.categoryId}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                      >
                        {/* Category Header */}
                        <button
                          onClick={() => toggleCategory(category.categoryId)}
                          className={`w-full p-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-gray-700/40 transition-colors ${isRTL ? 'border-r-4' : 'border-l-4'} border-violet-500 ${expandedCategory === category.categoryId ? 'bg-slate-50/60 dark:bg-gray-700/30' : ''}`}
                          style={{ direction: dir }}
                          disabled={loadingCategories.has(category.categoryId)}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0" style={{ direction: dir }}>
                            <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-2.5 rounded-xl shadow-md shadow-violet-500/20 flex-shrink-0">
                              <FileText className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0" style={{ textAlign: textAlign }}>
                              <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white mb-1 truncate" dir="auto">
                                {category.categoryName}
                              </h3>
                              <div className="flex gap-2 text-xs text-gray-600 dark:text-gray-400 flex-wrap" style={{ direction: dir }}>
                                <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full font-bold" style={{ direction: dir }}>
                                  <span className="tabular-nums">{t('soldItems.quantity')}: {formatDecimal(category.totalQuantity, i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : 'en')}</span>
                                </span>
                                <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full font-bold" style={{ direction: dir }}>
                                  <span className="tabular-nums">{formatDecimal(category.items.length, i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : 'en')} {t('soldItems.items')}</span>
                                </span>
                                <span className="font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full tabular-nums">
                                  {showMoney ? formatCurrency(category.totalRevenue - (category.totalDiscount || 0)) : '••••••'}
                                  {showMoney && (category.totalDiscount || 0) > 0 && (
                                    <span className="text-[11px] text-purple-500 dark:text-purple-400 font-bold block line-through">{formatCurrency(category.totalRevenue)} خصم: -{formatCurrency(category.totalDiscount)}</span>
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                          {loadingCategories.has(category.categoryId) ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-violet-500 border-t-transparent flex-shrink-0"></div>
                          ) : expandedCategory === category.categoryId ? (
                            <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                              <ChevronUp className="w-4 h-4 text-gray-500" />
                            </span>
                          ) : (
                            <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            </span>
                          )}
                        </button>

                        {/* Items */}
                        {expandedCategory === category.categoryId && !loadingCategories.has(category.categoryId) && (
                          <div className="p-3 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 space-y-3">
                            {category.items.map((item) => {
                              const itemKey = getItemKey(item);
                              return (
                              <div
                                key={itemKey}
                                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                              >
                                {/* Item Header - variant-aware display */}
<button
                                    onClick={() => toggleItem(itemKey)}
                                    className="w-full p-3.5 sm:p-4 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-gray-700/40 transition-colors"
                                    style={{ direction: dir }}
                                    disabled={loadingItems.has(itemKey)}
                                  >
                                    <div className="flex items-center gap-3 flex-1 min-w-0" style={{ direction: dir }}>
                                      <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-2 rounded-xl shadow-md shadow-orange-500/20 flex-shrink-0">
                                        <Package className="w-4 h-4 text-white" />
                                      </div>
                                      <div className="flex-1 min-w-0" style={{ textAlign: textAlign }}>
                                        <h4 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white mb-1 truncate" dir="auto">
                                          {getDisplayName(item)}
                                        </h4>
                                        <div className="flex gap-2 text-xs text-gray-600 dark:text-gray-400 flex-wrap" style={{ direction: dir }}>
                                          <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full font-bold tabular-nums">
                                            {t('soldItems.quantity')}: {formatDecimal(item.totalQuantity, i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : 'en')}
                                          </span>
                                          <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full font-bold tabular-nums">
                                            {t('soldItems.orders')}: {formatDecimal(item.orderCount, i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : 'en')}
                                          </span>
                                          <span className="font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full tabular-nums">
                                            {showMoney ? formatCurrency(item.totalRevenue - (item.totalDiscount || 0)) : '••••••'}
                                            {showMoney && (item.totalDiscount || 0) > 0 && (
                                              <span className="text-[11px] text-purple-500 dark:text-purple-400 font-bold block line-through">{formatCurrency(item.totalRevenue)} خصم: -{formatCurrency(item.totalDiscount)}</span>
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    {loadingItems.has(itemKey) ? (
                                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-orange-500 border-t-transparent flex-shrink-0"></div>
                                    ) : expandedItem === itemKey ? (
                                      <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                        <ChevronUp className="w-4 h-4 text-gray-500" />
                                      </span>
                                    ) : (
                                      <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                        <ChevronDown className="w-4 h-4 text-gray-500" />
                                      </span>
                                    )}
                                  </button>

                                {/* Item Details - variant-aware key */}
                                {expandedItem === itemKey && !loadingItems.has(itemKey) && (
                                  <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
                                    <div className="space-y-3">
                                      {item.details.map((detail, index) => {
                                        const ft = detail.fulfillmentType || (detail.tableName ? 'dine_in' : 'takeaway');
                                        const isDelivery = ft === 'delivery';
                                        const isTakeaway = ft === 'takeaway';
                                        const acc = isDelivery
                                          ? { border: 'border-emerald-500', soft: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' }
                                          : isTakeaway
                                          ? { border: 'border-amber-500', soft: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' }
                                          : { border: 'border-blue-500', soft: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' };
                                        const badgeLabel = isDelivery
                                          ? t('soldItems.delivery')
                                          : isTakeaway
                                          ? t('soldItems.takeaway')
                                          : (detail.tableName ? `${t('soldItems.table')} ${detail.tableSection ? `${detail.tableSection} - ` : ''}${detail.tableName}` : t('soldItems.dineIn'));
                                        return (
                                        <div
                                          key={`${detail.orderId}-${index}`}
                                          className={`bg-white dark:bg-gray-800 rounded-xl p-4 ${isRTL ? 'border-r-4' : 'border-l-4'} ${acc.border} shadow-sm hover:shadow-md transition-shadow`}
                                        >
                                          {/* Type badge + order/date */}
                                          <div className="flex items-center justify-between gap-2 flex-wrap mb-3" style={{ direction: dir }}>
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold ${acc.soft} ${acc.text}`}>
                                              {isDelivery ? <Bike className="w-3.5 h-3.5" /> : isTakeaway ? <ShoppingBag className="w-3.5 h-3.5" /> : <TableIcon className="w-3.5 h-3.5" />}
                                              {badgeLabel}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-bold" dir="auto">
                                              {t('soldItems.orderNumber')}: {detail.orderNumber || '—'} · {formatDate(detail.orderDate)}
                                            </span>
                                          </div>
                                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                            {/* Bill Info */}
                                            <div className="flex items-start gap-2" style={{ direction: dir }}>
                                              <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                                                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                              </div>
                                              <div style={{ textAlign: textAlign }}>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t('soldItems.billNumber')}</p>
                                                <p className="font-semibold text-gray-900 dark:text-white" dir="auto">
                                                  {detail.billNumber || t('soldItems.noBill')}
                                                </p>
                                              </div>
                                            </div>

                                            {/* Customer / Table Info */}
                                            {isDelivery ? (
                                              <div className="flex items-start gap-2" style={{ direction: dir }}>
                                                <div className="bg-emerald-100 dark:bg-emerald-900 p-2 rounded-lg">
                                                  <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <div style={{ textAlign: textAlign }}>
                                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t('soldItems.customer')}</p>
                                                  <p className="font-semibold text-gray-900 dark:text-white" dir="auto">{detail.customerName || '—'}</p>
                                                  {detail.customerPhone ? (
                                                    <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mt-0.5" dir="ltr">{t('soldItems.customerPhone')}: {detail.customerPhone}</p>
                                                  ) : null}
                                                </div>
                                              </div>
                                            ) : (!isTakeaway || detail.customerName) ? (
                                              <div className="flex items-start gap-2" style={{ direction: dir }}>
                                                <div className={`${isTakeaway ? 'bg-amber-100 dark:bg-amber-900' : 'bg-purple-100 dark:bg-purple-900'} p-2 rounded-lg`}>
                                                  {isTakeaway
                                                    ? <ShoppingBag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                                    : <TableIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
                                                </div>
                                                <div style={{ textAlign: textAlign }}>
                                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{isTakeaway ? t('soldItems.customer') : t('soldItems.table')}</p>
                                                  {isTakeaway ? (
                                                    <p className="font-semibold text-gray-900 dark:text-white" dir="auto">{detail.customerName}</p>
                                                  ) : (
                                                    <p className="font-semibold text-gray-900 dark:text-white" dir="auto">
                                                      {detail.tableSection && `${detail.tableSection} - `}
                                                      {detail.tableName || t('soldItems.noTable')}
                                                    </p>
                                                  )}
                                                </div>
                                              </div>
                                            ) : null}

                                            {/* Quantity & Price */}
                                            <div className="flex items-start gap-2" style={{ direction: dir }}>
                                              <div className="bg-orange-100 dark:bg-orange-900 p-2 rounded-lg">
                                                <Package className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                              </div>
                                              <div style={{ textAlign: textAlign }}>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t('soldItems.quantityAndPrice')}</p>
                                                <p className="font-semibold text-gray-900 dark:text-white">
                                                  {formatDecimal(detail.quantity, i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : 'en')} × {showMoney ? formatCurrency(detail.price) : '••••'}
                                                </p>
                                                <p className="text-sm text-green-600 dark:text-green-400 font-bold">
                                                  {showMoney ? formatCurrency(detail.total) : '••••••'}
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )})}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SoldItems;
