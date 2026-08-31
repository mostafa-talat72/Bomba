import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ShoppingCart, Plus, Minus, Edit, Trash2, X, Printer,
  Settings, AlertTriangle, Search, CheckCircle, DollarSign,
  Calendar, User, Receipt, QrCode, Table as TableIcon, Eye, EyeOff,
  Gamepad2, ChevronDown, ChevronUp, ChefHat,
  Clock, History, FileText, Zap, Layers
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import { useOrganization } from '../context/OrganizationContext';
import { useTablesHeader } from '../context/TablesHeaderContext';
import { MenuItem, MenuSection, MenuCategory, TableSection, Table, Order, Bill, Session } from '../services/api';
import { api } from '../services/api';
import { formatCurrency as formatCurrencyUtil, formatDecimal } from '../utils/formatters';
import { formatTime } from '../utils/dateHelpers';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { printOrder } from '../utils/printOrder';
import { printBill } from '../utils/printBill';
import { aggregateItemsWithPayments, getItemIdsForAggregatedItem } from '../utils/billAggregation';
import { useBillAggregation } from '../hooks/useBillAggregation';
import {
  canAddOrder, canEditOrder, canDeleteOrder,
  canPartialPayment, canPayFullBill, canDeleteBill,
  canEditSessionTime, canEditPartialPayment
} from '../utils/permissionHelper';
import PermissionDenied from '../components/PermissionDenied';
import ConfirmModal from '../components/ConfirmModal';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../utils/apiBase';
import '../styles/billing-animations.css';
import TableButton from '../components/tables/TableButton';
import PlaystationBillItem from '../components/tables/PlaystationBillItem';
import { ItemCard, OrderItemRow } from '../components/tables/OrderItems';
import { getTableDisplay, getAgeLabel, getTableAgeColor, formatCurrencyArabic } from '../components/tables/tableHelpers';
import type { LocalOrderItem } from '../components/tables/tableHelpers';
import ModalPortal from '../components/ModalPortal';
import UndoBar, { UndoRequest } from '../components/UndoBar';
import { playWarnBeep, playDangerBeep, isSoundEnabled, setSoundEnabled } from '../utils/sound';
import BillItemsEditModal from '../components/tables/BillItemsEditModal';
import PriceEditModal from '../components/tables/PriceEditModal';
import { canEditItemPrice } from '../utils/permissionHelper';

// ─── Memoized sub-components مستخرجة إلى src/components/tables/ ─────────────

const EMPTY_BILLS: Bill[] = [];
const EMPTY_ORDERS_COUNT = 0;

// ─── تحميل متأخر لنوافذ الدفع الثقيلة (يقلل الحزمة الأولية ويسرّع فتح الصفحة) ──
// ملفوفة بـ memo لتجنب إعادة الرسم بلا داعٍ عند كل render للصفحة
const PartialPaymentModal = React.lazy(() => import('../components/PartialPaymentModal'));
const PaymentManagementModal = React.lazy(() => import('../components/tables/PaymentManagementModal'));

// ─── Main Component ─────────────────────────────────────────────────────────
const Tables: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const { formatDate, formatDateTime } = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    tableSections, tables, fetchTableSections, fetchTables,
    menuItems, menuSections, menuCategories,
    fetchAvailableMenuItems, fetchMenuSections, fetchMenuCategories,
    showNotification, createOrder, updateOrder, deleteOrder,
    getTableStatus: getTableStatusFromContext,
    createTableSection, updateTableSection, deleteTableSection,
    createTable, updateTable, deleteTable,
    bills, fetchBills, setBills, orders, fetchOrders, setOrders, user,
    cancelBill, addPartialPayment,
  } = useApp() as any;

  const socketRef = useRef<Socket | null>(null);
  const selectedBillRef = useRef<Bill | null>(null);
  const selectedTableRef = useRef<Table | null>(null);
  const tablesRef = useRef<Table[]>(tables);
  const hasLoadedDataRef = useRef(false);

  // ── Unified modal state ──────────────────────────────────────────────────
  const [showUnifiedTableModal, setShowUnifiedTableModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'billing'>('orders');

  // ── Orders state ─────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tableOrders, setTableOrders] = useState<Order[]>([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showEditOrderModal, setShowEditOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [pinnedOrder, setPinnedOrder] = useState<Order | null>(null);
  const previewOrder = pinnedOrder;
  const [currentOrderItems, setCurrentOrderItems] = useState<LocalOrderItem[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [orderNotes, setOrderNotes] = useState('');  const [showManagementModal, setShowManagementModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [editingSection, setEditingSection] = useState<TableSection | null>(null);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [sectionFormData, setSectionFormData] = useState({ name: '', description: '', sortOrder: 0 });
  const [tableFormData, setTableFormData] = useState({ number: '', section: '' });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<{
    title: string; message: string; onConfirm: () => void;
    confirmText?: string; cancelText?: string; confirmColor?: string;
  } | null>(null);

  // ── Billing state ────────────────────────────────────────────────────────
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPartialPaymentModal, setShowPartialPaymentModal] = useState(false);
  const [showSessionEndModal, setShowSessionEndModal] = useState(false);
  const [sessionToEnd, setSessionToEnd] = useState<string | null>(null);
  const [customerNameForEndSession, setCustomerNameForEndSession] = useState('');
  const [showChangeTableModal, setShowChangeTableModal] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState<string | null>(null);
  const [tableChangeSearch, setTableChangeSearch] = useState('');
  const [isChangingTable, setIsChangingTable] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [originalAmount, setOriginalAmount] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [playstationStatusFilter, setPlaystationStatusFilter] = useState('unpaid');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState('');
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [showPayFullBillConfirmModal, setShowPayFullBillConfirmModal] = useState(false);
  const [showSessionPaymentConfirmModal, setShowSessionPaymentConfirmModal] = useState(false);
  const [billToPayFull, setBillToPayFull] = useState<Bill | null>(null);
  const [sessionToPayData, setSessionToPayData] = useState<{ session: Session; amount: string; method: 'cash' | 'card' | 'transfer' } | null>(null);
  const [isCancelingBill, setIsCancelingBill] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isProcessingPartialPayment, setIsProcessingPartialPayment] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [tableBillsFilter, setTableBillsFilter] = useState('unpaid');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Bill[] | null>(null);
  const [billTypeFilter] = useState<'all' | 'cafe' | 'playstation' | 'computer'>('all');
  const [playstationSearchQuery, setPlaystationSearchQuery] = useState('');
  const [gamingDeviceTypeFilter, setGamingDeviceTypeFilter] = useState<'all' | 'playstation' | 'computer'>('all');
  const [isPlaystationSectionCollapsed, setIsPlaystationSectionCollapsed] = useState(false);
  const [collapsedDevices, setCollapsedDevices] = useState<Set<string>>(new Set());
  const [showSessionPaymentModal, setShowSessionPaymentModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionPaymentAmount, setSessionPaymentAmount] = useState('');
  const [sessionPaymentMethod, setSessionPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [isProcessingSessionPayment, setIsProcessingSessionPayment] = useState(false);
  const [showPaidAmount, setShowPaidAmount] = useState(false);
  const [showRemainingAmount, setShowRemainingAmount] = useState(false);
  const [showEditSessionTimeModal, setShowEditSessionTimeModal] = useState(false);
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState<{ session: Session; payment: any; paymentIndex: number } | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [editPaymentReference, setEditPaymentReference] = useState('');
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [showEditItemPaymentModal, setShowEditItemPaymentModal] = useState(false);
  const [itemPaymentToEdit, setItemPaymentToEdit] = useState<{ itemPayment: any; payment: any; paymentIndex: number; itemPaymentId: string; } | null>(null);
  const [editItemPaymentAmount, setEditItemPaymentAmount] = useState('');
  const [editItemPaymentMethod, setEditItemPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [editItemPaymentReference, setEditItemPaymentReference] = useState('');
  const [isEditingItemPayment, setIsEditingItemPayment] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<Session | null>(null);
  const [editSessionStartTime, setEditSessionStartTime] = useState('');
  const [editSessionEndTime, setEditSessionEndTime] = useState('');
  const [isEditingSessionTime, setIsEditingSessionTime] = useState(false);
  const [showEditControllersPeriodModal, setShowEditControllersPeriodModal] = useState(false);
  const [periodToEdit, setPeriodToEdit] = useState<any>(null);
  const [periodIndex, setPeriodIndex] = useState<number>(-1);
  const [editPeriodStartTime, setEditPeriodStartTime] = useState('');
  const [editPeriodEndTime, setEditPeriodEndTime] = useState('');
  const [isEditingPeriod, setIsEditingPeriod] = useState(false);
  // tableBillsMap و tableStatuses أصبحا مشتقّين من tableDataMap useMemo

  // ── New Enhancement State ─────────────────────────────────────────────────
  // #3 - Payment success animation
  const [showPaymentSuccessAnim, setShowPaymentSuccessAnim] = useState(false);

  // #4 - Quick add item popover
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickAddTable, setQuickAddTable] = useState<Table | null>(null);
  const [quickAddItems, setQuickAddItems] = useState<LocalOrderItem[]>([]);
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);

  // #6 - Section filter tabs
  const [activeSectionFilter, setActiveSectionFilter] = useState<string>('all');

  // عند تغيير فلتر القسم يبدأ العرض من أول الصفحة
  const scrollToTop = () => {
    if (isFullscreen) return;
    const doScroll = () => {
      const main = document.querySelector('main');
      const targets = [main, document.documentElement, document.body];
      targets.forEach(t => {
        if (!t) return;
        try {
          if (typeof t.scrollTo === 'function') t.scrollTo({ top: 0, left: 0, behavior: 'auto' });
          else t.scrollTop = 0;
        } catch { t.scrollTop = 0; }
      });
      try { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch { /* ignore */ }
    };
    doScroll();
    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 100);
  };

  // اسم قسم الطاولة للطباعة (يميز الطاولات المكررة الرقم عبر الأقسام)
  const getTableSectionName = (table: any): string => {
    if (!table) return '';
    const tid = String(table._id || table.id || '');
    let t = table;
    if (tid) {
      const found = tables.find(x => String((x as any)._id || (x as any).id) === tid);
      if (found) t = found;
    }
    const sec = typeof t.section === 'object'
      ? (t.section as any)?.name
      : tableSections.find((s: any) => s._id === t.section || s.id === t.section)?.name;
    return sec || '';
  };

  // معرّف قسم الطاولة (للمقارنة مع activeSectionFilter — يطابق s.id)
  const getTableSectionId = (table: any): string => {
    if (!table) return '';
    const raw = typeof table.section === 'object' ? (table.section as any)?._id || (table.section as any)?.id : table.section;
    if (raw === undefined || raw === null || raw === '') return '';
    const sec = tableSections.find((s: any) => s._id === raw || s.id === raw);
    return sec ? String(sec.id) : String(raw);
  };

  // #7 - Activity log tab
  const [activeTab3, setActiveTab3] = useState<'orders' | 'billing' | 'log' | 'sessions'>('orders');
  const [tableActivityLog, setTableActivityLog] = useState<Array<{type: string; message: string; time: Date; color: string}>>([]);

  // #8 - Drag & Drop in management modal (order tracking)
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);

  // #9 - Fullscreen mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  // #11 - Daily report modal
  const [showDailyReportModal, setShowDailyReportModal] = useState(false);
  const [isPrintingReport, setIsPrintingReport] = useState(false);

  // Bill aggregated edit modal
  const [showBillItemsEditModal, setShowBillItemsEditModal] = useState(false);
  const [billToEdit, setBillToEdit] = useState<Bill | null>(null);

  // Pay choice modal
  const [showPayChoiceModal, setShowPayChoiceModal] = useState(false);
  const [payChoiceBill, setPayChoiceBill] = useState<Bill | null>(null);

  // Price edit modal (for item price override)
  const [showPriceEditModal, setShowPriceEditModal] = useState(false);
  const [priceEditItem, setPriceEditItem] = useState<{ index: number; item: LocalOrderItem } | null>(null);

  // ── useBillAggregation ───────────────────────────────────────────────────
  const { aggregatedItems: backendAggregatedItems, loading: aggregationLoading, refetch: refetchAggregatedItems } = useBillAggregation(selectedBill?.id || selectedBill?._id || null);

  // ── Refs sync ────────────────────────────────────────────────────────────
  useEffect(() => { selectedBillRef.current = selectedBill; }, [selectedBill]);
  useEffect(() => { selectedTableRef.current = selectedTable; }, [selectedTable]);
  useEffect(() => { tablesRef.current = tables; }, [tables]);

  // ── Modal scroll lock — useMemo لتجنب إعادة حساب في كل render ──────────
  const anyModalOpen = useMemo(() =>
    showOrderModal || showEditOrderModal || showManagementModal ||
    showSectionModal || showTableModal || showConfirmModal || showUnifiedTableModal ||
    showPaymentModal || showPartialPaymentModal || showSessionPaymentModal ||
    showQuickAddModal || showDailyReportModal || showBillItemsEditModal || showPayChoiceModal || showPriceEditModal,
  [showOrderModal, showEditOrderModal, showManagementModal, showSectionModal, showTableModal,
    showConfirmModal, showUnifiedTableModal, showPaymentModal, showPartialPaymentModal,
    showSessionPaymentModal, showQuickAddModal, showDailyReportModal, showBillItemsEditModal, showPayChoiceModal, showPriceEditModal]);
  useBodyScrollLock(anyModalOpen);

  // ── Permission check — useMemo لتجنب إعادة حساب في كل render ───────────
  const isManagerOrOwner = useMemo(() => {
    if (user?.role === 'admin') return true;
    if (user?.permissions?.includes('view_all_bills') || user?.permissions?.includes('admin') || user?.permissions?.includes('all')) return true;
    return false;
  }, [user?.role, user?.permissions]);

  // ── Cache constants ──────────────────────────────────────────────────────────
const TABLES_CACHE_KEY = 'tables_cache_v2';
const TABLES_CACHE_TTL = 10000; // 10 ثانية

function readTablesCache() {
  try {
    const raw = localStorage.getItem(TABLES_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > TABLES_CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function writeTablesCache(tables: any[], sections: any[]) {
  try {
    localStorage.setItem(TABLES_CACHE_KEY, JSON.stringify({ data: { tables, sections }, ts: Date.now() }));
  } catch {}
}

function invalidateTablesCache() {
  try { localStorage.removeItem(TABLES_CACHE_KEY); } catch {}
}

// ── Load initial data ────────────────────────────────────────────────────
const loadInitialData = async () => {
  setLoading(true);
  try {
    // قراءة الكاش فوراً للرسم الأولي (<50ms)
    const cached = readTablesCache();
    if (cached?.tables?.length) {
      setTables(cached.tables);
      setTableSections(cached.sections || []);
      setLoading(false);
    }
    // المرحلة 1 — الطاولات من السيرفر (30ms)
    await Promise.all([fetchTableSections(), fetchTables()]);
    setLoading(false);
    // تحديث الكاش بعد نجاح الجلب
    writeTablesCache(tables, tableSections);
    // المرحلة 2 — باقي البيانات في الخلفية
    Promise.all([
      fetchBills(),
      fetchOrders().catch(() => {}),
      fetchAvailableMenuItems(),
      fetchMenuSections(),
      fetchMenuCategories(),
    ]).catch(() => {});
  } catch {
    showNotification(t('cafe.notifications.loadingDataError'), 'error');
    setLoading(false);
  }
};

  useEffect(() => {
    if (!hasLoadedDataRef.current) {
      hasLoadedDataRef.current = true;
      loadInitialData();
    }
    return () => { hasLoadedDataRef.current = false; };
  }, []);


  // ── Table statuses + billsMap — دمج العمليتين في useMemo واحد بدلاً من useEffect مزدوج ──
  // يمنع double-scan و double-render عند كل تغيير في bills أو tables
  const tableDataMap = useMemo(() => {
    const statusMap: Record<string | number, { hasUnpaid: boolean; orders: Order[] }> = {};
    const billsMap: Record<string | number, { hasUnpaid: boolean; bills: Bill[] }> = {};

    if (tables.length === 0) return { statusMap, billsMap };

    // بناء index واحد: tableId -> bills (مرة واحدة فقط)
    const tidToBills = new Map<string, Bill[]>();
    bills.forEach((b: Bill) => {
      if (!b.table) return;
      const tid = ((b.table as any)._id || (b.table as any).id || b.table).toString();
      if (!tidToBills.has(tid)) tidToBills.set(tid, []);
      tidToBills.get(tid)!.push(b);
    });

    tables.forEach((table: Table) => {
      const tid = (table._id || (table as any).id).toString();
      const tBills = tidToBills.get(tid) || [];
      const billHasUnpaid = tBills.some(b => !['paid', 'cancelled'].includes(b.status));
      // تفاؤلي: قبل وصول bills استخدم Table.status (empty/occupied) ليظهر مشغول فوراً، بعد وصول bills اعتمد الفواتير
      const hasUnpaid = tBills.length > 0 ? billHasUnpaid : (table as any).status === 'occupied' || (table as any).status === 'reserved';
      statusMap[tid] = { hasUnpaid, orders: [] };
      billsMap[tid] = { hasUnpaid, bills: tBills };
    });

    return { statusMap, billsMap };
  }, [bills, tables]);

  // نشر النتائج — فقط مرة واحدة لكل تغيير
  const tableStatuses = tableDataMap.statusMap;
  const tableBillsMap  = tableDataMap.billsMap;

  // للتوافق مع الكود القديم الذي يستدعي fetchAllTableStatuses
  const fetchAllTableStatuses = useCallback(() => { /* no-op — tableDataMap يتحدث تلقائياً */ }, []);

  // ── Search bills ─────────────────────────────────────────────────────────
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) { setSearchResults(null); return; }
    const timer = setTimeout(async () => {
      try {
        const tableId = selectedTable?._id || (selectedTable as any)?.id;
        const response = await api.getBills({ q: query, table: tableId });
        setSearchResults(response.success ? (response.data || []) : null);
      } catch { setSearchResults(null); }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedTable]);

  // ── Update tableOrders ───────────────────────────────────────────────────
  useEffect(() => {
    if (selectedTable) {
      const tableId = selectedTable._id || (selectedTable as any).id;
      setTableOrders(orders.filter((o: any) => {
        const oid = o.table?._id || o.table?.id || o.table;
        return oid === tableId;
      }));
    }
  }, [selectedTable, orders]);

  // ── selectedBill sync ────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedBill && bills.length > 0 && !showPaymentModal && !showPartialPaymentModal && !showSessionPaymentModal) {
      const updated = bills.find((b: Bill) => b.id === selectedBill.id || b._id === selectedBill._id);
      // مقارنة بالـ paid/remaining بدل JSON.stringify الثقيل
      if (updated && (updated.paid !== selectedBill.paid || updated.remaining !== selectedBill.remaining || updated.status !== selectedBill.status)) {
        setSelectedBill(updated);
      }
    }
  }, [bills, selectedBill, showPaymentModal, showPartialPaymentModal, showSessionPaymentModal]);

  useEffect(() => {
    if (selectedBill && showPaymentModal && selectedBill.remaining !== undefined) {
      setPaymentAmount(selectedBill.remaining.toString());
      setOriginalAmount(selectedBill.remaining.toString());
    }
  }, [selectedBill?.remaining, selectedBill?.paid, selectedBill?.total, showPaymentModal]);

  useEffect(() => {
    if (selectedBill && (selectedBill.id || selectedBill._id)) refetchAggregatedItems();
  }, [selectedBill?.id, selectedBill?._id, selectedBill?.paid, selectedBill?.remaining]);

  // ── Active sessions state مستقر للـ interval ────────────────────────────
  // معرّفة قبل أول استخدام (كانت تحت تسبب ReferenceError قبل التهيئة)
  const hasActiveSession = useCallback((bill: Bill | null | undefined) =>
    bill?.sessions?.some((s: any) => (typeof s === 'object' ? s.status : null) === 'active') || false,
  []);

  // حساب التكلفة الفعلية للجلسة ( appending/updating للجلسات النشطة )
  const getSessionCost = useCallback((session: any): number => {
    if (!session) return 0;
    if (session.status !== 'active') {
      return Number(session.finalCost) || Number(session.totalCost) || 0;
    }
    // للجلسات النشطة: احسب من الأجهزة والوقت الفعلي
    const device = session.deviceId;
    if (!device || typeof device !== 'object') {
      return Number(session.finalCost) || Number(session.totalCost) || 0;
    }
    const startMs = session.startTime ? new Date(session.startTime).getTime() : 0;
    if (!startMs) return 0;
    const now = Date.now();
    const getRate = (controllers: number) => {
      if (device.type === 'playstation' && device.playstationRates) {
        return device.playstationRates[String(controllers)] || 0;
      }
      return device.hourlyRate || 0;
    };
    let total = 0;
    if (!session.controllersHistory || session.controllersHistory.length === 0) {
      const durMin = Math.max(0, (now - startMs)) / 60000;
      const rate = getRate(session.controllers || 1);
      total = (durMin * rate) / 60;
    } else {
      for (const period of session.controllersHistory) {
        const pEnd = period.to ? new Date(period.to).getTime() : now;
        const pStart = period.from ? new Date(period.from).getTime() : 0;
        if (pStart && pEnd > pStart) {
          const durMin = (pEnd - pStart) / 60000;
          const rate = getRate(period.controllers || 1);
          total += (durMin * rate) / 60;
        }
      }
    }
    return Math.round(total);
  }, []);

  const hasAnyActiveSession = useMemo(() =>
    bills.some(b => hasActiveSession(b)), [bills]);

  const fetchersRef = useRef({ fetchBills, fetchOrders });
  useEffect(() => { fetchersRef.current = { fetchBills, fetchOrders }; });

  // ── إعادة جلب موثقة — 250ms فقط (كان 800ms يسبب بطء ظهور التحديث على الطاولة)
  const pendingRefetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleBackgroundRefetch = useCallback((includeOrders = false) => {
    if (pendingRefetchRef.current) return;
    pendingRefetchRef.current = setTimeout(() => {
      pendingRefetchRef.current = null;
      const jobs: Promise<void>[] = [fetchersRef.current.fetchBills()];
      if (includeOrders) jobs.push(fetchersRef.current.fetchOrders());
      Promise.all(jobs).then(() => fetchAllTableStatuses()).catch(() => {});
    }, 250);
  }, []);

  // ── tick لحظي كل 10 ثوانٍ — يعمل فقط لو فيه جلسات نشطة (بلا fetch لتجنب الفيضان، السوكت هو المصدر الفوري)
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!hasAnyActiveSession) return;
    const id = setInterval(() => {
      setTick(t => t + 1);
    }, 10000);
    return () => clearInterval(id);
  }, [hasAnyActiveSession]);

  // السيرفر يحسب الفاتورة حية — لا نضيف delta هنا
  const liveSelectedBill = selectedBill;

  // ── بحث وفلتر كروت الطاولات ─────────────────────────────────────────────
  const [tableSearch, setTableSearch] = useState('');
  const [tableStatusFilter, setTableStatusFilter] = useState<'all' | 'occupied' | 'empty' | 'sessions'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastFocusedTableRef = useRef<Table | null>(null);

  // ── إدخال أرقام سريع (تحوّم على كارت ثم اكتب رقم) ──────────────────────
  const [quickDigits, setQuickDigits] = useState('');
  const quickDigitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quickDigitOpenRef = useRef<(digits: string) => void>(() => {});
  const quickTryOpenRef = useRef<(digits: string) => boolean>(() => false);
  const quickDigitDelayedRef = useRef(false);
  const [quickPickerTables, setQuickPickerTables] = useState<Table[] | null>(null);

  // ── شريط التراجع ─────────────────────────────────────────────────────────
  const [undoRequest, setUndoRequest] = useState<UndoRequest | null>(null);

  // ── تنبيه صوتي الجلسات الطويلة ───────────────────────────────────────────
  const [soundEnabled, setSoundEnabledState] = useState(isSoundEnabled());
  const isSoundEnabledRef = useRef(soundEnabled);
  useEffect(() => { isSoundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  // ── إنهاء كل جلسات الطاولة ───────────────────────────────────────────────
  const [endAllTarget, setEndAllTarget] = useState<{ table: Table; sessions: any[] } | null>(null);
  const [isEndingAll, setIsEndingAll] = useState(false);

  // ── إلحاح الجلسات النشطة لكل طاولة (تحذير 2 ساعات / خطر 3 ساعات) ────────
  const sessionUrgencyByTable = useMemo(() => {
    const m = new Map<string, { count: number; urgency: 'none' | 'warn' | 'danger'; sessions: any[]; billId?: string }>();
    bills.forEach(b => {
      (b.sessions || []).forEach((s: any) => {
        if (!s || s.status !== 'active') return;
        const tid = String((b.table as any)?._id || b.table || '');
        if (!tid) return;
        const durMin = s.startTime ? (Date.now() - new Date(s.startTime).getTime()) / 60000 : 0;
        const e = m.get(tid) || { count: 0, urgency: 'none' as const, sessions: [], billId: (b._id || b.id) as string | undefined };
        e.count++;
        e.sessions.push(s);
        if (durMin >= 180) e.urgency = 'danger';
        else if (durMin >= 120 && e.urgency !== 'danger') e.urgency = 'warn';
        m.set(tid, e);
      });
    });
    return m;
  }, [bills]);

  // تنبيه صوتي مرة واحدة عند دخول جلسة نطاق التحذير/الخطر
  const alertedSessionsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isSoundEnabledRef.current) return;
    bills.forEach(b => {
      (b.sessions || []).forEach((s: any) => {
        if (!s || s.status !== 'active' || !s.startTime) return;
        const sid = String(s._id || s.id || '');
        if (!sid || alertedSessionsRef.current.has(sid)) return;
        const durMin = (Date.now() - new Date(s.startTime).getTime()) / 60000;
        if (durMin >= 180) { alertedSessionsRef.current.add(sid); playDangerBeep(); }
        else if (durMin >= 120) { alertedSessionsRef.current.add(sid); playWarnBeep(); }
      });
    });
  }, [bills, tick]);

  // ── Socket.IO ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (socketRef.current) return;
    const socketUrl = API_BASE_URL.replace(/\/api\/?$/, '');
    const socket: Socket = io(socketUrl, {
        auth: { token: localStorage.getItem('token') || undefined },
      path: '/socket.io/', transports: ['websocket', 'polling'],
      reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    // إعادة الاتصال — جلب كل شيء من جديد
    socket.on('reconnect', () => {
      invalidateTablesCache();
      Promise.all([fetchBills(), fetchTables(), fetchOrders()]).then(() => fetchAllTableStatuses()).catch(() => {});
    });

    // ── تحديث الطلبات — DataContext هو المصدر الفوري بلا fetch مزدوج ──
    socket.on('order-update', (data: any) => {
      if (!['created', 'updated', 'deleted'].includes(data.type)) return;

      // تحديث tableOrders إذا كان مودال الطاولة مفتوحاً
      const cur = selectedTableRef.current;
      if (cur) {
        const tid = cur._id || (cur as any).id;
        // نبنّي tableOrders مؤقتاً من الـ orders المحدّثة بعد الفتش
        setTimeout(() => {
          setTableOrders(prev => {
            const all = (window as any).__latestOrders || prev;
            return all.filter((o: any) => {
              const oid = o.table?._id || o.table?.id || o.table;
              return oid === tid;
            });
          });
        }, 200);
      }
    });

    // ── تحديث الفواتير ────────────────────────────────────────────────────
    socket.on('bill-update', (data: any) => {
      if (!['created', 'updated', 'deleted', 'payment-received'].includes(data.type)) return;

      // إذا كان في data.bill — حدّث الـ state مباشرة بدون انتظار API
      if (data.bill) {
        // تحديث selectedBill إذا كانت مفتوحة
        const cur = selectedBillRef.current;
        if (cur && (data.bill._id === cur._id || data.bill.id === cur.id)) {
          setSelectedBill({ ...data.bill });
          if (data.bill.remaining !== undefined) {
            setPaymentAmount(data.bill.remaining.toString());
            setOriginalAmount(data.bill.remaining.toString());
          }
        }
        // tableStatuses useMemo يتحدث تلقائياً عبر DataContext بلا fetch مزدوج
      }
    });

    // ── دفعة مستلمة — تحديث فوري للـ selectedBill فقط، DataContext يحدّث القائمة ──
    socket.on('payment-received', (data: any) => {
      const cur = selectedBillRef.current;
      if (cur && data.bill && (data.bill._id === cur._id || data.bill.id === cur.id)) {
        setSelectedBill({ ...data.bill });
        if (data.bill.remaining !== undefined) {
          setPaymentAmount(data.bill.remaining.toString());
          setOriginalAmount(data.bill.remaining.toString());
        }
      }
    });

    // ── دفعة جزئية ──
    socket.on('partial-payment-received', (data: any) => {
      const cur = selectedBillRef.current;
      if (cur && data.bill && (data.bill._id === cur._id || data.bill.id === cur.id)) {
        setSelectedBill({ ...data.bill });
      }
    });

    // ── تحديث الجلسات — DataContext هو المصدر ──
    socket.on('session-update', (data: any) => {
      // تحديث selectedBill إذا كانت تحتوي هذه الجلسة
      const cur = selectedBillRef.current;
      if (cur && data.session) {
        const sessionId = data.session._id || data.session.id;
        const hasSession = cur.sessions?.some((s: any) => (s._id || s.id) === sessionId);
        if (hasSession) {
          api.getBill(cur._id || cur.id).then(r => { if (r?.data) setSelectedBill(r.data); }).catch(() => {});
        }
      }
    });

    // ── حالة الطاولة — tableStatuses useMemo يتحدث تلقائياً عند fetchBills ──
    socket.on('table-status-update', (_data: { tableId: string; status: string }) => {
      // لا حاجة لـ setTableStatuses يدوياً — يتحدث مع bills
    });

    // ── تحديث المخزون ────────────────────────────────────────────────────
    socket.on('inventory-update', () => { fetchAvailableMenuItems(); });

    return () => {
      if (import.meta.env.DEV) {
        ['reconnect', 'order-update', 'bill-update', 'payment-received', 'partial-payment-received',
         'table-status-update', 'session-update', 'inventory-update'].forEach(e => socket.off(e));
      } else {
        socket.disconnect();
      }
    };
  }, []);

  // ── فتح فوري عند رقم مكتمل يحدد طاولة واحدة فريدة (أو وحيدة في القسم الحالي) ──
  // لا يفتح مبكراً إذا كان الرقم الحالي بادئة لرقم طاولة آخر (مثلاً "5" بينما يوجد "50")
  function tryOpenUniqueQuick(digits: string): boolean {
    const normF = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    const q = normF(digits.trim().toLowerCase());
    if (!q) return false;
    quickDigitDelayedRef.current = false;

    // إن كان الرقم الحالي بادئة لرقم طاولة أطول — لم يكتمل الرقم بعد، انتظر
    const isPrefixOfOther = activeTables.some((tb: any) => {
      const t = normF(String(tb.number || '')).trim().toLowerCase();
      return t.length > q.length && t.startsWith(q);
    });
    if (isPrefixOfOther) return false;

    const exact = activeTables.filter((tb: any) => normF(String(tb.number || '')).trim().toLowerCase() === q);
    if (exact.length === 1) {
      setQuickDigits(''); if (quickDigitTimer.current) clearTimeout(quickDigitTimer.current);
      setQuickPickerTables(null); lastFocusedTableRef.current = exact[0]; handleTableClick(exact[0]);
      return true;
    }
    if (exact.length > 1 && activeSectionFilter !== 'all') {
      const inSection = exact.filter((tb: any) => getTableSectionId(tb) === activeSectionFilter);
      if (inSection.length === 1) {
        setQuickDigits(''); if (quickDigitTimer.current) clearTimeout(quickDigitTimer.current);
        setQuickPickerTables(null); lastFocusedTableRef.current = inSection[0]; handleTableClick(inSection[0]);
        return true;
      }
    }
    return false;
  }

  // ── اختصارات لوحة المفاتيح ───────────────────────────────────────────────
  // F2 = دفع سريع للطاولة الحالية · F3 = جلسة جديدة (تبويب الجلسات)
  // Esc = إغلاق أعلى نافذة · 0-9 = بناء رقم الطاولة (ثوانٍ تأخير ثم فتح)
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    };
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === 'Escape') {
        if (isTyping()) { (document.activeElement as HTMLElement).blur(); return; }
        // إلغاء الإدخال السريع
        if (quickDigits) { setQuickDigits(''); if (quickDigitTimer.current) clearTimeout(quickDigitTimer.current); }
        if (quickPickerTables) { setQuickPickerTables(null); return; }
        // إغلاق أعلى نافذة مفتوحة (الأخيرة أولاً)
        if (showSessionEndModal) { setShowSessionEndModal(false); setSessionToEnd(null); }
        else if (showChangeTableModal) { setShowChangeTableModal(false); setNewTableNumber(null); }
        else if (showSessionPaymentModal) { setShowSessionPaymentModal(false); }
        else if (showPartialPaymentModal) { setShowPartialPaymentModal(false); }
        else if (showPaymentModal) { handleClosePaymentModal(); }
        else if (showUnifiedTableModal) { setShowUnifiedTableModal(false); setSelectedTable(null); }
        return;
      }

      if (isTyping()) return;
      // لا ن activate الإدخال السريع لو أي مودال مفتوح
      if (showSessionEndModal || showChangeTableModal || showSessionPaymentModal || showPartialPaymentModal || showPaymentModal || showUnifiedTableModal) return;

      if (e.key === 'F2') {
        e.preventDefault();
        const tb = lastFocusedTableRef.current;
        if (!tb) { showNotification('مرّر مؤشر الفأرة على طاولة أولاً', 'info'); return; }
        handleQuickBilling(tb, { stopPropagation: () => {} } as unknown as React.MouseEvent);
      } else if (e.key === 'F3') {
        e.preventDefault();
        const tb = lastFocusedTableRef.current;
        if (!tb) { showNotification('مرّر مؤشر الفأرة على طاولة أولاً', 'info'); return; }
        handleTableClick(tb);
        setTimeout(() => { setActiveTab3('sessions'); setActiveTab('sessions'); }, 0);
      } else if (/^[0-9]$/.test(e.key)) {
        // ── بناء رقم الطاولة ──
        e.preventDefault();
        const digits = quickDigits + e.key;
        setQuickDigits(digits);
        if (quickDigitTimer.current) clearTimeout(quickDigitTimer.current);

        // فتح فوري إن كان الرقم الحالي يحدّد طاولة واحدة فقط (فريدة كبادئة أو كرقم)
        if (quickTryOpenRef.current(digits)) return;

        quickDigitTimer.current = setTimeout(() => {
          quickDigitOpenRef.current(digits);
        }, 350);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSessionEndModal, showChangeTableModal, showSessionPaymentModal, showPartialPaymentModal,
      showPaymentModal, showUnifiedTableModal, quickDigits, quickPickerTables]);

  // ── Navigation state ─────────────────────────────────────────────────────
  useEffect(() => {
    const state = location.state as any;
    if (state?.openTableModal && state?.tableId && tables.length > 0) {
      const target = tables.find((tb: Table) => tb._id === state.tableId || (tb as any).id === state.tableId);
      if (target) {
        setTimeout(() => { handleTableClick(target); }, 100);
        if (state.tableNumber) showNotification(t('cafe.tableOpened') + ' ' + state.tableNumber, 'info');
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
    if (state?.openPaymentModal && state?.billId && bills.length > 0 && !showPaymentModal) {
      const targetBill = bills.find((b: Bill) => b._id === state.billId || b.id === state.billId);
      if (targetBill) {
        const tableTmp = tables.find((tb: Table) => {
          const btid = (targetBill.table as any)?._id || targetBill.table;
          return tb._id === btid || (tb as any).id === btid;
        });
        if (tableTmp) { setSelectedTable(tableTmp); setShowUnifiedTableModal(true); }
        setActiveTab('billing'); setActiveTab3('billing');
        handlePaymentClick(targetBill);
        if (state.tableNumber) showNotification(t('billing.notifications.paymentManagementOpened', { tableNumber: state.tableNumber }), 'info');
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [tables, bills, location.state]);

  // ── Memos ────────────────────────────────────────────────────────────────
  const activeTableSections = useMemo(() =>
    tableSections.filter(s => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder), [tableSections]);

  const activeTables = useMemo(() => tables.filter(t => t.isActive), [tables]);

  // ── فلتر كروت الطاولات (بحث + حالة) ─────────────────────────────────────
  const matchesTableFilter = useCallback((tb: Table) => {
    const q = tableSearch.trim().toLowerCase();
    if (q) {
      // تطبيع الأرقام العربية-الهندية (٠١٢٣٤٥٦٧٨٩) إلى إنجليزية (0123456789)
      const norm = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
      const label = norm(String(getTableDisplay(tb.number, i18n.language))).toLowerCase();
      const name = norm(String((tb as any).name || '')).toLowerCase();
      const rawNum = norm(String(tb.number || '')).toLowerCase();
      if (!label.includes(q) && !name.includes(q) && !rawNum.includes(q)) return false;
    }
    const tid = String((tb as any)._id || tb.id || '');
    const st = tableStatuses[tid];
    if (tableStatusFilter === 'occupied' && !st?.hasUnpaid) return false;
    if (tableStatusFilter === 'empty' && st?.hasUnpaid) return false;
    if (tableStatusFilter === 'sessions' && !sessionUrgencyByTable.has(tid)) return false;
    return true;
  }, [tableSearch, tableStatusFilter, tableStatuses, sessionUrgencyByTable, i18n.language]);

  const visibleTablesFlat = useMemo(() => activeTables.filter(matchesTableFilter), [activeTables, matchesTableFilter]);

  // #6 — filtered sections for section-tab
  const filteredSectionsForDisplay = useMemo(() => {
    if (activeSectionFilter === 'all') return activeTableSections;
    return activeTableSections.filter(s => s.id === activeSectionFilter);
  }, [activeTableSections, activeSectionFilter]);

  const tableStats = useMemo(() => {
    const statusMap = tableDataMap.statusMap;
    const empty = activeTables.filter(t => !statusMap[t.number]?.hasUnpaid).length;
    const occupied = activeTables.filter(t => statusMap[t.number]?.hasUnpaid).length;
    return { totalSections: activeTableSections.length, totalTables: activeTables.length, emptyTables: empty, occupiedTables: occupied };
  }, [activeTables, activeTableSections, tableDataMap]);

  const getTablesBySection = useMemo(() => {
    const map: Record<string, Table[]> = {};
    activeTables.forEach(table => {
      const sec = typeof table.section === 'string' ? table.section : (table.section as TableSection)?._id || (table.section as TableSection)?.id;
      if (sec) {
        if (!map[sec]) map[sec] = [];
        map[sec].push(table);
      }
    });
    Object.keys(map).forEach(sid => {
      map[sid].sort((a, b) => {
        const an = typeof a.number === 'number' ? a.number : parseInt(String(a.number));
        const bn = typeof b.number === 'number' ? b.number : parseInt(String(b.number));
        return (!isNaN(an) && !isNaN(bn)) ? an - bn : String(a.number).localeCompare(String(b.number));
      });
    });
    return map;
  }, [activeTables]);

  const filteredTableOrders = useMemo(() =>
    tableOrders.filter((o: Order) => {
      if (!o.bill) return true;
      if (typeof o.bill === 'object' && o.bill !== null) return (o.bill as any).status !== 'paid';
      return true;
    }), [tableOrders]);

  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      if (bill.status === 'cancelled') return false;
      if (selectedTable && (bill.table as any)?._id !== selectedTable._id) return false;
      if (billTypeFilter !== 'all') {
        let t2 = bill.billType;
        if (!t2 && bill.sessions?.length > 0) {
          if (bill.sessions.some((s: any) => s.deviceType === 'playstation')) t2 = 'playstation';
          else if (bill.sessions.some((s: any) => s.deviceType === 'computer')) t2 = 'computer';
        }
        if (!t2 && bill.orders?.length > 0) t2 = 'cafe';
        if (t2 !== billTypeFilter) return false;
      }
      if (statusFilter === 'unpaid') { if (!['draft', 'partial', 'overdue'].includes(bill.status)) return false; }
      else if (statusFilter !== 'all' && bill.status !== statusFilter) return false;
      return true;
    });
  }, [bills, selectedTable?._id, billTypeFilter, statusFilter]);

  const billStats = useMemo(() => filteredBills.reduce((acc, bill) => ({
    totalBills: acc.totalBills + 1,
    totalPaid: acc.totalPaid + (Number(bill.paid) || 0),
    totalRemaining: acc.totalRemaining + (Number(bill.remaining) || 0),
    partialBills: acc.partialBills + (bill.status === 'partial' ? 1 : 0),
    totalAmount: acc.totalAmount + (Number(bill.total) || 0),
  }), { totalBills: 0, totalPaid: 0, totalRemaining: 0, partialBills: 0, totalAmount: 0 }), [filteredBills]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const formatCurrency = useCallback((amount: number) =>
    formatCurrencyUtil(amount, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP'),
  [i18n.language]);

  // ── tableCardData — بيانات كل طاولة مع cache فردي للطاولات ──
  // liveExtra: تكلفة الجلسات النشطة الحية (تتحدث كل 10 ثوانٍ فقط للطاولات اللي فيها جلسات)
  const tableCardDataCache = useRef(new Map<string, { tBills: Bill[]; tOrdersCount: number; activeSessionType: 'playstation' | 'computer' | 'both' | null; liveExtra: number }>());
  const tableCardData = useMemo(() => {
    const result = new Map<string, {
      tBills: Bill[];
      tOrdersCount: number;
      activeSessionType: 'playstation' | 'computer' | 'both' | null;
      liveExtra: number;
    }>();

    // index: tableId -> bills (مرة واحدة)
    const tidToBills = new Map<string, Bill[]>();
    bills.forEach((b: Bill) => {
      if (!b.table) return;
      const tid = ((b.table as any)._id || (b.table as any).id || b.table).toString();
      if (!tidToBills.has(tid)) tidToBills.set(tid, []);
      tidToBills.get(tid)!.push(b);
    });

    // index: tableId -> active orders count (مرة واحدة)
    const tidToOrderCount = new Map<string, number>();
    orders.forEach((o: any) => {
      const oid = (o.table?._id || o.table?.id || o.table)?.toString();
      if (!oid) return;
      if (['paid', 'cancelled'].includes((o.bill as any)?.status)) return;
      tidToOrderCount.set(oid, (tidToOrderCount.get(oid) || 0) + 1);
    });

    const cache = tableCardDataCache.current;
    activeTables.forEach((table: Table) => {
      const tid = (table._id || (table as any).id).toString();
      const tBills = tidToBills.get(tid) ?? EMPTY_BILLS;
      const tOrdersCount = tidToOrderCount.get(tid) ?? EMPTY_ORDERS_COUNT;

      // active sessions
      const activeSessions = tBills.flatMap(b =>
        ((b as any).sessions || []).filter((s: any) => typeof s === 'object' && s?.status === 'active')
      );
      const hasPS = activeSessions.some((s: any) => (s.deviceType || '').includes('playstation'));
      const hasPC = activeSessions.some((s: any) => (s.deviceType || '').includes('computer'));
      const activeSessionType: 'playstation' | 'computer' | 'both' | null =
        hasPS && hasPC ? 'both' : hasPS ? 'playstation' : hasPC ? 'computer' : null;

      // السيرفر الآن يحسب الفاتورة حية، لا حاجة لـ delta على الكارت — نعتمد على bill.remaining الحي من السيرفر
      const liveExtra = 0;

      // إعادة استخدام المرجع القديم لو البيانات لم تتغير (يمنع re-render غير ضروري)
      // للطاولات الفارغة أو المشغولة بدون جلسة: liveExtra دائماً 0 → لا تتأثر بـ tick
      const prev = cache.get(tid);
      if (prev && prev.tOrdersCount === tOrdersCount && prev.activeSessionType === activeSessionType && prev.liveExtra === liveExtra && prev.tBills.length === tBills.length && prev.tBills.every((b, i) => b._id === tBills[i]._id && b.status === tBills[i].status && b.remaining === tBills[i].remaining)) {
        result.set(tid, prev);
      } else {
        const entry = { tBills, tOrdersCount, activeSessionType, liveExtra };
        result.set(tid, entry);
        cache.set(tid, entry);
      }
    });
    return result;
  }, [bills, orders, activeTables, getSessionCost]);

  // ── gamingDeviceData — بيانات الأجهزة محسوبة خارج JSX ──────────────────
  const gamingDeviceData = useMemo(() => {
    const allGamingBills = bills.filter((bill: Bill) =>
      !bill.table && (bill.billType === 'playstation' || bill.billType === 'computer' ||
        (bill.sessions && bill.sessions.some((s: any) => s.deviceType === 'playstation' || s.deviceType === 'computer')))
    );
    const deviceMap = new Map<string, { deviceName: string; deviceType: 'playstation' | 'computer'; hasActiveSession: boolean; bills: Bill[] }>();
    allGamingBills.forEach((bill: Bill) => {
      const gamingSessions = (bill.sessions || []).filter((s: any) => s.deviceType === 'playstation' || s.deviceType === 'computer');
      gamingSessions.forEach((session: any) => {
        const key = session.deviceName || `جهاز ${session.deviceNumber}`;
        if (!deviceMap.has(key)) deviceMap.set(key, { deviceName: key, deviceType: session.deviceType, hasActiveSession: false, bills: [] });
        const d = deviceMap.get(key)!;
        if (session.status === 'active') d.hasActiveSession = true;
        if (!d.bills.find(b => (b.id || b._id) === (bill.id || bill._id))) d.bills.push(bill);
      });
    });
    return deviceMap;
  }, [bills]);

  // ????? ??? ????? ??????? ??? ?? ??? ???? ???? ???? ??? ?????? ??????
  const hasStandaloneActiveGaming = useMemo(() => {
    for (const d of gamingDeviceData.values()) if (d.hasActiveSession) return true;
    return false;
  }, [gamingDeviceData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => t(`billing.status.${status}`) || status;

  const getCustomerDisplay = (bill: Bill | null | undefined) => {
    if (!bill || !bill.customerName) return t('billing.defaultCustomer');
    const m = bill.customerName.match(/^(?:طاولة|Table|table)\s+(\d+)$/i);
    if (m) return t('billing.tableWithNumber', { number: m[1] });
    return bill.customerName;
  };

  // ── Order functions ───────────────────────────────────────────────────────
  const handleTableClick = (table: Table) => {
    setSelectedTable(table);
    setActiveTab('orders');
    setActiveTab3('orders');
    setShowUnifiedTableModal(true);
    setTableBillsFilter('unpaid');
    setSearchQuery('');
    setSearchResults(null);
    // بناء السجل عند الفتح — الـ useEffect سيحدثه تلقائياً بعد كده
    const tableId = table._id || (table as any).id;
    buildActivityLog(tableId);
  };

  // دالة البحث والفتح بعد بناء الرقم (تعتمد على activeTables + handleTableClick)
  const setQuickDigitTimerRef = useCallback((digits: string) => {
    const norm = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    const q = norm(digits.trim().toLowerCase());
    if (!q) { setQuickDigits(''); return; }

    // إن كان الرقم الحالي بادئة لرقم طاولة أطول (مثل "5" و"50") نمدد الانتظار
    // مرة واحدة فقط حتى يتابع المستخدم الكتابة، ثم نتعامل مع الرقم كمكتمل
    const prefixOfOther = activeTables.some((tb: any) => {
      const t = norm(String(tb.number || '')).trim().toLowerCase();
      return t.length > q.length && t.startsWith(q);
    });
    if (prefixOfOther && !quickDigitDelayedRef.current) {
      quickDigitDelayedRef.current = true;
      if (quickDigitTimer.current) clearTimeout(quickDigitTimer.current);
      quickDigitTimer.current = setTimeout(() => {
        quickDigitOpenRef.current(digits);
      }, 500);
      return;
    }
    quickDigitDelayedRef.current = false;

    // 1) رقم مطابق — فتح مباشر للقسم الحالي إن وجد، وإلا عرض اختيار بين المتكررة
    const byNum = activeTables.filter(tb => {
      const raw = norm(String(tb.number || '')).trim().toLowerCase();
      return raw === q;
    });
    // 1أ) ضمن القسم المحدد حالياً فقط (أولوية للقسم المعروض)
    if (activeSectionFilter !== 'all') {
      const inSection = byNum.filter((tb: any) => getTableSectionId(tb) === activeSectionFilter);
      if (inSection.length === 1) {
        setQuickDigits('');
        setQuickPickerTables(null);
        lastFocusedTableRef.current = inSection[0];
        handleTableClick(inSection[0]);
        return;
      } else if (inSection.length > 1) {
        setQuickDigits('');
        setQuickPickerTables(inSection);
        return;
      }
      // لا توجد طاولة بهذا الرقم في القسم الحالي — تابع البحث في كل الأقسام أدناه
    }
    if (byNum.length === 1) {
      setQuickDigits('');
      setQuickPickerTables(null);
      lastFocusedTableRef.current = byNum[0];
      handleTableClick(byNum[0]);
      return;
    } else if (byNum.length > 1) {
      setQuickDigits('');
      setQuickPickerTables(byNum);
      return;
    }

    // 2) اسم يبدأ بالكلمة المكتوبة (مثلاً "vip" يطابق "vip1", "vip2")
    const byName = activeTables.filter(tb => {
      const name = norm(String((tb as any).name || '')).toLowerCase();
      return name && name.startsWith(q);
    });

    if (byName.length === 1) {
      setQuickDigits('');
      setQuickPickerTables(null);
      lastFocusedTableRef.current = byName[0];
      handleTableClick(byName[0]);
    } else if (byName.length > 1) {
      setQuickDigits('');
      setQuickPickerTables(byName);
    } else {
      // لو الطاولات لسه بتتّحمّل (صفحة فُتحت للتو) نعيد المحاولة بعد لحظة بدل إظهار خطأ فوري
      if (tables.length === 0) {
        if (quickDigitTimer.current) clearTimeout(quickDigitTimer.current);
        quickDigitTimer.current = setTimeout(() => {
          quickDigitOpenRef.current(digits);
        }, 400);
        return;
      }
      setQuickDigits('');
      setQuickPickerTables(null);
      showNotification(`⚠️ الطاولة ${digits} غير موجودة`, 'error');
    }
  }, [activeTables, handleTableClick, showNotification, activeSectionFilter, tableSections, tables]);

  // إبقاء أحدث نسخة من دوال الفتح في ref حتى يستدعي الـ handler والمؤقت الأحدث دائماً
  useEffect(() => {
    quickDigitOpenRef.current = setQuickDigitTimerRef;
    quickTryOpenRef.current = tryOpenUniqueQuick;
  }, [setQuickDigitTimerRef]);

  // ── buildActivityLog — دالة مستقلة قابلة لإعادة الاستخدام ─────────────
  const buildActivityLog = useCallback((tableId: string) => {
    const cur = localStorage.getItem('organizationCurrency') || 'EGP';
    const fmt = (n: number) => formatCurrencyUtil(n, 'ar', cur);

    const activeBills = bills.filter((b: Bill) => {
      const btid = (b.table as any)?._id || b.table;
      return btid?.toString() === tableId && ['draft', 'partial', 'overdue'].includes(b.status);
    });

    const log: Array<{type: string; message: string; time: Date; color: string}> = [];

    activeBills.forEach((b: Bill) => {
      const statusAr: Record<string, string> = { draft: 'معلقة', partial: 'مدفوعة جزئياً', overdue: 'متأخرة' };
      log.push({
        type: 'bill',
        message: `فاتورة #${b.billNumber || (b.id || b._id)?.slice(-6)}  •  ${statusAr[b.status] || b.status}  •  إجمالي: ${fmt(b.total || 0)}  •  متبقي: ${fmt(b.remaining || 0)}`,
        time: new Date(b.createdAt),
        color: 'blue',
      });

      const billId = b._id || b.id;
      const billOrders = orders.filter((o: any) => {
        const oBillId = o.bill?._id || o.bill?.id || o.bill;
        return oBillId && oBillId.toString() === billId?.toString() && o.status !== 'cancelled';
      });
      billOrders.forEach((o: any) => {
        const total = o.items?.reduce((s: number, i: any) => s + (i.price || 0) * (i.quantity || 0), 0) || o.finalAmount || o.totalAmount || 0;
        const itemsSummary = o.items?.slice(0, 3).map((i: any) => `${i.name} ×${i.quantity}`).join('، ') || '';
        const more = (o.items?.length || 0) > 3 ? ` و${o.items.length - 3} أخرى` : '';
        log.push({
          type: 'order',
          message: `طلب #${o.orderNumber}  •  ${fmt(total)}${itemsSummary ? `\n${itemsSummary}${more}` : ''}`,
          time: new Date(o.createdAt || b.createdAt),
          color: 'orange',
        });
      });

      if (b.sessions && Array.isArray(b.sessions)) {
        (b.sessions as any[]).forEach((s: any) => {
          if (!s) return;
          const statusSessionAr: Record<string, string> = { active: 'نشطة 🟢', completed: 'منتهية', paused: 'متوقفة', cancelled: 'ملغاة' };
          const start = s.startTime ? new Date(s.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—';
          const end   = s.endTime   ? new Date(s.endTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'جارية';
          const cost  = getSessionCost(s);
          const icon  = s.deviceType === 'playstation' ? '🎮' : '💻';
          log.push({
            type: 'session',
            message: `${icon} ${s.deviceName || s.deviceNumber}  •  ${statusSessionAr[s.status] || s.status}\nمن ${start} إلى ${end}  •  ${fmt(cost)}`,
            time: new Date(s.startTime || b.createdAt),
            color: s.status === 'active' ? 'red' : 'purple',
          });
        });
      }

      if (b.payments?.length) {
        const methodAr: Record<string, string> = { cash: 'كاش', card: 'بطاقة', transfer: 'تحويل' };
        b.payments.forEach((p: any) => {
          log.push({
            type: 'payment',
            message: `دفعة  •  ${fmt(p.amount)}  •  ${methodAr[p.method] || p.method || 'كاش'}`,
            time: new Date(p.timestamp),
            color: 'green',
          });
        });
      }
    });

    log.sort((a, b) => b.time.getTime() - a.time.getTime());
    setTableActivityLog(log.slice(0, 50));
  }, [bills, orders, getSessionCost]);

  // تحديث لحظي للسجل كل 10 ثوانٍ عند فتح مودال الطاولة (فقط للطاولة المفتوحة)
  useEffect(() => {
    if (selectedTable && showUnifiedTableModal) {
      const tableId = selectedTable._id || (selectedTable as any).id;
      buildActivityLog(tableId);
    }
  }, [selectedTable?._id, showUnifiedTableModal, buildActivityLog]);

  // #1 Quick order from table card
  const handleQuickOrder = (table: Table, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canAddOrder(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    // يفتح مودال الطاولة على تاب الطلبات ثم يفتح نافذة إضافة طلب مباشرة
    setSelectedTable(table);
    setActiveTab('orders');
    setActiveTab3('orders');
    setShowUnifiedTableModal(true);
    setCurrentOrderItems([]);
    setOrderNotes('');
    setExpandedSections({});
    setExpandedCategories({});
    setTimeout(() => setShowOrderModal(true), 50);
  };

  // #1 Quick billing from table card — يفتح نفس نافذة اختيار الدفع اللي في فواتير الطاولة بالظبط
  const handleQuickBilling = useCallback((table: Table, e: React.MouseEvent) => {
    e.stopPropagation();
    const tableId = String((table as any)._id || (table as any).id || table);
    const cardBills = tableCardData.get(tableId)?.tBills || (tableBillsMap as any)[tableId]?.bills || [];
    let unpaidBill = cardBills.find((b: any) => ['draft', 'partial', 'overdue'].includes(b.status));
    if (!unpaidBill) {
      unpaidBill = bills.find((b: Bill) => {
        const btid = (b.table as any)?._id || (b.table as any)?.id || b.table;
        return String(btid) === tableId && ['draft', 'partial', 'overdue'].includes(b.status);
      });
    }
    if (unpaidBill) {
      setPayChoiceBill(unpaidBill);
      setShowPayChoiceModal(true);
    } else if (cardBills.length > 0) {
      // fallback: لو فيه فاتورة بس حالتها paid/cancelled اعرض أول واحدة في إدارة الدفع بدل فواتير الطاولة
      setPayChoiceBill(cardBills[0]);
      setShowPayChoiceModal(true);
    } else {
      setSelectedTable(table);
      setActiveTab('billing');
      setActiveTab3('billing');
      setShowUnifiedTableModal(true);
      setTableBillsFilter('unpaid');
    }
  }, [tableCardData, tableBillsMap, bills]);

  const handleQuickAddSave = async () => {
    if (!quickAddTable || quickAddItems.length === 0) return;
    try {
      setQuickAddSaving(true);
      const order = await createOrder({
        table: quickAddTable._id,
        customerName: quickAddTable.number.toString(),
        items: quickAddItems.map(i => ({ menuItem: i.menuItem, name: i.name, price: i.price, quantity: i.quantity, notes: i.notes || null })),
        notes: null, status: 'pending',
      });
      if (order) {
        setShowQuickAddModal(false);
        setQuickAddItems([]);
        setQuickAddTable(null);
        showNotification(t('cafe.orderAddedSuccess'), 'success');
        fetchAvailableMenuItems();
        scheduleBackgroundRefetch(true);
      }
    } catch (err: any) {
      showNotification(err?.message || t('cafe.errorAddingOrder'), 'error');
    } finally { setQuickAddSaving(false); }
  };

  // #9 Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── Register header actions (إدارة الطاولات + تحديث + شاشة كاملة في الهيدر العلوي) ──
  const { registerActions, unregisterActions } = useTablesHeader();
  const loadInitialDataRef = useRef(loadInitialData);
  loadInitialDataRef.current = loadInitialData;
  const toggleFullscreenRef = useRef(toggleFullscreen);
  toggleFullscreenRef.current = toggleFullscreen;
  useEffect(() => {
    registerActions({
      openManagement: () => setShowManagementModal(true),
      refresh: () => loadInitialDataRef.current(),
      isFullscreen,
      toggleFullscreen: () => toggleFullscreenRef.current(),
    });
    return () => unregisterActions();
  }, [registerActions, unregisterActions, isFullscreen]);

  // #11 Print daily report
  const handlePrintDailyReport = () => {
    setIsPrintingReport(true);
    const today = new Date();
    const todayStr = today.toLocaleDateString('ar-EG', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const todayBills = bills.filter(b => {
      const d = new Date(b.createdAt);
      return d.toDateString() === today.toDateString();
    });
    const totalRevenue = todayBills.filter(b => b.status === 'paid').reduce((s, b) => s + (b.total || 0), 0);
    const totalPaid = todayBills.reduce((s, b) => s + (b.paid || 0), 0);
    const totalRemaining = todayBills.filter(b => b.status !== 'paid' && b.status !== 'cancelled').reduce((s, b) => s + (b.remaining || 0), 0);
    const paidCount = todayBills.filter(b => b.status === 'paid').length;
    const unpaidCount = todayBills.filter(b => ['draft','partial','overdue'].includes(b.status)).length;
    const orgName = user?.organizationName || '';
    const cur = localStorage.getItem('organizationCurrency') || 'EGP';
    const fmt = (n: number) => formatCurrencyUtil(n, 'ar', cur);
    const reportHtml = `
      <!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
      <title>تقرير يومي - ${todayStr}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; color: #1f2937; direction: rtl; }
        .header { text-align: center; border-bottom: 3px solid #f97316; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { font-size: 24px; color: #f97316; margin: 0 0 4px; }
        .header p { color: #6b7280; margin: 0; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; text-align: center; }
        .stat-card .value { font-size: 22px; font-weight: 700; color: #1f2937; }
        .stat-card .label { font-size: 12px; color: #6b7280; margin-top: 4px; }
        .stat-card.green .value { color: #059669; }
        .stat-card.red .value { color: #dc2626; }
        .stat-card.blue .value { color: #2563eb; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #f97316; color: white; padding: 10px 12px; text-align: right; }
        td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
        tr:nth-child(even) { background: #f9fafb; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
        .badge.paid { background: #d1fae5; color: #065f46; }
        .badge.partial { background: #fef3c7; color: #92400e; }
        .badge.draft { background: #f3f4f6; color: #374151; }
        .footer { text-align: center; margin-top: 24px; color: #9ca3af; font-size: 12px; }
        @media print { body { margin: 10px; } }
      </style></head><body>
      <div class="header">
        <h1>${orgName}</h1>
        <p>التقرير اليومي — ${todayStr}</p>
      </div>
      <div class="stats">
        <div class="stat-card green"><div class="value">${fmt(totalRevenue)}</div><div class="label">إجمالي الفواتير المدفوعة</div></div>
        <div class="stat-card blue"><div class="value">${fmt(totalPaid)}</div><div class="label">إجمالي المبالغ المحصلة</div></div>
        <div class="stat-card red"><div class="value">${fmt(totalRemaining)}</div><div class="label">إجمالي المبالغ المتبقية</div></div>
        <div class="stat-card"><div class="value">${todayBills.length}</div><div class="label">إجمالي الفواتير</div></div>
        <div class="stat-card green"><div class="value">${paidCount}</div><div class="label">فواتير مدفوعة</div></div>
        <div class="stat-card red"><div class="value">${unpaidCount}</div><div class="label">فواتير غير مدفوعة</div></div>
      </div>
      <table>
        <thead><tr><th>#</th><th>رقم الفاتورة</th><th>الطاولة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th></tr></thead>
        <tbody>
          ${todayBills.map((b, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>#${b.billNumber || b.id?.slice(-6)}</td>
              <td>${b.table ? `طاولة ${(b.table as any).number || ''}${getTableSectionName(b.table) ? ` (${getTableSectionName(b.table)})` : ''}` : '—'}</td>
              <td>${fmt(b.total || 0)}</td>
              <td>${fmt(b.paid || 0)}</td>
              <td>${fmt(b.remaining || 0)}</td>
              <td><span class="badge ${b.status}">${b.status === 'paid' ? 'مدفوعة' : b.status === 'partial' ? 'جزئي' : b.status === 'draft' ? 'معلقة' : b.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="footer">طُبع في ${new Date().toLocaleTimeString('ar-EG')}</div>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(reportHtml);
      w.document.close();
      w.focus();
      setTimeout(() => { w.print(); setIsPrintingReport(false); }, 500);
    } else { setIsPrintingReport(false); }
  };

  const handlePaymentManagement = (table: Table) => {
    const tableId = table._id || (table as any).id;
    const unpaidBill = bills.find((bill: any) => {
      const btid = bill.table?._id || bill.table?.id || bill.table;
      return btid === tableId && bill.status !== 'paid' && bill.status !== 'cancelled';
    });
    if (unpaidBill) {
      setActiveTab('billing'); setActiveTab3('billing');
      handlePaymentClick(unpaidBill);
    } else {
      showNotification(t('cafe.noBillForTable'), 'warning');
    }
  };

  const handleAddOrder = () => {
    if (!canAddOrder(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    if (!selectedTable) { showNotification(t('cafe.selectTable'), 'error'); return; }
    setCurrentOrderItems([]); setOrderNotes(''); setExpandedSections({}); setExpandedCategories({});
    setShowOrderModal(true);
  };

  const handleEditOrder = (order: Order) => {
    if (!canEditOrder(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    if (!order.items || !Array.isArray(order.items)) { showNotification(t('cafe.notifications.orderHasNoItems'), 'error'); return; }
    setSelectedOrder(order);
    setCurrentOrderItems(order.items.map(item => ({
      menuItem: (item as any).menuItem?._id || (item as any).menuItem || '',
      name: item.name, price: item.price, variant: (item as any).variant || null, quantity: item.quantity, notes: (item as any).notes || '',
    })));
    setOrderNotes(order.notes || '');
    setExpandedSections({}); setExpandedCategories({});
    setShowEditOrderModal(true);
  };

  const toggleSection = (id: string) => setExpandedSections(p => ({ ...p, [id]: !p[id] }));
  const toggleCategory = (id: string) => setExpandedCategories(p => ({ ...p, [id]: !p[id] }));

  const getCategoriesForSection = useCallback((sectionId: string) =>
    menuCategories.filter(c => {
      const s = typeof c.section === 'string' ? c.section : (c.section as MenuSection)?._id || (c.section as MenuSection)?.id;
      return s === sectionId && c.isActive;
    }).sort((a, b) => a.sortOrder - b.sortOrder), [menuCategories]);

  const getItemsForCategory = useCallback((categoryId: string) =>
    menuItems.filter(item => {
      const c = typeof item.category === 'string' ? item.category : (item.category as MenuCategory)?._id || (item.category as MenuCategory)?.id;
      return c === categoryId && item.isAvailable;
    }), [menuItems]);

  const addItemToOrder = (menuItem: MenuItem, variant?: string | null) => {
    // Resolve effective price/variant from MenuItem variants
    let effectiveVariant: string | null = variant ? String(variant).trim() : null;
    let effectivePrice = menuItem.price;
    if (menuItem.variants && menuItem.variants.length > 0) {
      if (effectiveVariant) {
        const matched = menuItem.variants.find(v => v.size === effectiveVariant);
        if (matched) effectivePrice = matched.price;
        else {
          // variant not found - fallback to first
          effectiveVariant = menuItem.variants[0].size;
          effectivePrice = menuItem.variants[0].price;
        }
      } else {
        effectiveVariant = menuItem.variants[0].size;
        effectivePrice = menuItem.variants[0].price;
      }
    } else {
      effectiveVariant = effectiveVariant || null;
    }
    const keyVariant = effectiveVariant || '';
    const existing = currentOrderItems.find(i => i.menuItem === menuItem.id && (i.variant || '') === keyVariant && i.price === effectivePrice);
    if (existing) {
      setCurrentOrderItems(p => p.map(i => (i.menuItem === menuItem.id && (i.variant || '') === keyVariant && i.price === effectivePrice) ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCurrentOrderItems(p => [...p, { menuItem: menuItem.id, name: menuItem.name, price: effectivePrice, variant: effectiveVariant, quantity: 1, notes: '' }]);
    }
  };

  const updateItemQuantity = useCallback((id: string, delta: number, variant?: string | null) => {
    setCurrentOrderItems(p => {
      // If variant explicitly provided, match both
      if (variant !== undefined) {
        const keyVariant = variant || '';
        return p.map(i => {
          if (i.menuItem !== id || (i.variant || '') !== keyVariant) return i;
          const q = i.quantity + delta;
          if (q <= 0) return null as any;
          return { ...i, quantity: q };
        }).filter(Boolean) as LocalOrderItem[];
      }
      // Legacy fallback: if multiple variants exist, update first matching id (or all? we update first)
      // For backward compat, if only one entry with this menuItem, update it
      const matching = p.filter(i => i.menuItem === id);
      if (matching.length === 1) {
        return p.map(i => {
          if (i.menuItem !== id) return i;
          const q = i.quantity + delta;
          if (q <= 0) return null as any;
          return { ...i, quantity: q };
        }).filter(Boolean) as LocalOrderItem[];
      }
      // If multiple, we shouldn't guess - do nothing unless variant supplied
      return p;
    });
  }, []);

  const handlePriceEditSave = (qtyToEdit: number, newPrice: number) => {
    if (!priceEditItem) return;
    const { index, item } = priceEditItem;
    setCurrentOrderItems(prev => {
      const newItems = [...prev];
      // Find by index first, fallback to matching item if index out of sync
      let idx = index;
      if (!newItems[idx] || newItems[idx].menuItem !== item.menuItem || newItems[idx].price !== item.price) {
        idx = newItems.findIndex(i => i.menuItem === item.menuItem && i.price === item.price && (i.variant || '') === (item.variant || ''));
        if (idx === -1) return prev;
      }
      const target = newItems[idx];
      if (qtyToEdit >= target.quantity) {
        newItems[idx] = { ...target, price: newPrice };
      } else {
        newItems[idx] = { ...target, quantity: target.quantity - qtyToEdit };
        const newItem: LocalOrderItem = {
          menuItem: target.menuItem,
          name: target.name,
          price: newPrice,
          variant: (target as any).variant || null,
          quantity: qtyToEdit,
          notes: target.notes,
        };
        newItems.splice(idx + 1, 0, newItem);
      }
      return newItems;
    });
  };

  const updateItemNotes = useCallback((id: string, notes: string, variant?: string | null) =>
    setCurrentOrderItems(p => p.map(i => {
      if (variant !== undefined) {
        if (i.menuItem === id && (i.variant || '') === (variant || '')) return { ...i, notes };
        return i;
      }
      return i.menuItem === id ? { ...i, notes } : i;
    }), []));

  const removeItemFromOrder = useCallback((id: string, variant?: string | null) =>
    setCurrentOrderItems(p => {
      if (variant !== undefined) {
        const keyVariant = variant || '';
        return p.filter(i => !(i.menuItem === id && (i.variant || '') === keyVariant));
      }
      return p.filter(i => i.menuItem !== id);
    }), []);

  const calculateOrderTotal = () => currentOrderItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const handleSaveOrder = async (status = 'pending', shouldPrint = false) => {
    if (!selectedTable || currentOrderItems.length === 0) {
      showNotification(t('cafe.addAtLeastOne'), 'error'); return;
    }
    try {
      setSavingOrder(true);
      showNotification(t('cafe.notifications.savingOrder'), 'info');
      const order = await createOrder({
        table: selectedTable._id,
        customerName: selectedTable.number.toString(),
        items: currentOrderItems.map(i => ({ menuItem: i.menuItem, name: i.name, price: i.price, variant: i.variant || null, quantity: i.quantity, notes: i.notes || null })),
        notes: orderNotes || null, status,
      });
        if (order) {
        setShowOrderModal(false); setCurrentOrderItems([]); setOrderNotes('');
        showNotification(t('cafe.orderAddedSuccess'), 'success');
        fetchAvailableMenuItems();
        if (shouldPrint) {
          setTimeout(async () => {
            const map = new Map();
            menuItems.forEach(mi => { map.set(mi.id, mi); map.set(mi._id, mi); });
            await printOrder({ ...order, items: order.items?.map((item: any, idx: number) => ({ ...item, _id: item._id || item.id || `temp-${idx}` })) || [], createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt } as any, menuSections, map, user?.organizationName || '', i18n.language, t, getTableSectionName(selectedTable));
          }, 0);
        }
        // تحديث متفائل — createOrder في DataContext حدث orders+bills، نحدث tableOrders فقط
        setTableOrders(p => [...p, order]);
        // إبطال كاش الطاولات لضمان إعادة الرسم الفوري
        invalidateTablesCache();
        // لا حاجة لـ fetchBills/fetchOrders المكرر — scheduleBackgroundRefetch للتأكيد فقط
        scheduleBackgroundRefetch(true);
      }
    } catch (error: any) {
      showNotification(error?.message || t('cafe.errorAddingOrder'), 'error');
    } finally { setSavingOrder(false); }
  };

  const executeUpdateOrder = async (shouldPrint = false, status?: string) => {
    if (!selectedOrder || currentOrderItems.length === 0) return;
    try {
      setSavingOrder(true);
      showNotification(t('cafe.notifications.updatingOrder'), 'info');
      const orderData: Record<string, any> = {
        items: currentOrderItems.map(i => ({ menuItem: i.menuItem, name: i.name, price: i.price, variant: i.variant || null, quantity: i.quantity, notes: i.notes || null })),
        notes: orderNotes || null,
      };
      if (status) orderData.status = status;
      const updated = await updateOrder(selectedOrder.id, orderData);
      if (updated) {
        setShowEditOrderModal(false); setSelectedOrder(null); setCurrentOrderItems([]); setOrderNotes('');
        showNotification(t('cafe.orderUpdatedSuccess'), 'success');
        fetchAvailableMenuItems();
        if (shouldPrint) {
          setTimeout(async () => {
            const map = new Map();
            menuItems.forEach(mi => { map.set(mi.id, mi); map.set(mi._id, mi); });
            await printOrder({ ...updated, items: updated.items?.map((item: any, idx: number) => ({ ...item, _id: item._id || item.id || `temp-${idx}` })) || [], createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : updated.createdAt } as any, menuSections, map, user?.organizationName || '', i18n.language, t, getTableSectionName(selectedTable));
          }, 0);
        }
        if (selectedTable) setTableOrders(p => p.map(o => o.id === updated.id ? updated : o));
        scheduleBackgroundRefetch(true);
      }
    } catch (error: any) {
      showNotification(error?.message || t('cafe.errorUpdatingOrder'), 'error');
    } finally { setSavingOrder(false); }
  };

  const handleUpdateOrder = async (shouldPrint = false, status?: string) => {
    await executeUpdateOrder(shouldPrint, status);
  };

  const handlePrintOrder = async (order: Order) => {
    if (!order.items || !Array.isArray(order.items)) { showNotification(t('cafe.notifications.orderHasNoItems'), 'error'); return; }
    const map = new Map();
    menuItems.forEach(mi => { map.set(mi.id, mi); map.set(mi._id, mi); });
    await printOrder({ ...order, items: order.items.map((item: any, idx: number) => ({ ...item, _id: item._id || item.id || `temp-${idx}` })), createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt } as any, menuSections, map, user?.organizationName || '', i18n.language, t, getTableSectionName(order.table));
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, confirmText = 'تأكيد', cancelText = 'إلغاء', confirmColor = 'bg-red-600 hover:bg-red-700') => {
    setConfirmModalData({ title, message, onConfirm, confirmText, cancelText, confirmColor });
    setShowConfirmModal(true);
  };

  const handleDeleteOrder = (order: Order) => {
    if (!canDeleteOrder(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    showConfirm(
      t('cafe.confirmDeleteTitle'),
      t('cafe.deleteOrderConfirm', { orderNumber: order.orderNumber }),
      async () => {
        try {
          setConfirmLoading(true);
          const result = await deleteOrder(order.id);
          setConfirmLoading(false); setShowConfirmModal(false);
          if (result === true) {
            showNotification(t('cafe.orderDeletedSuccess'), 'success');
            fetchAvailableMenuItems();
            setTableOrders(prev => prev.filter(o => (o as any).id !== order.id && (o as any)._id !== order.id));
            invalidateTablesCache();
            scheduleBackgroundRefetch(true);
          } else {
            showNotification(t('cafe.orderDeletedError'), 'error');
          }
        } catch { setConfirmLoading(false); setShowConfirmModal(false); showNotification(t('cafe.orderDeletedError'), 'error'); }
      },
      t('cafe.confirmButton'), t('cafe.cancelButton')
    );
  };


  // ── Billing functions ─────────────────────────────────────────────────────
  const handlePaymentClick = async (bill: Bill) => {
    // افتح المودال فوراً بالبيانات الموجودة
    setSelectedBill(bill);
    setOriginalAmount(bill.remaining?.toString() || '0');
    setPaymentAmount(bill.remaining?.toString() || '0');
    setDiscountPercentage(''); setPaymentMethod('cash'); setPaymentReference('');
    setShowPaymentModal(true);
    // ثم حدّث بيانات الفاتورة في الخلفية
    try {
      const r = await api.getBill(bill.id || bill._id);
      if (r?.data) {
        setSelectedBill(r.data);
        setOriginalAmount(r.data.remaining?.toString() || '0');
        setPaymentAmount(r.data.remaining?.toString() || '0');
      }
    } catch { /* نبقى على البيانات الموجودة */ }
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false); setSelectedBill(null);
    setPaymentAmount(''); setOriginalAmount(''); setPaymentMethod('cash');
    setPaymentReference(''); setDiscountPercentage('');
    setShowPayFullBillConfirmModal(false); setBillToPayFull(null);
  };

  // ── التقريب التلقائي (إعداد محلي لكل جهاز) ──────────────────────────────
  const [roundingMode, setRoundingMode] = useState<'none' | 'half' | 'one'>(() =>
    (localStorage.getItem('pos_rounding') as any) || 'none');
  const applyRounding = useCallback((v: number) => {
    const mode = localStorage.getItem('pos_rounding') || roundingMode;
    if (mode === 'half') return Math.round(v / 0.5) * 0.5;
    if (mode === 'one') return Math.round(v);
    return v;
  }, [roundingMode]);
  const cycleRounding = useCallback(() => {
    setRoundingMode(prev => {
      const next = prev === 'none' ? 'half' : prev === 'half' ? 'one' : 'none';
      localStorage.setItem('pos_rounding', next);
      return next;
    });
  }, []);

  // تنفيذ دفعة واحدة على الفاتورة — يستخدمه الدفع العادي والمقسوم
  const paySinglePart = async (
    bill: Bill, payVal: number, method: string,
    effTotal: number, discountAmount: number, discountPct: string
  ): Promise<any> => {
    const newPaidAmount = (bill.paid || 0) + payVal;
    const newRemaining = Math.max(0, effTotal - newPaidAmount);
    let newStatus = bill.status || 'draft';
    if (newRemaining === 0 || newPaidAmount >= effTotal) {
      if (!hasActiveSession(bill)) newStatus = 'paid'; else newStatus = 'partial';
    } else if (newPaidAmount > 0) newStatus = 'partial';
    const paymentData: any = {
      paid: newPaidAmount, remaining: newRemaining, status: newStatus,
      paymentAmount: payVal, method,
      reference: method === paymentMethod ? paymentReference : '',
      total: bill.total || 0, effectiveTotal: effTotal,
    };
    if (discountPct && parseFloat(discountPct) > 0) {
      paymentData.discountPercentage = parseFloat(discountPct);
      paymentData.discount = discountAmount;
    }
    // تحديث متفائل فوري قبل انتظار السيرفر
    const optimisticBill: any = { ...bill, paid: newPaidAmount, remaining: newRemaining, status: newStatus };
    setBills(prev => prev.map(b => String(b._id || b.id) === String(bill._id || bill.id) ? optimisticBill : b));
    if (selectedBill && String(selectedBill._id || selectedBill.id) === String(bill._id || bill.id)) setSelectedBill(optimisticBill as Bill);
    const result = await api.updatePayment(bill.id || bill._id, paymentData);
    if (!result?.data) throw new Error('payment failed');
    // تأكيد بالبيانات الراجعة من السيرفر
    setBills(prev => prev.map(b => String(b._id || b.id) === String(bill._id || bill.id) ? result.data : b));
    if (selectedBill && String(selectedBill._id || selectedBill.id) === String(bill._id || bill.id)) setSelectedBill(result.data as Bill);
    if (newStatus === 'paid') {
      setShowPaymentSuccessAnim(true);
      setTimeout(() => setShowPaymentSuccessAnim(false), 2500);
    }
    return result.data;
  };

  const processPayment = async () => {
    if (!selectedBill) return;
    if (discountPercentage && (isNaN(parseFloat(discountPercentage)) || parseFloat(discountPercentage) < 0 || parseFloat(discountPercentage) > 100)) {
      showNotification(t('billing.notifications.invalidDiscountPercentage'), 'error'); return;
    }
    try {
      setIsProcessingPayment(true);
      let effectiveTotal = selectedBill.total || 0;
      let discountAmount = 0;
      if (discountPercentage && parseFloat(discountPercentage) > 0) {
        discountAmount = (selectedBill.subtotal || selectedBill.total || 0) * (parseFloat(discountPercentage) / 100);
        effectiveTotal = (selectedBill.total || 0) - discountAmount;
      }
      effectiveTotal = applyRounding(effectiveTotal);

      // ⚡ دفع مقسوم؟ جزءان متتاليان بطريقتين مختلفتين
      if (splitPartsRef.current) {
        const { amount2, method2 } = splitPartsRef.current;
        const a1 = parseFloat(paymentAmount);
        const a2 = parseFloat(amount2);
        if (isNaN(a1) || isNaN(a2) || a1 <= 0 || a2 <= 0) {
          showNotification(t('billing.notifications.invalidAmount'), 'error'); setIsProcessingPayment(false); return;
        }
        const updatedAfterFirst = await paySinglePart(selectedBill, a1, paymentMethod, effectiveTotal, discountAmount, discountPercentage);
        await paySinglePart(updatedAfterFirst || { ...selectedBill, paid: (selectedBill.paid || 0) + a1 }, a2, method2, effectiveTotal, discountAmount, discountPercentage);
        handleClosePaymentModal();
        showNotification(t('billing.notifications.paymentSuccess'), 'success');
        invalidateTablesCache();
        scheduleBackgroundRefetch(true);
        return;
      }

      // تقريب مبلغ الدفع إذا كان يساوي المتبقي بالكامل
      let payVal = parseFloat(paymentAmount);
      const roundedRemaining = applyRounding(Math.max(0, effectiveTotal - (selectedBill.paid || 0)));
      if (!isNaN(payVal) && roundedRemaining >= 0 && Math.abs(payVal - (selectedBill.remaining || 0)) < 0.011 && roundedRemaining !== (selectedBill.remaining || 0)) {
        payVal = roundedRemaining;
      }

      await paySinglePart(selectedBill, payVal, paymentMethod, effectiveTotal, discountAmount, discountPercentage);
      handleClosePaymentModal();
      showNotification(t('billing.notifications.paymentSuccess'), 'success');
      invalidateTablesCache();
      scheduleBackgroundRefetch(true);
    } catch { showNotification(t('billing.notifications.paymentError'), 'error'); }
    finally { setIsProcessingPayment(false); splitPartsRef.current = null; }
  };

  // بيانات الجزء الثاني للدفع المقسوم — ref لتفادي re-render المودال
  const splitPartsRef = useRef<{ amount2: string; method2: 'cash' | 'card' | 'transfer' } | null>(null);

  // ref لدالة processPayment الحية — يسمح بـ useCallback مستقر لا يتغير مرجعه
  const processPaymentRef = useRef(processPayment);
  useEffect(() => { processPaymentRef.current = processPayment; });

  // onSplitSubmit مستقر — لا يتغير مرجعه في كل render (يقلل إعادة رسم نافذة الدفع)
  const handleSplitSubmit = useCallback(async (amount2: string, method2: 'cash' | 'card' | 'transfer') => {
    splitPartsRef.current = { amount2, method2 };
    await processPaymentRef.current();
  }, []);

  const handlePaymentSubmit = async () => {
    if (!selectedBill) return;
    if (selectedBill && hasActiveSession(selectedBill)) { showNotification(t('billing.notifications.cannotPayActiveSession'), 'error'); return; }
    const isFullPayment = parseFloat(paymentAmount) >= (selectedBill.remaining || 0);
    if (isFullPayment) {
      if (!canPayFullBill(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
      setBillToPayFull(selectedBill); setShowPayFullBillConfirmModal(true); return;
    }
    await processPayment();
  };

  const handlePayFullBill = async (bill: Bill) => {
    if (!canPayFullBill(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    if (bill && hasActiveSession(bill)) { showNotification(t('billing.notifications.cannotPayActiveSession'), 'error'); return; }
    if (bill.status === 'paid') { showNotification(t('billing.notifications.billAlreadyPaid'), 'info'); return; }
    if ((bill.remaining || 0) <= 0) { showNotification(t('billing.notifications.noRemainingAmount'), 'info'); return; }
    setBillToPayFull(bill); setShowPayFullBillConfirmModal(true);
  };

  const confirmPayFullBill = async () => {
    if (!billToPayFull) return;
    try {
      setIsProcessingPayment(true);
      if (selectedBill && (selectedBill.id === billToPayFull.id || selectedBill._id === billToPayFull._id)) {
        await processPayment();
        setShowPayFullBillConfirmModal(false); setBillToPayFull(null); return;
      }
      const remaining = billToPayFull.remaining || 0;
      // تحديث متفائل
      const optimisticFull: any = { ...billToPayFull, paid: (billToPayFull.paid || 0) + remaining, remaining: 0, status: 'paid' };
      setBills(prev => prev.map(b => String(b._id || b.id) === String(billToPayFull._id || billToPayFull.id) ? optimisticFull : b));
      const result = await api.updatePayment(billToPayFull.id || billToPayFull._id, {
        paid: (billToPayFull.paid || 0) + remaining, remaining: 0, status: 'paid',
        paymentAmount: remaining, method: 'cash', reference: '',
      } as any);
      if (result?.data) {
        setBills(prev => prev.map(b => String(b._id || b.id) === String(billToPayFull._id || billToPayFull.id) ? result.data : b));
        setShowPayFullBillConfirmModal(false); setBillToPayFull(null);
        setIsProcessingPayment(false);
        setShowPaymentSuccessAnim(true);
        setTimeout(() => setShowPaymentSuccessAnim(false), 2500);
        invalidateTablesCache();
        scheduleBackgroundRefetch(true);
        showNotification(t('billing.notifications.payFullBillSuccess'), 'success');
      }
    } catch { showNotification(t('billing.notifications.payFullBillError'), 'error'); setIsProcessingPayment(false); }
  };

  const handleDirectPayFull = async (bill: Bill) => {
    if (!canPayFullBill(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    if (bill && hasActiveSession(bill)) { showNotification(t('billing.notifications.cannotPayActiveSession'), 'error'); return; }
    if (bill.status === 'paid') { showNotification(t('billing.notifications.billAlreadyPaid'), 'info'); return; }
    if ((bill.remaining || 0) <= 0) { showNotification(t('billing.notifications.noRemainingAmount'), 'info'); return; }
    try {
      setIsProcessingPayment(true);
      if (selectedBill && (selectedBill.id === bill.id || (selectedBill as any)._id === (bill as any)._id)) {
        await processPayment();
        setIsProcessingPayment(false);
        setShowPaymentSuccessAnim(true);
        setTimeout(() => setShowPaymentSuccessAnim(false), 2500);
        return;
      }
      const remaining = bill.remaining || 0;
      const optimisticFull: any = { ...bill, paid: (bill.paid || 0) + remaining, remaining: 0, status: 'paid' };
      const optimisticBills = bills.map(b => String(b._id || (b as any).id) === String((bill as any)._id || (bill as any).id) ? optimisticFull : b);
      setBills(optimisticBills);
      // لو الطاولة مبقاش عليها فواتير غير مدفوعة -> اقفل نافذتها وخليها فارغة فورا
      const tableId = String((bill.table as any)?._id || bill.table || '');
      const hasUnpaidForTable = optimisticBills.some((b: any) => String(b.table?._id || b.table) === tableId && ['draft','partial','overdue'].includes(b.status));
      if (!hasUnpaidForTable && selectedTable && String((selectedTable as any)._id || (selectedTable as any).id) === tableId) {
        setShowUnifiedTableModal(false);
        setSelectedTable(null);
      }
      // مسح كاش كروت الطاولات عشان اللون يتحدث فورا
      tableCardDataCache.current.clear();
      const result = await api.updatePayment((bill as any).id || (bill as any)._id, {
        paid: (bill.paid || 0) + remaining, remaining: 0, status: 'paid',
        paymentAmount: remaining, method: 'cash', reference: '',
      } as any);
      if (result?.data) {
        setBills(prev => prev.map(b => String(b._id || (b as any).id) === String((bill as any)._id || (bill as any).id) ? result.data : b));
        tableCardDataCache.current.clear();
        setIsProcessingPayment(false);
        setShowPaymentSuccessAnim(true);
        setTimeout(() => setShowPaymentSuccessAnim(false), 2500);
        invalidateTablesCache();
        // fetch فوري بدون throttle عشان حالة الطاولة تتأكد
        fetchBills().catch(()=>{});
        showNotification(t('billing.notifications.payFullBillSuccess'), 'success');
      } else {
        setIsProcessingPayment(false);
      }
    } catch { showNotification(t('billing.notifications.payFullBillError'), 'error'); setIsProcessingPayment(false); }
  };

  const handlePartialPayment = async (bill: Bill) => {
    if (!canPartialPayment(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    setSelectedBill(bill); setShowPartialPaymentModal(true);
  };

  const handlePartialPaymentSubmit = async (items: Array<{ itemId: string; quantity: number }>, method: 'cash' | 'card' | 'transfer') => {
    if (!selectedBill || items.length === 0) return;
    try {
      setIsProcessingPartialPayment(true);
      const response = await api.addPartialPaymentAggregated(selectedBill.id || selectedBill._id, { items, paymentMethod: method });
      if (response.success) {
        const totalPaid = items.reduce((s, item) => {
          const agg = backendAggregatedItems.find(a => a.id === item.itemId);
          return s + (agg ? agg.price * item.quantity : 0);
        }, 0);
        setIsProcessingPartialPayment(false);
        showNotification(t('billing.notifications.partialPaymentSuccess', { amount: formatCurrency(totalPaid) }), 'success');
        if (response.data) {
          setBills(prev => prev.map(b => String(b._id || b.id) === String(selectedBill._id || selectedBill.id) ? response.data : b));
          setSelectedBill(response.data as Bill);
          invalidateTablesCache();
          scheduleBackgroundRefetch(true);
          if ((response.data as Bill).status === 'paid') {
            setShowPartialPaymentModal(false);
            showNotification(t('billing.notifications.billCompleted'), 'success');
          }
        }
      } else {
        showNotification(response.message || t('billing.notifications.partialPaymentError'), 'error');
        setIsProcessingPartialPayment(false);
      }
    } catch { showNotification(t('billing.notifications.partialPaymentError'), 'error'); setIsProcessingPartialPayment(false); }
  };

  const handlePaySessionPartial = async (session?: Session) => {
    if (!canPartialPayment(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    const target = session || selectedSession;
    if (!selectedBill || !target) return;
    const amount = parseFloat(sessionPaymentAmount);
    if (isNaN(amount) || amount <= 0) { showNotification(t('billing.notifications.invalidAmount'), 'error'); return; }
    const sid = target._id || target.id;
    const sp = selectedBill.sessionPayments?.find(p => p.sessionId === sid);
    const totalCost = sp?.sessionCost || target.finalCost || target.totalCost || 0;
    const paid = sp?.paidAmount || 0;
    const remaining = target.status === 'active' ? totalCost - paid : (sp?.remainingAmount !== undefined ? sp.remainingAmount : totalCost - paid);
    if (amount > remaining) { showNotification(t('billing.notifications.amountExceedsRemaining', { amount: formatCurrency(amount), remaining: formatCurrency(remaining) }), 'error'); return; }
    setSelectedSession(target);
    setSessionToPayData({ session: target, amount: sessionPaymentAmount, method: sessionPaymentMethod });
    setShowSessionPaymentConfirmModal(true);
  };

  const confirmSessionPayment = async () => {
    if (!selectedBill || !sessionToPayData) return;
    try {
      setIsProcessingSessionPayment(true);
      const result = await api.paySessionPartial(selectedBill.id || selectedBill._id, {
        sessionId: sessionToPayData.session._id || sessionToPayData.session.id,
        amount: parseFloat(sessionToPayData.amount), paymentMethod: sessionToPayData.method,
      });
      if (result.success && result.data) {
        setBills(prev => prev.map(b => String(b._id || b.id) === String(selectedBill._id || selectedBill.id) ? result.data : b));
        setSelectedBill(result.data as Bill);
        setShowSessionPaymentConfirmModal(false); setSessionToPayData(null);
        setIsProcessingSessionPayment(false); setSessionPaymentAmount(''); setSelectedSession(null);
        scheduleBackgroundRefetch(true);
        showNotification(t('billing.notifications.sessionPaymentSuccess'), 'success');
      } else {
        showNotification(result.message || t('billing.notifications.sessionPaymentError'), 'error');
        setIsProcessingSessionPayment(false); setShowSessionPaymentConfirmModal(false);
      }
    } catch { showNotification(t('billing.notifications.sessionPaymentError'), 'error'); setIsProcessingSessionPayment(false); setShowSessionPaymentConfirmModal(false); }
  };

  const handleEndSession = async (sessionId: string) => {
    // ابحث عن الفاتورة الحاوية للجلسة لتحديد إن كانت مرتبطة بطاولة
    const billForSession = bills.find((b: any) => (b.sessions || []).some((s: any) => String(s._id || s.id) === String(sessionId)));
    const isLinked = !!(billForSession?.table || selectedBill?.table || selectedTable);
    if (!isLinked) {
      const session = (billForSession?.sessions || selectedBill?.sessions || []).find((s: any) => String(s._id || s.id) === String(sessionId));
      setCustomerNameForEndSession((session as any)?.customerName || '');
    } else setCustomerNameForEndSession('');
    setSessionToEnd(sessionId); setShowSessionEndModal(true);
  };

  const confirmSessionEnd = async () => {
    if (!sessionToEnd) return;
    const endedSessionId = sessionToEnd;
    // حدد الفاتورة الحاوية — قد تكون من sessions tab وليس selectedBill
    const billForSession = bills.find((b: any) => (b.sessions || []).some((s: any) => String(s._id || s.id) === String(endedSessionId)));
    const targetBill = (selectedBill?.sessions?.some((s: any) => String(s._id || s.id) === String(endedSessionId)) ? selectedBill : billForSession) as Bill | null;
    const linked = !!(targetBill?.table || billForSession?.table || selectedTable);
    if (!linked && !customerNameForEndSession.trim()) { showNotification(t('billing.notifications.customerNameRequired'), 'error'); return; }
    setIsEndingSession(true);
    // بيانات الجلسة قبل الإنهاء — للتراجع والتحديث المتفائل
    const endedSession = (targetBill as any)?.sessions?.find((s: any) => String(s._id || s.id) === String(endedSessionId));
    const optimisticCost = endedSession ? getSessionCost(endedSession) : 0;
    try {
      const result = await api.endSession(endedSessionId, customerNameForEndSession.trim() || undefined);
      if (result?.success) {
        setShowSessionEndModal(false); setSessionToEnd(null); setCustomerNameForEndSession('');
        setIsEndingSession(false);
        showNotification(t('billing.notifications.endSessionSuccess'), 'success');
        setPaymentAmount(''); setPaymentMethod('cash'); setPaymentReference('');

        // ⚡ تحديث متفائل — إنهاء الجلسة محلياً فوراً بدون انتظار السيرفر
        if (targetBill && endedSession) {
          const now = new Date();
          const patchBill = (b: any) => ({
            ...b,
            sessions: (b.sessions || []).map((s: any) =>
              (s._id || s.id) === endedSessionId
                ? { ...s, status: 'completed', endTime: now, totalCost: optimisticCost, finalCost: optimisticCost - (s.discount || 0) }
                : s),
            sessionPayments: (b.sessionPayments || []).map((sp: any) =>
              sp.sessionId === endedSessionId && sp.remainingAmount === undefined
                ? { ...sp, sessionCost: optimisticCost, remainingAmount: Math.max(0, optimisticCost - (sp.paidAmount || 0)) }
                : sp),
          });
          const bid = targetBill._id || targetBill.id;
          setBills(prev => prev.map(b => ((b._id || b.id) === bid ? patchBill(b) : b)));
          setSelectedBill(prev => (prev && ((prev._id || prev.id) === bid) ? (patchBill(prev) as Bill) : prev));
        }

        // ↩️ خيار التراجع — إعادة فتح جلسة جديدة بنفس الإعدادات على نفس الفاتورة
        if (endedSession && targetBill) {
          const s = endedSession;
          const billId = String(targetBill._id || targetBill.id);
          setUndoRequest({
            message: `تم إنهاء جلسة ${s.deviceName || s.deviceNumber}`,
            action: async () => {
              try {
                await api.createSessionWithExistingBill({
                  deviceType: s.deviceType,
                  deviceNumber: Number(s.deviceNumber) || 0,
                  deviceName: s.deviceName,
                  customerName: s.customerName,
                  controllers: s.controllers || 1,
                  billId,
                } as any);
                showNotification('تمت إعادة فتح الجلسة', 'success');
              } catch { showNotification('تعذر إعادة فتح الجلسة', 'error'); }
              scheduleBackgroundRefetch(true);
            },
          });
        }
const billId = (targetBill as any)?.id || (targetBill as any)?._id || selectedBill?.id || selectedBill?._id;

        invalidateTablesCache();
        scheduleBackgroundRefetch(true);
        if (billId) {
          api.getBill(billId as string).then(r => { if (r?.data) setSelectedBill(r.data); }).catch(() => {});
        }
      } else { showNotification(t('billing.notifications.endSessionError'), 'error'); setIsEndingSession(false); }
    } catch { showNotification(t('billing.notifications.endSessionUnexpectedError'), 'error'); setIsEndingSession(false); }
  };

  // ── إنهاء كل جلسات الطاولة دفعة واحدة ────────────────────────────────────
  const handleEndAllSessions = useCallback((table: Table, e: React.MouseEvent) => {
    e.stopPropagation();
    const tid = String((table as any)._id || table.id || '');
    const info = sessionUrgencyByTable.get(tid);
    if (!info || info.sessions.length === 0) { showNotification(t('billing.noActiveSessions', 'لا توجد جلسات نشطة'), 'error'); return; }
    setEndAllTarget({ table, sessions: info.sessions });
  }, [sessionUrgencyByTable]);

  const confirmEndAllSessions = async () => {
    if (!endAllTarget) return;
    setIsEndingAll(true);
    const ended = endAllTarget.sessions.map(s => ({ ...s }));
    const billId = String(endAllTarget.sessions[0]?._billObj?._id || endAllTarget.sessions[0]?._billId || '');
    try {
      let ok = 0;
      for (const s of ended) {
        try { const r = await api.endSession(String(s._id || s.id)); if (r?.success) ok++; } catch { /* التالي */ }
      }
      setIsEndingAll(false);
      if (ok > 0) {
        showNotification(`تم إنهاء ${ok} جلسة`, 'success');
        // ⚡ تحديث متفائل محلي
        setBills(prev => prev.map(b => {
          const bid = String((b as any)._id || b.id);
          if (!ended.some(s => String((b.table as any)?._id || b.table) === String((endAllTarget.table as any)._id || endAllTarget.table.id)) ) return b;
          return {
            ...b,
            sessions: (b.sessions || []).map((bs: any) => {
              const match = ended.find(s => String(s._id || s.id) === String(bs._id || bs.id));
              if (!match || bs.status !== 'active') return bs;
              const cost = getSessionCost(bs);
              return { ...bs, status: 'completed', endTime: new Date(), totalCost: cost, finalCost: cost - (bs.discount || 0) };
            }),
          };
        }));
        // ↩️ تراجع — إعادة فتح كل الجلسات المنتهية
        setUndoRequest({
          message: `تم إنهاء ${ok} جلسة على ${getTableDisplay(endAllTarget.table.number, i18n.language)}`,
          action: async () => {
            for (const s of ended) {
              try {
                await api.createSessionWithExistingBill({
                  deviceType: s.deviceType,
                  deviceNumber: Number(s.deviceNumber) || 0,
                  deviceName: s.deviceName,
                  customerName: s.customerName,
                  controllers: s.controllers || 1,
                  billId,
                } as any);
              } catch { /* التالي */ }
            }
            showNotification('تمت إعادة فتح الجلسات', 'success');
            scheduleBackgroundRefetch(true);
          },
        });
      } else {
        showNotification(t('billing.notifications.endSessionError'), 'error');
      }
      setEndAllTarget(null);
      scheduleBackgroundRefetch(true);
    } catch {
      setIsEndingAll(false); setEndAllTarget(null);
      showNotification(t('billing.notifications.endSessionUnexpectedError'), 'error');
    }
  };

  // ── Callbacks مستقرة لـ TableButton — تمنع إعادة رسم الكروت غير الضرورية ──
  const stableTableClick = useCallback((tb: Table) => { lastFocusedTableRef.current = tb; handleTableClick(tb); }, []);
  const stableQuickOrder = useCallback((tb: Table, e: React.MouseEvent) => { lastFocusedTableRef.current = tb; handleQuickOrder(tb, e); }, []);
  const stableQuickBilling = useCallback((tb: Table, e: React.MouseEvent) => { lastFocusedTableRef.current = tb; handleQuickBilling(tb, e); }, [handleQuickBilling]);
  const stableHoverChange = useCallback((tb: Table | null) => { lastFocusedTableRef.current = tb; }, []);

  const handleQuickPrint = useCallback(async (tb: Table, e: React.MouseEvent) => {
    e.stopPropagation();
    const bills = tableCardData.get((tb._id || (tb as any).id).toString())?.tBills || [];
    const unpaid = bills.filter((b: any) => ['draft', 'partial', 'overdue'].includes(b.status));
    if (unpaid.length === 0) { showNotification('لا توجد فاتورة غير مدفوعة', 'error'); return; }
    try {
      const r = await api.getBill(unpaid[0].id || unpaid[0]._id);
      if (r.success && r.data) await printBill(r.data, user?.organizationName, i18n.language, t, getTableSectionName(tb));
    } catch { showNotification('خطأ في الطباعة', 'error'); }
  }, [tableCardData, user, i18n.language, t]);

  const stableQuickPrint = useCallback((tb: Table, e: React.MouseEvent) => { handleQuickPrint(tb, e); }, [handleQuickPrint]);

  const handleCancelBill = async () => {
    if (!canDeleteBill(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    if (!selectedBill) return;
    try {
      setIsCancelingBill(true);
      const result = await api.deleteBill(selectedBill.id || selectedBill._id);
      if (result?.success) {
        const delId = String(selectedBill._id || (selectedBill as any).id);
        setBills(prev => prev.filter(b => String(b._id || (b as any).id) !== delId));
        setShowCancelConfirmModal(false); handleClosePaymentModal(); setIsCancelingBill(false);
        showNotification(t('billing.notifications.deleteBillSuccess'), 'success');
        scheduleBackgroundRefetch(true);
      } else { showNotification(t('billing.notifications.deleteBillError'), 'error'); setIsCancelingBill(false); }
    } catch { showNotification(t('billing.notifications.deleteBillUnexpectedError'), 'error'); setIsCancelingBill(false); }
  };

  const handleOpenChangeTableModal = (bill: Bill) => {
    setSelectedBill(bill); setShowChangeTableModal(true); setNewTableNumber(null); setTableChangeSearch('');
  };

  const handleChangeTable = async () => {
    if (!selectedBill || newTableNumber === null) return;
    setIsChangingTable(true);
    try {
      const targetTable = tables.find((t: any) => t._id === newTableNumber);
      if (!targetTable) { showNotification(t('billing.notifications.tableNotFound'), 'error'); return; }
      const result = await api.updateBill(selectedBill.id || selectedBill._id, { table: targetTable._id });
      if (result?.success && result.data) {
        showNotification(t('billing.notifications.tableChangeSuccess', { tableNumber: targetTable?.number || newTableNumber }), 'success');
        setShowChangeTableModal(false); setNewTableNumber(null); setTableChangeSearch('');
        const returnedId = ((result.data as any).id || (result.data as any)._id) as string;
        // تحديث متفائل — لو حدث دمج نحذف القديم ونحدث بالجديد
        const oldId = String(selectedBill._id || (selectedBill as any).id);
        if (String(returnedId) !== oldId) {
          setBills(prev => prev.filter(b => String(b._id || (b as any).id) !== oldId).map(b => String(b._id || (b as any).id) === String(returnedId) ? result.data : b));
        } else {
          setBills(prev => prev.map(b => String(b._id || (b as any).id) === oldId ? result.data : b));
        }
        setSelectedBill(result.data);
        scheduleBackgroundRefetch(true);
      } else { showNotification(t('billing.notifications.tableChangeError'), 'error'); }
    } catch (error: any) {
      showNotification(`❌ ${error?.response?.data?.message || error?.message || t('billing.notifications.unexpectedError')}`, 'error');
    } finally { setIsChangingTable(false); }
  };

  const handleQuickChangeTable = useCallback((tb: Table, e: React.MouseEvent) => {
    e.stopPropagation();
    const bills = tableCardData.get((tb._id || (tb as any).id).toString())?.tBills || [];
    const unpaid = bills.filter((b: any) => ['draft', 'partial', 'overdue'].includes(b.status));
    if (unpaid.length === 0) { showNotification('لا توجد فاتورة غير مدفوعة', 'error'); return; }
    handleOpenChangeTableModal(unpaid[0]);
  }, [tableCardData, handleOpenChangeTableModal]);

  const stableQuickChangeTable = useCallback((tb: Table, e: React.MouseEvent) => { handleQuickChangeTable(tb, e); }, [handleQuickChangeTable]);

  const handleQuickEditBill = useCallback((tb: Table, e: React.MouseEvent) => {
    e.stopPropagation();
    lastFocusedTableRef.current = tb;
    const bills = tableCardData.get((tb._id || (tb as any).id).toString())?.tBills || [];
    const firstUnpaid = bills.find((b: any) => ['draft','partial','overdue'].includes(b.status));
    if (!firstUnpaid) { showNotification('لا توجد فاتورة غير مدفوعة', 'error'); return; }
    if (!canEditOrder(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    setBillToEdit(firstUnpaid);
    setShowBillItemsEditModal(true);
  }, [tableCardData, user, t]);

  const stableQuickEditBill = useCallback((tb: Table, e: React.MouseEvent) => { handleQuickEditBill(tb, e); }, [handleQuickEditBill]);

  const handleEditSessionTime = (session: Session) => {
    if (!canEditSessionTime(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    setSessionToEdit(session);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    setEditSessionStartTime(fmt(new Date(session.startTime)));
    setEditSessionEndTime(fmt(session.endTime ? new Date(session.endTime) : new Date()));
    setShowEditSessionTimeModal(true);
  };

  const handleSaveSessionTime = async () => {
    if (!sessionToEdit) return;
    setIsEditingSessionTime(true);
    try {
      const start = new Date(editSessionStartTime);
      const end = new Date(editSessionEndTime);
      if (end <= start) { showNotification(t('gaming.notifications.endTimeBeforeStart'), 'error'); setIsEditingSessionTime(false); return; }
      const response = await api.updateSessionTimes(sessionToEdit.id || sessionToEdit._id, { startTime: start.toISOString(), endTime: end.toISOString() });
      if (response.success) {
        showNotification(t('billing.notifications.sessionTimeUpdated'), 'success');
        setShowEditSessionTimeModal(false); setSessionToEdit(null);
        // تحديث الفاتورة والكروت فوراً في الخلفية
        scheduleBackgroundRefetch();
        // تحديث الفاتورة المفتوحة بدون انتظار
        if (selectedBill) {
          api.getBill(selectedBill.id || selectedBill._id).then(r => {
            if (r?.data) { setSelectedBill(r.data); setPaymentAmount(r.data.remaining?.toString() || '0'); setOriginalAmount(r.data.remaining?.toString() || '0'); }
          }).catch(() => {});
        }
      } else { showNotification(response.message || t('billing.notifications.sessionTimeUpdateFailed'), 'error'); }
    } catch (error: any) { showNotification(error.message || t('billing.notifications.sessionTimeUpdateFailed'), 'error'); }
    finally { setIsEditingSessionTime(false); }
  };

  const handleEditControllersPeriod = (session: Session, period: any, index: number) => {
    setSessionToEdit(session); setPeriodToEdit(period); setPeriodIndex(index);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    setEditPeriodStartTime(fmt(new Date(period.from)));
    setEditPeriodEndTime(fmt(period.to ? new Date(period.to) : new Date()));
    setShowEditControllersPeriodModal(true);
  };

  const handleSaveControllersPeriod = async () => {
    if (!sessionToEdit || !periodToEdit || periodIndex === -1) return;
    setIsEditingPeriod(true);
    try {
      const start = new Date(editPeriodStartTime);
      const end = new Date(editPeriodEndTime);
      if (end <= start) { showNotification(t('gaming.notifications.endTimeBeforeStart'), 'error'); setIsEditingPeriod(false); return; }
      const response = await api.updateControllersPeriodTime(sessionToEdit.id || sessionToEdit._id, periodIndex, start.toISOString(), end.toISOString(), true);
      if (response.success) {
        showNotification(t('billing.notifications.periodTimeUpdated'), 'success');
        setShowEditControllersPeriodModal(false); setSessionToEdit(null); setPeriodToEdit(null); setPeriodIndex(-1);
        // تحديث في الخلفية فوراً
        scheduleBackgroundRefetch();
        if (selectedBill) {
          api.getBill(selectedBill.id || selectedBill._id).then(r => {
            if (r?.data) { setSelectedBill(r.data); setPaymentAmount(r.data.remaining?.toString() || '0'); setOriginalAmount(r.data.remaining?.toString() || '0'); }
          }).catch(() => {});
        }
      } else { showNotification(response.message || t('billing.notifications.periodTimeUpdateFailed'), 'error'); }
    } catch (error: any) { showNotification(error.message || t('billing.notifications.periodTimeUpdateFailed'), 'error'); }
    finally { setIsEditingPeriod(false); }
  };

  const handleEditSessionPayment = (session: Session, payment: any, paymentIndex: number) => {
    if (!canEditPartialPayment(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    setPaymentToEdit({ session, payment, paymentIndex });
    setEditPaymentAmount(payment.amount.toString()); setEditPaymentMethod(payment.method); setEditPaymentReference(payment.reference || '');
    setShowEditPaymentModal(true);
  };

  const handleSaveEditedPayment = async () => {
    if (!paymentToEdit || !selectedBill) return;
    if (!canEditPartialPayment(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    const newAmount = parseFloat(editPaymentAmount);
    if (isNaN(newAmount) || newAmount <= 0) { showNotification(t('billing.editPayment.invalidAmount'), 'error'); return; }
    setIsEditingPayment(true);
    try {
      const sid = paymentToEdit.session._id || paymentToEdit.session.id;
      const response = await api.updateSessionPayment(selectedBill.id || selectedBill._id, sid, paymentToEdit.paymentIndex, { amount: newAmount, method: editPaymentMethod, reference: editPaymentReference });
      if (response.success) {
        showNotification(t('billing.editPayment.success'), 'success');
        setShowEditPaymentModal(false); setPaymentToEdit(null);
        if (response.data) {
          setBills(prev => prev.map(b => String(b._id || (b as any).id) === String(selectedBill._id || (selectedBill as any).id) ? response.data : b));
          setSelectedBill(response.data as Bill);
        }
        scheduleBackgroundRefetch(true);
      } else { showNotification(response.message || t('billing.editPayment.error'), 'error'); }
    } catch (error: any) { showNotification(error.message || t('billing.editPayment.error'), 'error'); }
    finally { setIsEditingPayment(false); }
  };

  const handleEditItemPayment = (data: any, _displayIndex: number) => {
    if (!canEditPartialPayment(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    const { itemPayment, payment, paymentIdx } = data;
    setItemPaymentToEdit({ itemPayment, payment, paymentIndex: paymentIdx, itemPaymentId: itemPayment._id || itemPayment.id });
    setEditItemPaymentAmount(payment.quantity.toString()); setEditItemPaymentMethod(payment.method || 'cash'); setEditItemPaymentReference(payment.reference || '');
    setShowEditItemPaymentModal(true);
  };

  const handleSaveEditedItemPayment = async () => {
    if (!itemPaymentToEdit || !selectedBill) return;
    if (!canEditPartialPayment(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    const newQty = parseFloat(editItemPaymentAmount);
    if (isNaN(newQty) || newQty < 0) { showNotification(t('billing.editPayment.invalidQuantity'), 'error'); return; }
    if (!Number.isInteger(newQty)) { showNotification(t('billing.editPayment.quantityMustBeInteger'), 'error'); return; }
    setIsEditingItemPayment(true);
    try {
      const response = await api.updateItemPayment(selectedBill.id || selectedBill._id, itemPaymentToEdit.itemPaymentId, itemPaymentToEdit.paymentIndex, { quantity: newQty, method: editItemPaymentMethod, reference: editItemPaymentReference });
      if (response.success) {
        showNotification(newQty === 0 ? t('billing.editPayment.paymentDeleted') : t('billing.editPayment.success'), 'success');
        setShowEditItemPaymentModal(false); setItemPaymentToEdit(null);
        // تحديث فوري بدون انتظار
        if (response.data) setSelectedBill(response.data as Bill);
        Promise.all([fetchBills(), fetchTables()]).then(() => {
          if (showPaymentModal && selectedBill) {
            api.getBill(selectedBill.id || selectedBill._id).then(r => { if (r?.data) setSelectedBill(r.data); }).catch(() => {});
          }
        }).catch(() => {});
      } else { showNotification(response.message || t('billing.editPayment.error'), 'error'); }
    } catch (error: any) { showNotification(error.message || t('billing.editPayment.error'), 'error'); }
    finally { setIsEditingItemPayment(false); }
  };

  const updateBillStatus = async (billId: string) => {
    try {
      const hasActive = selectedBill ? hasActiveSession(selectedBill) : false;
      const billPaid = selectedBill?.paid || 0;
      const billRemaining = selectedBill?.remaining || 0;
      let newStatus: 'draft' | 'partial' | 'paid' | 'cancelled' | 'overdue';
      if (billRemaining === 0 && !hasActive) newStatus = 'paid';
      else if (hasActive) newStatus = 'partial';
      else if (billPaid > 0) newStatus = 'partial';
      else newStatus = 'draft';
      const result = await api.updateBill(billId, { status: newStatus });
      if (result?.data) setSelectedBill(result.data);
      return newStatus;
    } catch { showNotification(t('billing.notifications.updateBillStatusError'), 'error'); return null; }
  };


  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className={`space-y-1 sm:space-y-2 ${isFullscreen ? 'fixed inset-0 z-[100] bg-white dark:bg-gray-900 overflow-y-auto p-4' : '-mx-4 sm:-mx-6'}`}>

      {/* ── Payment Success Animation (#3) ── */}
      {showPaymentSuccessAnim && (
        <ModalPortal>
        <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
          <div className="animate-ping-once flex flex-col items-center justify-center">
            <div className="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center shadow-2xl animate-bounce-once">
              <CheckCircle className="h-20 w-20 text-white" />
            </div>
            <span className="mt-4 text-4xl font-bold text-green-600 bg-white dark:bg-gray-900 px-6 py-2 rounded-full shadow-xl">
              ✅ تم الدفع بنجاح!
            </span>
          </div>
          {/* Confetti-style dots */}
          {[...Array(16)].map((_, i) => (
            <div key={i} className="absolute w-3 h-3 rounded-full animate-confetti"
              style={{
                background: ['#f97316','#22c55e','#3b82f6','#a855f7','#ec4899','#facc15'][i % 6],
                left: `${Math.random()*100}%`, top: `${Math.random()*100}%`,
                animationDelay: `${i * 0.08}s`,
              }} />
          ))}
        </div>
        </ModalPortal>
      )}

      {/* -- Sticky Departments Bar: ??????? ????? ???? ?????? ?? ????? -- */}
      <div className="sticky top-0 z-30 px-4 sm:px-6 py-2.5 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-orange-200 dark:border-orange-800 shadow-sm">
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 w-full">
            <button
              onClick={() => { scrollToTop(); setActiveSectionFilter('all'); }}
              className={"flex-shrink-0 w-20 sm:w-24 h-20 sm:h-24 flex flex-col items-center justify-center gap-1 rounded-xl border-2 text-xs sm:text-sm font-bold transition-all " + (activeSectionFilter === 'all'
                ? 'bg-blue-600 border-blue-700 text-white shadow-md scale-[1.02]'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:shadow-sm')}>
              <span className="text-xl sm:text-2xl leading-none">🗂️</span>
              <span className="truncate max-w-full px-1 text-[11px] sm:text-xs leading-tight">الكل</span>
              <span className={"text-[10px] px-1.5 py-0.5 rounded-full font-bold " + (activeSectionFilter === 'all' ? 'bg-white/25 text-white' : 'bg-blue-100 dark:bg-gray-700 text-blue-700 dark:text-gray-300')}>{activeTables.length}</span>
            </button>
            {activeTableSections.map(sec => {
              const cnt = (getTablesBySection[sec.id] || []).length;
              const occ = (getTablesBySection[sec.id] || []).filter(tb => tableStatuses[String((tb as any)._id || (tb as any).id)]?.hasUnpaid).length;
              if (cnt === 0) return null;
              const isActive = activeSectionFilter === sec.id;
              return (
                <button key={sec.id}
                  onClick={() => { scrollToTop(); setActiveSectionFilter(sec.id); }}
                  className={"flex-shrink-0 w-20 sm:w-24 h-20 sm:h-24 flex flex-col items-center justify-center gap-1 rounded-xl border-2 text-xs sm:text-sm font-bold transition-all " + (isActive
                    ? 'bg-blue-600 border-blue-700 text-white shadow-md scale-[1.02]'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:shadow-sm')}>
                  <span className="text-xl sm:text-2xl leading-none">🪑</span>
                  <span className="truncate max-w-full px-1 text-[11px] sm:text-xs leading-tight">{sec.name}</span>
                  <span className={"text-[10px] px-1.5 py-0.5 rounded-full font-bold " + (isActive ? 'bg-white/25 text-white' : occ > 0 ? 'bg-red-100 dark:bg-gray-700 text-red-600 dark:text-red-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400')}>
                    {occ > 0 ? occ + ' مشغولة' : cnt + ' طاولة'}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-5xl mx-auto pt-2 mt-2 border-t border-gray-200 dark:border-gray-700/60">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {([
                { id: 'all', label: 'الكل', icon: '🗂️' },
                { id: 'occupied', label: 'مشغولة', icon: '🔴' },
                { id: 'empty', label: 'فارغة', icon: '🟢' },
                { id: 'sessions', label: 'جلسات', icon: '⏱️' },
              ] as const).map(f => (
                <button key={f.id}
                  onClick={() => { scrollToTop(); setTableStatusFilter(f.id); }}
                  className={"px-2.5 py-1 rounded-full border text-xs font-bold transition-all flex items-center gap-1 " + (tableStatusFilter === f.id
                    ? 'bg-indigo-600 border-indigo-700 text-white shadow-md'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-indigo-400 hover:shadow-sm')}>
                  <span className="text-xs leading-none">{f.icon}</span>
                  <span>{f.label}</span>
                </button>
              ))}
              <button
                onClick={() => setSoundEnabledState(!soundEnabled)}
                title={soundEnabled ? 'إيقاف صوت الجلسات' : 'تفعيل صوت الجلسات'}
                className={"px-2.5 py-1 rounded-full border text-xs font-bold transition-all flex items-center gap-1 " + (soundEnabled ? 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300' : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 opacity-70')}>
                <span className="text-xs leading-none">🔔</span>
                <span className="hidden sm:inline">{soundEnabled ? 'الصوت: متاح' : 'الصوت: كتم'}</span>
              </button>
            </div>
            <div className="relative w-full sm:w-64 flex-shrink-0">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={tableSearch}
                  onChange={e => { setTableSearch(e.target.value); scrollToTop(); }}
                placeholder="ابحث عن طاولة بالأرقام..."
                className="w-full pr-9 pl-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Table Grid ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="p-1 sm:p-1">
          {loading && tableSections.length === 0 ? (
            <div className="text-center py-8 text-gray-500">{t('common.loading')}</div>
          ) : tableSections.length === 0 ? (
            <div className="text-center py-8 text-gray-500">{t('cafe.noSections')}</div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {filteredSectionsForDisplay.map(section => {
                const shownTables = (getTablesBySection[section.id] || []).filter(matchesTableFilter);
                if (shownTables.length === 0) return null;
                return (
                  <div key={section.id} className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-2.5 sm:p-3 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 shadow-md">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 sm:mb-3 flex items-center gap-2">
                      <div className="w-1 h-5 sm:h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full flex-shrink-0"></div>
                      <span className="truncate">{section.name}</span>
                      <span className="text-sm text-gray-400 font-normal">({shownTables.length})</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-1.5 sm:gap-2">
                      {shownTables.map(table => {
                        const tableIdStr = (table._id || (table as any).id).toString();
                        // استخدام tableCardData المحسوبة مسبقاً بدلاً من O(N×M) في الـ render
                        const cardData = tableCardData.get(tableIdStr);
                        const sessInfo = sessionUrgencyByTable.get(tableIdStr);
                        return (
                          <div key={table.id} className="[content-visibility:auto] [contain-intrinsic-size:auto_140px]">
                            <TableButton
                              table={table}
                              isSelected={selectedTable?.id === table.id && showUnifiedTableModal}
                              isOccupied={tableStatuses[String((table as any)._id || table.id)]?.hasUnpaid || false}
                              tableBills={cardData?.tBills || []}
                              tableOrdersCount={cardData?.tOrdersCount || 0}
                              activeSessionType={cardData?.activeSessionType || null}
                              activeSessionCount={sessInfo?.count || 0}
                              sessionUrgency={sessInfo?.urgency || 'none'}
                              liveExtra={cardData?.liveExtra || 0}
                              onClick={stableTableClick}
                              onQuickOrder={stableQuickOrder}
                              onQuickBilling={stableQuickBilling}
                              onQuickPrint={stableQuickPrint}
                              onQuickChangeTable={stableQuickChangeTable}
                              onQuickEditBill={stableQuickEditBill}
                              onEndAllSessions={handleEndAllSessions}
                              onHoverChange={stableHoverChange}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Gaming Devices Section - ???? ??? ??? ???? ???? ???? ??? ?????? ?????? ── */}
      {(billTypeFilter === 'all' || billTypeFilter === 'playstation' || billTypeFilter === 'computer') && hasStandaloneActiveGaming && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl shadow-lg border-2 border-blue-200 dark:border-blue-700 p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <button onClick={() => setIsPlaystationSectionCollapsed(!isPlaystationSectionCollapsed)}
                className="p-1.5 sm:p-2 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-lg transition-all">
                {isPlaystationSectionCollapsed ? <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" /> : <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />}
              </button>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center truncate">
                <span className="text-2xl ml-2">🎯</span>{t('billing.gamingDevices.title')}
              </h2>
            </div>
            {!isPlaystationSectionCollapsed && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <div className="flex gap-1 sm:gap-2">
                  {(['all', 'playstation', 'computer'] as const).map(type => (
                    <button key={type} onClick={() => setGamingDeviceTypeFilter(type)}
                      className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-base sm:text-lg font-medium transition-colors ${gamingDeviceTypeFilter === type ? (type === 'all' ? 'bg-purple-500 text-white' : type === 'playstation' ? 'bg-blue-500 text-white' : 'bg-indigo-500 text-white') : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                      {type === 'all' ? `🎯 ${t('billing.filters.all')}` : type === 'playstation' ? `🎮 ${t('billing.gamingDevices.playstation')}` : `💻 ${t('billing.gamingDevices.computer')}`}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 sm:gap-2">
                  {(['unpaid', 'paid', 'all'] as const).map(s => (
                    <button key={s} onClick={() => setPlaystationStatusFilter(s)}
                      className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-base sm:text-lg font-medium transition-colors ${playstationStatusFilter === s ? (s === 'unpaid' ? 'bg-orange-500 text-white' : s === 'paid' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white') : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                      {s === 'unpaid' ? t('billing.filters.unpaid') : s === 'paid' ? t('billing.filters.paid') : t('billing.filters.all')}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                  <input type="text" placeholder={t('billing.searchDevice')} value={playstationSearchQuery} onChange={e => setPlaystationSearchQuery(e.target.value)}
                    className="pr-8 sm:pr-10 pl-3 sm:pl-4 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 text-base sm:text-lg" />
                </div>
              </div>
            )}
          </div>
          {!isPlaystationSectionCollapsed && (() => {
            // استخدام gamingDeviceData المحسوبة في useMemo بدلاً من الحسابات المضمّنة
            const visibleDevices = Array.from(gamingDeviceData.values()).map(d => {
              let fb = d.bills;
              if (playstationStatusFilter === 'unpaid') fb = d.bills.filter(b => ['draft', 'partial', 'overdue'].includes(b.status));
              else if (playstationStatusFilter === 'paid') fb = d.bills.filter(b => b.status === 'paid');
              return { ...d, bills: fb };
            }).filter(d => {
              const matchSearch = d.deviceName.toLowerCase().includes(playstationSearchQuery.toLowerCase());
              const matchType = gamingDeviceTypeFilter === 'all' || d.deviceType === gamingDeviceTypeFilter;
              const hasBills = playstationStatusFilter === 'all' ? (d.hasActiveSession || d.bills.length > 0) : d.bills.length > 0;
              return matchSearch && matchType && hasBills;
            });
            if (visibleDevices.length === 0) return (
              <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-gray-400">
                <p className="text-lg sm:text-xl">{playstationSearchQuery ? t('billing.noSearchResults') : t('billing.noActiveDevices', { deviceType: t('billing.gamingDevices.gaming') })}</p>
              </div>
            );
            return (
              <div className="space-y-3 sm:space-y-4">
                {visibleDevices.map((deviceData, index) => {
                  const collapsed = collapsedDevices.has(deviceData.deviceName);
                  const icon = deviceData.deviceType === 'computer' ? '💻' : '🎮';
                  const color = deviceData.deviceType === 'computer' ? 'indigo' : 'blue';
                  return (
                    <div key={index} className={`border-2 border-${color}-200 dark:border-${color}-700 rounded-xl p-3 sm:p-5 bg-white dark:bg-gray-800 shadow-md`}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <button onClick={() => setCollapsedDevices(prev => { const n = new Set(prev); n.has(deviceData.deviceName) ? n.delete(deviceData.deviceName) : n.add(deviceData.deviceName); return n; })}
                            className={`p-1.5 sm:p-2 hover:bg-${color}-100 dark:hover:bg-${color}-900 rounded-lg transition-all`}>
                            {collapsed ? <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" /> : <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />}
                          </button>
                          <span className="text-2xl sm:text-3xl flex-shrink-0">{icon}</span>
                          <h3 className="font-bold text-lg sm:text-xl text-gray-900 dark:text-gray-100 truncate">{deviceData.deviceName}</h3>
                          {deviceData.hasActiveSession && <span className="px-2 sm:px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-base font-bold rounded-full shadow-md animate-pulse">{icon} {t('billing.activeSession')}</span>}
                        </div>
                        {deviceData.bills.length > 0 && (
                          <div className="text-base sm:text-lg font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 px-2 sm:px-3 py-1 rounded-full">
                            {formatDecimal(deviceData.bills.length, i18n.language)} {deviceData.bills.length === 1 ? t('billing.bill') : t('billing.bills')}
                          </div>
                        )}
                      </div>
                      {!collapsed && deviceData.bills.length > 0 && (
                        <div className="space-y-2">
                          {deviceData.bills.map((bill: Bill) => (
                            <PlaystationBillItem key={bill.id || bill._id} bill={bill}
                              onPaymentClick={(b) => { setSelectedTable(null); handlePaymentClick(b); }}
                              onChangeTableClick={handleOpenChangeTableModal}
                              getStatusColor={getStatusColor} getStatusText={getStatusText} formatCurrency={formatCurrency} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Stats cards (admin only) ── */}
      {user?.role !== 'staff' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Total tables */}
          <div className="group bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl shadow-lg hover:shadow-2xl p-4 sm:p-6 text-white transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-base sm:text-lg font-medium mb-1 sm:mb-2">{t('cafe.totalTables')}</p>
                <p className="text-2xl sm:text-3xl font-bold">{formatDecimal(tableStats.totalTables, i18n.language)}</p>
              </div>
              <div className="bg-white/20 rounded-full p-2 sm:p-4"><TableIcon className="h-5 w-5 sm:h-8 sm:w-8" /></div>
            </div>
          </div>
          {/* Collected */}
          <div className="group bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 rounded-xl shadow-lg hover:shadow-2xl p-4 sm:p-6 text-white transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-base sm:text-lg font-medium mb-1 sm:mb-2">{t('billing.statistics.collectedAmount')}</p>
                <p className="text-xl sm:text-2xl font-bold">{showPaidAmount ? formatCurrency(billStats.totalPaid) : '••••••'}</p>
              </div>
              <button onClick={() => setShowPaidAmount(!showPaidAmount)} className="bg-white/20 rounded-full p-2 sm:p-4 hover:bg-white/30 transition-all">
                {showPaidAmount ? <EyeOff className="h-5 w-5 sm:h-8 sm:w-8" /> : <Eye className="h-5 w-5 sm:h-8 sm:w-8" />}
              </button>
            </div>
          </div>
          {/* Remaining */}
          <div className="group bg-gradient-to-br from-orange-500 to-red-600 dark:from-orange-600 dark:to-red-700 rounded-xl shadow-lg hover:shadow-2xl p-4 sm:p-6 text-white transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-base sm:text-lg font-medium mb-1 sm:mb-2">{t('billing.statistics.remainingAmount')}</p>
                <p className="text-xl sm:text-2xl font-bold">{showRemainingAmount ? formatCurrency(billStats.totalRemaining) : '••••••'}</p>
              </div>
              <button onClick={() => setShowRemainingAmount(!showRemainingAmount)} className="bg-white/20 rounded-full p-2 sm:p-4 hover:bg-white/30 transition-all">
                {showRemainingAmount ? <EyeOff className="h-5 w-5 sm:h-8 sm:w-8" /> : <Eye className="h-5 w-5 sm:h-8 sm:w-8" />}
              </button>
            </div>
          </div>
          {/* Occupied */}
          <div className="group bg-gradient-to-br from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 rounded-xl shadow-lg hover:shadow-2xl p-4 sm:p-6 text-white transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-base sm:text-lg font-medium mb-1 sm:mb-2">{t('cafe.occupiedTables')}</p>
                <p className="text-2xl sm:text-3xl font-bold">{formatDecimal(tableStats.occupiedTables, i18n.language)}</p>
              </div>
              <div className="bg-white/20 rounded-full p-2 sm:p-4"><AlertTriangle className="h-5 w-5 sm:h-8 sm:w-8" /></div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          UNIFIED TABLE MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {showUnifiedTableModal && selectedTable && (() => {
        // ── بيانات الطاولة ──────────────────────────────────────────
        const tableId = String(selectedTable._id || (selectedTable as any).id);
        const tBills = (tableBillsMap as any)[tableId]?.bills || [];
        const unpaidBills = tBills.filter((b: Bill) => ['draft','partial','overdue'].includes(b.status));
        // السيرفر يحسب الفاتورة حية — نستخدم القيم مباشرة (تتحدث عبر fetch كل 10 ثوانٍ)
        void tick;
        const unpaidTotal     = unpaidBills.reduce((s: number, b: Bill) => s + (Number(b.total) || 0), 0);
        const unpaidPaid      = unpaidBills.reduce((s: number, b: Bill) => s + (Number(b.paid) || 0), 0);
        const unpaidRemaining = unpaidBills.reduce((s: number, b: Bill) => s + (Number(b.remaining) || 0), 0);
        const hasUnpaid = unpaidBills.length > 0;

        // جلسات من الفواتير غير المدفوعة فقط مع حقل _billObj للرجوع للفاتورة
        const allSessions = unpaidBills.flatMap((b: Bill) =>
          ((b as any).sessions || []).map((s: any) => ({ ...s, _billId: b._id || (b as any).id, _billNumber: (b as any).billNumber, _billObj: b }))
        );
        const sessionsCount       = allSessions.length;
        const activeSessionsCount = allSessions.filter((s: any) => s.status === 'active').length;

        // إجماليات الجلسات — التكلفة من finalCost/totalCost للمنتهية، حساب فوري للنشطة
        const sessionsTotalCost = allSessions.reduce((sum: number, sess: any) =>
          sum + getSessionCost(sess), 0);
        const sessionsPaid = unpaidBills.reduce((sum: number, b: Bill) => {
          const sps: any[] = (b as any).sessionPayments || [];
          return sum + sps.reduce((ss: number, sp: any) => ss + (Number(sp.paidAmount) || 0), 0);
        }, 0);
        const sessionsRemaining = Math.max(0, sessionsTotalCost - sessionsPaid);

        const sideItems = [
          { id: 'orders',   icon: ShoppingCart, label: 'الطلبات',  count: filteredTableOrders.length, color: 'orange' },
          { id: 'billing',  icon: Receipt,      label: 'الفواتير', count: unpaidBills.length,          color: 'blue',  dot: unpaidBills.length > 0 },
          { id: 'sessions', icon: Gamepad2,      label: 'الجلسات', count: sessionsCount,               color: 'purple', dot: activeSessionsCount > 0 },
          { id: 'log',      icon: History,       label: 'السجل',   count: tableActivityLog.length,     color: 'gray' },
        ] as const;

        const colorMap: Record<string, { active: string; activeBg: string; dot: string; icon: string; accent: string }> = {
          orange: { active: 'text-orange-600 dark:text-orange-400', activeBg: 'bg-orange-500', dot: 'bg-orange-500', icon: 'text-orange-400 dark:text-orange-500', accent: 'border-orange-500' },
          blue:   { active: 'text-blue-600 dark:text-blue-400',     activeBg: 'bg-blue-500',   dot: 'bg-red-500',    icon: 'text-blue-400 dark:text-blue-500',   accent: 'border-blue-500' },
          purple: { active: 'text-purple-600 dark:text-purple-400', activeBg: 'bg-purple-500', dot: 'bg-green-500',  icon: 'text-purple-400 dark:text-purple-500', accent: 'border-purple-500' },
          gray:   { active: 'text-gray-700 dark:text-gray-200',     activeBg: 'bg-gray-500',   dot: 'bg-gray-400',   icon: 'text-gray-400',                       accent: 'border-gray-400' },
        };

        const closeModal = () => { setShowUnifiedTableModal(false); setSelectedTable(null); setTableBillsFilter('unpaid'); setSearchQuery(''); setSearchResults(null); setPinnedOrder(null); };

        return (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex flex-col lg:flex-row items-center justify-center z-[300] p-2 sm:p-4 gap-4 overflow-y-auto"
          onClick={closeModal}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
            onClick={e => e.stopPropagation()}>

            {/* ══ HEADER ══ */}
            <div className="flex-shrink-0 bg-gradient-to-l from-slate-800 via-gray-900 to-slate-900 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                {/* اليسار: أيقونة + اسم الطاولة */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/20">
                    <TableIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-white leading-tight">
                        طاولة {getTableDisplay(selectedTable.number, i18n.language)}
                      </h2>
                      {(() => {
                        const sec = typeof selectedTable.section === 'object'
                          ? (selectedTable.section as any)?.name
                          : tableSections.find((s: any) => s._id === selectedTable.section || s.id === selectedTable.section)?.name;
                        return sec ? <span className="text-base text-gray-400 font-medium">· {sec}</span> : null;
                      })()}
                      <span className={`text-base px-2.5 py-0.5 rounded-full font-bold border ${
                        hasUnpaid
                          ? 'bg-red-500/15 text-red-300 border-red-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {hasUnpaid ? '● مشغولة' : '○ فارغة'}
                      </span>
                    </div>
                    {/* ── الإجماليات: تظهر فقط عند وجود فواتير غير مدفوعة ── */}
                    {hasUnpaid && (
                      <div className="flex items-center gap-4 mt-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-white/40 inline-block"></span>
                          <span className="text-base text-gray-400">إجمالي</span>
                          <span className="text-base font-bold text-white">{formatCurrency(unpaidTotal)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                          <span className="text-base text-gray-400">مدفوع</span>
                          <span className="text-base font-bold text-emerald-400">{formatCurrency(unpaidPaid)}</span>
                        </div>
                        {unpaidRemaining > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block animate-pulse"></span>
                            <span className="text-base text-gray-400">متبقي</span>
                            <span className="text-base font-bold text-red-400">{formatCurrency(unpaidRemaining)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {/* زر الإغلاق */}
                <button onClick={closeModal}
                  className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-white/70 hover:text-white transition-all flex-shrink-0 border border-white/10">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ── BODY: sidebar + content ── */}
            <div className="flex-1 flex overflow-hidden min-h-0">

              {/* ══ SIDEBAR ══ */}
              <div className="w-[72px] flex-shrink-0 flex flex-col bg-gray-50 dark:bg-gray-800/80 border-l border-gray-200 dark:border-gray-700/60 py-2 gap-1">
                {sideItems.map(item => {
                  const isActive = activeTab3 === item.id;
                  const cfg = colorMap[item.color];
                  const Icon = item.icon;
                  return (
                    <button key={item.id}
                      onClick={() => { setActiveTab3(item.id as any); if (item.id !== 'log' && item.id !== 'sessions') setActiveTab(item.id as any); }}
                      className={`relative flex flex-col items-center gap-1 py-3 mx-1.5 rounded-xl text-[10px] font-semibold transition-all duration-200
                        ${isActive
                          ? `bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600 ${cfg.active}`
                          : `text-gray-400 dark:text-gray-500 hover:bg-white/60 dark:hover:bg-gray-700/50 hover:text-gray-600 dark:hover:text-gray-300`
                        }`}>
                      {/* شريط جانبي للعنصر النشط */}
                      {isActive && (
                        <span className={`absolute right-0 top-2 bottom-2 w-0.5 rounded-l-full ${cfg.activeBg}`} />
                      )}
                      <div className="relative">
                        <Icon className={`h-[18px] w-[18px] ${isActive ? '' : cfg.icon}`} />
                        {item.count > 0 && !isActive && (
                          <span className={`absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] ${cfg.dot} text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none shadow-sm`}>
                            {item.count > 9 ? '9+' : item.count}
                          </span>
                        )}
                        {(item as any).dot && isActive && (
                          <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 ${cfg.dot} rounded-full animate-pulse border-2 border-white dark:border-gray-700`} />
                        )}
                      </div>
                      <span className="text-center leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Content area */}
              <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-gray-50 dark:bg-gray-900">

                {/* ══ ORDERS TAB ══ */}
                {activeTab3 === 'orders' && (
                  <>
                    <div className="flex-1 overflow-y-auto p-3 min-h-0">
                      {filteredTableOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400">
                          <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center mb-4 border border-orange-100 dark:border-orange-800">
                            <ShoppingCart className="h-8 w-8 text-orange-300" />
                          </div>
                          <p className="font-semibold text-gray-500 text-lg">{t('cafe.tableOrdersModal.noOrders')}</p>
                          <p className="text-base text-gray-400 mt-1 text-center px-4">{t('cafe.tableOrdersModal.clickNewOrder')}</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredTableOrders.map(order => {
                            const total = order.finalAmount ?? order.totalAmount ?? order.items?.reduce((s: number, i: any) => s + (i.price || 0) * (i.quantity || 0), 0) ?? 0;
                            const statusCfg: Record<string, { color: string; label: string; dot: string }> = {
                              pending:   { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',     label: 'معلق',   dot: 'bg-amber-400' },
                              preparing: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',         label: 'يُحضَّر', dot: 'bg-blue-400' },
                              ready:     { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',     label: 'جاهز',   dot: 'bg-green-400' },
                              delivered: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', label: 'سُلِّم', dot: 'bg-emerald-400' },
                              cancelled: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',             label: 'ملغي',   dot: 'bg-red-400' },
                              draft:     { color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',            label: 'مسودة',  dot: 'bg-gray-400' },
                            };
                            const sc = statusCfg[order.status] || statusCfg.draft;
                            const orderTime = order.createdAt ? formatDateTime(order.createdAt) : '';
                            return (
                              <div key={order.id} className={`bg-white dark:bg-gray-800 rounded-xl border overflow-hidden transition-all group cursor-pointer ${pinnedOrder?.id === order.id ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-200/80 dark:border-gray-700/60 hover:border-gray-300'}`}
                                onClick={() => { if (pinnedOrder?.id === order.id) setPinnedOrder(null); else setPinnedOrder(order); }}>
                                <div className={`h-0.5 ${sc.dot}`} />
                                <div className="flex items-center gap-2.5 px-3 py-2.5">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                      <span className="font-bold text-gray-900 dark:text-gray-100 text-lg">#{order.orderNumber}</span>
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${sc.color}`}>{sc.label}</span>
                                      {orderTime && <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1"><Clock className="h-3 w-3" />{orderTime}</span>}
                                    </div>
                                    {order.items && order.items.length > 0 && (
                                      <p className="text-base text-gray-400 dark:text-gray-500 truncate">
                                        {(order.items as any[]).slice(0,3).map((i: any) => `${i.name} ×${i.quantity}`).join(' · ')}
                                        {order.items.length > 3 && <span className="text-gray-400"> +{order.items.length - 3}</span>}
                                      </p>
                                    )}
                                  </div>
                                  <span className="font-bold text-orange-600 dark:text-orange-400 text-lg flex-shrink-0">{formatCurrency(total)}</span>
                                  <div className="flex items-center gap-0.5 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); handlePrintOrder(order); }} title={t('cafe.tableOrdersModal.print')}
                                      className="w-7 h-7 flex items-center justify-center hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all text-gray-400">
                                      <Printer className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleEditOrder(order); }} title={t('cafe.tableOrdersModal.edit')}
                                      className="w-8 h-8 flex items-center justify-center bg-green-100 dark:bg-green-900/40 text-green-600 hover:bg-green-200 dark:hover:bg-green-800 rounded-lg transition-all shadow-sm">
                                      <Edit className="h-4 w-4" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order); }} title={t('cafe.tableOrdersModal.delete')}
                                      className="w-7 h-7 flex items-center justify-center hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all text-gray-400">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-2.5 border-t border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 flex-shrink-0 flex gap-2">
                      {canAddOrder(user) ? (
                        <button onClick={handleAddOrder}
                          className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xl font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm">
                          <Plus className="h-5 w-5" />{t('cafe.tableOrdersModal.newOrder')}
                        </button>
                      ) : <PermissionDenied size="small" message={t('users.permissions.canAddOrderDesc')} />}
                      {hasUnpaid && (
                        <button onClick={() => handlePaymentManagement(selectedTable)}
                          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-lg font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm">
                          <DollarSign className="h-4 w-4" />{t('cafe.tableOrdersModal.paymentManagement')}
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* ══ BILLING TAB ══ */}
                {activeTab3 === 'billing' && (
                  <>
                    {/* فلتر + بحث */}
                    <div className="px-3 py-2 bg-white dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60 flex items-center gap-2 flex-shrink-0">
                      <select value={tableBillsFilter} onChange={e => setTableBillsFilter(e.target.value)}
                        className="flex-1 text-base border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-blue-400 outline-none min-w-0">
                        <option value="all">الكل</option>
                        <option value="unpaid">غير مدفوعة</option>
                        <option value="paid">مدفوعة</option>
                        <option value="partial">جزئية</option>
                      </select>
                      <div className="relative flex-1 min-w-0">
                        <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                          placeholder="بحث..." className="w-full pr-7 pl-2 py-1.5 text-base border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-blue-400" />
                      </div>
                      {searchQuery && (
                        <button onClick={() => { setSearchQuery(''); setSearchResults(null); }} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {/* زر سريع تعديل الفاتورة - يفتح مباشرة */}
                      {(() => {
                        const src2 = (tableBillsMap as any)[tableId]?.bills || [];
                        const firstUnpaid = src2.find((b: Bill) => ['draft','partial','overdue'].includes(b.status));
                        if (!firstUnpaid || !canEditOrder(user)) return null;
                        return (
                          <button onClick={() => { setBillToEdit(firstUnpaid); setShowBillItemsEditModal(true); }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg flex items-center gap-1.5 flex-shrink-0 shadow-sm">
                            <Edit className="h-3.5 w-3.5" />تعديل
                          </button>
                        );
                      })()}
                    </div>

                    {/* إجماليات شرطية: تظهر فقط إذا الفلتر مش "unpaid" أو عند البحث */}
                    {(() => {
                      const src = searchResults !== null ? searchResults : ((tableBillsMap as any)[tableId]?.bills || []);
                      const filtered = src.filter((b: Bill) => {
                        if (tableBillsFilter === 'all') return true;
                        if (tableBillsFilter === 'unpaid') return ['draft','partial','overdue'].includes(b.status);
                        return b.status === tableBillsFilter;
                      });
                      const showSummary = (tableBillsFilter !== 'unpaid' || searchResults !== null) && filtered.length > 0;
                      if (!showSummary) return null;
                      void tick;
                      const fTotal     = filtered.reduce((s: number, b: Bill) => s + (Number(b.total) || 0), 0);
                      const fPaid      = filtered.reduce((s: number, b: Bill) => s + (Number(b.paid) || 0), 0);
                      const fRemaining = filtered.reduce((s: number, b: Bill) => s + (Number(b.remaining) || 0), 0);
                      return (
                        <div className="flex-shrink-0 px-3 py-2 bg-blue-50/60 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/30 flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"></span>
                            <span className="text-[10px] text-gray-500">إجمالي</span>
                            <span className="text-base font-bold text-gray-700 dark:text-gray-300">{formatCurrency(fTotal)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                            <span className="text-[10px] text-gray-500">مدفوع</span>
                            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(fPaid)}</span>
                          </div>
                          {fRemaining > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block"></span>
                              <span className="text-[10px] text-gray-500">متبقي</span>
                              <span className="text-base font-bold text-red-600 dark:text-red-400">{formatCurrency(fRemaining)}</span>
                            </div>
                          )}
                          <span className="mr-auto text-[10px] text-gray-400">{filtered.length} فاتورة</span>
                        </div>
                      );
                    })()}

                    <div className="flex-1 overflow-y-auto p-3 min-h-0">
                      {(() => {
                        const src = searchResults !== null ? searchResults : ((tableBillsMap as any)[tableId]?.bills || []);
                        const filtered = src.filter((b: Bill) => {
                          if (tableBillsFilter === 'all') return true;
                          if (tableBillsFilter === 'unpaid') return ['draft','partial','overdue'].includes(b.status);
                          return b.status === tableBillsFilter;
                        });
                        if (!filtered.length) return (
                          <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
                            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-3 border border-blue-100 dark:border-blue-800">
                              <Receipt className="h-7 w-7 text-blue-300" />
                            </div>
                            <p className="text-lg font-medium text-gray-500">{t('billing.noBills')}</p>
                          </div>
                        );
                        return (
                          <div className="space-y-2">
                            {filtered.map((bill: Bill) => {
                              const isUnpaid = ['draft','partial','overdue'].includes(bill.status);
                              const hasSessions = ((bill as any).sessions?.length || 0) > 0;
                              const billTime = (bill as any).createdAt ? formatDateTime((bill as any).createdAt) : '';
                              void tick;
                              const liveTotal = Number(bill.total) || 0;
                              const liveRemaining = Number(bill.remaining) || 0;
                              return (
                                <div key={bill.id || bill._id}
                                  className={`bg-white dark:bg-gray-800 rounded-xl border overflow-hidden transition-all hover:shadow-md group cursor-pointer
                                    ${isUnpaid ? 'border-orange-200 dark:border-orange-800/60 hover:border-orange-300' : 'border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-300'}`}
                                  onClick={() => handlePaymentClick(bill)}>
                                  <div className={`h-0.5 ${isUnpaid ? 'bg-gradient-to-l from-orange-400 to-amber-400' : 'bg-gradient-to-l from-emerald-400 to-green-400'}`} />
                                  <div className="flex items-center gap-2.5 px-3 py-2.5">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="font-bold text-lg text-gray-900 dark:text-gray-100">#{bill.billNumber || (bill.id || bill._id)?.toString().slice(-6)}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${getStatusColor(bill.status)}`}>{getStatusText(bill.status)}</span>
                                        {hasSessions && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 flex items-center gap-0.5"><Gamepad2 className="h-2.5 w-2.5" />{(bill as any).sessions?.length}</span>}
                                        {hasSessions && (bill as any).sessions?.some((s: any) => s.status === 'active') && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" title="تحديث لحظي كل 10 ثوانٍ" />}
                                      </div>
                                      {billTime && <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-1"><Clock className="h-3 w-3" />{billTime}</div>}
                                      <div className="flex items-center gap-3 text-base">
                                        <span className="text-gray-500">إجمالي: <strong className="text-gray-800 dark:text-gray-200">{formatCurrency(liveTotal)}</strong></span>
                                        <span className="text-emerald-600 dark:text-emerald-400">مدفوع: <strong>{formatCurrency(Number(bill.paid)||0)}</strong></span>
                                        {liveRemaining > 0 && <span className="text-red-600 dark:text-red-400 font-bold">متبقي: {formatCurrency(liveRemaining)}</span>}
                                      </div>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0 opacity-90 group-hover:opacity-100 transition-opacity">
                                      {/* تعديل أصناف الفاتورة مجمعة - زر واضح */}
                                      {canEditOrder(user) && ['draft','partial','overdue'].includes(bill.status) && (
                                        <button onClick={e => { e.stopPropagation(); setBillToEdit(bill); setShowBillItemsEditModal(true); }}
                                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg flex items-center gap-1 shadow-sm" title="تعديل الأصناف">
                                          <Edit className="h-3.5 w-3.5" />تعديل
                                        </button>
                                      )}
                                      {isUnpaid && (
                                        <button onClick={e => { e.stopPropagation(); setPayChoiceBill(bill); setShowPayChoiceModal(true); }}
                                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold rounded-lg flex items-center gap-1 transition-all whitespace-nowrap">
                                          <DollarSign className="h-3 w-3" />دفع
                                        </button>
                                      )}
                                      <button onClick={async e => { e.stopPropagation(); try { const r = await api.getBill(bill.id || bill._id); if (r.success && r.data) await printBill(r.data, user?.organizationName, i18n.language, t, getTableSectionName(bill.table)); } catch {} }}
                                        className="w-7 h-7 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-lg flex items-center justify-center transition-all">
                                        <Printer className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}

                {/* ══ SESSIONS TAB ══ */}
                {activeTab3 === 'sessions' && (
                  <>
                    {/* ملخص الجلسات — يظهر فقط إذا في جلسات */}
                    {sessionsCount > 0 && (
                      <div className="flex-shrink-0 px-3 py-2 bg-white dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60 flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"></span>
                          <span className="text-[10px] text-gray-500">إجمالي</span>
                          <span className="text-base font-bold text-gray-700 dark:text-gray-300">{formatCurrency(sessionsTotalCost)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                          <span className="text-[10px] text-gray-500">مدفوع</span>
                          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(sessionsPaid)}</span>
                        </div>
                        {sessionsRemaining > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block"></span>
                            <span className="text-[10px] text-gray-500">متبقي</span>
                            <span className="text-base font-bold text-red-600 dark:text-red-400">{formatCurrency(sessionsRemaining)}</span>
                          </div>
                        )}
                        <span className="mr-auto text-[10px] text-gray-400 flex items-center gap-1">
                          {activeSessionsCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>}
                          {activeSessionsCount > 0 ? `${activeSessionsCount} نشطة · ` : ''}{sessionsCount} جلسة
                        </span>
                      </div>
                    )}
                    <div className="flex-1 overflow-y-auto p-3 min-h-0">
                      {allSessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400">
                          <div className="w-16 h-16 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center mb-4 border border-purple-100 dark:border-purple-800">
                            <Gamepad2 className="h-8 w-8 text-purple-300" />
                          </div>
                          <p className="text-lg font-medium text-gray-500">لا توجد جلسات لهذه الطاولة</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {allSessions.map((session: any, idx: number) => {
                            const isActive    = session.status === 'active';
                            const isCompleted = session.status === 'completed';
                            const isPS        = (session.deviceType || '').includes('playstation');
                            const icon        = isPS ? '🎮' : '💻';

                            // ── التكلفة الصحيحة (حساب فوري للجلسات النشطة) — تتحدث كل 10 ثوانٍ ──
                            void tick;
                            const cost = getSessionCost(session);

                            // ── المدة ──
                            const startMs  = session.startTime ? new Date(session.startTime).getTime() : 0;
                            const endMs    = session.endTime   ? new Date(session.endTime).getTime()   : Date.now();
                            const durMs    = startMs ? Math.max(0, endMs - startMs) : 0;
                            const durH     = Math.floor(durMs / 3600000);
                            const durM     = Math.floor((durMs % 3600000) / 60000);
                            const durStr   = durH > 0 ? `${durH}س ${durM}د` : `${durM}د`;
                            const startStr = session.startTime ? new Date(session.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—';
                            const endStr   = session.endTime   ? new Date(session.endTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'جارية';

                            // ── المدفوع/المتبقي من sessionPayments ──
                            const sessId         = session._id || session.id;
                            const billForSession = tBills.find((b: Bill) =>
                              (b as any)._id === session._billId || (b as any).id === session._billId
                            );
                            const sp          = (billForSession as any)?.sessionPayments?.find(
                              (p: any) => p.sessionId === sessId || p.session === sessId
                            );
                            const spPaid      = Number(sp?.paidAmount) || 0;
                            const spRemaining = isActive
                              ? Math.max(0, cost - spPaid)
                              : sp ? Math.max(0, sp.remainingAmount !== undefined && sp.remainingAmount !== null ? Number(sp.remainingAmount) : (cost - spPaid)) : Math.max(0, cost - spPaid);

                            return (
                              <div key={sessId || idx}
                                className={`bg-white dark:bg-gray-800 rounded-xl border overflow-hidden transition-all hover:shadow-md
                                  ${isActive ? 'border-green-300 dark:border-green-700' : 'border-gray-200 dark:border-gray-700/60'}`}>
                                {/* شريط علوي */}
                                <div className={`h-1 ${isActive ? 'bg-gradient-to-l from-green-400 to-emerald-500 animate-pulse' : isCompleted ? 'bg-gray-200 dark:bg-gray-600' : 'bg-amber-300'}`} />
                                <div className="px-3 py-2.5 space-y-2">
                                  {/* صف العنوان */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xl leading-none">{icon}</span>
                                      <div>
                                        <p className="font-bold text-lg text-gray-900 dark:text-gray-100 leading-tight">
                                          {session.deviceName || `جهاز ${session.deviceNumber || ''}`}
                                        </p>
                                        <p className="text-[10px] text-gray-400">{isPS ? 'بلايستيشن' : 'كمبيوتر'}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {session._billNumber && (
                                        <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                          #{session._billNumber}
                                        </span>
                                      )}
                                      <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                                        isActive    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                        isCompleted ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' :
                                                      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                      }`}>
                                        {isActive ? '● نشطة' : isCompleted ? '✓ منتهية' : session.status}
                                      </span>
                                    </div>
                                  </div>
                                  {/* الوقت والمدة */}
                                  <div className="flex items-center gap-3 text-[11px] text-gray-500">
                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{startStr} → {endStr}</span>
                                    <span className="font-semibold text-gray-600 dark:text-gray-400">⏱ {durStr}</span>
                                    {session.controllers > 0 && <span>🕹 {session.controllers} دراعة</span>}
                                  </div>
                                  {/* الملخص المالي */}
                                  <div className="flex items-stretch gap-2 bg-gray-50 dark:bg-gray-700/40 rounded-xl p-2">
                                    <div className="flex-1 text-center">
                                      <p className="text-[10px] text-gray-400 mb-0.5">الاجمالي</p>
                                      <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{formatCurrency(cost)}</p>
                                    </div>
                                    <div className="w-px bg-gray-200 dark:bg-gray-600" />
                                    <div className="flex-1 text-center">
                                      <p className="text-[10px] text-gray-400 mb-0.5">مدفوع</p>
                                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(spPaid)}</p>
                                    </div>
                                    <div className="w-px bg-gray-200 dark:bg-gray-600" />
                                    <div className="flex-1 text-center">
                                      <p className="text-[10px] text-gray-400 mb-0.5">متبقي</p>
                                      <p className={`text-lg font-bold ${spRemaining > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        {formatCurrency(spRemaining)}
                                      </p>
                                    </div>
                                    {(isActive || spRemaining > 0) && (
                                      <>
                                        <div className="w-px bg-gray-200 dark:bg-gray-600" />
                                        <div className="flex flex-col gap-1 justify-center pl-1">
                                          {isActive && billForSession && (
                                            <button onClick={() => handleEndSession(sessId)}
                                              className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold rounded-lg transition-all whitespace-nowrap">
                                              ⏹ إنهاء
                                            </button>
                                          )}
                                          {billForSession && spRemaining > 0 && !isActive && (
                                            <button onClick={async () => { const r = await api.getBill(billForSession._id || (billForSession as any).id); if (r?.data) setSelectedBill(r.data); else setSelectedBill(billForSession as Bill); setShowPaymentModal(true); setPaymentAmount(spRemaining.toString()); }}
                                              className="px-2.5 py-1 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold rounded-lg transition-all whitespace-nowrap">
                                              💵 دفع
                                            </button>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  {/* سجل الدراعات */}
                                  {isCompleted && session.controllersHistory && session.controllersHistory.length > 1 && (
                                    <div className="pt-1.5 border-t border-gray-100 dark:border-gray-700">
                                      <p className="text-[10px] text-gray-400 mb-1 flex items-center gap-1"><Gamepad2 className="h-2.5 w-2.5" />سجل الدراعات</p>
                                      <div className="space-y-0.5">
                                        {session.controllersHistory.map((period: any, pi: number) => (
                                          <div key={pi} className="flex items-center justify-between text-[10px] text-gray-500 bg-gray-50 dark:bg-gray-700/30 rounded px-2 py-0.5">
                                            <span>{period.controllers} دراعة</span>
                                            <span>{new Date(period.from).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})} — {period.to ? new Date(period.to).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}) : 'الآن'}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ══ LOG TAB ══ */}
                {activeTab3 === 'log' && (
                  <>
                    <div className="flex-1 overflow-y-auto p-3 bg-gray-50 dark:bg-gray-900 min-h-0">
                      {tableActivityLog.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
                          <CheckCircle className="h-10 w-10 mb-3 text-green-300" />
                          <p className="text-lg font-semibold text-gray-500">لا توجد فواتير مفتوحة</p>
                          <p className="text-base text-gray-400 mt-1">السجل يعرض الفواتير غير المدفوعة فقط</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {tableActivityLog.map((entry, idx) => {
                            const cfgMap: Record<string, { dot: string; border: string; bg: string; label: string; labelColor: string }> = {
                              bill:    { dot: 'bg-blue-500',   border: 'border-r-2 border-blue-400',   bg: 'bg-white dark:bg-gray-800',        label: 'فاتورة', labelColor: 'text-blue-600' },
                              order:   { dot: 'bg-orange-500', border: 'border-r-2 border-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', label: 'طلب',    labelColor: 'text-orange-600' },
                              payment: { dot: 'bg-green-500',  border: 'border-r-2 border-green-400',  bg: 'bg-green-50 dark:bg-green-900/20',  label: 'دفعة',   labelColor: 'text-green-600' },
                              session: { dot: entry.color === 'red' ? 'bg-red-500' : 'bg-purple-500', border: entry.color === 'red' ? 'border-r-2 border-red-400' : 'border-r-2 border-purple-400', bg: entry.color === 'red' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-purple-50 dark:bg-purple-900/20', label: 'جلسة', labelColor: entry.color === 'red' ? 'text-red-600' : 'text-purple-600' },
                            };
                            const cfg = cfgMap[entry.type] || cfgMap.bill;
                            const iconMap: Record<string, React.ReactNode> = {
                              bill: <Receipt className="h-3 w-3 text-white" />,
                              order: <ShoppingCart className="h-3 w-3 text-white" />,
                              payment: <DollarSign className="h-3 w-3 text-white" />,
                              session: <Gamepad2 className="h-3 w-3 text-white" />,
                            };
                            const [mainLine, subLine] = entry.message.split('\n');
                            return (
                              <div key={idx} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${cfg.bg} ${cfg.border} shadow-sm`}>
                                <div className={`flex-shrink-0 w-6 h-6 rounded-full ${cfg.dot} flex items-center justify-center`}>
                                  {iconMap[entry.type] || <Zap className="h-3 w-3 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={`text-base font-bold ${cfg.labelColor}`}>{cfg.label}</span>
                                    <span className="text-base text-gray-400">
                                      {entry.time.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                      {' • '}
                                      {entry.time.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                                    </span>
                                  </div>
                                  <p className="text-base text-gray-800 dark:text-gray-200 font-medium mt-0.5">{mainLine}</p>
                                  {subLine && <p className="text-base text-gray-500 mt-0.5">{subLine}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

              </div>
            </div>
          </div>
          {previewOrder && (
            <div
              className="flex w-full lg:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex-col overflow-hidden max-h-[96vh] lg:max-h-[96vh] max-h-[50vh] animate-in fade-in slide-in-from-right-4 flex-shrink-0"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-l from-orange-50 to-white dark:from-gray-700 dark:to-gray-800">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-lg"><Receipt className="h-4 w-4 text-orange-500" />طلب #{previewOrder.orderNumber}</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3" />{previewOrder.createdAt ? formatDateTime(previewOrder.createdAt) : ''} · مثبت</p>
                </div>
                <button onClick={() => setPinnedOrder(null)} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="إغلاق">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {(previewOrder.items as any[]).map((it: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-600">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-lg truncate">{it.name}</p>
                      {it.notes && <p className="text-base text-gray-500 dark:text-gray-400 truncate">ملاحظة: {it.notes}</p>}
                      <p className="text-base text-gray-400">{formatCurrency(it.price || 0)} × {it.quantity}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="bg-orange-500 text-white text-base font-bold rounded-full px-2 py-1">×{it.quantity}</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">{formatCurrency((it.price || 0) * (it.quantity || 0))}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-lg text-gray-500">الإجمالي</span>
                  <span className="font-bold text-orange-600 dark:text-orange-400 text-2xl">{formatCurrency((previewOrder as any).finalAmount ?? (previewOrder as any).totalAmount ?? (previewOrder.items as any[])?.reduce((s: number, i: any) => s + (i.price || 0) * (i.quantity || 0), 0) ?? 0)}</span>
                </div>
                {!pinnedOrder ? (
                  <p className="text-[11px] text-center text-gray-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg py-2">اضغط على الطلب لتثبيت النافذة والتحكم بها</p>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => handlePrintOrder(pinnedOrder)} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"><Printer className="h-4 w-4" />طباعة</button>
                    <button onClick={() => handleEditOrder(pinnedOrder)} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold rounded-xl flex items-center justify-center gap-1.5"><Edit className="h-4 w-4" />تعديل</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </ModalPortal>
        );
      })()}

      {/* ── Payment Modal — نفس شكل صفحة الفواتير ── */}
      <React.Suspense fallback={null}>
      <PaymentManagementModal
        isOpen={showPaymentModal}
        selectedBill={liveSelectedBill || selectedBill}
        user={user}
        paymentAmount={paymentAmount} setPaymentAmount={setPaymentAmount}
        originalAmount={originalAmount} setOriginalAmount={setOriginalAmount}
        discountPercentage={discountPercentage} setDiscountPercentage={setDiscountPercentage}
        paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
        paymentReference={paymentReference} setPaymentReference={setPaymentReference}
        isProcessingPayment={isProcessingPayment}
        handlePaymentSubmit={handlePaymentSubmit}
        handlePartialPayment={handlePartialPayment}
        handleEndSession={handleEndSession}
        handleEditItemPayment={handleEditItemPayment}
        handleClosePaymentModal={handleClosePaymentModal}
        setShowCancelConfirmModal={setShowCancelConfirmModal}
        setShowChangeTableModal={setShowChangeTableModal}
        setNewTableNumber={setNewTableNumber}
        setShowSessionPaymentModal={setShowSessionPaymentModal}
        setShowPaymentModal={setShowPaymentModal}
        setActiveTab={setActiveTab}
        setActiveTab3={setActiveTab3}
        getSessionCost={getSessionCost}
        formatCurrency={formatCurrency}
        showNotification={showNotification}
        roundingLabel={roundingMode === 'none' ? 'بدون' : roundingMode === 'half' ? '0.5' : '1'}
        onToggleRounding={cycleRounding}
        applyRounding={applyRounding}
        onSplitSubmit={handleSplitSubmit}
        tick={tick}
      />
      </React.Suspense>

      {/* ── شريط التراجع ── */}
      <UndoBar request={undoRequest} onExpire={() => setUndoRequest(null)} />

      {/* ── مؤشر الإدخال السريع (أرقام الطاولة) ── */}
      {quickDigits && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[400] bg-gray-900/95 dark:bg-gray-800/95 backdrop-blur-sm text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-gray-700">
          <span className="text-gray-400 text-lg">🔍</span>
          <span className="text-5xl font-extrabold tracking-widest font-mono" dir="ltr">{quickDigits}</span>
          <span className="text-gray-500 text-base mr-1">spa7i...</span>
        </div>
      )}

      {/* ── نافذة اختيار الطاولة عند تكرار الأسماء ── */}
      {quickPickerTables && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setQuickPickerTables(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-5 w-[90vw] max-w-md border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">اختر الطاولة</h3>
            <p className="text-lg text-gray-500 dark:text-gray-400 mb-4">عدة نتائج متطابقة — اختر واحدة:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {quickPickerTables.map(tb => (
                <button key={(tb._id || (tb as any).id) as string}
                  onClick={() => { setQuickPickerTables(null); lastFocusedTableRef.current = tb; handleTableClick(tb); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-right">
                  <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                    {getTableDisplay(tb.number, i18n.language)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{(tb as any).name || getTableDisplay(tb.number, i18n.language)}</p>
                    <p className="text-base text-gray-500 dark:text-gray-400">
                      رقم {getTableDisplay(tb.number, i18n.language)}
                      {(() => {
                        const secName = typeof (tb as any).section === 'object'
                          ? (tb as any)?.section?.name
                          : tableSections.find((s: any) => s._id === (tb as any).section || s.id === (tb as any).section)?.name;
                        return secName ? <span> • القسم: {secName}</span> : null;
                      })()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setQuickPickerTables(null)}
              className="w-full mt-4 py-2 text-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* ── تأكيد إنهاء كل جلسات الطاولة ── */}
      <ConfirmModal
        isOpen={!!endAllTarget}
        onClose={() => !isEndingAll && setEndAllTarget(null)}
        onConfirm={confirmEndAllSessions}
        title="إنهاء كل الجلسات"
        message={`سيتم إنهاء ${endAllTarget?.sessions.length || 0} جلسة على طاولة ${endAllTarget ? getTableDisplay(endAllTarget.table.number, i18n.language) : ''}. سيكون لديك 10 ثوانٍ للتراجع بعد التنفيذ.`}
        confirmText={isEndingAll ? 'جارٍ الإنهاء...' : 'إنهاء الكل'}
        cancelText={t('common.cancel')}
        confirmColor="bg-red-600 hover:bg-red-700"
        loading={isEndingAll}
      />

      {/* ── Partial Payment Modal ── */}
      <React.Suspense fallback={null}>
      <PartialPaymentModal
        key={`partial-${selectedBill?._id || selectedBill?.id}-${selectedBill?.itemPayments?.length || 0}-${selectedBill?.paid || 0}`}
        isOpen={showPartialPaymentModal} onClose={() => setShowPartialPaymentModal(false)}
        bill={selectedBill} onPaymentSubmit={handlePartialPaymentSubmit} isProcessing={isProcessingPartialPayment} />
      </React.Suspense>

      {/* ── Cancel Bill Confirm Modal ── */}
      <ConfirmModal isOpen={showCancelConfirmModal} onClose={() => !isCancelingBill && setShowCancelConfirmModal(false)}
        onConfirm={handleCancelBill}
        title={t('billing.confirmModals.deleteBillTitle')}
        message={t('billing.confirmModals.deleteBillMessage', { billNumber: selectedBill?.billNumber || selectedBill?.id || selectedBill?._id })}
        confirmText={isCancelingBill ? t('billing.confirmModals.deleteBillProcessing') : t('billing.confirmModals.deleteBillConfirm')}
        cancelText={t('billing.confirmModals.deleteBillCancel')} confirmColor="bg-red-600 hover:bg-red-700" loading={isCancelingBill} />

      {/* ── Pay Full Bill Confirm Modal ── */}
      <ConfirmModal isOpen={showPayFullBillConfirmModal} onClose={() => !isProcessingPayment && setShowPayFullBillConfirmModal(false)}
        onConfirm={confirmPayFullBill}
        title={t('billing.confirmModals.payFullBillTitle')}
        message={t('billing.confirmModals.payFullBillMessage', { billNumber: billToPayFull?.billNumber || billToPayFull?.id || billToPayFull?._id, amount: formatCurrency(billToPayFull?.remaining || 0), method: paymentMethod ? t(`billing.paymentMethod${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}`) : t('billing.paymentMethodCash') })}
        confirmText={isProcessingPayment ? t('billing.confirmModals.payFullBillProcessing') : t('billing.confirmModals.payFullBillConfirm')}
        cancelText={t('billing.confirmModals.payFullBillCancel')} confirmColor="bg-green-600 hover:bg-green-700" loading={isProcessingPayment} />

      {/* ── Session Payment Confirm Modal ── */}
      <ConfirmModal isOpen={showSessionPaymentConfirmModal} onClose={() => !isProcessingSessionPayment && setShowSessionPaymentConfirmModal(false)}
        onConfirm={confirmSessionPayment}
        title={t('billing.confirmModals.sessionPaymentTitle')}
        message={t('billing.confirmModals.sessionPaymentMessage', { device: sessionToPayData?.session?.deviceName || t('common.unknown'), amount: formatCurrency(parseFloat(sessionToPayData?.amount || '0')), method: sessionToPayData?.method ? t(`billing.paymentMethod${sessionToPayData.method.charAt(0).toUpperCase() + sessionToPayData.method.slice(1)}`) : t('billing.paymentMethodCash') })}
        confirmText={isProcessingSessionPayment ? t('billing.confirmModals.sessionPaymentProcessing') : t('billing.confirmModals.sessionPaymentConfirm')}
        cancelText={t('billing.confirmModals.sessionPaymentCancel')} confirmColor="bg-blue-600 hover:bg-blue-700" loading={isProcessingSessionPayment} />

      {/* ── Session End Modal ── */}
      {showSessionEndModal && sessionToEnd && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-[300]">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto p-3 sm:p-6 mx-2 sm:mx-0">
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">{t('billing.confirmModals.endSessionTitle')}</h3>
            {(() => {
              const billForModal = bills.find((b: any) => (b.sessions || []).some((s: any) => String(s._id || s.id) === String(sessionToEnd))) || selectedBill;
              const isLinkedModal = !!(billForModal?.table || selectedTable);
              return !isLinkedModal ? (
              <div className="mb-4">
                <label className="block text-base sm:text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">{t('billing.confirmModals.endSessionCustomerName')} <span className="text-red-500">*</span></label>
                <input type="text" value={customerNameForEndSession} onChange={e => setCustomerNameForEndSession(e.target.value)}
                  placeholder={t('billing.confirmModals.endSessionCustomerNamePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-gray-100" disabled={isEndingSession} />
              </div>
              ) : null;
            })()}
            <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 mb-4">{t('billing.confirmModals.endSessionMessage')}</p>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <button onClick={() => { if (!isEndingSession) { setShowSessionEndModal(false); setSessionToEnd(null); } }} disabled={isEndingSession}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-lg sm:text-xl">
                {t('billing.confirmModals.endSessionCancel')}
              </button>
              <button onClick={confirmSessionEnd} disabled={isEndingSession}
                className={`px-4 py-2 ${isEndingSession ? 'bg-red-700 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'} text-white rounded-lg transition-colors flex items-center justify-center gap-2 min-w-[100px] text-lg sm:text-xl`}>
                {isEndingSession ? <><svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>{t('billing.confirmModals.endSessionProcessing')}</> : t('billing.confirmModals.endSessionConfirm')}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Session Payment Modal ── */}
      {showSessionPaymentModal && selectedBill && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-[300]">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto mx-2 sm:mx-0">
            <div className="p-3 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">{t('billing.sessionPaymentModal.title')}</h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">{t('billing.sessionPaymentModal.subtitle')}</p>
              </div>
            </div>
            <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
              {selectedBill.sessions?.map((session: any) => {
                const sid = session._id || session.id;
                const sp = selectedBill.sessionPayments?.find(p => p.sessionId === sid);
                const isActive = session.status === 'active';
                const totalCost = sp?.sessionCost || getSessionCost(session);
                const paidAmt = sp?.paidAmount || 0;
                const remainingAmt = isActive ? totalCost - paidAmt : (sp?.remainingAmount !== undefined ? sp.remainingAmount : totalCost - paidAmt);
                const isFullyPaid = !isActive && remainingAmt <= 0;
                return (
                  <div key={sid} className={`border-2 rounded-xl p-3 sm:p-4 ${isFullyPaid ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20' : isActive ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20' : 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20'}`}>
                    <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isFullyPaid ? 'bg-gradient-to-br from-green-500 to-emerald-500' : isActive ? 'bg-gradient-to-br from-blue-500 to-cyan-500 animate-pulse' : 'bg-gradient-to-br from-orange-500 to-red-500'}`}>
                          <span className="text-2xl">{session.deviceType === 'playstation' ? '🎮' : '💻'}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100">{session.deviceName}</h4>
                          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{session.deviceType === 'playstation' ? t('billing.gamingDevices.playstation') : t('billing.gamingDevices.computer')}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        {isFullyPaid && <span className="px-2 sm:px-3 py-1 bg-green-500 text-white text-xs sm:text-sm font-bold rounded-full">✓ {t('billing.sessionPaymentModal.fullyPaid')}</span>}
                        {isActive && <span className="px-2 sm:px-3 py-1 bg-blue-500 text-white text-xs sm:text-sm font-bold rounded-full animate-pulse">⚡ {t('billing.sessionPaymentModal.activeSession')}</span>}
                        {session.status === 'completed' && !isFullyPaid && canEditSessionTime(user) && (
                          <button onClick={() => handleEditSessionTime(session)} className="px-2 sm:px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs sm:text-sm font-bold rounded-lg flex items-center gap-1">
                            <Calendar className="h-3 w-3" /><span className="hidden sm:inline">{t('billing.editTime')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
                      <div className="text-center p-2 bg-white dark:bg-gray-700 rounded-lg"><p className="text-xs text-gray-600 dark:text-gray-400">{t('billing.sessionPaymentModal.totalCost')}</p><p className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100">{formatCurrency(totalCost)}</p></div>
                      <div className="text-center p-2 bg-white dark:bg-gray-700 rounded-lg"><p className="text-xs text-gray-600 dark:text-gray-400">{t('billing.sessionPaymentModal.paid')}</p><p className="font-bold text-sm sm:text-base text-blue-600 dark:text-blue-400">{formatCurrency(paidAmt)}</p></div>
                      <div className="text-center p-2 bg-white dark:bg-gray-700 rounded-lg"><p className="text-xs text-gray-600 dark:text-gray-400">{t('billing.sessionPaymentModal.remaining')}</p><p className="font-bold text-sm sm:text-base text-red-600 dark:text-red-400">{formatCurrency(remainingAmt)}</p></div>
                    </div>
                    {!isFullyPaid && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input type="text" inputMode="numeric" placeholder={t('billing.sessionPaymentModal.amountPlaceholder')}
                          value={selectedSession?._id === sid || selectedSession?.id === sid ? sessionPaymentAmount : ''}
                          onChange={e => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) { setSessionPaymentAmount(v); setSelectedSession(session); } }}
                          className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base" />
                        <button onClick={async () => { await handlePaySessionPartial(session); }}
                          disabled={!canPartialPayment(user) || !sessionPaymentAmount || parseInt(sessionPaymentAmount) <= 0 || (selectedSession?._id !== sid && selectedSession?.id !== sid)}
                          className="px-4 sm:px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-sm sm:text-base whitespace-nowrap">
                          {t('billing.sessionPaymentModal.payButton')}
                        </button>
                      </div>
                    )}
                    {sp?.payments && sp.payments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{t('billing.sessionPaymentModal.previousPayments')}:</p>
                        <div className="space-y-1">
                          {sp.payments.map((payment: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-sm bg-white dark:bg-gray-700 p-2 rounded gap-2">
                              <span className="text-gray-600 dark:text-gray-400 truncate flex-1">{formatCurrency(payment.amount)} - {payment.method ? t(`billing.paymentMethod${payment.method.charAt(0).toUpperCase() + payment.method.slice(1)}`) : t('billing.paymentMethodCash')}</span>
                              {canEditPartialPayment(user) && (
                                <button onClick={() => handleEditSessionPayment(session, payment, idx)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium whitespace-nowrap">{t('common.edit')}</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="p-3 sm:p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button onClick={() => { setShowSessionPaymentModal(false); setSelectedSession(null); setSessionPaymentAmount(''); }}
                className="px-4 sm:px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors text-sm sm:text-base">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Change Table Modal ── */}
      {showChangeTableModal && selectedBill && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-[300]">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-3 sm:p-6 mx-2 sm:mx-0">
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">{t('billing.changeTableTitle')}</h3>
            <div className="mb-4">
              {newTableNumber && (() => { const st = tables.find((t: any) => t._id === newTableNumber); return st ? (<div className="mb-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/40 border border-blue-300 rounded-lg flex items-center justify-between"><span className="text-lg font-semibold text-blue-800 dark:text-blue-200">{t('billing.tableWithNumber', { number: getTableDisplay(st.number, i18n.language) })}{getTableSectionName(st) ? ` (${getTableSectionName(st)})` : ''} ✓</span><button onClick={() => { setNewTableNumber(null); setTableChangeSearch(''); }} className="text-base text-blue-600 dark:text-blue-400 hover:underline font-semibold">{t('common.cancel')}</button></div>) : null; })()}
              <div className="relative">
                <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
                <input type="text" value={tableChangeSearch} onChange={e => setTableChangeSearch(e.target.value)} placeholder={t('billing.searchTable') || 'بحث...'}
                  className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 text-lg ${isRTL ? 'pr-10' : 'pl-10'}`} disabled={isChangingTable} />
              </div>
              <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                {tables.filter((t: any) => t.isActive && t._id !== (selectedBill.table as any)?._id)
                  .filter((t: any) => !tableChangeSearch || String(t.number).toLowerCase().includes(tableChangeSearch.toLowerCase()))
                  .sort((a: any, b: any) => String(a.number).localeCompare(String(b.number), 'ar', { numeric: true }))
                  .map((table: any) => (
                    <button key={table._id} onClick={() => { setNewTableNumber(table._id); setTableChangeSearch(''); }} disabled={isChangingTable}
                      className={`w-full text-right px-3 py-2 text-lg transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/30 border-b border-gray-100 dark:border-gray-800 last:border-b-0 flex items-center justify-between gap-2 ${newTableNumber === table._id ? 'bg-blue-100 dark:bg-blue-900/50 font-semibold text-blue-800 dark:text-blue-200' : 'text-gray-700 dark:text-gray-300'}`}>
                      <span>{t('billing.tableWithNumber', { number: getTableDisplay(table.number, i18n.language) })}</span>
                      {(() => {
                        const sn = typeof table.section === 'object'
                          ? table.section?.name
                          : tableSections.find((s: any) => s._id === table.section || s.id === table.section)?.name;
                        return sn ? <span className="text-sm text-gray-400 dark:text-gray-500 text-right">{sn}</span> : null;
                      })()}
                    </button>
                  ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <button onClick={() => { setShowChangeTableModal(false); setNewTableNumber(null); setTableChangeSearch(''); }} disabled={isChangingTable}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-colors text-lg sm:text-xl">
                {t('common.cancel')}
              </button>
              <button onClick={handleChangeTable} disabled={isChangingTable || !newTableNumber}
                className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all text-white text-lg sm:text-xl ${isChangingTable || !newTableNumber ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isChangingTable ? <><svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>{t('billing.changing')}</> : t('billing.confirmChange')}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Edit Session Time Modal ── */}
      {showEditSessionTimeModal && sessionToEdit && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[300] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Calendar className="h-6 w-6 text-purple-600" />{t('billing.editSessionTime')}</h3>
              <button onClick={() => { setShowEditSessionTimeModal(false); setSessionToEdit(null); }} className="text-gray-500 hover:text-gray-700 dark:text-gray-400" disabled={isEditingSessionTime}><X className="h-6 w-6" /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg"><p className="text-lg font-medium text-gray-700 dark:text-gray-300">{sessionToEdit.deviceName}</p></div>
              <div>
                <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">{t('billing.startTime')}</label>
                <input type="datetime-local" value={editSessionStartTime} onChange={e => setEditSessionStartTime(e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-gray-100" disabled={isEditingSessionTime} />
              </div>
              <div>
                <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">{t('billing.endTime')}</label>
                <input type="datetime-local" value={editSessionEndTime} onChange={e => setEditSessionEndTime(e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-gray-100" disabled={isEditingSessionTime} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowEditSessionTimeModal(false); setSessionToEdit(null); }} disabled={isEditingSessionTime}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100">{t('common.cancel')}</button>
              <button onClick={handleSaveSessionTime} disabled={isEditingSessionTime}
                className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center ${isEditingSessionTime ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} text-white`}>
                {isEditingSessionTime ? <><svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>{t('common.saving')}</> : t('common.save')}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Edit Controllers Period Modal ── */}
      {showEditControllersPeriodModal && sessionToEdit && periodToEdit && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[300] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Gamepad2 className="h-6 w-6 text-purple-600" />{t('billing.editPeriodTime')}</h3>
              <button onClick={() => { setShowEditControllersPeriodModal(false); setSessionToEdit(null); setPeriodToEdit(null); setPeriodIndex(-1); }} className="text-gray-500 hover:text-gray-700" disabled={isEditingPeriod}><X className="h-6 w-6" /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg space-y-2">
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300">{sessionToEdit.deviceName}</p>
                <div className="flex items-center gap-2 text-base"><span className="font-bold text-purple-700 dark:text-purple-300">{formatDecimal(periodToEdit.controllers, i18n.language)} {t('billing.controllers')}</span></div>
              </div>
              <div>
                <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">{t('billing.startTime')}</label>
                <input type="datetime-local" value={editPeriodStartTime} onChange={e => setEditPeriodStartTime(e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-gray-100" disabled={isEditingPeriod} />
              </div>
              <div>
                <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">{t('billing.endTime')}</label>
                <input type="datetime-local" value={editPeriodEndTime} onChange={e => setEditPeriodEndTime(e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-gray-100" disabled={isEditingPeriod} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowEditControllersPeriodModal(false); setSessionToEdit(null); setPeriodToEdit(null); setPeriodIndex(-1); }} disabled={isEditingPeriod}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100">{t('common.cancel')}</button>
              <button onClick={handleSaveControllersPeriod} disabled={isEditingPeriod}
                className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center ${isEditingPeriod ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} text-white`}>
                {isEditingPeriod ? <><svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>{t('common.saving')}</> : t('common.save')}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Edit Session Payment Modal ── */}
      {showEditPaymentModal && paymentToEdit && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[300] p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full my-8">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 rounded-t-xl flex items-center justify-between">
              <h3 className="text-3xl font-bold text-white flex items-center gap-2"><DollarSign className="h-6 w-6" />{t('billing.editPayment.title')}</h3>
              <button onClick={() => { setShowEditPaymentModal(false); setPaymentToEdit(null); }} disabled={isEditingPayment} className="text-white hover:text-gray-200"><X className="h-6 w-6" /></button>
            </div>
            <div className="p-6 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-700">
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{paymentToEdit.session.deviceName}</p>
                <p className="text-base text-gray-600 dark:text-gray-400">{paymentToEdit.session.deviceType === 'playstation' ? t('billing.gamingDevices.playstation') : t('billing.gamingDevices.computer')}</p>
              </div>
              <div>
                <label className="block text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('billing.editPayment.newAmount')}</label>
                <input type="number" value={editPaymentAmount} onChange={e => setEditPaymentAmount(e.target.value)} placeholder={t('billing.editPayment.amountPlaceholder')}
                  className="w-full px-4 py-3 text-2xl font-semibold border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100" disabled={isEditingPayment} min="0" step="0.01" />
              </div>
              <div>
                <label className="block text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('billing.editPayment.newMethod')}</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['cash', 'card', 'transfer'] as const).map(m => (
                    <button key={m} onClick={() => setEditPaymentMethod(m)} disabled={isEditingPayment}
                      className={`p-4 border-2 rounded-xl text-center transition-all ${editPaymentMethod === m ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-lg scale-105' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}>
                      <div className="text-5xl mb-2">{m === 'cash' ? '💵' : m === 'card' ? '💳' : '📱'}</div>
                      <div className="text-base font-semibold">{t(`billing.paymentMethod${m.charAt(0).toUpperCase() + m.slice(1)}`)}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => { setShowEditPaymentModal(false); setPaymentToEdit(null); }} disabled={isEditingPayment}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100">{t('common.cancel')}</button>
              <button onClick={handleSaveEditedPayment} disabled={isEditingPayment}
                className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center ${isEditingPayment ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white`}>
                {isEditingPayment ? <><svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>{t('common.saving')}</> : t('billing.editPayment.save')}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Edit Item Payment Modal ── */}
      {showEditItemPaymentModal && itemPaymentToEdit && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[300] p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full my-8">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 rounded-t-xl flex items-center justify-between">
              <h3 className="text-3xl font-bold text-white flex items-center gap-2"><Receipt className="h-6 w-6" />{t('billing.editPayment.title')}</h3>
              <button onClick={() => { setShowEditItemPaymentModal(false); setItemPaymentToEdit(null); }} disabled={isEditingItemPayment} className="text-white hover:text-gray-200"><X className="h-6 w-6" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-xl border-2 border-green-200 dark:border-green-700">
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{itemPaymentToEdit.itemPayment.itemName || t('billing.unknownItem')}</p>
                <div className="text-base text-gray-600 dark:text-gray-400">{t('billing.pricePerUnit')}: {formatCurrency(itemPaymentToEdit.itemPayment.pricePerUnit)}</div>
              </div>
              <div>
                <label className="block text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('billing.editPayment.newQuantity')}</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => { const q = parseInt(editItemPaymentAmount) || 0; if (q > 0) setEditItemPaymentAmount((q - 1).toString()); }} disabled={isEditingItemPayment || parseInt(editItemPaymentAmount) <= 0}
                    className="w-12 h-12 flex items-center justify-center bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-bold text-3xl rounded-lg transition-colors">−</button>
                  <input type="number" value={editItemPaymentAmount} onChange={e => { const v = e.target.value; if (v === '' || (parseInt(v) >= 0 && parseInt(v) <= itemPaymentToEdit.payment.quantity)) setEditItemPaymentAmount(v); }}
                    className="flex-1 px-4 py-3 text-center text-4xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-gray-100" disabled={isEditingItemPayment} min="0" max={itemPaymentToEdit.payment.quantity} step="1" />
                  <button onClick={() => { const q = parseInt(editItemPaymentAmount) || 0; if (q < itemPaymentToEdit.payment.quantity) setEditItemPaymentAmount((q + 1).toString()); }} disabled={isEditingItemPayment || parseInt(editItemPaymentAmount) >= itemPaymentToEdit.payment.quantity}
                    className="w-12 h-12 flex items-center justify-center bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-bold text-3xl rounded-lg transition-colors">+</button>
                </div>
                <p className="text-base text-gray-500 dark:text-gray-400 mt-2 text-center">{t('billing.editPayment.maxQuantity')}: {formatDecimal(itemPaymentToEdit.payment.quantity, i18n.language)}</p>
              </div>
            </div>
            <div className="flex gap-3 p-6 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => { setShowEditItemPaymentModal(false); setItemPaymentToEdit(null); }} disabled={isEditingItemPayment}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100">{t('common.cancel')}</button>
              <button onClick={handleSaveEditedItemPayment} disabled={isEditingItemPayment}
                className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center ${isEditingItemPayment ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white`}>
                {isEditingItemPayment ? <><svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>{t('common.saving')}</> : t('billing.editPayment.save')}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Order Add/Edit Modals ── */}
      {showOrderModal && selectedTable && (
        <OrderModal table={selectedTable} orderItems={currentOrderItems} setOrderItems={setCurrentOrderItems}
          orderNotes={orderNotes} setOrderNotes={setOrderNotes} menuSections={menuSections} menuCategories={menuCategories}
          menuItems={menuItems} expandedSections={expandedSections} expandedCategories={expandedCategories}
          toggleSection={toggleSection} toggleCategory={toggleCategory} getCategoriesForSection={getCategoriesForSection}
          getItemsForCategory={getItemsForCategory} addItemToOrder={addItemToOrder} updateItemQuantity={updateItemQuantity}
          updateItemNotes={updateItemNotes} removeItemFromOrder={removeItemFromOrder} calculateTotal={calculateOrderTotal}
          onSave={() => handleSaveOrder('pending', false)} onSaveAndSend={() => handleSaveOrder('pending', false)}
          onSaveAndPrint={() => handleSaveOrder('pending', true)}
          onClose={() => { setShowOrderModal(false); setCurrentOrderItems([]); setOrderNotes(''); }} loading={savingOrder} isEdit={false}
          canEditPrice={canEditItemPrice(user)} onEditPrice={(idx, item) => { setPriceEditItem({ index: idx, item }); setShowPriceEditModal(true); }} />
      )}
      {showEditOrderModal && selectedOrder && selectedTable && (
        <OrderModal table={selectedTable} orderItems={currentOrderItems} setOrderItems={setCurrentOrderItems}
          orderNotes={orderNotes} setOrderNotes={setOrderNotes} menuSections={menuSections} menuCategories={menuCategories}
          menuItems={menuItems} expandedSections={expandedSections} expandedCategories={expandedCategories}
          toggleSection={toggleSection} toggleCategory={toggleCategory} getCategoriesForSection={getCategoriesForSection}
          getItemsForCategory={getItemsForCategory} addItemToOrder={addItemToOrder} updateItemQuantity={updateItemQuantity}
          updateItemNotes={updateItemNotes} removeItemFromOrder={removeItemFromOrder} calculateTotal={calculateOrderTotal}
          onSave={() => handleUpdateOrder(false, 'pending')} onSaveAndSend={() => handleUpdateOrder(false, 'pending')}
          onSaveAndPrint={() => handleUpdateOrder(true, 'pending')}
          onClose={() => { setShowEditOrderModal(false); setSelectedOrder(null); setCurrentOrderItems([]); setOrderNotes(''); }} loading={savingOrder} isEdit={true}
          canEditPrice={canEditItemPrice(user)} onEditPrice={(idx, item) => { setPriceEditItem({ index: idx, item }); setShowPriceEditModal(true); }} />
      )}

      {/* ── Table Management Modal ── */}
      {showManagementModal && (
        <ManagementModal tableSections={tableSections} tables={tables} onClose={() => setShowManagementModal(false)}
          onAddSection={() => { setEditingSection(null); setSectionFormData({ name: '', description: '', sortOrder: 0 }); setShowSectionModal(true); }}
          onEditSection={section => { setEditingSection(section); setSectionFormData({ name: section.name, description: section.description || '', sortOrder: section.sortOrder }); setShowSectionModal(true); }}
          onDeleteSection={async id => { showConfirm('حذف القسم', 'هل أنت متأكد من حذف هذا القسم؟ سيتم حذف جميع الطاولات التابعة له.', async () => { await deleteTableSection(id); await fetchTables(); setShowConfirmModal(false); }); }}
          onAddTable={sectionId => { setEditingTable(null); setTableFormData({ number: '', section: sectionId }); setShowTableModal(true); }}
          onEditTable={table => { setEditingTable(table); const sid = typeof table.section === 'string' ? table.section : (table.section as TableSection)?.id || (table.section as TableSection)?._id || ''; setTableFormData({ number: table.number.toString(), section: sid }); setShowTableModal(true); }}
          onDeleteTable={async id => { showConfirm('حذف الطاولة', 'هل أنت متأكد من حذف هذه الطاولة؟', async () => { await deleteTable(id); setShowConfirmModal(false); }); }}
          getTablesBySection={sid => getTablesBySection[sid] || []} />
      )}
      {showSectionModal && (
        <SectionModal formData={sectionFormData} setFormData={setSectionFormData} editingSection={editingSection}
          onSave={async () => { if (!sectionFormData.name.trim()) { showNotification(t('cafe.notifications.enterSectionName'), 'error'); return; } editingSection ? await updateTableSection(editingSection.id, sectionFormData) : await createTableSection(sectionFormData); setShowSectionModal(false); setEditingSection(null); setSectionFormData({ name: '', description: '', sortOrder: 0 }); }}
          onClose={() => { setShowSectionModal(false); setEditingSection(null); setSectionFormData({ name: '', description: '', sortOrder: 0 }); }} />
      )}
      {showTableModal && (
        <TableModalComp formData={tableFormData} setFormData={setTableFormData} tableSections={tableSections} editingTable={editingTable}
          onSave={async () => { if (!tableFormData.number || tableFormData.number.trim() === '') { showNotification(t('cafe.enterTableNumber'), 'error'); return; } if (!tableFormData.section) { showNotification(t('cafe.notifications.selectSection'), 'error'); return; } const numberStr = tableFormData.number.trim(); const editingId = String((editingTable as any)?._id || (editingTable as any)?.id || ''); const dup = tables.find(tb => { const tbSec = typeof tb.section === 'string' ? tb.section : (tb.section as any)?.id || (tb.section as any)?._id; const tbId = String((tb as any)._id || (tb as any).id); return tbSec === tableFormData.section && String(tb.number).toString() === numberStr && tbId !== editingId; }); if (dup) { showNotification(`الطاولة "${numberStr}" موجودة بالفعل في هذا القسم`, 'error'); return; } editingTable ? await updateTable(editingTable.id, { number: tableFormData.number, section: tableFormData.section }) : await createTable({ number: tableFormData.number, section: tableFormData.section }); setShowTableModal(false); setEditingTable(null); setTableFormData({ number: '', section: '' }); }}
          onClose={() => { setShowTableModal(false); setEditingTable(null); setTableFormData({ number: '', section: '' }); }} />
      )}

      {/* ── Confirm Modal ── */}
      {showConfirmModal && confirmModalData && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[300] p-3 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="relative p-4 sm:p-5 bg-gradient-to-br from-yellow-500 to-orange-600">
              <div className="relative flex items-center justify-between z-10">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-xl border border-white/30 flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg truncate">{confirmModalData.title}</h3>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-5 bg-gray-50 dark:bg-gray-900">
              <p className="text-lg sm:text-xl text-gray-700 dark:text-gray-300 leading-relaxed">{confirmModalData.message}</p>
            </div>
            <div className="p-4 sm:p-5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col sm:flex-row justify-end gap-3">
              <button onClick={() => { setShowConfirmModal(false); setConfirmModalData(null); setConfirmLoading(false); }} disabled={confirmLoading}
                className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl transition-colors text-lg sm:text-xl font-medium disabled:opacity-50">
                {confirmModalData.cancelText || t('common.cancel')}
              </button>
              <button onClick={() => confirmModalData.onConfirm()} disabled={confirmLoading}
                className={`w-full sm:w-auto px-4 py-2.5 text-white rounded-xl transition-colors text-lg sm:text-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${confirmModalData.confirmColor || 'bg-red-600 hover:bg-red-700'}`}>
                {confirmLoading ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>{t('common.loading')}</span></> : (confirmModalData.confirmText || t('common.confirm'))}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── #4 Quick Add Modal ── */}
      {showQuickAddModal && quickAddTable && (
        <QuickAddModal
          table={quickAddTable}
          menuItems={menuItems}
          menuSections={menuSections}
          menuCategories={menuCategories}
          items={quickAddItems}
          setItems={setQuickAddItems}
          onSave={handleQuickAddSave}
          onClose={() => { setShowQuickAddModal(false); setQuickAddItems([]); setQuickAddTable(null); }}
          saving={quickAddSaving}
        />
      )}

      {/* ── #11 Daily Report Modal ── */}
      {showDailyReportModal && (
        <DailyReportModal
          bills={bills}
          formatCurrency={formatCurrency}
          onPrint={handlePrintDailyReport}
          onClose={() => setShowDailyReportModal(false)}
          isPrinting={isPrintingReport}
        />
      )}

      {/* ── Bill Aggregated Edit Modal ── */}
      <BillItemsEditModal
        isOpen={showBillItemsEditModal}
        onClose={() => { setShowBillItemsEditModal(false); setBillToEdit(null); }}
        bill={billToEdit}
        menuItems={menuItems}
        menuSections={menuSections}
        menuCategories={menuCategories}
        getCategoriesForSection={getCategoriesForSection}
        getItemsForCategory={getItemsForCategory}
        onSuccess={async (updatedBill) => {
          // refresh bills and orders
          try { await fetchBills(); } catch {}
          try { await fetchOrders(); } catch {}
          // update selectedBill if open
          if (selectedBill && (selectedBill as any)._id === (updatedBill as any)._id) {
            setSelectedBill(updatedBill as any);
          }
          showNotification('تم تحديث أصناف الفاتورة بنجاح', 'success');
        }}
      />

      {/* ── Pay Choice Modal ── */}
      {showPayChoiceModal && payChoiceBill && (
        <ModalPortal>
          <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4" onClick={() => setShowPayChoiceModal(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-emerald-500 to-blue-600 px-5 py-4 text-white">
                <h3 className="text-xl font-bold flex items-center gap-2"><DollarSign className="h-5 w-5" />تأكيد الدفع</h3>
                <p className="text-sm opacity-90 mt-1">فاتورة #{payChoiceBill.billNumber || (payChoiceBill as any)._id?.toString().slice(-6)} - المتبقي {formatCurrency(Number(payChoiceBill.remaining) || 0)}</p>
              </div>
              <div className="p-5 space-y-3 bg-gray-50 dark:bg-gray-900">
                <p className="text-base text-gray-700 dark:text-gray-300 text-center">اختر طريقة الدفع</p>
                <button
                  onClick={() => { const b = payChoiceBill; setShowPayChoiceModal(false); setPayChoiceBill(null); if (b) handleDirectPayFull(b); }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow">
                  <CheckCircle className="h-5 w-5" />دفع الفاتورة بالكامل
                </button>
                <button
                  onClick={() => { const b = payChoiceBill; setShowPayChoiceModal(false); setPayChoiceBill(null); if (b) handlePaymentClick(b); }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow">
                  <Receipt className="h-5 w-5" />الذهاب لإدارة الدفع
                </button>
                <p className="text-xs text-gray-500 text-center">إدارة الدفع تتيح الدفع الجزئي والتقسيم والخصم</p>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-center">
                <button onClick={() => { setShowPayChoiceModal(false); setPayChoiceBill(null); }} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm">إلغاء</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      <PriceEditModal
        isOpen={showPriceEditModal}
        onClose={() => { setShowPriceEditModal(false); setPriceEditItem(null); }}
        item={priceEditItem?.item || null}
        onSave={handlePriceEditSave}
        formatCurrency={formatCurrency}
      />

    </div>
  );
};


const QuickAddModal: React.FC<{
  table: Table;
  menuItems: MenuItem[];
  menuSections: MenuSection[];
  menuCategories: MenuCategory[];
  items: LocalOrderItem[];
  setItems: React.Dispatch<React.SetStateAction<LocalOrderItem[]>>;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}> = ({ table, menuItems, menuSections, menuCategories, items, setItems, onSave, onClose, saving }) => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const [search, setSearch] = useState('');
  const cur = localStorage.getItem('organizationCurrency') || 'EGP';

  const filtered = useMemo(() => {
    if (!search.trim()) return menuItems.filter(m => m.isAvailable);
    const q = search.toLowerCase();
    return menuItems.filter(m => m.isAvailable && m.name.toLowerCase().includes(q));
  }, [menuItems, search]);

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const addItem = (mi: MenuItem, variant?: string | null) => {
    let effPrice = mi.price;
    let effVariant: string | null = variant ? String(variant).trim() : null;
    if (mi.variants && mi.variants.length > 0) {
      if (effVariant) {
        const m = mi.variants.find(v => v.size === effVariant);
        if (m) effPrice = m.price;
      } else {
        effVariant = mi.variants[0].size;
        effPrice = mi.variants[0].price;
      }
    } else effVariant = effVariant || null;
    const keyVariant = effVariant || '';
    setItems(prev => {
      const ex = prev.find(i => i.menuItem === mi.id && (i.variant || '') === keyVariant);
      if (ex) return prev.map(i => (i.menuItem === mi.id && (i.variant || '') === keyVariant) ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { menuItem: mi.id, name: mi.name, price: effPrice, variant: effVariant, quantity: 1 }];
    });
  };

  const changeQty = (id: string, delta: number, variant?: string | null) => {
    setItems(prev => prev.map(i => {
      const match = variant !== undefined ? (i.menuItem === id && (i.variant || '') === (variant || '')) : i.menuItem === id;
      if (!match) return i;
      const q = i.quantity + delta;
      return q <= 0 ? null as any : { ...i, quantity: q };
    }).filter(Boolean));
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[300] p-3" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="p-4 bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/30">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">إضافة سريعة</h3>
              <p className="text-base text-orange-100">طاولة {getTableDisplay(table.number, i18n.language)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center text-white transition-all">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="relative">
            <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400`} />
            <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ابحث في المنيو..."
              className={`w-full ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg focus:ring-2 focus:ring-orange-400`} />
          </div>
        </div>

        {/* Content with variant support */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0 grid grid-cols-1 gap-2">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-8">لا توجد أصناف</p>
          ) : filtered.map(mi => {
            const hasVariants = mi.variants && mi.variants.length > 1;
            if (hasVariants) {
              return (
                <div key={mi.id} className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <p className="font-medium text-lg text-gray-900 dark:text-gray-100 truncate mb-2">{mi.name}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {mi.variants!.map(v => {
                      const inOrderV = items.find(i => i.menuItem === mi.id && i.variant === v.size);
                      return (
                        <div key={v.size} className={`flex items-center justify-between p-2 rounded-lg border ${inOrderV ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-600'}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{v.size}</p>
                            <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold">{formatCurrencyUtil(v.price, i18n.language, cur)}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {inOrderV ? (
                              <>
                                <button onClick={() => changeQty(mi.id, -1, v.size)} className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">−</button>
                                <span className="w-5 text-center font-bold text-sm text-gray-900 dark:text-gray-100">{inOrderV.quantity}</span>
                                <button onClick={() => changeQty(mi.id, 1, v.size)} className="w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">+</button>
                              </>
                            ) : (
                              <button onClick={() => addItem(mi, v.size)} className="w-6 h-6 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center justify-center">
                                <Plus className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            const displayPrice = mi.variants && mi.variants.length === 1 ? mi.variants[0].price : mi.price;
            const displaySize = mi.variants && mi.variants.length === 1 ? mi.variants[0].size : null;
            const inOrder = items.find(i => i.menuItem === mi.id);
            return (
              <div key={mi.id} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${inOrder ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-700' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-lg text-gray-900 dark:text-gray-100 truncate flex items-center gap-1">{mi.name} {displaySize && displaySize !== 'عادي' && <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full">{displaySize}</span>}</p>
                  <p className="text-base text-orange-600 dark:text-orange-400 font-semibold">{formatCurrencyUtil(displayPrice, i18n.language, cur)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {inOrder ? (
                    <>
                      <button onClick={() => changeQty(mi.id, -1)} className="w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center font-bold text-lg transition-colors">−</button>
                      <span className="w-6 text-center font-bold text-gray-900 dark:text-gray-100 text-lg">{inOrder.quantity}</span>
                      <button onClick={() => changeQty(mi.id, 1)} className="w-7 h-7 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center justify-center font-bold text-lg transition-colors">+</button>
                    </>
                  ) : (
                    <button onClick={() => addItem(mi)} className="w-7 h-7 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center justify-center transition-colors">
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-2">
          {items.length > 0 && (
            <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-900/20 px-3 py-2 rounded-xl border border-orange-200 dark:border-orange-700">
              <span className="text-lg font-medium text-gray-700 dark:text-gray-300">{items.length} أصناف</span>
              <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatCurrencyUtil(total, i18n.language, cur)}</span>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-lg font-medium transition-colors">إلغاء</button>
            <button onClick={onSave} disabled={saving || items.length === 0}
              className="flex-1 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl text-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
              {saving ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <CheckCircle className="h-4 w-4" />}
              {saving ? 'جاري الحفظ...' : 'إرسال الطلب'}
            </button>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

// ─── #11 DailyReportModal ────────────────────────────────────────────────────

const DailyReportModal: React.FC<{
  bills: Bill[];
  formatCurrency: (n: number) => string;
  onPrint: () => void;
  onClose: () => void;
  isPrinting: boolean;
}> = ({ bills, formatCurrency, onPrint, onClose, isPrinting }) => {
  const today = new Date();
  const todayBills = bills.filter(b => new Date(b.createdAt).toDateString() === today.toDateString());
  const paid = todayBills.filter(b => b.status === 'paid');
  const unpaid = todayBills.filter(b => ['draft','partial','overdue'].includes(b.status));
  const totalRevenue = paid.reduce((s, b) => s + (b.total || 0), 0);
  const totalCollected = todayBills.reduce((s, b) => s + (b.paid || 0), 0);
  const totalRemaining = unpaid.reduce((s, b) => s + (b.remaining || 0), 0);

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[300] p-3" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="p-4 bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/30">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">التقرير اليومي</h3>
              <p className="text-base text-green-100">{today.toLocaleDateString('ar-EG', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'إيرادات الفواتير المدفوعة', value: formatCurrency(totalRevenue), color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' },
              { label: 'إجمالي المحصّل', value: formatCurrency(totalCollected), color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' },
              { label: 'إجمالي المتبقي', value: formatCurrency(totalRemaining), color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' },
            ].map((s, i) => (
              <div key={i} className={`p-3 rounded-xl border ${s.bg}`}>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-base text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'إجمالي الفواتير', value: todayBills.length, color: 'text-gray-700 dark:text-gray-300' },
              { label: 'مدفوعة', value: paid.length, color: 'text-green-600' },
              { label: 'غير مدفوعة', value: unpaid.length, color: 'text-red-600' },
            ].map((s, i) => (
              <div key={i} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-center">
                <p className={`text-4xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-base text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Bills Table */}
          {todayBills.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-lg">
                <thead className="bg-emerald-500 text-white">
                  <tr>
                    {['#', 'رقم الفاتورة', 'الطاولة', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة'].map(h => (
                      <th key={h} className="px-3 py-2 text-right font-semibold text-base">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todayBills.map((b, i) => (
                    <tr key={b.id || b._id} className={i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'}>
                      <td className="px-3 py-2 text-base text-gray-500">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 text-base">#{b.billNumber || (b.id || b._id)?.slice(-6)}</td>
                      <td className="px-3 py-2 text-base text-gray-600 dark:text-gray-400">{b.table ? `طاولة ${(b.table as any).number || ''}` : '—'}</td>
                      <td className="px-3 py-2 font-semibold text-base text-gray-900 dark:text-gray-100">{formatCurrency(b.total || 0)}</td>
                      <td className="px-3 py-2 text-base text-green-600 dark:text-green-400 font-semibold">{formatCurrency(b.paid || 0)}</td>
                      <td className="px-3 py-2 text-base text-red-600 dark:text-red-400 font-semibold">{formatCurrency(b.remaining || 0)}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded-full text-base font-bold ${
                          b.status === 'paid' ? 'bg-green-100 text-green-700' :
                          b.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'}`}>
                          {b.status === 'paid' ? 'مدفوعة' : b.status === 'partial' ? 'جزئي' : b.status === 'draft' ? 'معلقة' : b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {todayBills.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>لا توجد فواتير اليوم</p>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-lg font-medium transition-colors">إغلاق</button>
          <button onClick={onPrint} disabled={isPrinting}
            className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl text-lg font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {isPrinting ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <Printer className="h-4 w-4" />}
            {isPrinting ? 'جاري الطباعة...' : 'طباعة التقرير'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};


// ─── OrderModal ──────────────────────────────────────────────────────────────


interface OrderModalProps {
  table: { _id: string; number: string | number; name?: string };
  orderItems: LocalOrderItem[];
  setOrderItems: React.Dispatch<React.SetStateAction<LocalOrderItem[]>>;
  orderNotes: string; setOrderNotes: (n: string) => void;
  menuSections: MenuSection[]; menuCategories: MenuCategory[]; menuItems: MenuItem[];
  expandedSections: Record<string, boolean>; expandedCategories: Record<string, boolean>;
  toggleSection: (id: string) => void; toggleCategory: (id: string) => void;
  getCategoriesForSection: (id: string) => MenuCategory[];
  getItemsForCategory: (id: string) => MenuItem[];
  addItemToOrder: (item: MenuItem, variant?: string | null) => void;
  updateItemQuantity: (id: string, delta: number, variant?: string | null) => void;
  updateItemNotes: (id: string, notes: string, variant?: string | null) => void;
  removeItemFromOrder: (id: string, variant?: string | null) => void;
  calculateTotal: () => number;
  onSave: () => void; onSaveAndPrint: () => void; onSaveAndSend: () => void; onClose: () => void;
  loading: boolean; isEdit: boolean;
  canEditPrice?: boolean;
  onEditPrice?: (index: number, item: LocalOrderItem) => void;
}


const OrderModal: React.FC<OrderModalProps> = ({
  table, orderItems, orderNotes, setOrderNotes, menuSections, menuCategories, menuItems,
  expandedSections, expandedCategories, toggleSection, toggleCategory, getCategoriesForSection,
  getItemsForCategory, addItemToOrder, updateItemQuantity, updateItemNotes, removeItemFromOrder,
  calculateTotal, onSave, onSaveAndPrint, onSaveAndSend, onClose, loading, isEdit,
  canEditPrice, onEditPrice,
}) => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── مرة واحدة، لا تتغير في كل render ──────────────────────────────
  const cur = useRef(localStorage.getItem('organizationCurrency') || 'EGP').current;
  const fmt = useCallback((n: number) => formatCurrencyUtil(n, i18n.language, cur), [i18n.language, cur]);

  // ── map الكمية: O(1) بدل O(n) في كل صنف — with variant support ───────
  const qtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    orderItems.forEach(i => { map[i.menuItem] = (map[i.menuItem] || 0) + i.quantity; });
    return map;
  }, [orderItems]);
  const qtyByVariantMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    orderItems.forEach(i => {
      const v = i.variant || '';
      if (!map[i.menuItem]) map[i.menuItem] = {};
      map[i.menuItem][v] = (map[i.menuItem][v] || 0) + i.quantity;
      if (i.variant) map[i.menuItem][i.variant] = (map[i.menuItem][i.variant] || 0) + i.quantity;
    });
    return map;
  }, [orderItems]);

  // ── الأقسام النشطة ───────────────────────────────────────────────────
  const activeSections = useMemo(() =>
    menuSections.filter(s => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
  [menuSections]);

  const [activeSectionId, setActiveSectionId] = useState<string>(() =>
    menuSections.find(s => s.isActive)?._id || menuSections.find(s => s.isActive)?.id || ''
  );
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  useEffect(() => { setActiveCategoryId('all'); }, [activeSectionId]);
  // لو المنيو لسه بيحمل أو activeSectionId فاضي، اختار أول قسم متاح تلقائياً (يضمن التوزيع يظهر في الإضافة والتعديل)
  useEffect(() => {
    if (!activeSectionId && activeSections.length > 0) {
      const firstId = (activeSections[0] as any).id || activeSections[0]._id;
      setActiveSectionId(String(firstId));
    }
  }, [activeSections, activeSectionId]);

  const activeSectionCategories = useMemo(() => {
    if (!activeSectionId) return [];
    return getCategoriesForSection(activeSectionId);
  }, [activeSectionId, menuCategories]);

  // ── الأصناف المعروضة — توزيع كامل: أقسام → فئات → أصناف + بحث + fallback للمنيو الكامل ──
  const displayedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) return menuItems.filter(i => i.isAvailable && i.name.toLowerCase().includes(q));
    if (!activeSectionId) return menuItems.filter(i => i.isAvailable);
    const cats = activeCategoryId === 'all'
      ? getCategoriesForSection(activeSectionId)
      : getCategoriesForSection(activeSectionId).filter(c => c._id === activeCategoryId || c.id === activeCategoryId);
    const items = cats.flatMap(cat => getItemsForCategory(cat.id));
    // لو القسم/الفئة فاضية لكن المنيو موجود، اعرض المنيو الكامل موزعاً بدل قائمة فاضية
    if (items.length === 0) return menuItems.filter(i => i.isAvailable);
    return items;
  }, [searchQuery, activeSectionId, activeCategoryId, menuItems]);
  // ملاحظة: getCategoriesForSection/getItemsForCategory محذوفتان من deps
  // لأنهما دوال خارجية مستقرة (لا تتغير reference)

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefsMap = useRef<Record<string, HTMLDivElement | null>>({});
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  const prevLengthRef = useRef(orderItems.length);
  useEffect(() => {
    if (orderItems.length > prevLengthRef.current) {
      const last = orderItems[orderItems.length - 1];
      if (last) {
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        setFlashId(last.menuItem);
        flashTimerRef.current = setTimeout(() => setFlashId(null), 700);
        setTimeout(() => { itemRefsMap.current[last.menuItem]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 30);
      }
    }
    prevLengthRef.current = orderItems.length;
  }, [orderItems.length]);

  const handleAddWithFlash = useCallback((menuItem: MenuItem, variant?: string | null) => {
    addItemToOrder(menuItem, variant);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    const flashKey = variant ? `${menuItem.id}::${variant}` : menuItem.id;
    setFlashId(flashKey);
    flashTimerRef.current = setTimeout(() => setFlashId(null), 700);
    setTimeout(() => {
      const el = itemRefsMap.current[flashKey] || itemRefsMap.current[menuItem.id];
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 30);
  }, [addItemToOrder]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current); }, []);

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[300] flex bg-black/50" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-900 w-full flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* HEADER — بدون بحث */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center ring-1 ring-white/25 flex-shrink-0">
              <ShoppingCart className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-white truncate">{isEdit ? t('cafe.orderModal.editOrderTitle') : t('cafe.orderModal.newOrderTitle')}</h2>
              <p className="text-base text-orange-100 flex items-center gap-1">
                <TableIcon className="h-3 w-3 flex-shrink-0" />
                {t('cafe.orderModal.table', { number: getTableDisplay(table.number, i18n.language) })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {orderItems.length > 0 && (
              <div className="bg-white/15 rounded-xl px-3 py-1.5 ring-1 ring-white/25 text-center">
                <p className="text-base text-orange-100 leading-none">الإجمالي</p>
                <p className="text-lg font-bold text-white">{fmt(calculateTotal())}</p>
              </div>
            )}
            <button onClick={onClose} className="w-8 h-8 bg-white/15 hover:bg-white/25 rounded-xl flex items-center justify-center text-white ring-1 ring-white/25 transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* Col 1: Sections */}
          {!searchQuery.trim() && (
            <div className="w-24 sm:w-28 flex-shrink-0 flex flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="px-2 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                <p className="text-base font-semibold text-gray-400 dark:text-gray-500 text-center">الأقسام</p>
              </div>
              <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-1">
                {activeSections.map(sec => {
                  const hasCats = getCategoriesForSection(sec.id).length > 0;
                  if (!hasCats) return null;
                  const isAct = activeSectionId === sec.id;
                  return (
                    <button key={sec.id} onClick={() => setActiveSectionId(sec.id)}
                      className={`w-full px-2 py-2 rounded-lg text-base font-medium transition-all text-right leading-snug ${isAct ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                      {sec.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Col 2: Categories */}
          {!searchQuery.trim() && activeSectionCategories.length > 1 && (
            <div className="w-24 sm:w-28 flex-shrink-0 flex flex-col border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="px-2 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                <p className="text-base font-semibold text-gray-400 dark:text-gray-500 text-center">الفئات</p>
              </div>
              <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-1">
                <button onClick={() => setActiveCategoryId('all')}
                  className={`w-full px-2 py-2 rounded-lg text-base font-medium transition-all text-right ${activeCategoryId === 'all' ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                  الكل
                </button>
                {activeSectionCategories.map(cat => {
                  const catId = cat._id || cat.id;
                  const isAct = activeCategoryId === catId;
                  const count = getItemsForCategory(cat.id).length;
                  if (count === 0) return null;
                  return (
                    <button key={catId} onClick={() => setActiveCategoryId(catId)}
                      className={`w-full px-2 py-2 rounded-lg text-base font-medium transition-all text-right leading-snug ${isAct ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                      <span className="block">{cat.name}</span>
                      <span className={`text-base ${isAct ? 'text-white/70 dark:text-gray-700' : 'text-gray-400'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Col 3: Items */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-gray-50 dark:bg-gray-900">

            {/* البحث داخل الأصناف */}
            <div className="px-2 pt-2 pb-1.5 flex-shrink-0">
              <div className="relative">
                <Search className={`absolute ${isRTL ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none`} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t('cafe.orderModal.searchPlaceholder')}
                  className={`w-full ${isRTL ? 'pr-8 pl-7' : 'pl-8 pr-7'} py-1.5 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-1 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all`}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className={`absolute ${isRTL ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600`}>
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="px-2 py-1 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
              <p className="text-base font-semibold text-gray-400 dark:text-gray-500">
                {searchQuery
                  ? 'نتائج البحث'
                  : (activeSectionCategories.find(c => (c._id || c.id) === activeCategoryId)?.name
                    || activeSections.find(s => s.id === activeSectionId)?.name
                    || 'الأصناف')}
              </p>
              {displayedItems.length > 0 && <span className="text-base text-gray-400">{displayedItems.length}</span>}
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 min-h-0">
              {displayedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-600 select-none">
                  <Search className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-base">{searchQuery ? t('cafe.orderModal.noResults') : 'اختر قسماً'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-1">
                  {displayedItems.map(item => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      qty={qtyMap[item.id] || 0}
                      qtyByVariant={qtyByVariantMap[item.id]}
                      onAdd={handleAddWithFlash}
                      fmt={fmt}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Col 4: Order — أوسع */}
          <div className="w-64 sm:w-72 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-4 bg-gradient-to-b from-green-400 to-emerald-500 rounded-full"></div>
                <span className="font-bold text-gray-800 dark:text-gray-100 text-base">{t('cafe.orderModal.orders')}</span>
                {orderItems.length > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-base font-bold rounded-full flex items-center justify-center leading-none">{orderItems.length}</span>
                )}
              </div>
              <span className="text-base font-bold text-orange-600 dark:text-orange-400">{fmt(calculateTotal())}</span>
            </div>

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 min-h-0">
              {orderItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full select-none">
                  <ShoppingCart className="h-8 w-8 text-gray-200 dark:text-gray-700 mb-1" />
                  <p className="text-base text-gray-300 dark:text-gray-600">{t('cafe.orderModal.noItems')}</p>
                </div>
              ) : orderItems.map((item, idx) => {
                const compositeKey = item.variant ? `${item.menuItem}::${item.variant}::${item.price}` : `${item.menuItem}::${item.price}`;
                return (
                <div key={compositeKey + idx} ref={el => { itemRefsMap.current[compositeKey] = el as HTMLDivElement | null; if (!item.variant) itemRefsMap.current[item.menuItem] = el as HTMLDivElement | null; }}>
                  <OrderItemRow
                    item={item}
                    isFlash={flashId === compositeKey || flashId === item.menuItem}
                    isExpanded={!!expandedNotes[compositeKey]}
                    onMinus={() => setOrderItems(prev => { const cp=[...prev]; const it=cp[idx]; if(!it) return prev; const q=it.quantity-1; if(q<=0) cp.splice(idx,1); else cp[idx]={...it, quantity:q}; return cp; })}
                    onPlus={() => setOrderItems(prev => { const cp=[...prev]; const it=cp[idx]; if(!it) return prev; cp[idx]={...it, quantity:it.quantity+1}; return cp; })}
                    onRemove={() => setOrderItems(prev => prev.filter((_, i) => i !== idx))}
                    onToggleNote={() => setExpandedNotes(p => ({ ...p, [compositeKey]: !p[compositeKey] }))}
                    onNoteChange={v => setOrderItems(prev => { const cp=[...prev]; if(cp[idx]) cp[idx]={...cp[idx], notes:v}; return cp; })}
                    notePlaceholder={t('cafe.orderModal.itemNotesPlaceholder')}
                    fmt={fmt}
                    canEditPrice={canEditPrice}
                    onEditPrice={onEditPrice ? () => onEditPrice(idx, item) : undefined}
                  />
                </div>
                );
              })}
            </div>

            <div className="px-2 pt-2 pb-1 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
              <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
                placeholder={t('cafe.orderModal.orderNotesPlaceholder')} rows={2}
                className="w-full text-base border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none focus:ring-1 focus:ring-orange-400 outline-none" />
            </div>

            <div className="px-2 pb-3 flex-shrink-0 space-y-1.5">
              <button onClick={onSaveAndSend} disabled={loading || orderItems.length === 0}
                className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-base rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                {loading
                  ? <><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>{t('cafe.orderModal.saving')}</>
                  : <><ChefHat className="h-3.5 w-3.5" />{t('cafe.orderModal.saveAndSend')}</>}
              </button>
              <div className="flex gap-1.5">
                <button onClick={onSave} disabled={loading || orderItems.length === 0}
                  className="flex-1 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 text-gray-600 dark:text-gray-300 font-medium text-base rounded-lg flex items-center justify-center gap-1 transition-all disabled:opacity-50">
                  <CheckCircle className="h-3 w-3 text-green-500" />{t('cafe.orderModal.save')}
                </button>
                <button onClick={onSaveAndPrint} disabled={loading || orderItems.length === 0}
                  className="flex-1 py-2 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 text-blue-600 dark:text-blue-400 font-medium text-base rounded-lg flex items-center justify-center gap-1 transition-all disabled:opacity-50">
                  <Printer className="h-3 w-3" />{t('cafe.orderModal.saveAndPrint')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};


// ─── ManagementModal ──────────────────────────────────────────────────────────

const ManagementModal: React.FC<{
  tableSections: TableSection[]; tables: Table[]; onClose: () => void;
  onAddSection: () => void; onEditSection: (s: TableSection) => void; onDeleteSection: (id: string) => Promise<void>;
  onAddTable: (sectionId: string) => void; onEditTable: (t: Table) => void; onDeleteTable: (id: string) => Promise<void>;
  getTablesBySection: (id: string) => Table[];
}> = ({ tableSections, tables, onClose, onAddSection, onEditSection, onDeleteSection, onAddTable, onEditTable, onDeleteTable, getTablesBySection }) => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();

  // ── #8 Drag & Drop state ──
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<Table[]>(tables);

  useEffect(() => { setLocalOrder(tables); }, [tables]);

  const handleDragStart = (e: React.DragEvent, tableId: string) => {
    setDraggedId(tableId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, tableId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (tableId !== draggedId) setDragOverId(tableId);
  };

  const handleDrop = (e: React.DragEvent, targetId: string, sectionId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return; }
    setLocalOrder(prev => {
      const secTables = prev.filter(tb => {
        const sid = typeof tb.section === 'string' ? tb.section : (tb.section as TableSection)?._id || (tb.section as TableSection)?.id;
        return sid === sectionId;
      });
      const dragIdx = secTables.findIndex(tb => (tb._id || (tb as any).id) === draggedId);
      const dropIdx = secTables.findIndex(tb => (tb._id || (tb as any).id) === targetId);
      if (dragIdx === -1 || dropIdx === -1) return prev;
      const reordered = [...secTables];
      const [moved] = reordered.splice(dragIdx, 1);
      reordered.splice(dropIdx, 0, moved);
      const otherTables = prev.filter(tb => {
        const sid = typeof tb.section === 'string' ? tb.section : (tb.section as TableSection)?._id || (tb.section as TableSection)?.id;
        return sid !== sectionId;
      });
      return [...otherTables, ...reordered];
    });
    setDraggedId(null);
    setDragOverId(null);
  };

  const getLocalTablesBySection = (sectionId: string) =>
    localOrder.filter(tb => {
      const sid = typeof tb.section === 'string' ? tb.section : (tb.section as TableSection)?._id || (tb.section as TableSection)?.id;
      return sid === sectionId;
    });

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[300] p-3 sm:p-4 md:p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl max-w-sm sm:max-w-2xl md:max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
        <div className="relative p-4 sm:p-5 md:p-6 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex-shrink-0">
          <div className="relative flex items-center justify-between z-10">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl border border-white/30 flex-shrink-0">
                <Settings className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white drop-shadow-lg truncate">{t('cafe.managementModal.title')}</h2>
                <p className="text-base sm:text-lg text-white/80 mt-1">{t('cafe.managementModal.sectionsCount', { count: tableSections.length })} • {t('cafe.managementModal.tablesCount', { count: tables.length })}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 sm:p-2.5 hover:bg-white/20 backdrop-blur-sm rounded-xl border border-white/30 hover:scale-110 flex-shrink-0"><X className="h-5 w-5 sm:h-6 sm:w-6 text-white" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-6 bg-gray-50 dark:bg-gray-900">
          <div className="mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <div className="w-1 h-5 sm:h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>{t('cafe.managementModal.sections')}
              </h3>
              <button onClick={onAddSection} className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2.5 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg hover:scale-105">
                <Plus className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />{t('cafe.managementModal.addSection')}
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {tableSections.sort((a, b) => a.sortOrder - b.sortOrder).map(section => {
                const sectionTables = getLocalTablesBySection(section.id);
                return (
                  <div key={section.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-5 hover:shadow-lg transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                          <h4 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{section.name}</h4>
                          <span className="w-fit px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-base font-bold rounded-full">{t('cafe.managementModal.tableCount', { count: sectionTables.length })}</span>
                        </div>
                        {section.description && <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 line-clamp-2">{section.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => onEditSection(section)} className="p-2 sm:p-2.5 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-xl transition-all hover:scale-110 border border-transparent hover:border-orange-200"><Edit className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" /></button>
                        <button onClick={() => onDeleteSection(section.id)} className="p-2 sm:p-2.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all hover:scale-110 border border-transparent hover:border-red-200"><Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" /></button>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      {/* #8 Drag & Drop table chips */}
                      <div className="flex flex-wrap gap-2 flex-1">
                        {sectionTables.length === 0 && (
                          <span className="text-base text-gray-400 italic">اسحب الطاولات هنا</span>
                        )}
                        {sectionTables.map(table => {
                          const tid = table._id || (table as any).id;
                          const isDragging = draggedId === tid;
                          const isDragOver = dragOverId === tid;
                          return (
                            <div
                              key={table.id}
                              draggable
                              onDragStart={e => handleDragStart(e, tid)}
                              onDragOver={e => handleDragOver(e, tid)}
                              onDrop={e => handleDrop(e, tid, section.id)}
                              onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                              className={`group flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none
                                ${isDragging ? 'opacity-40 scale-95 border-dashed border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30' :
                                  isDragOver ? 'border-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 shadow-lg scale-105' :
                                  'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 border-gray-300 dark:border-gray-600 hover:border-indigo-300 hover:shadow-md'}`}>
                              {/* Drag handle */}
                              <div className="flex flex-col gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                <div className="w-3 h-0.5 bg-gray-500 rounded-full"></div>
                                <div className="w-3 h-0.5 bg-gray-500 rounded-full"></div>
                                <div className="w-3 h-0.5 bg-gray-500 rounded-full"></div>
                              </div>
                              <span className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">{getTableDisplay(table.number, i18n.language)}</span>
                              <div className="flex items-center gap-1">
                                <button onClick={e => { e.stopPropagation(); onEditTable(table); }} className="p-1 hover:bg-orange-200 dark:hover:bg-orange-800 rounded-lg transition-all"><Edit className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-orange-600 dark:text-orange-400" /></button>
                                <button onClick={e => { e.stopPropagation(); onDeleteTable(table.id); }} className="p-1 hover:bg-red-200 dark:hover:bg-red-800 rounded-lg transition-all"><Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-600 dark:text-red-400" /></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button onClick={() => onAddTable(section.id)} className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-3 py-2 rounded-xl text-base sm:text-lg font-bold flex items-center justify-center gap-1 shadow-md hover:scale-105">
                        <Plus className="h-3 w-3 sm:h-4 sm:w-4" />{t('cafe.managementModal.addTable')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {draggedId && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-2 rounded-full shadow-xl text-lg font-medium z-50 flex items-center gap-2 pointer-events-none">
              <Layers className="h-4 w-4" />
              اسحب فوق طاولة أخرى لتبديل الترتيب
            </div>
          )}
        </div>
        <div className="flex items-center justify-end p-4 sm:p-5 md:p-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
          <button onClick={onClose} className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl transition-colors text-lg sm:text-xl font-medium">{t('common.close')}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

// ─── SectionModal ─────────────────────────────────────────────────────────────

const SectionModal: React.FC<{
  formData: { name: string; description: string; sortOrder: number };
  setFormData: (d: { name: string; description: string; sortOrder: number }) => void;
  editingSection: TableSection | null; onSave: () => void; onClose: () => void;
}> = ({ formData, setFormData, editingSection, onSave, onClose }) => {
  const { t } = useTranslation();
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const timer = setTimeout(() => nameRef.current?.focus(), 100); return () => clearTimeout(timer); }, []);
  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[300] p-3 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm sm:max-w-md w-full border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="relative p-4 sm:p-5 bg-gradient-to-br from-blue-500 to-indigo-600">
          <div className="relative flex items-center justify-between z-10">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30 flex-shrink-0"><Settings className="h-5 w-5 sm:h-6 sm:w-6 text-white" /></div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg truncate">{editingSection ? t('cafe.sectionModal.editTitle') : t('cafe.sectionModal.addTitle')}</h2>
            </div>
            <button onClick={onClose} className="p-2 sm:p-2.5 hover:bg-white/20 backdrop-blur-sm rounded-xl border border-white/30 flex-shrink-0"><X className="h-5 w-5 sm:h-6 sm:w-6 text-white" /></button>
          </div>
        </div>
        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 bg-gray-50 dark:bg-gray-900">
          <div>
            <label className="block text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">{t('cafe.sectionModal.sectionNameRequired')}</label>
            <input ref={nameRef} type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} autoFocus
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg sm:text-xl focus:ring-2 focus:ring-blue-500"
              placeholder={t('cafe.sectionModal.sectionNamePlaceholder')} />
          </div>
          <div>
            <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">{t('cafe.sectionModal.description')}</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg sm:text-xl focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder={t('cafe.sectionModal.descriptionPlaceholder')} rows={3} />
          </div>
          <div>
            <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">{t('cafe.sectionModal.sortOrder')}</label>
            <input type="number" value={formData.sortOrder} onChange={e => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg sm:text-xl focus:ring-2 focus:ring-blue-500"
              placeholder={t('cafe.sectionModal.sortOrderPlaceholder')} />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 p-4 sm:p-5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button onClick={onClose} className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-lg sm:text-xl font-medium">{t('cafe.sectionModal.cancel')}</button>
          <button onClick={onSave} className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-lg sm:text-xl font-medium">{t('cafe.sectionModal.save')}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

// ─── TableModalComp ──────────────────────────────────────────────────────────

const TableModalComp: React.FC<{
  formData: { number: string; section: string };
  setFormData: (d: { number: string; section: string }) => void;
  tableSections: TableSection[]; editingTable: Table | null; onSave: () => void; onClose: () => void;
}> = ({ formData, setFormData, tableSections, editingTable, onSave, onClose }) => {
  const { t } = useTranslation();
  const numRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const timer = setTimeout(() => numRef.current?.focus(), 100); return () => clearTimeout(timer); }, []);
  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[300] p-3 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm sm:max-w-md w-full border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="relative p-4 sm:p-5 bg-gradient-to-br from-green-500 to-emerald-600">
          <div className="relative flex items-center justify-between z-10">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30 flex-shrink-0"><Plus className="h-5 w-5 sm:h-6 sm:w-6 text-white" /></div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg truncate">{editingTable ? t('cafe.tableModal.editTitle') : t('cafe.tableModal.addTitle')}</h2>
            </div>
            <button onClick={onClose} className="p-2 sm:p-2.5 hover:bg-white/20 backdrop-blur-sm rounded-xl border border-white/30 flex-shrink-0"><X className="h-5 w-5 sm:h-6 sm:w-6 text-white" /></button>
          </div>
        </div>
        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 bg-gray-50 dark:bg-gray-900">
          <div>
            <label className="block text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">{t('cafe.tableModal.tableNumberRequired')}</label>
            <input ref={numRef} type="text" value={formData.number} onChange={e => setFormData({ ...formData, number: e.target.value })} autoFocus
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg sm:text-xl focus:ring-2 focus:ring-green-500"
              placeholder={t('cafe.tableModal.tableNumberPlaceholder')} />
          </div>
          <div>
            <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">{t('cafe.tableModal.sectionRequired')}</label>
            <select value={formData.section} onChange={e => setFormData({ ...formData, section: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg sm:text-xl focus:ring-2 focus:ring-green-500">
              <option value="">{t('cafe.tableModal.selectSection')}</option>
              {tableSections.filter(s => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 p-4 sm:p-5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button onClick={onClose} className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-lg sm:text-xl font-medium">{t('cafe.tableModal.cancel')}</button>
          <button onClick={onSave} className="w-full sm:w-auto px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-lg sm:text-xl font-medium">{t('cafe.tableModal.save')}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

export default Tables;