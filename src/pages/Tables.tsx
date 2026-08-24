import React, { useState, useEffect, useMemo, memo, useRef, useCallback } from 'react';
import {
  ShoppingCart, Plus, Edit, Trash2, X, PlusCircle, MinusCircle, Printer,
  Settings, AlertTriangle, Search, CheckCircle, DollarSign, CreditCard,
  Calendar, User, Receipt, QrCode, Table as TableIcon, Eye, EyeOff,
  Gamepad2, ChevronDown, ChevronUp, Save, ChefHat, Maximize2, Minimize2,
  Clock, History, FileText, Zap, Layers
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import { useOrganization } from '../context/OrganizationContext';
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
import PartialPaymentModal from '../components/PartialPaymentModal';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../utils/apiBase';
import '../styles/billing-animations.css';

// ─── helpers ────────────────────────────────────────────────────────────────

const getTableDisplay = (v: string | number | undefined | null, lang = 'ar'): string => {
  if (v === undefined || v === null) return '';
  const n = Number(v);
  if (!isNaN(n) && v.toString().trim() !== '') return formatDecimal(n, lang);
  return v.toString();
};

const toArabicNumbers = (str: string | number) =>
  str.toString().replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);

const formatCurrencyArabic = (amount: number) => toArabicNumbers(formatCurrencyUtil(amount));

type Interval = ReturnType<typeof setInterval>;

// ── Table age color helper ──────────────────────────────────────────────────

/** Returns elapsed milliseconds since the oldest unpaid bill on this table */
const getTableAgeMs = (bills: Bill[]): number | null => {
  if (!bills || bills.length === 0) return null;
  const unpaid = bills.filter(b => ['draft', 'partial', 'overdue'].includes(b.status));
  if (unpaid.length === 0) return null;
  const earliest = unpaid.reduce((min, b) => {
    const d = new Date(b.createdAt).getTime();
    return d < min ? d : min;
  }, Infinity);
  return Date.now() - earliest;
};

const getTableAgeColor = (bills: Bill[]): 'green' | 'yellow' | 'orange' | 'red' | null => {
  const ms = getTableAgeMs(bills);
  if (ms === null) return null;
  const minutes = ms / 60000;
  if (minutes < 30)  return 'green';   // < 30 min
  if (minutes < 60)  return 'yellow';  // 30 min – 1 hr
  if (minutes < 120) return 'orange';  // 1 – 2 hrs
  return 'red';                        // > 2 hrs (includes days / months)
};

const getAgeLabel = (bills: Bill[]): string => {
  const ms = getTableAgeMs(bills);
  if (ms === null) return '';

  const totalSeconds  = Math.floor(ms / 1000);
  const totalMinutes  = Math.floor(totalSeconds / 60);
  const totalHours    = Math.floor(totalMinutes / 60);
  const totalDays     = Math.floor(totalHours   / 24);
  const totalWeeks    = Math.floor(totalDays    / 7);
  const totalMonths   = Math.floor(totalDays    / 30);

  // < 1 minute
  if (totalMinutes < 1)  return `${totalSeconds}ث`;

  // < 1 hour  → show minutes (+ remaining seconds if < 10 min)
  if (totalHours < 1) {
    const secs = totalSeconds % 60;
    if (totalMinutes < 10 && secs > 0) return `${totalMinutes}د ${secs}ث`;
    return `${totalMinutes}د`;
  }

  // < 24 hours → show hours + remaining minutes
  if (totalDays < 1) {
    const mins = totalMinutes % 60;
    return mins > 0 ? `${totalHours}س ${mins}د` : `${totalHours}س`;
  }

  // < 7 days → show days + remaining hours
  if (totalWeeks < 1) {
    const hrs = totalHours % 24;
    return hrs > 0 ? `${totalDays}ي ${hrs}س` : `${totalDays}ي`;
  }

  // < 4 weeks → show weeks + remaining days
  if (totalMonths < 1) {
    const days = totalDays % 7;
    return days > 0 ? `${totalWeeks}أ ${days}ي` : `${totalWeeks}أ`;
  }

  // ≥ 1 month → show months + remaining days
  const remainingDays = totalDays % 30;
  return remainingDays > 0 ? `${totalMonths}ش ${remainingDays}ي` : `${totalMonths}ش`;
};

interface LocalOrderItem {
  menuItem: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

// ─── Memoized sub-components ────────────────────────────────────────────────

interface TableButtonProps {
  table: Table;
  isSelected: boolean;
  isOccupied: boolean;
  tableBills: Bill[];
  tableOrdersCount: number;
  activeSessionType: 'playstation' | 'computer' | 'both' | null;
  onClick: (table: Table) => void;
  onQuickOrder: (table: Table, e: React.MouseEvent) => void;
  onQuickBilling: (table: Table, e: React.MouseEvent) => void;
}

const TableButton = React.memo<TableButtonProps>(({ table, isSelected, isOccupied, tableBills, tableOrdersCount, activeSessionType, onClick, onQuickOrder, onQuickBilling }) => {
  const { t, i18n } = useTranslation();
  const [showTooltip, setShowTooltip] = useState(false);

  const ageLabel = isOccupied ? getAgeLabel(tableBills) : '';
  const ageColor = isOccupied ? getTableAgeColor(tableBills) : null;
  const totalRemaining = tableBills
    .filter(b => ['draft', 'partial', 'overdue'].includes(b.status))
    .reduce((s, b) => s + (b.remaining || 0), 0);

  // ── ثلاث حالات فقط ──────────────────────────────────────────────────────
  // 1. فارغة  → رمادي
  // 2. مشغولة → أحمر موحد (badge الوقت هو المؤشر الوحيد)
  // 3. محددة  → برتقالي

  const styles = isSelected
    ? {
        card:   'border-orange-400 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/40 dark:to-orange-800/30 shadow-lg ring-2 ring-orange-300 dark:ring-orange-700',
        icon:   'bg-orange-500',
        text:   'text-orange-700 dark:text-orange-300',
        sub:    'text-orange-500 dark:text-orange-400',
        hover:  'bg-orange-400/10',
        badge:  'bg-orange-500',
      }
    : isOccupied
    ? {
        card:   'border-red-400 bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/40 dark:to-red-800/30 hover:border-red-500 hover:shadow-lg hover:shadow-red-100 dark:hover:shadow-red-900/30',
        icon:   'bg-red-500',
        text:   'text-red-700 dark:text-red-300',
        sub:    'text-red-500 dark:text-red-400',
        hover:  'bg-red-400/10',
        badge:  ageColor === 'red'    ? 'bg-red-600'
               : ageColor === 'orange' ? 'bg-orange-500'
               : ageColor === 'yellow' ? 'bg-yellow-500'
               : 'bg-blue-500',
      }
    : {
        card:   'border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 hover:border-gray-300 hover:shadow-lg hover:shadow-gray-100 dark:hover:shadow-gray-900/30',
        icon:   'bg-gray-400 dark:bg-gray-500',
        text:   'text-gray-600 dark:text-gray-300',
        sub:    'text-gray-400 dark:text-gray-500',
        hover:  'bg-gray-400/10',
        badge:  'bg-gray-400',
      };

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        onClick={() => onClick(table)}
        className={`group relative w-full rounded-xl sm:rounded-2xl border-2 transition-all duration-300 transform hover:scale-105 sm:hover:scale-110 hover:-translate-y-1 ${styles.card}`}
      >
        {/* ── وقت / حالة badge ── */}
        <div className="absolute -top-2 -right-2 z-10">
          {isSelected ? (
            <span className="flex items-center justify-center px-2 h-6 bg-orange-500 text-white text-xs font-bold rounded-full shadow border-2 border-white dark:border-gray-800">
              {t('cafe.selected')}
            </span>
          ) : isOccupied ? (
            <span className={`flex items-center justify-center px-2 h-6 ${styles.badge} text-white text-xs font-bold rounded-full shadow border-2 border-white dark:border-gray-800 ${ageColor === 'red' ? 'animate-pulse' : ''}`}>
              {ageLabel || t('cafe.occupied')}
            </span>
          ) : (
            <span className="flex items-center justify-center px-2 h-6 bg-gray-400 dark:bg-gray-500 text-white text-xs font-bold rounded-full shadow border-2 border-white dark:border-gray-800">
              {t('cafe.empty')}
            </span>
          )}
        </div>

        {/* ── orders count badge ── */}
        {isOccupied && tableOrdersCount > 0 && (
          <div className="absolute -top-2 -left-2 z-10 w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow border border-white dark:border-gray-800">
            {tableOrdersCount}
          </div>
        )}

        {/* ── جسم الكارت ── */}
        <div className="flex flex-col items-center justify-center px-2 pt-4 pb-7 sm:pt-5 sm:pb-8">
          {/* أيقونة الطاولة / الجلسة النشطة */}
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 shadow-sm ${styles.icon}`}>
            {isOccupied && activeSessionType ? (
              <span className="text-2xl sm:text-3xl leading-none select-none animate-pulse">
                {activeSessionType === 'playstation' ? '🎮' :
                 activeSessionType === 'computer'    ? '💻' : '🎮💻'}
              </span>
            ) : (
              <TableIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            )}
          </div>

          {/* رقم الطاولة */}
          <span className={`text-lg sm:text-xl font-extrabold leading-none ${styles.text}`}>
            {getTableDisplay(table.number, i18n.language)}
          </span>

          {/* المبلغ المتبقي */}
          {isOccupied && totalRemaining > 0 && (
            <span className={`text-xs font-semibold mt-1 hidden sm:block ${styles.sub}`}>
              {formatCurrencyUtil(totalRemaining, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}
            </span>
          )}
        </div>

        {/* hover glow */}
        <div className={`absolute inset-0 rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${styles.hover}`} />

        {/* ── Quick action buttons ── */}
        {isOccupied && !isSelected && (
          <div className="absolute bottom-1.5 left-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0 z-10">
            <button
              onClick={(e) => onQuickOrder(table, e)}
              className="flex-1 py-1 bg-white/90 hover:bg-white dark:bg-gray-900/90 dark:hover:bg-gray-900 backdrop-blur-sm text-red-600 dark:text-red-400 text-xs font-bold rounded-lg flex items-center justify-center gap-0.5 shadow border border-red-200 dark:border-red-800 transition-all"
              title={t('cafe.tableOrdersModal.newOrder')}>
              <ShoppingCart className="h-3 w-3" />
              <span className="hidden sm:inline">طلب</span>
            </button>
            <button
              onClick={(e) => onQuickBilling(table, e)}
              className="flex-1 py-1 bg-white/90 hover:bg-white dark:bg-gray-900/90 dark:hover:bg-gray-900 backdrop-blur-sm text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg flex items-center justify-center gap-0.5 shadow border border-blue-200 dark:border-blue-800 transition-all"
              title={t('billing.paymentManagement')}>
              <DollarSign className="h-3 w-3" />
              <span className="hidden sm:inline">دفع</span>
            </button>
          </div>
        )}
        {!isOccupied && (
          <div className="absolute bottom-1.5 left-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0 z-10">
            <button
              onClick={(e) => onQuickOrder(table, e)}
              className="flex-1 py-1 bg-white/90 hover:bg-white dark:bg-gray-900/90 dark:hover:bg-gray-900 backdrop-blur-sm text-gray-600 dark:text-gray-300 text-xs font-bold rounded-lg flex items-center justify-center gap-0.5 shadow border border-gray-200 dark:border-gray-600 transition-all"
              title={t('cafe.tableOrdersModal.newOrder')}>
              <Plus className="h-3 w-3" />
              <span className="hidden sm:inline">طلب جديد</span>
            </button>
          </div>
        )}
      </button>

      {/* ── Tooltip ── */}
      {showTooltip && isOccupied && tableBills.length > 0 && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-900 dark:bg-gray-700 text-white rounded-xl shadow-2xl p-3 text-xs pointer-events-none">
          <div className="font-bold text-sm mb-2 text-red-300 flex items-center gap-1.5">
            <TableIcon className="h-3.5 w-3.5" />
            {t('cafe.table')} {getTableDisplay(table.number, i18n.language)}
          </div>
          {tableBills.filter(b => ['draft','partial','overdue'].includes(b.status)).slice(0, 3).map((b, i) => (
            <div key={i} className="flex justify-between items-center py-1 border-b border-gray-700 dark:border-gray-600 last:border-0">
              <span className="text-gray-300">#{b.billNumber?.slice(-6) || b.id?.slice(-6)}</span>
              <span className="font-semibold text-red-300">
                {formatCurrencyUtil(b.remaining || 0, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}
              </span>
            </div>
          ))}
          {tableOrdersCount > 0 && (
            <div className="mt-2 text-blue-300 flex items-center gap-1.5">
              <ShoppingCart className="h-3 w-3" />
              <span>{tableOrdersCount} {t('nav.orders', 'طلبات')}</span>
            </div>
          )}
          {ageLabel && (
            <div className="mt-1 flex items-center gap-1.5 text-yellow-300">
              <Clock className="h-3 w-3" />
              <span>{ageLabel}</span>
            </div>
          )}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 dark:bg-gray-700 rotate-45" />
        </div>
      )}
    </div>
  );
});
TableButton.displayName = 'TableButton';

// Memoized PlayStation Bill Item
const PlaystationBillItem = memo(({ bill, onPaymentClick, onChangeTableClick, getStatusColor, getStatusText, formatCurrency }: {
  bill: Bill; onPaymentClick: (bill: Bill) => void; onChangeTableClick?: (bill: Bill) => void;
  getStatusColor: (s: string) => string; getStatusText: (s: string) => string; formatCurrency: (a: number) => string;
}) => {
  const { t, i18n } = useTranslation();
  const isUnpaid = ['draft', 'partial', 'overdue'].includes(bill.status);
  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg border-2 gap-3 sm:gap-0
      ${isUnpaid ? 'bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-orange-300 dark:border-orange-700' : 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-300 dark:border-green-700'}`}>
      <div className="flex-1 cursor-pointer w-full sm:w-auto" onClick={() => onPaymentClick(bill)}>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100">#{bill.billNumber || bill.id || bill._id}</span>
          <span className={`px-2 sm:px-3 py-1 text-xs font-bold rounded-full shadow-sm ${getStatusColor(bill.status)}`}>{getStatusText(bill.status)}</span>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          {bill.table?.number ? (
            <span className="flex items-center text-blue-600 dark:text-blue-400 font-medium">🪑 {t('billing.tableWithNumber', { number: getTableDisplay(bill.table.number, i18n.language) })}</span>
          ) : (
            <span className="flex items-center text-gray-500">⚠️ {t('billing.notLinkedToTable')}</span>
          )}
          <span className="font-medium">{formatCurrency(bill.total || 0)}</span>
        </div>
      </div>
      <div className="flex flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
        <div className="text-center bg-white dark:bg-gray-800 px-2 sm:px-3 py-2 rounded-lg shadow-sm">
          <div className={`text-sm sm:text-base font-bold ${isUnpaid ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(bill.remaining || 0)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{t('billing.remainingAmount')}</div>
        </div>
        {onChangeTableClick && (
          <button onClick={(e) => { e.stopPropagation(); onChangeTableClick(bill); }}
            className="px-2 sm:px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm rounded-lg transition-all flex items-center gap-1 shadow-md">
            <TableIcon className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">{t('billing.change')}</span>
          </button>
        )}
      </div>
    </div>
  );
});


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
    bills, fetchBills, orders, fetchOrders, user,
    cancelBill, addPartialPayment,
  } = useApp();

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
  const [currentOrderItems, setCurrentOrderItems] = useState<LocalOrderItem[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [orderNotes, setOrderNotes] = useState('');
  const [tableStatuses, setTableStatuses] = useState<Record<string | number, { hasUnpaid: boolean; orders: Order[] }>>({});
  const [showManagementModal, setShowManagementModal] = useState(false);
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
  const [billTypeFilter, setBillTypeFilter] = useState<'all' | 'cafe' | 'playstation' | 'computer'>('all');
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
  const [tableBillsMap, setTableBillsMap] = useState<Record<number, { hasUnpaid: boolean; bills: Bill[] }>>({});

  // ── New Enhancement State ─────────────────────────────────────────────────
  // #2 - Global search bar
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<Bill[] | null>(null);
  const [isGlobalSearching, setIsGlobalSearching] = useState(false);
  const [showGlobalSearchResults, setShowGlobalSearchResults] = useState(false);
  const globalSearchRef = useRef<HTMLInputElement>(null);

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

  // #7 - Activity log tab
  const [activeTab3, setActiveTab3] = useState<'orders' | 'billing' | 'log'>('orders');
  const [tableActivityLog, setTableActivityLog] = useState<Array<{type: string; message: string; time: Date; color: string}>>([]);

  // #8 - Drag & Drop in management modal (order tracking)
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);

  // #9 - Fullscreen mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  // #11 - Daily report modal
  const [showDailyReportModal, setShowDailyReportModal] = useState(false);
  const [isPrintingReport, setIsPrintingReport] = useState(false);

  // ── useBillAggregation ───────────────────────────────────────────────────
  const { aggregatedItems: backendAggregatedItems, loading: aggregationLoading, refetch: refetchAggregatedItems } = useBillAggregation(selectedBill?.id || selectedBill?._id || null);

  // ── Refs sync ────────────────────────────────────────────────────────────
  useEffect(() => { selectedBillRef.current = selectedBill; }, [selectedBill]);
  useEffect(() => { selectedTableRef.current = selectedTable; }, [selectedTable]);
  useEffect(() => { tablesRef.current = tables; }, [tables]);

  // ── Modal scroll lock ────────────────────────────────────────────────────
  const anyModalOpen = showOrderModal || showEditOrderModal || showManagementModal ||
    showSectionModal || showTableModal || showConfirmModal || showUnifiedTableModal ||
    showPaymentModal || showPartialPaymentModal || showSessionPaymentModal ||
    showQuickAddModal || showDailyReportModal;
  useBodyScrollLock(anyModalOpen);

  // ── Permission check ─────────────────────────────────────────────────────
  const checkUserRole = () => {
    if (user?.role === 'admin') return true;
    if (user?.permissions?.includes('view_all_bills') || user?.permissions?.includes('admin') || user?.permissions?.includes('all')) return true;
    return false;
  };
  const isManagerOrOwner = checkUserRole();

  // ── Load initial data ────────────────────────────────────────────────────
  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTableSections(), fetchTables(), fetchBills(),
        fetchAvailableMenuItems(), fetchMenuSections(), fetchMenuCategories(),
      ]);
      setLoading(false);
      fetchOrders().catch(() => {});
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

  // ── Table statuses ───────────────────────────────────────────────────────
  const fetchAllTableStatuses = useCallback(() => {
    const statuses: Record<number, { hasUnpaid: boolean; orders: Order[] }> = {};
    const unpaidBills = bills.filter((b: any) => b.status !== 'paid' && b.status !== 'cancelled');
    const tableBillsMapLocal = new Map<string, any[]>();
    unpaidBills.forEach((bill: any) => {
      if (bill.table) {
        const tid = (bill.table._id || bill.table.id || bill.table).toString();
        if (!tableBillsMapLocal.has(tid)) tableBillsMapLocal.set(tid, []);
        tableBillsMapLocal.get(tid)!.push(bill);
      }
    });
    for (const table of tables) {
      const tid = (table._id || table.id).toString();
      statuses[table.number] = { hasUnpaid: (tableBillsMapLocal.get(tid) || []).length > 0, orders: [] };
    }
    setTableStatuses(statuses);
  }, [bills, tables]);

  useEffect(() => {
    if (tables.length > 0) fetchAllTableStatuses();
  }, [tables, bills, fetchAllTableStatuses]);

  // tableBillsMap for billing tab
  useEffect(() => {
    if (tables.length > 0) {
      const map: Record<string | number, { hasUnpaid: boolean; bills: Bill[] }> = {};
      tables.forEach((table: Table) => {
        const tableIdStr = table._id.toString();
        const tableBills = bills.filter((bill: Bill) => {
          if (!bill.table) return false;
          return ((bill.table as any)._id || bill.table).toString() === tableIdStr;
        });
        map[table.number] = {
          hasUnpaid: tableBills.some((b: Bill) => ['draft', 'partial', 'overdue'].includes(b.status)),
          bills: tableBills,
        };
      });
      setTableBillsMap(map);
    }
  }, [bills, tables]);

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
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedBill)) setSelectedBill(updated);
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

  // ── Auto-refresh active sessions ─────────────────────────────────────────
  useEffect(() => {
    let interval: Interval | null = null;
    const updateActiveSessions = async () => {
      const activeSessionBills = bills.filter(b => hasActiveSession(b));
      if (activeSessionBills.length === 0) return;
      await Promise.all(activeSessionBills.flatMap(bill =>
        bill.sessions.filter(s => s.status === 'active').map(async s => {
          await api.updateSessionCost(s._id || s.id);
          if (selectedBill && (selectedBill._id === bill._id || selectedBill.id === bill.id)
            && !showPaymentModal && !showPartialPaymentModal && !showSessionPaymentModal) {
            const r = await api.getBill(bill._id || bill.id);
            if (r.success && r.data) setSelectedBill(r.data);
          }
        })
      ));
      await fetchBills();
    };
    if (bills.some(b => hasActiveSession(b))) interval = setInterval(updateActiveSessions, 5000);
    return () => { if (interval) clearInterval(interval); };
  }, [bills.length, bills.map(b => (b.sessions || []).map(s => s.status).join(',')).join(','),
    showPaymentModal, showPartialPaymentModal, showSessionPaymentModal, selectedBill?._id]);

  // ── Socket.IO ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (socketRef.current) return;
    const socketUrl = API_BASE_URL.replace(/\/api\/?$/, '');
    const socket: Socket = io(socketUrl, {
      path: '/socket.io/', transports: ['websocket', 'polling'],
      reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    // إعادة الاتصال — جلب كل شيء من جديد
    socket.on('reconnect', () => {
      Promise.all([fetchBills(), fetchTables(), fetchOrders()]).then(() => fetchAllTableStatuses()).catch(() => {});
    });

    // ── تحديث الطلبات ────────────────────────────────────────────────────
    socket.on('order-update', (data: any) => {
      if (!['created', 'updated', 'deleted'].includes(data.type)) return;

      // تحديث فوري للطلبات والفواتير وحالة الكروت
      Promise.all([fetchOrders(), fetchBills()]).then(() => fetchAllTableStatuses()).catch(() => {});

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
        // تحديث table status فوراً من الـ data
        if (data.bill.table) {
          const tbl = tablesRef.current.find(tb => {
            const btid = data.bill.table?._id || data.bill.table;
            return tb._id === btid || (tb as any).id === btid;
          });
          if (tbl) {
            const isUnpaid = !['paid', 'cancelled'].includes(data.bill.status);
            setTableStatuses(prev => ({
              ...prev,
              [tbl.number]: { ...prev[tbl.number], hasUnpaid: isUnpaid },
            }));
          }
        }
      }
      // جلب في الخلفية للتأكيد
      Promise.all([fetchBills(), fetchTables()]).then(() => fetchAllTableStatuses()).catch(() => {});
    });

    // ── دفعة مستلمة ──────────────────────────────────────────────────────
    socket.on('payment-received', (data: any) => {
      const cur = selectedBillRef.current;
      if (cur && data.bill && (data.bill._id === cur._id || data.bill.id === cur.id)) {
        setSelectedBill({ ...data.bill });
        if (data.bill.remaining !== undefined) {
          setPaymentAmount(data.bill.remaining.toString());
          setOriginalAmount(data.bill.remaining.toString());
        }
      }
      Promise.all([fetchBills(), fetchTables()]).then(() => fetchAllTableStatuses()).catch(() => {});
    });

    // ── دفعة جزئية ───────────────────────────────────────────────────────
    socket.on('partial-payment-received', (data: any) => {
      const cur = selectedBillRef.current;
      if (cur && data.bill && (data.bill._id === cur._id || data.bill.id === cur.id)) {
        setSelectedBill({ ...data.bill });
      }
      Promise.all([fetchBills(), fetchTables()]).then(() => fetchAllTableStatuses()).catch(() => {});
    });

    // ── تحديث الجلسات ────────────────────────────────────────────────────
    socket.on('session-update', (data: any) => {
      // جلب الفواتير لأن الجلسة مرتبطة بفاتورة
      Promise.all([fetchBills(), fetchTables()]).then(() => fetchAllTableStatuses()).catch(() => {});
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

    // ── حالة الطاولة ─────────────────────────────────────────────────────
    socket.on('table-status-update', (data: { tableId: string; status: string }) => {
      const table = tablesRef.current.find(tb => tb._id === data.tableId || (tb as any).id === data.tableId);
      if (table) {
        setTableStatuses(prev => ({
          ...prev,
          [table.number]: { ...prev[table.number], hasUnpaid: data.status === 'occupied' },
        }));
      }
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

  // #6 — filtered sections for section-tab
  const filteredSectionsForDisplay = useMemo(() => {
    if (activeSectionFilter === 'all') return activeTableSections;
    return activeTableSections.filter(s => s.id === activeSectionFilter);
  }, [activeTableSections, activeSectionFilter]);

  const tableStats = useMemo(() => {
    const empty = activeTables.filter(t => !tableStatuses[t.number]?.hasUnpaid).length;
    const occupied = activeTables.filter(t => tableStatuses[t.number]?.hasUnpaid).length;
    return { totalSections: activeTableSections.length, totalTables: activeTables.length, emptyTables: empty, occupiedTables: occupied };
  }, [activeTables, activeTableSections, tableStatuses]);

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
  }, [bills, selectedTable, billTypeFilter, statusFilter]);

  const billStats = useMemo(() => filteredBills.reduce((acc, bill) => ({
    totalBills: acc.totalBills + 1,
    totalPaid: acc.totalPaid + (Number(bill.paid) || 0),
    totalRemaining: acc.totalRemaining + (Number(bill.remaining) || 0),
    partialBills: acc.partialBills + (bill.status === 'partial' ? 1 : 0),
    totalAmount: acc.totalAmount + (Number(bill.total) || 0),
  }), { totalBills: 0, totalPaid: 0, totalRemaining: 0, partialBills: 0, totalAmount: 0 }), [filteredBills]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const formatCurrency = (amount: number) => formatCurrencyUtil(amount, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP');

  const hasActiveSession = (bill: Bill) =>
    bill.sessions?.some((s: any) => (typeof s === 'object' ? s.status : null) === 'active') || false;

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

  const getCustomerDisplay = (bill: Bill) => {
    if (!bill.customerName) return t('billing.defaultCustomer');
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
          const cost  = s.finalCost || s.totalCost || 0;
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
  }, [bills, orders]);

  // تحديث تلقائي للسجل عند تغيير bills أو orders والطاولة مفتوحة
  useEffect(() => {
    if (selectedTable && showUnifiedTableModal) {
      const tableId = selectedTable._id || (selectedTable as any).id;
      buildActivityLog(tableId);
    }
  }, [bills, orders, selectedTable, showUnifiedTableModal, buildActivityLog]);

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

  // #1 Quick billing from table card — يفتح المودال على تاب الفواتير
  const handleQuickBilling = (table: Table, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTable(table);
    setActiveTab('billing');
    setActiveTab3('billing');
    setShowUnifiedTableModal(true);
    setTableBillsFilter('unpaid');
    setSearchQuery('');
    setSearchResults(null);
  };

  // #2 Global search
  useEffect(() => {
    const q = globalSearchQuery.trim();
    if (!q) { setGlobalSearchResults(null); setShowGlobalSearchResults(false); return; }
    setIsGlobalSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await api.getBills({ q });
        setGlobalSearchResults(response.success ? (response.data || []) : []);
        setShowGlobalSearchResults(true);
      } catch { setGlobalSearchResults([]); }
      finally { setIsGlobalSearching(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [globalSearchQuery]);
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
        setTimeout(() => { fetchOrders(); fetchBills(); }, 100);
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
              <td>${b.table ? `طاولة ${(b.table as any).number || ''}` : '—'}</td>
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
      name: item.name, price: item.price, quantity: item.quantity, notes: (item as any).notes || '',
    })));
    setOrderNotes(order.notes || '');
    setExpandedSections({}); setExpandedCategories({});
    setShowEditOrderModal(true);
  };

  const toggleSection = (id: string) => setExpandedSections(p => ({ ...p, [id]: !p[id] }));
  const toggleCategory = (id: string) => setExpandedCategories(p => ({ ...p, [id]: !p[id] }));

  const getCategoriesForSection = (sectionId: string) =>
    menuCategories.filter(c => {
      const s = typeof c.section === 'string' ? c.section : (c.section as MenuSection)?._id || (c.section as MenuSection)?.id;
      return s === sectionId && c.isActive;
    }).sort((a, b) => a.sortOrder - b.sortOrder);

  const getItemsForCategory = (categoryId: string) =>
    menuItems.filter(item => {
      const c = typeof item.category === 'string' ? item.category : (item.category as MenuCategory)?._id || (item.category as MenuCategory)?.id;
      return c === categoryId && item.isAvailable;
    });

  const addItemToOrder = (menuItem: MenuItem) => {
    const existing = currentOrderItems.find(i => i.menuItem === menuItem.id);
    if (existing) {
      setCurrentOrderItems(p => p.map(i => i.menuItem === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCurrentOrderItems(p => [...p, { menuItem: menuItem.id, name: menuItem.name, price: menuItem.price, quantity: 1, notes: '' }]);
    }
  };

  const updateItemQuantity = useCallback((id: string, delta: number) => {
    setCurrentOrderItems(p => p.map(i => {
      if (i.menuItem !== id) return i;
      const q = i.quantity + delta;
      if (q <= 0) return null as any;
      return { ...i, quantity: q };
    }).filter(Boolean) as LocalOrderItem[]);
  }, []);

  const updateItemNotes = useCallback((id: string, notes: string) =>
    setCurrentOrderItems(p => p.map(i => i.menuItem === id ? { ...i, notes } : i)), []);

  const removeItemFromOrder = useCallback((id: string) =>
    setCurrentOrderItems(p => p.filter(i => i.menuItem !== id)), []);

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
        items: currentOrderItems.map(i => ({ menuItem: i.menuItem, name: i.name, price: i.price, quantity: i.quantity, notes: i.notes || null })),
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
            await printOrder({ ...order, items: order.items?.map((item: any, idx: number) => ({ ...item, _id: item._id || item.id || `temp-${idx}` })) || [], createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt } as any, menuSections, map, user?.organizationName || '', i18n.language, t);
          }, 0);
        }
        setTableStatuses(p => ({ ...p, [selectedTable.number]: { hasUnpaid: true, orders: [...(p[selectedTable.number]?.orders || []), order] } }));
        setTableOrders(p => [...p, order]);
        setTimeout(() => { fetchOrders(); fetchBills(); }, 100);
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
        items: currentOrderItems.map(i => ({ menuItem: i.menuItem, name: i.name, price: i.price, quantity: i.quantity, notes: i.notes || null })),
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
            await printOrder({ ...updated, items: updated.items?.map((item: any, idx: number) => ({ ...item, _id: item._id || item.id || `temp-${idx}` })) || [], createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : updated.createdAt } as any, menuSections, map, user?.organizationName || '', i18n.language, t);
          }, 0);
        }
        if (selectedTable) setTableOrders(p => p.map(o => o.id === updated.id ? updated : o));
        setTimeout(() => { fetchOrders(); fetchBills(); }, 100);
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
    await printOrder({ ...order, items: order.items.map((item: any, idx: number) => ({ ...item, _id: item._id || item.id || `temp-${idx}` })), createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt } as any, menuSections, map, user?.organizationName || '', i18n.language, t);
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
            setTimeout(() => { fetchOrders(); fetchBills(); fetchAllTableStatuses(); }, 100);
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
      const newPaidAmount = (selectedBill.paid || 0) + parseFloat(paymentAmount);
      const newRemaining = Math.max(0, effectiveTotal - newPaidAmount);
      let newStatus = selectedBill.status || 'draft';
      if (newRemaining === 0 || newPaidAmount >= effectiveTotal) {
        if (!hasActiveSession(selectedBill)) newStatus = 'paid'; else newStatus = 'partial';
      } else if (newPaidAmount > 0) newStatus = 'partial';
      const paymentData: any = {
        paid: newPaidAmount, remaining: newRemaining, status: newStatus,
        paymentAmount: parseFloat(paymentAmount), method: paymentMethod,
        reference: paymentReference, total: selectedBill.total || 0, effectiveTotal,
      };
      if (discountPercentage && parseFloat(discountPercentage) > 0) {
        paymentData.discountPercentage = parseFloat(discountPercentage);
        paymentData.discount = discountAmount;
      }
      const result = await api.updatePayment(selectedBill.id || selectedBill._id, paymentData);
      if (result?.data) {
        // تحديث لحظي بالبيانات المحسوبة محلياً — بدون انتظار API ثاني
        const optimisticBill: Bill = {
          ...selectedBill,
          paid: newPaidAmount,
          remaining: newRemaining,
          status: newStatus as Bill['status'],
        };
        const finalStatus = newStatus;
        if (finalStatus === 'paid') {
          setShowPaymentSuccessAnim(true);
          setTimeout(() => setShowPaymentSuccessAnim(false), 2500);
        }
        handleClosePaymentModal();
        showNotification(t('billing.notifications.paymentSuccess'), 'success');
        // تحديث فوري للفواتير والطلبات والكروت في الخلفية
        Promise.all([fetchBills(), fetchTables(), fetchOrders()]).then(() => fetchAllTableStatuses()).catch(() => {});
      }
    } catch { showNotification(t('billing.notifications.paymentError'), 'error'); }
    finally { setIsProcessingPayment(false); }
  };

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
      const result = await api.updatePayment(billToPayFull.id || billToPayFull._id, {
        paid: (billToPayFull.paid || 0) + remaining, remaining: 0, status: 'paid',
        paymentAmount: remaining, method: 'cash', reference: '',
      } as any);
      if (result?.data) {
        setShowPayFullBillConfirmModal(false); setBillToPayFull(null);
        setIsProcessingPayment(false);
        setShowPaymentSuccessAnim(true);
        setTimeout(() => setShowPaymentSuccessAnim(false), 2500);
        // تحديث فوري للفواتير والطلبات والكروت
        Promise.all([fetchBills(), fetchTables(), fetchOrders()]).then(() => fetchAllTableStatuses()).catch(() => {});
        showNotification(t('billing.notifications.payFullBillSuccess'), 'success');
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
          setSelectedBill(response.data as Bill);
          // تحديث فوري للفواتير والطلبات والكروت
          Promise.all([fetchBills(), fetchTables(), fetchOrders()]).then(() => fetchAllTableStatuses()).catch(() => {});
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
        setSelectedBill(result.data);
        setShowSessionPaymentConfirmModal(false); setSessionToPayData(null);
        setIsProcessingSessionPayment(false); setSessionPaymentAmount(''); setSelectedSession(null);
        // تحديث فوري للفواتير والطلبات والكروت
        Promise.all([fetchBills(), fetchTables(), fetchOrders()]).then(() => fetchAllTableStatuses()).catch(() => {});
        showNotification(t('billing.notifications.sessionPaymentSuccess'), 'success');
      } else {
        showNotification(result.message || t('billing.notifications.sessionPaymentError'), 'error');
        setIsProcessingSessionPayment(false); setShowSessionPaymentConfirmModal(false);
      }
    } catch { showNotification(t('billing.notifications.sessionPaymentError'), 'error'); setIsProcessingSessionPayment(false); setShowSessionPaymentConfirmModal(false); }
  };

  const handleEndSession = async (sessionId: string) => {
    if (selectedBill?.sessions) {
      const session = selectedBill.sessions.find((s: any) => (s.id || s._id) === sessionId);
      if (session && !selectedBill?.table) setCustomerNameForEndSession((session as any).customerName || '');
      else setCustomerNameForEndSession('');
    }
    setSessionToEnd(sessionId); setShowSessionEndModal(true);
  };

  const confirmSessionEnd = async () => {
    if (!sessionToEnd) return;
    const linked = !!(selectedBill?.table);
    if (!linked && !customerNameForEndSession.trim()) { showNotification(t('billing.notifications.customerNameRequired'), 'error'); return; }
    setIsEndingSession(true);
    try {
      const result = await api.endSession(sessionToEnd, customerNameForEndSession.trim() || undefined);
      if (result?.success) {
        if (result.data) setSelectedBill(result.data as unknown as Bill);
        setShowSessionEndModal(false); setSessionToEnd(null); setCustomerNameForEndSession('');
        setIsEndingSession(false);
        showNotification(t('billing.notifications.endSessionSuccess'), 'success');
        setPaymentAmount(''); setPaymentMethod('cash'); setPaymentReference('');
        // تحديث فوري في الخلفية
        Promise.all([fetchBills(), fetchTables(), fetchOrders()]).then(() => fetchAllTableStatuses()).catch(() => {});
      } else { showNotification(t('billing.notifications.endSessionError'), 'error'); setIsEndingSession(false); }
    } catch { showNotification(t('billing.notifications.endSessionUnexpectedError'), 'error'); setIsEndingSession(false); }
  };

  const handleCancelBill = async () => {
    if (!canDeleteBill(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    if (!selectedBill) return;
    try {
      setIsCancelingBill(true);
      const result = await api.deleteBill(selectedBill.id || selectedBill._id);
      if (result?.success) {
        setShowCancelConfirmModal(false); handleClosePaymentModal(); setIsCancelingBill(false);
        showNotification(t('billing.notifications.deleteBillSuccess'), 'success');
        Promise.all([fetchBills(), fetchTables(), fetchOrders()]).then(() => fetchAllTableStatuses()).catch(() => {});
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
      if (result?.success) {
        if (result.data) setSelectedBill(result.data);
        showNotification(t('billing.notifications.tableChangeSuccess', { tableNumber: targetTable?.number || newTableNumber }), 'success');
        setShowChangeTableModal(false); setNewTableNumber(null); setTableChangeSearch('');
        Promise.all([fetchBills(), fetchTables()]).then(() => fetchAllTableStatuses()).catch(() => {});
      } else { showNotification(t('billing.notifications.tableChangeError'), 'error'); }
    } catch (error: any) {
      showNotification(`❌ ${error?.response?.data?.message || error?.message || t('billing.notifications.unexpectedError')}`, 'error');
    } finally { setIsChangingTable(false); }
  };

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
        Promise.all([fetchBills(), fetchTables()]).then(() => fetchAllTableStatuses()).catch(() => {});
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
        Promise.all([fetchBills(), fetchTables()]).then(() => fetchAllTableStatuses()).catch(() => {});
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
        // تحديث فوري بدون انتظار
        if (response.data) setSelectedBill(response.data as Bill);
        Promise.all([fetchBills(), fetchTables()]).then(() => {
          if (showSessionPaymentModal && selectedBill) {
            api.getBill(selectedBill.id || selectedBill._id).then(r => { if (r?.data) setSelectedBill(r.data); }).catch(() => {});
          }
        }).catch(() => {});
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
    <div className={`space-y-4 sm:space-y-6 ${isFullscreen ? 'fixed inset-0 z-[100] bg-white dark:bg-gray-900 overflow-y-auto p-4' : ''}`}>

      {/* ── Payment Success Animation (#3) ── */}
      {showPaymentSuccessAnim && (
        <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
          <div className="animate-ping-once flex flex-col items-center justify-center">
            <div className="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center shadow-2xl animate-bounce-once">
              <CheckCircle className="h-20 w-20 text-white" />
            </div>
            <span className="mt-4 text-2xl font-bold text-green-600 bg-white dark:bg-gray-900 px-6 py-2 rounded-full shadow-xl">
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
      )}

      {/* ── Header ── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
              <TableIcon className={`h-5 w-5 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400 ${isRTL ? 'ml-2' : 'mr-2'} flex-shrink-0`} />
              <span className="truncate">{t('tables.pageTitle', 'الطاولات')}</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">{t('tables.pageSubtitle', 'إدارة الطلبات والفواتير')}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 flex-wrap">
            <select value={billTypeFilter} onChange={e => setBillTypeFilter(e.target.value as any)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
              <option value="all">{t('billing.filters.allBills')}</option>
              <option value="cafe">{t('billing.filters.cafeBills')}</option>
              <option value="playstation">{t('billing.filters.playstationBills')}</option>
              <option value="computer">{t('billing.filters.computerBills')}</option>
            </select>
            {/* #11 Daily report button */}
            <button onClick={() => setShowDailyReportModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center transition-colors text-sm sm:text-base" title="تقرير يومي">
              <FileText className={`h-4 w-4 sm:h-5 sm:w-5 ${isRTL ? 'ml-1 sm:ml-2' : 'mr-1 sm:mr-2'}`} />
              <span className="hidden sm:inline">تقرير اليوم</span>
            </button>
            <button onClick={() => setShowManagementModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center transition-colors text-sm sm:text-base">
              <Settings className={`h-4 w-4 sm:h-5 sm:w-5 ${isRTL ? 'ml-1 sm:ml-2' : 'mr-1 sm:mr-2'}`} />
              {t('cafe.manageTables')}
            </button>
            {/* #9 Fullscreen button */}
            <button onClick={toggleFullscreen}
              className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 p-2 rounded-lg transition-colors" title={isFullscreen ? 'إنهاء الشاشة الكاملة' : 'شاشة كاملة'}>
              {isFullscreen ? <Minimize2 className="h-4 w-4 sm:h-5 sm:w-5" /> : <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5" />}
            </button>
            <button onClick={loadInitialData}
              className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-colors">
              {t('cafe.refresh')}
            </button>
          </div>
        </div>

        {/* ── #2 Global Search Bar ── */}
        <div className="relative">
          <div className="relative flex items-center">
            <Search className={`absolute ${isRTL ? 'right-4' : 'left-4'} h-5 w-5 text-gray-400 z-10`} />
            <input
              ref={globalSearchRef}
              type="text"
              value={globalSearchQuery}
              onChange={e => setGlobalSearchQuery(e.target.value)}
              onFocus={() => globalSearchQuery.trim() && setShowGlobalSearchResults(true)}
              placeholder="بحث سريع في الفواتير برقم الفاتورة أو الطاولة..."
              className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all text-sm`}
            />
            {isGlobalSearching && (
              <div className={`absolute ${isRTL ? 'left-4' : 'right-4'}`}>
                <svg className="animate-spin h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              </div>
            )}
            {globalSearchQuery && !isGlobalSearching && (
              <button onClick={() => { setGlobalSearchQuery(''); setGlobalSearchResults(null); setShowGlobalSearchResults(false); }}
                className={`absolute ${isRTL ? 'left-4' : 'right-4'} text-gray-400 hover:text-gray-600`}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showGlobalSearchResults && globalSearchResults !== null && (() => {
            const q = globalSearchQuery.trim().toLowerCase();

            // ── الطاولات المطابقة أولاً ──────────────────────────────────────
            const matchedTables = q ? activeTables.filter(tb => {
              const num = String(tb.number).toLowerCase();
              return num.includes(q) || num === q;
            }) : [];

            const total = matchedTables.length + globalSearchResults.length;

            return (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border-2 border-orange-200 dark:border-orange-700 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
                {total === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">لا توجد نتائج</div>
                ) : (
                  <>
                    {/* ── الطاولات ── */}
                    {matchedTables.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                          <TableIcon className="h-3 w-3" /> الطاولات
                        </div>
                        {matchedTables.map(tb => {
                          const tbIdStr = (tb._id || (tb as any).id).toString();
                          const tbBills = bills.filter((b: Bill) => {
                            const btid = (b.table as any)?._id || b.table;
                            return btid?.toString() === tbIdStr;
                          });
                          const unpaid = tbBills.filter(b => ['draft','partial','overdue'].includes(b.status));
                          const isOcc = tableStatuses[tb.number]?.hasUnpaid || false;
                          return (
                            <button key={tb._id || (tb as any).id}
                              onClick={() => { setShowGlobalSearchResults(false); setGlobalSearchQuery(''); handleTableClick(tb); }}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 dark:hover:bg-orange-900/20 border-b border-gray-100 dark:border-gray-700 text-right transition-colors">
                              {/* أيقونة الطاولة */}
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isOcc ? 'bg-red-500' : 'bg-gray-400'}`}>
                                <TableIcon className="h-4 w-4 text-white" />
                              </div>
                              <div className="flex-1 min-w-0 text-right">
                                <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                  طاولة {getTableDisplay(tb.number, i18n.language)}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {isOcc
                                    ? `${unpaid.length} فاتورة غير مدفوعة`
                                    : 'فارغة'}
                                </div>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${isOcc ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                                {isOcc ? 'مشغولة' : 'فارغة'}
                              </span>
                            </button>
                          );
                        })}
                      </>
                    )}

                    {/* ── الفواتير ── */}
                    {globalSearchResults.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                          <Receipt className="h-3 w-3" /> الفواتير
                        </div>
                        {globalSearchResults.map(bill => {
                          const isUnpaid = ['draft','partial','overdue'].includes(bill.status);
                          const tblNum = (bill.table as any)?.number;
                          return (
                            <button key={bill.id || bill._id}
                              onClick={() => {
                                setShowGlobalSearchResults(false);
                                setGlobalSearchQuery('');
                                const tbl = tables.find((tb: Table) => {
                                  const btid = (bill.table as any)?._id || bill.table;
                                  return tb._id === btid || (tb as any).id === btid;
                                });
                                if (tbl) { handleTableClick(tbl); setTimeout(() => { setActiveTab('billing'); setActiveTab3('billing'); handlePaymentClick(bill); }, 100); }
                                else { handlePaymentClick(bill); }
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 dark:hover:bg-orange-900/20 border-b border-gray-100 dark:border-gray-700 last:border-0 text-right transition-colors">
                              {/* أيقونة الفاتورة */}
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isUnpaid ? 'bg-orange-500' : 'bg-green-500'}`}>
                                <Receipt className="h-4 w-4 text-white" />
                              </div>
                              <div className="flex-1 min-w-0 text-right">
                                <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                  فاتورة #{bill.billNumber || (bill.id || bill._id)?.slice(-6)}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {tblNum ? `طاولة ${getTableDisplay(tblNum, i18n.language)}` : (bill.customerName || t('billing.defaultCustomer'))}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className={`text-sm font-bold ${isUnpaid ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                  {formatCurrencyUtil(bill.remaining || 0, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(bill.status)}`}>{getStatusText(bill.status)}</span>
                              </div>
                            </button>
                          );
                        })}
                      </>
                    )}
                  </>
                )}
                <button onClick={() => setShowGlobalSearchResults(false)}
                  className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-center border-t border-gray-100 dark:border-gray-700 transition-colors">
                  إغلاق
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Stats cards (admin only) ── */}
      {user?.role !== 'staff' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Total tables */}
          <div className="group bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl shadow-lg hover:shadow-2xl p-4 sm:p-6 text-white transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-xs sm:text-sm font-medium mb-1 sm:mb-2">{t('cafe.totalTables')}</p>
                <p className="text-2xl sm:text-4xl font-bold">{formatDecimal(tableStats.totalTables, i18n.language)}</p>
              </div>
              <div className="bg-white/20 rounded-full p-2 sm:p-4"><TableIcon className="h-5 w-5 sm:h-8 sm:w-8" /></div>
            </div>
          </div>
          {/* Collected */}
          <div className="group bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 rounded-xl shadow-lg hover:shadow-2xl p-4 sm:p-6 text-white transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-xs sm:text-sm font-medium mb-1 sm:mb-2">{t('billing.statistics.collectedAmount')}</p>
                <p className="text-xl sm:text-3xl font-bold">{showPaidAmount ? formatCurrency(billStats.totalPaid) : '••••••'}</p>
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
                <p className="text-orange-100 text-xs sm:text-sm font-medium mb-1 sm:mb-2">{t('billing.statistics.remainingAmount')}</p>
                <p className="text-xl sm:text-3xl font-bold">{showRemainingAmount ? formatCurrency(billStats.totalRemaining) : '••••••'}</p>
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
                <p className="text-red-100 text-xs sm:text-sm font-medium mb-1 sm:mb-2">{t('cafe.occupiedTables')}</p>
                <p className="text-2xl sm:text-4xl font-bold">{formatDecimal(tableStats.occupiedTables, i18n.language)}</p>
              </div>
              <div className="bg-white/20 rounded-full p-2 sm:p-4"><AlertTriangle className="h-5 w-5 sm:h-8 sm:w-8" /></div>
            </div>
          </div>
        </div>
      )}

      {/* ── Table Grid ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <div className="w-1 h-6 sm:h-8 bg-blue-500 rounded-full flex-shrink-0"></div>
              <span className="truncate">{t('cafe.sectionsAndTables')}</span>
            </h2>
            {/* ── #6 Section filter tabs ── */}
            {activeTableSections.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide flex-nowrap">
                <button
                  onClick={() => setActiveSectionFilter('all')}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${activeSectionFilter === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                  الكل ({activeTables.length})
                </button>
                {activeTableSections.map(sec => {
                  const cnt = (getTablesBySection[sec.id] || []).length;
                  const occ = (getTablesBySection[sec.id] || []).filter(tb => tableStatuses[tb.number]?.hasUnpaid).length;
                  if (cnt === 0) return null;
                  return (
                    <button key={sec.id}
                      onClick={() => setActiveSectionFilter(sec.id)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${activeSectionFilter === sec.id ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                      <span>{sec.name}</span>
                      {occ > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeSectionFilter === sec.id ? 'bg-white/30 text-white' : 'bg-red-500 text-white'}`}>{occ}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="p-3 sm:p-6">
          {loading && tableSections.length === 0 ? (
            <div className="text-center py-8 text-gray-500">{t('common.loading')}</div>
          ) : tableSections.length === 0 ? (
            <div className="text-center py-8 text-gray-500">{t('cafe.noSections')}</div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {filteredSectionsForDisplay.map(section => {
                const sectionTables = getTablesBySection[section.id] || [];
                if (sectionTables.length === 0) return null;
                return (
                  <div key={section.id} className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-3 sm:p-5 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 shadow-md">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
                      <div className="w-1 h-5 sm:h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full flex-shrink-0"></div>
                      <span className="truncate">{section.name}</span>
                      <span className="text-xs text-gray-400 font-normal">({sectionTables.length})</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                      {sectionTables.map(table => {
                        const tableIdStr = (table._id || (table as any).id).toString();
                        const tBills = bills.filter((b: Bill) => {
                          const btid = (b.table as any)?._id || b.table;
                          return btid && btid.toString() === tableIdStr;
                        });
                        const tOrdersCount = orders.filter((o: any) => {
                          const oid = o.table?._id || o.table?.id || o.table;
                          return oid && oid.toString() === tableIdStr && !['paid','cancelled'].includes((o.bill as any)?.status);
                        }).length;

                        // حساب نوع الجلسات النشطة — نبحث في كل الفواتير المرتبطة بالطاولة
                        // الجلسات قد تكون في فواتير billType='playstation'|'computer' مرتبطة بطاولة
                        const allTableBills = bills.filter((b: Bill) => {
                          const btid = (b.table as any)?._id || (b.table as any)?.id || b.table;
                          return btid && btid.toString() === tableIdStr;
                        });
                        const activeSessions = allTableBills.flatMap((b: Bill) =>
                          ((b as any).sessions || []).filter((s: any) =>
                            typeof s === 'object' && s !== null && s.status === 'active'
                          )
                        );
                        const hasPS = activeSessions.some((s: any) =>
                          (s.deviceType || '').toLowerCase().includes('playstation')
                        );
                        const hasPC = activeSessions.some((s: any) =>
                          (s.deviceType || '').toLowerCase().includes('computer')
                        );
                        const activeSessionType: 'playstation' | 'computer' | 'both' | null =
                          hasPS && hasPC ? 'both' : hasPS ? 'playstation' : hasPC ? 'computer' : null;
                        return (
                          <TableButton
                            key={table.id}
                            table={table}
                            isSelected={selectedTable?.id === table.id && showUnifiedTableModal}
                            isOccupied={tableStatuses[table.number]?.hasUnpaid || false}
                            tableBills={tBills}
                            tableOrdersCount={tOrdersCount}
                            activeSessionType={activeSessionType}
                            onClick={handleTableClick}
                            onQuickOrder={handleQuickOrder}
                            onQuickBilling={handleQuickBilling}
                          />
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

      {/* ── Gaming Devices Section ── */}
      {(billTypeFilter === 'all' || billTypeFilter === 'playstation' || billTypeFilter === 'computer') && (
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
                      className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${gamingDeviceTypeFilter === type ? (type === 'all' ? 'bg-purple-500 text-white' : type === 'playstation' ? 'bg-blue-500 text-white' : 'bg-indigo-500 text-white') : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                      {type === 'all' ? `🎯 ${t('billing.filters.all')}` : type === 'playstation' ? `🎮 ${t('billing.gamingDevices.playstation')}` : `💻 ${t('billing.gamingDevices.computer')}`}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 sm:gap-2">
                  {(['unpaid', 'paid', 'all'] as const).map(s => (
                    <button key={s} onClick={() => setPlaystationStatusFilter(s)}
                      className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${playstationStatusFilter === s ? (s === 'unpaid' ? 'bg-orange-500 text-white' : s === 'paid' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white') : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                      {s === 'unpaid' ? t('billing.filters.unpaid') : s === 'paid' ? t('billing.filters.paid') : t('billing.filters.all')}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                  <input type="text" placeholder={t('billing.searchDevice')} value={playstationSearchQuery} onChange={e => setPlaystationSearchQuery(e.target.value)}
                    className="pr-8 sm:pr-10 pl-3 sm:pl-4 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 text-xs sm:text-sm" />
                </div>
              </div>
            )}
          </div>
          {!isPlaystationSectionCollapsed && (() => {
            const allGamingBills = bills.filter((bill: Bill) => !bill.table && (bill.billType === 'playstation' || bill.billType === 'computer' || (bill.sessions && bill.sessions.some((s: any) => s.deviceType === 'playstation' || s.deviceType === 'computer'))));
            const deviceMap = new Map<string, { deviceName: string; deviceType: 'playstation' | 'computer'; hasActiveSession: boolean; bills: Bill[] }>();
            allGamingBills.forEach((bill: Bill) => {
              const gamingSessions = bill.sessions?.filter((s: any) => s.deviceType === 'playstation' || s.deviceType === 'computer') || [];
              gamingSessions.forEach((session: any) => {
                const key = session.deviceName || `${t('billing.device')} ${session.deviceNumber}`;
                if (!deviceMap.has(key)) deviceMap.set(key, { deviceName: key, deviceType: session.deviceType, hasActiveSession: false, bills: [] });
                const d = deviceMap.get(key)!;
                if (session.status === 'active') d.hasActiveSession = true;
                if (!d.bills.find(b => (b.id || b._id) === (bill.id || bill._id))) d.bills.push(bill);
              });
            });
            const visibleDevices = Array.from(deviceMap.values()).map(d => {
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
                <p className="text-sm sm:text-base">{playstationSearchQuery ? t('billing.noSearchResults') : t('billing.noActiveDevices', { deviceType: t('billing.gamingDevices.gaming') })}</p>
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
                          <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100 truncate">{deviceData.deviceName}</h3>
                          {deviceData.hasActiveSession && <span className="px-2 sm:px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold rounded-full shadow-md animate-pulse">{icon} {t('billing.activeSession')}</span>}
                        </div>
                        {deviceData.bills.length > 0 && (
                          <div className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 px-2 sm:px-3 py-1 rounded-full">
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

      {/* ══════════════════════════════════════════════════════════════════
          UNIFIED TABLE MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {showUnifiedTableModal && selectedTable && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-30 p-2 sm:p-4 md:p-6"
          onClick={() => { setShowUnifiedTableModal(false); setSelectedTable(null); setTableBillsFilter('unpaid'); setSearchQuery(''); setSearchResults(null); }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-sm sm:max-w-5xl max-h-[95vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
            onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="relative p-4 sm:p-5 md:p-6 bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 flex-shrink-0">
              <div className="absolute top-2 right-2 w-16 h-16 sm:w-20 sm:h-20 bg-white/10 rounded-full"></div>
              <div className="relative flex items-center justify-between z-10">
                <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl border border-white/30 flex-shrink-0">
                    <TableIcon className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-2xl font-bold text-white drop-shadow-lg truncate">
                      {t('cafe.tableOrdersModal.tableTitle', { number: getTableDisplay(selectedTable.number, i18n.language) })}
                    </h2>
                    <p className="text-xs sm:text-sm text-orange-100 mt-1">
                      {t('cafe.tableOrdersModal.ordersCount', { count: filteredTableOrders.length })}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setShowUnifiedTableModal(false); setSelectedTable(null); setTableBillsFilter('unpaid'); setSearchQuery(''); setSearchResults(null); }}
                  className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 hover:bg-white/30 rounded-lg transition-all flex items-center justify-center text-white hover:scale-110 flex-shrink-0">
                  <X className="h-4 w-4 sm:h-6 sm:w-6" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
              <button onClick={() => { setActiveTab('orders'); setActiveTab3('orders'); }}
                className={`flex-1 py-3 sm:py-4 px-3 sm:px-6 text-xs sm:text-base font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${activeTab3 === 'orders' ? 'text-orange-600 dark:text-orange-400 border-b-2 border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`}>
                <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">{t('nav.orders', 'الطلبات')}</span>
                <span className="sm:hidden">طلبات</span>
                {filteredTableOrders.length > 0 && (
                  <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">{filteredTableOrders.length}</span>
                )}
              </button>
              <button onClick={() => { setActiveTab('billing'); setActiveTab3('billing'); }}
                className={`flex-1 py-3 sm:py-4 px-3 sm:px-6 text-xs sm:text-base font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${activeTab3 === 'billing' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`}>
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">{t('nav.billing', 'الفاتورة')}</span>
                <span className="sm:hidden">فاتورة</span>
                {tableBillsMap[selectedTable.number as number]?.hasUnpaid && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 animate-pulse">!</span>
                )}
              </button>
              {/* ── #7 Activity Log Tab ── */}
              <button onClick={() => setActiveTab3('log')}
                className={`flex-1 py-3 sm:py-4 px-3 sm:px-6 text-xs sm:text-base font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${activeTab3 === 'log' ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`}>
                <History className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">السجل</span>
                <span className="sm:hidden">سجل</span>
                {tableActivityLog.length > 0 && (
                  <span className="bg-purple-500 text-white text-xs rounded-full px-1.5 py-0.5">{tableActivityLog.length}</span>
                )}
              </button>
            </div>

            {/* ── ORDERS TAB ── */}
            {activeTab3 === 'orders' && (
              <>
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-6 bg-gray-50 dark:bg-gray-900">
                  {filteredTableOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 sm:py-16">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-full flex items-center justify-center mb-4 shadow-lg">
                        <ShoppingCart className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400" />
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 text-base sm:text-lg font-semibold">{t('cafe.tableOrdersModal.noOrders')}</p>
                      <p className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm mt-2 text-center px-4">{t('cafe.tableOrdersModal.clickNewOrder')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      {filteredTableOrders.map(order => (
                        <div key={order.id} className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-300">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-orange-400 via-red-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                                <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base truncate">{order.orderNumber}</div>
                                <div className="text-xs sm:text-sm font-semibold text-orange-600 dark:text-orange-400 truncate">
                                  {formatCurrency(order.finalAmount ?? order.totalAmount ?? order.items?.reduce((s: number, i: any) => s + (i.price || 0) * (i.quantity || 0), 0) ?? 0)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                              <button onClick={() => handlePrintOrder(order)} className="p-2 sm:p-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all" title={t('cafe.tableOrdersModal.print')}>
                                <Printer className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                              </button>
                              <button onClick={() => handleEditOrder(order)} className="p-2 sm:p-2.5 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-xl transition-all" title={t('cafe.tableOrdersModal.edit')}>
                                <Edit className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                              </button>
                              <button onClick={() => handleDeleteOrder(order)} className="p-2 sm:p-2.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all" title={t('cafe.tableOrdersModal.delete')}>
                                <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
                              </button>
                            </div>
                          </div>
                          {order.items && order.items.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                              {(order.items as any[]).slice(0, 3).map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-xs sm:text-sm bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                                  <span className="text-gray-700 dark:text-gray-300 font-medium truncate flex-1">{item.name}</span>
                                  <span className="text-gray-500 dark:text-gray-400 font-semibold flex-shrink-0 ml-2">×{item.quantity}</span>
                                </div>
                              ))}
                              {order.items.length > 3 && (
                                <div className="text-xs text-center text-gray-500 dark:text-gray-400 font-medium">
                                  {t('cafe.tableOrdersModal.moreItems', { count: order.items.length - 3 })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-4 sm:p-5 md:p-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {canAddOrder(user) ? (
                      <button onClick={handleAddOrder}
                        className="flex-1 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:from-orange-600 hover:via-red-600 hover:to-pink-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 font-bold text-sm sm:text-base shadow-xl hover:shadow-2xl transition-all">
                        <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                        {t('cafe.tableOrdersModal.newOrder')}
                      </button>
                    ) : <div className="flex-1"><PermissionDenied size="small" message={t('users.permissions.canAddOrderDesc')} /></div>}
                    {(tableStatuses as any)[selectedTable.number]?.hasUnpaid && (
                      <button onClick={() => handlePaymentManagement(selectedTable)}
                        className="flex-1 sm:flex-none sm:min-w-[140px] bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 font-bold text-sm sm:text-base shadow-xl hover:shadow-2xl transition-all">
                        <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />
                        {t('cafe.tableOrdersModal.paymentManagement')}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── BILLING TAB ── */}
            {activeTab3 === 'billing' && (
              <>
                {/* Filter & Search */}
                <div className="p-3 sm:p-4 bg-white/50 dark:bg-gray-800/50 border-b border-orange-200 dark:border-orange-800 space-y-3 flex-shrink-0">
                  <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                    <label className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <span className="w-2 h-2 bg-orange-500 rounded-full"></span>{t('billing.filterByStatus')}:
                    </label>
                    <select value={tableBillsFilter} onChange={e => setTableBillsFilter(e.target.value)}
                      className="border-2 border-orange-300 dark:border-orange-700 rounded-xl px-2 sm:px-4 py-1.5 sm:py-2.5 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm">
                      <option value="all">🔍 {t('billing.filters.allBills')}</option>
                      <option value="unpaid">💰 {t('billing.filters.unpaid')}</option>
                      <option value="paid">✅ {t('billing.status.paid')}</option>
                      <option value="partial">⚡ {t('billing.status.partial')}</option>
                      <option value="overdue">⚠️ {t('billing.status.overdue')}</option>
                      <option value="cancelled">❌ {t('billing.status.cancelled')}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                      <input type="text" placeholder={t('billing.searchBillPlaceholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pr-10 sm:pr-12 pl-3 sm:pl-4 py-2 sm:py-3 border-2 border-orange-300 dark:border-orange-700 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 text-sm sm:text-base" />
                    </div>
                    {searchQuery && (
                      <button onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                        className="w-8 h-8 sm:w-10 sm:h-10 bg-red-500 hover:bg-red-600 text-white rounded-xl flex items-center justify-center hover:scale-110 shadow-md">
                        <X className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Bills List */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
                  {(() => {
                    const tableBills = searchResults !== null ? searchResults : ((tableBillsMap as any)[selectedTable.number]?.bills || []);
                    const filtered = tableBills.filter((bill: Bill) => {
                      if (tableBillsFilter === 'all') return true;
                      if (tableBillsFilter === 'unpaid') return ['draft', 'partial', 'overdue'].includes(bill.status);
                      return bill.status === tableBillsFilter;
                    });
                    if (filtered.length === 0) return (
                      <div className="text-center py-12 sm:py-16">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg">
                          <Receipt className="h-10 w-10 sm:h-12 sm:w-12 text-orange-500 dark:text-orange-400" />
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 sm:mb-3">{t('billing.noBills')}</h3>
                        <p className="text-gray-600 dark:text-gray-300 text-base sm:text-lg px-4">{t('billing.noBillsForTable')}</p>
                      </div>
                    );
                    return (
                      <div className="space-y-2 sm:space-y-3">
                        {filtered.map((bill: Bill) => {
                          const isUnpaid = ['draft', 'partial', 'overdue'].includes(bill.status);
                          return (
                            <div key={bill.id || bill._id} onClick={() => handlePaymentClick(bill)}
                              className={`relative overflow-hidden rounded-xl border-2 p-3 sm:p-4 transition-all duration-300 transform hover:scale-[1.01] hover:shadow-lg cursor-pointer group
                                ${isUnpaid ? 'bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-orange-300 dark:border-orange-600' : 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-300 dark:border-emerald-600'}`}>
                              <div className={`absolute top-0 left-0 right-0 h-0.5 ${isUnpaid ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-emerald-500 to-green-500'}`}></div>
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="font-bold text-base text-gray-900 dark:text-gray-100">#{bill.billNumber || bill.id || bill._id}</span>
                                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${getStatusColor(bill.status)}`}>{getStatusText(bill.status)}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                                    {bill.createdAt && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(bill.createdAt, { year: 'numeric', month: 'short', day: 'numeric' })}</span>}
                                    {bill.customerName && <span className="flex items-center gap-1"><User className="h-3 w-3" />{getCustomerDisplay(bill)}</span>}
                                  </div>
                                </div>
                                <div className="text-center bg-white/50 dark:bg-gray-800/50 p-3 rounded-lg shadow-sm min-w-[120px]">
                                  <div className={`text-lg font-bold mb-1 ${isUnpaid ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{formatCurrency(bill.total || 0)}</div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                                    <div>{t('billing.paidAmount')}: <span className="text-green-600 font-medium">{formatCurrency(bill.paid || 0)}</span></div>
                                    <div>{t('billing.remainingAmount')}: <span className={`font-medium ${(bill.remaining || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(bill.remaining || 0)}</span></div>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1.5 min-w-[100px]">
                                  <div className="flex gap-1.5">
                                    <button onClick={e => { e.stopPropagation(); window.open(`/bill/${bill.id || bill._id}`, '_blank', 'noopener,noreferrer'); }}
                                      className="flex-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors flex items-center justify-center gap-1">
                                      <Eye className="h-3 w-3" /><span>{t('billing.view')}</span>
                                    </button>
                                    <button onClick={async e => {
                                      e.stopPropagation();
                                      try { const r = await api.getBill(bill.id || bill._id); if (r.success && r.data) await printBill(r.data, user?.organizationName, i18n.language, t); } catch { showNotification(t('billing.notifications.fetchBillForPrintUnexpectedError'), 'error'); }
                                    }} className="flex-1 px-2 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-md transition-colors flex items-center justify-center gap-1">
                                      <Printer className="h-3 w-3" /><span>{t('billing.print')}</span>
                                    </button>
                                  </div>
                                  {isUnpaid && (
                                    <button onClick={e => { e.stopPropagation(); handlePayFullBill(bill); }}
                                      className="w-full px-2 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg hover:scale-105">
                                      <DollarSign className="h-3.5 w-3.5" /><span>{t('billing.payFull')}</span>
                                    </button>
                                  )}
                                  <button onClick={e => { e.stopPropagation(); handlePaymentClick(bill); }}
                                    className="w-full px-2 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded-md transition-colors flex items-center justify-center gap-1">
                                    <DollarSign className="h-3 w-3" /><span>{t('billing.paymentManagement')}</span>
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
                <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                  <button onClick={() => { setActiveTab('orders'); setActiveTab3('orders'); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-bold text-sm sm:text-base shadow-lg transition-all">
                    <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
                    {t('billing.manageOrders')}
                  </button>
                </div>
              </>
            )}

            {/* ── #7 ACTIVITY LOG TAB ── */}
            {activeTab3 === 'log' && (
              <>
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-gray-50 dark:bg-gray-900">
                  {tableActivityLog.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="h-8 w-8 text-green-500" />
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 font-semibold text-sm">لا توجد فواتير مفتوحة</p>
                      <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">السجل يعرض فقط الفواتير غير المدفوعة</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tableActivityLog.map((entry, idx) => {
                        const cfgMap: Record<string, { dot: string; border: string; bg: string; label: string; labelColor: string }> = {
                          bill:    { dot: 'bg-blue-500',   border: 'border-r-4 border-blue-400',   bg: 'bg-white dark:bg-gray-800',          label: 'فاتورة',  labelColor: 'text-blue-600 dark:text-blue-400' },
                          order:   { dot: 'bg-orange-500', border: 'border-r-4 border-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20',  label: 'طلب',     labelColor: 'text-orange-600 dark:text-orange-400' },
                          payment: { dot: 'bg-green-500',  border: 'border-r-4 border-green-400',  bg: 'bg-green-50 dark:bg-green-900/20',   label: 'دفعة',    labelColor: 'text-green-600 dark:text-green-400' },
                          session: {
                            dot: entry.color === 'red' ? 'bg-red-500 animate-pulse' : 'bg-purple-500',
                            border: entry.color === 'red' ? 'border-r-4 border-red-400' : 'border-r-4 border-purple-400',
                            bg: entry.color === 'red' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-purple-50 dark:bg-purple-900/20',
                            label: 'جلسة',
                            labelColor: entry.color === 'red' ? 'text-red-600 dark:text-red-400' : 'text-purple-600 dark:text-purple-400',
                          },
                        };
                        const cfg = cfgMap[entry.type] || cfgMap.bill;
                        const iconMap: Record<string, React.ReactNode> = {
                          bill:    <Receipt className="h-3.5 w-3.5 text-white" />,
                          order:   <ShoppingCart className="h-3.5 w-3.5 text-white" />,
                          payment: <DollarSign className="h-3.5 w-3.5 text-white" />,
                          session: <Gamepad2 className="h-3.5 w-3.5 text-white" />,
                        };
                        // الرسالة قد تحتوي على سطر ثاني بعد \n
                        const [mainLine, subLine] = entry.message.split('\n');
                        return (
                          <div key={idx} className={`flex items-start gap-3 p-3 rounded-xl shadow-sm ${cfg.bg} ${cfg.border}`}>
                            <div className={`flex-shrink-0 w-7 h-7 rounded-full ${cfg.dot} flex items-center justify-center shadow-sm mt-0.5`}>
                              {iconMap[entry.type] || <Zap className="h-3.5 w-3.5 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <span className={`text-xs font-bold uppercase tracking-wide ${cfg.labelColor}`}>{cfg.label}</span>
                                <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {entry.time.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                  &nbsp;
                                  {entry.time.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                              <p className="text-sm text-gray-800 dark:text-gray-200 font-medium leading-snug">{mainLine}</p>
                              {subLine && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subLine}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                  <button onClick={() => { setActiveTab('orders'); setActiveTab3('orders'); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl font-bold text-sm sm:text-base shadow-lg transition-all">
                    <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
                    إدارة الطلبات
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}


      {/* ── Payment Modal — نفس شكل صفحة الفواتير ── */}
      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-fade-in">
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-blue-200 dark:border-blue-800 animate-bounce-in mx-2 sm:mx-0">

            {/* Header */}
            <div className="sticky top-0 z-10 p-3 sm:p-6 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <DollarSign className="h-5 w-5 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg sm:text-2xl font-bold text-white truncate">{t('billing.paymentManagementTitle')}</h3>
                  <p className="text-xs sm:text-sm text-blue-100 mt-1 truncate">{t('billing.bill')} #{selectedBill?.billNumber || selectedBill?.id || selectedBill?._id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                {selectedBill?.table && (
                  <button onClick={() => { setShowPaymentModal(false); setActiveTab3('orders'); setActiveTab('orders'); }}
                    className="hidden sm:flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 text-white hover:scale-105 transform">
                    <TableIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="text-xs sm:text-sm font-medium">{t('billing.editOrders')}</span>
                  </button>
                )}
                <button onClick={handleClosePaymentModal}
                  className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 flex items-center justify-center text-white hover:scale-110 transform flex-shrink-0">
                  <X className="h-4 w-4 sm:h-6 sm:w-6" />
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">

                {/* ── LEFT: Payment Info ── */}
                <div>
                  <h4 className="font-bold text-xl text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    {t('billing.paymentInfo')}
                  </h4>

                  {/* Bill Info Card */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-5 rounded-xl mb-6 border-2 border-blue-200 dark:border-blue-800 shadow-md">
                    <h5 className="font-bold text-lg text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                      <Receipt className="h-5 w-5" />{t('billing.billInfo')}
                    </h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                        <span className="text-gray-600 dark:text-gray-400 text-xs block mb-1">{t('billing.billNumber')}</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">#{selectedBill?.billNumber || selectedBill?.id || selectedBill?._id}</span>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                        <span className="text-gray-600 dark:text-gray-400 text-xs block mb-1">{t('billing.customer')}</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{getCustomerDisplay(selectedBill)}</span>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 p-3 rounded-lg shadow-sm border border-green-200 dark:border-green-800">
                        <span className="text-green-700 dark:text-green-300 text-xs block mb-1">{t('billing.totalAmount')}</span>
                        <span className="font-bold text-xl text-green-600 dark:text-green-400">{formatCurrency(selectedBill?.total || 0)}</span>
                      </div>
                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 p-3 rounded-lg shadow-sm border border-blue-200 dark:border-blue-800">
                        <span className="text-blue-700 dark:text-blue-300 text-xs block mb-1">{t('billing.paidPreviously')}</span>
                        <span className="font-bold text-xl text-blue-600 dark:text-blue-400">{formatCurrency(selectedBill?.paid || 0)}</span>
                      </div>
                      <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/30 dark:to-orange-900/30 p-3 rounded-lg shadow-sm border border-red-200 dark:border-red-800">
                        <span className="text-red-700 dark:text-red-300 text-xs block mb-1">{t('billing.remaining')}</span>
                        <span className="font-bold text-xl text-red-600 dark:text-red-400">{formatCurrency(selectedBill?.remaining || 0)}</span>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                        <span className="text-gray-600 dark:text-gray-400 text-xs block mb-1">{t('common.status')}</span>
                        <span className={`px-3 py-1.5 text-xs font-bold rounded-full inline-block shadow-sm ${getStatusColor(selectedBill?.status || 'draft')}`}>
                          {getStatusText(selectedBill?.status || 'draft')}
                        </span>
                      </div>
                      {selectedBill?.table && (
                        <div className="col-span-2 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 p-4 rounded-lg shadow-sm border border-purple-200 dark:border-purple-800">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <TableIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                              <div>
                                <span className="text-purple-700 dark:text-purple-300 text-xs block">{t('billing.table')}</span>
                                <span className="font-bold text-lg text-purple-900 dark:text-purple-100">{t('billing.tableWithNumber', { number: getTableDisplay((selectedBill.table as any).number, i18n.language) })}</span>
                              </div>
                            </div>
                            <button onClick={() => { setNewTableNumber((selectedBill.table as any)?._id || null); setShowChangeTableModal(true); }}
                              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm font-bold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-md">
                              {t('billing.changeTable')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Active Session Warning */}
                  {hasActiveSession(selectedBill) && (
                    <div className="bg-gradient-to-br from-red-50 via-orange-50 to-red-50 dark:from-red-900/40 dark:via-orange-900/30 dark:to-red-900/40 p-5 rounded-xl mb-6 border-2 border-red-300 dark:border-red-700 shadow-lg">
                      <h5 className="font-bold text-lg text-red-900 dark:text-red-100 mb-4 flex items-center gap-3">
                        <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-lg"></div>
                        <Gamepad2 className="h-6 w-6" />{t('billing.activeDevice')}
                      </h5>
                      <div className="space-y-2 text-sm">
                        {selectedBill.sessions?.filter(s => s.status === 'active').map((session, index) => (
                          <div key={index} className="bg-white dark:bg-gray-800 p-3 rounded border border-red-100 dark:border-red-700">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium text-red-800 dark:text-red-200">{session.deviceName}</span>
                              <span className="text-xs text-red-600 dark:text-red-300 bg-red-100 dark:bg-red-800 px-2 py-1 rounded">
                                {session.deviceType === 'playstation' ? t('billing.gamingDevices.playstation') : t('billing.gamingDevices.computer')}
                              </span>
                            </div>
                            <div className="text-xs text-red-700 dark:text-red-300 mb-3">
                              <div>{t('billing.startTime')}: {formatTime(session.startTime)}</div>
                              {session.deviceType === 'playstation' && (
                                <div>{t('billing.controllers')}: {formatDecimal(session.controllers || 1, i18n.language)}</div>
                              )}
                            </div>
                            <div className="flex justify-end">
                              <button onClick={() => handleEndSession(session._id || session.id)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors duration-200">
                                {t('billing.endSession')}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Item Details */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-5 rounded-xl mb-6 border-2 border-purple-200 dark:border-purple-800 shadow-md">
                    <h5 className="font-bold text-lg text-purple-900 dark:text-purple-100 mb-4 flex items-center gap-2">
                      <Receipt className="h-5 w-5" />{t('billing.itemDetails')}
                    </h5>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                      {aggregateItemsWithPayments(selectedBill?.orders || [], selectedBill?.itemPayments || [], selectedBill?.status, selectedBill?.paid, selectedBill?.total).map((item, index) => (
                        <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-xl border-2 border-purple-200 dark:border-purple-700 shadow-sm hover:shadow-md transition-all">
                          <div className="flex justify-between items-start mb-3">
                            <span className="font-bold text-gray-900 dark:text-gray-100">{item.name}</span>
                            <span className="text-sm font-semibold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-2 py-1 rounded-lg">{formatCurrency(item.price)}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div className="text-center p-3 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-lg shadow-sm">
                              <div className="text-gray-600 dark:text-gray-400 font-semibold mb-1">{t('billing.totalQuantity')}</div>
                              <div className="font-bold text-lg text-gray-900 dark:text-gray-100">{formatDecimal(item.totalQuantity, i18n.language)}</div>
                            </div>
                            <div className="text-center p-3 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 rounded-lg shadow-sm">
                              <div className="text-green-700 dark:text-green-300 font-semibold mb-1">{t('billing.paidQuantity')}</div>
                              <div className="font-bold text-lg text-green-800 dark:text-green-200">{formatDecimal(item.paidQuantity, i18n.language)}</div>
                            </div>
                            <div className="text-center p-3 bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/50 dark:to-red-900/50 rounded-lg shadow-sm">
                              <div className="text-orange-700 dark:text-orange-300 font-semibold mb-1">{t('billing.remainingQuantity')}</div>
                              <div className="font-bold text-lg text-orange-800 dark:text-orange-200">{formatDecimal(item.remainingQuantity, i18n.language)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Previous Item Payments */}
                  {selectedBill?.itemPayments && selectedBill.itemPayments.length > 0 && (() => {
                    const allPayments: any[] = [];
                    selectedBill.itemPayments.forEach((ip: any) => {
                      ip.paymentHistory?.forEach((p: any, idx: number) => {
                        allPayments.push({ itemPayment: ip, payment: p, paymentIdx: idx });
                      });
                    });
                    if (!allPayments.length) return null;
                    return (
                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-5 rounded-xl mb-6 border-2 border-blue-200 dark:border-blue-800 shadow-md">
                        <h5 className="font-bold text-lg text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                          <Receipt className="h-5 w-5" />{t('billing.previousItemPayments')}
                        </h5>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                          {allPayments.map(({ itemPayment, payment, paymentIdx }, idx) => (
                            <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-blue-200 dark:border-blue-700 shadow-sm">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{itemPayment.itemName || t('billing.unknownItem')}</p>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">{t('billing.quantity')}: {formatDecimal(payment.quantity, i18n.language)} × {formatCurrency(itemPayment.pricePerUnit)}</p>
                                </div>
                                <p className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(payment.amount)}</p>
                              </div>
                              <div className="flex justify-between items-center text-xs pt-2 border-t border-gray-200 dark:border-gray-600">
                                <span className="text-gray-500">{payment.method ? t(`billing.paymentMethod${payment.method.charAt(0).toUpperCase() + payment.method.slice(1)}`) : t('billing.paymentMethodCash')}</span>
                                {canEditPartialPayment(user) && (
                                  <button onClick={() => handleEditItemPayment({ itemPayment, payment, paymentIdx }, idx)}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium">{t('common.edit')}</button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Payment Options */}
                  {selectedBill?.status !== 'paid' && (
                    <>
                      <div className="mb-6">
                        <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-3">{t('billing.paymentOptions')}</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <button
                            onClick={() => {
                              if (!canPayFullBill(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
                              if (selectedBill?.remaining) {
                                setPaymentAmount(selectedBill.remaining.toString());
                                setOriginalAmount(selectedBill.remaining.toString());
                                setDiscountPercentage(''); setPaymentMethod('cash'); setPaymentReference('');
                              }
                            }}
                            disabled={hasActiveSession(selectedBill)}
                            className={`p-4 border-2 rounded-lg text-center transition-colors duration-200 cursor-pointer ${hasActiveSession(selectedBill) ? 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-gray-400 cursor-not-allowed' : 'border-orange-200 dark:border-orange-600 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}>
                            <div className="text-2xl mb-2">💰</div>
                            <div className="font-medium dark:text-gray-100">{t('billing.payFullBillOption')}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">{selectedBill?.remaining ? t('billing.payFullBillOptionDesc', { amount: formatCurrency(selectedBill.remaining) }) : t('billing.payFullBillOptionDescAlt')}</div>
                            {hasActiveSession(selectedBill) && <div className="text-xs text-red-500 mt-1">{t('billing.unavailableActiveSession')}</div>}
                          </button>
                          <button onClick={async () => { if (selectedBill) await handlePartialPayment(selectedBill); }}
                            className="p-4 border-2 rounded-lg text-center transition-colors border-gray-200 dark:border-gray-600 hover:border-gray-300">
                            <div className="text-2xl mb-2">🍹</div>
                            <div className="font-medium dark:text-gray-100">{t('billing.paySpecificItem')}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">{t('billing.paySpecificItemDesc')}</div>
                          </button>
                          {selectedBill?.sessions && selectedBill.sessions.length > 0 && (
                            <button onClick={() => setShowSessionPaymentModal(true)}
                              className="p-4 border-2 rounded-lg text-center transition-colors border-gray-200 dark:border-gray-600 hover:border-gray-300">
                              <div className="text-2xl mb-2">🎮</div>
                              <div className="font-medium dark:text-gray-100">{t('billing.partialPaymentForSessions')}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-300">{t('billing.partialPaymentForSessionsDesc')}</div>
                            </button>
                          )}
                        </div>
                      </div>
                      {paymentAmount && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('billing.paymentAmount')}</label>
                            <input type="text" value={formatCurrency(parseFloat(paymentAmount))} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100" disabled />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('billing.discountPercentageLabel')}</label>
                            <input type="number" value={discountPercentage} onChange={e => {
                              const v = e.target.value;
                              if (v === '' || (parseFloat(v) >= 0 && parseFloat(v) <= 100)) {
                                setDiscountPercentage(v);
                                if (v && !isNaN(parseFloat(v)) && selectedBill?.remaining) {
                                  setPaymentAmount((selectedBill.remaining * (1 - parseFloat(v) / 100)).toFixed(2));
                                } else if (selectedBill?.remaining) setPaymentAmount(selectedBill.remaining.toString());
                              }
                            }} min="0" max="100" step="0.01" placeholder="0"
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('billing.paymentMethodLabel', 'طريقة الدفع')}</label>
                            <div className="grid grid-cols-3 gap-3">
                              {(['cash', 'card', 'transfer'] as const).map(m => (
                                <button key={m} onClick={() => setPaymentMethod(m)}
                                  className={`p-3 border-2 rounded-xl text-center transition-all ${paymentMethod === m ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-lg scale-105' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}>
                                  <div className="text-2xl mb-1">{m === 'cash' ? '💵' : m === 'card' ? '💳' : '📱'}</div>
                                  <div className="text-xs font-semibold">{t(`billing.paymentMethod${m.charAt(0).toUpperCase() + m.slice(1)}`)}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Payment status indicator */}
                          {(() => {
                            let effectiveTotal = selectedBill.total || 0;
                            if (discountPercentage && parseFloat(discountPercentage) > 0) {
                              effectiveTotal -= (selectedBill.subtotal || selectedBill.total || 0) * (parseFloat(discountPercentage) / 100);
                            }
                            const newPaid = (selectedBill.paid || 0) + parseFloat(paymentAmount);
                            const remaining = Math.max(0, effectiveTotal - newPaid);
                            const willBePaid = remaining === 0 || newPaid >= effectiveTotal;
                            return (
                              <div className={`p-3 rounded-lg border ${willBePaid ? 'bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700' : 'bg-yellow-50 dark:bg-yellow-900 border-yellow-200 dark:border-yellow-700'}`}>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{willBePaid ? '✅' : '💰'}</span>
                                  <div>
                                    <p className={`font-medium ${willBePaid ? 'text-green-800 dark:text-green-200' : 'text-yellow-800 dark:text-yellow-200'}`}>
                                      {willBePaid ? t('billing.billPaidInFull') : t('billing.billPartiallyPaid')}
                                    </p>
                                    <p className={`text-sm ${willBePaid ? 'text-green-600 dark:text-green-300' : 'text-yellow-600 dark:text-yellow-300'}`}>
                                      {willBePaid ? t('billing.remainingWillBeZero') : t('billing.remainingWillBe', { amount: formatCurrency(remaining) })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  )}

                  {selectedBill?.status === 'paid' && (
                    <div className="bg-green-50 dark:bg-green-900 p-6 rounded-lg text-center">
                      <div className="text-6xl mb-4">✅</div>
                      <h5 className="font-medium text-green-900 dark:text-green-100 mb-2">{t('billing.billFullyPaidMessage')}</h5>
                      <p className="text-green-700 dark:text-green-300 mb-4">{t('billing.allAmountsPaid')}</p>
                    </div>
                  )}
                </div>

                {/* ── RIGHT: QR Code ── */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">{t('billing.qrCodeForCustomer')}</h4>
                  <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg text-center">
                    {selectedBill?.qrCode ? (
                      <img src={selectedBill.qrCode} alt="QR Code" className="mx-auto mb-4 w-48 h-48 border-4 border-white dark:border-gray-600 shadow-lg" />
                    ) : (
                      <div className="mx-auto mb-4 w-48 h-48 border-4 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
                        <QrCode className="h-16 w-16 text-gray-300 dark:text-gray-600" />
                      </div>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{t('billing.scanQRInstruction')}</p>
                    <div className="flex justify-center gap-2">
                      <button onClick={() => selectedBill && printBill(selectedBill, user?.organizationName, i18n.language, t).catch(console.error)}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1">
                        <Printer className="h-4 w-4" />{t('billing.printBill')}
                      </button>
                      <button onClick={() => {
                        const url = selectedBill?.qrCodeUrl || `${window.location.origin}/bill/${selectedBill?.id || selectedBill?._id}`;
                        navigator.clipboard.writeText(url); showNotification(t('billing.linkCopied'));
                      }} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
                        {t('billing.copy')}
                      </button>
                      <button onClick={() => {
                        const url = selectedBill?.qrCodeUrl || `${window.location.origin}/bill/${selectedBill?.id || selectedBill?._id}`;
                        window.open(url, '_blank');
                      }} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors">
                        {t('billing.open')}
                      </button>
                    </div>
                  </div>

                  {/* Bill Summary */}
                  <div className="mt-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-3">{t('billing.billSummary')}</h5>
                    <table className="w-full text-sm">
                      <tbody>
                        <tr>
                          <td className="py-2 px-3 text-center border border-gray-200 dark:border-gray-600">
                            <div className="text-gray-600 dark:text-gray-300 font-medium mb-1">{t('billing.ordersCount')}</div>
                            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatDecimal(selectedBill?.orders?.length || 0, i18n.language)}</div>
                          </td>
                          <td className="py-2 px-3 text-center border border-gray-200 dark:border-gray-600">
                            <div className="text-gray-600 dark:text-gray-300 font-medium mb-1">{t('billing.sessionsCount')}</div>
                            <div className="text-lg font-bold flex items-center justify-center gap-1 text-gray-900 dark:text-gray-100">
                              {formatDecimal(selectedBill?.sessions?.length || 0, i18n.language)}
                              {hasActiveSession(selectedBill) && (
                                <><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                <span className="text-xs text-red-600 dark:text-red-400 font-bold">{t('billing.active')}</span></>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center border border-gray-200 dark:border-gray-600">
                            <div className="text-gray-600 dark:text-gray-300 font-medium mb-1">{t('billing.creationDate')}</div>
                            <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                              {selectedBill?.createdAt ? formatDate(selectedBill.createdAt) : '-'}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h6 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{t('billing.customerLink')}</h6>
                      <div className="flex items-center gap-2">
                        <input type="text" value={selectedBill?.qrCodeUrl || `${window.location.origin}/bill/${selectedBill?.id || selectedBill?._id}`} readOnly
                          className="flex-1 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-gray-100" />
                        <button onClick={() => { const url = selectedBill?.qrCodeUrl || `${window.location.origin}/bill/${selectedBill?.id || selectedBill?._id}`; navigator.clipboard.writeText(url); showNotification(t('billing.linkCopied')); }}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors">{t('billing.copy')}</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-6 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between gap-3">
              {selectedBill?.status !== 'paid' && (
                <button onClick={() => { if (!canDeleteBill(user)) { showNotification(t('common.permissionDenied'), 'error'); return; } setShowCancelConfirmModal(true); }}
                  className="px-4 py-2 text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 rounded-lg transition-colors duration-200">
                  {t('billing.deleteBill')}
                </button>
              )}
              {selectedBill?.status === 'paid' && (
                <div className="flex items-center text-green-700 dark:text-green-300">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <span className="text-sm font-medium">{t('billing.billFullyPaid')}</span>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={handleClosePaymentModal} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200">{t('common.close')}</button>
                {selectedBill?.status !== 'paid' && paymentAmount && (
                  <button onClick={handlePaymentSubmit} disabled={hasActiveSession(selectedBill) || isProcessingPayment}
                    className={`px-4 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 min-w-[180px] ${hasActiveSession(selectedBill) || isProcessingPayment ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700 text-white'}`}>
                    {isProcessingPayment ? (
                      <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>{t('billing.processingPayment')}</>
                    ) : t('billing.payFullBillButton')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Partial Payment Modal ── */}
      <PartialPaymentModal
        key={`partial-${selectedBill?._id || selectedBill?.id}-${selectedBill?.itemPayments?.length || 0}-${selectedBill?.paid || 0}`}
        isOpen={showPartialPaymentModal} onClose={() => setShowPartialPaymentModal(false)}
        bill={selectedBill} onPaymentSubmit={handlePartialPaymentSubmit} isProcessing={isProcessingPartialPayment} />

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto p-3 sm:p-6 mx-2 sm:mx-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">{t('billing.confirmModals.endSessionTitle')}</h3>
            {!selectedBill?.table && (
              <div className="mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('billing.confirmModals.endSessionCustomerName')} <span className="text-red-500">*</span></label>
                <input type="text" value={customerNameForEndSession} onChange={e => setCustomerNameForEndSession(e.target.value)}
                  placeholder={t('billing.confirmModals.endSessionCustomerNamePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-gray-100" disabled={isEndingSession} />
              </div>
            )}
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-4">{t('billing.confirmModals.endSessionMessage')}</p>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <button onClick={() => { if (!isEndingSession) { setShowSessionEndModal(false); setSessionToEnd(null); } }} disabled={isEndingSession}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm sm:text-base">
                {t('billing.confirmModals.endSessionCancel')}
              </button>
              <button onClick={confirmSessionEnd} disabled={isEndingSession}
                className={`px-4 py-2 ${isEndingSession ? 'bg-red-700 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'} text-white rounded-lg transition-colors flex items-center justify-center gap-2 min-w-[100px] text-sm sm:text-base`}>
                {isEndingSession ? <><svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>{t('billing.confirmModals.endSessionProcessing')}</> : t('billing.confirmModals.endSessionConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Session Payment Modal ── */}
      {showSessionPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto mx-2 sm:mx-0">
            <div className="p-3 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">{t('billing.sessionPaymentModal.title')}</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">{t('billing.sessionPaymentModal.subtitle')}</p>
              </div>
            </div>
            <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
              {selectedBill.sessions?.map((session: any) => {
                const sid = session._id || session.id;
                const sp = selectedBill.sessionPayments?.find(p => p.sessionId === sid);
                const isActive = session.status === 'active';
                const totalCost = sp?.sessionCost || session.finalCost || session.totalCost || 0;
                const paidAmt = sp?.paidAmount || 0;
                const remainingAmt = isActive ? totalCost - paidAmt : (sp?.remainingAmount !== undefined ? sp.remainingAmount : totalCost - paidAmt);
                const isFullyPaid = !isActive && remainingAmt <= 0;
                return (
                  <div key={sid} className={`border-2 rounded-xl p-3 sm:p-4 ${isFullyPaid ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20' : isActive ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20' : 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20'}`}>
                    <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isFullyPaid ? 'bg-gradient-to-br from-green-500 to-emerald-500' : isActive ? 'bg-gradient-to-br from-blue-500 to-cyan-500 animate-pulse' : 'bg-gradient-to-br from-orange-500 to-red-500'}`}>
                          <span className="text-lg">{session.deviceType === 'playstation' ? '🎮' : '💻'}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100">{session.deviceName}</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{session.deviceType === 'playstation' ? t('billing.gamingDevices.playstation') : t('billing.gamingDevices.computer')}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        {isFullyPaid && <span className="px-2 sm:px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">✓ {t('billing.sessionPaymentModal.fullyPaid')}</span>}
                        {isActive && <span className="px-2 sm:px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-full animate-pulse">⚡ {t('billing.sessionPaymentModal.activeSession')}</span>}
                        {session.status === 'completed' && !isFullyPaid && canEditSessionTime(user) && (
                          <button onClick={() => handleEditSessionTime(session)} className="px-2 sm:px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold rounded-lg flex items-center gap-1">
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
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">{t('billing.sessionPaymentModal.previousPayments')}:</p>
                        <div className="space-y-1">
                          {sp.payments.map((payment: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-xs bg-white dark:bg-gray-700 p-2 rounded gap-2">
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
      )}

      {/* ── Change Table Modal ── */}
      {showChangeTableModal && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-3 sm:p-6 mx-2 sm:mx-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">{t('billing.changeTableTitle')}</h3>
            <div className="mb-4">
              {newTableNumber && (() => { const st = tables.find((t: any) => t._id === newTableNumber); return st ? (<div className="mb-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/40 border border-blue-300 rounded-lg flex items-center justify-between"><span className="text-sm font-semibold text-blue-800 dark:text-blue-200">{t('billing.tableWithNumber', { number: getTableDisplay(st.number, i18n.language) })} ✓</span><button onClick={() => { setNewTableNumber(null); setTableChangeSearch(''); }} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold">{t('common.cancel')}</button></div>) : null; })()}
              <div className="relative">
                <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
                <input type="text" value={tableChangeSearch} onChange={e => setTableChangeSearch(e.target.value)} placeholder={t('billing.searchTable') || 'بحث...'}
                  className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 text-sm ${isRTL ? 'pr-10' : 'pl-10'}`} disabled={isChangingTable} />
              </div>
              <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                {tables.filter((t: any) => t.isActive && t._id !== (selectedBill.table as any)?._id)
                  .filter((t: any) => !tableChangeSearch || String(t.number).toLowerCase().includes(tableChangeSearch.toLowerCase()))
                  .sort((a: any, b: any) => String(a.number).localeCompare(String(b.number), 'ar', { numeric: true }))
                  .map((table: any) => (
                    <button key={table._id} onClick={() => { setNewTableNumber(table._id); setTableChangeSearch(''); }} disabled={isChangingTable}
                      className={`w-full text-right px-3 py-2 text-sm transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/30 border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${newTableNumber === table._id ? 'bg-blue-100 dark:bg-blue-900/50 font-semibold text-blue-800 dark:text-blue-200' : 'text-gray-700 dark:text-gray-300'}`}>
                      {t('billing.tableWithNumber', { number: getTableDisplay(table.number, i18n.language) })}
                    </button>
                  ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <button onClick={() => { setShowChangeTableModal(false); setNewTableNumber(null); setTableChangeSearch(''); }} disabled={isChangingTable}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-colors text-sm sm:text-base">
                {t('common.cancel')}
              </button>
              <button onClick={handleChangeTable} disabled={isChangingTable || !newTableNumber}
                className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all text-white text-sm sm:text-base ${isChangingTable || !newTableNumber ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isChangingTable ? <><svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>{t('billing.changing')}</> : t('billing.confirmChange')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Session Time Modal ── */}
      {showEditSessionTimeModal && sessionToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Calendar className="h-6 w-6 text-purple-600" />{t('billing.editSessionTime')}</h3>
              <button onClick={() => { setShowEditSessionTimeModal(false); setSessionToEdit(null); }} className="text-gray-500 hover:text-gray-700 dark:text-gray-400" disabled={isEditingSessionTime}><X className="h-6 w-6" /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg"><p className="text-sm font-medium text-gray-700 dark:text-gray-300">{sessionToEdit.deviceName}</p></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('billing.startTime')}</label>
                <input type="datetime-local" value={editSessionStartTime} onChange={e => setEditSessionStartTime(e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-gray-100" disabled={isEditingSessionTime} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('billing.endTime')}</label>
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
      )}

      {/* ── Edit Controllers Period Modal ── */}
      {showEditControllersPeriodModal && sessionToEdit && periodToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Gamepad2 className="h-6 w-6 text-purple-600" />{t('billing.editPeriodTime')}</h3>
              <button onClick={() => { setShowEditControllersPeriodModal(false); setSessionToEdit(null); setPeriodToEdit(null); setPeriodIndex(-1); }} className="text-gray-500 hover:text-gray-700" disabled={isEditingPeriod}><X className="h-6 w-6" /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{sessionToEdit.deviceName}</p>
                <div className="flex items-center gap-2 text-xs"><span className="font-bold text-purple-700 dark:text-purple-300">{formatDecimal(periodToEdit.controllers, i18n.language)} {t('billing.controllers')}</span></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('billing.startTime')}</label>
                <input type="datetime-local" value={editPeriodStartTime} onChange={e => setEditPeriodStartTime(e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-gray-100" disabled={isEditingPeriod} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('billing.endTime')}</label>
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
      )}

      {/* ── Edit Session Payment Modal ── */}
      {showEditPaymentModal && paymentToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full my-8">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 rounded-t-xl flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><DollarSign className="h-6 w-6" />{t('billing.editPayment.title')}</h3>
              <button onClick={() => { setShowEditPaymentModal(false); setPaymentToEdit(null); }} disabled={isEditingPayment} className="text-white hover:text-gray-200"><X className="h-6 w-6" /></button>
            </div>
            <div className="p-6 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-700">
                <p className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">{paymentToEdit.session.deviceName}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{paymentToEdit.session.deviceType === 'playstation' ? t('billing.gamingDevices.playstation') : t('billing.gamingDevices.computer')}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('billing.editPayment.newAmount')}</label>
                <input type="number" value={editPaymentAmount} onChange={e => setEditPaymentAmount(e.target.value)} placeholder={t('billing.editPayment.amountPlaceholder')}
                  className="w-full px-4 py-3 text-lg font-semibold border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100" disabled={isEditingPayment} min="0" step="0.01" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('billing.editPayment.newMethod')}</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['cash', 'card', 'transfer'] as const).map(m => (
                    <button key={m} onClick={() => setEditPaymentMethod(m)} disabled={isEditingPayment}
                      className={`p-4 border-2 rounded-xl text-center transition-all ${editPaymentMethod === m ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-lg scale-105' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}>
                      <div className="text-3xl mb-2">{m === 'cash' ? '💵' : m === 'card' ? '💳' : '📱'}</div>
                      <div className="text-xs font-semibold">{t(`billing.paymentMethod${m.charAt(0).toUpperCase() + m.slice(1)}`)}</div>
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
      )}

      {/* ── Edit Item Payment Modal ── */}
      {showEditItemPaymentModal && itemPaymentToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full my-8">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 rounded-t-xl flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><Receipt className="h-6 w-6" />{t('billing.editPayment.title')}</h3>
              <button onClick={() => { setShowEditItemPaymentModal(false); setItemPaymentToEdit(null); }} disabled={isEditingItemPayment} className="text-white hover:text-gray-200"><X className="h-6 w-6" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-xl border-2 border-green-200 dark:border-green-700">
                <p className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2">{itemPaymentToEdit.itemPayment.itemName || t('billing.unknownItem')}</p>
                <div className="text-xs text-gray-600 dark:text-gray-400">{t('billing.pricePerUnit')}: {formatCurrency(itemPaymentToEdit.itemPayment.pricePerUnit)}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('billing.editPayment.newQuantity')}</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => { const q = parseInt(editItemPaymentAmount) || 0; if (q > 0) setEditItemPaymentAmount((q - 1).toString()); }} disabled={isEditingItemPayment || parseInt(editItemPaymentAmount) <= 0}
                    className="w-12 h-12 flex items-center justify-center bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-bold text-xl rounded-lg transition-colors">−</button>
                  <input type="number" value={editItemPaymentAmount} onChange={e => { const v = e.target.value; if (v === '' || (parseInt(v) >= 0 && parseInt(v) <= itemPaymentToEdit.payment.quantity)) setEditItemPaymentAmount(v); }}
                    className="flex-1 px-4 py-3 text-center text-2xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-gray-100" disabled={isEditingItemPayment} min="0" max={itemPaymentToEdit.payment.quantity} step="1" />
                  <button onClick={() => { const q = parseInt(editItemPaymentAmount) || 0; if (q < itemPaymentToEdit.payment.quantity) setEditItemPaymentAmount((q + 1).toString()); }} disabled={isEditingItemPayment || parseInt(editItemPaymentAmount) >= itemPaymentToEdit.payment.quantity}
                    className="w-12 h-12 flex items-center justify-center bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-bold text-xl rounded-lg transition-colors">+</button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">{t('billing.editPayment.maxQuantity')}: {formatDecimal(itemPaymentToEdit.payment.quantity, i18n.language)}</p>
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
          onClose={() => { setShowOrderModal(false); setCurrentOrderItems([]); setOrderNotes(''); }} loading={savingOrder} isEdit={false} />
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
          onClose={() => { setShowEditOrderModal(false); setSelectedOrder(null); setCurrentOrderItems([]); setOrderNotes(''); }} loading={savingOrder} isEdit={true} />
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
          onSave={async () => { if (!tableFormData.number || tableFormData.number.trim() === '') { showNotification(t('cafe.enterTableNumber'), 'error'); return; } if (!tableFormData.section) { showNotification(t('cafe.notifications.selectSection'), 'error'); return; } editingTable ? await updateTable(editingTable.id, { number: tableFormData.number, section: tableFormData.section }) : await createTable({ number: tableFormData.number, section: tableFormData.section }); setShowTableModal(false); setEditingTable(null); setTableFormData({ number: '', section: '' }); }}
          onClose={() => { setShowTableModal(false); setEditingTable(null); setTableFormData({ number: '', section: '' }); }} />
      )}

      {/* ── Confirm Modal ── */}
      {showConfirmModal && confirmModalData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="relative p-4 sm:p-5 bg-gradient-to-br from-yellow-500 to-orange-600">
              <div className="relative flex items-center justify-between z-10">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-xl border border-white/30 flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white drop-shadow-lg truncate">{confirmModalData.title}</h3>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-5 bg-gray-50 dark:bg-gray-900">
              <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">{confirmModalData.message}</p>
            </div>
            <div className="p-4 sm:p-5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col sm:flex-row justify-end gap-3">
              <button onClick={() => { setShowConfirmModal(false); setConfirmModalData(null); setConfirmLoading(false); }} disabled={confirmLoading}
                className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl transition-colors text-sm sm:text-base font-medium disabled:opacity-50">
                {confirmModalData.cancelText || t('common.cancel')}
              </button>
              <button onClick={() => confirmModalData.onConfirm()} disabled={confirmLoading}
                className={`w-full sm:w-auto px-4 py-2.5 text-white rounded-xl transition-colors text-sm sm:text-base font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${confirmModalData.confirmColor || 'bg-red-600 hover:bg-red-700'}`}>
                {confirmLoading ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>{t('common.loading')}</span></> : (confirmModalData.confirmText || t('common.confirm'))}
              </button>
            </div>
          </div>
        </div>
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

    </div>
  );
};

export default Tables;

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
    if (!search.trim()) return menuItems.filter(m => m.isAvailable).slice(0, 30);
    const q = search.toLowerCase();
    return menuItems.filter(m => m.isAvailable && m.name.toLowerCase().includes(q)).slice(0, 30);
  }, [menuItems, search]);

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const addItem = (mi: MenuItem) => {
    setItems(prev => {
      const ex = prev.find(i => i.menuItem === mi.id);
      if (ex) return prev.map(i => i.menuItem === mi.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { menuItem: mi.id, name: mi.name, price: mi.price, quantity: 1 }];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setItems(prev => prev.map(i => {
      if (i.menuItem !== id) return i;
      const q = i.quantity + delta;
      return q <= 0 ? null as any : { ...i, quantity: q };
    }).filter(Boolean));
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-3" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="p-4 bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/30">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">إضافة سريعة</h3>
              <p className="text-xs text-orange-100">طاولة {getTableDisplay(table.number, i18n.language)}</p>
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
              className={`w-full ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-orange-400`} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0 grid grid-cols-1 gap-2">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-8">لا توجد أصناف</p>
          ) : filtered.map(mi => {
            const inOrder = items.find(i => i.menuItem === mi.id);
            return (
              <div key={mi.id} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${inOrder ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-700' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{mi.name}</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold">{formatCurrencyUtil(mi.price, i18n.language, cur)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {inOrder ? (
                    <>
                      <button onClick={() => changeQty(mi.id, -1)} className="w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center font-bold text-sm transition-colors">−</button>
                      <span className="w-6 text-center font-bold text-gray-900 dark:text-gray-100 text-sm">{inOrder.quantity}</span>
                      <button onClick={() => changeQty(mi.id, 1)} className="w-7 h-7 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center justify-center font-bold text-sm transition-colors">+</button>
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
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{items.length} أصناف</span>
              <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{formatCurrencyUtil(total, i18n.language, cur)}</span>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors">إلغاء</button>
            <button onClick={onSave} disabled={saving || items.length === 0}
              className="flex-1 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
              {saving ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <CheckCircle className="h-4 w-4" />}
              {saving ? 'جاري الحفظ...' : 'إرسال الطلب'}
            </button>
          </div>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-3" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="p-4 bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/30">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">التقرير اليومي</h3>
              <p className="text-xs text-green-100">{today.toLocaleDateString('ar-EG', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
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
                <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
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
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Bills Table */}
          {todayBills.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-emerald-500 text-white">
                  <tr>
                    {['#', 'رقم الفاتورة', 'الطاولة', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة'].map(h => (
                      <th key={h} className="px-3 py-2 text-right font-semibold text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todayBills.map((b, i) => (
                    <tr key={b.id || b._id} className={i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'}>
                      <td className="px-3 py-2 text-xs text-gray-500">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 text-xs">#{b.billNumber || (b.id || b._id)?.slice(-6)}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{b.table ? `طاولة ${(b.table as any).number || ''}` : '—'}</td>
                      <td className="px-3 py-2 font-semibold text-xs text-gray-900 dark:text-gray-100">{formatCurrency(b.total || 0)}</td>
                      <td className="px-3 py-2 text-xs text-green-600 dark:text-green-400 font-semibold">{formatCurrency(b.paid || 0)}</td>
                      <td className="px-3 py-2 text-xs text-red-600 dark:text-red-400 font-semibold">{formatCurrency(b.remaining || 0)}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
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
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors">إغلاق</button>
          <button onClick={onPrint} disabled={isPrinting}
            className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {isPrinting ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <Printer className="h-4 w-4" />}
            {isPrinting ? 'جاري الطباعة...' : 'طباعة التقرير'}
          </button>
        </div>
      </div>
    </div>
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
  addItemToOrder: (item: MenuItem) => void;
  updateItemQuantity: (id: string, delta: number) => void;
  updateItemNotes: (id: string, notes: string) => void;
  removeItemFromOrder: (id: string) => void;
  calculateTotal: () => number;
  onSave: () => void; onSaveAndPrint: () => void; onSaveAndSend: () => void; onClose: () => void;
  loading: boolean; isEdit: boolean;
}

const OrderModal: React.FC<OrderModalProps> = ({
  table, orderItems, orderNotes, setOrderNotes, menuSections, menuCategories, menuItems,
  expandedSections, expandedCategories, toggleSection, toggleCategory, getCategoriesForSection,
  getItemsForCategory, addItemToOrder, updateItemQuantity, updateItemNotes, removeItemFromOrder,
  calculateTotal, onSave, onSaveAndPrint, onSaveAndSend, onClose, loading, isEdit,
}) => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── scroll + flash on item add ───────────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefsMap = useRef<Record<string, HTMLDivElement | null>>({});
  const [flashId, setFlashId] = useState<string | null>(null);

  // عند تغيير عدد العناصر (إضافة) — نسكرول للعنصر الجديد ونوميضه
  const prevLengthRef = useRef(orderItems.length);
  useEffect(() => {
    if (orderItems.length > prevLengthRef.current) {
      // عنصر جديد أُضيف — آخر عنصر هو المضاف
      const lastItem = orderItems[orderItems.length - 1];
      if (lastItem) {
        setFlashId(lastItem.menuItem);
        setTimeout(() => setFlashId(null), 900);
        setTimeout(() => {
          const el = itemRefsMap.current[lastItem.menuItem];
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50);
      }
    } else if (orderItems.length === prevLengthRef.current) {
      // نفس العدد — زيادة كمية عنصر موجود، نوميضه
      // نحتاج نعرف أي عنصر تغيرت كميته — نستخدم آخر عنصر يُضغط عليه
      // (بيتحدد من الخارج عبر lastTouchedId)
    }
    prevLengthRef.current = orderItems.length;
  }, [orderItems.length]);

  // وميض عند زيادة الكمية لعنصر موجود
  const handleAddWithFlash = (menuItem: MenuItem) => {
    addItemToOrder(menuItem);
    // ابحث عن العنصر الموجود
    const existing = orderItems.find(i => i.menuItem === menuItem.id);
    if (existing) {
      setFlashId(menuItem.id);
      setTimeout(() => setFlashId(null), 900);
      setTimeout(() => {
        const el = itemRefsMap.current[menuItem.id];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
    // لو عنصر جديد، الـ useEffect أعلاه بيتكفل به
  };

  useEffect(() => {
    setSearchQuery('');
    const focus = () => searchInputRef.current?.focus();
    focus();
    const t1 = setTimeout(focus, 50);
    const t2 = setTimeout(focus, 150);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const filteredMenuItems = useMemo(() => {
    if (!searchQuery.trim()) return menuItems;
    const q = searchQuery.toLowerCase();
    return menuItems.filter(i => i.name.toLowerCase().includes(q));
  }, [menuItems, searchQuery]);

  const getFilteredItems = (categoryId: string) => {
    const items = getItemsForCategory(categoryId);
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(q));
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-40 p-3 sm:p-4 md:p-6" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-7xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="relative p-4 sm:p-6 bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 flex-shrink-0">
          <div className="relative flex items-center justify-between z-10">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-xl border border-white/30">
                <ShoppingCart className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-lg">{isEdit ? t('cafe.orderModal.editOrderTitle') : t('cafe.orderModal.newOrderTitle')}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                    <p className="text-xs sm:text-sm text-white font-medium">{t('cafe.orderModal.table', { number: getTableDisplay(table.number, i18n.language) })}</p>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 sm:p-2.5 hover:bg-white/20 backdrop-blur-sm rounded-xl transition-all border border-white/30 hover:scale-110">
              <X className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </button>
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 overflow-hidden min-h-0">
          {/* Left: Menu */}
          <div className="flex flex-col space-y-4 h-full min-h-0">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-red-500 rounded-full"></div>{t('cafe.orderModal.menu')}
            </h3>
            <div className="relative flex-shrink-0">
              <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none`} />
              <input ref={searchInputRef} type="text" placeholder={t('cafe.orderModal.searchPlaceholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus
                className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500`} />
              {searchQuery && <button onClick={() => setSearchQuery('')} className={`absolute ${isRTL ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600`}><X className="h-4 w-4" /></button>}
            </div>
            <div className={`flex-1 space-y-3 ${isRTL ? 'pr-2' : 'pl-2'} menu-scroll-container`} style={{ overflowY: 'scroll' }}>
              {searchQuery.trim() ? (
                <div className="space-y-2">
                  {filteredMenuItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">{t('cafe.orderModal.noResults')}</div>
                  ) : filteredMenuItems.map(item => (
                    <button key={item.id} onClick={() => handleAddWithFlash(item)}
                      className="w-full flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                      <span className="text-gray-700 dark:text-gray-300 font-medium">{item.name}</span>
                      <span className="font-semibold text-orange-600 dark:text-orange-400">{formatCurrencyUtil(item.price, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}</span>
                    </button>
                  ))}
                </div>
              ) : (
                menuSections.filter(s => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map(section => {
                  const cats = getCategoriesForSection(section.id);
                  if (cats.length === 0) return null;
                  return (
                    <div key={section.id} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                      <button onClick={() => toggleSection(section.id)} className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{section.name}</span>
                        {expandedSections[section.id] ? <MinusCircle className="h-5 w-5 text-gray-500" /> : <PlusCircle className="h-5 w-5 text-gray-500" />}
                      </button>
                      {expandedSections[section.id] && (
                        <div className="p-3 space-y-2">
                          {cats.map(cat => {
                            const items = getFilteredItems(cat.id);
                            if (items.length === 0) return null;
                            return (
                              <div key={cat.id}>
                                <button onClick={() => toggleCategory(cat.id)} className="w-full flex items-center justify-between p-2 text-sm bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded">
                                  <span className="font-medium text-gray-800 dark:text-gray-200">{cat.name}</span>
                                  {expandedCategories[cat.id] ? <MinusCircle className="h-4 w-4 text-gray-500" /> : <PlusCircle className="h-4 w-4 text-gray-500" />}
                                </button>
                                {expandedCategories[cat.id] && (
                                  <div className="mt-2 space-y-1 pr-4">
                                    {items.map(item => (
                                      <button key={item.id} onClick={() => handleAddWithFlash(item)} className="w-full flex items-center justify-between p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors">
                                        <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                                        <span className="font-semibold text-orange-600 dark:text-orange-400">{formatCurrencyUtil(item.price, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          {/* Right: Order items */}
          <div className="flex flex-col space-y-4 h-full min-h-0">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-shrink-0">
              <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-emerald-500 rounded-full"></div>{t('cafe.orderModal.orders')}
              {orderItems.length > 0 && <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-bold rounded-full">{formatDecimal(orderItems.length, i18n.language)}</span>}
            </h3>
            <div ref={scrollContainerRef} className={`flex-1 space-y-3 ${isRTL ? 'pr-2' : 'pl-2'} order-scroll-container`} style={{ overflowY: 'scroll' }}>
              {orderItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">{t('cafe.orderModal.noItems')}</div>
              ) : orderItems.map(item => (
                <div
                  key={item.menuItem}
                  ref={el => { itemRefsMap.current[item.menuItem] = el; }}
                  className={`border rounded-lg p-3 transition-all duration-300 ${
                    flashId === item.menuItem
                      ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/30 shadow-lg shadow-orange-200 dark:shadow-orange-900/40 scale-[1.02]'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{item.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{formatCurrencyUtil(item.price, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')} × {formatDecimal(item.quantity, i18n.language)} = {formatCurrencyUtil(item.price * item.quantity, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}</div>
                    </div>
                    <button onClick={() => removeItemFromOrder(item.menuItem)} className="text-red-600 hover:text-red-700 p-1"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse mb-2">
                    <button onClick={() => updateItemQuantity(item.menuItem, -1)} className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg p-2 shadow-md hover:shadow-lg transition-all hover:scale-105"><MinusCircle className="h-4 w-4" /></button>
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 border-2 border-blue-200 dark:border-gray-500 rounded-lg px-3 py-2 min-w-[3rem] shadow-sm">
                      <span className="font-bold text-lg text-blue-800 dark:text-white text-center block">{formatDecimal(item.quantity, i18n.language)}</span>
                    </div>
                    <button onClick={() => updateItemQuantity(item.menuItem, 1)} className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg p-2 shadow-md hover:shadow-lg transition-all hover:scale-105"><PlusCircle className="h-4 w-4" /></button>
                  </div>
                  <input type="text" value={item.notes || ''} onChange={e => updateItemNotes(item.menuItem, e.target.value)} placeholder={t('cafe.orderModal.itemNotesPlaceholder')}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                </div>
              ))}
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('cafe.orderModal.total')}</span>
                <span className="text-xl font-bold text-orange-600 dark:text-orange-400">{formatCurrencyUtil(calculateTotal(), i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}</span>
              </div>
              <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder={t('cafe.orderModal.orderNotesPlaceholder')} rows={3}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 space-x-reverse p-6 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">{t('cafe.orderModal.cancel')}</button>
          <button onClick={onSave} disabled={loading || orderItems.length === 0} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            <CheckCircle className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />{loading ? t('cafe.orderModal.saving') : t('cafe.orderModal.save')}
          </button>
          <button onClick={onSaveAndSend} disabled={loading || orderItems.length === 0} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            <ChefHat className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />{loading ? t('cafe.orderModal.saving') : t('cafe.orderModal.saveAndSend')}
          </button>
          <button onClick={onSaveAndPrint} disabled={loading || orderItems.length === 0} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            <Printer className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />{loading ? t('cafe.orderModal.saving') : t('cafe.orderModal.saveAndPrint')}
          </button>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-40 p-3 sm:p-4 md:p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl max-w-sm sm:max-w-2xl md:max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
        <div className="relative p-4 sm:p-5 md:p-6 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex-shrink-0">
          <div className="relative flex items-center justify-between z-10">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl border border-white/30 flex-shrink-0">
                <Settings className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white drop-shadow-lg truncate">{t('cafe.managementModal.title')}</h2>
                <p className="text-xs sm:text-sm text-white/80 mt-1">{t('cafe.managementModal.sectionsCount', { count: tableSections.length })} • {t('cafe.managementModal.tablesCount', { count: tables.length })}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 sm:p-2.5 hover:bg-white/20 backdrop-blur-sm rounded-xl border border-white/30 hover:scale-110 flex-shrink-0"><X className="h-5 w-5 sm:h-6 sm:w-6 text-white" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-6 bg-gray-50 dark:bg-gray-900">
          <div className="mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <div className="w-1 h-5 sm:h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>{t('cafe.managementModal.sections')}
              </h3>
              <button onClick={onAddSection} className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2.5 rounded-xl flex items-center justify-center text-sm font-bold shadow-lg hover:scale-105">
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
                          <h4 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{section.name}</h4>
                          <span className="w-fit px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-full">{t('cafe.managementModal.tableCount', { count: sectionTables.length })}</span>
                        </div>
                        {section.description && <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{section.description}</p>}
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
                          <span className="text-xs text-gray-400 italic">اسحب الطاولات هنا</span>
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
                              <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100">{getTableDisplay(table.number, i18n.language)}</span>
                              <div className="flex items-center gap-1">
                                <button onClick={e => { e.stopPropagation(); onEditTable(table); }} className="p-1 hover:bg-orange-200 dark:hover:bg-orange-800 rounded-lg transition-all"><Edit className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-orange-600 dark:text-orange-400" /></button>
                                <button onClick={e => { e.stopPropagation(); onDeleteTable(table.id); }} className="p-1 hover:bg-red-200 dark:hover:bg-red-800 rounded-lg transition-all"><Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-600 dark:text-red-400" /></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button onClick={() => onAddTable(section.id)} className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1 shadow-md hover:scale-105">
                        <Plus className="h-3 w-3 sm:h-4 sm:w-4" />{t('cafe.managementModal.addTable')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {draggedId && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-2 rounded-full shadow-xl text-sm font-medium z-50 flex items-center gap-2 pointer-events-none">
              <Layers className="h-4 w-4" />
              اسحب فوق طاولة أخرى لتبديل الترتيب
            </div>
          )}
        </div>
        <div className="flex items-center justify-end p-4 sm:p-5 md:p-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
          <button onClick={onClose} className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl transition-colors text-sm sm:text-base font-medium">{t('common.close')}</button>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-40 p-3 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm sm:max-w-md w-full border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="relative p-4 sm:p-5 bg-gradient-to-br from-blue-500 to-indigo-600">
          <div className="relative flex items-center justify-between z-10">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30 flex-shrink-0"><Settings className="h-5 w-5 sm:h-6 sm:w-6 text-white" /></div>
              <h2 className="text-lg sm:text-xl font-bold text-white drop-shadow-lg truncate">{editingSection ? t('cafe.sectionModal.editTitle') : t('cafe.sectionModal.addTitle')}</h2>
            </div>
            <button onClick={onClose} className="p-2 sm:p-2.5 hover:bg-white/20 backdrop-blur-sm rounded-xl border border-white/30 flex-shrink-0"><X className="h-5 w-5 sm:h-6 sm:w-6 text-white" /></button>
          </div>
        </div>
        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 bg-gray-50 dark:bg-gray-900">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('cafe.sectionModal.sectionNameRequired')}</label>
            <input ref={nameRef} type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} autoFocus
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
              placeholder={t('cafe.sectionModal.sectionNamePlaceholder')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('cafe.sectionModal.description')}</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder={t('cafe.sectionModal.descriptionPlaceholder')} rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('cafe.sectionModal.sortOrder')}</label>
            <input type="number" value={formData.sortOrder} onChange={e => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
              placeholder={t('cafe.sectionModal.sortOrderPlaceholder')} />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 p-4 sm:p-5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button onClick={onClose} className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm sm:text-base font-medium">{t('cafe.sectionModal.cancel')}</button>
          <button onClick={onSave} className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm sm:text-base font-medium">{t('cafe.sectionModal.save')}</button>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-40 p-3 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm sm:max-w-md w-full border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="relative p-4 sm:p-5 bg-gradient-to-br from-green-500 to-emerald-600">
          <div className="relative flex items-center justify-between z-10">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30 flex-shrink-0"><Plus className="h-5 w-5 sm:h-6 sm:w-6 text-white" /></div>
              <h2 className="text-lg sm:text-xl font-bold text-white drop-shadow-lg truncate">{editingTable ? t('cafe.tableModal.editTitle') : t('cafe.tableModal.addTitle')}</h2>
            </div>
            <button onClick={onClose} className="p-2 sm:p-2.5 hover:bg-white/20 backdrop-blur-sm rounded-xl border border-white/30 flex-shrink-0"><X className="h-5 w-5 sm:h-6 sm:w-6 text-white" /></button>
          </div>
        </div>
        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 bg-gray-50 dark:bg-gray-900">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('cafe.tableModal.tableNumberRequired')}</label>
            <input ref={numRef} type="text" value={formData.number} onChange={e => setFormData({ ...formData, number: e.target.value })} autoFocus
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base focus:ring-2 focus:ring-green-500"
              placeholder={t('cafe.tableModal.tableNumberPlaceholder')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('cafe.tableModal.sectionRequired')}</label>
            <select value={formData.section} onChange={e => setFormData({ ...formData, section: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base focus:ring-2 focus:ring-green-500">
              <option value="">{t('cafe.tableModal.selectSection')}</option>
              {tableSections.filter(s => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 p-4 sm:p-5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button onClick={onClose} className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm sm:text-base font-medium">{t('cafe.tableModal.cancel')}</button>
          <button onClick={onSave} className="w-full sm:w-auto px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm sm:text-base font-medium">{t('cafe.tableModal.save')}</button>
        </div>
      </div>
    </div>
  );
};
