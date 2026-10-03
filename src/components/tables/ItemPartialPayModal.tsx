import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { DrawerSelect } from '../ui/DrawerSelect';
import { defaultDrawerForFulfillment, type CashDrawer } from '../../utils/paymentDrawer';
import { formatDecimal } from '../../utils/formatters';

interface Props {
  bill: any;
  onClose: () => void;
  onSuccess: (updatedBill: any, meta?: { method: string; drawer: string; total: number }) => void;
  /** تحديث خفيف لقوائم الأب بعد تعديل دفعة (بلا إغلاق) */
  onRefreshBill?: (updatedBill: any) => void;
  /** صلاحية تعديل المدفوعات */
  canEditPaid?: boolean;
}

// دفع أصناف محددة بكميات (نفس منطق الطاولات) — يُستخدم في الدليفري والتيك أوي
export default function ItemPartialPayModal({ bill, onClose, onSuccess, onRefreshBill, canEditPaid = false }: Props) {
  const { t, i18n } = useTranslation();
  // كل الأرقام المعروضة بالعربية حسب اللغة (الحقول الرقمية تبقى لاتينية للإدخال)
  const num = (v: number | string | null | undefined) => formatDecimal(v as any, i18n.language);
  const methodLabel = (m: string) =>
    m === 'cash' ? t('itemPay.methodCash') :
    m === 'card' ? t('itemPay.methodCard') :
    m === 'transfer' ? t('itemPay.methodTransfer') :
    m === 'e_wallet' ? t('itemPay.methodWallet') : m;
  const [items, setItems] = useState<any[]>([]);
  const [billPayments, setBillPayments] = useState<any[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [mobileTab, setMobileTab] = useState<'items' | 'selected' | 'paid'>('items');
  const [expandedPaid, setExpandedPaid] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<{ entryId: string; hIndex: number } | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editMax, setEditMax] = useState(0);
  const [editMethod, setEditMethod] = useState('cash');
  const [savingEdit, setSavingEdit] = useState(false);
  const [method, setMethod] = useState('cash');
  const [drawer, setDrawer] = useState<CashDrawer>(() => defaultDrawerForFulfillment((bill as any)?.fulfillmentType));
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDrawer(defaultDrawerForFulfillment((bill as any)?.fulfillmentType));
    setQty({});
  }, [(bill as any)?._id || (bill as any)?.id]);

  const load = async () => {
    try {
      const res: any = await (api as any).getBillAggregatedItems(bill._id || bill.id);
      const list = res?.data?.aggregatedItems || res?.aggregatedItems || [];
      setItems(Array.isArray(list) ? list : []);
      const pays = res?.data?.itemPayments || [];
      setBillPayments(Array.isArray(pays) ? pays : []);
    } catch (e: any) {
      setError(e?.message || t('itemPay.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill]);

  // دفعات صنف مجمع (مطابقة بمعرفات البنود ثم بالاسم+السعر كاحتياطي)
  const entriesFor = (row: any): { entry: any; hIndex: number; h: any }[] => {
    const ids: string[] = Array.isArray(row.itemIds) ? row.itemIds.map(String) : [];
    const out: { entry: any; hIndex: number; h: any }[] = [];
    for (const p of billPayments) {
      const matchId = ids.length > 0
        ? ids.includes(String(p.itemId))
        : (String(p.itemName || p.name) === String(row.name) && Number(p.pricePerUnit ?? p.price) === Number(row.price));
      if (!matchId || !Array.isArray(p.paymentHistory)) continue;
      p.paymentHistory.forEach((h: any, hIndex: number) => {
        out.push({ entry: p, hIndex, h });
      });
    }
    return out;
  };

  const saveEdit = async () => {
    if (!editing) return;
    // الحد الأقصى = الكمية الحالية (لا تجاوز)، والصفر يحذف الدفعة (الباكند يعيد الحساب)
    const nq = Math.min(editMax, Math.max(0, Math.floor(Number(editQty))));
    if (!Number.isFinite(nq)) { setError(t('itemPay.payFailed')); return; }
    setSavingEdit(true);
    setError('');
    try {
      const res: any = await (api as any).updateItemPayment(
        bill._id || bill.id, editing.entryId, editing.hIndex,
        { quantity: nq, method: editMethod }
      );
      if (res?.success) {
        setEditing(null);
        await load();
        if (res.data && onRefreshBill) onRefreshBill(res.data);
      } else {
        setError(res?.message || t('itemPay.payFailed'));
      }
    } catch (e: any) {
      setError(e?.message || t('itemPay.payFailed'));
    } finally {
      setSavingEdit(false);
    }
  };

  // الصافي بعد خصم الطلب (تناسبي من الباكند) — ما يُحصَّل فعلًا
  const r2c = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
  const rowNetUnit = (it: any) => {
    const q = Number(it.totalQuantity) || 0;
    if (q > 0 && it.netTotal !== undefined && it.netTotal !== null) return r2c(Number(it.netTotal) / q);
    if (it.netPrice !== undefined && it.netPrice !== null) return r2c(Number(it.netPrice));
    return r2c(Number(it.price) || 0);
  };
  const rowPickedDisc = (it: any) => r2c((Number(it.price) || 0) * (qty[it.id] || 0) - rowNetUnit(it) * (qty[it.id] || 0));
  const netTotal = useMemo(
    () => r2c(items.reduce((s, it) => s + rowNetUnit(it) * (qty[it.id] || 0), 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, qty]
  );
  const pickedDisc = useMemo(
    () => r2c(items.reduce((s, it) => s + rowPickedDisc(it), 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, qty]
  );

  // الأصناف المحددة للدفع (تُشتق لحظيًا — أي نقص/إزالة ينعكس تلقائيًا)
  const picked = useMemo(
    () => items.filter(it => (qty[it.id] || 0) > 0),
    [items, qty]
  );
  const pickedCount = useMemo(
    () => picked.reduce((s, it) => s + (qty[it.id] || 0), 0),
    [picked, qty]
  );
  // الأصناف المدفوعة فعلًا (من سجل الدفعات — للعرض فقط)
  const paidItems = useMemo(
    () => items.filter(it => (Number(it.paidQuantity) || 0) > 0),
    [items]
  );
  const paidTotal = useMemo(
    () => paidItems.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.paidQuantity) || 0), 0),
    [paidItems]
  );

  const setQtyDirect = (id: string, raw: string, rem: number) => {
    const v = Math.floor(Number(raw));
    setQty(p => ({ ...p, [id]: Number.isFinite(v) ? Math.max(0, Math.min(rem, v)) : 0 }));
  };

  const submit = async () => {
    const payload = items
      .filter(it => (qty[it.id] || 0) > 0)
      .map(it => ({ itemId: it.id, quantity: Math.min(qty[it.id], it.remainingQuantity ?? it.totalQuantity) }));
    if (!payload.length) { setError(t('itemPay.selectAtLeastOne')); return; }
    setPaying(true);
    setError('');
    try {
      const res: any = await (api as any).addPartialPaymentAggregated(bill._id || bill.id, { items: payload, paymentMethod: method, drawer });
      if (res?.success) {
        // تبقى النافذة مفتوحة وتتحدث تلقائيًا (لا إغلاق)
        const paidTotal = netTotal;
        setQty({});
        setMobileTab('paid');
        await load();
        if (onRefreshBill) onRefreshBill(res.data);
        else { onSuccess(res.data, { method, drawer, total: paidTotal }); onClose(); }
      } else {
        setError(res?.message || t('itemPay.payFailed'));
      }
    } catch (e: any) {
      setError(e?.message || t('itemPay.payFailed'));
    } finally {
      setPaying(false);
    }
  };

  // تاريخ+وقت الدفعة بالعربية بنظام 12 ساعة
  const fmtDateTime = (d: any) => {
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return '';
      const loc = i18n.language === 'ar' ? 'ar-EG' : i18n.language;
      const date = dt.toLocaleDateString(loc, { day: 'numeric', month: 'numeric', year: 'numeric' });
      const time = dt.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${date} · ${time}`;
    } catch {
      return '';
    }
  };

  const ft = (bill as any)?.fulfillmentType || 'dine_in';
  const ftLabel = ft === 'takeaway' ? `🥡 ${t('itemPay.typeTakeaway', 'تيك أوي')}` : ft === 'delivery' ? `🛵 ${t('itemPay.typeDelivery', 'دليفري')}` : `🍽 ${t('itemPay.typeDineIn', 'طاولة')}`;
  const custName = (bill as any)?.deliveryInfo?.customerName || (bill as any)?.customerName || '';
  const custPhone = (bill as any)?.deliveryInfo?.phone || (bill as any)?.customerPhone || '';
  const tableLabel = (() => {
    const tb = (bill as any)?.table;
    if (!tb) return '';
    if (typeof tb === 'object') return String(tb.number ?? tb.name ?? '');
    return '';
  })();

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl border border-gray-100 dark:border-gray-700 max-h-[85vh] max-h-[92dvh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* ── هيدر ثابت ── */}
        <div className="flex-shrink-0 px-5 pt-5 pb-3">
          <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">{t('itemPay.title', { short: String(bill.billNumber || bill._id).slice(-6) })}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="px-2 py-0.5 rounded-full font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">{ftLabel}</span>
            {tableLabel ? <span className="px-2 py-0.5 rounded-full font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200">{t('itemPay.table', 'طاولة')}: {tableLabel}</span> : null}
            {custName ? <span className="font-bold text-gray-700 dark:text-gray-200 truncate max-w-[140px]">{custName}</span> : null}
            {custPhone ? <span className="font-bold text-blue-600 dark:text-blue-400" dir="ltr">{custPhone}</span> : null}
            <span className="mr-auto font-extrabold text-red-500 dark:text-red-400">{t('itemPay.remainingBill', 'المتبقي')}: {num(Number((bill as any)?.remaining || 0))}</span>
          </div>
        </div>
        {/* ── تبويبات الموبايل ── */}
        <div className="lg:hidden flex-shrink-0 grid grid-cols-3 gap-1 px-4 sm:px-5 pb-2">
          {([
            { id: 'items', label: t('itemPay.tabItems'), count: items.length },
            { id: 'selected', label: t('itemPay.tabSelected'), count: pickedCount },
            { id: 'paid', label: t('itemPay.tabPaid'), count: paidItems.length },
          ] as const).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMobileTab(tab.id)}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${mobileTab === tab.id ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
            >
              {tab.label}
              <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] flex items-center justify-center ${mobileTab === tab.id ? 'bg-white/25 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>{num(tab.count)}</span>
            </button>
          ))}
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">{t('itemPay.loadingItems')}</div>
        ) : (
          <>
            {/* ── الأصناف + لوحة المحدد (سكرول مستقل لكل منهما) ── */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 px-4 sm:px-5 overflow-hidden">
              <div className={`${mobileTab !== 'items' ? 'hidden' : ''} lg:block flex-1 min-h-0 overflow-y-auto`}>
                <div className="space-y-2 pb-1">
              {items.map((it: any) => {
                const rem = Number(it.remainingQuantity ?? it.totalQuantity - (it.paidQuantity || 0));
                const q = qty[it.id] || 0;
                const picked = q > 0;
                return (
                    <div key={it.id} className={`flex items-center gap-2 p-2.5 rounded-xl border transition-colors ${rem <= 0 ? 'opacity-50 bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-700' : picked ? 'bg-blue-50/60 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <div className="text-sm font-extrabold break-words text-gray-900 dark:text-gray-100 flex-1 min-w-0">{it.name}</div>
                          {picked ? <div className="text-sm font-black text-blue-600 dark:text-blue-400 whitespace-nowrap">{num(r2c(rowNetUnit(it) * q))}</div> : null}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {it.variant ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50 whitespace-nowrap">📏 {it.variant}</span>
                          ) : null}
                          {(Number(it.discountAmount) || 0) > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-sm font-black bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <span className="line-through text-gray-400 dark:text-gray-500 font-bold">💲 {num(Number(it.price) || 0)}</span>
                              <span>💲 {num(rowNetUnit(it))}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-sm font-black bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">💲 {num(Number(it.price) || 0)}</span>
                          )}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border ${rem <= 0 ? 'bg-gray-100 dark:bg-gray-600 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600' : rem <= 2 ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 border-red-200 dark:border-red-800' : 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'}`}>{t('itemPay.left', 'متبقي')}: {num(rem)} / {num(it.totalQuantity)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button disabled={q <= 0} onClick={() => setQty(p => ({ ...p, [it.id]: Math.max(0, (p[it.id] || 0) - 1) }))} className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-black text-lg disabled:opacity-30 transition-colors">−</button>
                        <input
                          type="number" min={0} max={rem} value={q}
                          onChange={e => setQtyDirect(it.id, e.target.value, rem)}
                          disabled={rem <= 0}
                          aria-label={it.name}
                          className={`w-10 text-center font-black text-lg rounded-lg border border-transparent bg-transparent outline-none focus:border-blue-400 focus:bg-white dark:focus:bg-gray-800 dark:[color-scheme:dark] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${picked ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}
                        />
                        <button disabled={q >= rem} onClick={() => setQty(p => ({ ...p, [it.id]: Math.min(rem, (p[it.id] || 0) + 1) }))} className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg disabled:opacity-30 transition-colors shadow-sm shadow-blue-500/25">+</button>
                      </div>
                    </div>
                );
              })}
              {items.length === 0 && <div className="text-center py-4 text-gray-400 dark:text-gray-500">{t('itemPay.noItems')}</div>}
                </div>
              </div>
              {/* ── لوحة المحدد للدفع ── */}
              <div className={`${mobileTab !== 'selected' ? 'hidden' : 'flex'} lg:flex flex-shrink-0 lg:w-60 flex-col min-h-0 max-h-40 sm:max-h-44 lg:max-h-none border-t lg:border-t-0 lg:border-s border-gray-100 dark:border-gray-700 pt-2 lg:pt-0 lg:ps-3`}>
                <div className="flex-shrink-0 flex items-center justify-between mb-2">
                  <span className="text-sm font-extrabold text-gray-900 dark:text-gray-100">🧾 {t('itemPay.selected')} ({num(pickedCount)})</span>
                  <span className="text-sm font-black text-blue-600 dark:text-blue-400">{num(netTotal)}</span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pb-1">
                  {picked.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">{t('itemPay.selectedEmpty')}</p>
                  )}
                  {picked.map((it: any) => {
                    const q = qty[it.id] || 0;
                    return (
                      <div key={it.id} className="flex items-center gap-1.5 p-1.5 rounded-lg bg-blue-50/60 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-extrabold break-words text-gray-900 dark:text-gray-100">
                            {it.name}{it.variant ? <span className="text-purple-600 dark:text-purple-300"> ({it.variant})</span> : null}
                          </div>
                          <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400">{num(q)} × {num(rowNetUnit(it))} = {num(r2c(rowNetUnit(it) * q))}</div>
                        </div>
                        <button
                          onClick={() => setQty(p => ({ ...p, [it.id]: 0 }))}
                          title={t('itemPay.removeItem')}
                          className="w-6 h-6 flex-shrink-0 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 text-sm font-black leading-none transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    );
                      })}
                </div>
              </div>
              {/* ── لوحة المدفوع فعلًا ── */}
              <div className={`${mobileTab !== 'paid' ? 'hidden' : 'flex'} lg:flex flex-shrink-0 lg:w-72 flex-col min-h-0 max-h-40 sm:max-h-44 lg:max-h-none border-t lg:border-t-0 lg:border-s border-gray-100 dark:border-gray-700 pt-2 lg:pt-0 lg:ps-3`}>
                <div className="flex-shrink-0 flex items-center justify-between mb-2">
                  <span className="text-sm font-extrabold text-gray-900 dark:text-gray-100">💰 {t('itemPay.paidTitle')} ({num(paidItems.length)})</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{num(paidTotal)}</span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pb-1">
                  {paidItems.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">{t('itemPay.paidEmpty')}</p>
                  )}
                  {paidItems.map((it: any) => {
                    const pq = Number(it.paidQuantity) || 0;
                    const line = (Number(it.price) || 0) * pq;
                    const entries = entriesFor(it);
                    const expanded = !!expandedPaid[it.id];
                    return (
                      <div key={it.id} className="p-1.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                        <button
                          type="button"
                          onClick={() => canEditPaid && entries.length > 0 && setExpandedPaid(p => ({ ...p, [it.id]: !p[it.id] }))}
                          className="w-full text-start"
                          title={canEditPaid ? t('itemPay.editEntry') : undefined}
                        >
                          <div className="text-xs font-extrabold break-words text-gray-900 dark:text-gray-100">
                            {it.name}{it.variant ? <span className="text-purple-600 dark:text-purple-300"> ({it.variant})</span> : null}
                            {canEditPaid && entries.length > 0 && <span className="ms-1 text-[10px] text-blue-500">✎</span>}
                          </div>
                          <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{num(pq)} × {num(Number(it.price) || 0)} = {num(line)}</div>
                        </button>
                        {expanded && (
                          <div className="mt-1.5 space-y-1.5 border-t border-emerald-200 dark:border-emerald-800 pt-1.5">
                            {entries.map(({ entry, hIndex, h }: any, ei: number) => {
                              const isEditing = editing?.entryId === String(entry._id || entry.id) && editing?.hIndex === hIndex;
                              return (
                                <div key={`${entry._id || entry.id}-${hIndex}`} className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 p-1.5">
                                  <div className="flex items-center justify-between gap-1 text-[11px]">
                                    <div className="min-w-0">
                              <span className="font-bold text-gray-600 dark:text-gray-300">#{num(ei + 1)} · {methodLabel(h.method || method)} · {num(Number(h.quantity) || 0)} × {num(Number(h.amount) / Math.max(1, Number(h.quantity) || 1))}</span>
                              {h.paidAt ? (
                                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">🕐 {fmtDateTime(h.paidAt)}</div>
                              ) : null}
                            </div>
                                    {!isEditing && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditing({ entryId: String(entry._id || entry.id), hIndex });
                                          setEditQty(String(h.quantity ?? 0));
                                          setEditMax(Math.max(0, Math.floor(Number(h.quantity) || 0)));
                                          setEditMethod(h.method || 'cash');
                                          setError('');
                                        }}
                                        className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[11px] font-bold"
                                      >
                                        {t('itemPay.editEntry')}
                                      </button>
                                    )}
                                  </div>
                                  {isEditing && (
                                    <div className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">{t('itemPay.zeroDeletes')} (0 – {num(editMax)})</div>
                                  )}
                                  {isEditing && (
                                    <div className="mt-1.5 flex items-center gap-1">
                                      <input
                                        type="number" min={0} max={editMax} value={editQty}
                                        title={`0 – ${editMax}`}
                                        onChange={e => {
                                          const v = Math.floor(Number(e.target.value));
                                          setEditQty(Number.isFinite(v) ? String(Math.max(0, Math.min(editMax, v))) : '0');
                                        }}
                                        className="w-14 px-1 py-1 text-xs font-bold text-center border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none dark:[color-scheme:dark] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                      <select
                                        value={editMethod}
                                        onChange={e => setEditMethod(e.target.value)}
                                        className="flex-1 px-1 py-1 text-xs font-bold border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none dark:[color-scheme:dark]"
                                      >
                                        <option value="cash">{t('itemPay.methodCash')}</option>
                                        <option value="card">{t('itemPay.methodCard')}</option>
                                        <option value="transfer">{t('itemPay.methodTransfer')}</option>
                                        <option value="e_wallet">{t('itemPay.methodWallet')}</option>
                                      </select>
                                      <button type="button" onClick={saveEdit} disabled={savingEdit} className="px-2 py-1 rounded-lg bg-green-600 text-white text-xs font-bold disabled:opacity-50">✓</button>
                                      <button type="button" onClick={() => setEditing(null)} className="px-2 py-1 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-200 text-xs font-bold">✗</button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* ── فوتر ثابت ── */}
            <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex gap-2">
                <select value={method} onChange={e => setMethod(e.target.value)} className="px-2 py-2 text-sm font-bold border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 outline-none dark:[color-scheme:dark]">
                  <option value="cash">{t('itemPay.methodCash')}</option>
                  <option value="card">{t('itemPay.methodCard')}</option>
                  <option value="transfer">{t('itemPay.methodTransfer')}</option>
                  <option value="e_wallet">{t('itemPay.methodWallet')}</option>
                </select>
                <DrawerSelect value={drawer} onChange={setDrawer} className="flex-1" showLabels={true} />
                <div className="flex-1 text-center py-2 font-extrabold text-blue-600 dark:text-blue-400">
                  <div>{t('itemPay.total', { amount: num(netTotal) })}</div>
                  {pickedDisc > 0 && (
                    <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400">{t('itemPay.includesDiscount', { amount: num(pickedDisc) })}</div>
                  )}
                </div>
              </div>
              {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
              <div className="flex gap-2 mt-3">
                <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold">{t('itemPay.cancel')}</button>
                <button onClick={submit} disabled={paying || netTotal <= 0} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:opacity-40">{paying ? t('itemPay.paying') : t('itemPay.payAmount', { amount: num(netTotal) })}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
