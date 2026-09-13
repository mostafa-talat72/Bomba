import { useState, useEffect, useMemo, memo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useTranslation } from 'react-i18next';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../utils/apiBase';
import api from '../services/api';
import { Bill } from '../services/api';
import { printBill } from '../utils/printBill';
import BillItemsEditModal from '../components/tables/BillItemsEditModal';
import BillTableCard from '../components/tables/BillTableCard';
import { getShortBillNumber } from '../utils/formatters';
import ChangeTableModal from '../components/tables/ChangeTableModal';
import OrderPrintSectionsModal from '../components/tables/OrderPrintSectionsModal';
import { startBillPrep, confirmBillPrep } from '../utils/orderSectionPrint';
import ItemPartialPayModal from '../components/tables/ItemPartialPayModal';
import { canDeleteBill } from '../utils/permissionHelper';
import { Search, Plus, Phone, User } from 'lucide-react';
import { isSoundEnabled, playWarnBeep, playDangerBeep } from '../utils/sound';
import { canViewCustomerContacts } from '../utils/permissionHelper';
import { toast } from 'react-toastify';
import { useInfiniteList } from '../hooks/useInfiniteList';

// In-app notice (replaces blocking browser alert): error by default.
const palert = (msg: string, ok = false) => (ok ? toast.success(msg) : toast.error(msg));

const fmtDT = (d: any) => { try { return new Date(d).toLocaleString('ar-EG'); } catch { return ''; } };
const mins = (a: any, b: any) => {
  const x = new Date(a).getTime(); const y = new Date(b).getTime();
  if (isNaN(x) || isNaN(y) || y < x) return null;
  return Math.round((y - x) / 60000);
};

const buildWhatsAppText = (bill: any) => {
  const lines: string[] = [`فاتورة #${String(bill.billNumber || bill._id).slice(-6)}`, `التاريخ: ${fmtDT(bill.createdAt)}`];
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
  lines.push(`الإجمالي: ${(bill.total || 0).toFixed(2)} ج.م`, `المدفوع: ${(bill.paid || 0).toFixed(2)} — المتبقي: ${(bill.remaining || 0).toFixed(2)}`);
  if (bill.deliveryInfo?.address) lines.push(`العنوان: ${bill.deliveryInfo.address}`);
  lines.push('شكراً لتعاملكم معنا');
  return lines.join('\n');
};


// شريط مالي صغير تحت كارت الطاولة الموحد (جزئي/خصم/دفع أصناف)
const FinanceStrip = memo(({ bill, method, onPartial, onDiscount, onPayItems }: {
  bill: any; method: string;
  onPartial: (b: any, amount: number, method: string) => void;
  onDiscount: (b: any, discount: number, type: 'amount' | 'percent') => void;
  onPayItems: (b: any) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [partAmount, setPartAmount] = useState('');
  const [disc, setDisc] = useState('');
  const [discType, setDiscType] = useState<'amount' | 'percent'>('amount');
  const remaining = Number(bill.remaining) || 0;
  if (remaining <= 0) return null;
  return (
    <div className="mt-1">
      <button onClick={() => setOpen(v => !v)} className="w-full py-1 text-[11px] font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-500">💰 جزئي / خصم / أصناف</button>
      {open && (
        <div className="mt-1 p-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 space-y-1.5">
          <div className="flex gap-1">
            <input type="number" min="1" placeholder={`جزئي (متبقي ${remaining.toFixed(0)})`} value={partAmount} onChange={e => setPartAmount(e.target.value)} className="flex-1 px-2 py-1.5 text-xs border rounded-lg bg-white dark:bg-gray-700" />
            <button onClick={() => { const a = Number(partAmount); if (a > 0) { onPartial(bill, a, method); setPartAmount(''); } }} className="px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg">دفع</button>
          </div>
          <div className="flex gap-1">
            <button onClick={() => onPayItems(bill)} className="flex-1 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">🧾 دفع أصناف</button>
          </div>
          <div className="flex gap-1">
            <input type="number" min="0" placeholder={discType === 'percent' ? `خصم % (الحالي ${bill.discountPercentage || 0}%)` : `خصم (الحالي ${bill.discount || 0})`} value={disc} onChange={e => setDisc(e.target.value)} className="flex-1 px-2 py-1.5 text-xs border rounded-lg bg-white dark:bg-gray-700" />
            <button onClick={() => setDiscType(t => t === 'amount' ? 'percent' : 'amount')} title="تبديل مبلغ/نسبة" className="px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-gray-700 border rounded-lg text-gray-600">{discType === 'amount' ? 'ج.م' : '%'}</button>
            <button onClick={() => { const d = Number(disc); if (disc === '' || d < 0 || (discType === 'percent' && d > 100)) return; onDiscount(bill, d, discType); setDisc(''); }} className="px-3 py-1.5 text-xs font-bold bg-gray-600 hover:bg-gray-700 text-white rounded-lg">خصم</button>
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
interface DeviceCustomer { name: string; phone: string; address: string; count: number; lastUsed: number }
const loadDeviceCustomers = (): DeviceCustomer[] => {
  try {
    const r = JSON.parse(localStorage.getItem('deliveryCustomers') || '[]');
    return Array.isArray(r) ? r : [];
  } catch { return []; }
};
const saveDeviceCustomer = (name: string, phone: string, address: string): void => {
  try {
    const p = phone.replace(/\D/g, '');
    if (!p) return;
    const list = loadDeviceCustomers();
    const idx = list.findIndex((c) => c.phone.replace(/\D/g, '') === p);
    if (idx >= 0) {
      list[idx] = {
        name: name || list[idx].name,
        phone: list[idx].phone,
        address: address || list[idx].address,
        count: (list[idx].count || 1) + 1,
        lastUsed: Date.now(),
      };
    } else {
      list.push({ name, phone, address, count: 1, lastUsed: Date.now() });
    }
    list.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
    localStorage.setItem('deliveryCustomers', JSON.stringify(list.slice(0, 100)));
  } catch {}
};

const Delivery = () => {
  const { bills, fetchBills, setBills, refreshSingleBill, user, tables, menuItems, menuSections, menuCategories, fetchMenuItems, fetchMenuSections, fetchMenuCategories } = useApp() as any;
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
    } catch { palert('فشل طباعة التحضير'); }
  };
  const confirmPrepPrint = async () => {
    if (!prepSelection || prepSelected.length === 0) return;
    const sel = prepSelection;
    setPrepSelection(null);
    await confirmBillPrep(sel.orders, prepSelected, sel.menuItemsMap, prepCtx()).catch(() => palert('فشل طباعة التحضير'));
  };

  const handlePrint = async (bill: any) => {
    try {
      // ختم الخروج تلقائياً عند أول طباعة (يغذي التحليلات) ثم اطبع
      let full: any = bill;
      if ((bill.deliveryInfo?.status || 'preparing') === 'preparing') {
        full = (await updateStatus(bill, 'out_for_delivery')) || { ...bill, deliveryInfo: { ...(bill.deliveryInfo || {}), status: 'out_for_delivery' } };
      }
      await printBill(full, (user as any)?.organizationName, i18n.language, t);
    } catch (e: any) { palert(e?.message || 'فشل الطباعة'); }
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
        palert(res?.message || 'تم نقل الفاتورة إلى الطاولة', true);
      void fetchBills();
    } catch (e: any) { palert(e?.message || 'فشل النقل'); }
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
  const { t, i18n } = useTranslation();
  const [autoPrint, setAutoPrint] = useState(() => { try { return localStorage.getItem('deliveryAutoPrint') !== '0'; } catch { return true; } });
  const [density, setDensity] = useState(() => { try { return localStorage.getItem('deliveryDensity') || 'comfortable'; } catch { return 'comfortable'; } });
  const compact = density === 'compact';
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [billFilter, setBillFilter] = useState<'unpaid' | 'paid' | 'all'>('unpaid');
  const billFilterRef = useRef(billFilter);
  billFilterRef.current = billFilter;
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ customerName: '', phone: '', address: '', deliveryFee: '', zone: '' });
  const [creating, setCreating] = useState(false);
  const [zones, setZones] = useState<Array<{ _id?: string; name: string; fee: number }>>([]);
  const [newZone, setNewZone] = useState({ name: '', fee: '' });
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
        const f = billFilterRef.current;
        if (f === 'paid') return b.status === 'paid';
        if (f === 'all') return true;
        return !['paid', 'cancelled'].includes(b.status);
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
  const [loyal, setLoyal] = useState<any | null>(null);
  const [billToEdit, setBillToEdit] = useState<any | null>(null);
  const [pendingNewId, setPendingNewId] = useState<string | null>(null);
  const [payMethods, setPayMethods] = useState<Record<string, string>>({});

  // إغلاق نافذة الأصناف: الفاتورة المنشأة حديثاً بلا أصناف ولا مدفوع تُحذف تلقائياً
  const closeItemsModal = async () => {
    const id = pendingNewId;
    setBillToEdit(null);
    setPendingNewId(null);
    if (!id) return;
    try {
      const res: any = await (api as any).getBill(id);
      const b = res?.data;
      const itemsCount = Array.isArray(b?.orders) ? b.orders.reduce((s: number, o: any) => s + (Array.isArray(o?.items) ? o.items.length : 0), 0) : 0;
      if (b && itemsCount === 0 && Number(b.paid || 0) === 0) {
        await (api as any).deleteBill(id).catch(() => {});
        setBills((prev: any[]) => prev.filter((x: any) => String(x._id || x.id) !== String(id)));
        feedRef.current?.remove(String(id));
      }
    } catch {}
  };

  // نفس معاملة حذف فواتير الطاولات: فحص صلاحية أولاً ثم حذف متفائل + مزامنة خلفية
  const handleDelete = async (bill: any) => {
    if (!canDeleteBill(user)) { palert('غير مصرح — تحتاج صلاحية حذف الفواتير'); return; }
    const id = bill._id || bill.id;
    setBills((prev: any[]) => prev.filter((b: any) => String(b._id || b.id) !== String(id)));
    feedRef.current?.remove(String(id));
    try {
      const res: any = await (api as any).deleteBill(id);
      if (res?.success) {
        palert('تم حذف الفاتورة بنجاح', true);
        void fetchBills();
      } else {
        palert('فشل حذف الفاتورة');
        refreshSingleBill?.({ _id: id });
      }
    } catch (e: any) { palert(e?.message || 'فشل الحذف'); refreshSingleBill?.({ _id: id }); }
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
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(t); }, [search]);

  // ── Infinite scroll من السيرفر (25/صفحة) بدل الجلب الكامل ──
  const feed = useInfiniteList<any>({
    pageSize: 25,
    depsKey: `${debouncedSearch.trim()}|${billFilter}`,
    getId: (b: any) => String(b?._id || b?.id || ''),
    fetchPage: async (pageNum, limitNum) => {
      const res: any = await (api as any).getBills({
        fulfillmentType: 'delivery',
        status: billFilter === 'paid' ? 'paid' : billFilter === 'all' ? undefined : 'draft,partial,overdue',
        all: billFilter === 'all' ? true : undefined,
        q: debouncedSearch.trim() || undefined,
        page: pageNum,
        limit: limitNum,
        mode: 'list',
      });
      return { items: res?.data || [], total: res?.total ?? 0, hasMore: res?.hasMore ?? false };
    },
  });
  const feedRef = useRef<any>(null);
  feedRef.current = feed;

  useEffect(() => { fetchBills(); }, [fetchBills]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !(e.target as HTMLElement)?.matches('input,textarea,select')) { e.preventDefault(); setShowForm(true); }
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !(e.target as HTMLElement)?.matches('input,textarea,select')) { e.preventDefault(); document.querySelector<HTMLInputElement>('input[placeholder*="بحث"]')?.focus(); }
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
    try {
      const res: any = await (api as any).createDeliveryZone({ name: newZone.name.trim(), fee });
      if (res?.success && res.data) { setZones(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name, 'ar'))); }
      else { const z = [...zones, { name: newZone.name.trim(), fee }]; setZones(z); saveZonesLocal(z); }
    } catch { const z = [...zones, { name: newZone.name.trim(), fee }]; setZones(z); saveZonesLocal(z); }
    setNewZone({ name: '', fee: '' });
  };
  const removeZone = async (z: any) => {
    setZones(prev => prev.filter(zz => (zz._id || zz.name) !== (z._id || z.name)));
    try { if (z._id) await (api as any).deleteDeliveryZone(z._id); else saveZonesLocal(zones.filter(zz => zz.name !== z.name)); }
    catch { saveZonesLocal(zones.filter(zz => zz.name !== z.name)); }
  };

  // تعبئة تلقائية من سجل العميل بمجرد كتابة الهاتف
  const knownCustomer = useMemo(() => {
    const digits = draft.phone.replace(/[^0-9]/g, '');
    if (digits.length < 7) return null;
    const hist = list.filter((b: any) => String(b.deliveryInfo?.phone || b.customerPhone || '').replace(/[^0-9]/g, '') === digits);
    if (!hist.length) return null;
    const last = hist.sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
    return { count: hist.length, name: last.deliveryInfo?.customerName || last.customerName || '', address: last.deliveryInfo?.address || '', fee: last.deliveryInfo?.deliveryFee || 0 };
  }, [draft.phone, list]);
  const fillKnown = () => {
    if (!knownCustomer) return;
    setDraft(d => ({ ...d, customerName: d.customerName || knownCustomer.name, address: d.address || knownCustomer.address, deliveryFee: d.deliveryFee || String(knownCustomer.fee || '') }));
  };

  const handleCreate = async () => {
    if (!draft.phone.trim() || !draft.address.trim()) { palert('الهاتف والعنوان مطلوبان'); return; }
    setCreating(true);
    try {
      const body: any = { fulfillmentType: 'delivery', billType: 'cafe', deliveryInfo: { phone: draft.phone.trim(), address: draft.address.trim(), customerName: draft.customerName.trim() || 'عميل دليفري', deliveryFee: Number(draft.deliveryFee) || 0 } };
      // فشل الإنشاء يجب أن يظهر رسالته — لا بديل صامت يبتلع الخطأ.
      const res: any = await (api as any).createBill(body);
      if (!res?.success) {
        palert(res?.message || 'فشل الإنشاء');
        return;
      }
      // حفظ العميل في دليل الجهاز للاقتراح لاحقاً.
      saveDeviceCustomer(draft.customerName.trim(), draft.phone.trim(), draft.address.trim());
      const created = res?.data || res;
      setShowForm(false); setDraft({ customerName: '', phone: '', address: '', deliveryFee: '', zone: '' });
      const newId = created?._id || created?.id;
      if (newId) {
        if (refreshSingleBill) refreshSingleBill({ _id: newId });
        // إدراج فوري أعلى القائمة + مزامنة الصفحة الأولى (بلا قفز سكرول)
        if (created) feedRef.current?.prepend(created._id ? created : { ...created, _id: newId });
        void feedRef.current?.refreshFirstPage();
      }
      // فتح المنيو فوراً — لا بحث عن الكارت (وتُحذف تلقائياً لو أُغلقت فارغة)
      if (newId) { setPendingNewId(String(newId)); setBillToEdit(created._id ? created : { ...created, _id: created.id }); }
    } catch (e: any) { palert(e?.message || 'فشل الإنشاء'); }
    finally { setCreating(false); }
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

  // تحصيل مباشر (التأكيد داخل الكارت نفسه — بلا نافذة دفع).
  const handleCollect = async (bill: any, method: string) => {
    const amount = Number(bill.remaining) || 0;
    if (amount <= 0) return;
    const id = bill._id || bill.id;
    optimisticPay(bill, amount);
    try {
      const res: any = await (api as any).addPayment(id, { amount, method, reference: method === 'e_wallet' ? 'محفظة إلكترونية' : undefined });
      applyBill(id, res?.success ? res.data : null);
      if (res?.success) {
        palert('تم التحصيل بنجاح', true);
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

  const handlePartial = async (bill: any, amount: number, method: string) => {
    const remaining = Number(bill.remaining) || 0;
    if (!(amount > 0) || amount > remaining) { palert('مبلغ غير صالح'); return; }
    const id = bill._id || bill.id;
    optimisticPay(bill, amount);
    try {
      const res: any = await (api as any).addPayment(id, { amount, method, reference: method === 'e_wallet' ? 'محفظة إلكترونية' : undefined });
      applyBill(id, res?.success ? res.data : null);
    } catch (e: any) { refreshSingleBill?.({ _id: id }); }
  };

  const handleDiscount = async (bill: any, discount: number, type: 'amount' | 'percent' = 'amount') => {
    const id = bill._id || bill.id;
    try {
      const payload = type === 'percent' ? { discountPercentage: discount, discount: 0 } : { discount, discountPercentage: 0 };
      const res: any = await (api as any).updateBill(id, payload);
      applyBill(id, res?.success ? res.data : null);
    } catch (e: any) { palert(e?.message || 'فشل الخصم'); refreshSingleBill?.({ _id: id }); }
  };

  const [payItemsBill, setPayItemsBill] = useState<any | null>(null);

  const handleWhatsApp = (bill: any) => {
    const phone = String(bill.deliveryInfo?.phone || bill.customerPhone || '').replace(/[^0-9]/g, '');
    if (!phone) { palert('لا يوجد رقم هاتف'); return; }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsAppText(bill))}`, '_blank');
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
      if (!payloadItems.length) { palert('لا توجد أصناف قابلة للتكرار'); return; }
      const src = ob.deliveryInfo || {};
      const body: any = {
        fulfillmentType: 'delivery', billType: 'cafe',
        deliveryInfo: { phone: src.phone || '', address: src.address || '', customerName: src.customerName || ob.customerName || 'عميل دليفري', deliveryFee: Number(src.deliveryFee) || 0 },
      };
      if (!body.deliveryInfo.phone.trim() || !body.deliveryInfo.address.trim()) { palert('بيانات العميل ناقصة في الطلب الأصلي'); return; }
      const res: any = await (api as any).createBill?.(body) || await (api as any).request('/bills', { method: 'POST', body: JSON.stringify(body) });
      const created = res?.data || res;
      const newId = created?._id || created?.id;
      if (!newId) { palert('فشل إنشاء الفاتورة'); return; }
      await (api as any).updateBillAggregatedItems(newId, { items: payloadItems });
      setLoyal(null);
      if (refreshSingleBill) refreshSingleBill({ _id: newId });
      feedRef.current?.prepend(created._id ? created : { ...created, _id: newId });
      void feedRef.current?.refreshFirstPage();
      setBillToEdit(created._id ? created : { ...created, _id: created.id });
    } catch (e: any) { palert(e?.message || 'فشل إعادة الطلب'); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-2.5 sm:p-6 space-y-4 sm:space-y-5">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-blue-100 dark:border-gray-700 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow text-white text-xl sm:text-2xl flex-shrink-0">🛵</div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white">الدليفري</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{stats.total} طلب — رسوم {stats.fees.toFixed(2)} ج.م</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { const v = compact ? 'comfortable' : 'compact'; setDensity(v); try { localStorage.setItem('deliveryDensity', v); } catch {} }} title="تبديل العرض" className="px-3 py-2 text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300">
              {compact ? '⊞ مريح' : '⊟ مضغوط'}
            </button>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={autoPrint} onChange={e => { setAutoPrint(e.target.checked); try { localStorage.setItem('deliveryAutoPrint', e.target.checked ? '1' : '0'); } catch {} }} className="w-4 h-4 accent-blue-600" />
              طباعة تلقائية عند الخروج
            </label>
            <button onClick={() => setShowForm(true)} className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow flex items-center gap-2">
              <Plus className="h-4 w-4" /> دليفري جديد
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'الكل', value: stats.total },
            { label: 'جديد', value: stats.draft },
            { label: 'جزئي', value: stats.partial },
            { label: 'مدفوع', value: stats.paid },
          ].map(s => (
            <div key={s.label} className="bg-blue-50/60 dark:bg-gray-700/50 rounded-xl p-3 text-center border border-blue-100 dark:border-gray-600">
              <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
              <div className="text-xl font-extrabold text-gray-900 dark:text-white">{s.value}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <div className="rounded-xl p-3 text-center border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"><div className="text-xs text-gray-500">متوسط التحضير</div><div className="text-lg font-extrabold">{analytics.avgPrep !== null ? `${analytics.avgPrep} د` : '—'}</div></div>
          <div className="rounded-xl p-3 text-center border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"><div className="text-xs text-gray-500">متوسط التوصيل</div><div className="text-lg font-extrabold">{analytics.avgDel !== null ? `${analytics.avgDel} د` : '—'}</div></div>
          <div className="rounded-xl p-3 text-center border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"><div className="text-xs text-gray-500">في الموعد (≤30د)</div><div className="text-lg font-extrabold">{analytics.onTime !== null ? `${analytics.onTime}%` : '—'}</div></div>
          <div className="rounded-xl p-3 text-center border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"><div className="text-xs text-gray-500">طلبات مُسلّمة</div><div className="text-lg font-extrabold">{analytics.n}</div></div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl p-4 text-center border-2 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <div className="text-xs font-bold text-amber-700 dark:text-amber-300">🟡 جديد</div>
          <div className="text-2xl font-extrabold">{follow.prep}</div>
        </div>
        <div className="rounded-2xl p-4 text-center border-2 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="text-xs font-bold text-blue-700 dark:text-blue-300">🔵 جزئي</div>
          <div className="text-2xl font-extrabold">{follow.out}</div>
        </div>
        <div className={`rounded-2xl p-4 text-center border-2 ${follow.late > 0 ? 'bg-red-50 dark:bg-red-900/30 border-red-400 animate-pulse' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
          <div className={`text-xs font-bold ${follow.late > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-500'}`}>🔴 متأخر</div>
          <div className={`text-2xl font-extrabold ${follow.late > 0 ? 'text-red-700 dark:text-red-300' : ''}`}>{follow.late}</div>
        </div>
      </div>

      <div className="rounded-2xl px-4 py-2.5 bg-blue-600 dark:bg-blue-800 text-white text-sm font-bold flex flex-wrap items-center gap-x-4 gap-y-1 shadow">
        <span>1️⃣ دليفري جديد</span><span>←</span><span>2️⃣ أضف أصناف</span><span>←</span><span>3️⃣ اطبع وحصّل</span>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 p-3 flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5">
          {([['unpaid', 'غير مدفوعة'], ['paid', 'مدفوعة'], ['all', 'الكل']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setBillFilter(v)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors ${billFilter === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto relative w-full sm:w-64">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث هاتف/اسم/عنوان/رقم..." className="w-full pr-9 pl-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {feed.items.map((bill: any) => (
              <div key={String(bill._id || bill.id)}>
                <BillTableCard bill={bill} kind="delivery" compact={compact} showPhone={canSeeContacts}
                  method={payMethods[String(bill._id || bill.id)] || 'cash'} onMethodChange={(m) => setPayMethods(p => ({ ...p, [String(bill._id || bill.id)]: m }))}
                  onOpen={setBillToEdit} onAddItems={setBillToEdit} onEditItems={setBillToEdit}
                  onCollect={handleCollect} onPrint={handlePrint} onMove={setMoveBill} onWhatsApp={handleWhatsApp}
                  onDelete={handleDelete} onCustomer={openLoyalty} onPayItems={setPayItemsBill} onPrepPrint={handlePrepPrint}
                  onDriverSave={(b, name) => updateStatus(b, b.deliveryInfo?.status || 'preparing', { driver: name })}>
                  <FinanceStrip bill={bill} method={payMethods[String(bill._id || bill.id)] || 'cash'} onPartial={handlePartial} onDiscount={handleDiscount} onPayItems={setPayItemsBill} />
                </BillTableCard>
              </div>
            ))}
        {feed.items.length===0 && !feed.refreshing && !feed.loading && <div className="col-span-full text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400">لا توجد طلبات — اضغط "دليفري جديد"</div>}
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
          <button onClick={() => feed.loadMore()} className="ml-2 text-sm font-bold text-blue-600 underline">إعادة المحاولة</button>
        </div>
      )}
      {!feed.hasMore && feed.items.length > 0 && (
        <div className="text-center text-xs text-gray-400 py-2">— تم عرض الكل ({feed.total}) —</div>
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
        onSuccess={(updated: any) => { applyBill(updated?._id || updated?.id || billToEdit?._id || billToEdit?.id, updated); setBillToEdit(null); setPendingNewId(null); }}
        onPrepPrint={handlePrepPrint}
      />

      {loyal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setLoyal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-md border" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">⭐ سجل العميل</h3>
            <div className="mt-2 font-bold">{loyal.name} — {loyal.phone}</div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="rounded-xl bg-gray-50 dark:bg-gray-700 p-3 text-center"><div className="text-xs text-gray-500">طلبات</div><div className="text-xl font-extrabold">{loyal.count}</div></div>
              <div className="rounded-xl bg-gray-50 dark:bg-gray-700 p-3 text-center"><div className="text-xs text-gray-500">إجمالي</div><div className="text-xl font-extrabold">{loyal.total.toFixed(0)}</div></div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-center"><div className="text-xs text-gray-500">نقاط</div><div className="text-xl font-extrabold text-amber-600">{loyal.points}</div></div>
            </div>
            <div className="mt-3 space-y-1">
              {loyal.recent.map((b: any) => (
                <div key={b._id || b.id} className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 py-1.5">
                  <span className="font-mono">#{String(b.billNumber || b._id).slice(-6)} — {fmtDT(b.createdAt)}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-bold">{(b.total || 0).toFixed(2)}</span>
                    <button onClick={() => reorder(b)} title="إعادة نفس الطلب" className="px-2 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg">↻ نفس الطلب</button>
                  </span>
                </div>
              ))}
            </div>
            <button onClick={() => setLoyal(null)} className="mt-4 w-full py-2 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold">إغلاق</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-md border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-extrabold mb-4 text-gray-900 dark:text-white flex items-center gap-2">🛵 دليفري جديد</h3>
            <div className="space-y-3">
              <input type="text" placeholder="اسم العميل" value={draft.customerName} onChange={e => setDraft({ ...draft, customerName: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" />
              <input type="text" placeholder="رقم الهاتف *" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" />
              {(() => {
                const q = draft.phone.replace(/\D/g, '');
                const qn = draft.customerName.trim();
                if (q.length < 2 && qn.length < 2) return null;
                const matches = loadDeviceCustomers().filter((c) => {
                  const cp = c.phone.replace(/\D/g, '');
                  return (q.length >= 2 && cp.includes(q) && cp !== q) || (qn.length >= 2 && (c.name || '').includes(qn));
                }).slice(0, 5);
                if (matches.length === 0) return null;
                return (
                  <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 overflow-hidden">
                    {matches.map((c) => (
                      <button
                        key={c.phone}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, customerName: d.customerName || c.name, phone: c.phone, address: d.address || c.address }))}
                        className="w-full text-right px-3 py-2 hover:bg-violet-100 dark:hover:bg-violet-900/40 text-sm border-b border-violet-100 dark:border-violet-800 last:border-b-0"
                      >
                        <span className="font-bold text-gray-800 dark:text-gray-100">📱 {c.name || c.phone}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs mr-2" dir="ltr">{c.phone}</span>
                        {c.count > 1 && <span className="text-violet-600 dark:text-violet-300 text-xs mr-2">({c.count} طلبات)</span>}
                      </button>
                    ))}
                  </div>
                );
              })()}
              {knownCustomer && (
                <button onClick={fillKnown} className="w-full text-right text-xs bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl px-3 py-2 hover:bg-green-100">
                  ✓ عميل معروف ({knownCustomer.count} طلبات) — اضغط لتعبئة الاسم والعنوان والرسوم
                </button>
              )}
              <input type="text" placeholder="العنوان *" value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" />
              <div className="flex gap-2">
                <select value={draft.zone} onChange={e => { const z = zones.find(zz => zz.name === e.target.value); setDraft({ ...draft, zone: e.target.value, deliveryFee: z ? String(z.fee) : draft.deliveryFee }); }} className="flex-1 px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm">
                  <option value="">منطقة... (اختياري)</option>
                  {zones.map(z => <option key={z.name} value={z.name}>{z.name} — {z.fee} ج.م</option>)}
                </select>
                <input type="number" placeholder="رسوم" value={draft.deliveryFee} onChange={e => setDraft({ ...draft, deliveryFee: e.target.value })} className="w-28 px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-sm" />
              </div>
              <div className="flex gap-2 items-center">
                <input type="text" placeholder="منطقة جديدة" value={newZone.name} onChange={e => setNewZone({ ...newZone, name: e.target.value })} className="flex-1 px-3 py-1.5 text-xs border rounded-lg bg-gray-50 dark:bg-gray-700" />
                <input type="number" placeholder="رسم" value={newZone.fee} onChange={e => setNewZone({ ...newZone, fee: e.target.value })} className="w-20 px-2 py-1.5 text-xs border rounded-lg bg-gray-50 dark:bg-gray-700" />
                <button onClick={addZone} className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-600 rounded-lg font-bold">＋</button>
              </div>
              {zones.length > 0 && <div className="flex flex-wrap gap-1">{zones.map(z => <span key={z._id || z.name} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{z.name} <button onClick={() => removeZone(z)} className="text-red-500 ml-1">×</button></span>)}</div>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600">إلغاء</button>
              <button onClick={handleCreate} disabled={creating} className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow disabled:opacity-50">{creating ? 'جاري...' : 'إنشاء'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Delivery;
