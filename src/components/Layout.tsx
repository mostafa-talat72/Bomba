import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Home,
  Gamepad2,
  Monitor,
  ShoppingCart,
  Receipt,
  BarChart3,
  Package,
  Wallet,
  Users,
  Settings,
  Menu,
  X,
  User,
  LogOut,
  Utensils,
  Bell,
  Server,
  Moon,
  Sun,
  Package2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import NotificationCenter from './NotificationCenter';
import PermissionGuard from './PermissionGuard';
import ScrollButtons from './ScrollButtons';

// عرف نوع read بشكل صحيح
interface NotificationRead {
  user: string;
  readAt: string;
}

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout, sessions, orders, notifications } = useApp();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const mainContentRef = useRef<HTMLElement>(null);

  // حساب عدد الجلسات النشطة لكل نوع
  const activePlaystationSessions = sessions.filter(s => s.status === 'active' && s.deviceType === 'playstation').length;
  const activeComputerSessions = sessions.filter(s => s.status === 'active' && s.deviceType === 'computer').length;
  // عدد الإشعارات غير المقروءة
  const unreadNotifications = notifications.filter(n => !n.readBy || !n.readBy.some((read: NotificationRead) => read.user === user?.id)).length;
  // عدد الطلبات قيد التجهيز (pending/preparing)
  const preparingOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing').length;
  // عدد الطلبات الجاهزة للتسليم (ready)
  const readyOrders = orders.filter(o => o.status === 'ready').length;

  // متغيرات للسحب
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [showSwipeIndicator, setShowSwipeIndicator] = useState(true);

  // الحد الأدنى للمسافة المطلوبة للسحب
  const minSwipeDistance = 50;

  // إخفاء الإشارة البصرية بعد 5 ثوانٍ
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSwipeIndicator(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    // التحقق من أن الشاشة صغيرة (mobile)
    const isMobile = window.innerWidth < 1024; // lg breakpoint

    // إذا كان السحب من اليمين إلى اليسار (فتح الـ sidebar) - فقط على الشاشات الصغيرة
    if (isLeftSwipe && !sidebarOpen && isMobile) {
      setSidebarOpen(true);
    }
    // إذا كان السحب من اليسار إلى اليمين (إغلاق الـ sidebar) - فقط على الشاشات الصغيرة
    else if (isRightSwipe && sidebarOpen && isMobile) {
      setSidebarOpen(false);
    }
  };

  const navigation = [
    { name: 'لوحة التحكم', href: '/dashboard', icon: Home, permissions: ['dashboard'] },
    { name: 'الطلبات', href: '/cafe', icon: ShoppingCart, permissions: ['cafe'], badgePreparing: preparingOrders, badgeReady: readyOrders },
    { name: 'الفواتير', href: '/billing', icon: Receipt, permissions: ['billing'] },
    {
      name: 'الأجهزة',
      icon: Server,
      permissions: ['playstation', 'computer'],
      children: [
        { name: 'البلايستيشن', href: '/playstation', icon: Gamepad2, permissions: ['playstation'], badge: activePlaystationSessions },
        { name: 'الكمبيوتر', href: '/computer', icon: Monitor, permissions: ['computer'], badge: activeComputerSessions },
      ]
    },
    { name: 'المنيو', href: '/menu', icon: Utensils, permissions: ['menu'] },
    { name: 'التقارير', href: '/reports', icon: BarChart3, permissions: ['reports'] },
    { name: 'تقرير الاستهلاك', href: '/consumption-report', icon: Package2, permissions: ['reports'] },
    { name: 'المخزون', href: '/inventory', icon: Package, permissions: ['inventory'] },
    { name: 'التكاليف', href: '/costs', icon: Wallet, permissions: ['costs'] },
    { name: 'المستخدمين', href: '/users', icon: Users, permissions: ['users'] },
    { name: 'الإشعارات', href: '/notifications', icon: Bell, permissions: ['dashboard', 'playstation', 'computer', 'cafe', 'menu', 'billing', 'reports', 'inventory', 'costs', 'users', 'settings'], badge: unreadNotifications },
    { name: 'الإعدادات', href: '/settings', icon: Settings, permissions: ['settings'] },
  ];

  const isActive = (href: string) => location.pathname === href;

  // Reset scroll position when route changes
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  // Filter navigation items based on user permissions
  const getFilteredNavigation = () => {
    if (!user) return [];

    return navigation.filter(item => {
      if (user.permissions.includes('all')) return true;
      return item.permissions.some(permission => user.permissions.includes(permission));
    });
  };

  const filteredNavigation = getFilteredNavigation();

  const handleLogout = async () => {
    await logout();
  };

  // حالة فتح قائمة الأجهزة
  const [devicesOpen, setDevicesOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 relative overflow-hidden container-responsive">
      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 dark:bg-opacity-70 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 right-0 z-40 w-64 bg-white dark:bg-gray-950 shadow-lg transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
          lg:translate-x-0 lg:static lg:inset-0 lg:w-64 lg:z-10
        `}
        style={{ direction: 'rtl' }}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-4 sm:px-6 bg-orange-600 dark:bg-orange-700 text-white flex-shrink-0">
          <div className="flex items-center min-w-0">
            <ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8 mr-2 sm:mr-3 flex-shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold truncate">Bomba</h1>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden flex-shrink-0"
          >
            <X className="h-6 w-6 text-white" />
          </button>
        </div>
        {/* User Info */}
        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center min-w-0">
                          <div className="flex-shrink-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            <div className="mr-2 sm:mr-3 flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user?.role === 'admin' ? 'مدير' :
                 user?.role === 'staff' ? 'موظف' :
                 user?.role === 'cashier' ? 'كاشير' :
                 user?.role === 'kitchen' ? 'مطبخ' : 'موظف'}
              </p>
            </div>
            <div className="flex items-center space-x-1 space-x-reverse">
              <button
                onClick={toggleDarkMode}
                className="p-1 text-gray-400 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition-colors duration-200 flex-shrink-0"
                title={isDarkMode ? "التبديل إلى الوضع النهاري" : "التبديل إلى الوضع الليلي"}
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                onClick={handleLogout}
                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200 flex-shrink-0"
                title="تسجيل الخروج"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        {/* Navigation */}
        <nav className="mt-4 flex-1 overflow-y-auto">
          <div className="px-2 sm:px-3 space-y-1">
            {filteredNavigation.length === 0 ? (
              <div className="p-3 text-center">
                <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">لا توجد صفحات متاحة</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">لم يتم منحك أي صلاحيات</p>
              </div>
            ) : (
              filteredNavigation.map((item) => {
                // إذا كان عنصر الأجهزة
                if (item.name === 'الأجهزة' && item.children) {
                  return (
                    <div key={item.name}>
                      <button
                        className={`group flex items-center w-full px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors duration-200 min-w-0 text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 ${devicesOpen ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-r-4 border-orange-600' : ''}`}
                        onClick={() => setDevicesOpen((open) => !open)}
                      >
                        <item.icon className="ml-2 sm:ml-3 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                        <span className="truncate">{item.name}</span>
                        <span className="ml-auto">
                          <svg className={`w-4 h-4 transition-transform duration-200 ${devicesOpen ? 'transform rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </button>
                      {devicesOpen && (
                        <div className="pl-6 space-y-1">
                          {item.children.map((child) => (
                            <PermissionGuard
                              key={child.name}
                              requiredPermissions={child.permissions}
                              showIfNoPermission={false}
                            >
                                                              <Link
                                  to={child.href}
                                  className={`${isActive(child.href)
                                    ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-r-4 border-orange-600'
                                    : 'text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                                    } group flex items-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors duration-200 min-w-0`}
                                  onClick={() => setSidebarOpen(false)}
                                >
                                <child.icon className="ml-2 sm:ml-3 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                                <span className="truncate">{child.name}</span>
                                {(child.badge ?? 0) > 0 && (
                                  <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                                    {child.badge}
                                  </span>
                                )}
                              </Link>
                            </PermissionGuard>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                // العناصر العادية
                const Icon = item.icon;
                return (
                  <PermissionGuard
                    key={item.name}
                    requiredPermissions={item.permissions}
                    showIfNoPermission={false}
                  >
                    <Link
                      to={item.href}
                      className={`${isActive(item.href)
                        ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-r-4 border-orange-600'
                        : 'text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                        } group flex items-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors duration-200 min-w-0`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className="ml-2 sm:ml-3 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                      <span className="truncate">{item.name}</span>
                      {(item.badge ?? 0) > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                          {item.badge}
                        </span>
                      )}
                      {Number(item.badgePreparing) > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500 text-white">
                          {item.badgePreparing}
                        </span>
                      )}
                      {Number(item.badgeReady) > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-600 text-white">
                          {item.badgeReady}
                        </span>
                      )}
                    </Link>
                  </PermissionGuard>
                );
              })
            )}
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0 fixed top-0 left-0 right-0 z-50 lg:static lg:z-auto">
          <div
            className="flex items-center justify-between h-16 px-4 sm:px-6 flex-wrap xs:flex-col xs:items-start xs:gap-2 xs:h-auto"
          >
            <div className="flex items-center min-w-0 xs:w-full xs:mb-2 xs:justify-between">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md hover:bg-orange-50 dark:hover:bg-orange-900/20 flex-shrink-0"
              >
                <Menu className="h-6 w-6 text-gray-900 dark:text-gray-100" />
              </button>
              <h2 className="mr-2 sm:mr-4 text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 truncate xs:text-base xs:mr-0 xs:w-full xs:text-center">
                {filteredNavigation.find(item => isActive(item.href))?.name ||
                 (filteredNavigation.length === 0 ? 'لا توجد صفحات متاحة' : 'لوحة التحكم')}
              </h2>
              {/* إشارة بصرية للسحب على الشاشات الصغيرة */}
              {showSwipeIndicator && (
                <div className="lg:hidden flex items-center mr-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="mr-1">← اسحب لفتح القائمة</span>
                  <div className="w-1 h-1 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4 space-x-reverse flex-shrink-0 xs:w-full xs:justify-center xs:mt-2">
              <PermissionGuard requiredPermissions={['dashboard', 'playstation', 'computer', 'cafe', 'menu', 'billing', 'reports', 'inventory', 'costs', 'users', 'settings']}>
                <NotificationCenter />
              </PermissionGuard>
              <div className="hidden sm:block text-sm text-gray-500 dark:text-gray-400">
                {new Date().toLocaleDateString('ar-EG', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main
          ref={mainContentRef}
          className="flex-1 overflow-auto min-w-0 container-responsive lg:pt-0 pt-16 bg-gray-50 dark:bg-gray-900"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="p-4 sm:p-6 w-full">
            <Outlet />
          </div>
        </main>
      </div>
      <ScrollButtons mainContentRef={mainContentRef} />
    </div>
  );
};

export default Layout;
