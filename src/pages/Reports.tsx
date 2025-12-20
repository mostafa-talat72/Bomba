import { useState, useEffect, useCallback, ReactNode } from 'react';
import { TrendingUp, TrendingDown, ArrowUp, ArrowDown, DollarSign, Users, ShoppingCart, Download, Printer, RefreshCw, Gamepad2, Monitor, Clock, Target, Filter, ChevronDown, BarChart3 } from 'lucide-react';
import { format, addDays, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { ar } from 'date-fns/locale';
import { DatePicker, TimePicker } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ar';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

// Configure dayjs
dayjs.locale('ar');
dayjs.extend(customParseFormat);

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
      <p className="text-gray-500 dark:text-gray-400 text-center py-4">
        لا توجد بيانات متاحة
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {data.map(section => (
        <div 
          key={section.sectionId} 
          className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md"
        >
          <div 
            className="flex justify-between items-center p-4 cursor-pointer bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={() => toggleSection(section.sectionId)}
          >
            <div className="flex items-center gap-3">
              <ChevronDown 
                className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
                  expandedSections.has(section.sectionId) ? 'rotate-180' : ''
                }`} 
              />
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {section.sectionName}
              </h4>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">الكمية الإجمالية</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {formatDecimal(section.totalQuantity)} قطعة
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">الإيراد الإجمالي</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCurrencyUtil(section.totalRevenue)}
                </p>
              </div>
            </div>
          </div>
          
          {expandedSections.has(section.sectionId) && (
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              {section.products && section.products.length > 0 ? (
                <div className="space-y-2">
                  {section.products.map((product, index) => (
                    <div 
                      key={`${product.name}-${index}`} 
                      className="flex justify-between items-center py-3 px-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {product.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-xs text-gray-500 dark:text-gray-400">الكمية</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            {formatDecimal(product.quantity)} قطعة
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 dark:text-gray-400">الإيراد</p>
                          <p className="text-sm font-bold text-green-600 dark:text-green-400">
                            {formatCurrencyUtil(product.revenue)}
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
      <p className="text-gray-500 dark:text-gray-400 text-center py-4">
        لا توجد بيانات متاحة
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-gray-700/30 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Gamepad2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">عدد الجلسات</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatDecimal(data.totalSessions)}
          </p>
        </div>
        
        <div className="bg-green-50 dark:bg-gray-700/30 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">الإيراد</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrencyUtil(data.totalRevenue)}
          </p>
        </div>
        
        <div className="bg-purple-50 dark:bg-gray-700/30 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">متوسط المدة</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {formatDecimal(data.avgDuration)} ساعة
          </p>
        </div>
        
        <div className="bg-orange-50 dark:bg-gray-700/30 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Target className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">متوسط الإيراد</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {formatCurrencyUtil(data.avgRevenue)}
          </p>
        </div>
      </div>

      {/* Controller Distribution */}
      {data.controllerDistribution && (
        <div className="bg-white dark:bg-gray-700/30 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <h5 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-blue-500" />
            توزيع الدراعات
          </h5>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-blue-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">1-2 دراعات</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {formatDecimal(data.controllerDistribution.single)}
              </p>
            </div>
            <div className="text-center p-3 bg-purple-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">3 دراعات</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {formatDecimal(data.controllerDistribution.triple)}
              </p>
            </div>
            <div className="text-center p-3 bg-orange-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">4 دراعات</p>
              <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {formatDecimal(data.controllerDistribution.quad)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Device Usage */}
      {data.deviceUsage && data.deviceUsage.length > 0 && (
        <div className="bg-white dark:bg-gray-700/30 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <h5 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-blue-500" />
            أكثر الأجهزة استخداماً
          </h5>
          <div className="space-y-2">
            {data.deviceUsage.slice(0, 5).map((device, index) => (
              <div 
                key={device.deviceName} 
                className="flex justify-between items-center py-3 px-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {device.deviceName}
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">الجلسات</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {formatDecimal(device.sessionsCount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">الإيراد</p>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">
                      {formatCurrencyUtil(device.revenue)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">معدل الاستخدام</p>
                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {formatDecimal(device.usageRate)}%
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
      <p className="text-gray-500 dark:text-gray-400 text-center py-4">
        لا توجد بيانات متاحة
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-green-50 dark:bg-gray-700/30 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Monitor className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">عدد الجلسات</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatDecimal(data.totalSessions)}
          </p>
        </div>
        
        <div className="bg-blue-50 dark:bg-gray-700/30 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">الإيراد</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatCurrencyUtil(data.totalRevenue)}
          </p>
        </div>
        
        <div className="bg-purple-50 dark:bg-gray-700/30 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">متوسط المدة</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {formatDecimal(data.avgDuration)} ساعة
          </p>
        </div>
        
        <div className="bg-orange-50 dark:bg-gray-700/30 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Target className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">متوسط الإيراد</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {formatCurrencyUtil(data.avgRevenue)}
          </p>
        </div>
      </div>

      {/* Device Usage */}
      {data.deviceUsage && data.deviceUsage.length > 0 && (
        <div className="bg-white dark:bg-gray-700/30 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <h5 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-green-500" />
            أكثر الأجهزة استخداماً
          </h5>
          <div className="space-y-2">
            {data.deviceUsage.slice(0, 5).map((device, index) => (
              <div 
                key={device.deviceName} 
                className="flex justify-between items-center py-3 px-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {device.deviceName}
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">الجلسات</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {formatDecimal(device.sessionsCount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">الإيراد</p>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">
                      {formatCurrencyUtil(device.revenue)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">معدل الاستخدام</p>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">
                      {formatDecimal(device.usageRate)}%
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
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
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
  const { getSalesReport, getSessionsReport, getInventoryReport, getFinancialReport, exportReportToExcel, exportReportToPDF, showNotification } = useApp();

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
        } catch (error) {
          console.error(`Error loading ${key} report:`, error);
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

  // حساب الإحصائيات الأساسية
  interface BasicStats {
    revenue: number;
    orders: number;
    avgOrderValue: number;
    sessions: number;
  }

  const calculateBasicStats = (): BasicStats => {
    if (!reports.sales) return { revenue: 0, orders: 0, avgOrderValue: 0, sessions: 0 };

    const revenue = reports.sales.totalRevenue || 0;
    const orders = reports.sales.totalOrders || 0;
    const avgOrderValue = orders > 0 ? revenue / orders : 0;
    const sessions = reports.sessions?.totalSessions || 0;

    return { revenue, orders, avgOrderValue, sessions };
  };

  // حساب توزيع الإيرادات
  interface RevenueBreakdown {
    playstation: number;
    computer: number;
    cafe: number;
  }

  const calculateRevenueBreakdown = (): RevenueBreakdown => {
    if (!reports.sales) return { playstation: 0, computer: 0, cafe: 0 };

    return {
      playstation: reports.sales.revenueByType?.playstation || 0,
      computer: reports.sales.revenueByType?.computer || 0,
      cafe: reports.sales.revenueByType?.cafe || 0
    };
  };

  // حساب الأرباح الإجمالية
  const calculateNetProfit = (): number => {
    if (!reports.financial) return 0;
    const financial = reports.financial as {
      profit?: number;
      summary?: { netProfit?: number };
    };
    return financial?.profit || financial?.summary?.netProfit || 0;
  };

  // حساب هامش الربح
  const calculateProfitMargin = (): number => {
    if (!reports.financial) return 0;
    const financial = reports.financial as {
      totalRevenue?: number;
      summary?: { totalRevenue?: number; totalPaid?: number; netProfit?: number };
      totalPaid?: number;
      profit?: number;
    };

    const revenue = financial?.totalRevenue || financial?.summary?.totalRevenue || 0;
    const paid = financial?.totalPaid || financial?.summary?.totalPaid || 0;
    const profit = financial?.profit || financial?.summary?.netProfit || 0;
    const actualRevenue = paid > 0 ? paid : revenue;
    return actualRevenue === 0 ? 0 : (profit / actualRevenue) * 100;
  };

  // حساب عدد المعاملات
  const calculateTotalTransactions = (): number => {
    if (reports.financial) {
      const financial = reports.financial as {
        summary?: { totalTransactions?: number };
        revenue?: { totalBills?: number };
        totalTransactions?: number;
      };

      let totalTransactions = financial?.summary?.totalTransactions ||
                            financial?.revenue?.totalBills ||
                            financial?.totalTransactions || 0;

      if (totalTransactions === 0 && reports.sales) {
        const salesData = reports.sales as {
          totalOrders?: number;
          totalBills?: number;
        };
        totalTransactions = salesData?.totalOrders || salesData?.totalBills || 0;
      }
      return totalTransactions;
    }
    return 0;
  };

  // تنسيق الأرقام
  const formatNumber = (num: number) => formatDecimal(num);
  const formatCurrency = (amount: number) => formatCurrencyUtil(amount);

  // Format percentage helper (removed unused function)

  const basicStats = calculateBasicStats();
  const revenueBreakdown = calculateRevenueBreakdown();
  const totalRevenue = basicStats.revenue;

  // Export functions
  const handleExport = async (
    exportFunc: (reportType: string, filter: Record<string, unknown>) => Promise<void>,
    reportType: string
  ) => {
    try {
      const filter = buildFilter();
      await exportFunc(reportType, filter);
    } catch {
      showNotification('فشل في تصدير التقرير', 'error');
    }
  };

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
    <div className="container mx-auto p-4 space-y-6 rtl">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">التقارير</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {getDateRangeLabel()}
          </p>
        </div>
        <div className="flex items-center space-x-2 space-x-reverse">
          <button
            onClick={() => loadReports()}
            disabled={loading}
            className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full disabled:opacity-50 transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => handleExport(exportReportToExcel, 'all')}
            className="px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>تصدير Excel</span>
          </button>
          <button
            onClick={() => handleExport(exportReportToPDF, 'all')}
            className="px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md flex items-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة PDF</span>
          </button>
        </div>
      </div>

      {/* فلترة البيانات */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5 text-orange-500" />
          <span>تصفية النتائج</span>
        </h2>
        {renderFilterControls()}
      </div>

      {/* Basic Statistics with Comparison */}
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

      {/* Revenue Breakdown */}
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

      {/* Top Products by Section */}
      <ReportSection 
        title="أكثر المنتجات مبيعاً حسب الأقسام" 
        onExportExcel={() => handleExport(exportReportToExcel, 'sales')} 
        onExportPDF={() => handleExport(exportReportToPDF, 'sales')}
      >
        <TopProductsBySection 
          data={reports.sales?.topProductsBySection || []} 
        />
      </ReportSection>

      {/* Gaming Sessions - Separate PlayStation and Computer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportSection 
          title="تحليل جلسات البلايستيشن" 
          onExportExcel={() => handleExport(exportReportToExcel, 'sessions')} 
          onExportPDF={() => handleExport(exportReportToPDF, 'sessions')}
        >
          <PlayStationSessionsReport 
            data={reports.sessions?.playstation || null} 
          />
        </ReportSection>

        <ReportSection 
          title="تحليل جلسات الكمبيوتر" 
          onExportExcel={() => handleExport(exportReportToExcel, 'sessions')} 
          onExportPDF={() => handleExport(exportReportToPDF, 'sessions')}
        >
          <ComputerSessionsReport 
            data={reports.sessions?.computer || null} 
          />
        </ReportSection>
      </div>

      {/* Peak Hours Analysis */}
      <ReportSection 
        title="تحليل ساعات الذروة" 
        onExportExcel={() => handleExport(exportReportToExcel, 'peakHours')} 
        onExportPDF={() => handleExport(exportReportToPDF, 'peakHours')}
      >
        <PeakHoursChart 
          data={reports.sales?.peakHours || null} 
        />
      </ReportSection>

      {/* Staff Performance */}
      <ReportSection 
        title="أداء الموظفين" 
        onExportExcel={() => handleExport(exportReportToExcel, 'staffPerformance')} 
        onExportPDF={() => handleExport(exportReportToPDF, 'staffPerformance')}
      >
        <StaffPerformanceTable 
          data={reports.sales?.staffPerformance || null} 
        />
      </ReportSection>

      {/* Financial Summary */}
      <ReportSection title="الملخص المالي" onExportExcel={() => handleExport(exportReportToExcel, 'financial')} onExportPDF={() => handleExport(exportReportToPDF, 'financial')}>
        {reports.financial && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FinancialStat label="إجمالي الربح" value={formatCurrency(calculateNetProfit())} color="green" />
            <FinancialStat
              label="إجمالي التكاليف"
              value={formatCurrency(
                (reports.financial as { totalCosts?: number; summary?: { totalCosts?: number } })?.totalCosts ||
                (reports.financial as { summary?: { totalCosts?: number } })?.summary?.totalCosts || 0
              )}
              color="red"
            />
            <FinancialStat label="هامش الربح" value={`${formatDecimal(calculateProfitMargin())}%`} color="purple" />
            <FinancialStat label="عدد المعاملات" value={formatNumber(calculateTotalTransactions())} color="orange" />
          </div>
        )}
      </ReportSection>

      {/* Inventory Summary */}
      <ReportSection title="ملخص المخزون" onExportExcel={() => handleExport(exportReportToExcel, 'inventory')} onExportPDF={() => handleExport(exportReportToPDF, 'inventory')}>
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
  );
};

// Helper Components for cleaner structure

const RevenueCard = ({ icon: Icon, title, value, total, color }: RevenueCardProps) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
        <Icon className={`h-5 w-5 text-${color}-500`} />
        {title}
      </h3>
      <span className={`text-xs font-bold px-2 py-1 rounded-full bg-${color}-100 text-${color}-800 dark:bg-[#2d333a] dark:text-${color}-300`}>
        {formatDecimal((value / total) * 100 || 0)}%
      </span>
    </div>
    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 text-center mt-4">{formatCurrencyUtil(value)}</p>
  </div>
);

const ReportSection = ({ title, onExportExcel, onExportPDF, children }: ReportSectionProps) => (
  <div className="bg-white dark:bg-[#24292d] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/50 p-6 hover:shadow-md transition-all duration-200">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <div className="flex space-x-2 space-x-reverse">
        <button onClick={onExportExcel} className="text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 p-1" title="تصدير Excel">
          <Download className="h-5 w-5" />
        </button>
        <button onClick={onExportPDF} className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 p-1" title="تصدير PDF">
          <Printer className="h-5 w-5" />
        </button>
      </div>
    </div>
    {children}
  </div>
);

const FinancialStat = ({ label, value, color }: FinancialStatProps) => (
  <div className={`text-center p-4 bg-${color}-50 dark:bg-[#2d333a] rounded-lg hover:bg-${color}-100 dark:hover:bg-[#374151] transition-colors duration-200`}>
    <div className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>{value}</div>
    <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">{label}</div>
  </div>
);

export default Reports;
