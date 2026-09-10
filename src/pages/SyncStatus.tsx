import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Server, Database, Wifi, ListOrdered, Activity, Save, Clock } from 'lucide-react';
import api from '../services/api';

const SyncStatus = () => {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language === 'ar';
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeBusy, setTimeBusy] = useState(false);
  const [timeMsg, setTimeMsg] = useState<string | null>(null);

  const handleTimeSync = async () => {
    setTimeBusy(true);
    setTimeMsg(null);
    try {
      const res: any = await api.syncLanTime();
      setTimeMsg(res?.message || (res?.success ? 'تم' : 'فشل'));
    } catch (e: any) {
      setTimeMsg(e?.message || 'فشل');
    } finally {
      setTimeBusy(false);
    }
  };

  const fetchOverview = useCallback(async () => {
    try {
      const res: any = await api.getSyncOverview();
      if (res?.success) {
        setData(res.data);
        setError(null);
      } else {
        setError(res?.message || 'failed');
      }
    } catch (e: any) {
      setError(e?.message || 'failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    const id = setInterval(fetchOverview, 5000);
    return () => clearInterval(id);
  }, [fetchOverview]);

  const fmtDate = (d: any) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleString(i18n.language === 'ar' ? 'ar-EG' : i18n.language); } catch { return '—'; }
  };

  const Card = ({ icon, title, children, tone }: any) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className={`p-2 rounded-xl ${tone}`}>{icon}</span>
        <h3 className="font-bold text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );

  const Row = ({ k, v, ok }: any) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500 dark:text-gray-400">{k}</span>
      <span className={`font-semibold ${ok === true ? 'text-green-600' : ok === false ? 'text-red-600' : 'text-gray-800 dark:text-gray-100'}`}>
        {v}
      </span>
    </div>
  );

  const q = data?.queue || {};
  const w = data?.worker || {};
  const peers = data?.lan?.peers || [];
  const last = data?.lastBackup || {};
  const conns = data?.connections || {};

  return (
    <div className="p-4 md:p-6 min-h-screen bg-gray-50 dark:bg-gray-900" dir={rtl ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('nav.syncStatus')}</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleTimeSync} disabled={timeBusy} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium">
            <Clock className="h-4 w-4" />
            {timeBusy ? '...' : 'مزامنة الوقت تلقائياً'}
          </button>
          <button
            onClick={async () => {
              setTimeBusy(true);
              try {
                const next = !(data?.lan?.timeSource === true);
                const res: any = await api.setLanTimeSource(next);
                setTimeMsg(res?.success ? (next ? 'تم تثبيت هذا الجهاز كمرجع للوقت 📌' : 'تم إلغاء التثبيت — عاد الانتخاب التلقائي') : 'فشل');
                fetchOverview();
              } finally {
                setTimeBusy(false);
              }
            }}
            disabled={timeBusy}
            className={`flex items-center gap-2 px-4 py-2 disabled:opacity-50 text-white rounded-xl text-sm font-medium ${data?.lan?.timeSource ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-600 hover:bg-gray-700'}`}
          >
            📌 {data?.lan?.timeSource ? 'مرجع الوقت (إلغاء التثبيت)' : 'اجعل هذا الجهاز مرجع الوقت'}
          </button>
          <button onClick={() => { setLoading(true); fetchOverview(); }} className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-medium">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? '...' : t('common.refresh') || 'تحديث'}
          </button>
        </div>
      </div>
      {timeMsg && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-700 dark:text-blue-300 text-sm">
          {timeMsg}
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        <Card icon={<Server className="h-5 w-5" />} title={t('nav.syncStatus') + ' — ' + (data?.device?.hostname || '')} tone="bg-blue-100 text-blue-600 dark:bg-blue-900/30">
          <Row k="Device ID" v={(data?.device?.deviceId || '—').slice(0, 12)} />
          <Row k="IP" v={data?.lan?.localIP || '—'} />
          <Row k="Time" v={fmtDate(data?.device?.time)} />
        </Card>

        <Card icon={<Database className="h-5 w-5" />} title="Atlas / Local" tone="bg-purple-100 text-purple-600 dark:bg-purple-900/30">
          <Row k="Atlas" v={conns?.atlas?.connected ?? conns?.atlas?.status ?? '—'} ok={conns?.atlas ? undefined : undefined} />
          <Row k="Local" v={conns?.local?.connected ?? conns?.local?.status ?? '—'} />
          <Row k="Worker" v={w?.isRunning === false ? '⛔' : w?.isPaused ? '⏸' : '▶'} />
          <Row k="Success" v={w?.successCount ?? w?.stats?.successCount ?? '—'} />
          <Row k="Failed" v={w?.failureCount ?? w?.stats?.failureCount ?? '—'} />
        </Card>

        <Card icon={<Wifi className="h-5 w-5" />} title={`LAN (${peers.length})`} tone="bg-green-100 text-green-600 dark:bg-green-900/30">
          {peers.length === 0 && <p className="text-gray-500 text-sm">لا توجد أجهزة متصلة — وصّل سلك Ethernet</p>}
          {peers.map((p: any) => {
            const off = typeof p.clockOffsetMs === 'number' ? p.clockOffsetMs : null;
            const offBad = off !== null && Math.abs(off) > 5000;
            const offWarn = off !== null && !offBad && Math.abs(off) > 1000;
            return (
              <div key={p.deviceId} className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{p.name || 'جهاز'}</span>
                  <span className="text-xs text-gray-500 font-mono" dir="ltr">{p.ip}:{p.port}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">فرق الساعة</span>
                  <span className={`text-xs font-bold font-mono ${offBad ? 'text-red-600' : offWarn ? 'text-amber-600' : 'text-green-600'}`} dir="ltr">
                    {off === null ? '—' : Math.abs(off) < 1000 ? 'متطابقة ✓' : `${off > 0 ? '+' : ''}${(off / 1000).toFixed(1)}s`}
                  </span>
                </div>
                {offBad && (
                  <p className="text-[11px] text-red-600 mt-1">الساعتان مختلفتان — وحّد المنطقة الزمنية ثم شغّل سكربت ضبط الوقت عبر LAN</p>
                )}
              </div>
            );
          })}
        </Card>

        <Card icon={<ListOrdered className="h-5 w-5" />} title="Queue" tone="bg-amber-100 text-amber-600 dark:bg-amber-900/30">
          <Row k="Pending" v={q.size ?? q.queueSize ?? 0} ok={(q.size ?? 0) === 0} />
          <Row k="Lag" v={q.syncLagSeconds ? `${q.syncLagSeconds}s` : '—'} ok={!q.isLagging} />
          <Row k="Max" v={q.maxSize ?? '—'} />
        </Card>

        <Card icon={<Save className="h-5 w-5" />} title="Backup" tone="bg-teal-100 text-teal-600 dark:bg-teal-900/30">
          <Row k="Last" v={fmtDate(last?.at)} ok={last?.success} />
          <Row k="File" v={last?.fileName || '—'} />
          <Row k="Docs" v={last?.documents ?? '—'} />
        </Card>

        <Card icon={<Activity className="h-5 w-5" />} title="Health" tone="bg-rose-100 text-rose-600 dark:bg-rose-900/30">
          <Row k="Queue lagging" v={q.isLagging ? '⚠️' : '✅'} ok={!q.isLagging} />
          <Row k="Worker running" v={w?.isRunning === false ? '⚠️' : '✅'} ok={w?.isRunning !== false} />
        </Card>
      </div>
    </div>
  );
};

export default SyncStatus;
