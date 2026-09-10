import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';

interface Props {
  bill: any;
  onClose: () => void;
  onSuccess: (updatedBill: any) => void;
}

// دفع أصناف محددة بكميات (نفس منطق الطاولات) — يُستخدم في الدليفري والتيك أوي
export default function ItemPartialPayModal({ bill, onClose, onSuccess }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState('cash');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res: any = await (api as any).getBillAggregatedItems(bill._id || bill.id);
        const list = res?.data?.aggregatedItems || res?.aggregatedItems || [];
        setItems(Array.isArray(list) ? list : []);
      } catch (e: any) {
        setError(e?.message || 'فشل جلب الأصناف');
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
    if (!payload.length) { setError('اختر صنفاً واحداً على الأقل'); return; }
    setPaying(true);
    try {
      const res: any = await (api as any).addPartialPaymentAggregated(bill._id || bill.id, { items: payload, paymentMethod: method });
      if (res?.success) {
        onSuccess(res.data);
        onClose();
      } else {
        setError(res?.message || 'فشل الدفع');
      }
    } catch (e: any) {
      setError(e?.message || 'فشل الدفع');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-5 w-full max-w-md border max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">دفع أصناف — فاتورة #{String(bill.billNumber || bill._id).slice(-6)}</h3>
        {loading ? (
          <div className="text-center py-8 text-gray-400">جاري جلب الأصناف...</div>
        ) : (
          <>
            <div className="mt-3 space-y-2">
              {items.map((it: any) => {
                const rem = Number(it.remainingQuantity ?? it.totalQuantity - (it.paidQuantity || 0));
                const q = qty[it.id] || 0;
                return (
                  <div key={it.id} className={`flex items-center gap-2 p-2 rounded-xl border ${rem <= 0 ? 'opacity-40 bg-gray-50 dark:bg-gray-700/40' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{it.name}</div>
                      <div className="text-xs text-gray-400">{(it.price || 0).toFixed(2)} — متبقي {rem} / {it.totalQuantity}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button disabled={q <= 0} onClick={() => setQty(p => ({ ...p, [it.id]: Math.max(0, (p[it.id] || 0) - 1) }))} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-600 font-bold disabled:opacity-30">−</button>
                      <span className="w-6 text-center font-bold">{q}</span>
                      <button disabled={q >= rem} onClick={() => setQty(p => ({ ...p, [it.id]: Math.min(rem, (p[it.id] || 0) + 1) }))} className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold disabled:opacity-30">+</button>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && <div className="text-center py-4 text-gray-400">لا توجد أصناف</div>}
            </div>
            <div className="flex gap-2 mt-3">
              <select value={method} onChange={e => setMethod(e.target.value)} className="px-2 py-2 text-sm border rounded-xl bg-gray-50 dark:bg-gray-700">
                <option value="cash">نقدي</option>
                <option value="card">كارت</option>
                <option value="transfer">تحويل</option>
                <option value="e_wallet">محفظة</option>
              </select>
              <div className="flex-1 text-center py-2 font-extrabold text-blue-600 dark:text-blue-400">الإجمالي: {total.toFixed(2)}</div>
            </div>
            {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
            <div className="flex gap-2 mt-3">
              <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold">إلغاء</button>
              <button onClick={submit} disabled={paying || total <= 0} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:opacity-40">{paying ? 'جاري...' : `دفع ${total.toFixed(2)}`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
