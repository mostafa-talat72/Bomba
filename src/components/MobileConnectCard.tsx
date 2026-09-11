import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { apiClient } from '../services/api';
import { isDesktopApp } from '../utils/apiBase';

function apiBase(): string {
  try {
    return String((apiClient as any).baseURL || '').replace(/\/api$/, '');
  } catch {
    return '';
  }
}

interface LanEntry {
  ip: string;
  iface: string;
}

// App URL for phones: same origin, hostname swapped to the server LAN IP.
function buildAppUrl(lanIp: string, port: string): string | null {
  try {
    if (typeof window === 'undefined' || !lanIp) return null;
    const u = new URL(window.location.href);
    u.hostname = lanIp;
    if (port) u.port = port;
    u.pathname = '/';
    u.search = '';
    u.hash = '';
    return u.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

// Chrome-only deep link (Android): forces the scan to open in Chrome instead
// of the QR scanner's internal browser (which shows a white screen).
// Format: intent://HOST:PORT/#Intent;scheme=http;package=com.android.chrome;S.browser_fallback_url=<http url>;end
// iPhones ignore it — they use the plain link copied below.
function buildChromeIntentUrl(httpUrl: string): string | null {
  try {
    const u = new URL(httpUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const scheme = u.protocol.replace(':', '');
    const hostPort = u.host; // hostname:port
    const fallback = encodeURIComponent(httpUrl);
    return `intent://${hostPort}/#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
  } catch {
    return null;
  }
}

// Reachability probe for the phone's exact path (LAN IP + port).
// no-cors: an opaque response still proves something is listening.
async function isPortReachable(lanIp: string, port: string, timeoutMs = 3000): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    await fetch(`http://${lanIp}:${port}/`, { mode: 'no-cors', signal: ctrl.signal });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

interface QrEntry extends LanEntry {
  url: string;
  port: string;
  qr: string | null;
}

const MobileConnectCard: React.FC<{ showChromeOption?: boolean }> = ({ showChromeOption = true }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<QrEntry[]>([]);
  const [chromeOnly, setChromeOnly] = useState(false);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setEntries([]);
    try {
      const base = apiBase();
      if (!base) return;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${base}/api/lan/status`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const rawList: LanEntry[] = [];
      const all = data?.discovery?.allLocalIPs;
      if (Array.isArray(all)) {
        for (const e of all) {
          const ip = typeof e === 'string' ? e : e?.ip;
          if (ip && ip !== '127.0.0.1' && ip !== 'localhost') {
            rawList.push({ ip, iface: typeof e === 'object' ? String(e?.iface || '') : '' });
          }
        }
      }
      if (!rawList.length) {
        const ip = data?.discovery?.localIP || data?.lan?.localIP || null;
        if (ip && ip !== '127.0.0.1' && ip !== 'localhost') rawList.push({ ip, iface: '' });
      }
      if (!rawList.length) return;

      const currentPort = (() => {
        try {
          return new URL(window.location.href).port || '5000';
        } catch {
          return '5000';
        }
      })();
      const built: QrEntry[] = [];
      for (const entry of rawList) {
        // Desktop/installed: :3000 is guaranteed (same-process frontend entry).
        // Browser/dev: probe :3000, fall back to the serving port if silent.
        let usePort = '3000';
        try {
          if (!isDesktopApp && currentPort !== '3000' && !(await isPortReachable(entry.ip, '3000'))) {
            usePort = currentPort;
          }
        } catch {
          usePort = '3000';
        }
        const url = buildAppUrl(entry.ip, usePort);
        if (!url) continue;
        built.push({ ...entry, url, port: usePort, qr: null });
      }
      // QR images (sequential, cheap)
      for (const b of built) {
        const payload = chromeOnly ? buildChromeIntentUrl(b.url) || b.url : b.url;
        try {
          b.qr = await QRCode.toDataURL(payload, { width: 220, margin: 1 });
        } catch {
          b.qr = null;
        }
      }
      setEntries(built);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [chromeOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCopy = async (entry: QrEntry) => {
    try {
      await navigator.clipboard.writeText(entry.url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = entry.url;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {}
      document.body.removeChild(ta);
    }
    setCopiedIp(entry.ip);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('settings.mobile.title')}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('settings.mobile.desc')}</p>
      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">{t('settings.organization.loading')}</p>
      ) : entries.length === 0 ? (
        <div className="flex items-center gap-2">
          <p className="text-sm text-amber-600 dark:text-amber-400 flex-1">{t('settings.mobile.noLan')}</p>
          <button
            type="button"
            onClick={load}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
          >
            {t('settings.mobile.refresh')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {showChromeOption && (
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chromeOnly}
                  onChange={(e) => setChromeOnly(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                {t('settings.mobile.chromeOnly')}
              </label>
            )}
            <button
              type="button"
              onClick={load}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 text-sm rounded-lg"
            >
              {t('settings.mobile.refresh')}
            </button>
          </div>
          {showChromeOption && chromeOnly && (
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">{t('settings.mobile.chromeHint')}</p>
          )}
          {entries.length > 1 && (
            <p className="text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
              {t('settings.mobile.multiNet')}
            </p>
          )}
          <div className={`grid gap-4 ${entries.length > 1 ? 'sm:grid-cols-2' : ''}`}>
            {entries.map((entry) => (
              <div key={entry.ip} className="flex flex-col sm:flex-row items-center gap-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                {entry.qr ? (
                  <img src={entry.qr} alt="QR" className="w-44 h-44 rounded-lg border border-gray-200 dark:border-gray-600 bg-white p-1 flex-shrink-0" />
                ) : (
                  <div className="w-44 h-44 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm text-gray-500 flex-shrink-0">QR</div>
                )}
                <div className="flex-1 min-w-0 text-center sm:text-right w-full">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1" dir="ltr">
                    {entry.ip}:{entry.port}
                  </p>
                  {entry.iface && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2" dir="ltr">{entry.iface}</p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('settings.mobile.scanHint')}</p>
                  <p className="text-xs font-mono bg-white dark:bg-gray-800 rounded-lg px-2 py-1.5 mb-3 break-all" dir="ltr">
                    {entry.url}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopy(entry)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg"
                  >
                    {copiedIp === entry.ip ? t('settings.mobile.copied') : t('settings.mobile.copy')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileConnectCard;
