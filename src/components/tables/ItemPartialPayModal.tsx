import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { DrawerSelect } from '../ui/DrawerSelect';
import { defaultDrawerForFulfillment, type CashDrawer } from '../../utils/paymentDrawer';

interface Props {
  bill: any;
  onClose: () => void;
  onSuccess: (updatedBill: any) => void;
}

// دفع أصناف محددة بكميات (نفس منطق الطاولات) — يُستخدم في الدليفري والتيك أوي
export default function ItemPartialPayModal({ bill, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState('cash');
  const [drawer, setDrawer] = useState<CashDrawer>(() => defaultDrawerForFulfillment((bill as any)?.fulfillmentType));
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDrawer(defaultDrawerForFulfillment((bill as any)?.fulfillmentType));
    setQty({});
  }, [(bill as any)?._id || (bill as any)?.id]);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await (api as any).getBillAggregatedItems(bill._id || bill.id);
        const list = res?.data?.aggregatedItems || res?.aggregatedItems || [];
        setItems(Array.isArray(list) ? list : []);
      } catch (e: any) {
        setError(e?.message || t('itemPay.fetchFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [bill]);

  const total = useMemo(
    () => items.reduce((s, it) => s + (Number(it.price) || 0) * (qty[it.id] || 0), 0),
    [items, qty]
  );

  const submit = async () => {
    const payload = items
      .filter(it => (qty[it.id] || 0) > 0)
      .map(it => ({ itemId: it.id, quantity: Math.min(qty[it.id], it.remainingQuantity ?? it.totalQuantity) }));
    if (!payload.length) { setError(t('itemPay.selectAtLeastOne')); return; }
    setPaying(true);
    try {
      const res: any = await (api as any).addPartialPaymentAggregated(bill._id || bill.id, { items: payload, paymentMethod: method, drawer });
      if (res?.success) {
        onSuccess(res.data);
        onClose();
      } else {
        setError(res?.message || t('itemPay.payFailed'));
      }
    } catch (e: any) {
      setError(e?.message || t('itemPay.payFailed'));
    } finally {
      setPaying(false);
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
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-5 w-full max-w-md border border-gray-100 dark:border-gray-700 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">{t('itemPay.title', { short: String(bill.billNumber || bill._id).slice(-6) })}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="px-2 py-0.5 rounded-full font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">{ftLabel}</span>
          {tableLabel ? <span className="px-2 py-0.5 rounded-full font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200">{t('itemPay.table', 'طاولة')}: {tableLabel}</span> : null}
          {custName ? <span className="font-bold text-gray-700 dark:text-gray-200 truncate max-w-[140px]">{custName}</span> : null}
          {custPhone ? <span className="font-bold text-blue-600 dark:text-blue-400" dir="ltr">{custPhone}</span> : null}
          <span className="mr-auto font-extrabold text-red-500 dark:text-red-400">{t('itemPay.remainingBill', 'المتبقي')}: {Number((bill as any)?.remaining || 0).toFixed(2)}</span>
        </div>
        {loading ? (
          <div className="text-center py-8 text-gray-400">{t('itemPay.loadingItems')}</div>
        ) : (
          <>
            <div className="mt-3 space-y-2">
              {items.map((it: any) => {
                const rem = Number(it.remainingQuantity ?? it.totalQuantity - (it.paidQuantity || 0));
                const q = qty[it.id] || 0;
                const picked = q > 0;
                return (
                    <div key={it.id} className={`flex items-center gap-2 p-2.5 rounded-xl border transition-colors ${rem <= 0 ? 'opacity-50 bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-700' : picked ? 'bg-blue-50/60 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-extrabold truncate text-gray-900 dark:text-gray-100">{it.name}</div>
                          {picked ? <div className="text-sm font-black text-blue-600 dark:text-blue-400 whitespace-nowrap">{((Number(it.price) || 0) * q).toFixed(2)}</div> : null}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-sm font-black bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">💲 {(Number(it.price) || 0).toFixed(2)}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border ${rem <= 0 ? 'bg-gray-100 dark:bg-gray-600 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600' : rem <= 2 ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 border-red-200 dark:border-red-800' : 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'}`}>{t('itemPay.left', 'متبقي')}: {rem} / {it.totalQuantity}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button disabled={q <= 0} onClick={() => setQty(p => ({ ...p, [it.id]: Math.max(0, (p[it.id] || 0) - 1) }))} className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-black text-lg disabled:opacity-30 transition-colors">−</button>
                        <span className={`w-8 text-center font-black text-lg ${picked ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>{q}</span>
                        <button disabled={q >= rem} onClick={() => setQty(p => ({ ...p, [it.id]: Math.min(rem, (p[it.id] || 0) + 1) }))} className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg disabled:opacity-30 transition-colors shadow-sm shadow-blue-500/25">+</button>
                      </div>
                    </div>
                );
              })}
              {items.length === 0 && <div className="text-center py-4 text-gray-400">{t('itemPay.noItems')}</div>}
            </div>
            <div className="flex gap-2 mt-3">
              <select value={method} onChange={e => setMethod(e.target.value)} className="px-2 py-2 text-sm font-bold border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 outline-none">
                <option value="cash">{t('itemPay.methodCash')}</option>
                <option value="card">{t('itemPay.methodCard')}</option>
                <option value="transfer">{t('itemPay.methodTransfer')}</option>
                <option value="e_wallet">{t('itemPay.methodWallet')}</option>
              </select>
              <DrawerSelect value={drawer} onChange={setDrawer} className="flex-1" showLabels={true} />
              <div className="flex-1 text-center py-2 font-extrabold text-blue-600 dark:text-blue-400">{t('itemPay.total', { amount: total.toFixed(2) })}</div>
            </div>
            {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
            <div className="flex gap-2 mt-3">
              <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold">{t('itemPay.cancel')}</button>
              <button onClick={submit} disabled={paying || total <= 0} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:opacity-40">{paying ? t('itemPay.paying') : t('itemPay.payAmount', { amount: total.toFixed(2) })}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
