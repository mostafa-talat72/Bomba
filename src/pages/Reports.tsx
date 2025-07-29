import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart, Calendar, Filter, Download, Printer, RefreshCw, Gamepad2, Monitor, Clock, Target } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency as formatCurrencyUtil, formatDecimal } from '../utils/formatters';

const Reports = () => {
  const { getSalesReport, getSessionsReport, getInventoryReport, getFinancialReport, showNotification } = useApp();
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <BarChart3 className="h-8 w-8 text-primary-600 ml-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">التقارير والإحصائيات</h1>
            <p className="text-gray-600">تحليل الأداء والمبيعات</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 space-x-reverse">
          <button
            onClick={loadReports}
            disabled={loading}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center transition-colors duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ml-2 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="today">اليوم</option>
            <option value="week">هذا الأسبوع</option>
            <option value="month">هذا الشهر</option>
            <option value="quarter">هذا الربع</option>
            <option value="year">هذا العام</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">جاري تحميل التقارير...</p>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">إجمالي الإيرادات</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(basicStats.revenue)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <ShoppingCart className="h-6 w-6 text-blue-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">عدد الطلبات</p>
              <p className="text-2xl font-bold text-blue-600">{formatNumber(basicStats.orders)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">متوسط الطلب</p>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(basicStats.avgOrderValue)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Gamepad2 className="h-6 w-6 text-orange-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">عدد الجلسات</p>
              <p className="text-2xl font-bold text-orange-600">{formatNumber(basicStats.sessions)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
            <button className="text-primary-600 hover:text-primary-700 text-sm">
              <Download className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-4">
            {(reports.sales as any)?.topProducts?.slice(0, 5).map((product: any, index: number) => (
              <div key={product.name} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-sm font-medium text-primary-600">
                    {index + 1}
                  </div>
                  <div className="mr-3">
                    <p className="font-medium text-gray-900">{product.name}</p>
                    <p className="text-sm text-gray-500">{formatNumber(product.quantity)} قطعة</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-900">{formatCurrency(product.revenue)}</p>
                </div>
              </div>
            )) || (
                <div className="text-center text-gray-500 py-8">
                  لا توجد بيانات متاحة
                </div>
              )}
          </div>
        </div>

        {/* Sessions Analysis */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">تحليل الجلسات</h3>
            <button className="text-primary-600 hover:text-primary-700 text-sm">
              <Download className="h-4 w-4" />
            </button>
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
                    {(reports.sessions as any)?.avgSessionDuration || 0} ساعة
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
                    {(reports.sessions as any)?.usageRate || 0}%
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 py-8">
                لا توجد بيانات متاحة
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      {reports.financial && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">الملخص المالي</h3>
          </div>
          <div className="p-6">
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
          </div>
        </div>
      )}

      {/* Export Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">تصدير التقارير</h3>
            <p className="text-sm text-gray-600">تحميل التقارير بصيغ مختلفة</p>
          </div>
          <div className="flex space-x-3 space-x-reverse">
            <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center transition-colors duration-200">
              <Download className="h-4 w-4 ml-2" />
              تصدير Excel
            </button>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center transition-colors duration-200">
              <Download className="h-4 w-4 ml-2" />
              تصدير PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
