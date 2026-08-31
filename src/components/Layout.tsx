import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Home,
  Gamepad2,
  Monitor,
  ShoppingCart,
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
  Package2,
  CreditCard,
  DollarSign,
  ShoppingBag,
  ChefHat,
  Warehouse as WarehouseIcon,
  Table as TableIcon,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useTablesHeader } from '../context/TablesHeaderContext';
import { API_BASE_URL } from '../utils/apiBase';
import { useOrganization } from '../context/OrganizationContext';
import NotificationCenter from './NotificationCenter';
import PermissionGuard from './PermissionGuard';
import LanguageSwitcher from './LanguageSwitcher';
import ScrollButtons from './ScrollButtons';
import OccupiedTablesWarningModal from './OccupiedTablesWarningModal';
import { getOccupiedTablesCount, getOccupiedTablesNames } from '../utils/occupiedTablesHelper';

// عرف نوع read بشكل صحيح
interface NotificationRead {
  user: string;
  readAt: string;
}

const Layout = () => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const { formatDate: formatOrgDate } = useOrganization();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('sidebarCollapsed') === 'true'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed)); } catch {}
  }, [sidebarCollapsed]);
  const location = useLocation();
  const { user, logout, sessions, orders, notifications, subscriptionStatus } = useApp();
  const { tables } = useData();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const tablesHeader = useTablesHeader();
  const mainContentRef = useRef<HTMLElement>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);

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

  // حالة modal الطاولات المشغولة
  const [showOccupiedWarning, setShowOccupiedWarning] = useState(false);
  const [isConfirmingLogout, setIsConfirmingLogout] = useState(false);

  // الحد الأدنى للمسافة المطلوبة للسحب
  const minSwipeDistance = 50;

   // إخفاء الإشارة البصرية بعد 5 ثوانٍ
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSwipeIndicator(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // منع إغلاق المتصفح عند وجود طاولات مشغولة
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const occupiedCount = getOccupiedTablesCount(tables);
      if (occupiedCount > 0) {
        e.preventDefault();
        e.returnValue = t('tables.occupiedWarning.confirmClose') || 'There are occupied tables. Are you sure you want to close?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [tables, t]);

  // جلب معلومات الاشتراك
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/billing/subscription/status`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.subscription) {
            setSubscriptionInfo(data.subscription);
          }
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
      }
    };

    if (user) {
      fetchSubscription();
    }
  }, [user]);

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

    if (isMobile) {
      if (isRTL) {
        // RTL: السحب من اليمين إلى اليسار لفتح الـ sidebar
        if (isLeftSwipe && !sidebarOpen) {
          setSidebarOpen(true);
        }
        // RTL: السحب من اليسار إلى اليمين لإغلاق الـ sidebar
        else if (isRightSwipe && sidebarOpen) {
          setSidebarOpen(false);
        }
      } else {
        // LTR: السحب من اليسار إلى اليمين لفتح الـ sidebar
        if (isRightSwipe && !sidebarOpen) {
          setSidebarOpen(true);
        }
        // LTR: السحب من اليمين إلى اليسار لإغلاق الـ sidebar
        else if (isLeftSwipe && sidebarOpen) {
          setSidebarOpen(false);
        }
      }
    }
  };

  const navigation = [
    { name: t('nav.dashboard'), href: '/dashboard', icon: Home, permissions: ['dashboard'] },
    { name: t('nav.tables', 'الطاولات'), href: '/tables', icon: TableIcon, permissions: ['tables', 'cafe', 'billing'], badgePreparing: preparingOrders, badgeReady: readyOrders },
    {
      name: t('nav.devices'),
      icon: Server,
      permissions: ['playstation', 'computer'],
      children: [
        { name: t('nav.playstation'), href: '/playstation', icon: Gamepad2, permissions: ['playstation'], badge: activePlaystationSessions },
        { name: t('nav.computer'), href: '/computer', icon: Monitor, permissions: ['computer'], badge: activeComputerSessions },
      ]
    },
    { name: t('nav.menu'), href: '/menu', icon: Utensils, permissions: ['menu'] },
    { name: t('nav.reports'), href: '/reports', icon: BarChart3, permissions: ['reports'] },
    { name: t('nav.consumptionReport'), href: '/consumption-report', icon: Package2, permissions: ['reports'] },
    { name: t('nav.soldItems'), href: '/sold-items', icon: ShoppingBag, permissions: ['reports'] },
    { name: t('nav.inventory'), href: '/inventory', icon: Package, permissions: ['inventory'] },
    { name: t('nav.warehouse'), href: '/warehouse', icon: WarehouseIcon, permissions: ['warehouse'] },
    { name: t('nav.kitchenDisplay'), href: '/kitchen-display', icon: ChefHat, permissions: ['kitchenDisplay'] },
    { name: t('nav.costs'), href: '/costs', icon: Wallet, permissions: ['costs'] },
    { name: t('nav.payroll'), href: '/payroll', icon: DollarSign, permissions: ['users'] },
    { name: t('nav.users'), href: '/users', icon: Users, permissions: ['users'] },
    { name: t('nav.notifications'), href: '/notifications', icon: Bell, permissions: ['dashboard', 'playstation', 'computer', 'tables', 'cafe', 'menu', 'billing', 'reports', 'inventory', 'warehouse', 'costs', 'users', 'settings'], badge: unreadNotifications },
    { name: t('nav.subscriptions'), href: '/subscription', icon: CreditCard, permissions: ['dashboard', 'playstation', 'computer', 'cafe', 'menu', 'billing', 'reports', 'inventory', 'warehouse', 'costs', 'users', 'settings'] },
    { name: t('nav.settings'), href: '/settings', icon: Settings, permissions: ['settings'] },
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
    const occupiedCount = getOccupiedTablesCount(tables);
    
    if (occupiedCount > 0) {
      setShowOccupiedWarning(true);
      return;
    }
    
    setIsConfirmingLogout(true);
    try {
      await logout();
    } finally {
      setIsConfirmingLogout(false);
    }
  };

  const handleConfirmLogoutWithOccupied = async () => {
    setIsConfirmingLogout(true);
    try {
      await logout();
    } finally {
      setIsConfirmingLogout(false);
      setShowOccupiedWarning(false);
    }
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
          fixed inset-y-0 ${isRTL ? 'right-0' : 'left-0'} z-40 bg-white dark:bg-gray-950 shadow-lg transform transition-all duration-300 ease-in-out
          flex flex-col overflow-hidden
          ${sidebarCollapsed ? 'w-20' : 'w-64'}
          ${sidebarOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full')}
          lg:relative lg:translate-x-0 ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} lg:z-10
        `}
        style={{ direction: isRTL ? 'rtl' : 'ltr' }}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-3 bg-orange-600 dark:bg-orange-700 text-white flex-shrink-0">
          <div className={"flex items-center min-w-0 " + (sidebarCollapsed ? "justify-center w-full" : "")}>
            <ShoppingCart className={"h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0 " + (sidebarCollapsed ? "" : (isRTL ? "mr-2" : "ml-2"))} />
            {!sidebarCollapsed && <h1 className="text-lg sm:text-xl font-bold truncate ms-2">MTE Systems</h1>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden flex-shrink-0 p-1 hover:bg-white/20 rounded-lg"
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>
        {/* User Info - collapsed: icon only */}
        <div className={"border-b border-gray-200 dark:border-gray-700 flex-shrink-0 " + (sidebarCollapsed ? "p-2 flex flex-col items-center gap-2" : "p-3 sm:p-4")}>
          <div className={"flex items-center min-w-0 " + (sidebarCollapsed ? "flex-col gap-1" : "")}>
            <div className="flex-shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            {!sidebarCollapsed && (
              <>
                <div className={`${isRTL ? 'mr-2 sm:mr-3' : 'ml-2 sm:ml-3'} flex-1 min-w-0`}>
                  <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user?.role === 'admin' ? t('roles.admin') :
                     user?.role === 'staff' ? t('roles.staff') :
                     user?.role === 'cashier' ? t('roles.cashier') :
                     user?.role === 'kitchen' ? t('roles.kitchen') : t('roles.staff')}
                  </p>
                </div>
                <div className={`flex items-center ${isRTL ? 'space-x-1 space-x-reverse' : 'space-x-1'}`}>
                  <button
                    onClick={toggleDarkMode}
                    className="p-1 text-gray-400 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition-colors duration-200 flex-shrink-0"
                    title={isDarkMode ? t('theme.switchToLight') : t('theme.switchToDark')}
                  >
                    {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200 flex-shrink-0"
                    title={t('auth.logout')}
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
            {sidebarCollapsed && (
              <div className="flex flex-col gap-1 mt-1">
                <button onClick={toggleDarkMode} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" title={isDarkMode ? t('theme.switchToLight') : t('theme.switchToDark')}>
                  {isDarkMode ? <Sun className="h-4 w-4 text-gray-600 dark:text-gray-300" /> : <Moon className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
                </button>
                <button onClick={handleLogout} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" title={t('auth.logout')}>
                  <LogOut className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Navigation */}
        <nav className="mt-4 flex-1 overflow-y-auto pb-4">
          <div className="px-2 sm:px-3 space-y-1">
            {filteredNavigation.length === 0 ? (
              <div className="p-3 text-center">
                <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">{t('nav.noPages')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('nav.noPermissions')}</p>
              </div>
            ) : (
              filteredNavigation.map((item) => {
                if (item.name === t('nav.devices') && item.children) {
                  return (
                    <div key={item.name}>
                      <button
                        title={sidebarCollapsed ? item.name : undefined}
                        className={`group flex items-center w-full py-2 text-xs sm:text-sm font-medium rounded-md transition-colors duration-200 min-w-0 text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 ${devicesOpen ? `bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 ${isRTL ? 'border-r-4' : 'border-l-4'} border-orange-600` : ''} ${sidebarCollapsed ? 'justify-center px-2' : 'px-2 sm:px-3'}`}
                        onClick={() => setDevicesOpen((open) => !open)}
                      >
                        <item.icon className={`${sidebarCollapsed ? '' : (isRTL ? 'ml-2 sm:ml-3' : 'mr-2 sm:mr-3')} h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${sidebarCollapsed ? 'mx-auto' : ''}`} />
                        {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
                        {!sidebarCollapsed && (
                          <span className={isRTL ? 'ml-auto' : 'mr-auto'}>
                            <svg className={`w-4 h-4 transition-transform duration-200 ${devicesOpen ? 'transform rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        )}
                      </button>
                      {devicesOpen && (
                        <div className={sidebarCollapsed ? 'flex flex-col items-center gap-1 mt-1' : 'pl-6 space-y-1'}>
                          {item.children.map((child) => (
                            <PermissionGuard
                              key={child.name}
                              requiredPermissions={child.permissions}
                              showIfNoPermission={false}
                            >
                              <Link
                                to={child.href}
                                title={sidebarCollapsed ? child.name : undefined}
                                className={`${isActive(child.href)
                                    ? `bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 ${isRTL ? 'border-r-4' : 'border-l-4'} border-orange-600`
                                    : 'text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                                    } group flex items-center py-2 text-xs sm:text-sm font-medium rounded-md transition-colors duration-200 min-w-0 ${sidebarCollapsed ? 'justify-center px-2' : 'px-2 sm:px-3'}`}
                                onClick={() => setSidebarOpen(false)}
                              >
                                <child.icon className={`${sidebarCollapsed ? '' : (isRTL ? 'ml-2 sm:ml-3' : 'mr-2 sm:mr-3')} h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${sidebarCollapsed ? 'mx-auto' : ''}`} />
                                {!sidebarCollapsed && <span className="truncate">{child.name}</span>}
                                {!sidebarCollapsed && (child.badge ?? 0) > 0 && (
                                  <span className={`${isRTL ? 'ml-2' : 'mr-2'} inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white`}>
                                    {child.badge}
                                  </span>
                                )}
                                {sidebarCollapsed && (child.badge ?? 0) > 0 && (
                                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-950"></span>
                                )}
                              </Link>
                            </PermissionGuard>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                const Icon = item.icon;
                return (
                  <PermissionGuard
                    key={item.name}
                    requiredPermissions={item.permissions}
                    showIfNoPermission={false}
                  >
                    <Link
                      to={item.href}
                      title={sidebarCollapsed ? item.name : undefined}
                      className={`${isActive(item.href)
                        ? `bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 ${isRTL ? 'border-r-4' : 'border-l-4'} border-orange-600`
                        : 'text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                        } group flex items-center py-2 text-xs sm:text-sm font-medium rounded-md transition-colors duration-200 min-w-0 relative ${sidebarCollapsed ? 'justify-center px-2' : 'px-2 sm:px-3'}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className={`${sidebarCollapsed ? '' : (isRTL ? 'ml-2 sm:ml-3' : 'mr-2 sm:mr-3')} h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${sidebarCollapsed ? 'mx-auto' : ''}`} />
                      {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
                      {!sidebarCollapsed && (item.badge ?? 0) > 0 && (
                        <span className={`${isRTL ? 'ml-2' : 'mr-2'} inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white`}>
                          {item.badge}
                        </span>
                      )}
                      {sidebarCollapsed && (item.badge ?? 0) > 0 && (
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-gray-950"></span>
                      )}
                      {!sidebarCollapsed && Number(item.badgePreparing) > 0 && (
                        <span className={`${isRTL ? 'ml-1' : 'mr-1'} inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500 text-white`}>
                          {item.badgePreparing}
                        </span>
                      )}
                      {sidebarCollapsed && Number(item.badgePreparing) > 0 && (
                        <span className="absolute top-1 left-1 w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                      )}
                      {!sidebarCollapsed && Number(item.badgeReady) > 0 && (
                        <span className={`${isRTL ? 'ml-1' : 'mr-1'} inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-600 text-white`}>
                          {item.badgeReady}
                        </span>
                      )}
                      {sidebarCollapsed && Number(item.badgeReady) > 0 && (
                        <span className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-green-600 rounded-full"></span>
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
        {/* Subscription Warning Banner */}
        {subscriptionInfo && subscriptionStatus === 'active' && (() => {
          const endDate = new Date(subscriptionInfo.endDate);
          const now = new Date();
          const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysLeft <= 5 && daysLeft > 0) {
            return (
              <div className="bg-yellow-50 dark:bg-yellow-900 border-b-2 border-yellow-400 dark:border-yellow-600 px-4 py-3 flex items-center justify-between flex-wrap gap-2 fixed top-0 left-0 right-0 z-[60] lg:static">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      ⚠️ {t('subscription.warning', { days: daysLeft })}
                    </p>
                  </div>
                </div>
                <a
                  href="/subscription"
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-800 dark:text-yellow-100 dark:hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 flex-shrink-0"
                >
                  {t('subscription.renewNow')}
                </a>
              </div>
            );
          }
          return null;
        })()}
        
        {/* Top Bar */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0 fixed top-0 left-0 right-0 z-50 lg:static lg:z-auto"
          style={{
            top: subscriptionInfo && subscriptionStatus === 'active' && (() => {
              const endDate = new Date(subscriptionInfo.endDate);
              const now = new Date();
              const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              return daysLeft <= 5 && daysLeft > 0 ? '52px' : '0';
            })()
          }}
        >
          <div
            className="flex items-center justify-between h-16 px-4 sm:px-6 flex-wrap xs:flex-col xs:items-start xs:gap-2 xs:h-auto"
          >
            <div className="flex items-center min-w-0 xs:w-full xs:mb-2 xs:justify-between">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-md hover:bg-orange-50 dark:hover:bg-orange-900/20 flex-shrink-0"
              >
                <Menu className="h-6 w-6 text-gray-900 dark:text-gray-100" />
              </button>
              <button
                onClick={() => setSidebarCollapsed(v => !v)}
                className="hidden lg:flex p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0 ms-1"
                title={sidebarCollapsed ? "????? ?????? ???????" : "?? ?????? ??????? - ??????? ???"}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5 text-gray-700 dark:text-gray-300" /> : <PanelLeftClose className="h-5 w-5 text-gray-700 dark:text-gray-300" />}
              </button>
              <h2 className="mr-2 sm:mr-4 text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 truncate xs:text-base xs:mr-0 xs:w-full xs:text-center">
                {filteredNavigation.find(item => isActive(item.href))?.name ||
                 (filteredNavigation.length === 0 ? t('nav.noPages') : t('nav.dashboard'))}
              </h2>
              {/* إشارة بصرية للسحب على الشاشات الصغيرة */}
              {showSwipeIndicator && (
                <div className="lg:hidden flex items-center mr-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="mr-1">{t('nav.swipeToOpen')}</span>
                  <div className="w-1 h-1 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4 space-x-reverse flex-shrink-0 xs:w-full xs:justify-center xs:mt-2">
              {tablesHeader.actions && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={tablesHeader.actions.openManagement}
                    className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors text-sm">
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('cafe.manageTables')}</span>
                  </button>
                  <button onClick={tablesHeader.actions.toggleFullscreen}
                    className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 p-2 rounded-lg flex items-center transition-colors" title={tablesHeader.actions.isFullscreen ? 'إنهاء الشاشة الكاملة' : 'شاشة كاملة'}>
                    {tablesHeader.actions.isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </button>
                  <button onClick={tablesHeader.actions.refresh}
                    className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors text-sm" title={t('cafe.refresh')}>
                    <RefreshCw className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('cafe.refresh')}</span>
                  </button>
                </div>
              )}
              <LanguageSwitcher />
              <PermissionGuard requiredPermissions={['dashboard', 'playstation', 'computer', 'cafe', 'menu', 'billing', 'reports', 'inventory', 'costs', 'users', 'settings']}>
                <NotificationCenter />
              </PermissionGuard>
              <div className="hidden sm:block text-sm text-gray-500 dark:text-gray-400">
                {formatOrgDate(new Date(), {
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
          <div className="px-4 sm:px-6 py-2 w-full">
            <Outlet />
          </div>
        </main>
      </div>
      <ScrollButtons mainContentRef={mainContentRef} />
      
      {/* Occupied Tables Warning Modal */}
      <OccupiedTablesWarningModal
        isOpen={showOccupiedWarning}
        occupiedTablesCount={getOccupiedTablesCount(tables)}
        occupiedTablesNames={getOccupiedTablesNames(tables)}
        onConfirm={handleConfirmLogoutWithOccupied}
        onCancel={() => setShowOccupiedWarning(false)}
        isLoading={isConfirmingLogout}
        actionType="logout"
      />
    </div>
  );
};

export default Layout;