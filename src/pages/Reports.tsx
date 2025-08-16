import { useState, useEffect, useCallback, ReactNode } from 'react';
import { TrendingUp, DollarSign, Users, ShoppingCart, Download, Printer, RefreshCw, Gamepad2, Monitor, Clock, Target, BarChart3, Filter } from 'lucide-react';

// Type definitions
interface ReportData {
  sales: Record<string, unknown> | null;
  sessions: Record<string, unknown> | null;
  inventory: Record<string, unknown> | null;
  financial: Record<string, unknown> | null;
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string | number;
  color: string;
}

interface RevenueCardProps extends Omit<StatCardProps, 'value'> {
  value: number;
  total: number;
}

interface ReportSectionProps {
  title: string;
  onExportExcel: () => void;
  onExportPDF: () => void;
  children: ReactNode;
}

interface InfoRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}

interface FinancialStatProps {
  label: string;
  value: string | number;
  color: string;
}
import { useApp } from '../context/AppContext';
import { formatCurrency as formatCurrencyUtil, formatDecimal } from '../utils/formatters';

interface ReportData {
  sales: Record<string, unknown> | null;
  sessions: Record<string, unknown> | null;
  inventory: Record<string, unknown> | null;
  financial: Record<string, unknown> | null;
}

const Reports = () => {
  const { getSalesReport, getSessionsReport, getInventoryReport, getFinancialReport, exportReportToExcel, exportReportToPDF, showNotification } = useApp();

  const [filterType, setFilterType] = useState('period'); // 'period', 'daily', 'monthly', 'yearly'
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [customDay, setCustomDay] = useState(new Date().toISOString().split('T')[0]);
  const [customMonth, setCustomMonth] = useState(new Date().toISOString().substring(0, 7));
  const [customYear, setCustomYear] = useState(new Date().getFullYear().toString());

  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ReportData>({
    sales: null,
    sessions: null,
    inventory: null,
    financial: null
  });

  const buildFilter = useCallback(() => {
    switch (filterType) {
      case 'daily':
        return { type: 'daily', day: customDay };
      case 'monthly':
        return { type: 'monthly', month: customMonth };
      case 'yearly':
        return { type: 'yearly', year: customYear };
      case 'period':
      default:
        return { period: selectedPeriod };
    }
  }, [filterType, selectedPeriod, customDay, customMonth, customYear]);

  const loadReports = useCallback(async () => {
    const filter = buildFilter();
    try {
      setLoading(true);
      const [salesReport, sessionsReport, inventoryReport, financialReport] = await Promise.all([
        getSalesReport(filter),
        getSessionsReport(filter),
        getInventoryReport(), // Inventory report is not filtered by date
        getFinancialReport(filter)
      ]);

      setReports({
        sales: salesReport,
        sessions: sessionsReport,
        inventory: inventoryReport,
        financial: financialReport
      });
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

    const salesData = reports.sales as { totalRevenue?: number; totalOrders?: number };
    const sessionsData = reports.sessions as { totalSessions?: number } | null;
    
    const revenue = salesData?.totalRevenue || 0;
    const orders = salesData?.totalOrders || 0;
    const avgOrderValue = orders > 0 ? revenue / orders : 0;
    const sessions = sessionsData?.totalSessions || 0;

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

    const salesData = reports.sales as { 
      revenueByType?: {
        playstation?: number;
        computer?: number;
        cafe?: number;
      } 
    };

    return {
      playstation: salesData?.revenueByType?.playstation || 0,
      computer: salesData?.revenueByType?.computer || 0,
      cafe: salesData?.revenueByType?.cafe || 0
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
    const inputClasses = "input-field bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-orange-500 focus:border-orange-500 dark:focus:ring-orange-500 dark:focus:border-orange-500";
    
    if (filterType === 'period') {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          {['today', 'yesterday', 'week', 'month', 'year'].map(p => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                selectedPeriod === p 
                  ? 'bg-orange-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {p === 'today' ? 'اليوم' : p === 'yesterday' ? 'الأمس' : p === 'week' ? 'أسبوع' : p === 'month' ? 'شهر' : 'سنة'}
            </button>
          ))}
        </div>
      );
    }
    if (filterType === 'daily') {
      return (
        <input 
          type="date" 
          value={customDay} 
          onChange={e => setCustomDay(e.target.value)} 
          className={inputClasses} 
        />
      );
    }
    if (filterType === 'monthly') {
      return (
        <input 
          type="month" 
          value={customMonth} 
          onChange={e => setCustomMonth(e.target.value)} 
          className={inputClasses} 
        />
      );
    }
    if (filterType === 'yearly') {
      return (
        <input 
          type="number" 
          placeholder="YYYY" 
          value={customYear} 
          onChange={e => setCustomYear(e.target.value)} 
          className={`${inputClasses} w-24`} 
        />
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 dark:border-orange-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-gray-100 dark:bg-[#1a1d21] min-h-screen transition-colors duration-200">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-orange-600 dark:text-orange-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">التقارير</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">عرض وتحليل التقارير المالية والتشغيلية</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/50 p-6 hover:shadow-md transition-shadow duration-200 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-600 dark:text-gray-300"/>
          <select 
          value={filterType} 
          onChange={e => setFilterType(e.target.value)} 
          className="select-field bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-orange-500 focus:border-orange-500 dark:focus:ring-orange-500 dark:focus:border-orange-500"
        >
            <option value="period">فترة محددة</option>
            <option value="daily">يومي</option>
            <option value="monthly">شهري</option>
            <option value="yearly">سنوي</option>
          </select>
        </div>
        <div className="flex-grow">
          {renderFilterControls()}
        </div>
        <button 
          onClick={loadReports} 
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors duration-200 dark:bg-orange-500 dark:hover:bg-orange-600 dark:text-white"
        >
          <RefreshCw className="h-4 w-4" />
          <span>تحديث</span>
        </button>
      </div>

      {/* Basic Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={DollarSign} 
          title="إجمالي الإيرادات" 
          value={formatCurrency(basicStats.revenue)} 
          color="green" 
        />
        <StatCard 
          icon={ShoppingCart} 
          title="عدد الطلبات" 
          value={formatNumber(basicStats.orders)} 
          color="blue" 
        />
        <StatCard 
          icon={TrendingUp} 
          title="متوسط الطلب" 
          value={formatCurrency(basicStats.avgOrderValue)} 
          color="purple" 
        />
        <StatCard 
          icon={Users} 
          title="عدد الجلسات" 
          value={formatNumber(basicStats.sessions)} 
          color="orange" 
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

      {/* Detailed Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportSection title="أكثر المنتجات مبيعاً" onExportExcel={() => handleExport(exportReportToExcel, 'sales')} onExportPDF={() => handleExport(exportReportToPDF, 'sales')}>
          <div className="space-y-3">
            {reports.sales && (reports.sales as { topProducts?: Array<{ name: string; quantity: number; revenue: number }> })?.topProducts?.length ? (
              ((reports.sales as { topProducts: Array<{ name: string; quantity: number; revenue: number }> }).topProducts || []).slice(0, 5).map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#2d333a] rounded-lg hover:bg-gray-100 dark:hover:bg-[#374151] transition-colors duration-200">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{product.name}</span>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatNumber(product.quantity)} قطعة</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">لا توجد بيانات متاحة</p>
            )}
          </div>
        </ReportSection>

        <ReportSection title="تحليل الجلسات" onExportExcel={() => handleExport(exportReportToExcel, 'sessions')} onExportPDF={() => handleExport(exportReportToPDF, 'sessions')}>
          <div className="space-y-3">
            {reports.sessions ? (
              <>
                <InfoRow 
                  icon={Clock} 
                  label="متوسط مدة الجلسة" 
                  value={`${formatDecimal((reports.sessions as { avgSessionDuration?: number })?.avgSessionDuration || 0)} ساعة`} 
                  color="blue" 
                />
                <InfoRow 
                  icon={Users} 
                  label="أكثر الأجهزة استخداماً" 
                  value={(reports.sessions as { mostUsedDevice?: string })?.mostUsedDevice || 'غير متوفر'} 
                  color="green" 
                />
                <InfoRow 
                  icon={Target} 
                  label="معدل الاستخدام" 
                  value={`${formatDecimal((reports.sessions as { usageRate?: number })?.usageRate || 0)}%`} 
                  color="purple" 
                />
              </>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">لا توجد بيانات متاحة</p>
            )}
          </div>
        </ReportSection>
      </div>

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
const StatCard = ({ icon: Icon, title, value, color }: StatCardProps) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
    <div className="flex items-center gap-4">
      <div className={`rounded-full p-3 bg-${color}-100 dark:bg-[#2d333a]`}>
        <Icon className={`h-6 w-6 text-${color}-600 dark:text-${color}-400`} />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      </div>
    </div>
  </div>
);

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

const InfoRow = ({ icon: Icon, label, value, color }: InfoRowProps) => (
  <div className={`flex items-center justify-between p-3 bg-${color}-50 dark:bg-[#2d333a] rounded-lg hover:bg-${color}-100 dark:hover:bg-[#374151] transition-colors duration-200`}>
    <div className="flex items-center gap-3">
      <Icon className={`h-5 w-5 text-${color}-600 dark:text-${color}-400`} />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
    </div>
    <span className={`font-bold text-sm text-${color}-800 dark:text-${color}-200`}>{value}</span>
  </div>
);

const FinancialStat = ({ label, value, color }: FinancialStatProps) => (
  <div className={`text-center p-4 bg-${color}-50 dark:bg-[#2d333a] rounded-lg hover:bg-${color}-100 dark:hover:bg-[#374151] transition-colors duration-200`}>
    <div className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>{value}</div>
    <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">{label}</div>
  </div>
);

export default Reports;
