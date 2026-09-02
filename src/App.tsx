import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConfigProvider } from 'antd';
import arEG from 'antd/locale/ar_EG';
import enUS from 'antd/locale/en_US';
import frFR from 'antd/locale/fr_FR';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { OrganizationProvider } from './context/OrganizationContext';
import { TablesHeaderProvider } from './context/TablesHeaderContext';
import Layout from './components/Layout';
import ToastManager from './components/ToastManager';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Register from './pages/Register';
import EmailActions from './pages/EmailActions';
import HomeRedirect from './components/HomeRedirect';

// ── Code Splitting: تحميل الصفحات عند الطلب لتسريع الإقلاع ──────────────────
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PlayStation = lazy(() => import('./pages/PlayStation'));
const Computer = lazy(() => import('./pages/Computer'));
const Menu = lazy(() => import('./pages/Menu'));
const Tables = lazy(() => import('./pages/Tables'));
const BillView = lazy(() => import('./pages/BillView'));
const Reports = lazy(() => import('./pages/Reports'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Costs = lazy(() => import('./pages/Costs'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));
const NotificationManagement = lazy(() => import('./pages/NotificationManagement'));
const Subscription = lazy(() => import('./pages/Subscription'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const ConsumptionReport = lazy(() => import('./pages/ConsumptionReport'));
const Payroll = lazy(() => import('./pages/Payroll'));
const SoldItems = lazy(() => import('./pages/SoldItems'));
const Warehouse = lazy(() => import('./pages/Warehouse'));
const KitchenDisplay = lazy(() => import('./pages/KitchenDisplay'));
const CustomerMenu = lazy(() => import('./pages/CustomerMenu'));

// شاشة تحميل أثناء تقسيم الحزم
const PageLoader = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-300">جارٍ التحميل...</p>
    </div>
  </div>
);

// Restore focus after parent click handlers trigger a render.
const EditableFocusGuard = () => {
  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const editable = target.closest('input, textarea, select, [contenteditable="true"]');
      if (!(editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement ||
        editable instanceof HTMLSelectElement || editable.isContentEditable)) {
        return;
      }
      if (editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement) {
        if (editable.disabled || editable.readOnly) return;
      }
      if (editable instanceof HTMLSelectElement && editable.disabled) return;

      requestAnimationFrame(() => {
        if (document.activeElement !== editable && document.contains(editable)) {
          editable.focus({ preventScroll: true });
        }
      });
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, []);

  return null;
};

// مكون للتحقق من الصلاحيات وحماية المسارات
const ExitGuard = () => {
  const { user, tables, bills, sessions } = useApp();

  const hasOccupiedTables = React.useMemo(() => {
    if (!user || !Array.isArray(tables) || tables.length === 0) {
      return false;
    }

    const activeStatuses = new Set(['occupied', 'reserved']);
    const tableIdsWithActiveStatus = new Set(
      tables
        .filter((table: any) => table && table.isActive !== false && activeStatuses.has(String(table.status || '').toLowerCase()))
        .map((table: any) => String(table._id || table.id))
    );

    const hasOpenBill = Array.isArray(bills) && bills.some((bill: any) => {
      const tableId = bill?.table?._id || bill?.table || bill?.tableId;
      if (!tableId) return false;
      const billStatus = String(bill?.status || '').toLowerCase();
      return !['paid', 'cancelled'].includes(billStatus) && (!tableId || tableIdsWithActiveStatus.has(String(tableId)) || !Array.isArray(tables) || tables.some((table: any) => String(table._id || table.id) === String(tableId)) );
    });

    const hasActiveSession = Array.isArray(sessions) && sessions.some((session: any) => {
      const status = String(session?.status || '').toLowerCase();
      const tableId = session?.table?._id || session?.table || session?.tableId;
      if (status !== 'active' || !tableId) return false;
      return tables.some((table: any) => String(table._id || table.id) === String(tableId));
    });

    return tableIdsWithActiveStatus.size > 0 || hasOpenBill || hasActiveSession;
  }, [user, tables, bills, sessions]);

  React.useEffect(() => {
    try {
      sessionStorage.setItem('bombaExitGuard', String(Boolean(user && hasOccupiedTables)));
    } catch {}

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!user || !hasOccupiedTables) return;
      event.preventDefault();
      event.returnValue = 'توجد طاولات مشغولة، هل تريد الخروج؟';
      return 'توجد طاولات مشغولة، هل تريد الخروج؟';
    };

    const handlePageHide = (event: PageTransitionEvent) => {
      if (!user || !hasOccupiedTables) return;
      event.preventDefault();
      (event as any).returnValue = 'توجد طاولات مشغولة، هل تريد الخروج؟';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [user, hasOccupiedTables]);

  return null;
};

const ProtectedRoute = ({ children, requiredPermissions = [], requiredRole }: {
  children: React.ReactNode;
  requiredPermissions?: string[];
  requiredRole?: string;
}) => {
  const { user, isAuthenticated, isLoading } = useApp();
  if (isLoading) return <PageLoader />;

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
        { path: '/tables', permission: 'tables' },
        { path: '/tables', permission: 'cafe' },
        { path: '/tables', permission: 'billing' },
        { path: '/menu', permission: 'menu' },
        { path: '/reports', permission: 'reports' },
        { path: '/inventory', permission: 'inventory' },
        { path: '/warehouse', permission: 'warehouse' },
        { path: '/kitchen-display', permission: 'kitchenDisplay' },
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
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();

  // Get Ant Design locale based on current language
  const getAntdLocale = () => {
    switch (i18n.language) {
      case 'ar':
        return arEG;
      case 'fr':
        return frFR;
      default:
        return enUS;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <ConfigProvider
      locale={getAntdLocale()}
      direction={isRTL ? 'rtl' : 'ltr'}
      getPopupContainer={(node) => {
        // If node has a parent, use it; otherwise use document.body
        if (node && node.parentElement) {
          return node.parentElement;
        }
        return document.body;
      }}
    >
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* صفحات عامة متاحة دائماً */}
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/bill/:billId" element={<BillView />} />
      <Route path="/menu-view" element={<CustomerMenu />} />
              <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/email-actions" element={<EmailActions />} />
        {/* صفحات النظام — محمية عبر ProtectedRoute */}
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
          <Route path="tables" element={
            <ProtectedRoute requiredPermissions={['tables', 'cafe', 'billing']}>
              <Tables />
            </ProtectedRoute>
          } />
          <Route path="menu" element={
            <ProtectedRoute requiredPermissions={['menu']}>
              <Menu />
            </ProtectedRoute>
          } />
          <Route path="reports" element={
            <ProtectedRoute requiredPermissions={['reports']}>
              <Reports />
            </ProtectedRoute>
          } />
          <Route path="consumption-report" element={
            <ProtectedRoute requiredPermissions={['reports']}>
              <ConsumptionReport />
            </ProtectedRoute>
          } />
          <Route path="sold-items" element={
            <ProtectedRoute requiredPermissions={['soldItems']}>
              <SoldItems />
            </ProtectedRoute>
          } />
          <Route path="warehouse" element={
            <ProtectedRoute requiredPermissions={['warehouse']}>
              <Warehouse />
            </ProtectedRoute>
          } />
          <Route path="kitchen-display" element={
            <ProtectedRoute requiredPermissions={['kitchenDisplay']}>
              <KitchenDisplay />
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
          <Route path="payroll" element={
            <ProtectedRoute requiredPermissions={['users']}>
              <Payroll />
            </ProtectedRoute>
          } />
          <Route path="users" element={
            <ProtectedRoute requiredPermissions={['users']}>
              <Users />
            </ProtectedRoute>
          } />
          <Route path="settings" element={
            <ProtectedRoute requiredPermissions={[]}>
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="notifications" element={
            <ProtectedRoute requiredPermissions={['dashboard', 'playstation', 'computer', 'tables', 'cafe', 'menu', 'billing', 'reports', 'inventory', 'warehouse', 'costs', 'users', 'settings']}>
              <NotificationManagement />
            </ProtectedRoute>
          } />
          <Route path="/subscription" element={<Subscription />} />
        </Route>
      {/* fallback — يوجه حسب حالة الدخول */}
              <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />} />
    </Routes>
    </Suspense>
    </ConfigProvider>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <LanguageProvider>
          <ThemeProvider>
            <AppProvider>
                <EditableFocusGuard />
              <OrganizationProvider>
                <TablesHeaderProvider>
                <ToastManager>
                  <ExitGuard />
                  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-cairo container-responsive">
                    <RouteHandler />
                  </div>
                </ToastManager>
                </TablesHeaderProvider>
              </OrganizationProvider>
            </AppProvider>
          </ThemeProvider>
        </LanguageProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
