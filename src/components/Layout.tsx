import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Home,
  Gamepad2,
  Monitor,
  Coffee,
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
  Bell
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import NotificationCenter from './NotificationCenter';
import PermissionGuard from './PermissionGuard';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout, sessions, orders, notifications } = useApp();

  // حساب عدد الجلسات النشطة لكل نوع
  const activePlaystationSessions = sessions.filter(s => s.status === 'active' && s.deviceType === 'playstation').length;
  const activeComputerSessions = sessions.filter(s => s.status === 'active' && s.deviceType === 'computer').length;
  // عدد الإشعارات غير المقروءة
  const unreadNotifications = notifications.filter(n => !n.read).length;
  // عدد الطلبات قيد التجهيز (pending/preparing)
  const preparingOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing').length;
  // عدد الطلبات الجاهزة للتسليم (ready)
  const readyOrders = orders.filter(o => o.status === 'ready').length;

  const navigation = [
    { name: 'لوحة التحكم', href: '/dashboard', icon: Home, permissions: ['dashboard'] },
    { name: 'البلايستيشن', href: '/playstation', icon: Gamepad2, permissions: ['playstation'], badge: activePlaystationSessions },
    { name: 'الكمبيوتر', href: '/computer', icon: Monitor, permissions: ['computer'], badge: activeComputerSessions },
    { name: 'الكافيه', href: '/cafe', icon: Coffee, permissions: ['cafe'], badgePreparing: preparingOrders, badgeReady: readyOrders },
    { name: 'المنيو', href: '/menu', icon: Utensils, permissions: ['menu'] },
    { name: 'الفواتير', href: '/billing', icon: Receipt, permissions: ['billing'] },
    { name: 'التقارير', href: '/reports', icon: BarChart3, permissions: ['reports'] },
    { name: 'المخزون', href: '/inventory', icon: Package, permissions: ['inventory'] },
    { name: 'التكاليف', href: '/costs', icon: Wallet, permissions: ['costs'] },
    { name: 'المستخدمين', href: '/users', icon: Users, permissions: ['users'] },
    { name: 'الإشعارات', href: '/notifications', icon: Bell, permissions: ['dashboard', 'playstation', 'computer', 'cafe', 'menu', 'billing', 'reports', 'inventory', 'costs', 'users', 'settings'], badge: unreadNotifications },
    { name: 'الإعدادات', href: '/settings', icon: Settings, permissions: ['settings'] },
  ];

  const isActive = (href: string) => location.pathname === href;

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

  return (
    <div className="flex h-screen bg-gray-50 relative overflow-hidden container-responsive">
      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 right-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
          lg:translate-x-0 lg:static lg:inset-0 lg:w-64
        `}
        style={{ direction: 'rtl' }}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-4 sm:px-6 bg-primary-600 text-white flex-shrink-0">
          <div className="flex items-center min-w-0">
            <Coffee className="h-6 w-6 sm:h-8 sm:w-8 mr-2 sm:mr-3 flex-shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold truncate">Bomba</h1>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden flex-shrink-0"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* User Info */}
        <div className="p-3 sm:p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center min-w-0">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
              </div>
            </div>
            <div className="mr-2 sm:mr-3 flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">
                {user?.role === 'admin' ? 'مدير' :
                 user?.role === 'staff' ? 'موظف' :
                 user?.role === 'cashier' ? 'كاشير' :
                 user?.role === 'kitchen' ? 'مطبخ' : 'موظف'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors duration-200 flex-shrink-0"
              title="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-4 flex-1 overflow-y-auto">
          <div className="px-2 sm:px-3 space-y-1">
            {filteredNavigation.length === 0 ? (
              <div className="p-3 text-center">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <p className="text-xs text-red-600 font-medium">لا توجد صفحات متاحة</p>
                <p className="text-xs text-gray-500 mt-1">لم يتم منحك أي صلاحيات</p>
              </div>
            ) : (
              filteredNavigation.map((item) => {
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
                        ? 'bg-primary-50 text-primary-700 border-r-4 border-primary-600'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        } group flex items-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors duration-200 min-w-0`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className="ml-2 sm:ml-3 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                      <span className="truncate">{item.name}</span>
                      {/* Badge: إشعارات، بلايستيشن، كمبيوتر */}
                      {(item.badge ?? 0) > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                          {item.badge}
                        </span>
                      )}
                      {/* عدادات الكافيه */}
                      {item.name === 'الكافيه' && (item.badgePreparing ?? 0) > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500 text-white">
                          {item.badgePreparing}
                        </span>
                      )}
                      {item.name === 'الكافيه' && (item.badgeReady ?? 0) > 0 && (
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
        <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <div className="flex items-center min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md hover:bg-gray-100 flex-shrink-0"
              >
                <Menu className="h-6 w-6" />
              </button>
              <h2 className="mr-2 sm:mr-4 text-lg sm:text-xl font-semibold text-gray-900 truncate">
                {filteredNavigation.find(item => isActive(item.href))?.name ||
                 (filteredNavigation.length === 0 ? 'لا توجد صفحات متاحة' : 'لوحة التحكم')}
              </h2>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4 space-x-reverse flex-shrink-0">
              <PermissionGuard requiredPermissions={['dashboard', 'playstation', 'computer', 'cafe', 'menu', 'billing', 'reports', 'inventory', 'costs', 'users', 'settings']}>
                <NotificationCenter />
              </PermissionGuard>
              <div className="hidden sm:block text-sm text-gray-500">
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
        <main className="flex-1 overflow-auto min-w-0 container-responsive">
          <div className="p-4 sm:p-6 w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
