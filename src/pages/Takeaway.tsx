import { useState, useEffect, useMemo, memo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { Bill } from '../services/api';
import { printBill } from '../utils/printBill';
import { Search, Plus } from 'lucide-react';
import BillItemsEditModal from '../components/tables/BillItemsEditModal';
import ItemPartialPayModal from '../components/tables/ItemPartialPayModal';
import { canDeleteBill, canViewCustomerContacts } from '../utils/permissionHelper';
import { useInfiniteList } from '../hooks/useInfiniteList';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../utils/apiBase';

import BillTableCard from '../components/tables/BillTableCard';
import { getShortBillNumber } from '../utils/formatters';
import ChangeTableModal from '../components/tables/ChangeTableModal';

import OrderPrintSectionsModal from '../components/tables/OrderPrintSectionsModal';
import { startBillPrep, confirmBillPrep } from '../utils/orderSectionPrint';

// شريط الخصم أسفل الكارت
const DiscountStrip = memo(({ bill, onDiscount }: { bill: any; onDiscount: (b: any, d: number, t: 'amount' | 'percent') => void }) => {
  const [open, setOpen] = useState(false);
  const [disc, setDisc] = useState('');
  const [discType, setDiscType] = useState<'amount' | 'percent'>('amount');
  return (
    <div className="mt-1">
      <button onClick={() => setOpen(v => !v)} className="w-full py-1 text-[11px] font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-500">💰 خصم</button>
      {open && (
        <div className="mt-1 flex gap-1">
          <input type="number" min="0" placeholder={discType === 'percent' ? `% (الحالي ${bill.discountPercentage || 0}%)` : `خصم (الحالي ${bill.discount || 0})`} value={disc} onChange={e => setDisc(e.target.value)} className="flex-1 px-2 py-1.5 text-xs border rounded-lg bg-white dark:bg-gray-700" />
          <button onClick={() => setDiscType(t => t === 'amount' ? 'percent' : 'amount')} title="تبديل مبلغ/نسبة" className="px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-gray-700 border rounded-lg text-gray-600">{discType === 'amount' ? 'ج.م' : '%'}</button>
          <button onClick={() => { const d = Number(disc); if (disc === '' || d < 0 || (discType === 'percent' && d > 100)) return; onDiscount(bill, d, discType); setDisc(''); }} className="px-3 py-1.5 text-xs font-bold bg-gray-600 hover:bg-gray-700 text-white rounded-lg">خصم</button>
        </div>
      )}
    </div>
  );
});
DiscountStrip.displayName = 'DiscountStrip';


const Takeaway = () => {
  const { bills, fetchBills, setBills, refreshSingleBill, user, tables, menuItems, menuSections, menuCategories, fetchMenuItems, fetchMenuSections, fetchMenuCategories, showNotification } = useApp() as any;
  const { t, i18n } = useTranslation();
  const [moveBill, setMoveBill] = useState<any | null>(null);
  const [payMethods, setPayMethods] = useState<Record<string, string>>({});
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
    } catch { showNotification('فشل طباعة التحضير', 'error'); }
  };
  const confirmPrepPrint = async () => {
    if (!prepSelection || prepSelected.length === 0) return;
    const sel = prepSelection;
    setPrepSelection(null);
    await confirmBillPrep(sel.orders, prepSelected, sel.menuItemsMap, prepCtx()).catch(() => showNotification('فشل طباعة التحضير', 'error'));
  };

  const handlePrint = async (bill: any) => {
    try { await printBill(bill, (user as any)?.organizationName, i18n.language, t); showNotification('تم إرسال الطباعة', 'success'); }
    catch (e: any) { showNotification(e?.message || 'فشل الطباعة', 'error'); }
  };

  const handleMoveToTable = async (tableId: string) => {
    if (!moveBill) return;
    const id = moveBill._id || moveBill.id;
    try {
      const res: any = await (api as any).updateBill(id, { table: tableId, fulfillmentType: 'dine_in' });
      setMoveBill(null);
      setBills((prev: any[]) => prev.filter((b: any) => String(b._id || b.id) !== String(id)));
      feedRef.current?.remove(String(id));
      showNotification(res?.message || 'تم نقل الفاتورة إلى الطاولة', 'success');
      void fetchBills();
    } catch (e: any) { showNotification(e?.message || 'فشل النقل', 'error'); }
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
  const [pendingNewId, setPendingNewId] = useState<string | null>(null);
  const [payItemsBill, setPayItemsBill] = useState<any | null>(null);

  const handleDiscount = async (bill: any, discount: number, type: 'amount' | 'percent' = 'amount') => {
    const id = bill._id || bill.id;
    try {
      const payload = type === 'percent' ? { discountPercentage: discount, discount: 0 } : { discount, discountPercentage: 0 };
      const res: any = await (api as any).updateBill(id, payload);
      applyBill(id, res?.success ? res.data : null);
      if (res?.success) showNotification('تم تطبيق الخصم', 'success');
    } catch (e: any) { showNotification(e?.message || 'فشل الخصم', 'error'); refreshSingleBill?.({ _id: id }); }
  };

  // إغلاق نافذة الأصناف: لو الفاتورة المنشأة حديثاً بلا أصناف ولا مدفوع → تُحذف تلقائياً (مثل الطاولات: لا فاتورة فارغة)
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
    if (!canDeleteBill(user)) { showNotification('غير مصرح — تحتاج صلاحية حذف الفواتير', 'error'); return; }
    const id = bill._id || bill.id;
    setBills((prev: any[]) => prev.filter((b: any) => String(b._id || b.id) !== String(id)));
    feedRef.current?.remove(String(id));
    try {
      const res: any = await (api as any).deleteBill(id);
      if (res?.success) {
        showNotification('تم حذف الفاتورة بنجاح', 'success');
        void fetchBills();
      } else {
        showNotification('فشل حذف الفاتورة', 'error');
        refreshSingleBill?.({ _id: id });
      }
    } catch (e: any) { showNotification(e?.message || 'فشل الحذف', 'error'); refreshSingleBill?.({ _id: id }); }
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
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [billFilter, setBillFilter] = useState<'unpaid' | 'paid' | 'all'>('unpaid');
  const billFilterRef = useRef(billFilter);
  billFilterRef.current = billFilter;
  const [density, setDensity] = useState(() => { try { return localStorage.getItem('takeawayDensity') || 'comfortable'; } catch { return 'comfortable'; } });
  const compact = density === 'compact';
  const [creating, setCreating] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(t); }, [search]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  // ── Infinite scroll من السيرفر (25/صفحة) بدل الجلب الكامل ──
  const feed = useInfiniteList<any>({
    pageSize: 25,
    depsKey: `${debouncedSearch.trim()}|${billFilter}`,
    getId: (b: any) => String(b?._id || b?.id || ''),
    fetchPage: async (pageNum, limitNum) => {
      const res: any = await (api as any).getBills({
        fulfillmentType: 'takeaway',
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

  // دمج فواتير التيك أوي لحظياً (إنشاء/تحديث/حذف) دون إعادة الصفحات
  useEffect(() => {
    let socket: Socket | null = null;
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
        const f = billFilterRef.current;
        if (f === 'paid') return b.status === 'paid';
        if (f === 'all') return true;
        return !['paid', 'cancelled'].includes(b.status);
      };
      socket.on('bill:created', (b: any) => { try { if (matches(b)) feedRef.current?.prepend(b); } catch {} });
      socket.on('bill:updated', (b: any) => {
        try {
          if (!b) return;
          const id = String(b._id || b.id || '');
          if (!id) return;
          if (matches(b)) feedRef.current?.upsert(b);
          else feedRef.current?.remove(id);
        } catch {}
      });
      socket.on('bill:deleted', (b: any) => {
        try {
          const id = String(b?._id || b?.id || b || '');
          if (id) feedRef.current?.remove(id);
        } catch {}
      });
    } catch {}
    return () => { try { socket?.disconnect(); } catch {} };
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

  const handleCreate = async () => {
    setCreating(true);
    try {
      // فشل الإنشاء يجب أن يظهر رسالته — لا بديل صامت يبتلع الخطأ.
      const res: any = await (api as any).createBill({ fulfillmentType: 'takeaway', billType: 'cafe' });
      if (!res?.success) {
        showNotification(res?.message || 'فشل الإنشاء', 'error');
        return;
      }
      const created = res?.data || res;
      const newId = created?._id || created?.id;
      if (newId) {
        if (refreshSingleBill) refreshSingleBill({ _id: newId });
        if (created) feedRef.current?.prepend(created._id ? created : { ...created, _id: newId });
        void feedRef.current?.refreshFirstPage();
      }
      // فتح المنيو فوراً — لا بحث عن الكارت (وتُحذف تلقائياً لو أُغلقت فارغة)
      if (newId) { setPendingNewId(String(newId)); setBillToEdit(created._id ? created : { ...created, _id: created.id }); }
    } catch (e: any) { showNotification(e?.message || 'فشل الإنشاء', 'error'); }
    finally { setCreating(false); }
  };

  // تحصيل مباشر مع تأكيد داخل الكارت (بلا نافذة دفع).
  const handleCollect = async (bill: any, method: string) => {
    const amount = Number(bill.remaining) || 0;
    if (amount <= 0) return;
    const id = bill._id || bill.id;
    setBills((prev: any[]) => prev.map((b: any) => {
      if (String(b._id || b.id) !== String(id)) return b;
      const paid = (Number(b.paid) || 0) + amount;
      const remaining = Math.max(0, (Number(b.total) || 0) - paid);
      return { ...b, paid, remaining, status: remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : b.status };
    }));
    try {
      const res: any = await (api as any).addPayment(id, { amount, method, reference: method === 'e_wallet' ? 'محفظة إلكترونية' : undefined });
      applyBill(id, res?.success ? res.data : null);
      if (res?.success) showNotification('تم التحصيل بنجاح', 'success');
    } catch (e: any) { showNotification(e?.message || 'فشل التحصيل', 'error'); refreshSingleBill?.({ _id: id }); }
  };

  const handleWhatsApp = (bill: any) => {
    const phone = String(bill.customerPhone || '').replace(/[^0-9]/g, '');
    if (!phone) { showNotification('لا يوجد رقم هاتف', 'warning'); return; }
    const lines = [`فاتورة #${String(bill.billNumber || bill._id).slice(-6)}`, `الإجمالي: ${(bill.total || 0).toFixed(2)} ج.م`, `المدفوع: ${(bill.paid || 0).toFixed(2)} — المتبقي: ${(bill.remaining || 0).toFixed(2)}`, 'شكراً لتعاملكم معنا'];
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-2.5 sm:p-6 space-y-4 sm:space-y-5">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-orange-100 dark:border-gray-700 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow text-white text-xl sm:text-2xl flex-shrink-0">🥡</div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white">تيك أوي</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{stats.total} طلب — {stats.revenue.toFixed(2)} ج.م إجمالي</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => { const v = compact ? 'comfortable' : 'compact'; setDensity(v); try { localStorage.setItem('takeawayDensity', v); } catch {} }} title="تبديل العرض" className="px-3 py-2 text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300">
              {compact ? '⊞ مريح' : '⊟ مضغوط'}
            </button>
            <button onClick={handleCreate} disabled={creating} className="flex-1 sm:flex-none px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-bold shadow disabled:opacity-50 flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" /> {creating ? 'جاري...' : 'تيك أوي جديد'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'الكل', value: stats.total, color: 'gray' },
            { label: 'جديد', value: stats.draft, color: 'blue' },
            { label: 'جزئي', value: stats.partial, color: 'amber' },
            { label: 'متبقي', value: stats.remaining.toFixed(0), color: 'green' },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center border border-gray-100 dark:border-gray-600">
              <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
              <div className="text-xl font-extrabold text-gray-900 dark:text-white">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl px-4 py-2.5 bg-green-600 dark:bg-green-800 text-white text-sm font-bold flex flex-wrap items-center gap-x-4 gap-y-1 shadow">
        <span>1️⃣ تيك أوي جديد</span><span>←</span><span>2️⃣ الزر الكبير يكمل الخطوة</span><span>←</span><span>3️⃣ تحصيل</span>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 p-3 flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5">
          {([['unpaid', 'غير مدفوعة'], ['paid', 'مدفوعة'], ['all', 'الكل']] as const).map(([v, label]) => (
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
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم/اسم/هاتف..." className="w-full pr-9 pl-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none text-gray-900 dark:text-gray-100" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {feed.items.map((bill: any) => (
          <div key={String(bill._id || bill.id)}>
            <BillTableCard bill={bill} kind="takeaway" compact={compact} showPhone={canViewCustomerContacts(user)}
              method={payMethods[String(bill._id || bill.id)] || 'cash'} onMethodChange={(m) => setPayMethods(p => ({ ...p, [String(bill._id || bill.id)]: m }))}
              onOpen={setBillToEdit} onAddItems={setBillToEdit} onEditItems={setBillToEdit}
              onCollect={handleCollect} onPrint={handlePrint} onMove={setMoveBill} onPayItems={setPayItemsBill}
              onPrepPrint={handlePrepPrint}
              onWhatsApp={handleWhatsApp} onDelete={handleDelete}>
              <DiscountStrip bill={bill} onDiscount={handleDiscount} />
            </BillTableCard>
          </div>
        ))}
        {feed.items.length===0 && !feed.refreshing && !feed.loading && <div className="col-span-full text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400">لا توجد طلبات — اضغط "تيك أوي جديد"</div>}
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
      {payItemsBill && (
        <ItemPartialPayModal
          bill={payItemsBill}
          onClose={() => setPayItemsBill(null)}
          onSuccess={(updated: any) => { applyBill(updated?._id || updated?.id || payItemsBill?._id, updated); setPayItemsBill(null); }}
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
        menuItems={menuItems || []}
        menuSections={menuSections || []}
        menuCategories={menuCategories || []}
        onSuccess={(updated: any) => { applyBill(updated?._id || updated?.id || billToEdit?._id || billToEdit?.id, updated); setBillToEdit(null); }}
        onPrepPrint={handlePrepPrint}
      />
    </div>
  );
};
export default Takeaway;
