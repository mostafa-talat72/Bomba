import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import api from '../services/api';

interface NewerPeer {
  deviceId: string;
  name: string;
  ip: string;
  version: string;
}

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Self-contained LAN update banner: polls GET /api/update/check on mount +
// every 5min. If any peer reports a newer version, shows an amber banner
// top-center with one-click installer download. No props required.
const UpdateBanner = () => {
  const [newerPeers, setNewerPeers] = useState<NewerPeer[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res: any = await (api as any).checkPeerVersions();
        if (cancelled) return;
        const peers = res?.success ? res?.data?.peers || res?.peers || [] : [];
        const newer = (Array.isArray(peers) ? peers : []).filter((p: any) => p?.newer);
        setNewerPeers(newer);
        if (newer.length > 0) setDismissed(false);
      } catch {
        // Offline / unauthorized — stay silent, retry on next interval.
      }
    };
    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result: any = await (api as any).downloadUpdate();
      if (!result?.ok) setError(result?.message || 'فشل تنزيل المثبت');
    } catch {
      setError('خطأ في الاتصال بالخادم أثناء التنزيل');
    } finally {
      setBusy(false);
    }
  };

  if (dismissed || newerPeers.length === 0) return null;
  const first = newerPeers[0];

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[500] flex flex-col items-center gap-1 pointer-events-auto">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-2xl text-sm font-bold bg-amber-500 text-white border border-amber-600">
        <Download className="h-4 w-4 shrink-0" />
        <span>
          يوجد إصدار أحدث ({first.version}) على جهاز {first.name}
          {newerPeers.length > 1 ? ` (+${newerPeers.length - 1})` : ''}
        </span>
        <button
          onClick={handleDownload}
          disabled={busy}
          className="px-3 py-1 rounded-lg bg-white text-amber-700 text-xs font-extrabold hover:bg-amber-50 disabled:opacity-60"
        >
          {busy ? 'جارٍ التنزيل...' : 'تنزيل المثبت'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          title="تجاهل"
          className="p-1 rounded-lg hover:bg-amber-600/60 text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {error && (
        <div className="px-3 py-1.5 rounded-lg shadow text-xs font-bold bg-red-600 text-white">
          {error}
        </div>
      )}
    </div>
  );
};

export default UpdateBanner;
