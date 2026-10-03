import { useState, useEffect, useMemo, memo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { Bill } from '../services/api';
import { printBill } from '../utils/printBill';
import { Search, Plus } from 'lucide-react';
import BillItemsEditModal from '../components/tables/BillItemsEditModal';
import ItemPartialPayModal from '../components/tables/ItemPartialPayModal';
import PaymentManagementModal from '../components/tables/PaymentManagementModal';
import type { PaymentMethod } from '../utils/paymentMethod';
import type { CashDrawer } from '../utils/paymentDrawer';
import { canDeleteBill, canViewCustomerContacts, canApplyManualDiscount, canMoveBillTakeawayToTable, canCreateTakeaway, canEditTakeaway, canPayFullTakeaway, canPayPartialTakeaway } from '../utils/permissionHelper';
import { useInfiniteList } from '../hooks/useInfiniteList';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../utils/apiBase';

import BillTableCard from '../components/tables/BillTableCard';
import { getShortBillNumber, localeTag, formatCurrency as formatCurrencyUtil } from '../utils/formatters';
import ChangeTableModal from '../components/tables/ChangeTableModal';

import OrderPrintSectionsModal from '../components/tables/OrderPrintSectionsModal';
import { startBillPrep, confirmBillPrep } from '../utils/orderSectionPrint';
import { getFulfillmentFlagFresh } from '../utils/freshPrintSettings';

// شريط الخصم أسفل الكارت
const DiscountStrip = memo(({ bill, onDiscount }: { bill: any; onDiscount: (b: any, d: number, t: 'amount' | 'percent') => void }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [disc, setDisc] = useState('');
  const [discType, setDiscType] = useState<'amount' | 'percent'>('percent');
  // حساب إجمالي الخصومات من الطلبات
  const totalFixedDiscount = (bill.orders || []).reduce((sum: number, order: any) => sum + (order?.fixedDiscount?.amount || 0), 0);
  const billDiscount = Number(bill.discount) || 0;
  const totalAllDiscounts = totalFixedDiscount + billDiscount;
  return (
    <div className="mt-1 space-y-1">
      {totalAllDiscounts > 0 && (
        <div className="flex items-center justify-between px-2 py-1 text-[11px] bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <span className="text-purple-600 dark:text-purple-400 font-bold">{t('takeaway.discount.title')}</span>
          <span className="text-purple-700 dark:text-purple-300 font-bold">-{totalAllDiscounts.toLocaleString(localeTag())} {t('takeaway.currency')}</span>
        </div>
      )}
      <button onClick={() => setOpen(v => !v)} className="w-full py-1 text-[11px] font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-500">{t('takeaway.discount.toggle')}</button>
      {open && (
        <div className="mt-1 flex gap-1">
          <input type="number" min="0" placeholder={discType === 'percent' ? t('takeaway.discount.placeholderPercent', { value: bill.discountPercentage || 0 }) : t('takeaway.discount.placeholderAmount', { value: bill.discount || 0 })} value={disc} onChange={e => setDisc(e.target.value)} className="flex-1 px-2 py-1.5 text-xs border rounded-lg bg-white dark:bg-gray-700" />
          <button onClick={() => setDiscType(prev => prev === 'amount' ? 'percent' : 'amount')} title={t('takeaway.discount.switchTitle')} className="px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-gray-700 border rounded-lg text-gray-600">{discType === 'amount' ? t('takeaway.currency') : '%'}</button>
          <button onClick={() => { const d = Number(disc); if (disc === '' || d < 0 || (discType === 'percent' && d > 100)) return; onDiscount(bill, d, discType); setDisc(''); }} className="px-3 py-1.5 text-xs font-bold bg-gray-600 hover:bg-gray-700 text-white rounded-lg">{t('takeaway.discount.apply')}</button>
        </div>
      )}
    </div>
  );
});
DiscountStrip.displayName = 'DiscountStrip';

// مطابقة فاتورة لنص البحث محلياً (للسوكت) — نفس حقول بحث السيرفر: رقم/اسم/هاتف/ملاحظات/صنف
const phoneVariants = (d: string): string[] => {
  const out = [d];
  if (/^01\d{9}$/.test(d)) out.push('20' + d.slice(1));
  if (/^20\d{10}$/.test(d)) out.push('0' + d.slice(2));
  if (/^0020\d{10}$/.test(d)) out.push('0' + d.slice(4));
  return out;
};
const normalizeDigits = (s: any): string => String(s || '')
  .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const phoneMatches = (stored: any, query: string): boolean => {
  const qd = normalizeDigits(query).replace(/\D/g, '');
  if (qd.length < 2) return false;
  const sd = normalizeDigits(stored).replace(/\D/g, '');
  if (!sd) return false;
  return phoneVariants(qd).some((v) => sd.includes(v));
};
const billMatchesQuery = (b: any, query: string): boolean => {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return true;
  const fields = [b?.billNumber, b?.customerName, b?.notes];
  if (fields.some((f) => String(f || '').toLowerCase().includes(needle))) return true;
  if (phoneMatches(b?.customerPhone, needle)) return true;
  const orders = Array.isArray(b?.orders) ? b.orders : [];
  // رقم الطلب أو اسم الصنف داخل الطلبات
  return orders.some((o: any) => {
    if (String(o?.orderNumber || '').toLowerCase().includes(needle)) return true;
    return Array.isArray(o?.items) && o.items.some((it: any) => String(it?.name || '').toLowerCase().includes(needle));
  });
};


const Takeaway = () => {
  const { bills, fetchBills, setBills, refreshSingleBill, user, tables, menuItems, menuSections, menuCategories, fetchMenuItems, fetchMenuSections, fetchMenuCategories, showNotification } = useApp() as any;
  const { t, i18n } = useTranslation();
  const [moveBill, setMoveBill] = useState<any | null>(null);
  const [payMethods, setPayMethods] = useState<Record<string, string>>({});
  const [payDrawers, setPayDrawers] = useState<Record<string, string>>({});
  // خيار الطباعة المزدوجة (تحضير + فاتورة) الخاص بالتيك أوي من إعدادات الطباعة
  const [printBoth, setPrintBoth] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { loadPrintBothFlag } = await import('../utils/printPrefs');
        const v = await loadPrintBothFlag('printBothTakeaway');
        if (alive) setPrintBoth(v);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);
  // طباعة أقسام التحضير (مطبخ/مشويات...) لكل طلبات الفاتورة — نفس قواعد الطاولات.
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
    } catch { showNotification(t('takeaway.notifications.prepPrintFailed'), 'error'); }
  };
  const confirmPrepPrint = async () => {
    if (!prepSelection || prepSelected.length === 0) return;
    const sel = prepSelection;
    setPrepSelection(null);
    try {
      const r = await confirmBillPrep(sel.orders, prepSelected, sel.menuItemsMap, prepCtx());
      if (r.printed === 0) showNotification(t('takeaway.notifications.noMatchingSections'), 'error');
      else showNotification(t('takeaway.notifications.sentToPrint', { count: r.printed }), 'success');
    } catch { showNotification(t('takeaway.notifications.prepPrintFailed'), 'error'); }
  };

  // طباعة تلقائية عند اكتمال السداد: الفاتورة دائمًا + التحضير إن كانت المزدوجة مفعلة.
  // التحضير بالأقسام الافتراضية (أو الكل) لأن التدفق الآلي لا يسأل المستخدم.
  const autoPrintPaidBill = async (paidBill: any) => {
    try {
      if (!paidBill || Number(paidBill?.remaining) > 0) return;
      if (!(await getFulfillmentFlagFresh(user, 'autoPrintOnPayment', 'takeaway'))) return;
      await printBill(paidBill, (user as any)?.organizationName, i18n.language, t, undefined, 'payment');
      if (!(await getFulfillmentFlagFresh(user, 'printBoth', 'takeaway'))) return;
      const ctx = prepCtx();
      const r = await startBillPrep(paidBill, ctx);
      if (r.status === 'prompt') {
        const { getEffectivePrintSettingsFresh } = await import('../utils/freshPrintSettings');
        const { resolveFulfillmentValue } = await import('../utils/resolvePrintSettings');
        const ps = await getEffectivePrintSettingsFresh(user).catch(() => null);
        const defaults = ((resolveFulfillmentValue(ps, 'defaultOrderPrintSections', 'takeaway', []) || []) as string[]).map((id) => String(id)).filter((id) => r.sections.some((s) => s.id === id));
        await confirmBillPrep(r.orders, defaults.length ? defaults : r.sections.map((s) => s.id), r.menuItemsMap, ctx);
      }
    } catch {}
  };

  const handlePrint = async (bill: any) => {
    try { await printBill(bill, (user as any)?.organizationName, i18n.language, t); showNotification(t('takeaway.notifications.printSent'), 'success'); }
    catch (e: any) { showNotification(e?.message || t('takeaway.notifications.printFailed'), 'error'); }
  };

  const handleMoveToTable = async (tableId: string) => {
    if (!moveBill) return;
    const id = moveBill._id || moveBill.id;
    try {
      const res: any = await (api as any).updateBill(id, { table: tableId, fulfillmentType: 'dine_in' });
      setMoveBill(null);
      setBills((prev: any[]) => prev.filter((b: any) => String(b._id || b.id) !== String(id)));
      feedRef.current?.remove(String(id));
      showNotification(res?.message || t('takeaway.notifications.movedToTable'), 'success');
      void fetchBills();
    } catch (e: any) { showNotification(e?.message || t('takeaway.notifications.moveFailed'), 'error'); }
  };

  const applyBill = (id: any, updated: any) => {
    const sid = String(id);
    if (updated) {
      setBills((prev: any[]) => prev.map((b: any) => String(b._id || b.id) === sid ? updated : b));
      if (updated.status === 'paid' || updated.status === 'cancelled') feedRef.current?.remove(sid);
      else feedRef.current?.upsert(updated);
    } else if (refreshSingleBill) refreshSingleBill({ _id: id });
  };
  const [billToEdit, setBillToEdit] = useState<any | null>(null);
  const [payItemsBill, setPayItemsBill] = useState<any | null>(null);

  const handleDiscount = async (bill: any, discount: number, type: 'amount' | 'percent' = 'percent') => {
    if (!canApplyManualDiscount(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    const id = bill._id || bill.id;
    try {
      const payload = type === 'percent' ? { discountPercentage: discount, discount: 0 } : { discount, discountPercentage: 0 };
      const res: any = await (api as any).updateBill(id, payload);
      applyBill(id, res?.success ? res.data : null);
      if (res?.success) showNotification(t('takeaway.notifications.discountApplied'), 'success');
    } catch (e: any) { showNotification(e?.message || t('takeaway.notifications.discountFailed'), 'error'); refreshSingleBill?.({ _id: id }); }
  };

  // No server bill exists until first save — closing without saving discards the draft locally.
  const closeItemsModal = () => {
    setBillToEdit(null);
  };

  // نفس معاملة حذف فواتير الطاولات: فحص صلاحية أولاً ثم حذف متفائل + مزامنة خلفية
  const handleDelete = async (bill: any) => {
    if (!canDeleteBill(user)) { showNotification(t('takeaway.notifications.unauthorizedDelete'), 'error'); return; }
    const id = bill._id || bill.id;
    setBills((prev: any[]) => prev.filter((b: any) => String(b._id || b.id) !== String(id)));
    feedRef.current?.remove(String(id));
    try {
      const res: any = await (api as any).deleteBill(id);
      if (res?.success) {
        showNotification(t('takeaway.notifications.deleted'), 'success');
        void fetchBills();
      } else {
        showNotification(t('takeaway.notifications.deleteFailed'), 'error');
        refreshSingleBill?.({ _id: id });
      }
    } catch (e: any) { showNotification(e?.message || t('takeaway.notifications.deleteError'), 'error'); refreshSingleBill?.({ _id: id }); }
  };
  // فتح إدارة الدفع من إشعار "عرض الطلب" — تُجلب الفاتورة (مدفوعة غالبًا) ثم تُفتح
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const st = (location.state as any) || {};
    if (st?.openPaymentForBill) {
      const bid = String(st.openPaymentForBill);
      navigate(location.pathname, { replace: true, state: {} });
      (async () => {
        try {
          const r: any = await api.getBill(bid);
          if (r?.success && r.data) setPayItemsBill(r.data);
          else showNotification(t('takeaway.notifications.openBillFailed'), 'error');
        } catch { showNotification(t('takeaway.notifications.openBillFailed'), 'error'); }
      })();
    }
  }, [location.state]);

  useEffect(() => {
    (async () => {
      try {
        if (!menuItems?.length) await fetchMenuItems?.();
        if (!menuSections?.length) await fetchMenuSections?.();
        if (!menuCategories?.length) await fetchMenuCategories?.();
      } catch {}
    })();
  }, []);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [billFilter, setBillFilter] = useState<'unpaid' | 'paid' | 'all'>('unpaid');
  const billFilterRef = useRef(billFilter);
  billFilterRef.current = billFilter;
  const searchRef = useRef('');
  searchRef.current = debouncedSearch;
  const [density, setDensity] = useState(() => { try { return localStorage.getItem('takeawayDensity') || 'comfortable'; } catch { return 'comfortable'; } });
  const compact = density === 'compact';

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 150); return () => clearTimeout(t); }, [search]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  // ── Infinite scroll من السيرفر (25/صفحة) بدل الجلب الكامل ──
  const feed = useInfiniteList<any>({
    pageSize: 25,
    depsKey: `${debouncedSearch.trim()}|${billFilter}`,
    getId: (b: any) => String(b?._id || b?.id || ''),
    fetchPage: async (pageNum, limitNum) => {
      const searching = debouncedSearch.trim().length > 0;
      const res: any = await (api as any).getBills({
        fulfillmentType: 'takeaway',
        // أثناء البحث: ابحث في كل الحالات (المدفوع أيضاً) — الفلتر الصريح 'مدفوعة' يبقى كما هو
        status: billFilter === 'paid' ? 'paid' : (billFilter === 'all' || searching) ? undefined : 'draft,partial,overdue',
        all: (billFilter === 'all' || searching) ? true : undefined,
        q: debouncedSearch.trim() || undefined,
        page: pageNum,
        limit: limitNum,
        mode: 'list',
      });
      if (res && res.success === false) throw new Error(res.message || t('takeaway.notifications.searchFailed'));
      return { items: res?.data || [], total: res?.total ?? 0, hasMore: res?.hasMore ?? false };
    },
  });
  const feedRef = useRef<any>(null);
  feedRef.current = feed;

  // دمج فواتير التيك أوي لحظياً (إنشاء/تحديث/حذف) دون إعادة الصفحات
  useEffect(() => {
    let socket: Socket | null = null;
    let onCreated: ((b: any) => void) | undefined;
    let onUpdated: ((b: any) => void) | undefined;
    let onDeleted: ((b: any) => void) | undefined;
    let onBillUpdate: ((evt: any) => void) | undefined;
    try {
      const socketUrl = API_BASE_URL.replace(/\/api\/?$/, '');
      socket = io(socketUrl, {
        path: '/socket.io/',
        auth: { token: localStorage.getItem('token') || undefined },
        transports: ['websocket', 'polling'],
        reconnection: true,
      });
      const matches = (b: any) => {
        if (!b || (b.fulfillmentType || 'dine_in') !== 'takeaway') return false;
        if (!billMatchesQuery(b, searchRef.current)) return false;
        const f = billFilterRef.current;
        const searching = searchRef.current.trim().length > 0;
        if (f === 'paid') return b.status === 'paid';
        if (f === 'all' || searching) return true;
        return !['paid', 'cancelled'].includes(b.status);
      };
      onCreated = (b: any) => { try { if (matches(b)) feedRef.current?.prepend(b); } catch {} };
      onUpdated = (b: any) => {
        try {
          if (!b) return;
          const id = String(b._id || b.id || '');
          if (!id) return;
          if (matches(b)) feedRef.current?.upsert(b);
          else feedRef.current?.remove(id);
        } catch {}
      };
      onDeleted = (b: any) => {
        try {
          const id = String(b?._id || b?.id || b || '');
          if (id) feedRef.current?.remove(id);
        } catch {}
      };
      onBillUpdate = (evt: any) => {
        try {
          if (!evt) return;
          if (evt.type === 'created') onCreated(evt.bill);
          else if (evt.type === 'deleted') onDeleted(evt.bill);
          else onUpdated(evt.bill);
        } catch {}
      };
      socket.on('bill:created', onCreated);
      socket.on('bill:updated', onUpdated);
      socket.on('bill:deleted', onDeleted);
      socket.on('bill-update', onBillUpdate);
    } catch {}
    return () => {
      try {
        if (onCreated) socket?.off('bill:created', onCreated);
        if (onUpdated) socket?.off('bill:updated', onUpdated);
        if (onDeleted) socket?.off('bill:deleted', onDeleted);
        if (onBillUpdate) socket?.off('bill-update', onBillUpdate);
        socket?.disconnect();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // احتياطي: تحديث الصفحة الأولى كل 30ث (انقطاع سوكت/فوات مكتوم)
  useEffect(() => {
    const id = setInterval(() => {
      try { feedRef.current?.refreshFirstPage(); } catch {}
    }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // دائماً: غير مدفوع فقط (جديد + جزئي) — للإحصائيات (العرض نفسه صفحات سيرفر)
  const list: Bill[] = useMemo(() => (bills || []).filter((b: any) => (b.fulfillmentType || 'dine_in') === 'takeaway' && b.status !== 'paid' && b.status !== 'cancelled'), [bills]);

  const stats = useMemo(() => ({
    total: list.length,
    draft: list.filter((b: any) => b.status === 'draft').length,
    partial: list.filter((b: any) => b.status === 'partial').length,
    remaining: list.reduce((s: number, b: any) => s + (Number(b.remaining) || 0), 0),
    revenue: list.reduce((s: number, b: any) => s + (Number(b.total) || 0), 0),
  }), [list]);

  // بوابة التعديل: أي دخول لنافذة الأصناف/النقل يتطلب صلاحية تعديل التيك أوي
  const guardTakeawayEdit = (fn: (b: any) => void) => (b: any) => {
    if (!canEditTakeaway(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    fn(b);
  };
  // بوابة الدفع الجزئي (دفع أصناف) للتيك أوي
  const guardTakeawayPartial = (fn: (b: any) => void) => (b: any) => {
    if (!canPayPartialTakeaway(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    fn(b);
  };

  const handleCreate = () => {
    if (!canCreateTakeaway(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    // Local draft only — the server bill is created at first save inside the items window.
    const draftId = `draft-${Date.now()}`;
    setBillToEdit({
      __isDraft: true,
      _id: draftId,
      id: draftId,
      fulfillmentType: 'takeaway',
      billType: 'cafe',
      orders: [],
      subtotal: 0,
      total: 0,
      discount: 0,
      paid: 0,
      remaining: 0,
      status: 'draft',
    } as any);
  };

  // تحصيل مباشر مع تأكيد داخل الكارت (بلا نافذة دفع).
  const collectInflight = useRef<Set<string>>(new Set());
  const handleCollect = async (bill: any, method: string, drawer: string = 'takeaway') => {
    if (!canPayFullTakeaway(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    const amount = Number(bill.remaining) || 0;
    if (amount <= 0) return;
    const id = bill._id || bill.id;
    const idStr = String(id);
    if (collectInflight.current.has(idStr)) return;
    collectInflight.current.add(idStr);
    setBills((prev: any[]) => prev.map((b: any) => {
      if (String(b._id || b.id) !== String(id)) return b;
      const paid = (Number(b.paid) || 0) + amount;
      const remaining = Math.max(0, (Number(b.total) || 0) - paid);
      return { ...b, paid, remaining, status: remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : b.status };
    }));
    try {
      const res: any = await (api as any).addPayment(id, { amount, method, drawer, reference: method === 'e_wallet' ? t('takeaway.payment.eWalletReference') : undefined });
      applyBill(id, res?.success ? res.data : null);
      if (res?.success) showNotification(t('takeaway.notifications.collected'), 'success');
      // أتمتة الطباعة حسب نوع الفاتورة (تيك أوي) — عند اكتمال السداد
      await autoPrintPaidBill(res?.success ? res.data : null);
    } catch (e: any) { showNotification(e?.message || t('takeaway.notifications.collectFailed'), 'error'); refreshSingleBill?.({ _id: id }); }
    finally { collectInflight.current.delete(idStr); }
  };

  // ── نافذة إدارة الدفع (تفتح حتى للمدفوع بالكامل) ──
  const [manageBill, setManageBill] = useState<any | null>(null);
  const [mPayAmount, setMPayAmount] = useState('');
  const [mPayRef, setMPayRef] = useState('');
  const [mProcessing, setMProcessing] = useState(false);
  const manageId = manageBill ? String(manageBill._id || manageBill.id) : '';
  const openManage = (b: any) => { setManageBill(b); setMPayAmount(String(Number(b?.remaining) || '')); setMPayRef(''); };
  const handleManageSubmit = async () => {
    const b = manageBill;
    if (!b) return;
    if (!canPayFullTakeaway(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    const amount = Number(mPayAmount) || 0;
    if (amount <= 0) return;
    const method = payMethods[manageId] || 'cash';
    const drawer = payDrawers[manageId] || 'takeaway';
    setMProcessing(true);
    try {
      const res: any = await (api as any).addPayment(b._id || b.id, { amount, method, drawer, reference: method === 'e_wallet' ? t('takeaway.payment.eWalletReference') : undefined });
      applyBill(b._id || b.id, res?.success ? res.data : null);
      if (res?.success) {
        setManageBill(res.data);
        setMPayAmount(String(Number(res.data?.remaining) || ''));
        showNotification(t('takeaway.notifications.collected'), 'success');
        // أتمتة الطباعة حسب النوع — عند اكتمال السداد فقط
        await autoPrintPaidBill(res.data);
      }
    } catch (e: any) { showNotification(e?.message || t('takeaway.notifications.collectFailed'), 'error'); refreshSingleBill?.({ _id: b._id || b.id }); }
    finally { setMProcessing(false); }
  };

  // ── الدفع المقسوم بطريقتين (نفس نافذة الطاولة) ──
  const handleTakeawaySplit = async (amount2: string, method2: string) => {
    const b = manageBill;
    if (!b) return;
    if (!canPayFullTakeaway(user)) { showNotification(t('common.permissionDenied'), 'error'); return; }
    const a1 = Number(mPayAmount) || 0;
    const a2 = Number(amount2) || 0;
    if (!(a1 > 0) || !(a2 > 0)) return;
    const method1 = payMethods[manageId] || 'cash';
    if (method1 === method2) { showNotification(t('billing.splitPayDifferentMethods'), 'error'); return; }
    const drawer = payDrawers[manageId] || 'takeaway';
    const id = b._id || b.id;
    setMProcessing(true);
    try {
      const r1: any = await (api as any).addPayment(id, { amount: a1, method: method1, drawer });
      const r2: any = await (api as any).addPayment(id, { amount: a2, method: method2, drawer });
      const nb = r2?.success ? r2.data : r1?.data;
      applyBill(id, nb || null);
      if (nb) {
        setManageBill(nb);
        setMPayAmount(String(Number(nb?.remaining) || ''));
        showNotification(t('takeaway.notifications.collected'), 'success');
        // أتمتة الطباعة حسب النوع — عند اكتمال السداد فقط
        await autoPrintPaidBill(nb);
      }
    } catch (e: any) { showNotification(e?.message || t('takeaway.notifications.collectFailed'), 'error'); refreshSingleBill?.({ _id: id }); }
    finally { setMProcessing(false); }
  };

  const handleWhatsApp = (bill: any) => {
    const phone = String(bill.customerPhone || '').replace(/[^0-9]/g, '');
    if (!phone) { showNotification(t('takeaway.notifications.noPhone'), 'warning'); return; }
    const lines = [t('takeaway.whatsapp.billLine', { shortId: String(bill.billNumber || bill._id).slice(-6) }), t('takeaway.whatsapp.totalLine', { total: (bill.total || 0).toFixed(2) }), t('takeaway.whatsapp.paidLine', { paid: (bill.paid || 0).toFixed(2), remaining: (bill.remaining || 0).toFixed(2) }), t('takeaway.whatsapp.thanks')];
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-2.5 sm:p-6 space-y-4 sm:space-y-5">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-orange-100 dark:border-gray-700 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow text-white text-xl sm:text-2xl flex-shrink-0">🥡</div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white">{t('takeaway.title')}</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('takeaway.summary', { total: stats.total, revenue: stats.revenue.toFixed(2) })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => { const v = compact ? 'comfortable' : 'compact'; setDensity(v); try { localStorage.setItem('takeawayDensity', v); } catch {} }} title={t('takeaway.toggleView')} className="px-3 py-2 text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300">
              {compact ? t('takeaway.view.comfortable') : t('takeaway.view.compact')}
            </button>
            {canCreateTakeaway(user) && (
              <button onClick={handleCreate} className="flex-1 sm:flex-none px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-bold shadow flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" /> {t('takeaway.newOrder')}
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: t('takeaway.stats.all'), value: stats.total, color: 'gray' },
            { label: t('takeaway.stats.new'), value: stats.draft, color: 'blue' },
            { label: t('takeaway.stats.partial'), value: stats.partial, color: 'amber' },
            { label: t('takeaway.stats.remaining'), value: stats.remaining.toFixed(0), color: 'green' },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center border border-gray-100 dark:border-gray-600">
              <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
              <div className="text-xl font-extrabold text-gray-900 dark:text-white">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 p-3 flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5">
          {([['unpaid', t('takeaway.filters.unpaid')], ['paid', t('takeaway.filters.paid')], ['all', t('takeaway.filters.all')]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setBillFilter(v)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors ${billFilter === v ? 'bg-green-600 text-white border-green-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto relative w-full sm:w-64">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('takeaway.searchPlaceholder')} className="w-full pr-9 pl-9 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none text-gray-900 dark:text-gray-100" />
          {feed.refreshing && debouncedSearch.trim() ? (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          ) : search ? (
            <button onClick={() => setSearch('')} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none" title={t('takeaway.search.clear')}>×</button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {feed.items.map((bill: any) => (
          <div key={String(bill._id || bill.id)}>
            <BillTableCard bill={bill} kind="takeaway" compact={compact} showPhone={canViewCustomerContacts(user)}
              method={payMethods[String(bill._id || bill.id)] || 'cash'} onMethodChange={(m) => setPayMethods(p => ({ ...p, [String(bill._id || bill.id)]: m }))}
              drawer={payDrawers[String(bill._id || bill.id)] || 'takeaway'} onDrawerChange={(d) => setPayDrawers(p => ({ ...p, [String(bill._id || bill.id)]: d }))}
              canEdit={canEditTakeaway(user)}
              canPayFull={canPayFullTakeaway(user)} canPayPartial={canPayPartialTakeaway(user)}
              onOpen={guardTakeawayEdit(setBillToEdit)} onAddItems={guardTakeawayEdit(setBillToEdit)} onEditItems={guardTakeawayEdit(setBillToEdit)}
              onCollect={handleCollect} onPrint={handlePrint} onMove={(b: any) => { if (!canMoveBillTakeawayToTable(user)) { showNotification(t('common.permissionDenied'), 'error'); return; } guardTakeawayEdit(setMoveBill)(b); }} onPayItems={guardTakeawayPartial(setPayItemsBill)} onManage={openManage}
              onPrepPrint={handlePrepPrint}
              onWhatsApp={handleWhatsApp} onDelete={handleDelete} />
          </div>
        ))}
        {feed.items.length===0 && !feed.refreshing && !feed.loading && <div className="col-span-full text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400">{debouncedSearch.trim() ? t('takeaway.empty.searchNoResults', { query: debouncedSearch.trim() }) : t('takeaway.empty.noOrders')}</div>}
      </div>
      <div ref={feed.sentinelRef} className="h-2" />
      {feed.loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 animate-pulse">
              <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-9 w-full bg-gray-200 dark:bg-gray-700 rounded-xl" />
            </div>
          ))}
        </div>
      )}
      {feed.error && (
        <div className="text-center py-3">
          <span className="text-sm text-red-500">{feed.error}</span>
          <button onClick={() => feed.loadMore()} className="ml-2 text-sm font-bold text-blue-600 underline">{t('takeaway.retry')}</button>
        </div>
      )}
      {!feed.hasMore && feed.items.length > 0 && (
        <div className="text-center text-xs text-gray-400 py-2">{t('takeaway.listEnd', { total: feed.total })}</div>
      )}
      {payItemsBill && (
        <ItemPartialPayModal
          bill={payItemsBill}
          onClose={() => setPayItemsBill(null)}
          onSuccess={(updated: any) => { applyBill(updated?._id || updated?.id || payItemsBill?._id, updated); setPayItemsBill(null); }}
          canEditPaid={canPayPartialTakeaway(user)}
          onRefreshBill={(updated: any) => { if (updated) { applyBill(updated?._id || updated?.id || payItemsBill?._id, updated); setPayItemsBill(updated); } }}
        />
      )}
      {manageBill && (
        <PaymentManagementModal
          isOpen={!!manageBill}
          selectedBill={manageBill}
          user={user}
          paymentAmount={mPayAmount} setPaymentAmount={setMPayAmount}
          paymentMethod={(payMethods[manageId] || 'cash') as PaymentMethod} setPaymentMethod={(m: PaymentMethod) => setPayMethods(p => ({ ...p, [manageId]: m }))}
          paymentDrawer={(payDrawers[manageId] || 'takeaway') as CashDrawer} setPaymentDrawer={(d: CashDrawer) => setPayDrawers(p => ({ ...p, [manageId]: d }))}
          paymentReference={mPayRef} setPaymentReference={setMPayRef}
          isProcessingPayment={mProcessing}
          handlePaymentSubmit={handleManageSubmit}
          onSplitSubmit={handleTakeawaySplit}
          handlePartialPayment={async (b: any) => { setManageBill(null); setPayItemsBill(b); }}
          handleEndSession={async () => {}}
          handleEditItemPayment={() => { const b = manageBill; setManageBill(null); if (b) setPayItemsBill(b); }}
          handleClosePaymentModal={() => setManageBill(null)}
          setShowCancelConfirmModal={(v: boolean) => { if (v && manageBill) { const b = manageBill; setManageBill(null); void handleDelete(b); } }}
          setShowChangeTableModal={(v: boolean) => { if (v && manageBill) { const b = manageBill; setManageBill(null); guardTakeawayEdit(setMoveBill)(b); } }}
          setNewTableNumber={() => {}}
          setShowSessionPaymentModal={() => {}}
          setShowPaymentModal={(v: boolean) => { if (!v) setManageBill(null); }}
          setActiveTab={() => {}} setActiveTab3={() => {}}
          getSessionCost={() => 0}
          formatCurrency={(n: number) => formatCurrencyUtil(Number(n) || 0, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}
          showNotification={showNotification}
        />
      )}
      {prepSelection && (
        <OrderPrintSectionsModal
          billLabel={(prepSelection.bill as any)?.billNumber ? getShortBillNumber((prepSelection.bill as any).billNumber) : String((prepSelection.bill as any)?._id || '').slice(-6)}
          sections={prepSelection.sections}
          selected={prepSelected}
          onToggle={(id) => setPrepSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
          onToggleAll={() => setPrepSelected((cur) => (cur.length === prepSelection.sections.length ? [] : prepSelection.sections.map((s) => s.id)))}
          onConfirm={confirmPrepPrint}
          onClose={() => setPrepSelection(null)}
        />
      )}
      {moveBill && (
        <ChangeTableModal
          billLabel={moveBill.billNumber ? getShortBillNumber(moveBill.billNumber) : String(moveBill._id).slice(-6)}
          tables={tables || []}
          getSectionName={(t: any) => (typeof t.section === 'object' ? t.section?.name : '') || ''}
          changing={false}
          onConfirm={(id) => handleMoveToTable(String(id))}
          onClose={() => setMoveBill(null)}
        />
      )}
      <BillItemsEditModal
        isOpen={!!billToEdit}
        onClose={closeItemsModal}
        bill={billToEdit}
        onSaveAndManage={openManage}
        menuItems={menuItems || []}
        menuSections={menuSections || []}
        menuCategories={menuCategories || []}
        onSuccess={(updated: any) => {
          const nid = String(updated?._id || updated?.id || '');
          applyBill(nid, updated);
          if (updated) {
            setBills((prev: any[]) => prev.some((b: any) => String(b._id || b.id) === nid) ? prev : [updated, ...prev]);
            if (updated.status !== 'paid' && updated.status !== 'cancelled') feedRef.current?.prepend(updated);
          }
          setBillToEdit(null);
        }}
        onPrepPrint={handlePrepPrint}
        printBothTogether={printBoth}
      />
    </div>
  );
};
export default Takeaway;
