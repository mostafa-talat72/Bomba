import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import { Package, Calendar, FileText, Table as TableIcon, Clock, Search, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { formatDateInTimezone } from '../utils/timezoneHelper';
import { formatCurrency as formatCurrencyUtil, formatDecimal } from '../utils/formatters';
import { WORLD_LANGUAGES } from '../../shared/languages';
import { DatePicker, ConfigProvider } from 'antd';
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
  quantity: number;
  price: number;
  total: number;
  orderDate: string;
  customerName: string;
}

interface SoldItem {
  itemName: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
  details: SoldItemDetail[];
}

interface Category {
  categoryId: string;
  categoryName: string;
  categorySortOrder: number;
  totalQuantity: number;
  totalRevenue: number;
  items: SoldItem[];
}

interface Section {
  sectionId: string;
  sectionName: string;
  sectionSortOrder: number;
  totalQuantity: number;
  totalRevenue: number;
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
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [customDateRange, setCustomDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().set('hour', 0).set('minute', 0).set('second', 0),
    dayjs().set('hour', 23).set('minute', 59).set('second', 59)
  ]);
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
    fetchSoldItems();
  }, [dateFilter, customDateRange]);

  // Sorting function
  const applySorting = (data: Section[]): Section[] => {
    return data.map(section => ({
      ...section,
      categories: section.categories.map(category => ({
        ...category,
        items: [...category.items].sort((a, b) => {
          let comparison = 0;
          
          switch (sortBy) {
            case 'name':
              comparison = a.itemName.localeCompare(b.itemName, i18n.language);
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

  const fetchSoldItems = async () => {
    setLoading(true);
    try {
      let filterParam = dateFilter;
      let startDate, endDate;
      
      // If custom date range is selected, use the custom dates
      if (dateFilter === 'custom') {
        startDate = customDateRange[0].toISOString();
        endDate = customDateRange[1].toISOString();
        filterParam = 'custom';
      }
      
      const response = await api.getSoldItems(filterParam, startDate, endDate);
      
      if (response.success && response.data) {
        let sectionsData: Section[] = response.data;
        
        // Apply search filter if needed
        if (searchTerm) {
          sectionsData = sectionsData.map(section => ({
            ...section,
            categories: section.categories.map(category => ({
              ...category,
              items: category.items.filter(item =>
                item.itemName.toLowerCase().includes(searchTerm.toLowerCase())
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

  const toggleItem = async (itemName: string) => {
    // If closing the item, just close it
    if (expandedItem === itemName) {
      setExpandedItem(null);
      return;
    }

    // Add loading state for this item
    setLoadingItems(prev => new Set(prev).add(itemName));
    
    // Simulate loading delay (you can remove this if data is already loaded)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Expand the item
    setExpandedItem(itemName);
    
    // Remove loading state
    setLoadingItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(itemName);
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
      className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6" 
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ direction: isRTL ? 'rtl' : 'ltr' }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-3" style={{ direction: dir }}>
            <div className="flex items-center gap-4" style={{ direction: dir }}>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-lg">
                <Package className="w-8 h-8 text-white" />
              </div>
              <div style={{ textAlign: textAlign }}>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                  {t('soldItems.title')}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {t('soldItems.description')}
                </p>
              </div>
            </div>
            
            {/* Toggle Money Visibility Button */}
            <button
              onClick={() => setShowMoney(!showMoney)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                showMoney 
                  ? 'bg-green-500 hover:bg-green-600 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
              }`}
              style={{ direction: dir }}
            >
              {showMoney ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              <span>{showMoney ? t('soldItems.hideMoney') : t('soldItems.showMoney')}</span>
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <ConfigProvider locale={getAntdLocale()} direction={isRTL ? 'rtl' : 'ltr'}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 md:p-6 mb-6 border border-gray-200 dark:border-gray-700" style={{ direction: dir }}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" style={{ direction: dir }}>
              {/* Search */}
              <div className="relative" style={{ direction: dir }}>
                <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5`} />
                <input
                  type="text"
                  placeholder={t('soldItems.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all`}
                  style={{ textAlign: textAlign, direction: dir }}
                />
              </div>

              {/* Date Filter */}
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className={`px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all`}
                style={{ textAlign: textAlign, direction: dir }}
              >
                <option value="all" dir="auto">{t('soldItems.filters.allTime')}</option>
                <option value="today" dir="auto">{t('soldItems.filters.today')}</option>
                <option value="week" dir="auto">{t('soldItems.filters.thisWeek')}</option>
                <option value="month" dir="auto">{t('soldItems.filters.thisMonth')}</option>
                <option value="custom" dir="auto">{t('soldItems.filters.customRange')}</option>
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={`px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all`}
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
                className={`px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all`}
                style={{ textAlign: textAlign, direction: dir }}
              >
                <option value="asc" dir="auto">{t('soldItems.sort.ascending')}</option>
                <option value="desc" dir="auto">{t('soldItems.sort.descending')}</option>
              </select>
            </div>

            {/* Custom Date Range Picker */}
            {dateFilter === 'custom' && (
              <div className="mt-4" style={{ direction: dir }}>
                <div className="flex items-center gap-2 mb-2" style={{ direction: dir }}>
                  <Calendar className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300" style={{ textAlign: textAlign }}>
                    {t('soldItems.filters.selectDateRange')}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ direction: dir }}>
                  {/* From Date */}
                  <div style={{ direction: dir }}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" style={{ textAlign: textAlign }}>
                      {t('soldItems.filters.from')}
                    </label>
                    <DatePicker
                      value={customDateRange[0]}
                      onChange={(date) => {
                        if (date) {
                          setCustomDateRange([
                            date.set('hour', 0).set('minute', 0).set('second', 0),
                            customDateRange[1]
                          ]);
                        }
                      }}
                      format="YYYY-MM-DD"
                      className="w-full"
                      placeholder={t('soldItems.filters.startDate')}
                    />
                  </div>
                  
                  {/* To Date */}
                  <div style={{ direction: dir }}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" style={{ textAlign: textAlign }}>
                      {t('soldItems.filters.to')}
                    </label>
                    <DatePicker
                      value={customDateRange[1]}
                      onChange={(date) => {
                        if (date) {
                          setCustomDateRange([
                            customDateRange[0],
                            date.set('hour', 23).set('minute', 59).set('second', 59)
                          ]);
                        }
                      }}
                      format="YYYY-MM-DD"
                      className="w-full"
                      placeholder={t('soldItems.filters.endDate')}
                      disabledDate={(current) => {
                        // Disable dates before the start date
                        return current && current < customDateRange[0].startOf('day');
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ConfigProvider>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between" style={{ direction: dir }}>
              <div style={{ textAlign: textAlign }}>
                <p className="text-blue-100 text-sm font-medium mb-1">{t('soldItems.summary.totalSections')}</p>
                <p className="text-3xl font-bold">{formatDecimal(sections.length, i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : 'en')}</p>
              </div>
              <div className="bg-white bg-opacity-20 p-3 rounded-lg">
                <Package className="w-8 h-8" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between" style={{ direction: dir }}>
              <div style={{ textAlign: textAlign }}>
                <p className="text-green-100 text-sm font-medium mb-1">{t('soldItems.summary.totalQuantity')}</p>
                <p className="text-3xl font-bold">
                  {formatDecimal(sections.reduce((sum, section) => sum + section.totalQuantity, 0), i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : 'en')}
                </p>
              </div>
              <div className="bg-white bg-opacity-20 p-3 rounded-lg">
                <Package className="w-8 h-8" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between" style={{ direction: dir }}>
              <div style={{ textAlign: textAlign }}>
                <p className="text-purple-100 text-sm font-medium mb-1">{t('soldItems.summary.totalRevenue')}</p>
                <p className="text-3xl font-bold">
                  {showMoney ? formatCurrency(sections.reduce((sum, section) => sum + section.totalRevenue, 0)) : '••••••'}
                </p>
              </div>
              <div className="bg-white bg-opacity-20 p-3 rounded-lg">
                <Package className="w-8 h-8" />
              </div>
            </div>
          </div>
        </div>

        {/* Sections List */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">{t('common.loading')}</p>
          </div>
        ) : sections.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-16 text-center border border-gray-200 dark:border-gray-700">
            <div className="bg-gray-100 dark:bg-gray-700 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-lg">{t('soldItems.noItems')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sections.map((section) => (
              <div
                key={section.sectionId}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow"
              >
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.sectionId)}
                  className={`w-full p-6 flex items-center justify-between hover:bg-gradient-to-${isRTL ? 'l' : 'r'} hover:from-blue-50 hover:to-transparent dark:hover:from-blue-900 dark:hover:to-transparent transition-all border-b-4 border-blue-500`}
                  style={{ direction: dir }}
                  disabled={loadingSections.has(section.sectionId)}
                >
                  <div className="flex items-center gap-4 flex-1" style={{ direction: dir }}>
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl shadow-md">
                      <Package className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1" style={{ textAlign: textAlign }}>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2" dir="auto">
                        {section.sectionName}
                      </h2>
                      <div className="flex gap-6 text-sm text-gray-600 dark:text-gray-400 flex-wrap" style={{ direction: dir }}>
                        <span className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full" style={{ direction: dir }}>
                          <Package className="w-4 h-4" />
                          <span>{t('soldItems.quantity')}: {formatDecimal(section.totalQuantity, i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : 'en')}</span>
                        </span>
                        <span className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full" style={{ direction: dir }}>
                          <FileText className="w-4 h-4" />
                          <span>{formatDecimal(section.categories.length, i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : 'en')} {t('soldItems.categories')}</span>
                        </span>
                        <span className="font-bold text-green-600 dark:text-green-400 text-lg bg-green-50 dark:bg-green-900 px-3 py-1 rounded-full">
                          {showMoney ? formatCurrency(section.totalRevenue) : '••••••'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {loadingSections.has(section.sectionId) ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                  ) : expandedSection === section.sectionId ? (
                    <ChevronUp className="w-6 h-6 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-gray-400" />
                  )}
                </button>

                {/* Categories */}
                {expandedSection === section.sectionId && !loadingSections.has(section.sectionId) && (
                  <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 space-y-4">
                    {section.categories.map((category) => (
                      <div
                        key={category.categoryId}
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
                      >
                        {/* Category Header */}
                        <button
                          onClick={() => toggleCategory(category.categoryId)}
                          className={`w-full p-5 flex items-center justify-between hover:bg-gradient-to-${isRTL ? 'l' : 'r'} hover:from-purple-50 hover:to-transparent dark:hover:from-purple-900 dark:hover:to-transparent transition-all ${isRTL ? 'border-r-4' : 'border-l-4'} border-purple-500`}
                          style={{ direction: dir }}
                          disabled={loadingCategories.has(category.categoryId)}
                        >
                          <div className="flex items-center gap-3 flex-1" style={{ direction: dir }}>
                            <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-3 rounded-lg shadow-md">
                              <FileText className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1" style={{ textAlign: textAlign }}>
                              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1.5" dir="auto">
                                {category.categoryName}
                              </h3>
                              <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400 flex-wrap" style={{ direction: dir }}>
                                <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full" style={{ direction: dir }}>
                                  <span>{t('soldItems.quantity')}: {formatDecimal(category.totalQuantity, i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : 'en')}</span>
                                </span>
                                <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full" style={{ direction: dir }}>
                                  <span>{formatDecimal(category.items.length, i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : 'en')} {t('soldItems.items')}</span>
                                </span>
                                <span className="font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900 px-2.5 py-1 rounded-full">
                                  {showMoney ? formatCurrency(category.totalRevenue) : '••••••'}
                                </span>
                              </div>
                            </div>
                          </div>
                          {loadingCategories.has(category.categoryId) ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-500 border-t-transparent"></div>
                          ) : expandedCategory === category.categoryId ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </button>

                        {/* Items */}
                        {expandedCategory === category.categoryId && !loadingCategories.has(category.categoryId) && (
                          <div className="p-3 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 space-y-3">
                            {category.items.map((item) => (
                              <div
                                key={item.itemName}
                                className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                              >
                                {/* Item Header */}
                                <button
                                  onClick={() => toggleItem(item.itemName)}
                                  className={`w-full p-4 flex items-center justify-between hover:bg-gradient-to-${isRTL ? 'l' : 'r'} hover:from-orange-50 hover:to-transparent dark:hover:from-orange-900 dark:hover:to-transparent transition-all`}
                                  style={{ direction: dir }}
                                  disabled={loadingItems.has(item.itemName)}
                                >
                                  <div className="flex items-center gap-3 flex-1" style={{ direction: dir }}>
                                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2.5 rounded-lg shadow">
                                      <Package className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="flex-1" style={{ textAlign: textAlign }}>
                                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1" dir="auto">
                                        {item.itemName}
                                      </h4>
                                      <div className="flex gap-3 text-sm text-gray-600 dark:text-gray-400 flex-wrap" style={{ direction: dir }}>
                                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                          {t('soldItems.quantity')}: {formatDecimal(item.totalQuantity, i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : 'en')}
                                        </span>
                                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                          {t('soldItems.orders')}: {formatDecimal(item.orderCount, i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : 'en')}
                                        </span>
                                        <span className="font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900 px-2 py-0.5 rounded-full">
                                          {showMoney ? formatCurrency(item.totalRevenue) : '••••••'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  {loadingItems.has(item.itemName) ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-orange-500 border-t-transparent"></div>
                                  ) : expandedItem === item.itemName ? (
                                    <ChevronUp className="w-5 h-5 text-gray-400" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                  )}
                                </button>

                                {/* Item Details */}
                                {expandedItem === item.itemName && !loadingItems.has(item.itemName) && (
                                  <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
                                    <div className="space-y-3">
                                      {item.details.map((detail, index) => (
                                        <div
                                          key={`${detail.orderId}-${index}`}
                                          className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${isRTL ? 'border-r-4' : 'border-l-4'} border-blue-500 shadow-sm hover:shadow-md transition-shadow`}
                                        >
                                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

                                            {/* Table Info */}
                                            <div className="flex items-start gap-2" style={{ direction: dir }}>
                                              <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
                                                <TableIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                              </div>
                                              <div style={{ textAlign: textAlign }}>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t('soldItems.table')}</p>
                                                <p className="font-semibold text-gray-900 dark:text-white" dir="auto">
                                                  {detail.tableSection && `${detail.tableSection} - `}
                                                  {detail.tableName || t('soldItems.noTable')}
                                                </p>
                                              </div>
                                            </div>

                                            {/* Date Info */}
                                            <div className="flex items-start gap-2" style={{ direction: dir }}>
                                              <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
                                                <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
                                              </div>
                                              <div style={{ textAlign: textAlign }}>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t('soldItems.orderDate')}</p>
                                                <p className="font-semibold text-gray-900 dark:text-white text-sm">
                                                  {formatDate(detail.orderDate)}
                                                </p>
                                              </div>
                                            </div>

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

                                          {/* Customer Name */}
                                          {detail.customerName && (
                                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                              <p className={`text-sm text-gray-600 dark:text-gray-400`} style={{ textAlign: textAlign }}>
                                                {t('soldItems.customer')}: <span className="font-semibold text-gray-900 dark:text-white" dir="auto">{detail.customerName}</span>
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SoldItems;
