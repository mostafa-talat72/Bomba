import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import type { ConnectedDevice } from '../services/api/connectedDevices';
import ConfirmModal from './ConfirmModal';

function deviceName(d: ConnectedDevice, t: (k: string) => string): string {
  if (d.label) return d.label;
  const parts = [d.platform, d.browser].filter(Boolean);
  if (parts.length) return parts.join(' • ');
  return d.deviceType === 'desktop'
    ? t('settings.devices.desktop')
    : d.deviceType === 'mobile'
      ? t('settings.devices.mobile')
      : t('settings.devices.browser');
}

const ConnectedDevicesCard: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [forgetTarget, setForgetTarget] = useState<ConnectedDevice | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.listConnectedDevices();
      if (res.success && Array.isArray(res.data)) {
        setDevices(res.data);
        setError(null);
      } else if (!silent) {
        setError(res.message || t('settings.devices.loadFail'));
      }
    } catch {
      if (!silent) setError(t('settings.devices.loadFail'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 10000);
    return () => clearInterval(timer);
  }, [load]);

  const handleTogglePrint = async (d: ConnectedDevice) => {
    const prev = devices;
    setDevices(devices.map((x) => (x.instanceId === d.instanceId ? { ...x, canPrint: !x.canPrint } : x)));
    try {
      const res = await api.updateConnectedDevice(d.instanceId, { canPrint: !d.canPrint });
      if (!res.success) setDevices(prev);
    } catch {
      setDevices(prev);
    }
  };

  const handleForget = async () => {
    const d = forgetTarget;
    setForgetTarget(null);
    if (!d) return;
    const prev = devices;
    setDevices(devices.filter((x) => x.instanceId !== d.instanceId));
    try {
      const res = await api.forgetConnectedDevice(d.instanceId);
      if (!res.success) setDevices(prev);
    } catch {
      setDevices(prev);
    }
  };

  const startRename = (d: ConnectedDevice) => {
    setEditingLabel(d.instanceId);
    setLabelDraft(d.label || '');
  };

  const saveRename = async (d: ConnectedDevice) => {
    setEditingLabel(null);
    if (labelDraft.trim() === (d.label || '')) return;
    const prev = devices;
    setDevices(devices.map((x) => (x.instanceId === d.instanceId ? { ...x, label: labelDraft.trim() } : x)));
    try {
      const res = await api.updateConnectedDevice(d.instanceId, { label: labelDraft.trim() });
      if (!res.success) setDevices(prev);
    } catch {
      setDevices(prev);
    }
  };

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('settings.devices.title')}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('settings.devices.desc')}</p>
      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">{t('settings.organization.loading')}</p>
      ) : error ? (
        <div className="flex items-center gap-2">
          <p className="text-sm text-red-600 dark:text-red-400 flex-1">{error}</p>
          <button
            type="button"
            onClick={() => load()}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
          >
            {t('settings.mobile.refresh')}
          </button>
        </div>
      ) : devices.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.devices.empty')}</p>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="sm:hidden space-y-2">
            {devices.map((d) => (
              <div key={d.instanceId} className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  {editingLabel === d.instanceId ? (
                    <input
                      autoFocus
                      value={labelDraft}
                      onChange={(e) => setLabelDraft(e.target.value)}
                      onBlur={() => saveRename(d)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(d);
                        if (e.key === 'Escape') setEditingLabel(null);
                      }}
                      className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  ) : (
                    <button type="button" onClick={() => startRename(d)} title={d.instanceId} className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate hover:underline text-right">
                      {deviceName(d, t)}
                    </button>
                  )}
                  <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${d.online ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${d.online ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {d.online ? t('settings.devices.online') : t('settings.devices.offline')}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  <span className="font-mono" dir="ltr">{d.ip}</span>
                  <span>•</span>
                  <span className="truncate">{d.user?.username || '—'}</span>
                  {!d.online && <span>•</span>}
                  {!d.online && <span className="truncate">{fmtTime(d.lastSeen)}</span>}
                </div>
                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={d.canPrint}
                      aria-label={t('settings.devices.print')}
                      onClick={() => handleTogglePrint(d)}
                      className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${d.canPrint ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${d.canPrint ? 'right-1' : 'left-1'}`} />
                    </button>
                    <span className={`text-[11px] font-bold whitespace-nowrap ${d.canPrint ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                      {t('settings.devices.print')}: {d.canPrint ? t('settings.devices.allowed') : t('settings.devices.blocked')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForgetTarget(d)}
                    className="min-h-8 px-2 text-[11px] text-red-600 dark:text-red-400 font-bold flex-shrink-0"
                  >
                    {t('settings.devices.forget')}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop: table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
            <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                <th className="px-3 py-2 text-right font-medium">{t('settings.devices.device')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('settings.devices.ip')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('settings.devices.user')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('settings.devices.status')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('settings.devices.print')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('settings.devices.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.instanceId} className="border-t border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200">
                  <td className="px-3 py-2">
                    {editingLabel === d.instanceId ? (
                      <input
                        autoFocus
                        value={labelDraft}
                        onChange={(e) => setLabelDraft(e.target.value)}
                        onBlur={() => saveRename(d)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(d);
                          if (e.key === 'Escape') setEditingLabel(null);
                        }}
                        className="w-full max-w-44 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    ) : (
                      <button type="button" onClick={() => startRename(d)} title={d.instanceId} className="hover:underline">
                        {deviceName(d, t)}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs" dir="ltr">{d.ip}</td>
                  <td className="px-3 py-2">{d.user?.username || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${d.online ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${d.online ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {d.online ? t('settings.devices.online') : fmtTime(d.lastSeen)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={d.canPrint}
                        aria-label={t('settings.devices.print')}
                        onClick={() => handleTogglePrint(d)}
                        className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${d.canPrint ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${d.canPrint ? 'right-1' : 'left-1'}`} />
                      </button>
                      <span className={`text-[11px] font-bold whitespace-nowrap ${d.canPrint ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                        {d.canPrint ? t('settings.devices.allowed') : t('settings.devices.blocked')}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setForgetTarget(d)}
                      className="min-h-9 px-2 text-xs text-red-600 dark:text-red-400 hover:underline font-bold"
                    >
                      {t('settings.devices.forget')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
      <ConfirmModal
        isOpen={forgetTarget !== null}
        onClose={() => setForgetTarget(null)}
        onConfirm={handleForget}
        title={t('settings.devices.forget')}
        message={t('settings.devices.forgetConfirm')}
        confirmText={t('settings.devices.forget')}
        cancelText={t('common.cancel')}
        confirmColor="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
};

export default ConnectedDevicesCard;
