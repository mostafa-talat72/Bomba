import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Users, ShoppingCart, Download, Printer, RefreshCw, Gamepad2, Monitor, Clock, Target, BarChart3 } from 'lucide-react';
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

  // حساب عدد المعاملات
  const calculateTotalTransactions = () => {
    if (!reports.financial) return 0;

    const financial = reports.financial as any;

    // الحصول على عدد المعاملات من البيانات المالية
    let totalTransactions = financial?.summary?.totalTransactions ||
                           financial?.revenue?.totalBills ||
                           financial?.totalTransactions || 0;

    // إذا لم تكن متوفرة في البيانات المالية، نحسب من البيانات الأخرى
    if (totalTransactions === 0) {
      // حساب من بيانات المبيعات
      const salesData = reports.sales as any;
      if (salesData?.totalOrders) {
        totalTransactions = salesData.totalOrders;
      } else if (salesData?.totalBills) {
        totalTransactions = salesData.totalBills;
      }
    }

    return totalTransactions;
  };

  // حساب عدد الفواتير فقط
  const calculateTotalBills = () => {
    if (!reports.financial) return 0;

    const financial = reports.financial as any;

    return financial?.revenue?.totalBills || 0;
  };

  // حساب عدد الطلبات فقط
  const calculateTotalOrders = () => {
    const totalTransactions = calculateTotalTransactions();
    const totalBills = calculateTotalBills();

    return Math.max(0, totalTransactions - totalBills);
  };

  // تنسيق الأرقام
  const formatNumber = (num: number) => {
    return formatDecimal(num);
  };

  // تنسيق العملة
  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount);
  };

  // تنسيق النسبة المئوية
  const formatPercentage = (value: number, total: number) => {
    if (total === 0) return '٠%';
    return `${formatDecimal((value / total) * 100)}%`;
  };

  const basicStats = calculateBasicStats();
  const revenueBreakdown = calculateRevenueBreakdown();
  const totalRevenue = basicStats.revenue || 0;

  // Export functions
  const handleExportExcel = async (reportType: string) => {
    try {
      await exportReportToExcel(reportType, selectedPeriod);
    } catch {
      showNotification('فشل في تصدير التقرير', 'error');
    }
  };

  const handleExportPDF = async (reportType: string) => {
    try {
      await exportReportToPDF(reportType, selectedPeriod);
    } catch {
      showNotification('فشل في تصدير التقرير', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 dark:border-orange-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
            <BarChart3 className="h-6 w-6 text-orange-600 dark:text-orange-400 ml-2" />
            التقارير والإحصائيات
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mr-4">مراقبة أداء الأعمال والإحصائيات</p>
        </div>
        <div className="flex items-center space-x-3 space-x-reverse">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="today">اليوم</option>
            <option value="week">الأسبوع</option>
            <option value="month">الشهر</option>
            <option value="year">السنة</option>
          </select>
          <button
            onClick={loadReports}
            className="p-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white rounded-lg transition-colors duration-200"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Basic Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
            <DollarSign className="h-5 w-5 ml-2 text-green-500" />
            إجمالي الإيرادات
          </h3>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(basicStats.revenue)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">إجمالي المبيعات</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
            <ShoppingCart className="h-5 w-5 ml-2 text-blue-500" />
            عدد الطلبات
          </h3>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{formatNumber(basicStats.orders)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">إجمالي الطلبات</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 ml-2 text-purple-500" />
            متوسط الطلب
          </h3>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(basicStats.avgOrderValue)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">متوسط قيمة الطلب</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
            <Users className="h-5 w-5 ml-2 text-orange-500" />
            عدد الجلسات
          </h3>
          <div className="text-center">
            <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{formatNumber(basicStats.sessions)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">إجمالي الجلسات</p>
          </div>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
            <Gamepad2 className="h-5 w-5 ml-2 text-blue-500" />
            البلايستيشن
          </h3>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(revenueBreakdown.playstation)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatPercentage(revenueBreakdown.playstation, totalRevenue)} من الإيرادات
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
            <Monitor className="h-5 w-5 ml-2 text-green-500" />
            الكمبيوتر
          </h3>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(revenueBreakdown.computer)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatPercentage(revenueBreakdown.computer, totalRevenue)} من الإيرادات
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
            <ShoppingCart className="h-5 w-5 ml-2 text-orange-500" />
            الطلبات
          </h3>
          <div className="text-center">
            <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(revenueBreakdown.cafe)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatPercentage(revenueBreakdown.cafe, totalRevenue)} من الإيرادات
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">أكثر المنتجات مبيعاً</h3>
            <div className="flex space-x-2 space-x-reverse">
              <button
                onClick={() => handleExportExcel('sales')}
                className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 text-sm p-1"
                title="تصدير Excel"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleExportPDF('sales')}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm p-1"
                title="تصدير PDF"
              >
                <Printer className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="space-y-4">
            {reports.sales && (reports.sales as any)?.topProducts ? (
              (reports.sales as any).topProducts.slice(0, 5).map((product: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{product.name}</span>
                  </div>
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
        </div>

        {/* Sessions Analysis */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">تحليل الجلسات</h3>
            <div className="flex space-x-2 space-x-reverse">
              <button
                onClick={() => handleExportExcel('sessions')}
                className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 text-sm p-1"
                title="تصدير Excel"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleExportPDF('sessions')}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm p-1"
                title="تصدير PDF"
              >
                <Printer className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="space-y-4">
            {reports.sessions ? (
              <>
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 ml-2" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">متوسط مدة الجلسة</span>
                  </div>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {formatDecimal((reports.sessions as any)?.avgSessionDuration || 0)} ساعة
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900 rounded-lg">
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-green-600 dark:text-green-400 ml-2" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">أكثر الأجهزة استخداماً</span>
                  </div>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    {(reports.sessions as any)?.mostUsedDevice || 'غير متوفر'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900 rounded-lg">
                  <div className="flex items-center">
                    <Target className="h-5 w-5 text-purple-600 dark:text-purple-400 ml-2" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">معدل الاستخدام</span>
                  </div>
                  <span className="font-bold text-purple-600 dark:text-purple-400">
                    {formatDecimal((reports.sessions as any)?.usageRate || 0)}%
                  </span>
                </div>
              </>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">لا توجد بيانات متاحة</p>
            )}
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">الملخص المالي</h3>
          <div className="flex space-x-2 space-x-reverse">
            <button
              onClick={() => handleExportExcel('financial')}
              className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 text-sm p-1"
              title="تصدير Excel"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleExportPDF('financial')}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm p-1"
              title="تصدير PDF"
            >
              <Printer className="h-4 w-4" />
            </button>
          </div>
        </div>
        {reports.financial && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(calculateNetProfit())}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">إجمالي الربح</div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency((reports.financial as any)?.totalCosts || (reports.financial as any)?.summary?.totalCosts || 0)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">إجمالي التكاليف</div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatDecimal(calculateProfitMargin())}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">هامش الربح</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-900 rounded-lg">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {formatNumber(calculateTotalTransactions())}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">عدد المعاملات</div>
            </div>
          </div>
        )}
      </div>

      {/* Inventory Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">ملخص المخزون</h3>
          <div className="flex space-x-2 space-x-reverse">
            <button
              onClick={() => handleExportExcel('inventory')}
              className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 text-sm p-1"
              title="تصدير Excel"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleExportPDF('inventory')}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm p-1"
              title="تصدير PDF"
            >
              <Printer className="h-4 w-4" />
            </button>
          </div>
        </div>
        {reports.inventory && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatNumber((reports.inventory as any)?.totalItems || 0)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">إجمالي المنتجات</div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatNumber((reports.inventory as any)?.totalQuantity || 0)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">إجمالي الكمية</div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency((reports.inventory as any)?.totalValue || 0)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">إجمالي القيمة</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-900 rounded-lg">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {formatNumber((reports.inventory as any)?.lowStockItems || 0)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">عناصر المخزون المنخفض</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;

