import { useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { TrendingUp, TrendingDown, ArrowUp, ArrowDown, DollarSign, Users, ShoppingCart, Download, Printer, RefreshCw, Gamepad2, Monitor, Clock, Target, Filter, ChevronDown, BarChart3, Eye, EyeOff } from 'lucide-react';
import { format, addDays, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { ar } from 'date-fns/locale';
import { DatePicker, TimePicker, ConfigProvider } from 'antd';
import arEG from 'antd/locale/ar_EG';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ar';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { exportReportToPDF, generatePDFFilename } from '../utils/pdfExport';

// Configure dayjs
dayjs.locale('ar');
dayjs.extend(customParseFormat);

// دالة لتحويل الأرقام إلى العربية
const toArabicNumbers = (num: number | string): string => {
  if (num === null || num === undefined) return '';
  const arabicNumbers = '۰١٢٣٤٥٦٧٨٩';
  return String(num).replace(/[0-9]/g, (digit) => arabicNumbers[parseInt(digit)]);
};

// دالة لتنسيق الأرقام مع فواصل الآلاف وتحويلها للعربية
const formatNumberArabic = (num: number): string => {
  const rounded = Math.round(num);
  const formatted = new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(rounded);
  
  return toArabicNumbers(formatted);
};

// Type definitions
interface SalesReportData {
  totalRevenue?: number;
  totalOrders?: number;
  revenueByType?: {
    playstation?: number;
    computer?: number;
    cafe?: number;
  };
  topProductsBySection?: ProductSalesBySection[];
  peakHours?: PeakHoursData;
  staffPerformance?: StaffPerformance[];
  comparison?: {
    revenue?: ComparisonData;
    orders?: ComparisonData;
    avgOrderValue?: ComparisonData;
  };
}

interface SessionsReportData {
  totalSessions?: number;
  playstation?: SessionsData['playstation'];
  computer?: SessionsData['computer'];
  comparison?: {
    sessions?: ComparisonData;
  };
}

interface ReportData {
  sales: SalesReportData | null;
  sessions: SessionsReportData | null;
  inventory: Record<string, unknown> | null;
  financial: Record<string, unknown> | null;
}

interface RevenueCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: number;
  total: number;
  color: string;
}

interface ReportSectionProps {
  title: string;
  onExportExcel: () => void;
  onExportPDF: () => void;
  children: ReactNode;
}

interface FinancialStatProps {
  label: string;
  value: string | number;
  color: string;
  showWarning?: boolean;
}

interface ProductSalesBySection {
  sectionName: string;
  sectionId: string;
  products: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  totalRevenue: number;
  totalQuantity: number;
}

interface SessionsData {
  playstation: {
    totalSessions: number;
    totalRevenue: number;
    avgDuration: string | number;
    avgRevenue: string | number;
    deviceUsage: Array<{
      deviceName: string;
      sessionsCount: number;
      revenue: number;
      usageRate: string | number;
      totalDuration: number;
    }>;
    controllerDistribution: {
      single: number;
      triple: number;
      quad: number;
    };
  };
  computer: {
    totalSessions: number;
    totalRevenue: number;
    avgDuration: string | number;
    avgRevenue: string | number;
    deviceUsage: Array<{
      deviceName: string;
      sessionsCount: number;
      revenue: number;
      usageRate: string | number;
      totalDuration: number;
    }>;
  };
}

interface ComparisonData {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

interface StatCardWithComparisonProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  current: number;
  comparison?: ComparisonData | null;
  color: string;
  formatValue?: (value: number) => string;
}

interface PeakHoursData {
  hourlyData: Array<{
    hour: number;
    sales: number;
    sessions: number;
    revenue: number;
  }>;
  peakHours: number[];
}

interface StaffPerformance {
  staffId: string;
  staffName: string;
  ordersCount: number;
  sessionsCount: number;
  totalRevenue: number;
  avgOrderValue: number;
}

interface BasicStats {
  revenue: number;
  orders: number;
  avgOrderValue: number;
  sessions: number;
}

interface RevenueBreakdown {
  playstation: number;
  computer: number;
  cafe: number;
}

import { useApp } from '../context/AppContext';
import { formatCurrency as formatCurrencyUtil, formatDecimal } from '../utils/formatters';

// TopProductsBySection Component
const TopProductsBySection = ({ data }: { data: ProductSalesBySection[] }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
          لا توجد بيانات مبيعات متاحة
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map(section => (
        <div 
          key={section.sectionId} 
          className="border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-orange-300 dark:hover:border-orange-700"
        >
          <div 
            className="flex justify-between items-center p-5 cursor-pointer bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-700/30 hover:from-gray-100 hover:to-gray-50 dark:hover:from-gray-700 dark:hover:to-gray-700/50 transition-all"
            onClick={() => toggleSection(section.sectionId)}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center transition-transform duration-200 ${
                expandedSections.has(section.sectionId) ? 'rotate-180' : ''
              }`}>
                <ChevronDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {section.sectionName}
              </h4>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">الكمية الإجمالية</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {formatNumberArabic(section.totalQuantity)} قطعة
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">الإيراد الإجمالي</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatNumberArabic(section.totalRevenue)} ج.م
                </p>
              </div>
            </div>
          </div>
          
          {expandedSections.has(section.sectionId) && (
            <div className="p-5 bg-white dark:bg-gray-800 border-t-2 border-gray-200 dark:border-gray-700">
              {section.products && section.products.length > 0 ? (
                <div className="space-y-3">
                  {section.products.map((product, index) => (
                    <div 
                      key={`${product.name}-${index}`} 
                      className="flex justify-between items-center py-4 px-5 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700/30 dark:to-gray-800 rounded-xl hover:from-orange-50 hover:to-orange-50/50 dark:hover:from-orange-900/20 dark:hover:to-orange-900/10 transition-all duration-200 border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700"
                    >
                      <div className="flex items-center gap-4">
                        <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white text-sm font-bold shadow-md">
                          {toArabicNumbers(index + 1)}
                        </span>
                        <span className="text-base font-semibold text-gray-800 dark:text-gray-200">
                          {product.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">الكمية</p>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {formatNumberArabic(product.quantity)} قطعة
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">الإيراد</p>
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">
                            {formatNumberArabic(product.revenue)} ج.م
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  لا توجد مبيعات في هذا القسم
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// PlayStation Sessions Report Component
const PlayStationSessionsReport = ({ data }: { data: SessionsData['playstation'] | null }) => {
  if (!data) {
    return (
      <div className="text-center py-8">
        <Gamepad2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">
          لا توجد بيانات متاحة
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-blue-200 dark:border-gray-600">
          <div className="flex items-center justify-center mb-2">
            <Gamepad2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">عدد الجلسات</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatNumberArabic(data.totalSessions)}
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-green-200 dark:border-gray-600">
          <div className="flex items-center justify-center mb-2">
            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">الإيراد</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">
            {formatNumberArabic(data.totalRevenue)} ج.م
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-purple-200 dark:border-gray-600">
          <div className="flex items-center justify-center mb-2">
            <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">متوسط المدة</p>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
            {formatNumberArabic(Number(data.avgDuration))} س
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-orange-200 dark:border-gray-600">
          <div className="flex items-center justify-center mb-2">
            <Target className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">متوسط الإيراد</p>
          <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
            {formatNumberArabic(Number(data.avgRevenue))} ج.م
          </p>
        </div>
      </div>

      {/* Controller Distribution */}
      {data.controllerDistribution && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-gray-600">
          <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-blue-500" />
            توزيع الدراعات
          </h5>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-blue-50 dark:bg-gray-700 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">١-٢ دراعات</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {formatNumberArabic(data.controllerDistribution.single)}
              </p>
            </div>
            <div className="text-center p-3 bg-purple-50 dark:bg-gray-700 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">٣ دراعات</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {formatNumberArabic(data.controllerDistribution.triple)}
              </p>
            </div>
            <div className="text-center p-3 bg-orange-50 dark:bg-gray-700 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">٤ دراعات</p>
              <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {formatNumberArabic(data.controllerDistribution.quad)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Device Usage */}
      {data.deviceUsage && data.deviceUsage.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-gray-600">
          <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Monitor className="w-4 h-4 text-blue-500" />
            أكثر الأجهزة استخداماً
          </h5>
          <div className="space-y-2">
            {data.deviceUsage.slice(0, 5).map((device, index) => (
              <div 
                key={device.deviceName} 
                className="flex justify-between items-center py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-500 text-white text-xs font-bold">
                    {toArabicNumbers(index + 1)}
                  </span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {device.deviceName}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">الجلسات</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {formatNumberArabic(device.sessionsCount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">الإيراد</p>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">
                      {formatNumberArabic(device.revenue)} ج.م
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Computer Sessions Report Component
const ComputerSessionsReport = ({ data }: { data: SessionsData['computer'] | null }) => {
  if (!data) {
    return (
      <div className="text-center py-8">
        <Monitor className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">
          لا توجد بيانات متاحة
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-green-200 dark:border-gray-600">
          <div className="flex items-center justify-center mb-2">
            <Monitor className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">عدد الجلسات</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatNumberArabic(data.totalSessions)}
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-blue-200 dark:border-gray-600">
          <div className="flex items-center justify-center mb-2">
            <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">الإيراد</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {formatNumberArabic(data.totalRevenue)} ج.م
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-purple-200 dark:border-gray-600">
          <div className="flex items-center justify-center mb-2">
            <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">متوسط المدة</p>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
            {formatNumberArabic(Number(data.avgDuration))} س
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-orange-200 dark:border-gray-600">
          <div className="flex items-center justify-center mb-2">
            <Target className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">متوسط الإيراد</p>
          <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
            {formatNumberArabic(Number(data.avgRevenue))} ج.م
          </p>
        </div>
      </div>

      {/* Device Usage */}
      {data.deviceUsage && data.deviceUsage.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-green-200 dark:border-gray-600">
          <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Monitor className="w-4 h-4 text-green-500" />
            أكثر الأجهزة استخداماً
          </h5>
          <div className="space-y-2">
            {data.deviceUsage.slice(0, 5).map((device, index) => (
              <div 
                key={device.deviceName} 
                className="flex justify-between items-center py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-green-50 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-green-500 text-white text-xs font-bold">
                    {toArabicNumbers(index + 1)}
                  </span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {device.deviceName}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">الجلسات</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {formatNumberArabic(device.sessionsCount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">الإيراد</p>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">
                      {formatNumberArabic(device.revenue)} ج.م
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// StatCardWithComparison Component
const StatCardWithComparison = ({ 
  icon: Icon, 
  title, 
  current, 
  comparison,
  color,
  formatValue = (val) => formatCurrencyUtil(val)
}: StatCardWithComparisonProps) => {
  const isIncrease = comparison ? comparison.change >= 0 : null;
  const hasComparison = comparison && comparison.previous !== undefined;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-all duration-200">
      <div className="flex items-center gap-4 mb-3">
        <div className={`rounded-full p-3 bg-${color}-100 dark:bg-gray-700`}>
          <Icon className={`h-6 w-6 text-${color}-600 dark:text-${color}-400`} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {formatValue(current)}
          </p>
        </div>
      </div>
      
      {hasComparison ? (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className={`flex items-center gap-2 text-sm ${
            isIncrease 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {isIncrease ? (
              <>
                <ArrowUp className="w-4 h-4" />
                <TrendingUp className="w-4 h-4" />
              </>
            ) : (
              <>
                <ArrowDown className="w-4 h-4" />
                <TrendingDown className="w-4 h-4" />
              </>
            )}
            <span className="font-bold">
              {Math.abs(comparison.changePercent).toFixed(1)}%
            </span>
            <span className="text-gray-500 dark:text-gray-400 text-xs">
              مقارنة بالفترة السابقة
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            الفترة السابقة: {formatValue(comparison.previous)}
          </div>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            لا توجد بيانات للمقارنة
          </p>
        </div>
      )}
    </div>
  );
};

// PeakHoursChart Component
const PeakHoursChart = ({ data }: { data: PeakHoursData | null }) => {
  const [viewMode, setViewMode] = useState<'sales' | 'sessions'>('sales');

  if (!data || !data.hourlyData || data.hourlyData.length === 0) {
    return (
      <p className="text-gray-500 dark:text-gray-400 text-center py-4">
        لا توجد بيانات متاحة
      </p>
    );
  }

  // Format hour for display (12-hour format with AM/PM in Arabic)
  const formatHour = (hour: number) => {
    if (hour === 0) return '12 ص';
    if (hour === 12) return '12 م';
    if (hour < 12) return `${hour} ص`;
    return `${hour - 12} م`;
  };

  // Prepare chart data with formatted hours
  const chartData = data.hourlyData.map(item => ({
    ...item,
    hourLabel: formatHour(item.hour),
    isPeak: data.peakHours.includes(item.hour)
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { hourLabel: string; isPeak: boolean; revenue: number; sales: number; sessions: number } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {data.hourLabel}
            {data.isPeak && (
              <span className="mr-2 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">
                ذروة
              </span>
            )}
          </p>
          <div className="space-y-1 text-xs">
            <p className="text-gray-600 dark:text-gray-400">
              الإيراد: <span className="font-bold text-green-600 dark:text-green-400">{formatCurrencyUtil(data.revenue)}</span>
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              المبيعات: <span className="font-bold text-blue-600 dark:text-blue-400">{formatDecimal(data.sales)}</span>
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              الجلسات: <span className="font-bold text-purple-600 dark:text-purple-400">{formatDecimal(data.sessions)}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* View Mode Toggle */}
      <div className="flex justify-between items-center">
        <h5 className="text-md font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-orange-500" />
          ساعات الذروة
        </h5>
        <div className="flex gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setViewMode('sales')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'sales'
                ? 'bg-white dark:bg-gray-600 text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            المبيعات
          </button>
          <button
            onClick={() => setViewMode('sessions')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'sessions'
                ? 'bg-white dark:bg-gray-600 text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            الجلسات
          </button>
        </div>
      </div>

      {/* Peak Hours Summary */}
      <div className="bg-orange-50 dark:bg-gray-700/30 rounded-lg p-4 border border-orange-100 dark:border-gray-600">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          ساعات الذروة (أعلى 3 ساعات):
        </p>
        <div className="flex flex-wrap gap-2">
          {data.peakHours.map(hour => (
            <span
              key={hour}
              className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full text-sm font-medium"
            >
              {formatHour(hour)}
            </span>
          ))}
        </div>
      </div>

      {/* Bar Chart */}
      <div className="h-80 w-full min-h-[320px]">
        <ResponsiveContainer width="100%" height="100%" minHeight={320}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis
              dataKey="hourLabel"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 12 }}
              label={{
                value: viewMode === 'sales' ? 'عدد المبيعات' : 'عدد الجلسات',
                angle: -90,
                position: 'insideLeft',
                style: { fill: '#6b7280', fontSize: 12 }
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => (
                <span className="text-gray-700 dark:text-gray-300">
                  {value === 'value' ? (viewMode === 'sales' ? 'المبيعات' : 'الجلسات') : value}
                </span>
              )}
            />
            <Bar
              dataKey={viewMode}
              radius={[8, 8, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isPeak ? '#f97316' : '#3b82f6'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Average Revenue per Hour */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div className="bg-blue-50 dark:bg-gray-700/30 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">متوسط الإيراد/ساعة</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {formatCurrencyUtil(
              data.hourlyData.reduce((sum, item) => sum + item.revenue, 0) / data.hourlyData.length
            )}
          </p>
        </div>
        <div className="bg-green-50 dark:bg-gray-700/30 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">متوسط المبيعات/ساعة</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">
            {formatDecimal(
              data.hourlyData.reduce((sum, item) => sum + item.sales, 0) / data.hourlyData.length
            )}
          </p>
        </div>
        <div className="bg-purple-50 dark:bg-gray-700/30 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">متوسط الجلسات/ساعة</p>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
            {formatDecimal(
              data.hourlyData.reduce((sum, item) => sum + item.sessions, 0) / data.hourlyData.length
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

// StaffPerformanceTable Component
const StaffPerformanceTable = ({ data }: { data: StaffPerformance[] | null }) => {
  if (!data || data.length === 0) {
    return (
      <p className="text-gray-500 dark:text-gray-400 text-center py-4">
        لا توجد بيانات متاحة
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                الموظف
              </th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                عدد الطلبات
              </th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                عدد الجلسات
              </th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                الإيراد الإجمالي
              </th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                متوسط قيمة الطلب
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((staff, index) => (
              <tr 
                key={staff.staffId}
                className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-sm font-bold">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {staff.staffName}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {formatDecimal(staff.ordersCount)}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                    {formatDecimal(staff.sessionsCount)}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">
                    {formatCurrencyUtil(staff.totalRevenue)}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                    {formatCurrencyUtil(staff.avgOrderValue)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="bg-blue-50 dark:bg-gray-700/30 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">إجمالي الطلبات</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {formatDecimal(data.reduce((sum, staff) => sum + staff.ordersCount, 0))}
          </p>
        </div>
        <div className="bg-purple-50 dark:bg-gray-700/30 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">إجمالي الجلسات</p>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
            {formatDecimal(data.reduce((sum, staff) => sum + staff.sessionsCount, 0))}
          </p>
        </div>
        <div className="bg-green-50 dark:bg-gray-700/30 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">إجمالي الإيراد</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">
            {formatCurrencyUtil(data.reduce((sum, staff) => sum + staff.totalRevenue, 0))}
          </p>
        </div>
      </div>
    </div>
  );
};

const Reports = () => {
  const { getSalesReport, getSessionsReport, getInventoryReport, getFinancialReport, exportReportToExcel, showNotification } = useApp();

  // أنواع الفلاتر وحالاتها
  const [filterType, setFilterType] = useState<'period' | 'daily' | 'monthly' | 'yearly' | 'custom'>('period');
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [customDay, setCustomDay] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [customMonth, setCustomMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [customYear, setCustomYear] = useState(() => new Date().getFullYear().toString());
  
  // Custom date and time filter states
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().set('hour', 0).set('minute', 0).set('second', 0),
    dayjs().set('hour', 23).set('minute', 59).set('second', 59)
  ]);
  
  const [timeRange, setTimeRange] = useState<[Dayjs, Dayjs]>([
    dayjs().set('hour', 0).set('minute', 0),
    dayjs().set('hour', 23).set('minute', 59)
  ]);

  // Show/hide states for amounts
  const [showRevenue, setShowRevenue] = useState(true);
  const [showProfit, setShowProfit] = useState(true);
  const [showCosts, setShowCosts] = useState(true);

  // الحصول على تاريخ اليوم بتوقيت مصر
  const getEgyptTime = useCallback((): Date => {
    const now = new Date();
    const egyptOffset = 2 * 60 * 60 * 1000; // توقيت مصر +2
    return new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + egyptOffset);
  }, []);

  // Handle date change while preserving time
  const handleDateChange = useCallback((date: Dayjs | null, type: 'start' | 'end') => {
    if (!date) return;

    if (type === 'start') {
      const startDate = date
        .set('hour', timeRange[0].hour())
        .set('minute', timeRange[0].minute())
        .set('second', 0);
      setDateRange([startDate, dateRange[1]]);
    } else {
      const endDate = date
        .set('hour', timeRange[1].hour())
        .set('minute', timeRange[1].minute())
        .set('second', 59);
      setDateRange([dateRange[0], endDate]);
    }
  }, [dateRange, timeRange]);

  // Handle time change while preserving date
  const handleTimeChange = useCallback((time: Dayjs | null, type: 'start' | 'end') => {
    if (!time) return;

    if (type === 'start') {
      const newStartTime = time;
      const newStartDate = dateRange[0]
        .set('hour', newStartTime.hour())
        .set('minute', newStartTime.minute())
        .set('second', 0);
      setTimeRange([newStartTime, timeRange[1]]);
      setDateRange([newStartDate, dateRange[1]]);
    } else {
      const newEndTime = time;
      const newEndDate = dateRange[1]
        .set('hour', newEndTime.hour())
        .set('minute', newEndTime.minute())
        .set('second', 59);
      setTimeRange([timeRange[0], newEndTime]);
      setDateRange([dateRange[0], newEndDate]);
    }
  }, [dateRange, timeRange]);

  // تعريف نوع البيانات المستخدمة في الفلاتر
  interface ReportFilter extends Record<string, unknown> {
    startDate: string;
    endDate: string;
    establishmentId?: string;
  }

  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ReportData>({
    sales: null,
    sessions: null,
    inventory: null,
    financial: null
  });

  const buildFilter = useCallback((): ReportFilter => {
    const now = getEgyptTime();
    let startDate: Date;
    let endDate: Date;

    if (filterType === 'custom') {
      // Use custom date and time range
      return {
        startDate: dateRange[0].toISOString(),
        endDate: dateRange[1].toISOString()
      };
    } else if (filterType === 'daily') {
      const selectedDay = new Date(customDay);
      startDate = startOfDay(selectedDay);
      endDate = endOfDay(selectedDay);
    } else if (filterType === 'monthly') {
      const [year, month] = customMonth.split('-').map(Number);
      startDate = startOfMonth(new Date(year, month - 1, 1));
      endDate = endOfMonth(new Date(year, month - 1, 1));
    } else if (filterType === 'yearly') {
      const selectedYear = parseInt(customYear);
      startDate = startOfYear(new Date(selectedYear, 0, 1));
      endDate = endOfYear(new Date(selectedYear, 0, 1));
    } else {
      // Handle period filter
      if (selectedPeriod === 'yesterday') {
        const yesterday = addDays(now, -1);
        startDate = startOfDay(yesterday);
        endDate = endOfDay(yesterday);
      } else if (selectedPeriod === 'thisWeek') {
        // بداية الأسبوع (السبت) في الدول العربية
        const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
        // حساب عدد الأيام من السبت الماضي
        const daysFromSaturday = dayOfWeek === 6 ? 0 : dayOfWeek + 1;
        startDate = addDays(startOfDay(now), -daysFromSaturday);
        endDate = endOfDay(now);
      } else if (selectedPeriod === 'last7') {
        startDate = addDays(now, -6);
        endDate = now;
      } else if (selectedPeriod === 'last30') {
        startDate = addDays(now, -29);
        endDate = now;
      } else if (selectedPeriod === 'thisMonth') {
        startDate = startOfMonth(now);
        endDate = now;
      } else if (selectedPeriod === 'lastMonth') {
        const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate = startOfMonth(firstDayOfLastMonth);
        endDate = endOfMonth(firstDayOfLastMonth);
      } else if (selectedPeriod === 'thisYear') {
        startDate = startOfYear(now);
        endDate = now;
      } else {
        // Default to today
        startDate = startOfDay(now);
        endDate = endOfDay(now);
      }
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }, [filterType, selectedPeriod, customDay, customMonth, customYear, getEgyptTime, dateRange]);

  const getDateRangeLabel = useCallback(() => {
    const formatDate = (date: Date) => format(date, 'dd/MM/yyyy', { locale: ar });

    try {
      const filter = buildFilter();
      const start = new Date(filter.startDate);
      const end = new Date(filter.endDate);

      if (filterType === 'custom') {
        // Format with time for custom filter
        const startFormatted = dateRange[0].format('dddd، D MMMM YYYY [عند] hh:mm A');
        const endFormatted = dateRange[1].format('dddd، D MMMM YYYY [عند] hh:mm A');
        return `من ${startFormatted} إلى ${endFormatted}`;
      } else if (filterType === 'daily') {
        return `يوم ${formatDate(start)}`;
      } else if (filterType === 'monthly') {
        return `شهر ${format(start, 'MMMM yyyy', { locale: ar })}`;
      } else if (filterType === 'yearly') {
        return `سنة ${start.getFullYear()}`;
      } else {
        if (start.toDateString() === end.toDateString()) {
          return `يوم ${formatDate(start)}`;
        }
        return `من ${formatDate(start)} إلى ${formatDate(end)}`;
      }
    } catch {
      return 'تحديد النطاق الزمني';
    }
  }, [buildFilter, filterType, dateRange]);

  const loadReports = useCallback(async () => {
    const filter = buildFilter();
    try {
      setLoading(true);

      // إضافة معرف المنشأة من بيانات المستخدم الحالي
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const establishmentId = userData.establishmentId || 'default-establishment';

      // إنشاء كائن لجمع النتائج
      const results: ReportData = {
        sales: null,
        sessions: null,
        inventory: null,
        financial: null
      };

      // جلب التقارير بشكل متوازٍ
      const reportsPromises = [
        {
          key: 'sales' as const,
          promise: getSalesReport({ ...filter, establishmentId })
        },
        {
          key: 'sessions' as const,
          promise: getSessionsReport({ ...filter, establishmentId }, undefined)
        },
        {
          key: 'inventory' as const,
          promise: getInventoryReport()
        },
        {
          key: 'financial' as const,
          promise: getFinancialReport({ ...filter, establishmentId })
        }
      ];

      // معالجة كل طلب على حدة مع تسجيل النتائج
      const errors: {key: keyof ReportData, reason: unknown}[] = [];

      for (const {key, promise} of reportsPromises) {
        try {
          const value = await promise;
          
          if (key === 'sales') {
            results[key] = value as SalesReportData;
          
          } else if (key === 'sessions') {
            results[key] = value as SessionsReportData;
          } else {
            results[key] = value as Record<string, unknown>;
          }
          
          // Log financial data for debugging
          if (key === 'financial') {
         }
        } catch (error) {
          console.error(`❌ Error loading ${key} report:`, error);
          errors.push({ key, reason: error });
        }
      }


      // تحديث حالة المكون بالنتائج
      setReports(results);

      // إظهار إشعار في حالة وجود أخطاء
      if (errors.length > 0) {
        showNotification(`تم تحميل التقارير مع ${errors.length} أخطاء`, 'warning');
      }

    } catch (error) {
      console.error('Failed to load reports:', error);
      showNotification('خطأ في تحميل التقارير', 'error');
    } finally {
      setLoading(false);
    }
  }, [buildFilter, getSalesReport, getSessionsReport, getInventoryReport, getFinancialReport, showNotification]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Memoize calculations for better performance
  const basicStats = useMemo((): BasicStats => {
    if (!reports.sales) return { revenue: 0, orders: 0, avgOrderValue: 0, sessions: 0 };

    const revenue = reports.sales.totalRevenue || 0;
    const orders = reports.sales.totalOrders || 0;
    const avgOrderValue = orders > 0 ? revenue / orders : 0;
    const sessions = reports.sessions?.totalSessions || 0;

    return { revenue, orders, avgOrderValue, sessions };
  }, [reports.sales, reports.sessions]);

  const revenueBreakdown = useMemo((): RevenueBreakdown => {
    if (!reports.sales) return { playstation: 0, computer: 0, cafe: 0 };

    return {
      playstation: reports.sales.revenueByType?.playstation || 0,
      computer: reports.sales.revenueByType?.computer || 0,
      cafe: reports.sales.revenueByType?.cafe || 0
    };
  }, [reports.sales]);

  const netProfit = useMemo((): number => {
    if (!reports.financial) return 0;
    const financial = reports.financial as {
      profit?: number;
      summary?: { netProfit?: number };
    };
    const value = financial?.summary?.netProfit || financial?.profit || 0;
    return value;
  }, [reports.financial]);

  const profitMargin = useMemo((): number => {
    if (!reports.financial) return 0;
    const financial = reports.financial as {
      summary?: { profitMargin?: number };
      profitMargin?: number;
    };
    const value = financial?.summary?.profitMargin || financial?.profitMargin || 0;
    return value;
  }, [reports.financial]);

  const totalTransactions = useMemo((): number => {
    if (!reports.financial) return 0;
    const financial = reports.financial as {
      summary?: { totalTransactions?: number };
      totalTransactions?: number;
    };
    const value = financial?.summary?.totalTransactions || financial?.totalTransactions || 0;
    return value;
  }, [reports.financial]);

  const totalCosts = useMemo((): number => {
    if (!reports.financial) return 0;
    const financial = reports.financial as {
      summary?: { totalCosts?: number };
      totalCosts?: number;
    };
    const value = financial?.summary?.totalCosts || financial?.totalCosts || 0;
    return value;
  }, [reports.financial]);

  // تنسيق الأرقام
  const formatNumber = (num: number) => formatNumberArabic(num);
  const formatCurrency = (amount: number) => `${formatNumberArabic(amount)} ج.م`;

  const totalRevenue = basicStats.revenue;

  // Export PDF function
  const handleExportPDF = useCallback(async (reportType: 'sales' | 'financial' | 'sessions' | 'inventory') => {
    try {
      const filter = buildFilter();
      
      // Get the appropriate data based on report type
      let data: any;
      let dateRange = {
        startDate: filter.startDate as string || new Date().toISOString(),
        endDate: filter.endDate as string || new Date().toISOString(),
      };

      switch (reportType) {
        case 'sales':
          data = reports.sales;
          break;
        case 'financial':
          data = reports.financial;
          break;
        case 'sessions':
          data = reports.sessions;
          break;
        case 'inventory':
          data = reports.inventory;
          break;
      }

      if (!data) {
        showNotification('لا توجد بيانات للتصدير', 'warning');
        return;
      }

      const filename = generatePDFFilename(reportType, dateRange);
      
      await exportReportToPDF({
        reportType,
        data,
        dateRange,
        organizationName: 'Bomba', // يمكنك تغيير هذا ليكون ديناميكي
        filename,
      });

      showNotification('تم تصدير PDF بنجاح', 'success');
    } catch (error) {
      console.error('PDF Export Error:', error);
      showNotification('فشل في تصدير PDF', 'error');
    }
  }, [reports, buildFilter, showNotification]);

  // Keep old Excel export for backward compatibility
  const handleExport = useCallback(async (
    exportFunc: (reportType: string, filter: Record<string, unknown>) => Promise<void>,
    reportType: string
  ) => {
    try {
      const filter = buildFilter();
      await exportFunc(reportType, filter);
      showNotification('تم التصدير بنجاح', 'success');
    } catch {
      showNotification('فشل في تصدير التقرير', 'error');
    }
  }, [buildFilter, showNotification]);

  const renderFilterControls = () => {
    const inputClasses = "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:focus:ring-orange-500 dark:focus:border-orange-500 rounded-md px-3 py-2 text-sm w-full";

    // تحويل التاريخ إلى تنسيق عربي
    const formatArabicDate = (dateString: string) => {
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'Africa/Cairo'
        });
      } catch {
        return dateString;
      }
    };

    // إنشاء قائمة بالسنوات (10 سنوات سابقة وحالية)
    const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

    // إنشاء قائمة بالأشهر بالعربية
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    return (
      <div className="space-y-4">
        {/* شريط التبويب لنوع الفلتر */}
        <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
          {[
            { value: 'period', label: 'فترات زمنية' },
            { value: 'custom', label: 'فلتر مخصص' },
            { value: 'daily', label: 'يوم محدد' },
            { value: 'monthly', label: 'شهري' },
            { value: 'yearly', label: 'سنوي' }
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterType(tab.value as 'period' | 'custom' | 'daily' | 'monthly' | 'yearly')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                filterType === tab.value
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* محتوى الفلاتر */}
        <div className="space-y-4">
          {filterType === 'period' && (
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'today', label: 'اليوم' },
                { value: 'yesterday', label: 'أمس' },
                { value: 'thisWeek', label: 'هذا الأسبوع' },
                { value: 'thisMonth', label: 'هذا الشهر' },
                { value: 'lastMonth', label: 'الشهر الماضي' },
                { value: 'thisYear', label: 'هذه السنة' }
              ].map((period) => (
                <button
                  key={period.value}
                  onClick={() => setSelectedPeriod(period.value)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    selectedPeriod === period.value
                      ? 'bg-orange-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          )}

          {filterType === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Start Date/Time */}
              <div className="space-y-3">
                <div className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  <div className="w-2 h-2 bg-blue-500 rounded-full ml-2"></div>
                  <span>وقت البدء</span>
                </div>
                <div className="space-y-3">
                  <DatePicker
                    value={dateRange[0]}
                    onChange={(date) => handleDateChange(date, 'start')}
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
                <div className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  <div className="w-2 h-2 bg-red-500 rounded-full ml-2"></div>
                  <span>وقت الانتهاء</span>
                </div>
                <div className="space-y-3">
                  <DatePicker
                    value={dateRange[1]}
                    onChange={(date) => handleDateChange(date, 'end')}
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

              {/* Selected Range Summary */}
              <div className="col-span-2 p-4 bg-blue-50 dark:bg-gray-700 rounded-lg border border-blue-100 dark:border-gray-600">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col">
                    <span className="text-sm text-blue-600 dark:text-blue-400 mb-1">من</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {dateRange[0].format('dddd، D MMMM YYYY [عند] hh:mm A')}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-blue-600 dark:text-blue-400 mb-1">إلى</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {dateRange[1].format('dddd، D MMMM YYYY [عند] hh:mm A')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {filterType === 'daily' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                اختر تاريخ
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={customDay}
                  onChange={(e) => setCustomDay(e.target.value)}
                  className={`${inputClasses} pr-10`}
                  dir="ltr"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
                  {formatArabicDate(customDay)}
                </span>
              </div>
            </div>
          )}

          {filterType === 'monthly' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                اختر الشهر
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <select
                    value={customMonth.split('-')[1]}
                    onChange={(e) => {
                      const month = e.target.value.padStart(2, '0');
                      setCustomMonth(`${customMonth.split('-')[0]}-${month}`);
                    }}
                    className={`${inputClasses} appearance-none`}
                  >
                    {months.map((month, index) => (
                      <option key={index} value={(index + 1).toString().padStart(2, '0')}>
                        {month}
                      </option>
                    ))}
                  </select>
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <div className="relative">
                  <select
                    value={customMonth.split('-')[0]}
                    onChange={(e) => {
                      const year = e.target.value;
                      setCustomMonth(`${year}-${customMonth.split('-')[1]}`);
                    }}
                    className={`${inputClasses} appearance-none`}
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {filterType === 'yearly' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                اختر السنة
              </label>
              <div className="relative">
                <select
                  value={customYear}
                  onChange={(e) => setCustomYear(e.target.value)}
                  className={`${inputClasses} appearance-none`}
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* عرض النطاق الزمني المحدد */}
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">النطاق الزمني:</span> {getDateRangeLabel()}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 dark:border-orange-400"></div>
      </div>
    );
  }

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
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 rounded-2xl flex items-center justify-center shadow-lg">
              <BarChart3 className="text-white w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">التقارير الشاملة</h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">تحليل شامل للمبيعات والجلسات والأداء</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              onClick={loadReports}
              disabled={loading}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 font-medium disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              <span>تحديث البيانات</span>
            </button>
            <button
              onClick={() => handleExportPDF('sales')}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 font-medium"
            >
              <Printer className="w-5 h-5" />
              <span>طباعة</span>
            </button>
            <button
              onClick={() => handleExport(exportReportToExcel, 'all')}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 dark:from-orange-600 dark:to-orange-700 dark:hover:from-orange-700 dark:hover:to-orange-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 font-medium border-0"
            >
              <Download className="w-5 h-5" />
              <span>تصدير Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date/Time Picker and Quick Stats Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Date/Time Picker Card */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300">
            <div className="p-6 bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700">
              <h3 className="text-xl font-bold text-white flex items-center">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center ml-3">
                  <Filter className="text-white text-lg" />
                </div>
                نطاق التقرير
              </h3>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-900">
              {renderFilterControls()}
            </div>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="space-y-4">
          {/* Total Revenue Card */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 rounded-2xl shadow-lg p-6 text-white transition-all duration-300 hover:shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <DollarSign className="w-7 h-7" />
              </div>
              <button
                onClick={() => setShowRevenue(!showRevenue)}
                title={showRevenue ? 'إخفاء المبلغ' : 'إظهار المبلغ'}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors duration-200"
              >
                {showRevenue ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <div className="text-3xl font-bold mb-2">
              {showRevenue ? formatCurrency(basicStats.revenue) : '••••••'}
            </div>
            <div className="text-green-100 text-sm font-medium">إجمالي الإيرادات</div>
          </div>

          {/* Total Orders Card */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-2xl shadow-lg p-6 text-white transition-all duration-300 hover:shadow-xl">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-4">
              <ShoppingCart className="w-7 h-7" />
            </div>
            <div className="text-3xl font-bold mb-2">
              {formatNumber(basicStats.orders)}
            </div>
            <div className="text-blue-100 text-sm font-medium">عدد الطلبات</div>
          </div>

          {/* Total Sessions Card */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 rounded-2xl shadow-lg p-6 text-white transition-all duration-300 hover:shadow-xl">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-4">
              <Gamepad2 className="w-7 h-7" />
            </div>
            <div className="text-3xl font-bold mb-2">
              {formatNumber(basicStats.sessions)}
            </div>
            <div className="text-purple-100 text-sm font-medium">عدد الجلسات</div>
          </div>
        </div>
      </div>

      {/* Detailed Statistics with Comparison */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-orange-500" />
          <span>الإحصائيات التفصيلية</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCardWithComparison
            icon={DollarSign}
            title="إجمالي الإيرادات"
            current={basicStats.revenue}
            comparison={reports.sales?.comparison?.revenue || null}
            color="green"
            formatValue={formatCurrency}
          />
          <StatCardWithComparison
            icon={ShoppingCart}
            title="عدد الطلبات"
            current={basicStats.orders}
            comparison={reports.sales?.comparison?.orders || null}
            color="blue"
            formatValue={formatNumber}
          />
          <StatCardWithComparison
            icon={TrendingUp}
            title="متوسط الطلب"
            current={basicStats.avgOrderValue}
            comparison={reports.sales?.comparison?.avgOrderValue || null}
            color="purple"
            formatValue={formatCurrency}
          />
          <StatCardWithComparison
            icon={Users}
            title="عدد الجلسات"
            current={basicStats.sessions}
            comparison={reports.sessions?.comparison?.sessions || null}
            color="orange"
            formatValue={formatNumber}
          />
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-green-500" />
          <span>توزيع الإيرادات</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <RevenueCard
            icon={Gamepad2}
            title="البلايستيشن"
            value={revenueBreakdown.playstation}
            total={totalRevenue}
            color="blue"
          />
          <RevenueCard
            icon={Monitor}
            title="الكمبيوتر"
            value={revenueBreakdown.computer}
            total={totalRevenue}
            color="green"
          />
          <RevenueCard
            icon={ShoppingCart}
            title="الطلبات"
            value={revenueBreakdown.cafe}
            total={totalRevenue}
            color="orange"
          />
        </div>
      </div>

      {/* Top Products by Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-orange-500" />
            <span>أكثر المنتجات مبيعاً حسب الأقسام</span>
          </h2>
          <div className="flex gap-2">
            <button onClick={() => handleExport(exportReportToExcel, 'sales')} className="text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="تصدير Excel">
              <Download className="h-5 w-5" />
            </button>
            <button onClick={() => handleExportPDF('sales')} className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="تصدير PDF">
              <Printer className="h-5 w-5" />
            </button>
          </div>
        </div>
        <TopProductsBySection 
          data={reports.sales?.topProductsBySection || []} 
        />
      </div>

      {/* Gaming Sessions - Separate PlayStation and Computer */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <Gamepad2 className="w-6 h-6 text-blue-500" />
          <span>تحليل جلسات الألعاب</span>
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-700 dark:to-gray-600 rounded-xl p-6 border border-blue-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                البلايستيشن
              </h3>
              <div className="flex gap-2">
                <button onClick={() => handleExport(exportReportToExcel, 'sessions')} className="text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 p-1" title="تصدير Excel">
                  <Download className="h-5 w-5" />
                </button>
                <button onClick={() => handleExportPDF('sessions')} className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 p-1" title="تصدير PDF">
                  <Printer className="h-5 w-5" />
                </button>
              </div>
            </div>
            <PlayStationSessionsReport 
              data={reports.sessions?.playstation || null} 
            />
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-700 dark:to-gray-600 rounded-xl p-6 border border-green-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Monitor className="w-5 h-5 text-green-600 dark:text-green-400" />
                الكمبيوتر
              </h3>
              <div className="flex gap-2">
                <button onClick={() => handleExport(exportReportToExcel, 'sessions')} className="text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 p-1" title="تصدير Excel">
                  <Download className="h-5 w-5" />
                </button>
                <button onClick={() => handleExportPDF('sessions')} className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 p-1" title="تصدير PDF">
                  <Printer className="h-5 w-5" />
                </button>
              </div>
            </div>
            <ComputerSessionsReport 
              data={reports.sessions?.computer || null} 
            />
          </div>
        </div>
      </div>

      {/* Peak Hours Analysis */}
      <ReportSection 
        title="تحليل ساعات الذروة" 
        onExportExcel={() => handleExport(exportReportToExcel, 'peakHours')} 
        onExportPDF={() => handleExportPDF('sales')}
      >
        <PeakHoursChart 
          data={reports.sales?.peakHours || null} 
        />
      </ReportSection>

      {/* Staff Performance */}
      <ReportSection 
        title="أداء الموظفين" 
        onExportExcel={() => handleExport(exportReportToExcel, 'staffPerformance')} 
        onExportPDF={() => handleExportPDF('sales')}
      >
        <StaffPerformanceTable 
          data={reports.sales?.staffPerformance || null} 
        />
      </ReportSection>

      {/* Financial Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-green-500" />
            <span>الملخص المالي</span>
          </h2>
          <div className="flex gap-2">
            <button onClick={() => handleExport(exportReportToExcel, 'financial')} className="text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="تصدير Excel">
              <Download className="h-5 w-5" />
            </button>
            <button onClick={() => handleExportPDF('financial')} className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="تصدير PDF">
              <Printer className="h-5 w-5" />
            </button>
          </div>
        </div>
        {reports.financial ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Net Profit Card */}
            <div className={`rounded-xl p-6 border-2 transition-all duration-200 ${
              netProfit >= 0 
                ? 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700' 
                : 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  netProfit >= 0 
                    ? 'bg-green-500 dark:bg-green-600' 
                    : 'bg-red-500 dark:bg-red-600'
                }`}>
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <button
                  onClick={() => setShowProfit(!showProfit)}
                  title={showProfit ? 'إخفاء المبلغ' : 'إظهار المبلغ'}
                  className={`p-2 rounded-lg transition-colors ${
                    netProfit >= 0
                      ? 'hover:bg-green-200 dark:hover:bg-green-800/30 text-green-700 dark:text-green-400'
                      : 'hover:bg-red-200 dark:hover:bg-red-800/30 text-red-700 dark:text-red-400'
                  }`}
                >
                  {showProfit ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className={`text-3xl font-bold mb-2 ${
                netProfit >= 0 
                  ? 'text-green-700 dark:text-green-400' 
                  : 'text-red-700 dark:text-red-400'
              }`}>
                {showProfit ? formatCurrency(netProfit) : '••••••'}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">إجمالي الربح</div>
              {netProfit < 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                  <TrendingDown className="w-4 h-4" />
                  <span>خسارة</span>
                </div>
              )}
            </div>

            {/* Total Costs Card */}
            <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-gray-700 dark:to-gray-600 rounded-xl p-6 border-2 border-red-200 dark:border-gray-600">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-red-500 dark:bg-red-600 rounded-xl flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-white" />
                </div>
                <button
                  onClick={() => setShowCosts(!showCosts)}
                  title={showCosts ? 'إخفاء المبلغ' : 'إظهار المبلغ'}
                  className="hover:bg-red-200 dark:hover:bg-red-800/30 p-2 rounded-lg transition-colors text-red-700 dark:text-red-400"
                >
                  {showCosts ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="text-3xl font-bold text-red-700 dark:text-red-400 mb-2">
                {showCosts ? formatCurrency(totalCosts) : '••••••'}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">إجمالي التكاليف</div>
            </div>

            {/* Profit Margin Card */}
            <div className={`rounded-xl p-6 border-2 transition-all duration-200 ${
              profitMargin >= 0 
                ? 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-gray-700 dark:to-gray-600 border-purple-200 dark:border-gray-600' 
                : 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  profitMargin >= 0 
                    ? 'bg-purple-500 dark:bg-purple-600' 
                    : 'bg-red-500 dark:bg-red-600'
                }`}>
                  <Target className="w-6 h-6 text-white" />
                </div>
                {profitMargin < 0 && (
                  <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                )}
              </div>
              <div className={`text-3xl font-bold mb-2 ${
                profitMargin >= 0 
                  ? 'text-purple-700 dark:text-purple-400' 
                  : 'text-red-700 dark:text-red-400'
              }`}>
                {formatNumber(profitMargin)}%
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">هامش الربح</div>
            </div>

            {/* Total Transactions Card */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-700 dark:to-gray-600 rounded-xl p-6 border-2 border-orange-200 dark:border-gray-600">
              <div className="w-12 h-12 bg-orange-500 dark:bg-orange-600 rounded-xl flex items-center justify-center mb-3">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-bold text-orange-700 dark:text-orange-400 mb-2">
                {formatNumber(totalTransactions)}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">عدد المعاملات</div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">لا توجد بيانات مالية متاحة</p>
        )}
      </div>

      {/* Inventory Summary */}
      <ReportSection title="ملخص المخزون" onExportExcel={() => handleExport(exportReportToExcel, 'inventory')} onExportPDF={() => handleExportPDF('inventory')}>
        {reports.inventory && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FinancialStat
              label="إجمالي المنتجات"
              value={formatNumber((reports.inventory as { totalItems?: number })?.totalItems || 0)}
              color="green"
            />
            <FinancialStat
              label="إجمالي الكمية"
              value={formatNumber((reports.inventory as { totalQuantity?: number })?.totalQuantity || 0)}
              color="blue"
            />
            <FinancialStat
              label="إجمالي القيمة"
              value={formatCurrency((reports.inventory as { totalValue?: number })?.totalValue || 0)}
              color="purple"
            />
            <FinancialStat
              label="مخزون منخفض"
              value={formatNumber((reports.inventory as { lowStockItems?: number })?.lowStockItems || 0)}
              color="orange"
            />
          </div>
        )}
      </ReportSection>
    </div>
    </ConfigProvider>
  );
};

// Helper Components for cleaner structure

const RevenueCard = ({ icon: Icon, title, value, total, color }: RevenueCardProps) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all duration-200">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${color}-100 dark:bg-${color}-900/30`}>
          <Icon className={`h-6 w-6 text-${color}-600 dark:text-${color}-400`} />
        </div>
        {title}
      </h3>
      <span className={`text-sm font-bold px-3 py-1.5 rounded-full bg-${color}-100 text-${color}-800 dark:bg-${color}-900/30 dark:text-${color}-300`}>
        {formatNumberArabic((value / total) * 100 || 0)}%
      </span>
    </div>
    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 text-center mt-4">
      {formatNumberArabic(value)} ج.م
    </p>
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>من الإجمالي</span>
        <span className="font-semibold">{formatNumberArabic(total)} ج.م</span>
      </div>
    </div>
  </div>
);

const ReportSection = ({ title, onExportExcel, onExportPDF, children }: ReportSectionProps) => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl transition-all duration-200">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h3>
      <div className="flex gap-2">
        <button 
          onClick={onExportExcel} 
          className="text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" 
          title="تصدير Excel"
        >
          <Download className="h-5 w-5" />
        </button>
        <button 
          onClick={onExportPDF} 
          className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" 
          title="تصدير PDF"
        >
          <Printer className="h-5 w-5" />
        </button>
      </div>
    </div>
    {children}
  </div>
);

const FinancialStat = ({ label, value, color, showWarning = false }: FinancialStatProps) => (
  <div className={`text-center p-6 bg-gradient-to-br from-${color}-50 to-${color}-100 dark:from-gray-700 dark:to-gray-600 rounded-xl hover:shadow-md transition-all duration-200 border-2 border-${color}-200 dark:border-gray-600`}>
    <div className="flex items-center justify-center gap-2 mb-3">
      {showWarning && (
        <svg 
          className="w-6 h-6 text-red-600 dark:text-red-400 animate-pulse" 
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path 
            fillRule="evenodd" 
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
            clipRule="evenodd" 
          />
        </svg>
      )}
    </div>
    <div className={`text-3xl font-bold text-${color}-700 dark:text-${color}-400 mb-2`}>{value}</div>
    <div className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</div>
  </div>
);

export default Reports;
