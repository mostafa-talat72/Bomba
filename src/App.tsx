import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import ToastManager from './components/ToastManager';
import Login from './pages/Login';
import Register from './pages/Register';
import EmailActions from './pages/EmailActions';
import HomeRedirect from './components/HomeRedirect';

import Dashboard from './pages/Dashboard';
import PlayStation from './pages/PlayStation';
import Computer from './pages/Computer';
import Cafe from './pages/Cafe';
import Menu from './pages/Menu';
import Billing from './pages/Billing';
import BillView from './pages/BillView';
import Reports from './pages/Reports';
import Inventory from './pages/Inventory';
import Costs from './pages/Costs';
import Users from './pages/Users';
import Settings from './pages/Settings';
import NotificationManagement from './pages/NotificationManagement';
import Subscription from './pages/Subscription';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';

// مكون للتحقق من الصلاحيات وحماية المسارات
const ProtectedRoute = ({ children, requiredPermissions = [], requiredRole }: {
  children: React.ReactNode;
  requiredPermissions?: string[];
  requiredRole?: string;
}) => {
  const { user, isAuthenticated } = useApp();

  // السماح دائماً بصفحة إعادة تعيين كلمة المرور
  if (window.location.pathname.startsWith('/reset-password')) {
    return <>{children}</>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // التحقق من الصلاحية
  if (requiredPermissions.length > 0) {
    const hasPermission = user.permissions.includes('all') ||
                         requiredPermissions.some(permission => user.permissions.includes(permission));
    if (!hasPermission) {
      // البحث عن أول صفحة متاحة للمستخدم
      const userPermissions = user.permissions || [];
      const pagePriority = [
        { path: '/dashboard', permission: 'dashboard' },
        { path: '/playstation', permission: 'playstation' },
        { path: '/computer', permission: 'computer' },
        { path: '/cafe', permission: 'cafe' },
        { path: '/menu', permission: 'menu' },
        { path: '/billing', permission: 'billing' },
        { path: '/reports', permission: 'reports' },
        { path: '/inventory', permission: 'inventory' },
        { path: '/costs', permission: 'costs' },
        { path: '/users', permission: 'users' },
        { path: '/settings', permission: 'settings' },
      ];

      const accessiblePage = pagePriority.find(page =>
        userPermissions.includes('all') || userPermissions.includes(page.permission)
      );

      if (accessiblePage) {
        return <Navigate to={accessiblePage.path} replace />;
      } else {
        // إذا لم يكن لديه أي صلاحيات، اعرض رسالة خطأ
        return (
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">لا توجد صلاحيات متاحة</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">لم يتم منحك أي صلاحيات للوصول إلى النظام</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                إعادة المحاولة
              </button>
            </div>
          </div>
        );
      }
    }
  }

  // التحقق من الدور
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// مكون للتحقق من المسار الحالي
const RouteHandler = () => {
  const { isAuthenticated, isLoading } = useApp();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* صفحات عامة متاحة دائماً */}
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/bill/:billId" element={<BillView />} />
              <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/email-actions" element={<EmailActions />} />
        <Route path="/" element={<Login />} />
      {/* صفحات النظام المحمية فقط إذا كان المستخدم مسجل دخول */}
      {isAuthenticated && (
        <Route path="/" element={<Layout />}>
          <Route index element={<HomeRedirect />} />
          <Route path="dashboard" element={
            <ProtectedRoute requiredPermissions={['dashboard']}>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="playstation" element={
            <ProtectedRoute requiredPermissions={['playstation']}>
              <PlayStation />
            </ProtectedRoute>
          } />
          <Route path="computer" element={
            <ProtectedRoute requiredPermissions={['computer']}>
              <Computer />
            </ProtectedRoute>
          } />
          <Route path="cafe" element={
            <ProtectedRoute requiredPermissions={['cafe']}>
              <Cafe />
            </ProtectedRoute>
          } />
          <Route path="menu" element={
            <ProtectedRoute requiredPermissions={['menu']}>
              <Menu />
            </ProtectedRoute>
          } />
          <Route path="billing" element={
            <ProtectedRoute requiredPermissions={['billing']}>
              <Billing />
            </ProtectedRoute>
          } />
          <Route path="reports" element={
            <ProtectedRoute requiredPermissions={['reports']}>
              <Reports />
            </ProtectedRoute>
          } />
          <Route path="inventory" element={
            <ProtectedRoute requiredPermissions={['inventory']}>
              <Inventory />
            </ProtectedRoute>
          } />
          <Route path="costs" element={
            <ProtectedRoute requiredPermissions={['costs']}>
              <Costs />
            </ProtectedRoute>
          } />
          <Route path="users" element={
            <ProtectedRoute requiredPermissions={['users']}>
              <Users />
            </ProtectedRoute>
          } />
          <Route path="settings" element={
            <ProtectedRoute requiredPermissions={['settings']}>
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="notifications" element={
            <ProtectedRoute requiredPermissions={['dashboard', 'playstation', 'computer', 'cafe', 'menu', 'billing', 'reports', 'inventory', 'costs', 'users', 'settings']}>
              <NotificationManagement />
            </ProtectedRoute>
          } />
          <Route path="/subscription" element={<Subscription />} />
        </Route>
      )}
      {/* fallback */}
              <Route path="*" element={<Login />} />
    </Routes>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AppProvider>
        <ThemeProvider>
          <ToastManager>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-cairo container-responsive">
              <RouteHandler />
            </div>
          </ToastManager>
        </ThemeProvider>
      </AppProvider>
    </BrowserRouter>
  );
};

export default App;
