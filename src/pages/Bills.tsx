import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigProvider, DatePicker } from 'antd';
import LocalizedTimePicker from '../components/common/LocalizedTimePicker';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import 'dayjs/locale/fr';
import arEG from 'antd/locale/ar_EG';
import enUS from 'antd/locale/en_US';
import frFR from 'antd/locale/fr_FR';
import { Receipt, Search, RefreshCw, Printer, Edit, Trash2, X, ChevronRight, ChevronLeft, CalendarDays, CheckCircle2, XCircle, DollarSign, ArrowLeftRight, MessageCircle, ChefHat, ListChecks, Download } from 'lucide-react';
import { canDeleteBill, canEditOrder, canPayFullBill, canPartialPayment, canEditPartialPayment, canExportReports, canViewBills, canEditBill, canEditDateFilters, getMaxDateRangeDays, isDateRangeAllowed, canMoveBillTableToTable, canMoveBillTakeawayToTable, canMoveBillDeliveryToTable } from '../utils/permissionHelper';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../utils/apiBase';
import ChangeTableModal from '../components/tables/ChangeTableModal';
import ItemPartialPayModal from '../components/tables/ItemPartialPayModal';
import OrderPrintSectionsModal from '../components/tables/OrderPrintSectionsModal';
import { startBillPrep, confirmBillPrep } from '../utils/orderSectionPrint';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import { formatCurrency as formatCurrencyUtil, replaceAMPM } from '../utils/formatters';
import { paymentMethodLabel, paymentMethodIcon } from '../utils/paymentMethod';
import { DrawerSelect } from '../components/ui/DrawerSelect';
import { defaultDrawerForFulfillment, drawerLabel, drawerIcon, type CashDrawer } from '../utils/paymentDrawer';
import BillItemsEditModal from '../components/tables/BillItemsEditModal';
import { printBill } from '../utils/printBill';

const getAntdLocale = (language: string) => {
  switch (language) {
    case 'ar': return arEG;
    case 'en': return enUS;
    case 'fr': return frFR;
    default: return arEG;
  }
};

type TypeFilter = 'all' | 'dine_in' | 'takeaway' | 'delivery';
type StatusFilter = 'all' | 'draft' | 'paid' | 'cancelled';

const PAGE_LIMIT = 25;

const Bills = () => {
  const { t, i18n } = useTranslation();
  const {
    user, showNotification,
    menuItems, menuSections, menuCategories,
    fetchMenuItems, fetchMenuSections, fetchMenuCategories,
    tables, fetchTables,
  } = useApp() as any;

  const fmt = useCallback((n: number) => {
    const cur = localStorage.getItem('organizationCurrency') || 'EGP';
    return formatCurrencyUtil(Number(n) || 0, i18n.language, cur);
  }, [i18n.language]);

  // ── Date + time range (same pattern as ConsumptionReport, workday 7AM) ──
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(() => {
    const now = dayjs();
    const start = now.hour() < 7
      ? now.subtract(1, 'day').hour(7).minute(0).second(0).millisecond(0)
      : now.hour(7).minute(0).second(0).millisecond(0);
    const end = start.add(1, 'day').subtract(1, 'millisecond');
    return [start, end];
  });
  const [timeRange, setTimeRange] = useState<[Dayjs, Dayjs]>([
    dayjs().set('hour', 7).set('minute', 0),
    dayjs().set('hour', 7).set('minute', 0),
  ]);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const [bills, setBills] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<any | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [billToEdit, setBillToEdit] = useState<any | null>(null);
  const [printing, setPrinting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'transfer' | 'e_wallet'>('cash');
  const [payDrawer, setPayDrawer] = useState<CashDrawer>('safe');
  const [payTarget, setPayTarget] = useState<{ bill: any; method: 'cash' | 'card' | 'transfer' | 'e_wallet'; drawer: CashDrawer } | null>(null);

  const isUnpaid = (b: any) => b && (Number(b.remaining) || 0) > 0 && b.status !== 'paid' && b.status !== 'cancelled';

  // الدرج والنوع الافتراضيان حسب نوع الفاتورة عند فتح تفاصيلها
  useEffect(() => {
    if (selected) {
      setPayDrawer(defaultDrawerForFulfillment((selected as any)?.fulfillmentType));
      setPayMethod('cash');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(selected as any)?._id || (selected as any)?.id]);

  const methodLabel = (m: string) => paymentMethodLabel(m, t);

  const handlePayFull = async (b: any, method: 'cash' | 'card' | 'transfer' | 'e_wallet' = 'cash', drawer: CashDrawer = 'safe'): Promise<boolean> => {
    const bid = String(b?._id || b?.id || '');
    const amount = Number(b?.remaining) || 0;
    if (!bid || amount <= 0 || payingId) return false;
    setPayingId(bid);
    try {
      const res: any = await (api as any).addPayment(bid, { amount, method, drawer });
      if (res?.success && res.data) {
        const updated = res.data;
        setBills((prev) => prev.map((x: any) => String(x._id || x.id) === bid ? updated : x));
        if (selected && String((selected as any)._id || (selected as any).id) === bid) setSelected(updated);
        refreshTotals();
        showNotification(t('bills.paidOk', 'تم تحصيل الفاتورة بالكامل'), 'success');
        return true;
      }
      showNotification(res?.message || t('bills.payError', 'فشل تحصيل الفاتورة'), 'error');
      return false;
    } catch (e: any) {
      showNotification(e?.message || t('bills.payError', 'فشل تحصيل الفاتورة'), 'error');
      return false;
    } finally {
      setPayingId(null);
    }
  };

  const confirmPay = async () => {
    if (!payTarget || payingId) return;
    const ok = await handlePayFull(payTarget.bill, payTarget.method, payTarget.drawer);
    if (ok) setPayTarget(null);
  };

  const handleDelete = (b: any) => {
    if (!b) return;
    if (!canDeleteBill(user)) { showNotification(t('common.permissionDenied', 'غير مصرح'), 'error'); return; }
    setDeleteTarget(b);
  };

  const confirmDelete = async () => {
    const bid = String(deleteTarget?._id || deleteTarget?.id || '');
    if (!bid) { setDeleteTarget(null); return; }
    setDeleting(true);
    try {
      const res: any = await (api as any).deleteBill(bid);
      if (res?.success) {
        setBills((prev) => prev.filter((x: any) => String(x._id || x.id) !== bid));
        setTotal((v) => Math.max(0, v - 1));
        if (selected && String((selected as any)._id || (selected as any).id) === bid) { setSelected(null); setShowDetail(false); }
        refreshTotals();
        showNotification(t('bills.deleted', 'تم حذف الفاتورة'), 'success');
        setDeleteTarget(null);
      } else {
        showNotification(res?.message || t('bills.deleteError', 'فشل حذف الفاتورة'), 'error');
      }
    } catch (e: any) {
      showNotification(e?.message || t('bills.deleteError', 'فشل حذف الفاتورة'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => { const h = setTimeout(() => setDebouncedSearch(search.trim()), 400); return () => clearTimeout(h); }, [search]);

  // Menu + tables data for the edit/move modals
  useEffect(() => {
    (async () => {
      try {
        if (!menuItems?.length) await fetchMenuItems?.();
        if (!menuSections?.length) await fetchMenuSections?.();
        if (!menuCategories?.length) await fetchMenuCategories?.();
        if (!tables?.length) await fetchTables?.();
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Card-like secondary actions (move / pay-items / whatsapp / prep)
  const [moveBill, setMoveBill] = useState<any | null>(null);
  const [payItemsBill, setPayItemsBill] = useState<any | null>(null);
  const [prepSelection, setPrepSelection] = useState<{ bill: any; orders: any[]; sections: { id: string; name: string }[]; menuItemsMap: Map<string, any> } | null>(null);
  const [prepSelected, setPrepSelected] = useState<string[]>([]);

  const prepCtx = () => ({
    menuItems: menuItems || [],
    menuSections: menuSections || [],
    user,
    organizationName: (user as any)?.organizationName || '',
    language: i18n.language,
    t,
  });

  const handlePrepPrint = async (bill: any) => {
    try {
      const r = await startBillPrep(bill, prepCtx());
      if (r.status === 'error') { showNotification(r.message, 'error'); return; }
      if (r.status === 'prompt') {
        setPrepSelected(r.sections.map((s) => s.id));
        setPrepSelection({ bill, orders: r.orders, sections: r.sections, menuItemsMap: r.menuItemsMap });
      }
    } catch { showNotification(t('bills.prepFailed', 'فشلت طباعة التحضير'), 'error'); }
  };

  const confirmPrepPrint = async () => {
    if (!prepSelection || prepSelected.length === 0) return;
    const sel = prepSelection;
    setPrepSelection(null);
    try {
      const r = await confirmBillPrep(sel.orders, prepSelected, sel.menuItemsMap, prepCtx());
      if (r.printed === 0) showNotification(t('bills.noSections', 'لا توجد أقسام مطابقة'), 'error');
      else showNotification(t('bills.prepSent', 'تم إرسال التحضير للطباعة'), 'success');
    } catch { showNotification(t('bills.prepFailed', 'فشلت طباعة التحضير'), 'error'); }
  };

  const handleMoveToTable = async (tableId: string) => {
    if (!moveBill) return;
    const id = String(moveBill._id || moveBill.id);
    try {
      const res: any = await (api as any).updateBill(id, { table: tableId, fulfillmentType: 'dine_in' });
      setMoveBill(null);
      if (res?.success && res.data) {
        const updated = res.data;
        setBills((prev: any[]) => prev.map((b: any) => String(b._id || b.id) === id ? updated : b));
        if (selected && String((selected as any)._id || (selected as any).id) === id) setSelected(updated);
        refreshTotals();
        showNotification(t('bills.moved', 'تم نقل الفاتورة'), 'success');
      }
      void fetchPage();
    } catch (e: any) {
      showNotification(e?.message || t('bills.moveFailed', 'فشل نقل الفاتورة'), 'error');
    }
  };

  const handleWhatsApp = (bill: any) => {
    const phone = String(bill?.customerPhone || bill?.deliveryInfo?.phone || '').replace(/[^0-9]/g, '');
    if (!phone) { showNotification(t('bills.noPhone', 'لا يوجد رقم هاتف'), 'warning'); return; }
    const lines = [
      `${t('bills.waBill', 'فاتورة')}: ${dispBillNo(bill?.billNumber) || ''}`,
      `${t('bills.cNet', 'الصافي')}: ${(Number(bill?.total) || 0).toFixed(2)}`,
      `${t('bills.cPaid', 'مدفوع')}: ${(Number(bill?.paid) || 0).toFixed(2)} — ${t('bills.cRem', 'متبقي')}: ${(Number(bill?.remaining) || 0).toFixed(2)}`,
    ];
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };

  const canEditDates = canEditDateFilters(user);
  const guardRange = (s: Dayjs, e: Dayjs): boolean => {
    if (!isDateRangeAllowed(s.toDate(), e.toDate(), user)) {
      const max = getMaxDateRangeDays(user) ?? 0;
      showNotification(t('common.dateRangeTooLong', 'أقصى مدى مسموح لك: {{days}} يوم', { days: max }), 'warning');
      return false;
    }
    return true;
  };

  const handleDateChange = (newDates: [Dayjs | null, Dayjs | null] | null, type: 'start' | 'end') => {
    if (!newDates || !canEditDates) return;
    if (type === 'start' && newDates[0]) {
      const s = newDates[0].set('hour', timeRange[0].hour()).set('minute', timeRange[0].minute()).set('second', 0);
      if (!guardRange(s, dateRange[1])) return;
      setDateRange([s, dateRange[1]]); setPage(1);
    } else if (type === 'end' && newDates[1]) {
      const e = newDates[1].set('hour', timeRange[1].hour()).set('minute', timeRange[1].minute()).set('second', 59);
      if (!guardRange(dateRange[0], e)) return;
      setDateRange([dateRange[0], e]); setPage(1);
    }
  };

  const handleTimeChange = (time: Dayjs | null, type: 'start' | 'end') => {
    if (!time || !canEditDates) return;
    if (type === 'start') {
      const s = dateRange[0].set('hour', time.hour()).set('minute', time.minute());
      if (!guardRange(s, dateRange[1])) return;
      setTimeRange([time, timeRange[1]]);
      setDateRange([s, dateRange[1]]); setPage(1);
    } else {
      const e = dateRange[1].set('hour', time.hour()).set('minute', time.minute());
      if (!guardRange(dateRange[0], e)) return;
      setTimeRange([timeRange[0], time]);
      setDateRange([dateRange[0], e]); setPage(1);
    }
  };

  const buildFilterParams = useCallback((pg: number, lim: number) => {
    const params: any = {
      all: true,
      mode: 'list',
      page: pg,
      limit: lim,
      startDate: dateRange[0]?.toISOString(),
      endDate: dateRange[1]?.toISOString(),
    };
    if (typeFilter !== 'all') params.fulfillmentType = typeFilter;
    if (statusFilter === 'draft') params.status = 'draft,partial,overdue';
    else if (statusFilter !== 'all') params.status = statusFilter;
    if (debouncedSearch) params.q = debouncedSearch;
    params.sort = sortOrder;
    return params;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, typeFilter, statusFilter, sortOrder, dateRange[0]?.valueOf(), dateRange[1]?.valueOf()]);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await (api as any).getBills(buildFilterParams(page, PAGE_LIMIT));
      if (res?.success) {
        setBills(Array.isArray(res.data) ? res.data : []);
        setTotal(Number(res.total ?? res.count ?? 0));
        setTotalPages(Number(res.totalPages ?? 1));
        setHasMore(Boolean(res.hasMore));
      } else {
        showNotification(res?.message || t('bills.loadError', 'فشل تحميل الفواتير'), 'error');
      }
    } catch (e: any) {
      showNotification(e?.message || t('bills.loadError', 'فشل تحميل الفواتير'), 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, buildFilterParams]);

  useEffect(() => { void fetchPage(); }, [fetchPage]);

  // Fetch ALL matching bills (background) for export / print.
  // ملاحظة: البطاقات تجلب إجماليها من السيرفر (بلا سقف) — هذه للتصدير والطباعة والاحتياطي.
  // الملغاة مستبعدة — إلا لو طُلبت صراحة بفلتر الحالة.
  const fetchAllFiltered = useCallback(async (): Promise<any[]> => {
    const all: any[] = [];
    for (let pg = 1; pg <= 20; pg++) {
      const res: any = await (api as any).getBills(buildFilterParams(pg, 500));
      if (!res?.success || !Array.isArray(res.data)) break;
      all.push(...res.data);
      if (!res.hasMore || res.data.length < 500) break;
    }
    return statusFilter === 'all' ? all.filter((b: any) => b?.status !== 'cancelled') : all;
  }, [buildFilterParams, statusFilter]);

  const [totals, setTotals] = useState({ before: 0, disc: 0, tot: 0, paid: 0, rem: 0 });
  const [totalsLoading, setTotalsLoading] = useState(false);
  const sumBills = ( rows: any[]) => {
    let before = 0, disc = 0, tot = 0, paid = 0, rem = 0;
    for (const b of rows) {
      const fd = (b.orders || []).reduce((s: number, o: any) => s + (Number(o?.fixedDiscount?.amount) || 0) + (Number(o?.discount) || 0), 0);
      const all = fd + (Number(b.discount) || 0);
      before += (Number(b.total) || 0) + all;
      disc += all;
      tot += Number(b.total) || 0;
      paid += Number(b.paid) || 0;
      rem += Number(b.remaining) || 0;
    }
    return { before, disc, tot, paid, rem };
  };

  const refreshTotals = useCallback(() => {
    setTotalsLoading(true);
    // الإجمالي من السيرفر (كامل الفترة بلا سقف) — والجمع المحلي احتياطي فقط
    const params: any = buildFilterParams(1, 1);
    delete params.page; delete params.limit; delete params.sort; delete params.mode;
    const fallback = () => {
      fetchAllFiltered().then((rows) => { setTotals(sumBills(rows)); setTotalsLoading(false); }).catch(() => setTotalsLoading(false));
    };
    try {
      (api as any).getBillsTotals(params).then((res: any) => {
        if (res?.success && res?.totals) {
          const t = res.totals;
          setTotals({ before: Number(t.before) || 0, disc: Number(t.disc) || 0, tot: Number(t.tot) || 0, paid: Number(t.paid) || 0, rem: Number(t.rem) || 0 });
          setTotalsLoading(false);
        } else {
          fallback();
        }
      }).catch(() => fallback());
    } catch {
      fallback();
    }
  }, [fetchAllFiltered, buildFilterParams]);

  useEffect(() => { refreshTotals(); }, [refreshTotals]);

  // Socket live refresh (debounced page + totals)
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const totalsTickRef = useRef(0);
  useEffect(() => {
    let timer: any = null;
    let socket: Socket | null = null;
    try {
      const socketUrl = API_BASE_URL.replace(/\/api\/?$/, '');
      socket = io(socketUrl, {
        auth: { token: localStorage.getItem('token') || undefined },
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: Infinity,
        reconnectionDelayMax: 10000,
      });
      const kick = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          void fetchPageRef.current();
          totalsTickRef.current += 1;
          setTotalsLoading(true);
          fetchAllFiltered().then((rows) => setTotals(sumBills(rows))).catch(() => {}).finally(() => setTotalsLoading(false));
        }, 800);
      };
      socket.on('reconnect', kick);
      socket.on('bill-update', kick);
      socket.on('bill:updated', kick);
      socket.on('bill:created', kick);
      socket.on('bill:deleted', kick);
      socket.on('order-update', kick);
      socket.on('order:created', kick);
      socket.on('order:updated', kick);
    } catch {}
    return () => {
      if (timer) clearTimeout(timer);
      try { socket?.disconnect(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const typeMeta = (ft: string) => {
    if (ft === 'takeaway') return { label: t('bills.typeTakeaway', 'تيك أوي'), cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300', icon: '🥡' };
    if (ft === 'delivery') return { label: t('bills.typeDelivery', 'دليفري'), cls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300', icon: '🛵' };
    return { label: t('bills.typeDineIn', 'طاولة'), cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300', icon: '🍽' };
  };

  const statusMeta = (st: string) => {
    if (st === 'paid') return { label: t('bills.stPaid', 'مدفوعة'), cls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' };
    if (st === 'partial') return { label: t('bills.stPartial', 'جزئي'), cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' };
    if (st === 'cancelled') return { label: t('bills.stCancelled', 'ملغاة'), cls: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300' };
    if (st === 'overdue') return { label: t('bills.stOverdue', 'متأخرة'), cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' };
    return { label: t('bills.stDraft', 'غير مدفوعة بالكامل'), cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' };
  };

  const dispBillNo = (bn: any) => String(bn || '').replace(/^BILL-/, '');

  const fmtDateTime = (d: any) => {
    try {
      return replaceAMPM(dayjs(d).locale(i18n.language).format('DD/MM/YYYY hh:mm A'));
    } catch { return ''; }
  };

  const billName = (b: any) => b?.deliveryInfo?.customerName || b?.customerName || '';
  const billPhone = (b: any) => b?.deliveryInfo?.phone || b?.customerPhone || '';
  const billTable = (b: any) => {
    const tb = b?.table;
    if (!tb) return '';
    if (typeof tb === 'object') return String(tb.number ?? tb.name ?? '');
    return '';
  };
  const itemsCount = (b: any) => (b?.orders || []).reduce((s: number, o: any) => s + (Array.isArray(o?.items) ? o.items.reduce((q: number, it: any) => q + (Number(it?.quantity) || 0), 0) : 0), 0);

  const openDetail = (b: any) => { setSelected(b); setShowDetail(true); };

  const handlePrint = async (b: any) => {
    if (!b || printing) return;
    setPrinting(true);
    try {
      const ok = await printBill(b, user?.organizationName, i18n.language, t);
      if (!ok) showNotification(t('bills.printError', 'فشلت طباعة الفاتورة'), 'error');
    } catch { showNotification(t('bills.printError', 'فشلت طباعة الفاتورة'), 'error'); }
    finally { setPrinting(false); }
  };

  const [exporting, setExporting] = useState(false);
  const csvCell = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const handleExportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const rows = await fetchAllFiltered();
      const head = ['billNumber', 'date', 'type', 'customer', 'phone', 'table', 'items', 'before', 'discount', 'net', 'paid', 'remaining', 'status'];
      const lines = [head.join(',')];
      for (const b of rows) {
        const fd = (b.orders || []).reduce((s: number, o: any) => s + (Number(o?.fixedDiscount?.amount) || 0) + (Number(o?.discount) || 0), 0);
        const all = fd + (Number(b.discount) || 0);
        lines.push([
          b.billNumber, dayjs(b.createdAt).format('YYYY-MM-DD HH:mm'), b.fulfillmentType,
          billName(b), billPhone(b), billTable(b), itemsCount(b),
          (Number(b.total) || 0) + all, all, Number(b.total) || 0, Number(b.paid) || 0, Number(b.remaining) || 0, b.status,
        ].map(csvCell).join(','));
      }
      const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bills-${dayjs().format('YYYYMMDD-HHmm')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      showNotification(t('bills.exported', 'تم تصدير الكشف'), 'success');
    } catch (e: any) {
      showNotification(e?.message || t('bills.exportError', 'فشل التصدير'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const handlePrintList = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const rows = await fetchAllFiltered();
      const s = sumBills(rows);
      const w = window.open('', '_blank', 'width=1000,height=700');
      if (!w) return;
      const trs = rows.map((b: any) => {
        const fd = (b.orders || []).reduce((x: number, o: any) => x + (Number(o?.fixedDiscount?.amount) || 0) + (Number(o?.discount) || 0), 0);
        const all = fd + (Number(b.discount) || 0);
        return `<tr><td>${b.billNumber || ''}</td><td>${typeMeta(b.fulfillmentType).label}</td><td>${billName(b) || ''}<br><small>${billPhone(b) || ''}</small></td><td>${fmt((Number(b.total) || 0) + all)}</td><td>${fmt(all)}</td><td><b>${fmt(b.total)}</b></td><td>${fmt(b.paid)}</td><td>${fmt(b.remaining)}</td><td>${statusMeta(b.status).label}</td><td><small>${fmtDateTime(b.createdAt)}</small></td></tr>`;
      }).join('');
      w.document.write(`<html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${t('bills.title', 'الفواتير')}</title><style>body{font-family:Tahoma,Arial,sans-serif;padding:16px;color:#111}h2{text-align:center}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #999;padding:6px;text-align:right}th{background:#eee}.sum{display:flex;gap:16px;justify-content:center;margin:12px 0;font-weight:bold;flex-wrap:wrap}@media print{.noprint{display:none}}</style></head><body onload="window.print()"><h2>${t('bills.title', 'الفواتير')} — ${fmtDateTime(dateRange[0])} ← ${fmtDateTime(dateRange[1])}</h2><div class="sum"><span>${t('bills.sumCount', 'فواتير')}: ${rows.length}</span><span>${t('bills.sumTotal', 'الصافي')}: ${fmt(s.tot)}</span><span>${t('bills.sumPaid', 'مدفوع')}: ${fmt(s.paid)}</span><span>${t('bills.sumRem', 'متبقي')}: ${fmt(s.rem)}</span></div><table><thead><tr><th>${t('bills.cBill', 'الفاتورة')}</th><th>${t('bills.cType', 'النوع')}</th><th>${t('bills.cCustomer', 'العميل')}</th><th>${t('bills.cBefore', 'قبل الخصم')}</th><th>${t('bills.cDisc', 'الخصم')}</th><th>${t('bills.cNet', 'الصافي')}</th><th>${t('bills.cPaid', 'مدفوع')}</th><th>${t('bills.cRem', 'متبقي')}</th><th>${t('bills.cStatus', 'الحالة')}</th><th>${t('bills.cDate', 'التاريخ')}</th></tr></thead><tbody>${trs}</tbody></table></body></html>`);
      w.document.close();
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    const now = dayjs();
    const start = now.hour() < 7
      ? now.subtract(1, 'day').hour(7).minute(0).second(0).millisecond(0)
      : now.hour(7).minute(0).second(0).millisecond(0);
    setDateRange([start, start.add(1, 'day').subtract(1, 'second')]);
    setTimeRange([dayjs().set('hour', 7).set('minute', 0), dayjs().set('hour', 7).set('minute', 0)]);
    setTypeFilter('all'); setStatusFilter('all'); setSearch(''); setDebouncedSearch(''); setPage(1);
  };

  const typeTabs: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: t('bills.fAll', 'الكل') },
    { key: 'dine_in', label: t('bills.typeDineIn', 'طاولات') },
    { key: 'takeaway', label: t('bills.typeTakeaway', 'تيك أوي') },
    { key: 'delivery', label: t('bills.typeDelivery', 'دليفري') },
  ];
  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('bills.fAll', 'الكل') },
    { key: 'draft', label: t('bills.stDraft', 'غير مدفوعة بالكامل') },
    { key: 'paid', label: t('bills.stPaid', 'مدفوعة') },
    { key: 'cancelled', label: t('bills.stCancelled', 'ملغاة') },
  ];

  if (!canViewBills(user)) {
    return (
      <div className="p-3 sm:p-6 max-w-[1400px] mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 p-10 text-center">
          <div className="text-5xl mb-3">🔒</div>
          <div className="text-lg font-extrabold text-gray-900 dark:text-white">{t('common.noBillsAccess', 'ليس لديك صلاحية عرض صفحة الفواتير')}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('common.contactAdmin', 'يرجى التواصل مع المدير للحصول على الصلاحية')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Receipt className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white">{t('bills.title', 'الفواتير')}</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('bills.subtitle', 'جميع فواتير المنشأة: طاولات وتيك أوي ودليفري')} · {total}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {canExportReports(user) ? (
            <>
              <button onClick={() => void handleExportCsv()} disabled={exporting || loading} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm transition-all disabled:opacity-50">
                <Download className="h-4 w-4" />{t('bills.export', 'تصدير')}
              </button>
              <button onClick={() => void handlePrintList()} disabled={exporting || loading} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm transition-all disabled:opacity-50">
                <Printer className="h-4 w-4" />{t('bills.printList', 'طباعة الكشف')}
              </button>
            </>
          ) : null}
          <button onClick={() => void fetchPage()} disabled={loading} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm transition-all disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('bills.refresh', 'تحديث')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 p-3 sm:p-4 space-y-3">
        <div className="flex gap-2 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('bills.searchPh', 'بحث برقم الفاتورة أو اسم/هاتف العميل أو العنوان...')}
              className="w-full pr-9 pl-9 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/60 text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-violet-500"
            />
            {search ? (
              <button onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <button onClick={resetFilters} className="px-3.5 py-2.5 rounded-xl text-sm font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors whitespace-nowrap">
            {t('bills.reset', 'تصفير')}
          </button>
        </div>

        <div className="flex gap-x-4 gap-y-2 flex-wrap items-center">
          <span className="flex gap-1.5 flex-wrap items-center">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1">{t('bills.type', 'النوع')}:</span>
            {typeTabs.map(tb => (
              <button
                key={tb.key}
                onClick={() => { setTypeFilter(tb.key); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${typeFilter === tb.key ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/25' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-violet-300'}`}
              >
                {tb.label}
              </button>
            ))}
          </span>
          <span className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-gray-700" />
          <span className="flex gap-1.5 flex-wrap items-center">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1">{t('bills.sort', 'الترتيب')}:</span>
            {([
              { key: 'newest', label: t('bills.newest', 'الأحدث') },
              { key: 'oldest', label: t('bills.oldest', 'الأقدم') },
            ] as const).map(sb => (
              <button
                key={sb.key}
                onClick={() => { setSortOrder(sb.key); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${sortOrder === sb.key ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/25' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-violet-300'}`}
              >
                {sb.label}
              </button>
            ))}
          </span>
          <span className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-gray-700" />
          <span className="flex gap-1.5 flex-wrap items-center">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1">{t('bills.status', 'الحالة')}:</span>
            {statusTabs.map(sb => (
              <button
                key={sb.key}
                onClick={() => { setStatusFilter(sb.key); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${statusFilter === sb.key ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/25' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-violet-300'}`}
              >
                {sb.label}
              </button>
            ))}
          </span>
        </div>

        <ConfigProvider locale={getAntdLocale(i18n.language)} direction={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2">
              <CalendarDays className="h-4 w-4 text-violet-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{t('bills.from', 'من')}</div>
                <div className="flex gap-1.5 items-center">
                  <DatePicker value={dateRange[0]} onChange={(d) => handleDateChange([d, dateRange[1]], 'start')} className="flex-1 min-w-0" disabled={!canEditDates} />
                  <LocalizedTimePicker value={timeRange[0]} onChange={(tm) => handleTimeChange(tm, 'start')} className="w-24" disabled={!canEditDates} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2">
              <CalendarDays className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{t('bills.to', 'إلى')}</div>
                <div className="flex gap-1.5 items-center">
                  <DatePicker value={dateRange[1]} onChange={(d) => handleDateChange([dateRange[0], d], 'end')} className="flex-1 min-w-0" disabled={!canEditDates} />
                  <LocalizedTimePicker value={timeRange[1]} onChange={(tm) => handleTimeChange(tm, 'end')} className="w-24" disabled={!canEditDates} />
                </div>
              </div>
            </div>
          </div>
        </ConfigProvider>
      </div>

      {/* Summary — global totals across ALL matching bills (not just this page) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { label: t('bills.sumCount', 'فواتير'), value: String(total), cls: 'text-gray-900 dark:text-white' },
          { label: t('bills.sumBefore', 'قبل الخصم'), value: fmt(totals.before), cls: 'text-gray-500 dark:text-gray-400' },
          { label: t('bills.sumDisc', 'الخصم'), value: `-${fmt(totals.disc)}`, cls: 'text-purple-600 dark:text-purple-400' },
          { label: t('bills.sumTotal', 'الصافي'), value: fmt(totals.tot), cls: 'text-gray-900 dark:text-white' },
          { label: t('bills.sumPaid', 'مدفوع'), value: fmt(totals.paid), cls: 'text-green-600 dark:text-green-400' },
          { label: t('bills.sumRem', 'متبقي'), value: fmt(totals.rem), cls: 'text-red-500 dark:text-red-400' },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-center">
            <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{s.label}{totalsLoading ? ' …' : ''}</div>
            <div className={`text-base sm:text-lg font-extrabold ${s.cls} ${totalsLoading ? 'opacity-50' : ''}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/60 text-gray-500 dark:text-gray-300 text-xs">
                {[
                  t('bills.cBill', 'الفاتورة'),
                  t('bills.cType', 'النوع'),
                  t('bills.cCustomer', 'العميل'),
                  t('bills.cTable', 'طاولة'),
                  t('bills.cItems', 'أصناف'),
                  t('bills.cBefore', 'قبل الخصم'),
                  t('bills.cDisc', 'الخصم'),
                  t('bills.cNet', 'الصافي'),
                  t('bills.cPaid', 'مدفوع'),
                  t('bills.cRem', 'متبقي'),
                  t('bills.cStatus', 'الحالة'),
                  t('bills.cDate', 'التاريخ'),
                  t('bills.cActions', 'إجراءات'),
                ].map((h, i) => (
                  <th key={i} className="px-3 py-3 font-bold whitespace-nowrap text-right first:pr-4 last:pl-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && bills.length === 0 ? (
                <tr><td colSpan={13} className="px-3 py-10 text-center text-gray-400">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />{t('bills.loading', 'جارٍ التحميل...')}
                </td></tr>
              ) : bills.length === 0 ? (
                <tr><td colSpan={13} className="px-3 py-10 text-center text-gray-400 font-bold">{t('bills.empty', 'لا توجد فواتير مطابقة')}</td></tr>
              ) : bills.map((b: any) => {
                const tm = typeMeta(b.fulfillmentType);
                const sm = statusMeta(b.status);
                const fd = (b.orders || []).reduce((s: number, o: any) => s + (Number(o?.fixedDiscount?.amount) || 0) + (Number(o?.discount) || 0), 0);
                const all = fd + (Number(b.discount) || 0);
                const before = (Number(b.total) || 0) + all;
                const bid = String(b._id || b.id);
                const unpaidRow = ['draft', 'partial', 'overdue'].includes(b.status);
                return (
                  <tr
                    key={bid}
                    onClick={() => openDetail(b)}
                    className={`border-t border-gray-100 dark:border-gray-700/60 hover:bg-violet-50/60 dark:hover:bg-violet-900/10 cursor-pointer transition-colors ${loading ? 'opacity-60' : ''} ${unpaidRow ? 'bg-red-50/60 dark:bg-red-900/10 shadow-[inset_-4px_0_0_0_#ef4444] dark:shadow-[inset_-4px_0_0_0_#f87171]' : ''}`}
                  >
                    <td className="px-3 py-2.5 font-mono font-bold text-xs text-violet-700 dark:text-violet-300 whitespace-nowrap first:pr-4" dir="ltr">
                      {dispBillNo(b.billNumber) || bid}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${tm.cls}`}><span>{tm.icon}</span>{tm.label}</span>
                    </td>
                    <td className="px-3 py-2.5 min-w-[130px]">
                      <div className="font-bold text-gray-800 dark:text-gray-100 truncate max-w-[160px]">{billName(b) || '—'}</div>
                      {billPhone(b) ? <div className="text-[11px] text-blue-600 dark:text-blue-400 font-bold" dir="ltr">{billPhone(b)}</div> : null}
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap">{billTable(b) || '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex min-w-[22px] h-[22px] px-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full items-center justify-center">{itemsCount(b)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 dark:text-gray-500 line-through whitespace-nowrap">{all > 0 ? fmt(before) : '—'}</td>
                    <td className="px-3 py-2.5 text-purple-600 dark:text-purple-400 font-bold whitespace-nowrap">{all > 0 ? `-${fmt(all)}` : '—'}</td>
                    <td className="px-3 py-2.5 font-extrabold text-gray-900 dark:text-white whitespace-nowrap">{fmt(b.total)}</td>
                    <td className="px-3 py-2.5 text-green-600 dark:text-green-400 font-bold whitespace-nowrap">{fmt(b.paid)}</td>
                    <td className="px-3 py-2.5 text-red-500 dark:text-red-400 font-bold whitespace-nowrap">{fmt(b.remaining)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-center">
                      {b.status === 'paid' ? (
                        <span title={sm.label} className="inline-flex w-7 h-7 rounded-full items-center justify-center bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300">
                          <CheckCircle2 className="h-4 w-4" />
                        </span>
                      ) : b.status === 'draft' ? (
                        <span title={sm.label} className="inline-flex w-7 h-7 rounded-full items-center justify-center bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300">
                          <XCircle className="h-4 w-4" />
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${sm.cls}`}>{sm.label}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-center">
                      <div className="text-xs font-bold text-gray-700 dark:text-gray-200">{dayjs(b.createdAt).locale(i18n.language).format('DD/MM/YYYY')}</div>
                      <div className="text-[11px] text-gray-400 dark:text-gray-500">{replaceAMPM(dayjs(b.createdAt).locale(i18n.language).format('hh:mm A'))}</div>
                    </td>
                    <td className="px-3 py-2.5 last:pl-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {canEditBill(user) ? (
                          <button
                            onClick={() => setBillToEdit(b)}
                            title={t('bills.edit', 'تعديل')}
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-300 transition-colors"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        ) : null}
                        <button
                          onClick={() => void handlePrint(b)}
                          title={t('bills.print', 'طباعة')}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        {isUnpaid(b) && canPayFullBill(user) ? (
                          <button
                            onClick={() => setPayTarget({ bill: b, method: 'cash', drawer: defaultDrawerForFulfillment((b as any)?.fulfillmentType) })}
                            disabled={payingId === String(b._id || b.id)}
                            title={t('bills.payFull', 'دفع الفاتورة بالكامل')}
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 transition-colors disabled:opacity-50"
                          >
                            <DollarSign className="h-4 w-4" />
                          </button>
                        ) : null}
                        {canDeleteBill(user) ? (
                          <button
                            onClick={() => handleDelete(b)}
                            title={t('bills.delete', 'حذف')}
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-700/30">
          <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
            {t('bills.pageOf', 'صفحة')} {page} {t('bills.of', 'من')} {Math.max(totalPages, 1)} · {t('bills.totalBills', 'إجمالي')}: {total}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore || loading}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {showDetail && selected && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDetail(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
              <div className="text-white">
                <div className="font-mono font-extrabold text-base leading-tight break-all" dir="ltr">{dispBillNo(selected.billNumber) || String(selected._id || '')}</div>
                <div className="text-xs text-violet-100">{typeMeta(selected.fulfillmentType).label} · {statusMeta(selected.status).label} · {fmtDateTime(selected.createdAt)}</div>
              </div>
              <button onClick={() => setShowDetail(false)} className="w-8 h-8 bg-white/15 hover:bg-white/25 rounded-xl flex items-center justify-center text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-gray-50 dark:bg-gray-700/60 p-2.5">
                  <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{t('bills.cCustomer', 'العميل')}</div>
                  <div className="font-bold text-gray-900 dark:text-white">{billName(selected) || '—'}</div>
                  {billPhone(selected) ? <div className="text-xs font-bold text-blue-600 dark:text-blue-400" dir="ltr">{billPhone(selected)}</div> : null}
                  {(selected.fulfillmentType === 'dine_in' || billTable(selected)) && billTable(selected) ? (
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('bills.cTable', 'طاولة')}: <b>{billTable(selected)}</b></div>
                  ) : null}
                  {selected.deliveryInfo?.address ? (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">📍 {selected.deliveryInfo.address}</div>
                  ) : null}
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-gray-700/60 p-2.5 space-y-1">
                  {(() => {
                    const fd = (selected.orders || []).reduce((s: number, o: any) => s + (Number(o?.fixedDiscount?.amount) || 0) + (Number(o?.discount) || 0), 0);
                    const all = fd + (Number(selected.discount) || 0);
                    const fee = Number(selected.deliveryInfo?.deliveryFee) || 0;
                    const rows: [string, string, string][] = [
                      [t('bills.cBefore', 'قبل الخصم'), fmt((Number(selected.total) || 0) + all), 'text-gray-500 dark:text-gray-400'],
                      [t('bills.cDisc', 'الخصم'), `-${fmt(all)}`, 'text-purple-600 dark:text-purple-400'],
                    ];
                    if (fee > 0) rows.push([t('bills.cFee', 'رسوم التوصيل'), fmt(fee), 'text-emerald-600 dark:text-emerald-400']);
                    rows.push(
                      [t('bills.cNet', 'الصافي'), fmt(selected.total), 'text-gray-900 dark:text-white'],
                      [t('bills.cPaid', 'مدفوع'), fmt(selected.paid), 'text-green-600 dark:text-green-400'],
                      [t('bills.cRem', 'متبقي'), fmt(selected.remaining), 'text-red-500 dark:text-red-400'],
                    );
                    return rows.map(([k, v, c], i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{k}</span>
                        <span className={`font-extrabold ${c}`}>{v}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/60 text-xs font-bold text-gray-500 dark:text-gray-300">
                  {t('bills.items', 'الأصناف')} ({itemsCount(selected)})
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                  {(() => {
                    const map = new Map<string, any>();
                    for (const o of (selected.orders || [])) {
                      for (const it of (Array.isArray(o?.items) ? o.items : [])) {
                        const mid = (it?.menuItem as any)?._id || it?.menuItem || '';
                        const key = `${mid}|${it?.name || ''}|${Number(it?.price) || 0}|${it?.variant || ''}`;
                        const ex = map.get(key);
                        if (ex) ex.quantity += Number(it?.quantity) || 0;
                        else map.set(key, { name: it?.name || '—', price: Number(it?.price) || 0, quantity: Number(it?.quantity) || 0, variant: it?.variant || null });
                      }
                    }
                    const agg = Array.from(map.values());
                    if (agg.length === 0) return <div className="px-3 py-4 text-center text-xs text-gray-400">{t('bills.noItems', 'لا توجد أصناف')}</div>;
                    return agg.map((it: any, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="font-bold text-gray-800 dark:text-gray-100 truncate">
                          {it.name} <span className="text-xs text-gray-400">× {it.quantity}</span>
                          {it.variant ? <span className="text-[11px] text-purple-600 dark:text-purple-300 mr-1">({it.variant})</span> : null}
                        </span>
                        <span className="font-extrabold text-gray-900 dark:text-white whitespace-nowrap">{fmt(it.price * it.quantity)}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {selected && isUnpaid(selected) && canPayFullBill(user) ? (
                <div className="flex gap-2">
                  <select
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value as any)}
                    className="px-2.5 py-2.5 text-sm font-bold border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 outline-none"
                  >
                    <option value="cash">{paymentMethodIcon('cash')} {paymentMethodLabel('cash', t)}</option>
                    <option value="card">{paymentMethodIcon('card')} {paymentMethodLabel('card', t)}</option>
                    <option value="transfer">{paymentMethodIcon('transfer')} {paymentMethodLabel('transfer', t)}</option>
                    <option value="e_wallet">{paymentMethodIcon('e_wallet')} {paymentMethodLabel('e_wallet', t)}</option>
                  </select>
                  <DrawerSelect value={payDrawer} onChange={setPayDrawer} showLabels={true} />
                  <button
                    onClick={() => setPayTarget({ bill: selected, method: payMethod, drawer: payDrawer })}
                    disabled={payingId === String((selected as any)._id || (selected as any).id)}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 shadow transition-colors disabled:opacity-50"
                  >
                    <DollarSign className="h-4 w-4" />{t('bills.payFull', 'دفع الفاتورة بالكامل')} ({fmt(selected.remaining)})
                  </button>
                </div>
              ) : null}
              {selected && (['draft', 'partial', 'overdue'].includes(selected.status) || isUnpaid(selected) || billPhone(selected) || itemsCount(selected) > 0) ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['draft', 'partial', 'overdue'].includes(selected.status) && canEditBill(user) ? (
                    <button
                      onClick={() => {
                        const ft = String((selected as any)?.fulfillmentType || 'dine_in');
                        const ok = ft === 'takeaway' ? canMoveBillTakeawayToTable(user) : ft === 'delivery' ? canMoveBillDeliveryToTable(user) : canMoveBillTableToTable(user);
                        if (!ok) { showNotification(t('common.permissionDenied', 'غير مصرح'), 'error'); return; }
                        setMoveBill(selected);
                      }}
                      className="py-2.5 rounded-xl bg-white dark:bg-gray-700 border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-300 text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                    >
                      <ArrowLeftRight className="h-4 w-4" />{t('bills.move', 'نقل')}
                    </button>
                  ) : null}
                  {isUnpaid(selected) && canPartialPayment(user) ? (
                    <button
                      onClick={() => setPayItemsBill(selected)}
                      className="py-2.5 rounded-xl bg-white dark:bg-gray-700 border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                    >
                      <ListChecks className="h-4 w-4" />{t('bills.payItems', 'دفع أصناف')}
                    </button>
                  ) : null}
                  {billPhone(selected) ? (
                    <button
                      onClick={() => handleWhatsApp(selected)}
                      className="py-2.5 rounded-xl bg-white dark:bg-gray-700 border border-green-300 dark:border-green-700 text-green-600 dark:text-green-300 text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" />{t('bills.whatsapp', 'واتساب')}
                    </button>
                  ) : null}
                  {itemsCount(selected) > 0 && selected.status !== 'cancelled' ? (
                    <button
                      onClick={() => void handlePrepPrint(selected)}
                      className="py-2.5 rounded-xl bg-white dark:bg-gray-700 border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-300 text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                    >
                      <ChefHat className="h-4 w-4" />{t('bills.prep', 'تحضير')}
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="grid grid-cols-3 gap-2">
                {canEditBill(user) ? (
                  <button
                    onClick={() => { setShowDetail(false); setBillToEdit(selected); }}
                    className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 shadow transition-colors"
                  >
                    <Edit className="h-4 w-4" />{t('bills.edit', 'تعديل')}
                  </button>
                ) : null}
                <button
                  onClick={() => void handlePrint(selected)}
                  disabled={printing}
                  className="py-2.5 rounded-xl bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-white text-sm font-bold flex items-center justify-center gap-1.5 shadow transition-colors disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" />{printing ? '...' : t('bills.print', 'طباعة')}
                </button>
                {canDeleteBill(user) ? (
                  <button
                    onClick={() => handleDelete(selected)}
                    className="py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 shadow transition-colors bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />{t('bills.delete', 'حذف')}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 dark:border-gray-700 p-5 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/40 text-red-500 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">{t('bills.delTitle', 'حذف الفاتورة؟')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono" dir="ltr">{dispBillNo(deleteTarget.billNumber) || String(deleteTarget._id || '').slice(-6)}</p>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mt-1">{fmt(deleteTarget.total)} · {statusMeta(deleteTarget.status).label}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{t('bills.delWarn', 'لا يمكن التراجع عن الحذف')}</p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={() => !deleting && setDeleteTarget(null)}
                disabled={deleting}
                className="py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-bold transition-colors disabled:opacity-50"
              >
                {t('bills.cancel', 'إلغاء')}
              </button>
              <button
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow transition-colors disabled:opacity-50"
              >
                {deleting ? '...' : t('bills.confirmDel', 'تأكيد الحذف')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay confirm */}
      {payTarget && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4" onClick={() => !payingId && setPayTarget(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 dark:border-gray-700 p-5 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <DollarSign className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">{t('bills.payTitle', 'تحصيل الفاتورة بالكامل؟')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono" dir="ltr">{dispBillNo(payTarget.bill?.billNumber) || String(payTarget.bill?._id || '').slice(-6)}</p>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 my-2">{fmt(payTarget.bill?.remaining)}</div>
            <div className="flex gap-2">
              <select
                value={payTarget.method}
                onChange={e => setPayTarget({ bill: payTarget.bill, method: e.target.value as any, drawer: payTarget.drawer })}
                className="flex-1 px-3 py-2.5 text-sm font-bold border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 outline-none"
              >
                <option value="cash">{paymentMethodIcon('cash')} {paymentMethodLabel('cash', t)}</option>
                <option value="card">{paymentMethodIcon('card')} {paymentMethodLabel('card', t)}</option>
                <option value="transfer">{paymentMethodIcon('transfer')} {paymentMethodLabel('transfer', t)}</option>
                <option value="e_wallet">{paymentMethodIcon('e_wallet')} {paymentMethodLabel('e_wallet', t)}</option>
              </select>
              <DrawerSelect
                value={payTarget.drawer}
                onChange={d => setPayTarget({ bill: payTarget.bill, method: payTarget.method, drawer: d })}
                className="flex-1"
                showLabels={true}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={() => !payingId && setPayTarget(null)}
                disabled={!!payingId}
                className="py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-bold transition-colors disabled:opacity-50"
              >
                {t('bills.cancel', 'إلغاء')}
              </button>
              <button
                onClick={() => void confirmPay()}
                disabled={!!payingId}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow transition-colors disabled:opacity-50"
              >
                {payingId ? '...' : t('bills.confirmPay', 'تأكيد التحصيل')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move / pay-items / prep modals (same components as cards) */}
      {moveBill && (
        <ChangeTableModal
          billLabel={dispBillNo(moveBill.billNumber) || String(moveBill._id || '').slice(-6)}
          tables={tables || []}
          getSectionName={(tb: any) => (typeof tb.section === 'object' ? tb.section?.name : '') || ''}
          changing={false}
          onConfirm={(id) => handleMoveToTable(String(id))}
          onClose={() => setMoveBill(null)}
        />
      )}
      {payItemsBill && (
        <ItemPartialPayModal
          bill={payItemsBill}
          onClose={() => setPayItemsBill(null)}
          onSuccess={(updated: any) => {
            const nid = String(updated?._id || updated?.id || payItemsBill?._id);
            setBills((prev: any[]) => prev.map((b: any) => String(b._id || b.id) === nid ? updated : b));
            if (selected && String((selected as any)._id || (selected as any).id) === nid) setSelected(updated);
            refreshTotals();
            setPayItemsBill(null);
          }}
          canEditPaid={canEditPartialPayment(user)}
          onRefreshBill={(updated: any) => {
            const nid = String(updated?._id || updated?.id || payItemsBill?._id);
            if (!nid) return;
            setBills((prev: any[]) => prev.map((b: any) => String(b._id || b.id) === nid ? updated : b));
            if (selected && String((selected as any)._id || (selected as any).id) === nid) setSelected(updated);
            refreshTotals();
            setPayItemsBill(updated);
          }}
        />
      )}
      {prepSelection && (
        <OrderPrintSectionsModal
          billLabel={dispBillNo((prepSelection.bill as any)?.billNumber) || String((prepSelection.bill as any)?._id || '').slice(-6)}
          sections={prepSelection.sections}
          selected={prepSelected}
          onToggle={(id) => setPrepSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
          onToggleAll={() => setPrepSelected((cur) => (cur.length === prepSelection.sections.length ? [] : prepSelection.sections.map((s) => s.id)))}
          onConfirm={confirmPrepPrint}
          onClose={() => setPrepSelection(null)}
        />
      )}

      {/* Edit modal (same as other pages, per bill type) */}
      <BillItemsEditModal
        isOpen={!!billToEdit}
        onClose={() => setBillToEdit(null)}
        bill={billToEdit}
        menuItems={menuItems || []}
        menuSections={menuSections || []}
        menuCategories={menuCategories || []}
        onSuccess={(updated: any) => {
          setBillToEdit(null);
          if (selected && String((selected as any)._id || (selected as any).id) === String((updated as any)?._id || (updated as any)?.id)) setSelected(updated);
          void fetchPage();
          refreshTotals();
        }}
      />
    </div>
  );
};

export default Bills;
