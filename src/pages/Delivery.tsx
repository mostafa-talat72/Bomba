import { useState, useEffect, useMemo, memo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useTranslation } from 'react-i18next';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../utils/apiBase';
import api from '../services/api';
import { Bill } from '../services/api';
import { printBill } from '../utils/printBill';
import BillItemsEditModal from '../components/tables/BillItemsEditModal';
import ItemPartialPayModal from '../components/tables/ItemPartialPayModal';
import { canDeleteBill } from '../utils/permissionHelper';
import { Search, Plus, Truck, Phone, MapPin, DollarSign, Clock, ChevronLeft, ChevronRight, MessageCircle, Wallet, User } from 'lucide-react';
import { isSoundEnabled, playWarnBeep, playDangerBeep } from '../utils/sound';
import { canViewCustomerContacts } from '../utils/permissionHelper';
import { toast } from 'react-toastify';

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


const DeliveryCard = memo(({ bill, onStatus, onCollect, onWhatsApp, onCustomer, onAddItems, onPartial, onDiscount, onDelete, onPrint, onMove, onPayItems, compact, canSeeContacts }: {
  bill: any; onStatus: (b: any, s: string, extra?: any) => void;
  onCollect: (b: any, method: string) => void; onWhatsApp: (b: any) => void; onCustomer: (b: any) => void;
  onAddItems: (b: any) => void; onPartial: (b: any, amount: number, method: string) => void; onDiscount: (b: any, discount: number, type: 'amount' | 'percent') => void; onDelete: (b: any) => void;
  onPrint: (b: any) => void; onMove: (b: any) => void; onPayItems: (b: any) => void;
  compact?: boolean; canSeeContacts?: boolean;
}) => {
  const [method, setMethod] = useState('cash');
  const [driver, setDriver] = useState(bill.deliveryInfo?.driver || '');
  const [showMore, setShowMore] = useState(false);
  const [partAmount, setPartAmount] = useState('');
  const [disc, setDisc] = useState('');
  const [discType, setDiscType] = useState<'amount' | 'percent'>('amount');
  const [confirmDel, setConfirmDel] = useState(false);
  const st = bill.deliveryInfo?.status || 'preparing';
  const hasItems = (bill.orders?.length || 0) > 0;
  const remaining = Number(bill.remaining) || 0;
  // خطوة واحدة مثل الفاتورة: أصناف ← طباعة ← تحصيل (الحالة تُختم تلقائياً في الخلفية)
  const primary = !hasItems
    ? { label: '+ أضف أصناف', cls: 'bg-purple-600 hover:bg-purple-700', act: () => onAddItems(bill) }
    : remaining > 0
      ? { label: `تحصيل ${remaining.toFixed(0)} ج.م`, cls: 'bg-emerald-600 hover:bg-emerald-700', act: () => onCollect(bill, method) }
      : null;
  return (
    <div className={`group ${compact ? 'p-2' : 'p-4'} border-2 border-gray-100 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 hover:border-blue-200 hover:shadow-lg transition-all will-change-transform`}>
      <div className="flex justify-between items-start">
        <span className="font-mono font-bold text-gray-900 dark:text-white">#{String(bill.billNumber || bill._id).slice(-6)}</span>
        <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${bill.status==='paid'?'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800': bill.status==='partial'?'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800':'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'}`}>{bill.status==='paid'?'مدفوع': bill.status==='partial'?'جزئي':'جديد'}</span>
      </div>
      <button onClick={() => onCustomer(bill)} className="mt-2 font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline flex items-center gap-1"><User className="h-4 w-4 text-gray-400" />{bill.deliveryInfo?.customerName || bill.customerName || '—'}</button>
      <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1">
        <Phone className="h-3.5 w-3.5 text-gray-400" />
        {bill.deliveryInfo?.phone
          ? (canSeeContacts
            ? <><a href={`tel:${bill.deliveryInfo.phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">{bill.deliveryInfo.phone}</a><a href={`https://wa.me/${String(bill.deliveryInfo.phone).replace(/[^0-9]/g,'')}`} target="_blank" rel="noreferrer" className="ml-2 text-green-600 hover:underline text-xs">واتساب</a></>
            : <span className="text-gray-400 tracking-widest">•••••••••••</span>)
          : '—'}
      </div>
      {!compact && (
        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate"><MapPin className="h-3 w-3" />{bill.deliveryInfo?.address
          ? (canSeeContacts
            ? <a href={`https://maps.google.com/?q=${encodeURIComponent(bill.deliveryInfo.address)}`} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline truncate">{bill.deliveryInfo.address}</a>
            : <span className="text-gray-400 tracking-widest">••••••</span>)
          : '—'}</div>
      )}
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400"><DollarSign className="h-4 w-4" />{(bill.total||0).toFixed(2)} ج.م</span>
        <span className="text-xs text-gray-400">متبقي {(bill.remaining||0).toFixed(2)} {bill.deliveryInfo?.deliveryFee ? `· توصيل ${bill.deliveryInfo.deliveryFee}` : ''}</span>
      </div>
      {!compact && (
        <div className="mt-1 flex items-center gap-1 text-xs text-gray-400"><Clock className="h-3 w-3" />{fmtDT(bill.createdAt)}{bill.deliveryInfo?.driver ? ` — ${bill.deliveryInfo.driver}` : ''}</div>
      )}
      <div className="flex items-center gap-1 mt-2">
        <Truck className="h-3.5 w-3.5 text-gray-400" />
        <input defaultValue={driver} placeholder="السائق" onBlur={e => { const v = e.target.value.trim(); setDriver(v); if (v !== (bill.deliveryInfo?.driver || '')) onStatus(bill, st, { driver: v }); }} className="flex-1 px-2 py-1.5 min-h-9 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200" />
      </div>
      {primary ? (
        <button onClick={primary.act} className={`mt-2 w-full py-2.5 rounded-xl text-sm font-extrabold text-white shadow ${primary.cls}`}>{primary.label}</button>
      ) : (
        <div className="mt-2 w-full py-2.5 rounded-xl text-sm font-extrabold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-center border border-green-200 dark:border-green-800">✓ تم التحصيل بالكامل</div>
      )}
      {hasItems && (
        <button onClick={() => onPrint(bill)} className="mt-1.5 w-full py-2 rounded-xl text-sm font-extrabold bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-300 hover:shadow">🖨 طباعة الفاتورة</button>
      )}
      <div className="flex gap-1 mt-1.5">
        <select value={method} onChange={e => setMethod(e.target.value)} title="طريقة الدفع" className="px-1.5 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
          <option value="cash">نقدي</option>
          <option value="card">كارت</option>
          <option value="transfer">تحويل</option>
          <option value="e_wallet">محفظة</option>
        </select>
        {remaining > 0 && hasItems && (
          <button onClick={() => onCollect(bill, method)} className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1"><Wallet className="h-3.5 w-3.5" />تحصيل {remaining.toFixed(0)}</button>
        )}
        <button onClick={() => setShowMore(v => !v)} title="المزيد" className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500">⋯</button>
      </div>
      {showMore && (
        <div className="mt-1.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 space-y-2">
          <div className="flex gap-1">
            <button onClick={() => onAddItems(bill)} className="flex-1 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center gap-1"><Plus className="h-3.5 w-3.5" />إضافة أصناف</button>
            <button onClick={() => onWhatsApp(bill)} className="flex-1 py-1.5 text-xs font-bold border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg flex items-center justify-center gap-1"><MessageCircle className="h-3.5 w-3.5" />واتساب</button>
          </div>
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
          <div className="flex gap-1">
            <button onClick={() => onPrint(bill)} className="flex-1 py-1.5 text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100">🖨 طباعة</button>
            <button onClick={() => onMove(bill)} className="flex-1 py-1.5 text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100">🪑 نقل لطاولة</button>
          </div>
          <button onClick={() => { if (confirmDel) { setConfirmDel(false); onDelete(bill); } else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000); } }} className={`w-full py-1.5 text-xs font-bold rounded-lg border ${confirmDel ? 'bg-red-600 hover:bg-red-700 text-white border-red-700' : 'bg-white dark:bg-gray-700 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'}`}>{confirmDel ? 'تأكيد الحذف؟' : '🗑 حذف الفاتورة'}</button>
        </div>
      )}
    </div>
  );
});
DeliveryCard.displayName = 'DeliveryCard';

const loadZonesLocal = (): Array<{ name: string; fee: number }> => {
  try { const r = JSON.parse(localStorage.getItem('deliveryZones') || '[]'); return Array.isArray(r) ? r : []; } catch { return []; }
};

const Delivery = () => {
  const { bills, fetchBills, setBills, refreshSingleBill, user, tables, menuItems, menuSections, menuCategories, fetchMenuItems, fetchMenuSections, fetchMenuCategories } = useApp() as any;
  const [moveBill, setMoveBill] = useState<any | null>(null);

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
        palert(res?.message || 'تم نقل الفاتورة إلى الطاولة', true);
      void fetchBills();
    } catch (e: any) { palert(e?.message || 'فشل النقل'); }
  };
  const canSeeContacts = canViewCustomerContacts(user);

  // تحديث فاتورة واحدة لحظياً (optimistic + تأكيد) بدل جلب المئات كل مرة
  const applyBill = (id: any, updated: any) => {
    if (updated) setBills((prev: any[]) => prev.map((b: any) => String(b._id || b.id) === String(id) ? updated : b));
    else if (refreshSingleBill) refreshSingleBill({ _id: id });
  };
  const { t, i18n } = useTranslation();
  const [autoPrint, setAutoPrint] = useState(() => { try { return localStorage.getItem('deliveryAutoPrint') !== '0'; } catch { return true; } });
  const [density, setDensity] = useState(() => { try { return localStorage.getItem('deliveryDensity') || 'comfortable'; } catch { return 'comfortable'; } });
  const compact = density === 'compact';
  const [filter, setFilter] = useState<'all' | 'draft' | 'partial' | 'paid'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12;
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
      return () => {
        try {
          socket.off('delivery-zones-changed', onZonesChanged);
          socket.off('lan:remote-change');
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
      }
    } catch {}
  };

  // نفس معاملة حذف فواتير الطاولات: فحص صلاحية أولاً ثم حذف متفائل + مزامنة خلفية
  const handleDelete = async (bill: any) => {
    if (!canDeleteBill(user)) { palert('غير مصرح — تحتاج صلاحية حذف الفواتير'); return; }
    const id = bill._id || bill.id;
    setBills((prev: any[]) => prev.filter((b: any) => String(b._id || b.id) !== String(id)));
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
  useEffect(() => { setPage(1); }, [filter, debouncedSearch]);

  useEffect(() => { fetchBills(); }, [fetchBills]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !(e.target as HTMLElement)?.matches('input,textarea,select')) { e.preventDefault(); setShowForm(true); }
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !(e.target as HTMLElement)?.matches('input,textarea,select')) { e.preventDefault(); document.querySelector<HTMLInputElement>('input[placeholder*="بحث"]')?.focus(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const list: Bill[] = useMemo(() => (bills || []).filter((b: any) => (b.fulfillmentType || 'dine_in') === 'delivery'), [bills]);

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

  const filtered = useMemo(() => {
    let r = filter === 'all' ? list : list.filter((b: any) => b.status === filter);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      r = r.filter((b: any) => String(b.billNumber || b._id).toLowerCase().includes(q) || String(b.deliveryInfo?.phone || b.customerPhone || '').includes(q) || String(b.deliveryInfo?.customerName || b.customerName || '').toLowerCase().includes(q) || String(b.deliveryInfo?.address || '').toLowerCase().includes(q));
    }
    return r.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [list, filter, debouncedSearch]);
  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

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
      const res: any = await (api as any).createBill?.(body) || await (api as any).request('/bills', { method: 'POST', body: JSON.stringify(body) });
      const created = res?.data || res;
      setShowForm(false); setDraft({ customerName: '', phone: '', address: '', deliveryFee: '', zone: '' });
      const newId = created?._id || created?.id;
      if (newId && refreshSingleBill) refreshSingleBill({ _id: newId });
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

  const handleCollect = async (bill: any, method: string) => {
    const amount = Number(bill.remaining) || 0;
    if (amount <= 0) return;
    const id = bill._id || bill.id;
    optimisticPay(bill, amount);
    try {
      const res: any = await (api as any).addPayment(id, { amount, method, reference: method === 'e_wallet' ? 'محفظة إلكترونية' : undefined });
      applyBill(id, res?.success ? res.data : null);
      // ختم التسليم تلقائياً عند اكتمال التحصيل (خطوة واحدة مثل الفاتورة)
      if (res?.success && (bill.deliveryInfo?.status || 'preparing') !== 'delivered') {
        await updateStatus(res.data || { ...bill, paid: (Number(bill.paid) || 0) + amount, remaining: 0 }, 'delivered');
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
        <div className="flex gap-2 flex-wrap">
          {(['all','draft','partial','paid'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s as any)} className={`px-3.5 py-1.5 rounded-full border text-sm font-bold ${filter===s?'bg-blue-600 text-white border-blue-700 shadow':'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-300'}`}>{s==='all'?'الكل': s==='draft'?'جديد': s==='partial'?'جزئي':'مدفوع'}</button>
          ))}
        </div>
        <div className="ml-auto relative w-full sm:w-64">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث هاتف/اسم/عنوان/رقم..." className="w-full pr-9 pl-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {paginated.map((bill: any) => <DeliveryCard key={bill._id || bill.id} bill={bill} compact={compact} onStatus={updateStatus} onCollect={handleCollect} onWhatsApp={handleWhatsApp} onCustomer={openLoyalty} onAddItems={setBillToEdit} onPartial={handlePartial} onDiscount={handleDiscount} onDelete={handleDelete} onPrint={handlePrint} onMove={setMoveBill} onPayItems={setPayItemsBill} canSeeContacts={canSeeContacts} />)}
        {filtered.length===0 && <div className="col-span-full text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400">لا توجد طلبات — اضغط "دليفري جديد"</div>}
      </div>
      {filtered.length > pageSize && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page===1} className="p-2 rounded-lg border bg-white dark:bg-gray-800 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          <span className="text-sm text-gray-600 dark:text-gray-300">صفحة {page} / {totalPages} — {filtered.length} طلب</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page===totalPages} className="p-2 rounded-lg border bg-white dark:bg-gray-800 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
        </div>
      )}

      {moveBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setMoveBill(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-4 sm:p-5 w-full max-w-md border" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mb-1">🪑 نقل لطاولة</h3>
            <p className="text-xs text-gray-500 mb-3">فاتورة #{String(moveBill.billNumber || moveBill._id).slice(-6)} — الطاولة الفارغة تنقل مباشرة، والمشغولة تدمج فيها (نفس الطاولات)</p>
            <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
              {(tables || []).map((tb: any) => (
                <button key={tb._id || tb.id} onClick={() => handleMoveToTable(String(tb._id || tb.id))} className="py-2.5 rounded-xl border text-sm font-extrabold bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-orange-400 hover:shadow">
                  {tb.number ?? '?'}
                </button>
              ))}
            </div>
            <button onClick={() => setMoveBill(null)} className="mt-3 w-full py-2 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold">إلغاء</button>
          </div>
        </div>
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
