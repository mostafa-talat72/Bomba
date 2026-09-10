import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

type Shift = {
  _id: string;
  status: 'open' | 'closed';
  openedAt?: string;
  closedAt?: string | null;
  openedBy?: { name?: string } | string | null;
  closedBy?: { name?: string } | string | null;
  openingCash?: number;
  expectedCash?: number | null;
  actualCash?: number | null;
  difference?: number | null;
  breakdown?: { cash?: number; card?: number; transfer?: number } | null;
  billsCount?: number;
  ordersCount?: number;
  sessionsRevenue?: number;
  notes?: string | null;
};

const fmtDate = (v?: string | null) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('ar-EG');
  } catch {
    return '—';
  }
};

const userName = (u: Shift['openedBy']): string => {
  if (!u) return '—';
  if (typeof u === 'string') return u;
  return u.name || '—';
};

const num = (v: unknown): string => {
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('ar-EG');
};

const ShiftClose: React.FC = () => {
  const [current, setCurrent] = useState<Shift | null>(null);
  const [history, setHistory] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [openingCash, setOpeningCash] = useState('0');
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [lastClosed, setLastClosed] = useState<Shift | null>(null);

  const callApi = (fnName: string, ...args: any[]) => {
    const fn = (api as any)?.[fnName];
    if (typeof fn !== 'function') throw new Error(`وظيفة ${fnName} غير متوفرة`);
    return fn(...args);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [curRes, histRes] = await Promise.all([
        callApi('getCurrentShift'),
        callApi('listShifts', { page: 1, limit: 20 }),
      ]);
      if (curRes?.success) setCurrent(curRes.data || null);
      else setError(curRes?.message || 'فشل جلب الوردية الحالية');
      if (histRes?.success) setHistory(Array.isArray(histRes.data) ? histRes.data : []);
    } catch (e: any) {
      setError(e?.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpen = async () => {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await callApi('openShift', { openingCash: Number(openingCash) || 0 });
      if (res?.success) {
        setCurrent(res.data);
        setOkMsg('تم فتح الوردية بنجاح');
        setOpeningCash('0');
        void load();
      } else {
        setError(res?.message || 'فشل فتح الوردية');
      }
    } catch (e: any) {
      setError(e?.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    const val = Number(actualCash);
    if (Number.isNaN(val) || val < 0 || actualCash === '') {
      setError('أدخل المبلغ الفعلي (رقم موجب)');
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await callApi('closeShift', { actualCash: val, notes: notes || undefined });
      if (res?.success) {
        setCurrent(null);
        setLastClosed(res.data);
        setOkMsg('تم إغلاق الوردية بنجاح');
        setActualCash('');
        setNotes('');
        void load();
      } else {
        setError(res?.message || 'فشل إغلاق الوردية');
      }
    } catch (e: any) {
      setError(e?.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setBusy(false);
    }
  };

  const diffBox = (s: Shift | null) => {
    if (!s || s.difference === null || s.difference === undefined) return null;
    const d = Number(s.difference);
    const positive = d >= 0;
    return (
      <div
        className={`mt-4 rounded-lg border p-4 text-center ${
          positive
            ? 'border-green-600 bg-green-50 text-green-800 dark:border-green-500 dark:bg-green-900/30 dark:text-green-300'
            : 'border-red-600 bg-red-50 text-red-800 dark:border-red-500 dark:bg-red-900/30 dark:text-red-300'
        }`}
      >
        <div className="text-sm">الفرق (الفعلي − المتوقع)</div>
        <div className="text-2xl font-bold" dir="ltr">
          {positive ? '+' : ''}
          {num(d)} ج.م
        </div>
        <div className="mt-1 text-xs opacity-80">
          المتوقع: {num(s.expectedCash)} — الفعلي: {num(s.actualCash)}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-300">جارٍ التحميل...</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 dark:bg-gray-900 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">إغلاق الوردية</h1>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}
        {okMsg && (
          <div className="mb-4 rounded-lg border border-green-500 bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300">
            {okMsg}
          </div>
        )}

        {current ? (
          <div className="rounded-xl bg-white p-5 shadow dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">وردية مفتوحة</h2>
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <div className="text-gray-500 dark:text-gray-400">وقت الفتح</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{fmtDate(current.openedAt)}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <div className="text-gray-500 dark:text-gray-400">فتحها</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{userName(current.openedBy)}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <div className="text-gray-500 dark:text-gray-400">النقدية الافتتاحية</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{num(current.openingCash)} ج.م</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <div className="text-gray-500 dark:text-gray-400">الحالة</div>
                <div className="font-semibold text-green-600 dark:text-green-400">مفتوحة</div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm text-gray-600 dark:text-gray-300">النقدية الفعلية بالدرج *</span>
                <input
                  type="number"
                  min={0}
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-gray-600 dark:text-gray-300">ملاحظات</span>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات الإغلاق (اختياري)"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </label>
            </div>

            <button
              onClick={handleClose}
              disabled={busy}
              className="mt-4 w-full rounded-lg bg-orange-600 px-4 py-2.5 font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {busy ? 'جارٍ الإغلاق...' : 'إغلاق الوردية'}
            </button>
          </div>
        ) : (
          <div className="rounded-xl bg-white p-5 shadow dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">لا توجد وردية مفتوحة</h2>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-600 dark:text-gray-300">النقدية الافتتاحية</span>
              <input
                type="number"
                min={0}
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </label>
            <button
              onClick={handleOpen}
              disabled={busy}
              className="mt-4 w-full rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {busy ? 'جارٍ الفتح...' : 'فتح وردية جديدة'}
            </button>
          </div>
        )}

        {lastClosed && (
          <div className="mt-4 rounded-xl bg-white p-5 shadow dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">تقرير الإغلاق الأخير</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <div className="text-gray-500 dark:text-gray-400">نقدي (كاش)</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{num(lastClosed.breakdown?.cash)} ج.م</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <div className="text-gray-500 dark:text-gray-400">شبكة / بطاقة</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{num(lastClosed.breakdown?.card)} ج.م</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <div className="text-gray-500 dark:text-gray-400">تحويل</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{num(lastClosed.breakdown?.transfer)} ج.م</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <div className="text-gray-500 dark:text-gray-400">عدد الفواتير</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{num(lastClosed.billsCount)}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <div className="text-gray-500 dark:text-gray-400">عدد الطلبات</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{num(lastClosed.ordersCount)}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <div className="text-gray-500 dark:text-gray-400">إيراد الجلسات</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{num(lastClosed.sessionsRevenue)} ج.م</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <div className="text-gray-500 dark:text-gray-400">الافتتاحية</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{num(lastClosed.openingCash)} ج.م</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <div className="text-gray-500 dark:text-gray-400">المتوقع</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{num(lastClosed.expectedCash)} ج.م</div>
              </div>
            </div>
            {diffBox(lastClosed)}
          </div>
        )}

        <div className="mt-4 sm:mt-6 rounded-xl bg-white p-4 sm:p-5 shadow dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">سجل الورديات</h2>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">لا توجد ورديات مسجلة بعد</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <th className="py-2 text-right">الحالة</th>
                    <th className="py-2 text-right">الفتح</th>
                    <th className="py-2 text-right">الإغلاق</th>
                    <th className="py-2 text-right">بواسطة</th>
                    <th className="py-2 text-right">المتوقع</th>
                    <th className="py-2 text-right">الفعلي</th>
                    <th className="py-2 text-right">الفرق</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((s) => {
                    const d = s.difference === null || s.difference === undefined ? null : Number(s.difference);
                    return (
                      <tr key={s._id} className="border-b border-gray-100 dark:border-gray-700/50">
                        <td className="py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              s.status === 'open'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {s.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                          </span>
                        </td>
                        <td className="py-2 text-gray-700 dark:text-gray-300">{fmtDate(s.openedAt)}</td>
                        <td className="py-2 text-gray-700 dark:text-gray-300">{fmtDate(s.closedAt)}</td>
                        <td className="py-2 text-gray-700 dark:text-gray-300">{userName(s.openedBy)}</td>
                        <td className="py-2 text-gray-700 dark:text-gray-300">{s.expectedCash == null ? '—' : num(s.expectedCash)}</td>
                        <td className="py-2 text-gray-700 dark:text-gray-300">{s.actualCash == null ? '—' : num(s.actualCash)}</td>
                        <td
                          className={`py-2 font-semibold ${
                            d === null
                              ? 'text-gray-500 dark:text-gray-400'
                              : d >= 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {d === null ? '—' : `${d >= 0 ? '+' : ''}${num(d)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShiftClose;
