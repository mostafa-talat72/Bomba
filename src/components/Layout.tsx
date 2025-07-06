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
  Bell,
  User,
  LogOut,
  Utensils
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useApp();

  const navigation = [
    { name: 'لوحة التحكم', href: '/dashboard', icon: Home },
    { name: 'البلايستيشن', href: '/playstation', icon: Gamepad2 },
    { name: 'الكمبيوتر', href: '/computer', icon: Monitor },
    { name: 'الكافيه', href: '/cafe', icon: Coffee },
    { name: 'المنيو', href: '/menu', icon: Utensils },
    { name: 'الفواتير', href: '/billing', icon: Receipt },
    { name: 'التقارير', href: '/reports', icon: BarChart3 },
    { name: 'المخزون', href: '/inventory', icon: Package },
    { name: 'التكاليف', href: '/costs', icon: Wallet },
    { name: 'المستخدمين', href: '/users', icon: Users },
    { name: 'الإعدادات', href: '/settings', icon: Settings },
  ];

  const isActive = (href: string) => location.pathname === href;

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex h-screen bg-gray-50 relative">
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
          lg:translate-x-0 lg:static lg:inset-0
        `}
        style={{ direction: 'rtl' }}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-6 bg-primary-600 text-white">
          <div className="flex items-center">
            <Coffee className="h-8 w-8 mr-3" />
            <h1 className="text-xl font-bold">Bastira</h1>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-primary-600" />
              </div>
            </div>
            <div className="mr-3 flex-1">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">
                {user?.role === 'admin' ? 'مدير' : 'موظف'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors duration-200"
              title="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-4 flex-1">
          <div className="px-3 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`${isActive(item.href)
                    ? 'bg-primary-50 text-primary-700 border-r-4 border-primary-600'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    } group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="ml-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md hover:bg-gray-100"
              >
                <Menu className="h-6 w-6" />
              </button>
              <h2 className="mr-4 text-xl font-semibold text-gray-900">
                {navigation.find(item => isActive(item.href))?.name || 'لوحة التحكم'}
              </h2>
            </div>

            <div className="flex items-center space-x-4 space-x-reverse">
              <button className="p-2 rounded-full hover:bg-gray-100 relative">
                <Bell className="h-5 w-5 text-gray-500" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
              </button>
              <div className="text-sm text-gray-500">
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
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
