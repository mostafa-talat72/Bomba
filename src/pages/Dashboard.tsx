import React, { useEffect, useState } from 'react';
import { Gamepad2, Monitor, ShoppingCart, Receipt, TrendingUp, Clock, Users, DollarSign, BarChart3, Calendar, Coffee } from 'lucide-react';
import { useApp } from '../context/AppContext';
import api from '../services/api';

interface RecentActivity {
  id: string;
  type: 'session' | 'order' | 'payment';
  message: string;
  time: string;
  date: string;
  color: string;
  icon: string;
  details: any;
}

const Dashboard = () => {
  const { sessions, orders, bills, isAuthenticated, getRecentActivity, refreshData } = useApp();
  const [dashboardStats, setDashboardStats] = useState<any>(null);
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
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing');
  const todayBills = bills.filter(b => {
    const today = new Date().toDateString();
    const billDate = new Date(b.createdAt).toDateString();
    return billDate === today;
  });

  // تحسين حساب الطلبات المعلقة
  const pendingOrdersCount = orders.filter(o =>
    o.status === 'pending' ||
    o.status === 'preparing' ||
    o.status === 'ready'
  ).length;

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
      value: realTimeActiveSessions,
      icon: Clock,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      description: 'جلسات بلايستيشن وكمبيوتر نشطة'
    },
    {
      name: 'الطلبات المعلقة',
      value: realTimePendingOrders,
      icon: ShoppingCart,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700',
      description: `طلبات في انتظار التحضير أو جاهزة للتسليم (${ordersAnalysis.pending || 0} في الانتظار، ${ordersAnalysis.preparing || 0} قيد التحضير، ${ordersAnalysis.ready || 0} جاهزة) - إجمالي: ${actualPendingOrders.length}`
    },
    {
      name: 'مبيعات اليوم',
      value: `${todayRevenue.toLocaleString()} ج.م`,
      icon: DollarSign,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      description: 'إجمالي المبيعات اليوم'
    },
    {
      name: 'فواتير اليوم',
      value: todayOrders,
      icon: Receipt,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      description: 'عدد الفواتير المحدثة اليوم'
    }
  ];

  // Calculate current cost for active sessions
  const calculateCurrentCost = (session: any) => {
    if (session.status !== 'active') {
      return session.totalCost;
    }

    const now = new Date();
    const startTime = new Date(session.startTime);
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
      return Math.max(cost, 1); // Minimum 1 pound
    } else if (session.deviceType === 'computer') {
      const hourlyRate = 15;
      const minuteRate = hourlyRate / 60;
      const cost = Math.round(minutes * minuteRate);
      return Math.max(cost, 1); // Minimum 1 pound
    }

    return session.totalCost;
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-8 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-3">مرحباً بك في نظام Bomba</h1>
            <p className="text-primary-100 text-lg">لوحة تحكم شاملة لإدارة الطلبات والبلايستيشن</p>
            <div className="flex items-center mt-4 space-x-4 space-x-reverse">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 ml-2" />
                <span className="text-primary-100">
                  {new Date().toLocaleDateString('ar-EG', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <div className="flex items-center">
                <Clock className="h-5 w-5 ml-2" />
                <span className="text-primary-100">
                  {new Date().toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>
          <div className="hidden lg:flex items-center space-x-4 space-x-reverse">
            <button
              onClick={cleanData}
              disabled={loading}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 space-x-reverse"
            >
              <div className={`w-4 h-4 border-2 border-white border-t-transparent rounded-full ${loading ? 'animate-spin' : ''}`}></div>
              <span>تنظيف البيانات</span>
            </button>
            <button
              onClick={refreshDashboardData}
              disabled={loading}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 space-x-reverse"
            >
              <div className={`w-4 h-4 border-2 border-white border-t-transparent rounded-full ${loading ? 'animate-spin' : ''}`}></div>
              <span>تحديث البيانات</span>
            </button>
            <div className="w-24 h-24 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <BarChart3 className="h-12 w-12 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className={`${stat.bgColor} rounded-xl p-6 border border-gray-200 hover:shadow-md transition-all duration-300`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div className={`${stat.color} rounded-lg p-3 shadow-sm`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="mr-4">
                    <p className="text-sm font-medium text-gray-600 mb-1">{stat.name}</p>
                    <p className={`text-2xl font-bold ${stat.textColor}`}>{stat.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active Sessions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Clock className="h-5 w-5 ml-2 text-blue-500" />
              الجلسات النشطة
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full mr-2">
                {activeSessions.length}
              </span>
            </h3>
          </div>
          <div className="p-6">
            {activeSessions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-lg font-medium">لا توجد جلسات نشطة حالياً</p>
                <p className="text-gray-400 text-sm mt-1">جميع الأجهزة متاحة للاستخدام</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeSessions.slice(0, 5).map((session) => {
                  const currentCost = calculateCurrentCost(session);
                  const startTime = new Date(session.startTime);
                  const now = new Date();
                  const durationMs = now.getTime() - startTime.getTime();
                  const hours = Math.floor(durationMs / (1000 * 60 * 60));
                  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

                  return (
                    <div key={session.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100 hover:shadow-sm transition-shadow duration-200">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          {session.deviceType.includes('PlayStation') || session.deviceType.includes('بلايستيشن') ? (
                            <Gamepad2 className="h-6 w-6 text-blue-600" />
                          ) : (
                            <Monitor className="h-6 w-6 text-blue-600" />
                          )}
                        </div>
                        <div className="mr-4">
                          <p className="font-semibold text-gray-900">{session.deviceName}</p>
                          <p className="text-sm text-gray-600">
                            بدأت: {startTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-xs text-blue-600 font-medium">
                            المدة: {hours > 0 ? `${hours}س ${minutes}د` : `${minutes}د`}
                            {session.deviceType === 'playstation' && session.controllers && (
                              <span className="mr-2">• {session.controllers} دراع</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-green-600 text-lg">{currentCost} ج.م</p>
                        <p className="text-xs text-gray-500">التكلفة الحالية</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <TrendingUp className="h-5 w-5 ml-2 text-green-500" />
              النشاط الأخير
              <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full mr-2">
                {Math.min(recentActivity.length, 5)}
              </span>
            </h3>
          </div>
          <div className="p-6">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-gray-500">لا يوجد نشاط حديث</p>
                <p className="text-gray-400 text-sm mt-1">سيظهر النشاط هنا عند بدء الجلسات أو الطلبات</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.slice(0, 5).map((activity) => {
                  const Icon = getActivityIcon(activity.icon);
                  return (
                    <div key={activity.id} className="flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors duration-200">
                      <div className={`w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center ${activity.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="mr-3 flex-1">
                        <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                        <p className="text-xs text-gray-500">{activity.time}</p>
                      </div>
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-violet-50">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <BarChart3 className="h-5 w-5 ml-2 text-purple-500" />
            حالة النظام
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <h4 className="font-semibold text-green-800 mb-1">النظام يعمل</h4>
              <p className="text-sm text-green-600">جميع الخدمات متاحة</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="font-semibold text-blue-800 mb-1">المستخدمون النشطون</h4>
              <p className="text-sm text-blue-600">
                {realTimeActiveSessions > 0 ? `${realTimeActiveSessions} جلسة نشطة` : 'لا توجد جلسات نشطة'}
              </p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <ShoppingCart className="h-6 w-6 text-orange-600" />
              </div>
              <h4 className="font-semibold text-orange-800 mb-1">الطلبات المعلقة</h4>
              <p className="text-sm text-orange-600">
                {realTimePendingOrders > 0 ? (
                  <>
                    {realTimePendingOrders} طلب في الانتظار أو جاهز
                    <br />
                    <span className="text-xs">
                      {ordersAnalysis.pending || 0} في الانتظار • {ordersAnalysis.preparing || 0} قيد التحضير • {ordersAnalysis.ready || 0} جاهزة
                    </span>
                    <br />
                    <span className="text-xs text-gray-500">
                      إجمالي محسوب: {actualPendingOrders.length}
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
