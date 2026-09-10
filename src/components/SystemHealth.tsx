import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface HealthCheckItem {
  key: 'mongo' | 'disk' | 'backup' | 'memory';
  ok: boolean;
  message: string;
  detail?: unknown;
}

const KEY_LABELS: Record<HealthCheckItem['key'], string> = {
  mongo: 'قاعدة البيانات',
  disk: 'مساحة القرص',
  backup: 'النسخ الاحتياطي',
  memory: 'الذاكرة',
};

// Self-contained system-health card (Arabic, RTL, dark-mode aware).
// On-demand only: polls GET /api/health every 60s + manual refresh button.
// No props. Collapses to a compact "سليم" pill when all checks pass.
const SystemHealth = () => {
  const [checks, setChecks] = useState<HealthCheckItem[]>([]);
  const [allOk, setAllOk] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const fetchHealth = useCallback(async () => {
    try {
      setError(null);
      const res = await (api as any).getHealth();
      if (cancelledRef.current) return;
      const data = res?.data;
      if (res?.success && data && Array.isArray(data.checks)) {
        setChecks(data.checks);
        setAllOk(Boolean(data.ok));
      } else {
        setError(res?.message || 'تعذر جلب حالة النظام');
      }
    } catch {
      if (!cancelledRef.current) setError('خطأ في الاتصال بالخادم');
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    fetchHealth();
    const timer = setInterval(fetchHealth, 60000);
    return () => {
      cancelledRef.current = true;
      clearInterval(timer);
    };
  }, [fetchHealth]);

  const failing = checks.filter((c) => !c.ok);

  if (loading) {
    return (
      <div dir="rtl" className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        <span>فحص النظام...</span>
      </div>
    );
  }

  if (error && checks.length === 0) {
    return (
      <div dir="rtl" className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800">
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        <span>{error}</span>
        <button onClick={() => { setLoading(true); fetchHealth(); }} className="ms-1 p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg" title="إعادة المحاولة">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // Collapsed healthy state.
  if (allOk) {
    return (
      <div dir="rtl" className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800" title="كل فحوصات النظام سليمة">
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        <Activity className="h-3.5 w-3.5" />
        <span>النظام سليم</span>
        <button onClick={fetchHealth} className="p-0.5 hover:bg-green-100 dark:hover:bg-green-900/40 rounded" title="تحديث">
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
    );
  }

  // Expanded alert state — only failing rows.
  return (
    <div dir="rtl" className="flex flex-col gap-1 px-3 py-2 rounded-xl text-xs border bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-bold">
          <Activity className="h-3.5 w-3.5" />
          <span>تنبيهات النظام ({failing.length})</span>
        </div>
        <button onClick={fetchHealth} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg" title="تحديث">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      {failing.map((c) => (
        <div key={c.key} className="flex items-center gap-1.5">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 flex-shrink-0" />
          <span className="font-medium">{KEY_LABELS[c.key]}:</span>
          <span className="truncate" title={c.message}>{c.message}</span>
        </div>
      ))}
    </div>
  );
};

export default SystemHealth;
