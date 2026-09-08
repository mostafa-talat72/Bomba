import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { apiClient } from '../services/api';

function apiBase(): string {
  try {
    return String((apiClient as any).baseURL || '').replace(/\/api$/, '');
  } catch {
    return '';
  }
}

// App URL for phones: same origin, hostname swapped to the server LAN IP.
function buildAppUrl(lanIp: string): string | null {
  try {
    if (typeof window === 'undefined' || !lanIp) return null;
    const u = new URL(window.location.href);
    u.hostname = lanIp;
    u.pathname = '/';
    u.search = '';
    u.hash = '';
    return u.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

const MobileConnectCard: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [lanIp, setLanIp] = useState<string | null>(null);
  const [appUrl, setAppUrl] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setQr(null);
    try {
      const base = apiBase();
      if (!base) return;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${base}/api/lan/status`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const ip = data?.discovery?.localIP || data?.lan?.localIP || null;
      if (!ip || ip === '127.0.0.1' || ip === 'localhost') {
        setLanIp(null);
        return;
      }
      setLanIp(ip);
      const url = buildAppUrl(ip);
      setAppUrl(url);
      if (url) {
        try {
          setQr(await QRCode.toDataURL(url, { width: 220, margin: 1 }));
        } catch {
          setQr(null);
        }
      }
    } catch {
      setLanIp(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCopy = async () => {
    if (!appUrl) return;
    try {
      await navigator.clipboard.writeText(appUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = appUrl;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('settings.mobile.title')}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('settings.mobile.desc')}</p>
      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">{t('settings.organization.loading')}</p>
      ) : !lanIp || !appUrl ? (
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
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          {qr ? (
            <img src={qr} alt="QR" className="w-44 h-44 rounded-lg border border-gray-200 dark:border-gray-600 bg-white p-1" />
          ) : (
            <div className="w-44 h-44 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm text-gray-500">QR</div>
          )}
          <div className="flex-1 min-w-0 text-center sm:text-right">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{t('settings.mobile.scanHint')}</p>
            <p className="text-sm font-mono bg-white dark:bg-gray-800 rounded-lg px-3 py-2 mb-3 break-all" dir="ltr">
              {appUrl}
            </p>
            <div className="flex gap-2 justify-center sm:justify-start">
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg"
              >
                {copied ? t('settings.mobile.copied') : t('settings.mobile.copy')}
              </button>
              <button
                type="button"
                onClick={load}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 text-sm rounded-lg"
              >
                {t('settings.mobile.refresh')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileConnectCard;
