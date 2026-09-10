import { useState, useEffect, useMemo, memo } from 'react';
import { useApp } from '../context/AppContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { Bill } from '../services/api';
import { printBill } from '../utils/printBill';
import { Search, Plus, Package, Clock, DollarSign, ChevronLeft, ChevronRight, MessageCircle, Wallet } from 'lucide-react';
import BillItemsEditModal from '../components/tables/BillItemsEditModal';
import ItemPartialPayModal from '../components/tables/ItemPartialPayModal';
import { canDeleteBill } from '../utils/permissionHelper';

const BillCard = memo(({ bill, onCollect, onWhatsApp, onAddItems, onDelete, onPrint, onMove, onPayItems, onDiscount, compact }: { bill: any; onCollect: (b: any, m: string) => void; onWhatsApp: (b: any) => void; onAddItems: (b: any) => void; onDelete: (b: any) => void; onPrint: (b: any) => void; onMove: (b: any) => void; onPayItems: (b: any) => void; onDiscount: (b: any, d: number, t: 'amount' | 'percent') => void; compact?: boolean }) => {
  const [method, setMethod] = useState('cash');
  const [showMore, setShowMore] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [disc, setDisc] = useState('');
  const [discType, setDiscType] = useState<'amount' | 'percent'>('amount');
  const hasItems = (bill.orders?.length || 0) > 0;
  const remaining = Number(bill.remaining) || 0;
  const statusTheme = bill.status === 'paid'
    ? { strip: 'from-green-500 to-emerald-500', pill: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800', label: 'مدفوع' }
    : bill.status === 'partial'
      ? { strip: 'from-amber-500 to-orange-500', pill: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800', label: 'جزئي' }
      : { strip: 'from-blue-500 to-indigo-500', pill: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800', label: 'جديد' };
  return (
    <div className={`group ${compact ? '' : ''} border border-gray-100 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 hover:shadow-xl hover:-translate-y-0.5 transition-all will-change-transform overflow-hidden`}>
      <div className={`h-1.5 bg-gradient-to-l ${statusTheme.strip}`} />
      <div className={compact ? 'p-2.5' : 'p-4'}>
        <div className="flex justify-between items-center">
          <span className="font-mono font-extrabold text-base text-gray-900 dark:text-white tracking-tight">#{String(bill.billNumber || bill._id).slice(-6)}</span>
          <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold border ${statusTheme.pill}`}>{statusTheme.label}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <span className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0"><Package className="h-3.5 w-3.5 text-orange-500" /></span>
          <span className="font-semibold truncate">{bill.customerName || 'بدون اسم'}{bill.customerPhone ? <span className="text-gray-400 font-normal"> — {bill.customerPhone}</span> : ''}</span>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 px-3 py-2">
          <span className="text-[11px] text-gray-400 font-medium">الإجمالي</span>
          <span className="text-lg font-extrabold text-gray-900 dark:text-white">{(bill.total || 0).toFixed(2)} <span className="text-xs font-bold text-gray-400">ج.م</span></span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${remaining > 0 ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300'}`}>متبقي {remaining.toFixed(2)}</span>
        </div>
        {!compact && (
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-gray-400"><Clock className="h-3 w-3" />{new Date(bill.createdAt).toLocaleString('ar-EG')} — {bill.orders?.length || 0} أصناف</div>
        )}
        {!hasItems ? (
          <button onClick={() => onAddItems(bill)} className="mt-2.5 w-full py-2.5 rounded-xl text-sm font-extrabold text-white shadow-md shadow-purple-200 dark:shadow-none bg-gradient-to-l from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 active:scale-[0.99]">+ أضف أصناف</button>
        ) : remaining > 0 ? (
          <button onClick={() => onCollect(bill, method)} className="mt-2.5 w-full py-2.5 rounded-xl text-sm font-extrabold text-white shadow-md shadow-emerald-200 dark:shadow-none bg-gradient-to-l from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 active:scale-[0.99]">تحصيل {remaining.toFixed(0)} ج.م</button>
        ) : (
          <div className="mt-2.5 w-full py-2.5 rounded-xl text-sm font-extrabold bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-center border border-green-200 dark:border-green-800">✓ مدفوع بالكامل</div>
        )}
        <div className="flex gap-1.5 mt-2">
          <select value={method} onChange={e => setMethod(e.target.value)} title="طريقة الدفع" className="px-1.5 py-2 text-xs font-bold border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
            <option value="cash">نقدي</option>
            <option value="card">كارت</option>
            <option value="transfer">تحويل</option>
            <option value="e_wallet">محفظة</option>
          </select>
          <button onClick={() => setShowMore(v => !v)} title="المزيد" className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${showMore ? 'bg-gray-900 dark:bg-gray-600 text-white border-gray-900' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500'}`}>⋯ المزيد</button>
        </div>
        {showMore && (
          <div className="mt-2 p-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              {hasItems && (
                <button onClick={() => onAddItems(bill)} className="py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl flex items-center justify-center gap-1"><Plus className="h-3.5 w-3.5" />أصناف</button>
              )}
              <button onClick={() => onWhatsApp(bill)} className="py-2 text-xs font-bold border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-xl flex items-center justify-center gap-1"><MessageCircle className="h-3.5 w-3.5" />واتساب</button>
              <button onClick={() => onPayItems(bill)} className="py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl col-span-2">🧾 دفع أصناف محددة</button>
            </div>
            <div className="flex gap-1">
              <input type="number" min="0" placeholder={discType === 'percent' ? `خصم % (الحالي ${bill.discountPercentage || 0}%)` : `خصم (الحالي ${bill.discount || 0})`} value={disc} onChange={e => setDisc(e.target.value)} className="flex-1 px-2 py-2 text-xs border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700" />
              <button onClick={() => setDiscType(t => t === 'amount' ? 'percent' : 'amount')} title="تبديل مبلغ/نسبة" className="px-2.5 py-2 text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600">{discType === 'amount' ? 'ج.م' : '%'}</button>
              <button onClick={() => { const d = Number(disc); if (disc === '' || d < 0 || (discType === 'percent' && d > 100)) return; onDiscount(bill, d, discType); setDisc(''); }} className="px-3.5 py-2 text-xs font-bold bg-gray-800 hover:bg-gray-900 dark:bg-gray-600 text-white rounded-xl">خصم</button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button onClick={() => onPrint(bill)} className="py-2 text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600">🖨 طباعة</button>
              <button onClick={() => onMove(bill)} className="py-2 text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600">🪑 نقل لطاولة</button>
            </div>
            <button onClick={() => { if (confirmDel) { setConfirmDel(false); onDelete(bill); } else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000); } }} className={`w-full py-2 text-xs font-bold rounded-xl border transition ${confirmDel ? 'bg-red-600 hover:bg-red-700 text-white border-red-700 animate-pulse' : 'bg-white dark:bg-gray-700 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'}`}>{confirmDel ? 'تأكيد الحذف؟ اضغط مجدداً' : '🗑 حذف الفاتورة'}</button>
          </div>
        )}
      </div>
    </div>
  );
});
BillCard.displayName = 'BillCard';

const Takeaway = () => {
  const { bills, fetchBills, setBills, refreshSingleBill, user, tables, menuItems, menuSections, menuCategories, fetchMenuItems, fetchMenuSections, fetchMenuCategories, showNotification } = useApp() as any;
  const { t, i18n } = useTranslation();
  const [moveBill, setMoveBill] = useState<any | null>(null);

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
      showNotification(res?.message || 'تم نقل الفاتورة إلى الطاولة', 'success');
      void fetchBills();
    } catch (e: any) { showNotification(e?.message || 'فشل النقل', 'error'); }
  };

  const applyBill = (id: any, updated: any) => {
    if (updated) setBills((prev: any[]) => prev.map((b: any) => String(b._id || b.id) === String(id) ? updated : b));
    else if (refreshSingleBill) refreshSingleBill({ _id: id });
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
      }
    } catch {}
  };

  // نفس معاملة حذف فواتير الطاولات: فحص صلاحية أولاً ثم حذف متفائل + مزامنة خلفية
  const handleDelete = async (bill: any) => {
    if (!canDeleteBill(user)) { showNotification('غير مصرح — تحتاج صلاحية حذف الفواتير', 'error'); return; }
    const id = bill._id || bill.id;
    setBills((prev: any[]) => prev.filter((b: any) => String(b._id || b.id) !== String(id)));
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
  const [filter, setFilter] = useState<'all' | 'draft' | 'partial' | 'paid'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [density, setDensity] = useState(() => { try { return localStorage.getItem('takeawayDensity') || 'comfortable'; } catch { return 'comfortable'; } });
  const compact = density === 'compact';
  const pageSize = 12;
  const [creating, setCreating] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [filter, debouncedSearch]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const list: Bill[] = useMemo(() => (bills || []).filter((b: any) => (b.fulfillmentType || 'dine_in') === 'takeaway'), [bills]);
  const filtered = useMemo(() => {
    let r = filter === 'all' ? list : list.filter((b: any) => b.status === filter);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      r = r.filter((b: any) => String(b.billNumber || b._id).toLowerCase().includes(q) || String(b.customerName || '').toLowerCase().includes(q) || String(b.customerPhone || '').includes(q));
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
    revenue: list.reduce((s: number, b: any) => s + (Number(b.total) || 0), 0),
  }), [list]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res: any = await (api as any).createBill?.({ fulfillmentType: 'takeaway', billType: 'cafe' }) || await (api as any).request('/bills', { method: 'POST', body: JSON.stringify({ fulfillmentType: 'takeaway' }) });
      const created = res?.data || res;
      const newId = created?._id || created?.id;
      if (newId && refreshSingleBill) refreshSingleBill({ _id: newId });
      // فتح المنيو فوراً — لا بحث عن الكارت (وتُحذف تلقائياً لو أُغلقت فارغة)
      if (newId) { setPendingNewId(String(newId)); setBillToEdit(created._id ? created : { ...created, _id: created.id }); }
    } catch (e: any) { showNotification(e?.message || 'فشل الإنشاء', 'error'); }
    finally { setCreating(false); }
  };

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
            { label: 'مدفوع', value: stats.paid, color: 'green' },
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
        <div className="flex gap-2 flex-wrap">
          {(['all','draft','partial','paid'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3.5 py-1.5 rounded-full border text-sm font-bold transition ${filter===s?'bg-orange-600 text-white border-orange-700 shadow':'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-orange-300'}`}>{s==='all'?'الكل': s==='draft'?'جديد': s==='partial'?'جزئي':'مدفوع'}</button>
          ))}
        </div>
        <div className="ml-auto relative w-full sm:w-64">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم/اسم/هاتف..." className="w-full pr-9 pl-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none text-gray-900 dark:text-gray-100" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {paginated.map((bill: any) => <BillCard key={bill._id || bill.id} bill={bill} compact={compact} onCollect={handleCollect} onWhatsApp={handleWhatsApp} onAddItems={setBillToEdit} onDelete={handleDelete} onPrint={handlePrint} onMove={setMoveBill} onPayItems={setPayItemsBill} onDiscount={handleDiscount} />)}
      {payItemsBill && (
        <ItemPartialPayModal
          bill={payItemsBill}
          onClose={() => setPayItemsBill(null)}
          onSuccess={(updated: any) => { applyBill(updated?._id || updated?.id || payItemsBill?._id, updated); setPayItemsBill(null); }}
        />
      )}
      {moveBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setMoveBill(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-4 sm:p-5 w-full max-w-md border" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mb-1">🪑 نقل لطاولة</h3>
            <p className="text-xs text-gray-500 mb-3">فاتورة #{String(moveBill.billNumber || moveBill._id).slice(-6)} — الطاولة الفارغة تنقل مباشرة، والمشغولة تدمج فيها</p>
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
      <BillItemsEditModal
        isOpen={!!billToEdit}
        onClose={closeItemsModal}
        bill={billToEdit}
        menuItems={menuItems || []}
        menuSections={menuSections || []}
        menuCategories={menuCategories || []}
        onSuccess={(updated: any) => { applyBill(updated?._id || updated?.id || billToEdit?._id || billToEdit?.id, updated); setBillToEdit(null); }}
      />
        {filtered.length===0 && <div className="col-span-full text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400">لا توجد طلبات — اضغط "تيك أوي جديد"</div>}
      </div>
      {filtered.length > pageSize && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page===1} className="p-2 rounded-lg border bg-white dark:bg-gray-800 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          <span className="text-sm text-gray-600 dark:text-gray-300">صفحة {page} / {totalPages} — {filtered.length} طلب</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page===totalPages} className="p-2 rounded-lg border bg-white dark:bg-gray-800 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
};
export default Takeaway;
