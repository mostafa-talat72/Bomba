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
import { TabsProvider } from './context/TabsContext';
import api from './services/api';
import { openCashDrawerThroughAgent } from './utils/localPrintBridge';
import Layout from './components/Layout';
import ToastManager from './components/ToastManager';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Register from './pages/Register';
import EmailActions from './pages/EmailActions';
import ProtectedRoute, { PageLoader } from './components/ProtectedRoute';
import protectedRoutes from './components/ProtectedRoutes';

// ── Code Splitting: تحميل الصفحات العامة عند الطلب (المحمية في ProtectedRoutes) ──
const BillView = lazy(() => import('./pages/BillView'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const CustomerMenu = lazy(() => import('./pages/CustomerMenu'));

// ⚡ كاش إعدادات F12: أول ضغطة تجهزه، وبعده الدرج يفتح لحظياً بدون أي fetch.
let f12OrgCache: { data: any; expiresAt: number } | null = null;
let f12LastAt = 0;
const getF12Organization = async (): Promise<any> => {
  if (f12OrgCache && f12OrgCache.expiresAt > Date.now()) return f12OrgCache.data;
  const organizationResponse = await api.getOrganization();
  const organization = organizationResponse.success ? organizationResponse.data : null;
  if (organization) f12OrgCache = { data: organization, expiresAt: Date.now() + 60000 };
  return organization;
};

const CashDrawerShortcut = () => {
  React.useEffect(() => {
    // Warm the cache at startup so the FIRST F12 press is already instant.
    getF12Organization().catch(() => {});
    const handleKeyDown = (event: KeyboardEvent) => {
      const isF12 = event.key === 'F12' || event.code === 'F12' || (event as any).keyCode === 123;
      if (!isF12) return;
      if (event.repeat) return;
      const now = Date.now();
      if (now - f12LastAt < 3000) return;
      f12LastAt = now;
      event.preventDefault();
      event.stopPropagation();

      // Fire instantly — never block the keypress on network.
      void (async () => {
        try {
          const organization = await getF12Organization();
          if (!organization || organization.printSettings?.openCashDrawerShortcut === false) return;

          // 1) Try local print agent first (USB printer attached to this PC).
          try {
            const { requestDrawerOpen } = await import('./utils/drawer');
            const opened = await requestDrawerOpen('f12', undefined, { organization } as any);
            if (opened) return;
          } catch {}

          // 2) Fallback to backend (configured printer)
          try {
            const result = await api.openCashDrawerOnly(organization);
            if ((result as any)?.success) return;
          } catch {}

          // 3) Last resort: auto-detect printer on server
          try {
            await api.autoDetectAndOpenCashDrawer('payment', organization);
          } catch (error) {
            console.error('Failed to open cash drawer with F12:', error);
          }
        } catch (error) {
          console.error('Failed to open cash drawer with F12:', error);
        }
      })();
    };

    // capture phase so we run before other handlers / browser default
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  return null;
};

// Restore focus after parent click handlers trigger a render.
const EditableFocusGuard = () => {
  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const editable = target.closest<HTMLElement>('input, textarea, select, [contenteditable="true"]');
      if (!editable || !(editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement ||
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
      return !['paid', 'cancelled'].includes(billStatus) && tableIdsWithActiveStatus.has(String(tableId));
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
      let logoutInProgress = false;
      try {
        logoutInProgress = sessionStorage.getItem('bombaLogoutInProgress') === 'true';
      } catch {
        // Continue with the in-memory guard when session storage is unavailable.
      }
      if (!user || !hasOccupiedTables || logoutInProgress) return;
      event.preventDefault();
      event.returnValue = 'توجد طاولات مشغولة، هل تريد الخروج؟';
      return 'توجد طاولات مشغولة، هل تريد الخروج؟';
    };

    const handlePageHide = (event: PageTransitionEvent) => {
      let logoutInProgress = false;
      try {
        logoutInProgress = sessionStorage.getItem('bombaLogoutInProgress') === 'true';
      } catch {
        // Continue with the in-memory guard when session storage is unavailable.
      }
      if (!user || !hasOccupiedTables || logoutInProgress) return;
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

// (نُقل ProtectedRoute وPageLoader إلى components/ProtectedRoute.tsx)

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

  const isPublicPath =
    window.location.pathname === '/login' ||
    window.location.pathname === '/register' ||
    window.location.pathname.startsWith('/verify-email') ||
    window.location.pathname.startsWith('/reset-password') ||
    window.location.pathname.startsWith('/email-actions') ||
    window.location.pathname === '/menu-view' ||
    /^\/bill\/[a-fA-F0-9]{24}$/.test(window.location.pathname);

  if (isLoading && !isPublicPath) {
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
        <Route path="/" element={<TabsProvider><Layout /></TabsProvider>}>
          {protectedRoutes}
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
                  <CashDrawerShortcut />
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
