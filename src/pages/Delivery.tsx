import { useState, useEffect, useMemo, memo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTranslation } from 'react-i18next';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../utils/apiBase';
import api from '../services/api';
import { Bill } from '../services/api';
import { printBill } from '../utils/printBill';
import BillItemsEditModal from '../components/tables/BillItemsEditModal';
import BillTableCard from '../components/tables/BillTableCard';
import { getShortBillNumber, localeTag } from '../utils/formatters';
import ChangeTableModal from '../components/tables/ChangeTableModal';
import OrderPrintSectionsModal from '../components/tables/OrderPrintSectionsModal';
import { startBillPrep, confirmBillPrep } from '../utils/orderSectionPrint';
import ItemPartialPayModal from '../components/tables/ItemPartialPayModal';
import { canDeleteBill, canApplyManualDiscount, canMoveBillDeliveryToTable, canCreateDelivery, canEditDelivery, canPayFullDelivery, canPayPartialDelivery } from '../utils/permissionHelper';
import { Search, Plus, Phone, User } from 'lucide-react';
import { isSoundEnabled, playWarnBeep, playDangerBeep } from '../utils/sound';
import { canViewCustomerContacts } from '../utils/permissionHelper';
import { isMobileDevice } from '../utils/deviceDetect';
import {
  type DeviceCustomer,
  loadDeviceCustomers,
  saveDeviceCustomer,
  phoneMatches,
  digitsOf,
  canonicalPhone,
  partialVariants,
  scorePhoneVariants,
} from '../utils/customerLookup';
import { toast } from 'react-toastify';
import { useInfiniteList } from '../hooks/useInfiniteList';

// In-app notice (replaces blocking browser alert): error by default.
const palert = (msg: string, ok = false) => (ok ? toast.success(msg) : toast.error(msg));

const fmtDT = (d: any) => { try { return new Date(d).toLocaleString(localeTag()); } catch { return ''; } };
const mins = (a: any, b: any) => {
  const x = new Date(a).getTime(); const y = new Date(b).getTime();
  if (isNaN(x) || isNaN(y) || y < x) return null;
  return Math.round((y - x) / 60000);
};

const buildWhatsAppText = (bill: any, t: (key: string, opts?: any) => string, orgName?: string) => {
  const lines: string[] = [];
  if (orgName) lines.push(orgName);
  lines.push(t('delivery.whatsapp.invoiceTitle', { id: String(bill.billNumber || bill._id).slice(-6) }), t('delivery.whatsapp.date', { date: fmtDT(bill.createdAt) }));
  const orders = Array.isArray(bill.orders) ? bill.orders : [];
  let n = 0;
  for (const o of orders) {
    const items = Array.isArray((o as any)?.items) ? (o as any).items : [];
    for (const it of items) {
      if (n >= 12) break;
      lines.push(`- ${it.name || ''} × ${it.quantity || 1} = ${((it.price || 0) * (it.quantity || 1)).toFixed(2)}`);
      n++;
    }
  }
  // الإجمالي المطلوب فقط — بلا مدفوع/متبقي.
  lines.push(t('delivery.whatsapp.total', { total: (bill.total || 0).toFixed(2) }));
  if (bill.deliveryInfo?.address) lines.push(t('delivery.whatsapp.address', { address: bill.deliveryInfo.address }));
  lines.push(t('delivery.whatsapp.thanks'));
  return lines.join('\n');
};

// فتح واتساب مباشرة: التطبيق على الموبايل (whatsapp://)، والمتصفح/التطبيق على الديسكتوب (wa.me).
const openWhatsAppChat = (phone: string, text: string) => {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return false;
  const encoded = encodeURIComponent(text);
  try {
    if (isMobileDevice()) {
      window.location.href = `whatsapp://send?phone=${digits}&text=${encoded}`;
    } else {
      window.open(`https://wa.me/${digits}?text=${encoded}`, '_blank', 'noopener');
    }
    return true;
  } catch {
    return false;
  }
};


// شريط مالي صغير تحت كارت الطاولة الموحد (جزئي/خصم/دفع أصناف)
const FinanceStrip = memo(({ bill, method, onPartial, onDiscount, onPayItems }: {
  bill: any; method: string;
  onPartial: (b: any, amount: number, method: string) => void;
  onDiscount: (b: any, discount: number, type: 'amount' | 'percent') => void;
  onPayItems: (b: any) => void;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [partAmount, setPartAmount] = useState('');
  const [disc, setDisc] = useState('');
  const [discType, setDiscType] = useState<'amount' | 'percent'>('percent');
  const remaining = Number(bill.remaining) || 0;
  // حساب إجمالي الخصومات من الطلبات
  const totalFixedDiscount = (bill.orders || []).reduce((sum: number, order: any) => sum + (order?.fixedDiscount?.amount || 0), 0);
  const billDiscount = Number(bill.discount) || 0;
  const totalAllDiscounts = totalFixedDiscount + billDiscount;
  if (remaining <= 0 && totalAllDiscounts <= 0) return null;
  return (
    <div className="mt-1 space-y-1">
      {totalAllDiscounts > 0 && (
        <div className="flex items-center justify-between px-2 py-1 text-[11px] bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <span className="text-purple-600 dark:text-purple-400 font-bold">{t('delivery.finance.discounts')}</span>
          <span className="text-purple-700 dark:text-purple-300 font-bold">{t('delivery.finance.discountValue', { value: totalAllDiscounts.toLocaleString(localeTag()) })}</span>
        </div>
      )}
      <button onClick={() => setOpen(v => !v)} className="w-full py-1 text-[11px] font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-500">{t('delivery.finance.toggle')}</button>
      {open && (
        <div className="mt-1 p-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 space-y-1.5">
          <div className="flex gap-1">
            <input type="number" min="1" placeholder={t('delivery.finance.partialPlaceholder', { remaining: remaining.toFixed(0) })} value={partAmount} onChange={e => setPartAmount(e.target.value)} className="flex-1 px-2 py-1.5 text-xs border rounded-lg bg-white dark:bg-gray-700" />
            <button onClick={() => { const a = Number(partAmount); if (a > 0) { onPartial(bill, a, method); setPartAmount(''); } }} className="px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg">{t('delivery.finance.pay')}</button>
          </div>
          <div className="flex gap-1">
            <button onClick={() => onPayItems(bill)} className="flex-1 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">{t('delivery.finance.payItems')}</button>
          </div>
        </div>
      )}
    </div>
  );
});
FinanceStrip.displayName = 'FinanceStrip';

const loadZonesLocal = (): Array<{ name: string; fee: number }> => {
  try { const r = JSON.parse(localStorage.getItem('deliveryZones') || '[]'); return Array.isArray(r) ? r : []; } catch { return []; }
};

// دليل عملاء هذا الجهاز فقط: كل عميل يُطلب له مرة يُحفظ محلياً ويُقترح عند الكتابة.
const billMatchesQuery = (b: any, query: string): boolean => {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return true;
  const fields = [
    b?.billNumber, b?.customerName, b?.notes,
    b?.deliveryInfo?.customerName, b?.deliveryInfo?.address,
  ];
  if (fields.some((f) => String(f || '').toLowerCase().includes(needle))) return true;
  // الهاتف: مقارنة مرنة بالأرقام فقط (فواصل + كود دولة)
  if (phoneMatches(b?.customerPhone, needle) || phoneMatches(b?.deliveryInfo?.phone, needle)) return true;
  const orders = Array.isArray(b?.orders) ? b.orders : [];
  // رقم الطلب أو اسم الصنف داخل الطلبات
  return orders.some((o: any) => {
    if (String(o?.orderNumber || '').toLowerCase().includes(needle)) return true;
    return Array.isArray(o?.items) && o.items.some((it: any) => String(it?.name || '').toLowerCase().includes(needle));
  });
};

const Delivery = () => {
  const { bills, fetchBills, setBills, refreshSingleBill, user, tables, menuItems, menuSections, menuCategories, fetchMenuItems, fetchMenuSections, fetchMenuCategories } = useApp() as any;
  const { t, i18n } = useTranslation();
  const [moveBill, setMoveBill] = useState<any | null>(null);
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
      if (r.status === 'error') { palert(r.message); return; }
      if (r.status === 'prompt') {
        setPrepSelected(r.sections.map((s) => s.id));
        setPrepSelection({ bill, orders: r.orders, sections: r.sections, menuItemsMap: r.menuItemsMap });
      }
    } catch { palert(t('delivery.notifications.prepPrintFailed')); }
  };
  const confirmPrepPrint = async () => {
    if (!prepSelection || prepSelected.length === 0) return;
    const sel = prepSelection;
    setPrepSelection(null);
    try {
      const r = await confirmBillPrep(sel.orders, prepSelected, sel.menuItemsMap, prepCtx());
      if (r.printed === 0) palert(t('delivery.notifications.noMatchingSections'));
      else palert(t('delivery.notifications.sentToPrint', { count: r.printed }), true);
    } catch { palert(t('delivery.notifications.prepPrintFailed')); }
  };

  const handlePrint = async (bill: any) => {
    try {
      // ختم الخروج تلقائياً عند أول طباعة (يغذي التحليلات) ثم اطبع
      let full: any = bill;
      if ((bill.deliveryInfo?.status || 'preparing') === 'preparing') {
        full = (await updateStatus(bill, 'out_for_delivery')) || { ...bill, deliveryInfo: { ...(bill.deliveryInfo || {}), status: 'out_for_delivery' } };
      }
      await printBill(full, (user as any)?.organizationName, i18n.language, t);
    } catch (e: any) { palert(e?.message || t('delivery.notifications.printFailed')); }
  };

  // نقل فاتورة دليفري/تيك أوي إلى طاولة — نفس معاملة الطاولات (دمج لو مشغولة، نقل لو فارغة)
  const handleMoveToTable = async (tableId: string) => {
    if (!moveBill) return;
    const id = moveBill._id || moveBill.id;
    try {
      const res: any = await (api as any).updateBill(id, { table: tableId, fulfillmentType: 'dine_in' });
      setMoveBill(null);
      setBills((prev: any[]) => prev.filter((b: any) => String(b._id || b.id) !== String(id)));
      feedRef.current?.remove(String(id));
        palert(res?.message || t('delivery.notifications.movedToTable'), true);
      void fetchBills();
    } catch (e: any) { palert(e?.message || t('delivery.notifications.moveFailed')); }
  };
  const canSeeContacts = canViewCustomerContacts(user);

  // تحديث فاتورة واحدة لحظياً (optimistic + تأكيد) بدل جلب المئات كل مرة —
  // يحدّث السياق العام (للطاولات) وقائمة العرض الصفحية معاً.
  const applyBill = (id: any, updated: any) => {
    const sid = String(id);
    if (updated) {
      setBills((prev: any[]) => prev.map((b: any) => String(b._id || b.id) === sid ? updated : b));
      // القائمة غير المدفوعة فقط: المدفوعة/الملغاة تخرج من العرض
      if (updated.status === 'paid' || updated.status === 'cancelled') feedRef.current?.remove(sid);
      else feedRef.current?.upsert(updated);
    } else if (refreshSingleBill) refreshSingleBill({ _id: id });
  };
  const [autoPrint, setAutoPrint] = useState(() => { try { return localStorage.getItem('deliveryAutoPrint') !== '0'; } catch { return true; } });
  const [density, setDensity] = useState(() => { try { return localStorage.getItem('deliveryDensity') || 'comfortable'; } catch { return 'comfortable'; } });
  const compact = density === 'compact';
  // لوحة الإحصائيات مطوية افتراضيًا — الطلبات أول الشاشة
  const [dashOpen, setDashOpen] = useState(() => { try { return localStorage.getItem('deliveryDashOpen') === '1'; } catch { return false; } });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [billFilter, setBillFilter] = useState<'unpaid' | 'paid' | 'all'>('unpaid');
  const billFilterRef = useRef(billFilter);
  billFilterRef.current = billFilter;
  const searchRef = useRef('');
  searchRef.current = debouncedSearch;
  // فلتر مرحلة التوصيل: الكل / جديد / في الطريق / تم
  const [deliveryStatus, setDeliveryStatus] = useState<'all' | 'preparing' | 'out_for_delivery' | 'delivered'>('all');
  const deliveryStatusRef = useRef(deliveryStatus);
  deliveryStatusRef.current = deliveryStatus;
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ customerName: '', phone: '', address: '', deliveryFee: '', zone: '' });
  const [zones, setZones] = useState<Array<{ _id?: string; name: string; fee: number }>>([]);
  const [newZone, setNewZone] = useState({ name: '', fee: '' });
  const [lockedZone, setLockedZone] = useState('');
  const [editingZone, setEditingZone] = useState<any>(null);
  // سجل عملاء موحد (السيرفر) + محلي — نتائج مختلطة بالترتيب، مفتاح واحد للرقم.
  const [serverCustHits, setServerCustHits] = useState<DeviceCustomer[]>([]);
  useEffect(() => {
    const phoneQ = draft.phone.trim();
    const nameQ = draft.customerName.trim();
    const hasPhone = phoneQ.replace(/\D/g, '').length >= 2;
    const hasName = nameQ.length >= 2;
    if (!hasPhone && !hasName) {
      setServerCustHits([]);
      return;
    }
    // نسأل السيرفر بهاتف أو اسم — كل واحد على حدة ثم ندمج (السيرفر يبحث بنفس السلسلة في الاسم/العنوان/الرقم).
    const q = hasPhone ? phoneQ : nameQ;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/delivery-customers/search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
          signal: ctrl.signal,
        });
        const j: any = await res.json().catch(() => null);
        if (j?.success && Array.isArray(j.data)) {
          setServerCustHits(
            j.data.map((d: any) => ({
              name: d.customerName || '',
              phone: d.phone || '',
              address: d.address || '',
              count: d.orderCount || 1,
              lastUsed: d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now(),
            }))
          );
        }
      } catch {}
      // إن كان هناك هاتف واسم معاً، اسأل بالثاني أيضاً وادمج (يغطي بحث الاسم عند كتابة الهاتف).
      if (hasPhone && hasName) {
        try {
          const res2 = await fetch(`${API_BASE_URL}/api/delivery-customers/search?q=${encodeURIComponent(nameQ)}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
          });
          const j2: any = await res2.json().catch(() => null);
          if (j2?.success && Array.isArray(j2.data)) {
            setServerCustHits((prev) => {
              const seen = new Set(prev.map((c) => String(c.phone).replace(/\D/g, '')));
              const extra = j2.data
                .map((d: any) => ({
                  name: d.customerName || '',
                  phone: d.phone || '',
                  address: d.address || '',
                  count: d.orderCount || 1,
                  lastUsed: d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now(),
                }))
                .filter((c: any) => !seen.has(String(c.phone).replace(/\D/g, '')));
              return [...prev, ...extra];
            });
          }
        } catch {}
      }
    }, 320);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [draft.phone, draft.customerName]);
  // مناطق مشتركة من السيرفر (كل الأجهزة) — محلي كاحتياطي عند انقطاعه
  const fetchZones = async () => {
    try {
      const res: any = await (api as any).getDeliveryZones();
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        setZones(res.data);
        try { localStorage.setItem('deliveryZones', JSON.stringify(res.data)); } catch {}
        return;
      }
    } catch {}
    setZones(loadZonesLocal());
  };
  useEffect(() => {
    fetchZones();
  }, []);
  // تحديث لحظي لمناطق التوصيل عند تعديلها من أي جهاز (LAN/Atlas)
  const zonesSocketRef = useRef<Socket | null>(null);
  useEffect(() => {
    try {
      const socketUrl = API_BASE_URL.replace(/\/api\/?$/, '');
      const socket: Socket = io(socketUrl, {
        path: '/socket.io/',
        auth: { token: localStorage.getItem('token') || undefined },
        transports: ['websocket', 'polling'],
        reconnection: true,
      });
      zonesSocketRef.current = socket;
      const onZonesChanged = () => { fetchZones(); };
      socket.on('delivery-zones-changed', onZonesChanged);
      socket.on('lan:remote-change', (evt: any) => {
        if (evt?.collection === 'deliveryzones') fetchZones();
      });
      // ── دمج فواتير الدليفري لحظياً (إنشاء/تحديث/حذف) دون إعادة الصفحات ──
      const feedMatches = (b: any) => {
        if (!b || (b.fulfillmentType || 'dine_in') !== 'delivery') return false;
        if (!billMatchesQuery(b, searchRef.current)) return false;
        const f = billFilterRef.current;
        const searching = searchRef.current.trim().length > 0;
        if (f === 'paid') { if (b.status !== 'paid') return false; }
        else if (f === 'all' || searching) { /* أي حالة دفع أثناء البحث */ }
        else if (['paid', 'cancelled'].includes(b.status)) return false;
        const ds = deliveryStatusRef.current;
        if (ds !== 'all' && (b.deliveryInfo?.status || 'preparing') !== ds) return false;
        return true;
      };
      const onCreated = (b: any) => { try { if (b && feedMatches(b)) feedRef.current?.prepend(b); } catch {} };
      const onUpdated = (b: any) => {
        try {
          if (!b) return;
          const id = String(b._id || b.id || '');
          if (!id) return;
          if (feedMatches(b)) feedRef.current?.upsert(b);
          else feedRef.current?.remove(id);
        } catch {}
      };
      const onDeleted = (b: any) => {
        try {
          const id = String(b?._id || b?.id || b || '');
          if (id) feedRef.current?.remove(id);
        } catch {}
      };
      const onBillUpdate = (evt: any) => {
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
      return () => {
        try {
          socket.off('delivery-zones-changed', onZonesChanged);
          socket.off('lan:remote-change');
          socket.off('bill:created', onCreated);
          socket.off('bill:updated', onUpdated);
          socket.off('bill:deleted', onDeleted);
          socket.off('bill-update', onBillUpdate);
          socket.disconnect();
        } catch {}
        zonesSocketRef.current = null;
      };
    } catch {
      return;
    }
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
  const [loyal, setLoyal] = useState<any | null>(null);
  const [billToEdit, setBillToEdit] = useState<any | null>(null);
  // خيار الطباعة المزدوجة (تحضير + فاتورة) الخاص بالدليفري من إعدادات الطباعة
  const [printBoth, setPrintBoth] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { loadPrintBothFlag } = await import('../utils/printPrefs');
        const v = await loadPrintBothFlag('printBothDelivery');
        if (alive) setPrintBoth(v);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);
  const [payMethods, setPayMethods] = useState<Record<string, string>>({});
  const [payDrawers, setPayDrawers] = useState<Record<string, string>>({});

  // No server bill exists until first save — closing without saving discards the draft locally.
  const closeItemsModal = () => {
    setBillToEdit(null);
  };

  // نفس معاملة حذف فواتير الطاولات: فحص صلاحية أولاً ثم حذف متفائل + مزامنة خلفية
  const handleDelete = async (bill: any) => {
    if (!canDeleteBill(user)) { palert(t('delivery.notifications.unauthorizedDelete')); return; }
    const id = bill._id || bill.id;
    setBills((prev: any[]) => prev.filter((b: any) => String(b._id || b.id) !== String(id)));
    feedRef.current?.remove(String(id));
    try {
      const res: any = await (api as any).deleteBill(id);
      if (res?.success) {
        palert(t('delivery.notifications.deletedSuccess'), true);
        void fetchBills();
      } else {
        palert(t('delivery.notifications.deleteFailed'));
        refreshSingleBill?.({ _id: id });
      }
    } catch (e: any) { palert(e?.message || t('delivery.notifications.deleteError')); refreshSingleBill?.({ _id: id }); }
  };
  useEffect(() => {
    (async () => {
      try {
        if (!menuItems?.length) await fetchMenuItems?.();
        if (!menuSections?.length) await fetchMenuSections?.();
        if (!menuCategories?.length) await fetchMenuCategories?.();
      } catch {}
    })();
  }, []);
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 150); return () => clearTimeout(t); }, [search]);

  // ── Infinite scroll من السيرفر (25/صفحة) بدل الجلب الكامل ──
  const feed = useInfiniteList<any>({
    pageSize: 25,
    depsKey: `${debouncedSearch.trim()}|${billFilter}|${deliveryStatus}`,
    getId: (b: any) => String(b?._id || b?.id || ''),
    fetchPage: async (pageNum, limitNum) => {
      const searching = debouncedSearch.trim().length > 0;
      const res: any = await (api as any).getBills({
        fulfillmentType: 'delivery',
        // أثناء البحث: ابحث في كل الحالات (المدفوع أيضاً) — الفلتر الصريح 'مدفوعة' يبقى كما هو
        status: billFilter === 'paid' ? 'paid' : (billFilter === 'all' || searching) ? undefined : 'draft,partial,overdue',
        all: (billFilter === 'all' || searching) ? true : undefined,
        deliveryStatus: deliveryStatus === 'all' ? undefined : deliveryStatus,
        q: debouncedSearch.trim() || undefined,
        page: pageNum,
        limit: limitNum,
        mode: 'list',
      });
      if (res && res.success === false) throw new Error(res.message || t('delivery.notifications.searchFailed'));
      return { items: res?.data || [], total: res?.total ?? 0, hasMore: res?.hasMore ?? false };
    },
  });
  const feedRef = useRef<any>(null);
  feedRef.current = feed;

  useEffect(() => { fetchBills(); }, [fetchBills]);
  const userRef = useRef(user);
  userRef.current = user;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !(e.target as HTMLElement)?.matches('input,textarea,select')) { e.preventDefault(); if (canCreateDelivery(userRef.current)) setShowForm(true); }
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !(e.target as HTMLElement)?.matches('input,textarea,select')) { e.preventDefault(); document.querySelector<HTMLInputElement>('#delivery-search')?.focus(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // دائماً: غير مدفوع فقط (جديد + جزئي) — المدفوع بالكامل لا يظهر هنا أبداً
  const list: Bill[] = useMemo(() => (bills || []).filter((b: any) => (b.fulfillmentType || 'dine_in') === 'delivery' && b.status !== 'paid' && b.status !== 'cancelled'), [bills]);

  // تنبيه التأخر: فاتورة غير مدفوعة أقدم من 20د تحذير، ومن 45د خطر — كل 30 ثانية
  useEffect(() => {
    const id = setInterval(() => {
      if (!isSoundEnabled()) return;
      const now = Date.now();
      const unpaid = (b: any) => (Number(b.remaining) || 0) > 0;
      const danger = list.some((b: any) => unpaid(b) && now - new Date(b.createdAt).getTime() > 45 * 60000);
      const warn = !danger && list.some((b: any) => unpaid(b) && now - new Date(b.createdAt).getTime() > 20 * 60000);
      if (danger) playDangerBeep(); else if (warn) playWarnBeep();
    }, 30000);
    return () => clearInterval(id);
  }, [list]);

  // القائمة نفسها من السيرفر صفحات (feed) — أما list السياقية فللإحصائيات/الولاء/التنبيه فقط

  const stats = useMemo(() => ({
    total: list.length,
    draft: list.filter((b: any) => b.status === 'draft').length,
    partial: list.filter((b: any) => b.status === 'partial').length,
    paid: list.filter((b: any) => b.status === 'paid').length,
    fees: list.reduce((s: number, b: any) => s + (Number(b.deliveryInfo?.deliveryFee) || 0), 0),
  }), [list]);

  // لوحة متابعة الكاشير — تُحدّث كل دقيقة
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 60000); return () => clearInterval(id); }, []);
  const follow = useMemo(() => {
    const now = Date.now();
    const late = list.filter((b: any) => (Number(b.remaining) || 0) > 0 && now - +new Date(b.createdAt) > 30 * 60000).length;
    return { prep: stats.draft, out: stats.partial, late };
  }, [list, stats]);

  const analytics = useMemo(() => {
    const done = list.filter((b: any) => b.deliveryInfo?.status === 'delivered');
    const preps = done.map((b: any) => mins(b.createdAt, b.deliveryInfo?.outAt || b.updatedAt || b.createdAt)).filter((x): x is number => x !== null && x >= 0 && x < 1440);
    const dels = done.map((b: any) => mins(b.deliveryInfo?.outAt || b.createdAt, b.deliveryInfo?.deliveredAt)).filter((x): x is number => x !== null && x >= 0 && x < 1440);
    const avg = (a: number[]) => (a.length ? (a.reduce((s, x) => s + x, 0) / a.length) : null);
    const ap = avg(preps); const ad = avg(dels);
    const onTime = dels.length ? Math.round((dels.filter(x => x <= 30).length / dels.length) * 100) : null;
    return { avgPrep: ap !== null ? Math.round(ap) : null, avgDel: ad !== null ? Math.round(ad) : null, onTime, n: done.length };
  }, [list]);

  const saveZonesLocal = (z: Array<{ name: string; fee: number }>) => { try { localStorage.setItem('deliveryZones', JSON.stringify(z)); } catch {} };
  const addZone = async () => {
    if (!newZone.name.trim()) return;
    const fee = Number(newZone.fee) || 0;
    const wasEditing: any = editingZone;
    if (wasEditing) {
      if (!wasEditing._id) {
        const z = zones.map(zz => (zz.name === wasEditing.name ? { name: newZone.name.trim(), fee } : zz));
        setZones(z); saveZonesLocal(z);
        setNewZone({ name: '', fee: '' }); setEditingZone(null);
        return;
      }
      try {
        const res: any = await (api as any).updateDeliveryZone(wasEditing._id, { name: newZone.name.trim(), fee });
        if (res?.success && res.data) {
          setZones(prev => prev.map(zz => ((zz._id || zz.name) === (wasEditing._id || wasEditing.name) ? res.data : zz)).sort((a, b) => a.name.localeCompare(b.name, 'ar')));
        } else {
          const z = zones.map(zz => ((zz._id || zz.name) === (wasEditing._id || wasEditing.name) ? { ...zz, name: newZone.name.trim(), fee } : zz));
          setZones(z); saveZonesLocal(z);
        }
      } catch {
        const z = zones.map(zz => ((zz._id || zz.name) === (wasEditing._id || wasEditing.name) ? { ...zz, name: newZone.name.trim(), fee } : zz));
        setZones(z); saveZonesLocal(z);
      }
      setNewZone({ name: '', fee: '' });
      setEditingZone(null);
      return;
    }
    try {
      const res: any = await (api as any).createDeliveryZone({ name: newZone.name.trim(), fee });
      if (res?.success && res.data) { setZones(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name, 'ar'))); }
      else { const z = [...zones, { name: newZone.name.trim(), fee }]; setZones(z); saveZonesLocal(z); }
    } catch { const z = [...zones, { name: newZone.name.trim(), fee }]; setZones(z); saveZonesLocal(z); }
    setNewZone({ name: '', fee: '' });
    setEditingZone(null);
  };
  const removeZone = async (z: any) => {
    setZones(prev => prev.filter(zz => (zz._id || zz.name) !== (z._id || z.name)));
    try { if (z._id) await (api as any).deleteDeliveryZone(z._id); else saveZonesLocal(zones.filter(zz => zz.name !== z.name)); }
    catch { saveZonesLocal(zones.filter(zz => zz.name !== z.name)); }
  };
  const startEditZone = (z: any) => { setEditingZone(z); setNewZone({ name: z.name || '', fee: String(z.fee ?? '') }); };
  const cancelEditZone = () => { setEditingZone(null); setNewZone({ name: '', fee: '' }); };
  // Zone prefix locked inside the address field (visible, not editable)
  const ZONE_SEP = ' - ';
  const stripZonePrefix = (addr: string, zone: string) => {
    if (!zone) return addr;
    const p = zone + ZONE_SEP;
    if (addr.startsWith(p)) return addr.slice(p.length);
    if (addr.startsWith(zone)) return addr.slice(zone.length).replace(/^[\s\-:]+/, '');
    return addr;
  };
  // تجريد أي بادئة منطقة معروفة (وليس الحالية فقط) — يمنع "منطقة - منطقة - عنوان".
  const stripAnyZonePrefix = (addr: string): string => {
    let out = String(addr || '');
    const names = [lockedZone, ...zones.map(z => z.name)].filter(Boolean).sort((a, b) => b.length - a.length);
    let changed = true;
    while (changed) {
      changed = false;
      for (const zn of names) {
        const p = zn + ZONE_SEP;
        if (out.startsWith(p)) { out = out.slice(p.length); changed = true; break; }
        if (out === zn) { out = ''; changed = true; break; }
        if (out.startsWith(zn) && /^[\s\-:]/.test(out.slice(zn.length))) {
          out = out.slice(zn.length).replace(/^[\s\-:]+/, '');
          changed = true;
          break;
        }
      }
    }
    return out;
  };
  const applyAddressLocked = (remainder: string) => {
    setDraft((d) => {
      const full = (lockedZone ? lockedZone + ZONE_SEP : '') + remainder;
      const z = zones.find((zz) => zz.name && full.includes(zz.name));
      const curFee = d.deliveryFee;
      const isAuto = !curFee || zones.some((zz) => String(zz.fee) === curFee);
      return { ...d, address: full, deliveryFee: z && isAuto ? String(z.fee) : d.deliveryFee, zone: z ? z.name : d.zone };
    });
  };
  const selectZone = (zoneName: string) => {
    const z = zones.find((zz) => zz.name === zoneName);
    setDraft((d) => {
      const remainder = stripAnyZonePrefix(d.address);
      return { ...d, zone: zoneName, address: (zoneName ? zoneName + ZONE_SEP : '') + remainder, deliveryFee: z ? String(z.fee) : d.deliveryFee };
    });
    setLockedZone(zoneName);
  };

  // تعبئة تلقائية من سجل العميل بمجرد كتابة الهاتف (مطابقة قياسية عبر صيغ الدولة)
  const knownCustomer = useMemo(() => {
    const digits = digitsOf(draft.phone);
    if (digits.length < 7) return null;
    const qc = canonicalPhone(digits);
    const hist = list.filter((b: any) => canonicalPhone(String(b.deliveryInfo?.phone || b.customerPhone || '')) === qc);
    if (!hist.length) return null;
    const last = hist.sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
    return { count: hist.length, name: last.deliveryInfo?.customerName || last.customerName || '', address: last.deliveryInfo?.address || '', fee: last.deliveryInfo?.deliveryFee || 0 };
  }, [draft.phone, list]);
  const fillKnown = () => {
    if (!knownCustomer) return;
    autoFillRef.current = { phone: digitsOf(draft.phone), name: knownCustomer.name || '', address: knownCustomer.address || '', fee: String(knownCustomer.fee || '') };
    setDraft(d => {
      const remainder = stripZonePrefix(d.address, lockedZone);
      const incoming = lockedZone ? stripAnyZonePrefix(knownCustomer.address || '') : (knownCustomer.address || '');
      const fullKnown = (lockedZone ? lockedZone + ZONE_SEP : '') + incoming;
      return { ...d, customerName: d.customerName || knownCustomer.name, address: remainder ? d.address : fullKnown, deliveryFee: d.deliveryFee || String(knownCustomer.fee || '') };
    });
  };

  // القائمة الموحدة المرتبة (الأقرب أولاً): سجل الفواتير + السيرفر + المحلي مدمجة بالرقم.
  // تُستخدم للعرض وللملء معًا — والملء يأخذ أولها دائمًا عند أي تغيير في الرقم.
  type SugCustomer = { phone: string; name: string; address: string; fee: string; count: number; lastUsed: number };
  const buildSuggestions = (q: string, qn: string, includeExact: boolean): SugCustomer[] => {
    if (q.length < 2 && qn.length < 2) return [];
    const map = new Map<string, SugCustomer>();
    // سجل الفواتير: الأحدث يحدد الاسم/العنوان/الرسوم، والعدد = عدد الفواتير.
    for (const b of (list || [])) {
      const cp = digitsOf((b as any)?.deliveryInfo?.phone || (b as any)?.customerPhone);
      if (!cp) continue;
      const bt = +new Date((b as any)?.createdAt || 0);
      const r = map.get(cp) || { phone: cp, name: '', address: '', fee: '', count: 0, lastUsed: 0 };
      r.count += 1;
      if (bt >= r.lastUsed) {
        r.lastUsed = bt;
        r.name = String((b as any)?.deliveryInfo?.customerName || (b as any)?.customerName || '');
        r.address = String((b as any)?.deliveryInfo?.address || '');
        const bf = (b as any)?.deliveryInfo?.deliveryFee;
        if (bf !== undefined && bf !== null && bf !== '') r.fee = String(bf);
      }
      map.set(cp, r);
    }
    // السجل الموحد (السيرفر): الاسم/العنوان المنقحان أسبقية، والرسوم من الفواتير.
    for (const c of serverCustHits) {
      const key = digitsOf((c as any).phone);
      if (!key) continue;
      const r = map.get(key) || { phone: key, name: '', address: '', fee: '', count: 0, lastUsed: 0 };
      if ((c as any).name) r.name = String((c as any).name);
      if ((c as any).address) r.address = String((c as any).address);
      r.count = Math.max(r.count, Number((c as any).count) || 0);
      r.lastUsed = Math.max(r.lastUsed, Number((c as any).lastUsed) || 0);
      map.set(key, r);
    }
    // المحلي: يكمل الناقص فقط.
    for (const c of loadDeviceCustomers()) {
      const key = digitsOf(c.phone);
      if (!key) continue;
      const r = map.get(key) || { phone: key, name: '', address: '', fee: '', count: 0, lastUsed: 0 };
      if (!r.name && c.name) r.name = c.name;
      if (!r.address && (c as any).address) r.address = String((c as any).address);
      r.count = Math.max(r.count, c.count || 0);
      r.lastUsed = Math.max(r.lastUsed, c.lastUsed || 0);
      map.set(key, r);
    }
    const out: Array<SugCustomer & { score: number }> = [];
    for (const r of map.values()) {
      // أثناء كتابة الرقم: المطابقة بالرقم فقط (اسم قديم في الحقل لا يلوث النتائج).
      // البحث بالاسم يعمل فقط عند عدم وجود أرقام مكتوبة.
      const sc = q.length >= 2 ? scorePhoneVariants(r.phone, q) : null;
      const isExact = sc === -1000;
      const okPhone = sc !== null && (includeExact || !isExact);
      const okName = q.length < 2 && qn.length >= 2 && r.name.includes(qn);
      if (!okPhone && !okName) continue;
      out.push({ ...r, score: sc !== null ? sc : 1000 });
    }
    out.sort((a, b) => a.score - b.score || b.count - a.count || b.lastUsed - a.lastUsed);
    return out;
  };

  const suggestions = useMemo(() => {
    const q = digitsOf(draft.phone);
    const qn = draft.customerName.trim();
    return buildSuggestions(q, qn, false).slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.phone, draft.customerName, serverCustHits, (list || []).length]);

  // آخر تعبئة تلقائية — الحقول المكتوبة يدويًا (تختلف عنها) لا تُمس.
  const autoFillRef = useRef<{ phone: string; name: string; address: string; fee: string } | null>(null);
  // قائمة الاقتراحات لا تظهر إلا وحقل الهاتف مركّز.
  const [phoneFocused, setPhoneFocused] = useState(false);

  const handlePhoneChange = (v: string) => {
    const q = digitsOf(v);
    setDraft((d) => {
      const next = { ...d, phone: v };
      if (q.length < 4) { autoFillRef.current = null; return next; }
      // دائمًا الأول من القائمة المرتبة نفسها المعروضة للمستخدم.
      const best = buildSuggestions(q, '', true)[0];
      if (!best) return next;
      const prev = autoFillRef.current;
      if (!next.customerName.trim() || (!!prev && next.customerName === prev.name)) next.customerName = best.name || next.customerName;
      if (!String(next.deliveryFee || '').trim() || (!!prev && String(next.deliveryFee) === prev.fee)) next.deliveryFee = best.fee || next.deliveryFee;
      // العنوان: المكتوب يدويًا يُحفظ، والمعبأ تلقائيًا يتبع أفضل تطابق — بلا تكرار بادئة أبدًا.
      const remainder = stripZonePrefix(next.address, lockedZone);
      const incoming = lockedZone ? stripAnyZonePrefix(best.address || '') : (best.address || '');
      const prevRaw = prev ? stripAnyZonePrefix(prev.address || '') : null;
      if (!remainder.trim() || (prevRaw !== null && remainder === prevRaw)) {
        next.address = (lockedZone ? lockedZone + ZONE_SEP : '') + incoming;
      }
      autoFillRef.current = { phone: best.phone, name: best.name, address: best.address, fee: best.fee };
      return next;
    });
  };

  // إنشاء سريع: Enter في أي حقل = مسودة محلية + فتح الأصناف مباشرة
  const submitOnEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    }
  };

  // Address fee auto-match now handled inside applyAddressLocked above

  const handleCreate = () => {
    const remainder = stripZonePrefix(draft.address, lockedZone);
    if (!draft.phone.trim() || (!remainder.trim() && !lockedZone && !draft.zone)) { palert(t('delivery.notifications.phoneAddressRequired')); return; }
    const addr = draft.address.trim() || ((lockedZone || draft.zone) ? (lockedZone || draft.zone) + ZONE_SEP : '');
    const custName = draft.customerName.trim() || t('delivery.defaults.customerName');
    // Local draft only — the server bill is created at first save inside the items window.
    const draftId = `draft-${Date.now()}`;
    setShowForm(false);
    setBillToEdit({
      __isDraft: true,
      _id: draftId,
      id: draftId,
      fulfillmentType: 'delivery',
      billType: 'cafe',
      customerName: custName,
      customerPhone: draft.phone.trim(),
      deliveryInfo: { phone: draft.phone.trim(), address: addr, customerName: custName, deliveryFee: Number(draft.deliveryFee) || 0 },
      orders: [],
      subtotal: 0,
      total: 0,
      discount: 0,
      paid: 0,
      remaining: 0,
      status: 'draft',
    } as any);
    setDraft({ customerName: '', phone: '', address: '', deliveryFee: '', zone: '' });
    setLockedZone('');
    setEditingZone(null);
    setNewZone({ name: '', fee: '' });
  };

  // كاتب صامت لحالة التوصيل (ختم تلقائي في الخلفية — بلا أزرار يدوية)
  const updateStatus = async (bill: any, status: string, extra: any = {}) => {
    const id = bill._id || bill.id;
    const di: any = { ...(bill.deliveryInfo || {}), ...extra, status };
    const now = new Date().toISOString();
    if (status === 'out_for_delivery' && !di.outAt) di.outAt = now;
    if (status === 'delivered' && !di.deliveredAt) di.deliveredAt = now;
    setBills((prev: any[]) => prev.map((b: any) => String(b._id || b.id) === String(id) ? { ...b, deliveryInfo: di } : b));
    try {
      const res: any = await (api as any).updateBill(id, { deliveryInfo: di });
      applyBill(id, res?.success ? res.data : null);
      return res?.data || null;
    } catch (e: any) { refreshSingleBill?.({ _id: id }); return null; }
  };

  const optimisticPay = (bill: any, amount: number) => {
    const id = bill._id || bill.id;
    setBills((prev: any[]) => prev.map((b: any) => {
      if (String(b._id || b.id) !== String(id)) return b;
      const paid = (Number(b.paid) || 0) + amount;
      const remaining = Math.max(0, (Number(b.total) || 0) - paid);
      return { ...b, paid, remaining, status: remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : b.status };
    }));
  };

  // بوابة التعديل: أي دخول لنافذة الأصناف/النقل يتطلب صلاحية تعديل الدليفري
  const guardDeliveryEdit = (fn: (b: any) => void) => (b: any) => {
    if (!canEditDelivery(user)) { palert(t('common.permissionDenied')); return; }
    fn(b);
  };
  // بوابة الدفع الجزئي (دفع أصناف) للدليفري
  const guardDeliveryPartial = (fn: (b: any) => void) => (b: any) => {
    if (!canPayPartialDelivery(user)) { palert(t('common.permissionDenied')); return; }
    fn(b);
  };

  // تحصيل مباشر (التأكيد داخل الكارت نفسه — بلا نافذة دفع).
  const handleCollect = async (bill: any, method: string, drawer: string = 'delivery') => {
    if (!canPayFullDelivery(user)) { palert(t('common.permissionDenied')); return; }
    const amount = Number(bill.remaining) || 0;
    if (amount <= 0) return;
    const id = bill._id || bill.id;
    optimisticPay(bill, amount);
    try {
      const res: any = await (api as any).addPayment(id, { amount, method, drawer, reference: method === 'e_wallet' ? t('delivery.payment.eWalletRef') : undefined });
      applyBill(id, res?.success ? res.data : null);
      if (res?.success) {
        palert(t('delivery.notifications.collectedSuccess'), true);
        // ختم التسليم تلقائياً عند اكتمال التحصيل (خطوة واحدة مثل الفاتورة)
        try {
          const done = res.data || { ...bill, paid: (Number(bill.paid) || 0) + amount, remaining: 0 };
          if ((done.deliveryInfo?.status || 'preparing') !== 'delivered') {
            await updateStatus(done, 'delivered');
          }
        } catch {}
      }
    } catch (e: any) { refreshSingleBill?.({ _id: id }); }
  };

  const handlePartial = async (bill: any, amount: number, method: string, drawer: string = 'delivery') => {
    const remaining = Number(bill.remaining) || 0;
    if (!(amount > 0) || amount > remaining) { palert(t('delivery.notifications.invalidAmount')); return; }
    const id = bill._id || bill.id;
    optimisticPay(bill, amount);
    try {
      const res: any = await (api as any).addPayment(id, { amount, method, drawer, reference: method === 'e_wallet' ? t('delivery.payment.eWalletRef') : undefined });
      applyBill(id, res?.success ? res.data : null);
    } catch (e: any) { refreshSingleBill?.({ _id: id }); }
  };

  const handleDiscount = async (bill: any, discount: number, type: 'amount' | 'percent' = 'percent') => {
    if (!canApplyManualDiscount(user)) { palert(t('common.permissionDenied')); return; }
    const id = bill._id || bill.id;
    try {
      const payload = type === 'percent' ? { discountPercentage: discount, discount: 0 } : { discount, discountPercentage: 0 };
      const res: any = await (api as any).updateBill(id, payload);
      applyBill(id, res?.success ? res.data : null);
    } catch (e: any) { palert(e?.message || t('delivery.notifications.discountFailed')); refreshSingleBill?.({ _id: id }); }
  };

  const [payItemsBill, setPayItemsBill] = useState<any | null>(null);

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
          else palert(t('delivery.notifications.openBillFailed'));
        } catch { palert(t('delivery.notifications.openBillFailed')); }
      })();
    }
  }, [location.state]);

  const handleWhatsApp = (bill: any) => {
    const phone = String(bill.deliveryInfo?.phone || bill.customerPhone || '').replace(/[^0-9]/g, '');
    if (!phone) { palert(t('delivery.notifications.noPhone')); return; }
    const orgName = (user as any)?.organizationName || '';
    openWhatsAppChat(phone, buildWhatsAppText(bill, t, orgName));
  };

  const openLoyalty = (bill: any) => {
    const phone = String(bill.deliveryInfo?.phone || bill.customerPhone || '').replace(/[^0-9]/g, '');
    if (!phone) return;
    const hist = (bills || []).filter((b: any) => String(b.deliveryInfo?.phone || b.customerPhone || '').replace(/[^0-9]/g, '') === phone);
    const total = hist.reduce((s: number, b: any) => s + (Number(b.total) || 0), 0);
    setLoyal({ phone, name: bill.deliveryInfo?.customerName || bill.customerName, count: hist.length, total, points: Math.floor(total / 10), recent: hist.sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5) });
  };

  // إعادة نفس الطلب بضغطة: فاتورة جديدة بنفس بيانات العميل + نسخ الأصناف
  const reorder = async (oldBill: any) => {
    try {
      const full: any = await (api as any).getBill(oldBill._id || oldBill.id);
      const ob = full?.data || oldBill;
      const orders = Array.isArray(ob.orders) ? ob.orders : [];
      const payloadItems: any[] = [];
      for (const o of orders) {
        const items = Array.isArray((o as any)?.items) ? (o as any).items : [];
        for (const it of items) {
          const mid = (it as any).menuItem?._id || (typeof (it as any).menuItem === 'string' ? (it as any).menuItem : undefined);
          if (mid && /^[a-f\d]{24}$/i.test(String(mid))) {
            payloadItems.push({ menuItem: String(mid), quantity: it.quantity || 1, variant: it.variant || undefined, price: it.price, notes: it.notes || undefined });
          } else if (it.name) {
            payloadItems.push({ name: it.name, price: it.price || 0, quantity: it.quantity || 1, variant: it.variant || undefined });
          }
        }
      }
      if (!payloadItems.length) { palert(t('delivery.notifications.noRepeatableItems')); return; }
      const src = ob.deliveryInfo || {};
      const body: any = {
        fulfillmentType: 'delivery', billType: 'cafe',
        deliveryInfo: { phone: src.phone || '', address: src.address || '', customerName: src.customerName || ob.customerName || t('delivery.defaults.customerName'), deliveryFee: Number(src.deliveryFee) || 0 },
      };
      if (!body.deliveryInfo.phone.trim() || !body.deliveryInfo.address.trim()) { palert(t('delivery.notifications.missingCustomerData')); return; }
      const res: any = await (api as any).createBill?.(body) || await (api as any).request('/bills', { method: 'POST', body: JSON.stringify(body) });
      const created = res?.data || res;
      const newId = created?._id || created?.id;
      if (!newId) { palert(t('delivery.notifications.invoiceCreateFailed')); return; }
      await (api as any).updateBillAggregatedItems(newId, { items: payloadItems });
      setLoyal(null);
      if (refreshSingleBill) refreshSingleBill({ _id: newId });
      feedRef.current?.prepend(created._id ? created : { ...created, _id: newId });
      void feedRef.current?.refreshFirstPage();
      setBillToEdit(created._id ? created : { ...created, _id: created.id });
    } catch (e: any) { palert(e?.message || t('delivery.notifications.reorderFailed')); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-2.5 sm:p-6 space-y-4 sm:space-y-5">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-blue-100 dark:border-gray-700 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow text-white text-xl sm:text-2xl flex-shrink-0">🛵</div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white">{t('delivery.title')}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('delivery.header.subtitle', { count: stats.total, fees: stats.fees.toFixed(2) })}</p>
            </div>
          </div>
          <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
            <button onClick={() => { setDashOpen(v => { const n = !v; try { localStorage.setItem('deliveryDashOpen', n ? '1' : '0'); } catch {} return n; }); }} title={t('delivery.header.toggleStatsTitle')} className="px-3 py-2 text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300">
              📊 {dashOpen ? t('delivery.header.hide') : t('delivery.header.stats')}
            </button>
            <button onClick={() => { const v = compact ? 'comfortable' : 'compact'; setDensity(v); try { localStorage.setItem('deliveryDensity', v); } catch {} }} title={t('delivery.header.toggleViewTitle')} className="px-3 py-2 text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300">
              {compact ? t('delivery.header.comfortable') : t('delivery.header.compact')}
            </button>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={autoPrint} onChange={e => { setAutoPrint(e.target.checked); try { localStorage.setItem('deliveryAutoPrint', e.target.checked ? '1' : '0'); } catch {} }} className="w-4 h-4 accent-blue-600" />
              {t('delivery.header.autoPrint')}
            </label>
            {canCreateDelivery(user) && (
              <button onClick={() => setShowForm(true)} className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" /> {t('delivery.newOrder')}
              </button>
            )}
          </div>
        </div>
        {dashOpen && (<>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: t('delivery.stats.all'), value: stats.total },
            { label: t('delivery.stats.new'), value: stats.draft },
            { label: t('delivery.stats.partial'), value: stats.partial },
            { label: t('delivery.stats.paid'), value: stats.paid },
          ].map(s => (
            <div key={s.label} className="bg-blue-50/60 dark:bg-gray-700/50 rounded-xl p-3 text-center border border-blue-100 dark:border-gray-600">
              <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
              <div className="text-xl font-extrabold text-gray-900 dark:text-white">{s.value}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <div className="rounded-xl p-3 text-center border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"><div className="text-xs text-gray-500">{t('delivery.analytics.avgPrep')}</div><div className="text-lg font-extrabold">{analytics.avgPrep !== null ? t('delivery.analytics.minutesValue', { value: analytics.avgPrep }) : '—'}</div></div>
          <div className="rounded-xl p-3 text-center border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"><div className="text-xs text-gray-500">{t('delivery.analytics.avgDel')}</div><div className="text-lg font-extrabold">{analytics.avgDel !== null ? t('delivery.analytics.minutesValue', { value: analytics.avgDel }) : '—'}</div></div>
          <div className="rounded-xl p-3 text-center border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"><div className="text-xs text-gray-500">{t('delivery.analytics.onTime')}</div><div className="text-lg font-extrabold">{analytics.onTime !== null ? `${analytics.onTime}%` : '—'}</div></div>
          <div className="rounded-xl p-3 text-center border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"><div className="text-xs text-gray-500">{t('delivery.analytics.delivered')}</div><div className="text-lg font-extrabold">{analytics.n}</div></div>
        </div>
      </>)}
      </div>

      {dashOpen && (<>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl p-4 text-center border-2 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <div className="text-xs font-bold text-amber-700 dark:text-amber-300">{t('delivery.follow.new')}</div>
          <div className="text-2xl font-extrabold">{follow.prep}</div>
        </div>
        <div className="rounded-2xl p-4 text-center border-2 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="text-xs font-bold text-blue-700 dark:text-blue-300">{t('delivery.follow.partial')}</div>
          <div className="text-2xl font-extrabold">{follow.out}</div>
        </div>
        <div className={`rounded-2xl p-4 text-center border-2 ${follow.late > 0 ? 'bg-red-50 dark:bg-red-900/30 border-red-400 animate-pulse' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
          <div className={`text-xs font-bold ${follow.late > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-500'}`}>{t('delivery.follow.late')}</div>
          <div className={`text-2xl font-extrabold ${follow.late > 0 ? 'text-red-700 dark:text-red-300' : ''}`}>{follow.late}</div>
        </div>
      </div>
      </>)}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 p-3 flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5">
          {([['unpaid', t('delivery.filters.unpaid')], ['paid', t('delivery.filters.paid')], ['all', t('delivery.filters.all')]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setBillFilter(v)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors ${billFilter === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {([['all', t('delivery.statusFilter.all')], ['preparing', t('delivery.statusFilter.preparing')], ['out_for_delivery', t('delivery.statusFilter.outForDelivery')], ['delivered', t('delivery.statusFilter.delivered')]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setDeliveryStatus(v)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors ${deliveryStatus === v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto relative w-full sm:w-64">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input id="delivery-search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('delivery.searchPlaceholder')} className="w-full pr-9 pl-9 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100" />
          {feed.refreshing && debouncedSearch.trim() ? (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : search ? (
            <button onClick={() => setSearch('')} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none" title={t('delivery.search.clearTitle')}>×</button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {feed.items.map((bill: any) => (
              <div key={String(bill._id || bill.id)}>
                <BillTableCard bill={bill} kind="delivery" compact={compact} showPhone={canSeeContacts}
                  method={payMethods[String(bill._id || bill.id)] || 'cash'} onMethodChange={(m) => setPayMethods(p => ({ ...p, [String(bill._id || bill.id)]: m }))}
                  drawer={payDrawers[String(bill._id || bill.id)] || 'delivery'} onDrawerChange={(d) => setPayDrawers(p => ({ ...p, [String(bill._id || bill.id)]: d }))}
                  canEdit={canEditDelivery(user)}
                  canPayFull={canPayFullDelivery(user)} canPayPartial={canPayPartialDelivery(user)}
                  onOpen={guardDeliveryEdit(setBillToEdit)} onAddItems={guardDeliveryEdit(setBillToEdit)} onEditItems={guardDeliveryEdit(setBillToEdit)}
                  onCollect={handleCollect} onPrint={handlePrint} onMove={(b: any) => { if (!canMoveBillDeliveryToTable(user)) { palert(t('common.permissionDenied')); return; } guardDeliveryEdit(setMoveBill)(b); }} onWhatsApp={handleWhatsApp}
                  onDelete={handleDelete} onCustomer={openLoyalty} onPayItems={guardDeliveryPartial(setPayItemsBill)} onPrepPrint={handlePrepPrint}
                  onDriverSave={(b, name) => updateStatus(b, b.deliveryInfo?.status || 'preparing', { driver: name })} />
              </div>
            ))}
        {feed.items.length===0 && !feed.refreshing && !feed.loading && <div className="col-span-full text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400">{debouncedSearch.trim() ? t('delivery.empty.noResults', { query: debouncedSearch.trim() }) : t('delivery.empty.noOrders')}</div>}
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
          <button onClick={() => feed.loadMore()} className="ml-2 text-sm font-bold text-blue-600 underline">{t('delivery.list.retry')}</button>
        </div>
      )}
      {!feed.hasMore && feed.items.length > 0 && (
        <div className="text-center text-xs text-gray-400 py-2">{t('delivery.list.shownAll', { total: feed.total })}</div>
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

      {payItemsBill && (
        <ItemPartialPayModal
          bill={payItemsBill}
          onClose={() => setPayItemsBill(null)}
          onSuccess={(updated: any) => { applyBill(updated?._id || updated?.id || payItemsBill?._id, updated); setPayItemsBill(null); }}
        />
      )}

      <BillItemsEditModal
        isOpen={!!billToEdit}
        onClose={closeItemsModal}
        bill={billToEdit}
        menuItems={menuItems || []}
        menuSections={menuSections || []}
        menuCategories={menuCategories || []}
        onSuccess={(updated: any) => {
          const nid = String(updated?._id || updated?.id || '');
          applyBill(nid, updated);
          if (updated) {
            setBills((prev: any[]) => prev.some((b: any) => String(b._id || b.id) === nid) ? prev : [updated, ...prev]);
            if (updated.status !== 'paid' && updated.status !== 'cancelled') feedRef.current?.prepend(updated);
            try {
              const di = updated.deliveryInfo || {};
              saveDeviceCustomer(di.customerName || updated.customerName || '', di.phone || updated.customerPhone || '', di.address || '');
            } catch {}
          }
          setBillToEdit(null);
        }}
        onPrepPrint={handlePrepPrint}
        printBothTogether={printBoth}
      />

      {loyal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setLoyal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-md border" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">{t('delivery.loyalty.title')}</h3>
            <div className="mt-2 font-bold">{loyal.name} — {loyal.phone}</div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="rounded-xl bg-gray-50 dark:bg-gray-700 p-3 text-center"><div className="text-xs text-gray-500">{t('delivery.loyalty.orders')}</div><div className="text-xl font-extrabold">{loyal.count}</div></div>
              <div className="rounded-xl bg-gray-50 dark:bg-gray-700 p-3 text-center"><div className="text-xs text-gray-500">{t('delivery.loyalty.total')}</div><div className="text-xl font-extrabold">{loyal.total.toFixed(0)}</div></div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-center"><div className="text-xs text-gray-500">{t('delivery.loyalty.points')}</div><div className="text-xl font-extrabold text-amber-600">{loyal.points}</div></div>
            </div>
            <div className="mt-3 space-y-1">
              {loyal.recent.map((b: any) => (
                <div key={b._id || b.id} className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 py-1.5">
                  <span className="font-mono">#{String(b.billNumber || b._id).slice(-6)} — {fmtDT(b.createdAt)}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-bold">{(b.total || 0).toFixed(2)}</span>
                    <button onClick={() => reorder(b)} title={t('delivery.loyalty.reorderTitle')} className="px-2 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg">{t('delivery.loyalty.reorder')}</button>
                  </span>
                </div>
              ))}
            </div>
            <button onClick={() => setLoyal(null)} className="mt-4 w-full py-2 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold">{t('delivery.loyalty.close')}</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-5 sm:p-8 w-full max-w-5xl max-h-[92vh] overflow-y-auto border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-extrabold mb-4 text-gray-900 dark:text-white flex items-center gap-2">{t('delivery.form.title')}</h3>
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="space-y-3 sm:col-span-3">
              <input type="text" placeholder={t('delivery.form.customerNamePlaceholder')} value={draft.customerName} onChange={e => setDraft({ ...draft, customerName: e.target.value })} onKeyDown={submitOnEnter} className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" />
              <input type="text" inputMode="tel" autoFocus placeholder={t('delivery.form.phonePlaceholder')} value={draft.phone} onChange={e => handlePhoneChange(e.target.value)} onFocus={() => setPhoneFocused(true)} onBlur={() => setTimeout(() => setPhoneFocused(false), 150)} onKeyDown={submitOnEnter} className="w-full px-4 py-3 text-[15px] border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" />
              {(() => {
                if (!phoneFocused) return null;
                const matches = suggestions;
                if (matches.length === 0) return null;
                return (
                  <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 overflow-hidden">
                    <div className="max-h-60 overflow-y-auto">
                    {matches.map((c) => (
                      <button
                        key={c.phone}
                        type="button"
                        onClick={() => { autoFillRef.current = { phone: digitsOf(c.phone), name: c.name || '', address: c.address || '', fee: c.fee || '' }; setDraft((d) => { const remainder = stripZonePrefix(d.address, lockedZone); const incoming = lockedZone ? stripAnyZonePrefix(c.address || '') : (c.address || ''); return { ...d, customerName: d.customerName || c.name, phone: c.phone, address: remainder ? d.address : ((lockedZone ? lockedZone + ZONE_SEP : '') + incoming), deliveryFee: d.deliveryFee || c.fee || d.deliveryFee }; }); }}
                        className="w-full text-right px-3 py-2 hover:bg-violet-100 dark:hover:bg-violet-900/40 text-sm border-b border-violet-100 dark:border-violet-800 last:border-b-0"
                      >
                        <span className="font-bold text-gray-800 dark:text-gray-100">📱 {c.name || c.phone}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs mr-2" dir="ltr">{c.phone}</span>
                        {c.count > 1 && <span className="text-violet-600 dark:text-violet-300 text-xs mr-2">{t('delivery.form.orderCount', { count: c.count })}</span>}
                      </button>
                    ))}
                    </div>
                  </div>
                );
              })()}
              {knownCustomer && (
                <button onClick={fillKnown} className="w-full text-right text-xs bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl px-3 py-2 hover:bg-green-100">
                  {t('delivery.form.knownCustomer', { count: knownCustomer.count })}
                </button>
              )}
              <div className="w-full flex items-stretch border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                {lockedZone ? <span className="flex items-center px-3 py-2.5 bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 text-sm font-bold whitespace-nowrap select-none border-l border-blue-200 dark:border-blue-700">{lockedZone}</span> : null}
                <input type="text" placeholder={t('delivery.form.addressPlaceholder')} value={stripZonePrefix(draft.address, lockedZone)} onChange={e => applyAddressLocked(e.target.value)} onKeyDown={submitOnEnter} className="flex-1 min-w-0 px-4 py-2.5 bg-transparent text-gray-900 dark:text-gray-100 outline-none text-sm" />
              </div>
              <div className="flex gap-2">
                <select value={draft.zone} onChange={e => selectZone(e.target.value)} onKeyDown={submitOnEnter} className="flex-1 px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100">
                  <option value="">{t('delivery.form.zonePlaceholder')}</option>
                  {zones.map(z => <option key={z.name} value={z.name}>{t('delivery.form.zoneOption', { name: z.name, fee: z.fee })}</option>)}
                </select>
                <input type="number" placeholder={t('delivery.form.feePlaceholder')} value={draft.deliveryFee} onChange={e => setDraft({ ...draft, deliveryFee: e.target.value })} onKeyDown={submitOnEnter} className="w-28 px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400" />
              </div>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-3 sm:p-4 sm:col-span-2 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-gray-800 dark:text-gray-100 text-sm flex items-center gap-1.5">📍 {t('delivery.zones.title', 'مناطق التوصيل')}</span>
                  <span className="min-w-[22px] h-[22px] px-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 text-xs font-bold rounded-full flex items-center justify-center">{zones.length}</span>
                </div>
                <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 p-2 space-y-2">
                  <input type="text" placeholder={t('delivery.form.newZonePlaceholder')} value={newZone.name} onChange={e => setNewZone({ ...newZone, name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addZone(); } }} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500" />
                  <div className="flex gap-2">
                    <input type="number" placeholder={t('delivery.form.newZoneFeePlaceholder')} value={newZone.fee} onChange={e => setNewZone({ ...newZone, fee: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addZone(); } }} className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500" />
                    <button onClick={addZone} title={editingZone ? t('common.save', 'حفظ') : t('delivery.zones.add', 'إضافة')} className={`px-4 py-2 text-sm rounded-lg font-bold transition-colors ${editingZone ? 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600' : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200'}`}>{editingZone ? '✓' : '＋'}</button>
                    {editingZone ? <button onClick={cancelEditZone} title={t('common.cancel', 'إلغاء')} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-bold transition-colors">×</button> : null}
                  </div>
                  {editingZone ? <div className="text-[11px] text-blue-600 dark:text-blue-300 font-bold">{t('delivery.zones.editing', 'تعديل:')} {editingZone.name}</div> : null}
                </div>
                <div className="flex flex-col gap-1.5 overflow-y-auto max-h-44 pr-0.5">
                  {zones.length === 0 ? (
                    <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-4">{t('delivery.zones.empty', 'لا توجد مناطق بعد — أضف أول منطقة بالأعلى')}</div>
                  ) : zones.map(z => {
                    const isEditing = editingZone && (editingZone._id || editingZone.name) === (z._id || z.name);
                    return (
                      <div key={z._id || z.name} className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${isEditing ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'}`}>
                        <span className="flex-1 min-w-0 truncate font-bold text-sm text-gray-800 dark:text-gray-100">{z.name}</span>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{z.fee} ج.م</span>
                        <button onClick={() => startEditZone(z)} title={t('common.edit', 'تعديل')} className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-300 transition-colors">✎</button>
                        <button onClick={() => removeZone(z)} title={t('common.delete', 'حذف')} className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-500 transition-colors">×</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowForm(false); setLockedZone(''); setEditingZone(null); }} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600">{t('delivery.form.cancel')}</button>
              <button onClick={handleCreate} className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow">{t('delivery.form.create')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Delivery;
