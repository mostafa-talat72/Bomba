import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import LoginForm from './components/LoginForm';
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

// مكون للتحقق من المسار الحالي
const RouteHandler = () => {
  const { isAuthenticated, isLoading } = useApp();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // إذا كان المستخدم مسجل دخول، اعرض الصفحات المحمية
  if (isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="playstation" element={<PlayStation />} />
          <Route path="computer" element={<Computer />} />
          <Route path="cafe" element={<Cafe />} />
          <Route path="menu" element={<Menu />} />
          <Route path="billing" element={<Billing />} />
          <Route path="reports" element={<Reports />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="costs" element={<Costs />} />
          <Route path="users" element={<Users />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Public route for bill viewing - متاح للجميع */}
        <Route path="/bill/:billId" element={<BillView />} />
      </Routes>
    );
  }

  // إذا لم يكن المستخدم مسجل دخول، اعرض الصفحات العامة فقط
  return (
    <Routes>
      {/* Public route for bill viewing - متاح للجميع */}
      <Route path="/bill/:billId" element={<BillView />} />

      {/* Login route */}
      <Route path="*" element={<LoginForm />} />
    </Routes>
  );
};

const AppContent = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 font-cairo">
        <RouteHandler />
      </div>
    </BrowserRouter>
  );
};

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
