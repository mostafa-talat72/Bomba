import React from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const HomeRedirect: React.FC = () => {
  const { user } = useApp();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // التحقق من صلاحيات المستخدم
  const userPermissions = user.permissions || [];

  // ترتيب الصفحات حسب الأولوية
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

  // البحث عن أول صفحة متاحة للمستخدم
  const accessiblePage = pagePriority.find(page =>
    userPermissions.includes('all') || userPermissions.includes(page.permission)
  );

  if (accessiblePage) {
    return <Navigate to={accessiblePage.path} replace />;
  } else {
    // إذا لم يكن لديه أي صلاحيات، اعرض رسالة خطأ
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">لا توجد صلاحيات متاحة</h2>
          <p className="text-gray-600 mb-4">لم يتم منحك أي صلاحيات للوصول إلى النظام</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }
};

export default HomeRedirect;
