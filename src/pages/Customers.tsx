import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigProvider } from 'antd';
import arEG from 'antd/locale/ar_EG';
import enUS from 'antd/locale/en_US';
import frFR from 'antd/locale/fr_FR';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import 'dayjs/locale/fr';
import { Users, Plus, Edit, Trash2, Search, X, ChevronRight, ChevronLeft, Phone } from 'lucide-react';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import { formatCurrency as formatCurrencyUtil, formatDecimal } from '../utils/formatters';
import { canViewCustomers, canAddCustomer, canEditCustomer, canDeleteCustomer } from '../utils/permissionHelper';
import type { DirectoryCustomer } from '../services/api/customers';

const PAGE_LIMIT = 25;

const Customers = () => {
  const { t, i18n } = useTranslation();
  const { user, showNotification } = useApp() as any;

  const [rows, setRows] = useState<DirectoryCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [summary, setSummary] = useState({ customers: 0, orders: 0, revenue: 0, avg: 0 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DirectoryCustomer | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DirectoryCustomer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const cur = localStorage.getItem('organizationCurrency') || 'EGP';
  const fmt = useCallback((n: number) => formatCurrencyUtil(Number(n) || 0, i18n.language, cur), [i18n.language, cur]);
  const fmtInt = useCallback((n: number) => formatDecimal(Math.round(Number(n) || 0), i18n.language), [i18n.language]);
  const fmtDate = useCallback((d: any) => {
    if (!d) return '—';
    try {
      return dayjs(d).locale(i18n.language).format('DD/MM/YYYY');
    } catch {
      return '—';
    }
  }, [i18n.language]);
  const getAntdLocale = () => {
    if (i18n.language === 'ar') return arEG;
    if (i18n.language === 'fr') return frFR;
    return enUS;
  };

  useEffect(() => {
    const h = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 400);
    return () => clearTimeout(h);
  }, [search]);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await (api as any).getDirectory({ page, limit: PAGE_LIMIT, search: debouncedSearch });
      if (res?.success) {
        setRows(Array.isArray(res.data) ? res.data : []);
        setTotal(Number(res.total ?? 0));
        setPages(Number(res.pages ?? 1));
        if (res.summary) setSummary(res.summary);
      } else {
        showNotification(res?.message || t('customers.loadError', 'فشل تحميل العملاء'), 'error');
      }
    } catch (e: any) {
      showNotification(e?.message || t('customers.loadError', 'فشل تحميل العملاء'), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    if (canViewCustomers(user)) void fetchPage();
  }, [fetchPage]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', address: '' });
    setShowForm(true);
  };

  const openEdit = (c: DirectoryCustomer) => {
    setEditing(c);
    setForm({ name: c.customerName || '', phone: c.phone || '', address: c.address || '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    const phone = form.phone.trim();
    const digits = phone.replace(/\D/g, '');
    if (!phone) { showNotification(t('customers.phoneRequired', 'رقم الهاتف مطلوب'), 'warning'); return; }
    if (digits.length < 7) { showNotification(t('customers.phoneInvalid', 'رقم الهاتف غير صحيح'), 'warning'); return; }
    setSaving(true);
    try {
      const payload: any = { phone, customerName: form.name.trim() || undefined, address: form.address.trim() || undefined };
      const res: any = editing
        ? await (api as any).updateCustomer(String((editing as any)._id || (editing as any).id), payload)
        : await (api as any).createCustomer(payload);
      if (res?.success) {
        showNotification(
          editing ? t('customers.updatedOk', 'تم تحديث العميل') : t('customers.addedOk', 'تمت إضافة العميل'),
          'success'
        );
        setShowForm(false);
        setEditing(null);
        await fetchPage();
      } else {
        showNotification(res?.message || t('customers.saveError', 'فشل الحفظ'), 'error');
      }
    } catch (e: any) {
      showNotification(e?.message || t('customers.saveError', 'فشل الحفظ'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res: any = await (api as any).deleteCustomer(String((deleteTarget as any)._id || (deleteTarget as any).id));
      if (res?.success) {
        showNotification(t('customers.deletedOk', 'تم حذف العميل'), 'success');
        setDeleteTarget(null);
        await fetchPage();
      } else {
        showNotification(res?.message || t('customers.deleteError', 'فشل الحذف'), 'error');
      }
    } catch (e: any) {
      showNotification(e?.message || t('customers.deleteError', 'فشل الحذف'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (!canViewCustomers(user)) {
    return (
      <div className="p-3 sm:p-6 max-w-[1400px] mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 p-10 text-center">
          <div className="text-5xl mb-3">🔒</div>
          <div className="text-lg font-extrabold text-gray-900 dark:text-white">{t('common.noBillsAccess', 'ليس لديك صلاحية')}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('common.contactAdmin', 'يرجى التواصل مع المدير للحصول على الصلاحية')}</div>
        </div>
      </div>
    );
  }

  return (
    <ConfigProvider locale={getAntdLocale()} direction={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="p-3 sm:p-6 space-y-4 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/25">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white">{t('customers.title', 'العملاء')}</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('customers.subtitle', 'دليل العملاء وإحصائيات طلباتهم')} · {fmtInt(total)}</p>
            </div>
          </div>
          {canAddCustomer(user) ? (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow transition-all"
            >
              <Plus className="h-4 w-4" />{t('customers.add', 'عميل جديد')}
            </button>
          ) : null}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: t('customers.sumCustomers', 'عملاء'), value: fmtInt(summary.customers), cls: 'text-gray-900 dark:text-white' },
            { label: t('customers.sumOrders', 'طلبات'), value: fmtInt(summary.orders), cls: 'text-blue-600 dark:text-blue-400' },
            { label: t('customers.sumRevenue', 'إجمالي الإنفاق'), value: fmt(summary.revenue), cls: 'text-green-600 dark:text-green-400' },
            { label: t('customers.sumAvg', 'متوسط الطلب'), value: fmt(summary.avg), cls: 'text-purple-600 dark:text-purple-400' },
          ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-center">
              <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{s.label}{loading ? ' …' : ''}</div>
              <div className={`text-base sm:text-lg font-extrabold ${s.cls} ${loading ? 'opacity-50' : ''}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
          <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('customers.searchPh', 'بحث بالاسم أو الهاتف أو العنوان...')}
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />
          {search ? (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">×</button>
          ) : null}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs">
                  <th className="px-3 py-2.5 text-right font-bold">{t('customers.cCustomer', 'العميل')}</th>
                  <th className="px-3 py-2.5 text-right font-bold">{t('customers.cAddress', 'العنوان')}</th>
                  <th className="px-3 py-2.5 text-center font-bold">{t('customers.cOrders', 'الطلبات')}</th>
                  <th className="px-3 py-2.5 text-center font-bold">{t('customers.cTotal', 'إجمالي الإنفاق')}</th>
                  <th className="px-3 py-2.5 text-center font-bold">{t('customers.cAvg', 'المتوسط')}</th>
                  <th className="px-3 py-2.5 text-center font-bold">{t('customers.cLast', 'آخر طلب')}</th>
                  <th className="px-3 py-2.5 text-center font-bold">{t('customers.cActions', 'إجراءات')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c: any) => (
                  <tr key={String(c._id || c.id)} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-3 py-2.5">
                      <div className="font-extrabold text-gray-900 dark:text-white">{c.customerName || '—'}</div>
                      <div className="text-xs text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1" dir="ltr">
                        <Phone className="h-3 w-3" />{c.phone}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 max-w-[220px] truncate">{c.address || '—'}</td>
                    <td className="px-3 py-2.5 text-center font-extrabold text-blue-600 dark:text-blue-400">{fmtInt(c.stats?.orders ?? c.orderCount ?? 0)}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-green-600 dark:text-green-400 whitespace-nowrap">{fmt(c.stats?.totalSpent ?? 0)}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap">{fmt(c.stats?.avg ?? 0)}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(c.stats?.lastOrderAt)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        {canEditCustomer(user) ? (
                          <button
                            onClick={() => openEdit(c)}
                            title={t('customers.edit', 'تعديل')}
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-300 transition-colors"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        ) : null}
                        {canDeleteCustomer(user) ? (
                          <button
                            onClick={() => setDeleteTarget(c)}
                            title={t('customers.delete', 'حذف')}
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-gray-400 dark:text-gray-500">
                      {t('customers.noResults', 'لا يوجد عملاء')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />{t('customers.prev', 'السابق')}
            </button>
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
              {t('customers.pageOf', 'صفحة {{page}} من {{pages}}', { page: fmtInt(page), pages: fmtInt(pages) })}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page >= pages || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-40 transition-colors"
            >
              {t('customers.next', 'التالي')}<ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Add/Edit modal */}
        {showForm ? (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4" onClick={() => !saving && setShowForm(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-700 p-5" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                  {editing ? t('customers.editTitle', 'تعديل العميل') : t('customers.addTitle', 'عميل جديد')}
                </h3>
                <button onClick={() => !saving && setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{t('customers.fName', 'الاسم')}</label>
                  <input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder={t('customers.fNamePh', 'اسم العميل')}
                    className="w-full px-3 py-2.5 text-sm font-bold border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{t('customers.fPhone', 'رقم الهاتف')} *</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder={t('customers.fPhonePh', '01xxxxxxxxx')}
                    inputMode="tel"
                    dir="ltr"
                    className="w-full px-3 py-2.5 text-sm font-bold border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{t('customers.fAddress', 'العنوان')}</label>
                  <input
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                    placeholder={t('customers.fAddressPh', 'العنوان')}
                    className="w-full px-3 py-2.5 text-sm font-bold border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-5">
                <button
                  onClick={() => !saving && setShowForm(false)}
                  disabled={saving}
                  className="py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {t('customers.cancel', 'إلغاء')}
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-sm font-bold shadow transition-colors disabled:opacity-50"
                >
                  {saving ? '...' : t('customers.save', 'حفظ')}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Delete confirm */}
        {deleteTarget ? (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4" onClick={() => !deleting && setDeleteTarget(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 dark:border-gray-700 p-5 text-center" onClick={e => e.stopPropagation()}>
              <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">{t('customers.delTitle', 'حذف العميل؟')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {(deleteTarget as any).customerName || (deleteTarget as any).phone} — {t('customers.delHint', 'سيُحذف السجل فقط، والفواتير لا تُمس')}
              </p>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  onClick={() => !deleting && setDeleteTarget(null)}
                  disabled={deleting}
                  className="py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {t('customers.cancel', 'إلغاء')}
                </button>
                <button
                  onClick={() => void confirmDelete()}
                  disabled={deleting}
                  className="py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow transition-colors disabled:opacity-50"
                >
                  {deleting ? '...' : t('customers.delete', 'حذف')}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ConfigProvider>
  );
};

export default Customers;
