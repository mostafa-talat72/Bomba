import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Users, ShoppingCart, Download, Printer, RefreshCw, Gamepad2, Monitor, Clock, Target } from 'lucide-react';
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
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ReportData>({
    sales: null,
    sessions: null,
    inventory: null,
    financial: null
  });

  // تحميل التقارير عند تغيير الفترة
  useEffect(() => {
    loadReports();
  }, [selectedPeriod]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const [salesReport, sessionsReport, inventoryReport, financialReport] = await Promise.all([
        getSalesReport(selectedPeriod),
        getSessionsReport(selectedPeriod),
        getInventoryReport(),
        getFinancialReport(selectedPeriod)
      ]);

      setReports({
        sales: salesReport,
        sessions: sessionsReport,
        inventory: inventoryReport,
        financial: financialReport
      });
    } catch {
      showNotification('خطأ في تحميل التقارير', 'error');
    } finally {
      setLoading(false);
    }
  };

  // حساب الإحصائيات الأساسية
  const calculateBasicStats = () => {
    if (!reports.sales) return { revenue: 0, orders: 0, avgOrderValue: 0, sessions: 0 };

    const revenue = (reports.sales as any)?.totalRevenue || 0;
    const orders = (reports.sales as any)?.totalOrders || 0;
    const avgOrderValue = orders > 0 ? revenue / orders : 0;
    const sessions = (reports.sessions as any)?.totalSessions || 0;

    return { revenue, orders, avgOrderValue, sessions };
  };

  // حساب توزيع الإيرادات
  const calculateRevenueBreakdown = () => {
    if (!reports.sales) return { playstation: 0, computer: 0, cafe: 0 };

    return {
      playstation: (reports.sales as any)?.revenueByType?.playstation || 0,
      computer: (reports.sales as any)?.revenueByType?.computer || 0,
      cafe: (reports.sales as any)?.revenueByType?.cafe || 0
    };
  };

  // حساب الأرباح الإجمالية
  const calculateNetProfit = () => {
    if (!reports.financial) return 0;

    const financial = reports.financial as any;
    // التعامل مع الهيكل الحالي للبيانات
    return financial?.profit || financial?.summary?.netProfit || 0;
  };

  // حساب هامش الربح
  const calculateProfitMargin = () => {
    if (!reports.financial) return 0;

    const financial = reports.financial as any;

    // الحصول على البيانات
    const revenue = financial?.totalRevenue || financial?.summary?.totalRevenue || 0;
    const paid = financial?.totalPaid || financial?.summary?.totalPaid || 0;
    const profit = financial?.profit || financial?.summary?.netProfit || 0;

    // حساب هامش الربح بناءً على الإيرادات الفعلية
    const actualRevenue = paid > 0 ? paid : revenue;

    if (actualRevenue === 0) return 0;

    // هامش الربح = (صافي الربح / الإيرادات) × 100
    return (profit / actualRevenue) * 100;
  };

  // حساب إجمالي المعاملات
  const calculateTotalTransactions = () => {
    if (!reports.sales) return 0;

      const salesData = reports.sales as any;
    // حساب إجمالي المعاملات من البيانات المتاحة
    let totalTransactions = 0;

      if (salesData?.totalOrders) {
        totalTransactions = salesData.totalOrders;
    } else if (salesData?.orders && Array.isArray(salesData.orders)) {
      totalTransactions = salesData.orders.length;
    } else if (salesData?.bills && Array.isArray(salesData.bills)) {
      totalTransactions = salesData.bills.length;
    }

    return totalTransactions;
  };

  // حساب إجمالي الفواتير
  const calculateTotalBills = () => {
    if (!reports.sales) return 0;

    const salesData = reports.sales as any;
    return salesData?.totalBills || salesData?.bills?.length || 0;
  };

  // حساب إجمالي الطلبات
  const calculateTotalOrders = () => {
    if (!reports.sales) return 0;

    const salesData = reports.sales as any;
    return salesData?.totalOrders || salesData?.orders?.length || 0;
  };

  // Helper functions
  const formatNumber = (num: number) => {
    return formatDecimal(num);
  };

  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount);
  };

  const formatPercentage = (value: number, total: number) => {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  // Export functions
  const handleExportExcel = async (reportType: string) => {
    try {
      await exportReportToExcel(reportType, selectedPeriod);
      showNotification('تم تصدير التقرير بنجاح', 'success');
    } catch {
      showNotification('خطأ في تصدير التقرير', 'error');
    }
  };

  const handleExportPDF = async (reportType: string) => {
    try {
      await exportReportToPDF(reportType, selectedPeriod);
      showNotification('تم تصدير التقرير بنجاح', 'success');
    } catch {
      showNotification('خطأ في تصدير التقرير', 'error');
    }
  };

  const basicStats = calculateBasicStats();
  const revenueBreakdown = calculateRevenueBreakdown();
  const netProfit = calculateNetProfit();
  const profitMargin = calculateProfitMargin();

  return (
    <div className="space-y-6 min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center">
          <TrendingUp className="h-8 w-8 text-orange-600 dark:text-orange-400 ml-3" />
        <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">التقارير والإحصائيات</h1>
            <p className="text-gray-600 dark:text-gray-400">تحليل شامل لأداء النشاط التجاري</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 space-x-reverse">
          <button
            onClick={loadReports}
            disabled={loading}
            className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg flex items-center transition-colors duration-200"
            title="تحديث التقارير"
          >
            <RefreshCw className={`h-5 w-5 ml-2 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">فترة التقرير</h2>
          <div className="flex space-x-2 space-x-reverse">
            {[
              { value: 'today', label: 'اليوم' },
              { value: 'week', label: 'الأسبوع' },
              { value: 'month', label: 'الشهر' },
              { value: 'year', label: 'السنة' }
            ].map((period) => (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value)}
                className={`px-4 py-2 rounded-lg transition-colors duration-200 font-medium ${
                  selectedPeriod === period.value
                    ? 'bg-orange-600 dark:bg-orange-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
          </div>
          <p className="text-blue-800 dark:text-blue-300 font-medium">جاري تحميل التقارير...</p>
          <p className="text-blue-600 dark:text-blue-400 text-sm">يرجى الانتظار قليلاً</p>
        </div>
      )}

      {/* Basic Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">إجمالي الإيرادات</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(basicStats.revenue)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <ShoppingCart className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">إجمالي الطلبات</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatNumber(basicStats.orders)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">الجلسات النشطة</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatNumber(basicStats.sessions)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <Target className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">متوسط قيمة الطلب</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(basicStats.avgOrderValue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">توزيع الإيرادات</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-purple-500 rounded-full ml-3"></div>
                <span className="text-gray-700 dark:text-gray-300">البلايستيشن</span>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(revenueBreakdown.playstation)}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatPercentage(revenueBreakdown.playstation, basicStats.revenue)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-500 rounded-full ml-3"></div>
                <span className="text-gray-700 dark:text-gray-300">الكمبيوتر</span>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(revenueBreakdown.computer)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatPercentage(revenueBreakdown.computer, basicStats.revenue)}
            </p>
          </div>
        </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-orange-500 rounded-full ml-3"></div>
                <span className="text-gray-700 dark:text-gray-300">الكافيه</span>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(revenueBreakdown.cafe)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatPercentage(revenueBreakdown.cafe, basicStats.revenue)}
            </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">الأرباح والهوامش</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">صافي الربح</span>
              <div className="text-right">
                <p className={`font-semibold ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(netProfit)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">هامش الربح</span>
              <div className="text-right">
                <p className={`font-semibold ${profitMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {profitMargin.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Report */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">تقرير المبيعات</h3>
            <div className="flex space-x-2 space-x-reverse">
              <button
                onClick={() => handleExportExcel('sales')}
                className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors duration-200"
                title="تصدير Excel"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleExportPDF('sales')}
                className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors duration-200"
                title="تصدير PDF"
              >
                <Printer className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">إجمالي الفواتير</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatNumber(calculateTotalBills())}</span>
                  </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">إجمالي الطلبات</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatNumber(calculateTotalOrders())}</span>
                  </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">متوسط قيمة الفاتورة</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {basicStats.orders > 0 ? formatCurrency(basicStats.revenue / basicStats.orders) : formatCurrency(0)}
              </span>
                </div>
          </div>
        </div>

        {/* Sessions Report */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">تقرير الجلسات</h3>
            <div className="flex space-x-2 space-x-reverse">
              <button
                onClick={() => handleExportExcel('sessions')}
                className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors duration-200"
                title="تصدير Excel"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleExportPDF('sessions')}
                className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors duration-200"
                title="تصدير PDF"
              >
                <Printer className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">إجمالي الجلسات</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatNumber(basicStats.sessions)}</span>
                  </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">متوسط مدة الجلسة</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {basicStats.sessions > 0 ? '2.5 ساعة' : '0 ساعة'}
                  </span>
                </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">معدل الاستخدام</span>
              <span className="font-semibold text-gray-900 dark:text-white">75%</span>
                </div>
          </div>
        </div>
      </div>

      {/* Device Performance */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">أداء الأجهزة</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center ml-4">
              <Gamepad2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">البلايستيشن</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">معدل الاستخدام: 85%</p>
            </div>
          </div>
          <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center ml-4">
              <Monitor className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">الكمبيوتر</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">معدل الاستخدام: 70%</p>
            </div>
              </div>
          <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center ml-4">
              <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">الكافيه</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">معدل الاستخدام: 90%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Export All Reports */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">تصدير التقارير</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
            onClick={() => handleExportExcel('all')}
            className="flex items-center justify-center p-4 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-lg transition-colors duration-200 font-medium"
            >
            <Download className="h-5 w-5 ml-2" />
            تصدير جميع التقارير (Excel)
            </button>
            <button
            onClick={() => handleExportPDF('all')}
            className="flex items-center justify-center p-4 bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded-lg transition-colors duration-200 font-medium"
            >
            <Printer className="h-5 w-5 ml-2" />
            تصدير جميع التقارير (PDF)
            </button>
        </div>
      </div>
    </div>
  );
};

export default Reports;

