import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Search, ChevronLeft, ChevronRight, Eye, Trash2, Plus, Pencil,
  DollarSign, Gamepad2, ShoppingCart, Info, Loader2, Receipt,
} from 'lucide-react';
import api from '../services/api';
import { useApp } from '../context/AppContext';

// عائلة الحدث → أيقونة وألوان الشارة (فاتح/داكن)
const FAMILIES: Record<string, { badge: string; Icon: any }> = {
  delete: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', Icon: Trash2 },
  create: { badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', Icon: Plus },
  pay: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', Icon: DollarSign },
  session: { badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', Icon: Gamepad2 },
  order: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', Icon: ShoppingCart },
  bill: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', Icon: Receipt },
  edit: { badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300', Icon: Pencil },
  other: { badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', Icon: Info },
};

const familyOf = (action: string): string => {
  const a = String(action || '').toLowerCase();
  if (/(^|[._-])deleted?($|[._-])/.test(a) || a.includes('delete')) return 'delete';
  if (/(^|[._-])created?($|[._-])/.test(a)) return 'create';
  if (a.includes('pay') || a.includes('paid') || a.includes('payment')) return 'pay';
  if (a.startsWith('session')) return 'session';
  if (a.startsWith('order')) return 'order';
  if (a.startsWith('bill')) return 'bill';
  if (a.includes('updat') || a.includes('edit') || a.includes('merg') || a.includes('transfer')) return 'edit';
  return 'other';
};

const AuditLogPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { showNotification } = useApp() as any;
  const rtl = i18n.language === 'ar';
  const [logs, setLogs] = useState<any[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [collection, setCollection] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async (p = page, uq?: string) => {
    setLoading(true);
    try {
      const res: any = await api.getAuditLogs({ action: action || undefined, collection: collection || undefined, user: (uq ?? userQuery) || undefined, page: p, limit: 50 });
      if (res?.success) {
        setLogs(res.data || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        setPage(res.page || p);
      }
    } catch {}
    finally { setLoading(false); }
  }, [action, collection, userQuery, page]);

  useEffect(() => {
    api.getAuditActions().then((res: any) => {
      if (res?.success && Array.isArray(res.data)) setActions(res.data);
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchLogs(1); }, [action, collection]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setUserQuery(searchUser);
      fetchLogs(1, searchUser);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchUser]);

  const fmtDate = (d: any) => {
    try { return new Date(d).toLocaleString(i18n.language === 'ar' ? 'ar-EG' : i18n.language); } catch { return '—'; }
  };

  const relTime = (d: any) => {
    try {
      const ms = Date.now() - new Date(d).getTime();
      if (ms < 45000) return t('auditLogPage.justNow');
      const loc = i18n.language === 'ar' ? 'ar-EG' : i18n.language;
      const rtf = new Intl.RelativeTimeFormat(loc, { numeric: 'auto' });
      const mins = Math.round(ms / 60000);
      if (Math.abs(mins) < 60) return rtf.format(-mins, 'minute');
      const hrs = Math.round(mins / 60);
      if (Math.abs(hrs) < 24) return rtf.format(-hrs, 'hour');
      return fmtDate(d);
    } catch { return fmtDate(d); }
  };

  // اسم الحدث مترجمًا: نوع + فعل (bill.deleted → حذف فاتورة)، وإلا النص الخام منسقًا
  const actionLabel = (act: string) => {
    const parts = String(act || '').split('.').filter(Boolean);
    if (parts.length === 0) return String(act || '—');
    const kindKey = `auditLogPage.kind_${parts[0]}`;
    const verbKey = `auditLogPage.verb_${parts[parts.length - 1]}`;
    const k = t(kindKey, '');
    const v = t(verbKey, '');
    if (k && v && parts[0] !== parts[parts.length - 1]) return `${v} ${k}`;
    return String(act).replace(/[._-]+/g, ' ');
  };

  const openBillTarget = async (billId: string, docNum: string, previewOrderId?: string) => {
    let bill: any = null;
    try {
      const r: any = await api.getBill(billId);
      if (r?.success && r.data) bill = r.data;
    } catch {}
    if (!bill || !bill._id) {
      showNotification(t('auditLogPage.msgBillMissing', { num: docNum || billId.slice(-6) }), 'error');
      return;
    }
    if (bill.status === 'cancelled') {
      showNotification(t('auditLogPage.msgBillCancelled', { num: bill.billNumber || docNum }), 'error');
      return;
    }
    const btable = (bill as any).table;
    const tableId = btable ? String((btable as any)._id || (btable as any).id || btable) : '';
    const fulfillment = (bill as any).fulfillmentType || 'dine_in';
    if (tableId) {
      const st: any = { openTableModal: true, tableId };
      if (previewOrderId) st.previewOrderId = previewOrderId;
      navigate('/tables', { state: st });
      return;
    }
    if (fulfillment === 'takeaway') { navigate('/takeaway'); return; }
    if (fulfillment === 'delivery') { navigate('/delivery'); return; }
    navigate(`/bill/${bill._id || billId}`);
  };

  const handleOpenLog = async (l: any) => {
    const lid = String(l._id || l.id || '');
    if (!lid || busyId) return;
    setBusyId(lid);
    try {
      const col = String(l.collection || '');
      const docId = l.documentId ? String(l.documentId) : '';
      const docNum = l.documentNumber ? String(l.documentNumber) : '';
      if (col === 'bills' || col === 'bill') {
        if (!docId) { showNotification(t('auditLogPage.msgNoTarget'), 'error'); return; }
        await openBillTarget(docId, docNum);
        return;
      }
      if (col === 'orders' || col === 'order') {
        let order: any = null;
        if (docId) {
          try {
            const r: any = await api.getOrder(docId);
            if (r?.success && r.data) order = r.data;
          } catch {}
        }
        if (!order || !order._id) {
          showNotification(t('auditLogPage.msgOrderMissing', { num: docNum || (docId ? docId.slice(-6) : '') }), 'error');
          return;
        }
        const bRef = (order as any).bill;
        const billId = bRef ? String((bRef as any)._id || (bRef as any).id || bRef) : '';
        if (!billId) { showNotification(t('auditLogPage.msgNoTarget'), 'error'); return; }
        await openBillTarget(billId, '', String((order as any)._id || (order as any).id));
        return;
      }
      if (col === 'sessions' || col === 'session') {
        let sess: any = null;
        if (docId) {
          try {
            const r: any = await api.getSession(docId);
            if (r?.success && r.data) sess = r.data;
          } catch {}
        }
        const bRef = sess?.bill;
        const billId = bRef ? String((bRef as any)._id || (bRef as any).id || bRef) : '';
        if (!billId) { showNotification(t('auditLogPage.msgNoTarget'), 'error'); return; }
        await openBillTarget(billId, '');
        return;
      }
      if (col === 'users' || col === 'user') { navigate('/users'); return; }
      if (col === 'tables' || col === 'table') {
        if (!docId) { showNotification(t('auditLogPage.msgNoTarget'), 'error'); return; }
        navigate('/tables', { state: { openTableModal: true, tableId: docId } });
        return;
      }
      if (col.startsWith('menu')) { navigate('/menu'); return; }
      if (col.startsWith('warehouse')) { navigate('/warehouse'); return; }
      if (col.startsWith('inventory')) { navigate('/inventory'); return; }
      if (col.startsWith('device')) { navigate('/settings'); return; }
      if (col.startsWith('cost')) { navigate('/costs'); return; }
      if (col.startsWith('shift')) { navigate('/shifts'); return; }
      if (col.startsWith('payroll') || col.startsWith('employee') || col.startsWith('attendance') || col.startsWith('advance') || col.startsWith('deduction') || col.startsWith('bonus')) { navigate('/payroll'); return; }
      if (col.startsWith('payment')) {
        const bId = (l.details as any)?.billId || (l.details as any)?.bill;
        if (bId) { await openBillTarget(String(bId), docNum); return; }
        showNotification(t('auditLogPage.msgNoTarget'), 'error');
        return;
      }
      showNotification(t('auditLogPage.msgNoTarget'), 'error');
    } finally { setBusyId(null); }
  };

  return (
    <div className="p-4 md:p-6 min-h-screen bg-gray-50 dark:bg-gray-900" dir={rtl ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t('nav.auditLog')}</h1>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <select value={action} onChange={(e) => setAction(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm shadow-sm focus:ring-2 focus:ring-orange-400 focus:outline-none">
          <option value="">{t('auditLogPage.allEvents')}</option>
          {actions.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
        </select>
        <select value={collection} onChange={(e) => setCollection(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm shadow-sm focus:ring-2 focus:ring-orange-400 focus:outline-none">
          <option value="">{t('auditLogPage.allCollections')}</option>
          {['bills', 'orders', 'sessions', 'users', 'tables', 'payments'].map((c) => (
            <option key={c} value={c}>{t(`auditLogPage.kind_${c.replace(/s$/, '')}`, c)}</option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search className="absolute top-2.5 h-4 w-4 text-gray-400" style={rtl ? { right: 12 } : { left: 12 }} />
          <input value={searchUser} onChange={(e) => setSearchUser(e.target.value)} placeholder={t('auditLogPage.searchUser')}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm py-2 shadow-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
            style={rtl ? { paddingRight: 36 } : { paddingLeft: 36 }} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-gray-50 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-center font-bold">{t('auditLogPage.thEvent')}</th>
                <th className="px-4 py-3 text-center font-bold">{t('auditLogPage.thDocument')}</th>
                <th className="px-4 py-3 text-center font-bold">{t('auditLogPage.thUser')}</th>
                <th className="px-4 py-3 text-center font-bold">{t('auditLogPage.thDevice')}</th>
                <th className="px-4 py-3 text-center font-bold">{t('auditLogPage.thTime')}</th>
                <th className="px-4 py-3 text-center font-bold w-16">{t('auditLogPage.openRow')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  <Loader2 className="h-6 w-6 animate-spin inline-block" />
                  <div className="mt-2 text-sm">{t('auditLogPage.loading')}</div>
                </td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">{t('auditLogPage.empty')}</td></tr>
              ) : logs.map((l: any) => {
                const fam = FAMILIES[familyOf(l.action)] || FAMILIES.other;
                const Icon = fam.Icon;
                const rowId = String(l._id || l.id || '');
                const busy = busyId === rowId;
                return (
                  <tr
                    key={rowId || `row-${Math.random()}`}
                    onClick={() => handleOpenLog(l)}
                    title={t('auditLogPage.openRow')}
                    className="border-t border-gray-100 dark:border-gray-700 cursor-pointer transition-colors hover:bg-orange-50/60 dark:hover:bg-gray-700/40 odd:bg-gray-50/40 dark:odd:bg-gray-800/40"
                  >
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${fam.badge}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {actionLabel(l.action)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-gray-800 dark:text-gray-100 font-mono text-xs font-semibold" dir="ltr">{l.documentNumber || (l.documentId ? String(l.documentId).slice(-6) : '—')}</td>
                    <td className="px-4 py-2.5 text-center text-gray-700 dark:text-gray-200 font-medium">{l.userName || l.user?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-center text-gray-500 font-mono text-xs" dir="ltr">{l.deviceId ? String(l.deviceId).slice(0, 8) : '—'}</td>
                    <td className="px-4 py-2.5 text-center text-gray-500 text-xs whitespace-nowrap" title={fmtDate(l.createdAt)}>{relTime(l.createdAt)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {busy
                        ? <Loader2 className="h-4 w-4 animate-spin inline-block text-orange-500" />
                        : <Eye className="h-4 w-4 inline-block text-gray-300 dark:text-gray-600" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/60">
          <span className="text-xs text-gray-500 font-medium">{t('auditLogPage.total')}: {total}</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => fetchLogs(page - 1)} className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"><ChevronRight className="h-4 w-4" /></button>
            <span className="text-sm text-gray-600 dark:text-gray-300 font-semibold min-w-[64px] text-center">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => fetchLogs(page + 1)} className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"><ChevronLeft className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogPage;
