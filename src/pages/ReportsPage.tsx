import { useState, useRef, useEffect, useCallback } from 'react';
import {
  format,
  addDays,
  addMonths,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfWeek,
  endOfWeek,
  subDays,
  subWeeks,
  subMonths,
  parseISO
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Download, DollarSign, RefreshCw, TrendingUp, Users, Clock, ShoppingCart, Target, Printer } from 'lucide-react';

// TODO: Uncomment these imports once the UI components are available
// import { Button } from '@/components/ui/button';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ==============================================
// Type Definitions
// ==============================================

type PeriodType = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';
type FilterType = 'period' | 'daily' | 'monthly' | 'yearly';

interface BaseReportData {
  startDate: string;
  endDate: string;
  timestamp: string;
}

interface SalesData extends BaseReportData {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  revenueByCategory: Array<{ category: string; revenue: number }>;
  revenueByDay: Array<{ date: string; revenue: number }>;
}

interface SessionsData extends BaseReportData {
  totalSessions: number;
  averageSessionDuration: number;
  sessionsByDevice: Array<{ device: string; count: number }>;
  sessionsByHour?: Array<{ hour: number; count: number }>;
}

interface InventoryData extends BaseReportData {
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  topSellingItems?: Array<{ name: string; quantity: number; revenue: number }>;
}

interface FinancialData extends BaseReportData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  revenueByCategory?: Array<{ category: string; amount: number }>;
}

interface ReportType {
  sales: SalesData | null;
  sessions: SessionsData | null;
  inventory: InventoryData | null;
  financial: FinancialData | null;
}

interface LoadingStates {
  sales: boolean;
  sessions: boolean;
  inventory: boolean;
  financial: boolean;
}

interface ErrorStates {
  sales: string | null;
  sessions: string | null;
  inventory: string | null;
  financial: string | null;
}

interface ReportFilter {
  startDate: string | Date;
  endDate: string | Date;
  type: FilterType;
  period?: PeriodType;
  category?: string;
  establishmentId?: string;
}

interface FilterControlsProps {
  filterType: 'period' | 'daily' | 'monthly' | 'yearly';
  selectedPeriod: string;
  customDay: Date;
  customMonth: string;
  customYear: string;
  dateRangeLabel: string;
  isLoading?: boolean;
  onFilterTypeChange: (type: 'period' | 'daily' | 'monthly' | 'yearly') => void;
  onPeriodChange: (period: string) => void;
  onCustomDayChange: (day: Date) => void;
  onCustomMonthChange: (month: string) => void;
  onCustomYearChange: (year: string) => void;
  onApplyFilter: () => void;
  onResetFilter: () => void;
}

interface StatCardProps {
  title: string;
  value: number | string;
  change?: number;
  icon: React.ElementType;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  isCurrency?: boolean;
  color?: string;
  className?: string;
  suffix?: string;
}

// ==============================================
// Utility Functions
// ==============================================

const formatDate = (date: Date): string => format(date, 'yyyy-MM-dd');

const formatArabicDate = (date: Date): string =>
  format(date, 'dd MMMM yyyy', { locale: ar });

const calculateNetProfit = (financialData: FinancialData): number =>
  financialData.totalRevenue - financialData.totalExpenses;

const calculateProfitMargin = (financialData: FinancialData): number =>
  financialData.totalRevenue === 0 ? 0 :
  ((financialData.totalRevenue - financialData.totalExpenses) / financialData.totalRevenue) * 100;

// ==============================================
// API Types & Functions
// ==============================================

type ApiResponse<T> = Promise<T>;

async function getSalesReport(filter: ReportFilter): ApiResponse<SalesData> {
  // Simulate API call
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        timestamp: new Date().toISOString(),
        totalRevenue: 12500.75,
        totalOrders: 342,
        averageOrderValue: 36.55,
        revenueByCategory: [
          { category: 'Food', revenue: 8500.50 },
          { category: 'Beverages', revenue: 3200.25 },
          { category: 'Desserts', revenue: 800.00 }
        ],
        revenueByDay: Array.from({ length: 7 }, (_, i) => ({
          date: format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'),
          revenue: Math.floor(Math.random() * 2000) + 500
        }))
      });
    }, 500);
  });
}

async function getSessionsReport(filter: ReportFilter): ApiResponse<SessionsData> {
  // Simulate API call
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        totalSessions: 1289,
        averageSessionDuration: 12.5,
        sessionsByDevice: [
          { device: 'Mobile', count: 845 },
          { device: 'Desktop', count: 312 },
          { device: 'Tablet', count: 132 }
        ],
        sessionsByHour: Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          count: Math.floor(Math.random() * 100) + 20
        }))
      });
    }, 600);
  });
}

async function getInventoryReport(filter: ReportFilter): ApiResponse<InventoryData> {
  // Simulate API call
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        totalItems: 245,
        lowStockItems: 18,
        outOfStockItems: 5,
        topSellingItems: [
          { name: 'Chicken Burger', quantity: 342, revenue: 2736.00 },
          { name: 'Caesar Salad', quantity: 289, revenue: 2023.00 },
          { name: 'Iced Coffee', quantity: 412, revenue: 1648.00 }
        ]
      });
    }, 700);
  });
}

async function getFinancialReport(filter: ReportFilter): ApiResponse<FinancialData> {
  // Simulate API call
  return new Promise(resolve => {
    setTimeout(() => {
      const revenue = 18500.75;
      const expenses = 12500.50;
      resolve({
        totalRevenue: revenue,
        totalExpenses: expenses,
        netProfit: revenue - expenses,
        revenueByCategory: [
          { category: 'Dine-in', amount: 12500.25 },
          { category: 'Delivery', amount: 4500.50 },
          { category: 'Takeout', amount: 1500.00 }
        ]
      });
    }, 800);
  });
}

// ==============================================
// Component: StatCard
// ==============================================

const StatCard = ({
  title,
  value,
  change,
  icon: Icon,
  loading = false,
  error = null,
  onRetry,
  isCurrency = false,
  color = 'text-blue-500',
  className = '',
  suffix = '',
}: StatCardProps) => (
  <div className={`p-4 bg-white rounded-lg shadow ${className}`}>
    <div className="flex items-center">
      {Icon && <Icon className="w-6 h-6 mr-2 text-gray-500" />}
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
    </div>
    <p className={`mt-2 text-2xl font-semibold ${color} ${loading ? 'animate-pulse bg-gray-200 h-8 w-24 rounded' : ''}`}>
      {loading ? '' : (
        <>
          {isCurrency ? `${value} ر.س` : value}
          {suffix && <span className="ml-1 text-sm font-normal text-gray-500">{suffix}</span>}
        </>
      )}
    </p>
    {error && (
      <div className="mt-1 text-sm text-red-600">
        {error}
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-2 text-blue-600 hover:underline"
          >
            إعادة المحاولة
          </button>
        )}
      </div>
    )}
  </div>
);

const FilterControls = ({
  filterType,
  selectedPeriod,
  customDay,
  customMonth,
  customYear,
  onFilterTypeChange,
  onPeriodChange,
  onCustomDayChange,
  onCustomMonthChange,
  onCustomYearChange,
  onApplyFilter,
  onResetFilter,
  dateRangeLabel,
  isLoading = false,
}: FilterControlsProps) => {
  return (
    <div className="p-4 mb-6 bg-white rounded-lg shadow">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => onFilterTypeChange(e.target.value as 'period' | 'daily' | 'monthly' | 'yearly')}
            className="px-3 py-1 text-sm border rounded"
            disabled={isLoading}
          >
            <option value="period">فترة محددة</option>
            <option value="daily">يومي</option>
            <option value="monthly">شهري</option>
            <option value="yearly">سنوي</option>
          </select>

        {filterType === 'period' && (
          <select
            value={selectedPeriod}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="px-3 py-1 text-sm border rounded"
          >
            <option value="today">اليوم</option>
            <option value="yesterday">أمس</option>
            <option value="thisWeek">هذا الأسبوع</option>
            <option value="lastWeek">الأسبوع الماضي</option>
            <option value="thisMonth">هذا الشهر</option>
            <option value="lastMonth">الشهر الماضي</option>
            <option value="thisYear">هذه السنة</option>
            <option value="lastYear">السنة الماضية</option>
          </select>
        )}

        {filterType === 'daily' && (
          <input
            type="date"
            value={format(customDay, 'yyyy-MM-dd')}
            onChange={(e) => onCustomDayChange(parseISO(e.target.value))}
            className="px-3 py-1 text-sm border rounded"
          />
        )}

        {filterType === 'monthly' && (
          <input
            type="month"
            value={customMonth}
            onChange={(e) => onCustomMonthChange(e.target.value)}
            className="px-3 py-1 text-sm border rounded"
          />
        )}

        {filterType === 'yearly' && (
          <select
            value={customYear}
            onChange={(e) => onCustomYearChange(e.target.value)}
            className="px-3 py-1 text-sm border rounded"
          >
            {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex-1 flex justify-end gap-2">
        <button
          onClick={onResetFilter}
          className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
        >
          إعادة تعيين
        </button>
        <button
          onClick={onApplyFilter}
          className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          تطبيق
        </button>
      </div>
    </div>
  </div>
);

const RevenueBreakdown: React.FC<{ data: any }> = ({ data }) => (
  <div className="p-4 bg-white rounded-lg shadow">
    <h3 className="text-lg font-medium">Revenue Breakdown</h3>
    <div className="mt-4 space-y-2">
      {Object.entries(data || {}).map(([key, value]) => (
        <div key={key} className="flex items-center justify-between">
          <span className="capitalize">{key}</span>
          <span>{value as any} ر.س</span>
        </div>
      ))}
    </div>
  </div>
);

const ReportsPage: React.FC = () => {
  const [dateRangeLabel, setDateRangeLabel] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const currentFilter = useRef<ReportFilter | null>(null);

  // Reports data state
  const [reports, setReports] = useState<ReportType>({
    sales: null,
    sessions: null,
    inventory: null,
    financial: null
  });

  // Loading and error states
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    sales: false,
    sessions: false,
    inventory: false,
    financial: false
  });

  const [errors, setErrors] = useState<ErrorStates>({
    sales: null,
    sessions: null,
    inventory: null,
    financial: null
  });

  // Initialize with default filter
  useEffect(() => {
    const initialFilter = buildFilter('period', 'today');
    currentFilter.current = initialFilter;
    loadReports();
  }, []);
  // State for filter and date selection
  const [filterType, setFilterType] = useState<'period' | 'daily' | 'monthly' | 'yearly'>('period');
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [customDay, setCustomDay] = useState<Date>(new Date());
  const [customMonth, setCustomMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [customYear, setCustomYear] = useState<string>(new Date().getFullYear().toString());
  const [dateRangeLabel, setDateRangeLabel] = useState<string>('');

  // Reports data state
  const [reports, setReports] = useState<ReportType>({
    sales: null,
    sessions: null,
    inventory: null,
    financial: null
  });

  // Loading and error states
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    sales: false,
    sessions: false,
    inventory: false,
    financial: false
  });

  const [errors, setErrors] = useState<ErrorStates>({
    sales: null,
    sessions: null,
    inventory: null,
    financial: null
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const currentFilter = useRef<ReportFilter | null>(null);

  // Format date with Arabic locale
  const formatDate = (date: Date | string): string => {
    return format(new Date(date), 'yyyy-MM-dd');
  };

  const formatArabicDate = (date: Date | string): string => {
    return format(new Date(date), 'PPPP', { locale: ar });
  };

  // Load reports based on current filter
  const loadReports = useCallback(async () => {
    if (!currentFilter.current) return;

    try {
      setIsLoading(true);

      // Fetch all reports in parallel
      const [salesData, sessionsData, inventoryData, financialData] = await Promise.all([
        getSalesReport(currentFilter.current),
        getSessionsReport(currentFilter.current),
        getInventoryReport(currentFilter.current),
        getFinancialReport(currentFilter.current)
      ]);

      setReports({
        sales: salesData,
        sessions: sessionsData,
        inventory: inventoryData,
        financial: financialData
      });

      // Clear any previous errors
      setErrors({
        sales: null,
        sessions: null,
        inventory: null,
        financial: null
      });
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        sales: error instanceof Error ? error.message : 'Failed to load sales data',
        sessions: error instanceof Error ? error.message : 'Failed to load sessions data',
        inventory: error instanceof Error ? error.message : 'Failed to load inventory data',
        financial: error instanceof Error ? error.message : 'Failed to load financial data'
      }));
    } finally {
      setIsLoading(false);
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    }
  }, [isInitialLoad]);

  // Build filter based on selected type and period
  const buildFilter = (type: 'period' | 'daily' | 'monthly' | 'yearly', period: string): ReportFilter => {
    const now = new Date();
    let startDate: Date = now;
    let endDate: Date = now;

    switch (type) {
      case 'period':
        switch (period) {
          case 'today':
            startDate = startOfDay(now);
            endDate = endOfDay(now);
            setDateRangeLabel('اليوم');
            break;
          case 'yesterday':
            const yesterday = addDays(now, -1);
            startDate = startOfDay(yesterday);
            endDate = endOfDay(yesterday);
            setDateRangeLabel('أمس');
            break;
          case 'thisWeek':
            startDate = startOfWeek(now, { weekStartsOn: 0 });
            endDate = endOfWeek(now, { weekStartsOn: 0 });
            setDateRangeLabel('هذا الأسبوع');
            break;
          case 'lastWeek':
            const lastWeek = addDays(now, -7);
            startDate = startOfWeek(lastWeek, { weekStartsOn: 0 });
            endDate = endOfWeek(lastWeek, { weekStartsOn: 0 });
            setDateRangeLabel('الأسبوع الماضي');
            break;
          case 'thisMonth':
            startDate = startOfMonth(now);
            endDate = endOfMonth(now);
            setDateRangeLabel('هذا الشهر');
            break;
          case 'lastMonth':
            const lastMonth = addMonths(now, -1);
            startDate = startOfMonth(lastMonth);
            endDate = endOfMonth(lastMonth);
            setDateRangeLabel('الشهر الماضي');
            break;
          case 'thisYear':
            startDate = startOfYear(now);
            endDate = endOfYear(now);
            setDateRangeLabel('هذه السنة');
            break;
          default:
            startDate = startOfDay(now);
            endDate = endOfDay(now);
            setDateRangeLabel('اليوم');
        }
        break;
      case 'daily':
        startDate = startOfDay(customDay);
        endDate = endOfDay(customDay);
        setDateRangeLabel(`يوم ${format(customDay, 'dd/MM/yyyy')}`);
        break;
      case 'monthly':
        const [year, month] = customMonth.split('-').map(Number);
        startDate = startOfMonth(new Date(year, month - 1));
        endDate = endOfMonth(new Date(year, month - 1));
        setDateRangeLabel(`شهر ${format(startDate, 'MMMM yyyy', { locale: ar })}`);
        break;
      case 'yearly':
        const yearNum = parseInt(customYear, 10);
        startDate = startOfYear(new Date(yearNum, 0));
        endDate = endOfYear(new Date(yearNum, 11));
        setDateRangeLabel(`سنة ${yearNum}`);
        break;
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      period: type === 'period' ? period : undefined,
      type
    };
  };

  // Basic stats calculations
  const basicStats = {
    totalRevenue: reports.sales?.totalRevenue || 0,
    totalSessions: reports.sessions?.totalSessions || 0,
    averageOrderValue: reports.sales?.averageOrderValue || 0,
    averageSessionDuration: reports.sessions?.averageSessionDuration || 0
  };

  // Calculate financial metrics
  const calculateNetProfit = (): number => {
    if (!reports.financial) return 0;
    return (reports.financial.revenue || 0) - (reports.financial.expenses || 0);
  };

  const calculateProfitMargin = (): number => {
    if (!reports.financial || !reports.financial.revenue) return 0;
    const netProfit = calculateNetProfit();
    return (netProfit / reports.financial.revenue) * 100;
  };

  // Calculate revenue breakdown
  const revenueBreakdown = {
    playstation: reports.sales?.revenueByType?.playstation || 0,
    computer: reports.sales?.revenueByType?.computer || 0,
    cafe: reports.sales?.revenueByType?.cafe || 0,
    totalRevenue: basicStats.totalRevenue
  };

  // Calculate financial metrics
  const calculateNetProfit = (): number => {
    if (!reports.financial) return 0;
    return reports.financial.totalRevenue - reports.financial.totalExpenses;
  };

  const calculateProfitMargin = (): number => {
    if (!reports.financial || reports.financial.totalRevenue === 0) return 0;
    return (calculateNetProfit() / reports.financial.totalRevenue) * 100;
  };

  // Format date functions
  const formatDate = (date: Date | string): string => {
    return format(new Date(date), 'yyyy-MM-dd');
  };

  const formatArabicDate = (date: Date | string): string => {
    return format(new Date(date), 'PPPP', { locale: ar });
  };

  // Build filter object
  const buildFilter = (type: 'period' | 'daily' | 'monthly' | 'yearly', period: string): ReportFilter => {
    const now = new Date();
    let startDate: Date = now;
    let endDate: Date = now;

    switch (type) {
      case 'period':
        switch (period) {
          case 'today':
            startDate = startOfDay(now);
            endDate = endOfDay(now);
            setDateRangeLabel('اليوم');
            break;
          case 'yesterday':
            startDate = startOfDay(subDays(now, 1));
            endDate = endOfDay(subDays(now, 1));
            setDateRangeLabel('أمس');
            break;
          case 'thisWeek':
            startDate = startOfWeek(now, { weekStartsOn: 0 });
            endDate = endOfWeek(now, { weekStartsOn: 0 });
            setDateRangeLabel('هذا الأسبوع');
            break;
          case 'lastWeek':
            startDate = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
            endDate = endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
            setDateRangeLabel('الأسبوع الماضي');
            break;
          case 'thisMonth':
            startDate = startOfMonth(now);
            endDate = endOfMonth(now);
            setDateRangeLabel('هذا الشهر');
            break;
          case 'lastMonth':
            startDate = startOfMonth(subMonths(now, 1));
            endDate = endOfMonth(subMonths(now, 1));
            setDateRangeLabel('الشهر الماضي');
            break;
          default:
            startDate = startOfDay(now);
            endDate = endOfDay(now);
            setDateRangeLabel('اليوم');
        }
        break;
      case 'daily':
        startDate = startOfDay(customDay);
        endDate = endOfDay(customDay);
        setDateRangeLabel(`يوم ${format(customDay, 'dd/MM/yyyy')}`);
        break;
      case 'monthly':
        const [year, month] = customMonth.split('-').map(Number);
        startDate = startOfMonth(new Date(year, month - 1, 1));
        endDate = endOfMonth(new Date(year, month - 1, 1));
        setDateRangeLabel(`شهر ${format(startDate, 'MMMM yyyy', { locale: ar })}`);
        break;
      case 'yearly':
        const selectedYear = parseInt(customYear);
        startDate = startOfYear(new Date(selectedYear, 0, 1));
        endDate = endOfYear(new Date(selectedYear, 11, 31));
        setDateRangeLabel(`سنة ${selectedYear}`);
        break;
      default:
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        setDateRangeLabel('اليوم');
    }

    return {
      startDate,
      endDate,
      period: type === 'period' ? period : undefined,
      category: type === 'daily' ? 'daily' : type === 'monthly' ? 'monthly' : 'yearly'
    };
  };

  // Load reports function
  const loadReports = useCallback(async () => {
    try {
      setIsLoading(true);
      const filter = buildFilter(filterType, selectedPeriod);
      currentFilter.current = filter;

      // Update date range label
      if (filterType === 'period') {
        setDateRangeLabel(`${formatArabicDate(filter.startDate)} - ${formatArabicDate(filter.endDate)}`);
      } else if (filterType === 'daily') {
        setDateRangeLabel(formatArabicDate(customDay));
      } else if (filterType === 'monthly') {
        setDateRangeLabel(format(new Date(customMonth + '-01'), 'MMMM yyyy', { locale: ar }));
      } else {
        setDateRangeLabel(customYear);
      }

      // TODO: Implement actual API calls here
      // For now, just set loading to false
      setIsLoading(false);
      setIsInitialLoad(false);
    } catch (error) {
      setIsLoading(false);
    }
  }, [filterType, selectedPeriod, customDay, customMonth, customYear]);

  // Handle export
  const handleExport = (format: 'pdf' | 'excel') => {
    // TODO: Implement export functionality
  };

  // Initial load
  useEffect(() => {
    if (isInitialLoad) {
      loadReports();
    }
  }, [isInitialLoad, loadReports]);

  // ... (rest of the code remains the same)
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

// ... (rest of the code remains the same)

const fetchReport = async (type: string, filter: ReportFilter): Promise<any> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
};

// Build filter object based on current filter type and values
const buildFilter = useCallback((): ReportFilter => {
  let startDate: Date;
  let endDate: Date = new Date();

  switch (filterType) {
    case 'period':
      switch (selectedPeriod) {
        case 'today':
          startDate = startOfDay(new Date());
          endDate = endOfDay(new Date());
          break;
        case 'yesterday':
          startDate = startOfDay(subDays(new Date(), 1));
          endDate = endOfDay(subDays(new Date(), 1));
          break;
        case 'thisWeek':
          startDate = startOfWeek(new Date(), { weekStartsOn: 0 });
          endDate = endOfWeek(new Date(), { weekStartsOn: 0 });
          break;
        case 'lastWeek':
          startDate = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 0 });
          endDate = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 0 });
          break;
        case 'thisMonth':
          startDate = startOfMonth(new Date());
          endDate = endOfMonth(new Date());
          break;
        case 'lastMonth':
          startDate = startOfMonth(subMonths(new Date(), 1));
          endDate = endOfMonth(subMonths(new Date(), 1));
          break;
        case 'thisYear':
          startDate = startOfYear(new Date());
          endDate = endOfYear(new Date());
          break;
        default:
          startDate = new Date();
      }
      break;
    case 'daily':
      startDate = startOfDay(customDay);
      endDate = endOfDay(customDay);
      break;
    case 'monthly':
      const [year, month] = customMonth.split('-').map(Number);
      startDate = new Date(year, month - 1, 1);
      endDate = endOfMonth(startDate);
      break;
    case 'yearly':
      startDate = new Date(Number(customYear), 0, 1);
      endDate = new Date(Number(customYear), 11, 31, 23, 59, 59);
      break;
    default:
      startDate = new Date();
  }

  const filter: ReportFilter = {
    startDate,
    endDate,
    type: filterType,
    ...(filterType === 'period' && { period: selectedPeriod }),
    ...(customMonth && { month: customMonth }),
    ...(customYear && { year: customYear })
  };

  // Update the current filter ref
  currentFilter.current = filter;
  return filter;
}, [filterType, selectedPeriod, customDay, customMonth, customYear]);

// Load reports data
const loadReports = useCallback(async () => {
  if (!currentFilter.current) return;

  setIsLoading(true);

  try {
    const filter = currentFilter.current;

    // Load all reports in parallel
    const [sales, sessions, inventory, financial] = await Promise.all([
      getSalesReport(filter),
      getSessionsReport(filter),
      getInventoryReport(filter),
      getFinancialReport(filter)
    ]);

    setReports({
      sales,
      sessions,
      inventory,
      financial
    });

    // Clear any previous errors
    setErrors({
      sales: null,
      sessions: null,
      inventory: null,
      financial: null
    });
  } catch (error) {
    setError('sales', 'Failed to load sales data');
    setError('sessions', 'Failed to load sessions data');
    setError('inventory', 'Failed to load inventory data');
    setError('financial', 'Failed to load financial data');
  } finally {
    setIsLoading(false);
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }
  }
}, [isInitialLoad]);

// Render the main report content
const renderReportContent = useCallback(() => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sales Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={reports.sales?.totalRevenue || 0}
          icon={DollarSign}
          isCurrency
          loading={loadingStates.sales}
          error={errors.sales}
          onRetry={handleApplyFilter}
        />
        <StatCard
          title="Total Orders"
          value={reports.sales?.totalOrders || 0}
          icon={ShoppingCart}
          loading={loadingStates.sales}
          error={errors.sales}
          onRetry={handleApplyFilter}
        />
        <StatCard
          title="Avg. Order Value"
          value={reports.sales?.averageOrderValue || 0}
          icon={TrendingUp}
          isCurrency
          loading={loadingStates.sales}
          error={errors.sales}
          onRetry={handleApplyFilter}
        />
        <StatCard
          title="Total Sessions"
          value={reports.sessions?.totalSessions || 0}
          icon={Users}
          loading={loadingStates.sessions}
          error={errors.sessions}
          onRetry={handleApplyFilter}
        />
      </div>

      {/* Charts and additional data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue by Category</h3>
          {reports.sales?.revenueByCategory && reports.sales.revenueByCategory.length > 0 ? (
            <BarChart
              width={500}
              height={300}
              data={reports.sales.revenueByCategory}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#3b82f6" />
            </BarChart>
          ) : (
            <p className="text-gray-500">No data available</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Sessions by Device</h3>
          {reports.sessions?.sessionsByDevice && reports.sessions.sessionsByDevice.length > 0 ? (
            <BarChart
              width={500}
              height={300}
              data={reports.sessions.sessionsByDevice}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="device" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" />
            </BarChart>
          ) : (
            <p className="text-gray-500">No data available</p>
          )}
        </div>
      </div>
    </div>
  );
}, [isLoading, reports, loadingStates, errors, handleApplyFilter]);

// Handle export
const handleExport = useCallback((type: 'pdf' | 'excel') => {
  // TODO: Implement export functionality
}, []);

const ReportsPage: React.FC = () => {
  // Filter state
  const [filterType, setFilterType] = useState<FilterType>('period');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('thisWeek');
  const [customDay, setCustomDay] = useState<Date>(new Date());
  const [customMonth, setCustomMonth] = useState<string>('');
  const [customYear, setCustomYear] = useState<string>(new Date().getFullYear().toString());
  const [dateRangeLabel, setDateRangeLabel] = useState<string>('This Week');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);

  // Report data state
  const [reports, setReports] = useState<ReportType>({
    sales: null,
    sessions: null,
    inventory: null,
    financial: null,
  });

  // Loading states for each report type
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    sales: false,
    sessions: false,
    inventory: false,
    financial: false,
  });

  // Error states for each report type
  const [errors, setErrors] = useState<ErrorStates>({
    sales: null,
    sessions: null,
    inventory: null,
    financial: null,
  });

  // Current filter ref to avoid dependency issues in useCallback
  const currentFilter = useRef<ReportFilter>({
    startDate: new Date(),
    endDate: new Date(),
    type: 'period',
    period: 'thisWeek'
  } as const);

  // Helper function to set loading state for a specific report type
  const setLoading = (type: keyof LoadingStates, isLoading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [type]: isLoading
    }));
  };

  // Helper function to set error state for a specific report type
  const setError = (type: keyof ErrorStates, error: string | null) => {
    setErrors(prev => ({
      ...prev,
      [type]: error
    }));
  };

  // Load reports when component mounts or filter changes
  useEffect(() => {
    const loadReports = async () => {
      if (isInitialLoad) {
        setIsInitialLoad(false);
        return;
      }

      setIsLoading(true);
      setLoadingStates(prev => ({
        ...prev,
        sales: true,
        sessions: true,
        inventory: true,
        financial: true
      }));

      try {
        // Load all reports in parallel
        const [sales, sessions, inventory, financial] = await Promise.all([
          getSalesReport(currentFilter.current),
          getSessionsReport(currentFilter.current),
          getInventoryReport(currentFilter.current),
          getFinancialReport(currentFilter.current)
        ]);

        setReports({
          sales: {
            ...sales,
            startDate: formatDate(new Date()),
            endDate: formatDate(new Date()),
            timestamp: new Date().toISOString()
          },
          sessions: {
            ...sessions,
            startDate: formatDate(new Date()),
            endDate: formatDate(new Date()),
            timestamp: new Date().toISOString()
          },
          inventory: {
            ...inventory,
            startDate: formatDate(new Date()),
            endDate: formatDate(new Date()),
            timestamp: new Date().toISOString()
          },
          financial: {
            ...financial,
            startDate: formatDate(new Date()),
            endDate: formatDate(new Date()),
            timestamp: new Date().toISOString()
          }
        });

        // Clear any previous errors
        setErrors({
          sales: null,
          sessions: null,
          inventory: null,
          financial: null
        });
      } catch (error) {
        setErrors(prev => ({
          ...prev,
          sales: 'Failed to load sales data',
          sessions: 'Failed to load sessions data',
          inventory: 'Failed to load inventory data',
          financial: 'Failed to load financial data'
        }));
      } finally {
        setIsLoading(false);
        setLoadingStates({
          sales: false,
          sessions: false,
          inventory: false,
          financial: false
        });
      }
    };

    loadReports();
  }, [isInitialLoad]);

  // Build filter object based on current filter type and values
  const buildFilter = (type: FilterType, period: PeriodType): ReportFilter => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (type) {
      case 'period':
        switch (period) {
          case 'today':
            startDate = startOfDay(now);
            endDate = endOfDay(now);
            break;
          case 'yesterday':
            startDate = startOfDay(subDays(now, 1));
            endDate = endOfDay(subDays(now, 1));
            break;
          case 'thisWeek':
            startDate = startOfWeek(now, { weekStartsOn: 0 });
            endDate = endOfWeek(now, { weekStartsOn: 0 });
            break;
          case 'lastWeek':
            startDate = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
            endDate = endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
            break;
          case 'thisMonth':
            startDate = startOfMonth(now);
            endDate = endOfMonth(now);
            break;
          case 'lastMonth':
            startDate = startOfMonth(subMonths(now, 1));
            endDate = endOfMonth(subMonths(now, 1));
            break;
          case 'thisYear':
            startDate = startOfYear(now);
            endDate = endOfYear(now);
            break;
          default:
            startDate = now;
        }
        break;
      case 'daily':
        startDate = startOfDay(customDay);
        endDate = endOfDay(customDay);
        break;
      case 'monthly':
        const [year, month] = customMonth.split('-').map(Number);
        startDate = new Date(year, month - 1, 1);
        endDate = endOfMonth(startDate);
        break;
      case 'yearly':
        startDate = new Date(Number(customYear), 0, 1);
        endDate = new Date(Number(customYear), 11, 31, 23, 59, 59);
        break;
      default:
        startDate = now;
    }

    const filter: ReportFilter = {
      startDate,
      endDate,
      type,
      ...(type === 'period' && { period }),
      ...(customMonth && { month: customMonth }),
      ...(customYear && { year: customYear })
    };

    return filter;
  };

  // Handle filter changes
  const handleFilterTypeChange = useCallback((type: FilterType) => {
    setFilterType(type);
  }, []);

  const handlePeriodChange = useCallback((period: string) => {
    if (isPeriodType(period)) {
      setSelectedPeriod(period);
    }
  }, []);

  const handleCustomDayChange = useCallback((day: Date) => {
    setCustomDay(day);
  }, []);

  const handleCustomMonthChange = useCallback((month: string) => {
    setCustomMonth(month);
  }, []);

  const handleCustomYearChange = useCallback((year: string) => {
    setCustomYear(year);
  }, []);

  const handleApplyFilter = useCallback(() => {
    buildFilter(filterType, selectedPeriod);
    setIsInitialLoad(false);
  }, [buildFilter, filterType, selectedPeriod]);

  const handleResetFilter = useCallback(() => {
    setFilterType('period');
    setSelectedPeriod('thisWeek');
    setCustomDay(new Date());
    setCustomMonth('');
    setCustomYear(new Date().getFullYear().toString());
    setDateRangeLabel('This Week');
    setIsInitialLoad(false);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">View and analyze your business performance</p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <button
            onClick={() => handleExport('pdf')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Printer className="h-4 w-4 mr-2" />
            Export PDF
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </button>
        </div>
      </div>

      <FilterControls
        filterType={filterType}
        selectedPeriod={selectedPeriod}
        customDay={customDay}
        customMonth={customMonth}
        customYear={customYear}
        dateRangeLabel={dateRangeLabel}
        isLoading={isLoading}
        onFilterTypeChange={handleFilterTypeChange}
        onPeriodChange={handlePeriodChange}
        onCustomDayChange={handleCustomDayChange}
        onCustomMonthChange={handleCustomMonthChange}
        onCustomYearChange={handleCustomYearChange}
        onApplyFilter={handleApplyFilter}
        onResetFilter={handleResetFilter}
      />

      <div className="mt-8">
        {renderReportContent()}
      </div>
    </div>
  );
};

export default ReportsPage;
