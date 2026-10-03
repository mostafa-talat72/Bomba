import React from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import appIcon from '../assets/app-icon.png';

// شاشة تحميل أثناء تقسيم الحزم
export const PageLoader = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
    <div className="text-center">
      <img src={appIcon} alt="MTE Systems" className="w-20 h-20 rounded-3xl shadow-lg object-contain mx-auto mb-4 animate-spin" style={{ animationDuration: '2.5s' }} />
      <p className="text-gray-600 dark:text-gray-300">جارٍ التحميل...</p>
    </div>
  </div>
);

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

  // التحقق من الصلاحية (دور المدير يتجاوز الكل مثل permissionHelper)
  if (requiredPermissions.length > 0) {
    const hasPermission = user.role === 'admin' ||
                         user.permissions.includes('all') ||
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
        { path: '/takeaway', permission: 'takeaway' },
        { path: '/delivery', permission: 'delivery' },
        { path: '/menu', permission: 'menu' },
        { path: '/reports', permission: 'reports' },
        { path: '/consumption-report', permission: 'consumption' },
        { path: '/bills', permission: 'bills' },
        { path: '/customers', permission: 'customers' },
        { path: '/sold-items', permission: 'soldItems' },
        { path: '/kitchen-display', permission: 'kitchenDisplay' },
        { path: '/inventory', permission: 'inventory' },
        { path: '/warehouse', permission: 'warehouse' },
        { path: '/kitchen-display', permission: 'kitchenDisplay' },
        { path: '/costs', permission: 'costs' },
        { path: '/users', permission: 'users' },
        { path: '/payroll', permission: 'payroll' },
        { path: '/settings', permission: 'settings' },
        { path: '/subscription', permission: 'subscription' },
        { path: '/notifications', permission: 'notifications' },
        { path: '/shifts', permission: 'shifts' },
        { path: '/audit-log', permission: 'auditLog' },
        { path: '/sync-status', permission: 'syncStatus' },
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

export default ProtectedRoute;
