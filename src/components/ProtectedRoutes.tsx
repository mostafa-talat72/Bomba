import React, { lazy } from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import HomeRedirect from './HomeRedirect';
import Takeaway from '../pages/Takeaway';
import Delivery from '../pages/Delivery';

// ── Code Splitting: نفس تقسيم الحزم في App — الصفحات تُحمّل عند الطلب ──
const Dashboard = lazy(() => import('../pages/Dashboard'));
const PlayStation = lazy(() => import('../pages/PlayStation'));
const Computer = lazy(() => import('../pages/Computer'));
const Menu = lazy(() => import('../pages/Menu'));
const Tables = lazy(() => import('../pages/Tables'));
const Reports = lazy(() => import('../pages/Reports'));
const Inventory = lazy(() => import('../pages/Inventory'));
const Costs = lazy(() => import('../pages/Costs'));
const Users = lazy(() => import('../pages/Users'));
const Settings = lazy(() => import('../pages/Settings'));
const NotificationManagement = lazy(() => import('../pages/NotificationManagement'));
const Subscription = lazy(() => import('../pages/Subscription'));
const ConsumptionReport = lazy(() => import('../pages/ConsumptionReport'));
const Bills = lazy(() => import('../pages/Bills'));
const Customers = lazy(() => import('../pages/Customers'));
const Payroll = lazy(() => import('../pages/Payroll'));
const SoldItems = lazy(() => import('../pages/SoldItems'));
const Warehouse = lazy(() => import('../pages/Warehouse'));
const KitchenDisplay = lazy(() => import('../pages/KitchenDisplay'));
const SyncStatus = lazy(() => import('../pages/SyncStatus'));
const AuditLogPage = lazy(() => import('../pages/AuditLog'));
const Shifts = lazy(() => import('../pages/Shifts'));

/**
 * الراوتات المحمية — نفس تعريف App حرفيًا، مستخرجة لمشاركتها بين
 * راوتر التطبيق وتبويبات الديسكتوب (إبقاء حي).
 * ملاحظة: عنصر Fragment جاهز (وليس مكونًا) لأن <Routes> يرفض المكونات المخصصة.
 */
const protectedRoutes = (
  <>
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
    <Route path="takeaway" element={
      <ProtectedRoute requiredPermissions={['tables', 'cafe', 'billing', 'takeaway']}>
        <Takeaway />
      </ProtectedRoute>
    } />
    <Route path="delivery" element={
      <ProtectedRoute requiredPermissions={['tables', 'cafe', 'billing', 'delivery']}>
        <Delivery />
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
      <ProtectedRoute requiredPermissions={['reports', 'consumption']}>
        <ConsumptionReport />
      </ProtectedRoute>
    } />
    <Route path="bills" element={
      <ProtectedRoute requiredPermissions={['bills']}>
        <Bills />
      </ProtectedRoute>
    } />
    <Route path="customers" element={
      <ProtectedRoute requiredPermissions={['customers']}>
        <Customers />
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
      <ProtectedRoute requiredPermissions={['users', 'payroll']}>
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
    <Route path="sync-status" element={
      <ProtectedRoute requiredPermissions={['syncStatus']}>
        <SyncStatus />
      </ProtectedRoute>
    } />
    <Route path="audit-log" element={
      <ProtectedRoute requiredPermissions={['auditLog']}>
        <AuditLogPage />
      </ProtectedRoute>
    } />
    <Route path="shifts" element={
      <ProtectedRoute requiredPermissions={['shifts']}>
        <Shifts />
      </ProtectedRoute>
    } />
    <Route path="notifications" element={
      <ProtectedRoute requiredPermissions={['dashboard', 'playstation', 'computer', 'tables', 'cafe', 'menu', 'billing', 'reports', 'inventory', 'warehouse', 'costs', 'users', 'settings', 'notifications']}>
        <NotificationManagement />
      </ProtectedRoute>
    } />
    <Route path="/subscription" element={
      <ProtectedRoute requiredPermissions={['subscription']}>
        <Subscription />
      </ProtectedRoute>
    } />
  </>
);

export default protectedRoutes;
