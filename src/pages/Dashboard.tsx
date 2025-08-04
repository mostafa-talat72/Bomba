import React, { useEffect, useState } from 'react';
import { Gamepad2, Monitor, ShoppingCart, Receipt, TrendingUp, Clock, Users, DollarSign, BarChart3, Calendar, Coffee, Activity, Zap, Award } from 'lucide-react';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import { formatCurrency, formatDecimal } from '../utils/formatters';

interface RecentActivity {
  id: string;
  type: 'session' | 'order' | 'payment';
  message: string;
  time: string;
  date: string;
  color: string;
  icon: string;
  details: Record<string, unknown>;
}

interface DashboardStats {
  today?: {
    revenue?: number;
    bills?: number;
  };
  revenue?: {
    totalRevenue?: number;
    totalBills?: number;
  };
  realTime?: {
    activeSessions?: number;
    pendingOrders?: number;
  };
}

const Dashboard = () => {
  const { sessions, orders, bills, isAuthenticated, getRecentActivity, refreshData } = useApp();
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated]);

  // إعادة تحميل البيانات كل 30 ثانية
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(() => {
        refreshData();
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, refreshData]);

  // دالة لتنظيف البيانات يدوياً
  const cleanData = async () => {
    try {

      // تحديث البيانات الأساسية
      await refreshData();

      // انتظار قليل
      await new Promise(resolve => setTimeout(resolve, 2000));

      // تحديث لوحة التحكم
      await refreshDashboardData();
    } catch (error) {
      console.error('❌ Failed to clean data:', error);
    }
  };

  // دالة منفصلة لتحديث البيانات فقط
  const refreshDashboardData = async () => {
    try {

      // تحديث البيانات الأساسية أولاً
      await refreshData();

      // انتظار قليل لضمان تحديث البيانات
      await new Promise(resolve => setTimeout(resolve, 1000));

      const [statsResponse, activityData] = await Promise.all([
        api.getDashboardStats('today'),
        getRecentActivity(5)
      ]);



      if (statsResponse.success) {
        setDashboardStats(statsResponse.data);
      }

      setRecentActivity(activityData);

    } catch (error) {
      console.error('❌ Failed to refresh dashboard data:', error);
    }
  };



  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // تحميل البيانات الأساسية أولاً
      await refreshData();

      // انتظار قليل لضمان تحديث البيانات
      await new Promise(resolve => setTimeout(resolve, 500));

      const [statsResponse, activityData] = await Promise.all([
        api.getDashboardStats('today'),
        getRecentActivity(5) // تغيير من 10 إلى 5
      ]);



      if (statsResponse.success) {
        setDashboardStats(statsResponse.data);
      } else {
        console.error('❌ Dashboard stats failed:', statsResponse);
      }

      setRecentActivity(activityData);

    } catch (error) {
      console.error('❌ Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const activeSessions = sessions.filter(s => s.status === 'active');
  const todayBills = bills.filter(b => {
    const today = new Date().toDateString();
    const billDate = new Date(b.createdAt).toDateString();
    return billDate === today;
  });

  // تحليل مفصل للطلبات
  const ordersAnalysis = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // فحص إضافي للتأكد من صحة البيانات
  const actualPendingOrders = orders.filter(o =>
    o.status === 'pending' ||
    o.status === 'preparing' ||
    o.status === 'ready'
  );



  // Use real data from API or fallback to calculated values
  const todayRevenue = dashboardStats?.today?.revenue ||
    dashboardStats?.revenue?.totalRevenue ||
    todayBills.reduce((sum, bill) => sum + (bill.paid || 0), 0);
  const todayOrders = dashboardStats?.today?.bills ||
    dashboardStats?.revenue?.totalBills ||
    todayBills.length;

  // Use real-time data from API with fallback - تحسين الحساب
  const realTimeActiveSessions = dashboardStats?.realTime?.activeSessions ?? activeSessions.length;
  const realTimePendingOrders = dashboardStats?.realTime?.pendingOrders ?? actualPendingOrders.length;

  const stats = [
    {
      name: 'الجلسات النشطة',
      value: formatDecimal(realTimeActiveSessions),
      icon: Clock,
      color: 'bg-blue-500',
      bgColor: 'bg-gradient-to-br from-blue-50 to-blue-100',
      darkBgColor: 'dark:from-blue-900 dark:to-blue-800',
      textColor: 'text-blue-700',
      darkTextColor: 'dark:text-blue-300',
      description: 'جلسات حالية'
    },
    {
      name: 'الطلبات المعلقة',
      value: formatDecimal(realTimePendingOrders),
      icon: ShoppingCart,
      color: 'bg-orange-500',
      bgColor: 'bg-gradient-to-br from-orange-50 to-orange-100',
      darkBgColor: 'dark:from-orange-900 dark:to-orange-800',
      textColor: 'text-orange-700',
      darkTextColor: 'dark:text-orange-300',
      description: 'في الانتظار'
    },
    {
      name: 'مبيعات اليوم',
      value: formatCurrency(todayRevenue),
      icon: DollarSign,
      color: 'bg-green-500',
      bgColor: 'bg-gradient-to-br from-green-50 to-green-100',
      darkBgColor: 'dark:from-green-900 dark:to-green-800',
      textColor: 'text-green-700',
      darkTextColor: 'dark:text-green-300',
      description: 'إجمالي المبيعات'
    },
    {
      name: 'فواتير اليوم',
      value: formatDecimal(todayOrders),
      icon: Receipt,
      color: 'bg-purple-500',
      bgColor: 'bg-gradient-to-br from-purple-50 to-purple-100',
      darkBgColor: 'dark:from-purple-900 dark:to-purple-800',
      textColor: 'text-purple-700',
      darkTextColor: 'dark:text-purple-300',
      description: 'عدد الفواتير'
    }
  ];

  // Calculate current cost for active sessions
  const calculateCurrentCost = (session: Record<string, unknown>) => {
    if (session.status !== 'active') {
      return formatCurrency(session.totalCost as number);
    }

    const now = new Date();
    const startTime = new Date(session.startTime as string);
    const durationMs = now.getTime() - startTime.getTime();
    const minutes = durationMs / (1000 * 60);

    if (session.deviceType === 'playstation') {
      // Calculate based on controllers
      let hourlyRate = 20; // Default rate
      if (session.controllers === 2) hourlyRate = 25;
      else if (session.controllers === 3) hourlyRate = 30;
      else if (session.controllers === 4) hourlyRate = 35;

      const minuteRate = hourlyRate / 60;
      const cost = Math.round(minutes * minuteRate);
      return formatCurrency(Math.max(cost, 1)); // Minimum 1 pound
    } else if (session.deviceType === 'computer') {
      const hourlyRate = 15;
      const minuteRate = hourlyRate / 60;
      const cost = Math.round(minutes * minuteRate);
      return formatCurrency(Math.max(cost, 1)); // Minimum 1 pound
    }

    return formatCurrency(session.totalCost as number);
  };

  // Get icon component based on activity type
  const getActivityIcon = (iconName: string) => {
    switch (iconName) {
      case 'Gamepad2': return Gamepad2;
      case 'Coffee': return Coffee;
      case 'Receipt': return Receipt;
      case 'Monitor': return Monitor;
      default: return TrendingUp;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-600 dark:border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300 text-lg font-medium">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Enhanced Welcome Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-600 via-orange-500 to-orange-700 dark:from-orange-700 dark:via-orange-600 dark:to-orange-800 rounded-2xl p-8 text-white shadow-2xl">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-black bg-opacity-10"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white bg-opacity-10 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white bg-opacity-10 rounded-full translate-y-12 -translate-x-12"></div>

        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mr-4">
                  <Award className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold mb-2">
                    مرحباً بك في نظام Bomba
                  </h1>
                  <p className="text-orange-100 text-lg font-medium">لوحة تحكم شاملة لإدارة الطلبات والبلايستيشن</p>
                </div>
              </div>

              {/* Quick Stats Row */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-white bg-opacity-20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">{formatDecimal(realTimeActiveSessions)}</div>
                  <div className="text-orange-100 text-sm">جلسات نشطة</div>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">{formatDecimal(realTimePendingOrders)}</div>
                  <div className="text-orange-100 text-sm">طلبات معلقة</div>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">{formatCurrency(todayRevenue)}</div>
                  <div className="text-orange-100 text-sm">مبيعات اليوم</div>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex items-center space-x-4 space-x-reverse">
              <div className="flex items-center space-x-4 space-x-reverse">
                <div className="flex items-center bg-white bg-opacity-20 rounded-lg px-4 py-2">
                  <Calendar className="h-5 w-5 ml-2" />
                  <span className="text-orange-100 font-medium">
                    {new Date().toLocaleDateString('ar-EG', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex items-center bg-white bg-opacity-20 rounded-lg px-4 py-2">
                  <Clock className="h-5 w-5 ml-2" />
                  <span className="text-orange-100 font-medium">
                    {new Date().toLocaleTimeString('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>

              <div className="flex space-x-3 space-x-reverse">
                <button
                  onClick={cleanData}
                  disabled={loading}
                  className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 space-x-reverse hover:scale-105"
                >
                  <div className={`w-4 h-4 border-2 border-white border-t-transparent rounded-full ${loading ? 'animate-spin' : ''}`}></div>
                  <span>تنظيف البيانات</span>
                </button>
                <button
                  onClick={refreshDashboardData}
                  disabled={loading}
                  className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 space-x-reverse hover:scale-105"
                >
                  <div className={`w-4 h-4 border-2 border-white border-t-transparent rounded-full ${loading ? 'animate-spin' : ''}`}></div>
                  <span>تحديث البيانات</span>
                </button>
              </div>

              <div className="w-20 h-20 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center">
                <BarChart3 className="h-10 w-10 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className={`${stat.bgColor} ${stat.darkBgColor} rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 group`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center flex-1">
                  <div className={`${stat.color} rounded-xl p-3 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="mr-4 flex-1">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">{stat.name}</p>
                    <p className={`text-3xl font-bold ${stat.textColor} ${stat.darkTextColor} mb-1`}>{stat.value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{stat.description}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Enhanced Active Sessions */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-xl flex items-center justify-center mr-3">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              الجلسات النشطة
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-bold px-3 py-1 rounded-full mr-3">
                {formatDecimal(activeSessions.length)}
              </span>
            </h3>
          </div>
          <div className="p-6">
            {activeSessions.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Clock className="h-10 w-10 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-xl font-semibold mb-2">لا توجد جلسات نشطة حالياً</p>
                <p className="text-gray-400 dark:text-gray-500">جميع الأجهزة متاحة للاستخدام</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeSessions.slice(0, 5).map((session) => {
                  const currentCost = calculateCurrentCost(session as unknown as Record<string, unknown>);
                  const startTime = new Date(session.startTime);
                  const now = new Date();
                  const durationMs = now.getTime() - startTime.getTime();
                  const hours = Math.floor(durationMs / (1000 * 60 * 60));
                  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

                  return (
                    <div key={session.id} className="flex items-center justify-between p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 rounded-xl border border-blue-100 dark:border-blue-700 hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
                      <div className="flex items-center">
                        <div className="w-14 h-14 bg-blue-100 dark:bg-blue-800 rounded-xl flex items-center justify-center mr-4">
                          {session.deviceType.includes('PlayStation') || session.deviceType.includes('بلايستيشن') ? (
                            <Gamepad2 className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Monitor className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div className="mr-4">
                          <p className="font-bold text-gray-900 dark:text-gray-100 text-lg">{session.deviceName}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            بدأت: {startTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            المدة: {hours > 0 ? `${formatDecimal(hours)}س ${formatDecimal(minutes)}د` : `${formatDecimal(minutes)}د`}
                            {session.deviceType === 'playstation' && session.controllers && (
                              <span className="mr-2">• {formatDecimal(session.controllers)} دراع</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-green-600 dark:text-green-400 text-xl">{currentCost}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">التكلفة الحالية</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-xl flex items-center justify-center mr-3">
                <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              النشاط الأخير
              <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm font-bold px-3 py-1 rounded-full mr-3">
                {formatDecimal(Math.min(recentActivity.length, 5))}
              </span>
            </h3>
          </div>
          <div className="p-6">
            {recentActivity.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Activity className="h-10 w-10 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-xl font-semibold mb-2">لا يوجد نشاط حديث</p>
                <p className="text-gray-400 dark:text-gray-500">سيظهر النشاط هنا عند بدء الجلسات أو الطلبات</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.slice(0, 5).map((activity) => {
                  const Icon = getActivityIcon(activity.icon);
                  return (
                    <div key={activity.id} className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 hover:scale-[1.02] group">
                      <div className={`w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-200 ${activity.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="mr-4 flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{activity.message}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{activity.time}</p>
                      </div>
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced System Status */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900 dark:to-violet-900">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-800 rounded-xl flex items-center justify-center mr-3">
              <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            حالة النظام
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900 rounded-2xl border border-green-200 dark:border-green-700 hover:shadow-lg transition-all duration-200 hover:scale-105">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <h4 className="font-bold text-green-800 dark:text-green-200 mb-2 text-lg">النظام يعمل</h4>
              <p className="text-sm text-green-600 dark:text-green-400">جميع الخدمات متاحة</p>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 rounded-2xl border border-blue-200 dark:border-blue-700 hover:shadow-lg transition-all duration-200 hover:scale-105">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-2 text-lg">المستخدمون النشطون</h4>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {realTimeActiveSessions > 0 ? `${formatDecimal(realTimeActiveSessions)} جلسة نشطة` : 'لا توجد جلسات نشطة'}
              </p>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900 dark:to-amber-900 rounded-2xl border border-orange-200 dark:border-orange-700 hover:shadow-lg transition-all duration-200 hover:scale-105">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h4 className="font-bold text-orange-800 dark:text-orange-200 mb-2 text-lg">الطلبات المعلقة</h4>
              <p className="text-sm text-orange-600 dark:text-orange-400">
                {realTimePendingOrders > 0 ? (
                  <>
                    {formatDecimal(realTimePendingOrders)} طلب في الانتظار أو جاهز
                    <br />
                    <span className="text-xs">
                      {formatDecimal(ordersAnalysis.pending || 0)} في الانتظار • {formatDecimal(ordersAnalysis.preparing || 0)} قيد التحضير • {formatDecimal(ordersAnalysis.ready || 0)} جاهزة
                    </span>
                    <br />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      إجمالي محسوب: {formatDecimal(actualPendingOrders.length)}
                    </span>
                  </>
                ) : (
                  'لا توجد طلبات معلقة'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
