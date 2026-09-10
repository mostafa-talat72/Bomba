import React, { useEffect, useState } from 'react';
import { Gamepad2, Monitor, ShoppingCart, Receipt, TrendingUp, Clock, Users, DollarSign, BarChart3, Calendar, Coffee, Activity, Zap, Award } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import { useOrganization } from '../context/OrganizationContext';
import api from '../services/api';
import { formatCurrency, formatDecimal } from '../utils/formatters';
import { translateActivityMessage } from '../utils/activityTranslator';

interface RecentActivity {
  id: string;
  type: 'session' | 'order' | 'payment';
  time: string;
  date: string;
  color: string;
  icon: string;
  details: {
    deviceName?: string;
    deviceType?: string;
    status: string;
    totalCost?: number;
    customerName?: string;
    tableNumber?: number | string;
    totalAmount?: number;
    total?: number;
    paid?: number;
  };
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
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const { formatDate, formatTime } = useOrganization();
  const { sessions, orders, bills, isAuthenticated, getRecentActivity, refreshData, fetchBills, fetchOrders, fetchSessions, fetchTables } = useApp();
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
      }
  };



  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Dashboard فقط يحتاج bills, orders, sessions, tables — الباقي عند الطلب.
      // القوائم الكاملة تُجلب في الخلفية ولا تحجب الرسم الأول: الإحصائيات
      // والنشاط (السريعة) ترسم فور وصولها، والبطاقات التفصيلية تمتلئ بعدها.
      void Promise.all([
        fetchBills(),
        fetchOrders(),
        fetchSessions(),
        fetchTables(),
      ]);

      const [statsResponse, activityData] = await Promise.all([
        api.getDashboardStats('today'),
        getRecentActivity(5)
      ]);

      if (statsResponse.success) {
        setDashboardStats(statsResponse.data);
      } else {
        }

      setRecentActivity(activityData);

    } catch (error) {
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
      name: t('dashboard.activeSessions'),
      value: formatDecimal(realTimeActiveSessions, i18n.language),
      icon: Clock,
      color: 'bg-blue-500',
      bgColor: 'bg-gradient-to-br from-blue-50 to-blue-100',
      darkBgColor: 'dark:from-blue-900 dark:to-blue-800',
      textColor: 'text-blue-700',
      darkTextColor: 'dark:text-blue-300',
      description: t('dashboard.currentSessions')
    },
    {
      name: t('dashboard.pendingOrders'),
      value: formatDecimal(realTimePendingOrders, i18n.language),
      icon: ShoppingCart,
      color: 'bg-orange-500',
      bgColor: 'bg-gradient-to-br from-orange-50 to-orange-100',
      darkBgColor: 'dark:from-orange-900 dark:to-orange-800',
      textColor: 'text-orange-700',
      darkTextColor: 'dark:text-orange-300',
      description: t('dashboard.waiting')
    },
    {
      name: t('dashboard.todaySales'),
      value: formatCurrency(todayRevenue, i18n.language),
      icon: DollarSign,
      color: 'bg-green-500',
      bgColor: 'bg-gradient-to-br from-green-50 to-green-100',
      darkBgColor: 'dark:from-green-900 dark:to-green-800',
      textColor: 'text-green-700',
      darkTextColor: 'dark:text-green-300',
      description: t('dashboard.totalSales')
    },
    {
      name: t('dashboard.todayBills'),
      value: formatDecimal(todayOrders, i18n.language),
      icon: Receipt,
      color: 'bg-purple-500',
      bgColor: 'bg-gradient-to-br from-purple-50 to-purple-100',
      darkBgColor: 'dark:from-purple-900 dark:to-purple-800',
      textColor: 'text-purple-700',
      darkTextColor: 'dark:text-purple-300',
      description: t('dashboard.billsCount')
    }
  ];

  // Calculate current cost for active sessions
  const calculateCurrentCost = (session: Record<string, unknown>) => {
    if (session.status !== 'active') {
      return formatCurrency(session.totalCost as number, i18n.language);
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
      return formatCurrency(Math.max(cost, 1), i18n.language); // Minimum 1 pound
    } else if (session.deviceType === 'computer') {
      const hourlyRate = 15;
      const minuteRate = hourlyRate / 60;
      const cost = Math.round(minutes * minuteRate);
      return formatCurrency(Math.max(cost, 1), i18n.language); // Minimum 1 pound
    }

    return formatCurrency(session.totalCost as number, i18n.language);
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
          <p className="text-gray-600 dark:text-gray-300 text-lg font-medium">{t('dashboard.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-8 p-2 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Enhanced Welcome Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-600 via-orange-500 to-orange-700 dark:from-orange-700 dark:via-orange-600 dark:to-orange-800 rounded-2xl p-4 sm:p-8 text-white shadow-2xl">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-black bg-opacity-10"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white bg-opacity-10 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white bg-opacity-10 rounded-full translate-y-12 -translate-x-12"></div>

        <div className="relative z-10">
          <div className="flex items-center mb-2 sm:mb-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-4xl font-bold mb-1 sm:mb-2">
                {t('dashboard.welcome')}
              </h1>
              <p className="text-orange-100 text-sm sm:text-lg font-medium">{t('dashboard.subtitle')}</p>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex items-center space-x-4 space-x-reverse">
          <div className="flex items-center space-x-4 space-x-reverse">
            <div className="flex items-center bg-white bg-opacity-20 rounded-lg px-4 py-2">
              <Calendar className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              <span className="text-orange-100 font-medium">
                {formatDate(new Date(), {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
            <div className="flex items-center bg-white bg-opacity-20 rounded-lg px-4 py-2">
              <Clock className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              <span className="text-orange-100 font-medium">
                {formatTime(new Date())}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className={`${stat.bgColor} ${stat.darkBgColor} rounded-2xl p-3 sm:p-6 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 group`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center flex-1 min-w-0">
                  <div className={`${stat.color} rounded-xl p-2 sm:p-3 shadow-lg group-hover:scale-110 transition-transform duration-200 flex-shrink-0`}>
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <div className="mr-2 sm:mr-4 flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 sm:mb-2 truncate">{stat.name}</p>
                    <p className={`text-xl sm:text-3xl font-bold ${stat.textColor} ${stat.darkTextColor} mb-1 truncate`}>{stat.value}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">{stat.description}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
        {/* Enhanced Active Sessions */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-3 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 dark:bg-blue-800 rounded-xl flex items-center justify-center ${isRTL ? 'mr-2 sm:mr-3' : 'ml-2 sm:ml-3'}`}>
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="truncate">{t('dashboard.activeSessions')}</span>
              <span className={`bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs sm:text-sm font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full ${isRTL ? 'mr-2 sm:mr-3' : 'ml-2 sm:ml-3'} flex-shrink-0`}>
                {formatDecimal(activeSessions.length, i18n.language)}
              </span>
            </h3>
          </div>
          <div className="p-3 sm:p-6">
            {activeSessions.length === 0 ? (
              <div className="text-center py-8 sm:py-16">
                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-6">
                  <Clock className="h-7 w-7 sm:h-10 sm:w-10 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-lg sm:text-xl font-semibold mb-1 sm:mb-2">{t('dashboard.noActiveSessions')}</p>
                <p className="text-sm sm:text-base text-gray-400 dark:text-gray-500">{t('dashboard.allDevicesAvailable')}</p>
              </div>
            ) : (
              <div className="space-y-2.5 sm:space-y-4">
                {activeSessions.slice(0, 5).map((session) => {
                  const currentCost = calculateCurrentCost(session as unknown as Record<string, unknown>);
                  const startTime = new Date(session.startTime);
                  const now = new Date();
                  const durationMs = now.getTime() - startTime.getTime();
                  const hours = Math.floor(durationMs / (1000 * 60 * 60));
                  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

                  return (
                    <div key={session.id} className="flex items-center justify-between gap-2 p-3 sm:p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 rounded-xl border border-blue-100 dark:border-blue-700 hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
                      <div className="flex items-center min-w-0">
                        <div className={`w-10 h-10 sm:w-14 sm:h-14 bg-blue-100 dark:bg-blue-800 rounded-xl flex items-center justify-center flex-shrink-0 ${isRTL ? 'mr-2 sm:mr-4' : 'ml-2 sm:ml-4'}`}>
                          {session.deviceType.toLowerCase().includes('playstation') ? (
                            <Gamepad2 className="h-5 w-5 sm:h-7 sm:w-7 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Monitor className="h-5 w-5 sm:h-7 sm:w-7 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div className={`min-w-0 ${isRTL ? 'mr-2 sm:mr-4' : 'ml-2 sm:ml-4'}`}>
                          <p className="font-bold text-gray-900 dark:text-gray-100 text-base sm:text-lg truncate">{session.deviceName}</p>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-0.5 sm:mb-1 truncate">
                            {t('dashboard.startedAt')}: {formatTime(startTime)}
                          </p>
                          <p className="text-[11px] sm:text-xs text-blue-600 dark:text-blue-400 font-medium truncate">
                            {t('dashboard.duration')}: {hours > 0 ? `${formatDecimal(hours, i18n.language)}${t('dashboard.hours')} ${formatDecimal(minutes, i18n.language)}${t('dashboard.minutes')}` : `${formatDecimal(minutes, i18n.language)}${t('dashboard.minutes')}`}
                            {session.deviceType === 'playstation' && session.controllers && (
                              <span className={isRTL ? 'mr-2' : 'ml-2'}>• {formatDecimal(session.controllers, i18n.language)} {t('dashboard.controllers')}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className={`flex-shrink-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <p className="font-bold text-green-600 dark:text-green-400 text-lg sm:text-xl">{currentCost}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('dashboard.currentCost')}</p>
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
          <div className="p-3 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 bg-green-100 dark:bg-green-800 rounded-xl flex items-center justify-center ${isRTL ? 'mr-2 sm:mr-3' : 'ml-2 sm:ml-3'}`}>
                <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
              </div>
              <span className="truncate">{t('dashboard.recentActivity')}</span>
              <span className={`bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs sm:text-sm font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full ${isRTL ? 'mr-2 sm:mr-3' : 'ml-2 sm:ml-3'} flex-shrink-0`}>
                {formatDecimal(Math.min(recentActivity.length, 5), i18n.language)}
              </span>
            </h3>
          </div>
          <div className="p-3 sm:p-6">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 sm:py-16">
                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-6">
                  <Activity className="h-7 w-7 sm:h-10 sm:w-10 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-lg sm:text-xl font-semibold mb-1 sm:mb-2">{t('dashboard.noRecentActivity')}</p>
                <p className="text-sm sm:text-base text-gray-400 dark:text-gray-500">{t('dashboard.activityWillAppear')}</p>
              </div>
            ) : (
              <div className="space-y-2.5 sm:space-y-4">
                {recentActivity.slice(0, 5).map((activity) => {
                  const Icon = getActivityIcon(activity.icon);
                  const translatedMessage = translateActivityMessage(activity);
                  return (
                    <div key={activity.id} className="flex items-center gap-2 sm:gap-0 p-2.5 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 hover:scale-[1.02] group">
                      <div className={`w-9 h-9 sm:w-12 sm:h-12 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 ${isRTL ? 'mr-2 sm:mr-4' : 'ml-2 sm:ml-4'} group-hover:scale-110 transition-transform duration-200 ${activity.color}`}>
                        <Icon className="h-4 w-4 sm:h-6 sm:w-6" />
                      </div>
                      <div className={`${isRTL ? 'mr-2 sm:mr-4' : 'ml-2 sm:ml-4'} flex-1 min-w-0`}>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5 sm:mb-1 truncate">{translatedMessage}</p>
                        <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">{activity.time}</p>
                      </div>
                      <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-400 rounded-full animate-pulse flex-shrink-0"></div>
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
        <div className="p-3 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900 dark:to-violet-900">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 dark:bg-purple-800 rounded-xl flex items-center justify-center ${isRTL ? 'mr-2 sm:mr-3' : 'ml-2 sm:ml-3'}`}>
              <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="truncate">{t('dashboard.systemStatus')}</span>
          </h3>
        </div>
        <div className="p-3 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
            <div className="text-center p-4 sm:p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900 rounded-2xl border border-green-200 dark:border-green-700 hover:shadow-lg transition-all duration-200 hover:scale-105">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 dark:bg-green-800 rounded-2xl flex items-center justify-center mx-auto mb-2.5 sm:mb-4">
                <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <h4 className="font-bold text-green-800 dark:text-green-200 mb-1 sm:mb-2 text-base sm:text-lg">{t('dashboard.systemRunning')}</h4>
              <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">{t('dashboard.allServicesAvailable')}</p>
            </div>
            <div className="text-center p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 rounded-2xl border border-blue-200 dark:border-blue-700 hover:shadow-lg transition-all duration-200 hover:scale-105">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 dark:bg-blue-800 rounded-2xl flex items-center justify-center mx-auto mb-2.5 sm:mb-4">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-1 sm:mb-2 text-base sm:text-lg">{t('dashboard.activeUsers')}</h4>
              <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400">
                {realTimeActiveSessions > 0 ? `${formatDecimal(realTimeActiveSessions, i18n.language)} ${t('dashboard.activeSession')}` : t('dashboard.noActiveSessions2')}
              </p>
            </div>
            <div className="text-center p-4 sm:p-6 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900 dark:to-amber-900 rounded-2xl border border-orange-200 dark:border-orange-700 hover:shadow-lg transition-all duration-200 hover:scale-105">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-100 dark:bg-orange-800 rounded-2xl flex items-center justify-center mx-auto mb-2.5 sm:mb-4">
                <ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h4 className="font-bold text-orange-800 dark:text-orange-200 mb-1 sm:mb-2 text-base sm:text-lg">{t('dashboard.pendingOrders')}</h4>
              <p className="text-xs sm:text-sm text-orange-600 dark:text-orange-400">
                {realTimePendingOrders > 0 ? (
                  <>
                    {formatDecimal(realTimePendingOrders, i18n.language)} {t('dashboard.pendingOrdersCount')}
                    <br />
                    <span className="text-[11px] sm:text-xs">
                      {formatDecimal(ordersAnalysis.pending || 0, i18n.language)} {t('dashboard.waiting')} • {formatDecimal(ordersAnalysis.preparing || 0, i18n.language)} {t('dashboard.preparing')} • {formatDecimal(ordersAnalysis.ready || 0, i18n.language)} {t('dashboard.ready')}
                    </span>
                    <br />
                    <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
                      {t('dashboard.totalCalculated')}: {formatDecimal(actualPendingOrders.length, i18n.language)}
                    </span>
                  </>
                ) : (
                  t('dashboard.noPendingOrders')
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
