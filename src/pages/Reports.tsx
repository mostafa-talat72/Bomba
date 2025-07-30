import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart, Calendar, Filter, Download, Printer, RefreshCw, Gamepad2, Monitor, Clock, Target } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency as formatCurrencyUtil, formatDecimal } from '../utils/formatters';

const Reports = () => {
  const { getSalesReport, getSessionsReport, getInventoryReport, getFinancialReport, exportReportToExcel, exportReportToPDF, showNotification } = useApp();
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<{
    sales: any;
    sessions: any;
    inventory: any;
    financial: any;
  }>({
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
    } catch (error) {
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
    } catch (error) {
      showNotification('فشل في تصدير التقرير', 'error');
    }
  };

  const handleExportPDF = async (reportType: string) => {
    try {
      await exportReportToPDF(reportType, selectedPeriod);
    } catch (error) {
      showNotification('فشل في تصدير التقرير', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">التقارير والإحصائيات</h1>
          <p className="text-gray-600">مراقبة أداء الأعمال والإحصائيات</p>
        </div>
        <div className="flex items-center space-x-3 space-x-reverse">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="today">اليوم</option>
            <option value="week">الأسبوع</option>
            <option value="month">الشهر</option>
            <option value="year">السنة</option>
          </select>
          <button
            onClick={loadReports}
            className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Basic Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <DollarSign className="h-5 w-5 ml-2 text-green-500" />
            إجمالي الإيرادات
          </h3>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{formatCurrency(basicStats.revenue)}</p>
            <p className="text-sm text-gray-500">إجمالي المبيعات</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <ShoppingCart className="h-5 w-5 ml-2 text-blue-500" />
            عدد الطلبات
          </h3>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{formatNumber(basicStats.orders)}</p>
            <p className="text-sm text-gray-500">إجمالي الطلبات</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 ml-2 text-purple-500" />
            متوسط الطلب
          </h3>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600">{formatCurrency(basicStats.avgOrderValue)}</p>
            <p className="text-sm text-gray-500">متوسط قيمة الطلب</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="h-5 w-5 ml-2 text-orange-500" />
            عدد الجلسات
          </h3>
          <div className="text-center">
            <p className="text-3xl font-bold text-orange-600">{formatNumber(basicStats.sessions)}</p>
            <p className="text-sm text-gray-500">إجمالي الجلسات</p>
          </div>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Gamepad2 className="h-5 w-5 ml-2 text-blue-500" />
            البلايستيشن
          </h3>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(revenueBreakdown.playstation)}</p>
            <p className="text-sm text-gray-500">
              {formatPercentage(revenueBreakdown.playstation, totalRevenue)} من الإيرادات
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Monitor className="h-5 w-5 ml-2 text-green-500" />
            الكمبيوتر
          </h3>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{formatCurrency(revenueBreakdown.computer)}</p>
            <p className="text-sm text-gray-500">
              {formatPercentage(revenueBreakdown.computer, totalRevenue)} من الإيرادات
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <ShoppingCart className="h-5 w-5 ml-2 text-orange-500" />
            الطلبات
          </h3>
          <div className="text-center">
            <p className="text-3xl font-bold text-orange-600">{formatCurrency(revenueBreakdown.cafe)}</p>
            <p className="text-sm text-gray-500">
              {formatPercentage(revenueBreakdown.cafe, totalRevenue)} من الإيرادات
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">أكثر المنتجات مبيعاً</h3>
            <div className="flex space-x-2 space-x-reverse">
              <button
                onClick={() => handleExportExcel('sales')}
                className="text-primary-600 hover:text-primary-700 text-sm p-1"
                title="تصدير Excel"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleExportPDF('sales')}
                className="text-blue-600 hover:text-blue-700 text-sm p-1"
                title="تصدير PDF"
              >
                <Printer className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="space-y-4">
            {reports.sales && (reports.sales as any)?.topProducts ? (
              (reports.sales as any).topProducts.slice(0, 5).map((product: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-700">{product.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatNumber(product.quantity)} قطعة</p>
                    <p className="text-xs text-gray-500">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">لا توجد بيانات متاحة</p>
            )}
          </div>
        </div>

        {/* Sessions Analysis */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">تحليل الجلسات</h3>
            <div className="flex space-x-2 space-x-reverse">
              <button
                onClick={() => handleExportExcel('sessions')}
                className="text-primary-600 hover:text-primary-700 text-sm p-1"
                title="تصدير Excel"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleExportPDF('sessions')}
                className="text-blue-600 hover:text-blue-700 text-sm p-1"
                title="تصدير PDF"
              >
                <Printer className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="space-y-4">
            {reports.sessions ? (
              <>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-blue-600 ml-2" />
                    <span className="text-sm font-medium text-gray-700">متوسط مدة الجلسة</span>
                  </div>
                  <span className="font-bold text-blue-600">
                    {formatDecimal((reports.sessions as any)?.avgSessionDuration || 0)} ساعة
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-green-600 ml-2" />
                    <span className="text-sm font-medium text-gray-700">أكثر الأجهزة استخداماً</span>
                  </div>
                  <span className="font-bold text-green-600">
                    {(reports.sessions as any)?.mostUsedDevice || 'غير متوفر'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center">
                    <Target className="h-5 w-5 text-purple-600 ml-2" />
                    <span className="text-sm font-medium text-gray-700">معدل الاستخدام</span>
                  </div>
                  <span className="font-bold text-purple-600">
                    {formatDecimal((reports.sessions as any)?.usageRate || 0)}%
                  </span>
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center py-4">لا توجد بيانات متاحة</p>
            )}
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">الملخص المالي</h3>
          <div className="flex space-x-2 space-x-reverse">
            <button
              onClick={() => handleExportExcel('financial')}
              className="text-primary-600 hover:text-primary-700 text-sm p-1"
              title="تصدير Excel"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleExportPDF('financial')}
              className="text-blue-600 hover:text-blue-700 text-sm p-1"
              title="تصدير PDF"
            >
              <Printer className="h-4 w-4" />
            </button>
          </div>
        </div>
        {reports.financial && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency((reports.financial as any)?.grossProfit || 0)}
              </div>
              <div className="text-sm text-gray-600">إجمالي الربح</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency((reports.financial as any)?.totalCosts || 0)}
              </div>
              <div className="text-sm text-gray-600">إجمالي التكاليف</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {formatPercentage((reports.financial as any)?.profitMargin || 0, 100)}
              </div>
              <div className="text-sm text-gray-600">هامش الربح</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {formatNumber((reports.financial as any)?.totalTransactions || 0)}
              </div>
              <div className="text-sm text-gray-600">عدد المعاملات</div>
            </div>
          </div>
        )}
      </div>

      {/* Inventory Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">ملخص المخزون</h3>
          <div className="flex space-x-2 space-x-reverse">
            <button
              onClick={() => handleExportExcel('inventory')}
              className="text-primary-600 hover:text-primary-700 text-sm p-1"
              title="تصدير Excel"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleExportPDF('inventory')}
              className="text-blue-600 hover:text-blue-700 text-sm p-1"
              title="تصدير PDF"
            >
              <Printer className="h-4 w-4" />
            </button>
          </div>
        </div>
        {reports.inventory && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {formatNumber((reports.inventory as any)?.totalItems || 0)}
              </div>
              <div className="text-sm text-gray-600">إجمالي المنتجات</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {formatNumber((reports.inventory as any)?.totalQuantity || 0)}
              </div>
              <div className="text-sm text-gray-600">إجمالي الكمية</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency((reports.inventory as any)?.totalValue || 0)}
              </div>
              <div className="text-sm text-gray-600">إجمالي القيمة</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {formatNumber((reports.inventory as any)?.lowStockItems || 0)}
              </div>
              <div className="text-sm text-gray-600">عناصر المخزون المنخفض</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;

