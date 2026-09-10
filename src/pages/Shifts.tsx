import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Square, History } from 'lucide-react';
import { toast } from 'react-toastify';
import ConfirmModal from '../components/ConfirmModal';
import api from '../services/api';

// In-app notice (replaces blocking browser alert): error by default.
const palert = (msg: string, ok = false) => (ok ? toast.success(msg) : toast.error(msg));

const fmtMoney = (n: any) => `${Number(n || 0).toFixed(2)}`;

const Shifts = () => {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language === 'ar';
  const [current, setCurrent] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');

  const fmtDate = (d: any) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleString(i18n.language === 'ar' ? 'ar-EG' : i18n.language); } catch { return '—'; }
  };

  const load = useCallback(async () => {
    try {
      const [cur, hist]: any[] = await Promise.all([api.getCurrentShift(), api.getShifts({ limit: 20 })]);
      if (cur?.success) setCurrent(cur.data);
      if (hist?.success) setHistory(hist.data || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleOpen = async () => {
    setBusy(true);
    try {
      const res: any = await api.openShift({ openingCash: Number(openingCash) || 0, notes: notes || undefined });
      if (res?.success) { setOpeningCash(''); setNotes(''); load(); }
      else palert(res?.message || 'failed');
    } catch (e: any) { palert(e?.message || 'failed'); }
    finally { setBusy(false); }
  };

  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const handleCloseAsk = () => {
    if (actualCash === '' || Number(actualCash) < 0) { palert('أدخل المبلغ الفعلي'); return; }
    setShowCloseConfirm(true);
  };

  const handleClose = async () => {
    setShowCloseConfirm(false);
    setBusy(true);
    try {
      const res: any = await api.closeShift({ actualCash: Number(actualCash), notes: notes || undefined });
      if (res?.success) {
        const d = res.data || {};
        palert(`تم الإغلاق — المتوقع: ${fmtMoney(d.expectedCash)} | الفعلي: ${fmtMoney(d.actualCash)} | الفرق: ${fmtMoney(d.difference)}`, true);
        setActualCash(''); setNotes(''); load();
      } else palert(res?.message || 'failed');
    } catch (e: any) { palert(e?.message || 'failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-4 md:p-6 min-h-screen bg-gray-50 dark:bg-gray-900" dir={rtl ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t('nav.shifts')}</h1>

      {loading ? (
        <p className="text-gray-400">جاري التحميل...</p>
      ) : current ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-green-200 dark:border-green-800 p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-3 w-3"><span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative rounded-full h-3 w-3 bg-green-500" /></span>
            <h2 className="font-bold text-gray-900 dark:text-gray-100">وردية مفتوحة — {current.openedByName || ''}</h2>
          </div>
          <p className="text-sm text-gray-500 mb-3">فُتحت: {fmtDate(current.openedAt)} — نقدية الافتتاح: {fmtMoney(current.openingCash)}</p>
          <div className="flex flex-col md:flex-row gap-2">
            <input type="number" min={0} value={actualCash} onChange={(e) => setActualCash(e.target.value)} placeholder="المبلغ الفعلي في الدرج"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            <button onClick={handleCloseAsk} disabled={busy} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold disabled:opacity-50 flex items-center gap-2">
              <Square className="h-4 w-4" /> إغلاق الوردية
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 p-5 mb-4">
          <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-3">لا توجد وردية مفتوحة</h2>
          <div className="flex flex-col md:flex-row gap-2">
            <input type="number" min={0} value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} placeholder="نقدية الافتتاح في الدرج"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            <button onClick={handleOpen} disabled={busy} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold disabled:opacity-50 flex items-center gap-2">
              <Play className="h-4 w-4" /> فتح وردية
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <History className="h-4 w-4 text-gray-500" />
          <h2 className="font-bold text-gray-900 dark:text-gray-100">سجل الورديات</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2 text-start">الفترة</th>
                <th className="px-4 py-2 text-start">الكاشير</th>
                <th className="px-4 py-2 text-center">المتوقع</th>
                <th className="px-4 py-2 text-center">الفعلي</th>
                <th className="px-4 py-2 text-center">الفرق</th>
                <th className="px-4 py-2 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">لا توجد ورديات</td></tr>}
              {history.map((s: any) => (
                <tr key={s._id || s.id} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-300">{fmtDate(s.openedAt)} → {s.closedAt ? fmtDate(s.closedAt) : '...'}</td>
                  <td className="px-4 py-2 text-gray-800 dark:text-gray-100">{s.openedByName || s.openedBy?.name || '—'}</td>
                  <td className="px-4 py-2 text-center font-semibold">{s.status === 'closed' ? fmtMoney(s.expectedCash) : '—'}</td>
                  <td className="px-4 py-2 text-center font-semibold">{s.status === 'closed' ? fmtMoney(s.actualCash) : '—'}</td>
                  <td className={`px-4 py-2 text-center font-bold ${Number(s.difference) < 0 ? 'text-red-600' : Number(s.difference) > 0 ? 'text-blue-600' : 'text-green-600'}`}>
                    {s.status === 'closed' ? fmtMoney(s.difference) : '—'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {s.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        onConfirm={handleClose}
        title="إغلاق الوردية"
        message="إغلاق الوردية الحالية؟ سيتم حساب الفرق نهائياً."
        confirmText="إغلاق"
        cancelText="تراجع"
        confirmColor="bg-red-600 hover:bg-red-700"
        loading={busy}
      />
    </div>
  );
};

export default Shifts;
