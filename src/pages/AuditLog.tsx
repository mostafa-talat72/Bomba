import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';

const ACTION_COLORS: Record<string, string> = {
  'bill.deleted': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'order.deleted': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'user.deleted': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'backup.restored': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'shift.closed': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'shift.opened': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'user.created': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

const AuditLogPage = () => {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language === 'ar';
  const [logs, setLogs] = useState<any[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async (p = page, uq?: string) => {
    setLoading(true);
    try {
      const res: any = await api.getAuditLogs({ action: action || undefined, user: (uq ?? userQuery) || undefined, page: p, limit: 50 });
      if (res?.success) {
        setLogs(res.data || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        setPage(res.page || p);
      }
    } catch {}
    finally { setLoading(false); }
  }, [action, userQuery, page]);

  useEffect(() => {
    api.getAuditActions().then((res: any) => {
      if (res?.success && Array.isArray(res.data)) setActions(res.data);
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchLogs(1); }, [action]);

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

  return (
    <div className="p-4 md:p-6 min-h-screen bg-gray-50 dark:bg-gray-900" dir={rtl ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t('nav.auditLog')}</h1>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <select value={action} onChange={(e) => setAction(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm">
          <option value="">كل الأحداث</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <div className="relative flex-1">
          <Search className="absolute top-2.5 h-4 w-4 text-gray-400" style={rtl ? { right: 12 } : { left: 12 }} />
          <input value={searchUser} onChange={(e) => setSearchUser(e.target.value)} placeholder="بحث باسم المستخدم..."
            className="w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm py-2"
            style={rtl ? { paddingRight: 36 } : { paddingLeft: 36 }} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">الحدث</th>
                <th className="px-4 py-3 text-start font-semibold">المستند</th>
                <th className="px-4 py-3 text-start font-semibold">المستخدم</th>
                <th className="px-4 py-3 text-start font-semibold">الجهاز</th>
                <th className="px-4 py-3 text-start font-semibold">الوقت</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">جاري التحميل...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">لا توجد أحداث</td></tr>
              ) : logs.map((l: any) => (
                <tr key={l._id || l.id} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ACTION_COLORS[l.action] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {l.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-800 dark:text-gray-100 font-mono text-xs" dir="ltr">{l.documentNumber || (l.documentId ? String(l.documentId).slice(-6) : '—')}</td>
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-200">{l.userName || l.user?.name || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 font-mono text-xs" dir="ltr">{l.deviceId ? String(l.deviceId).slice(0, 8) : '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <span className="text-xs text-gray-500">الإجمالي: {total}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => fetchLogs(page - 1)} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            <span className="text-sm text-gray-600 dark:text-gray-300 py-2">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => fetchLogs(page + 1)} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogPage;
