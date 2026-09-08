import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../services/api/client';
import { getServerUrlOverride } from '../utils/apiBase';
import ModalPortal from './ModalPortal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function baseOfApi(): string {
  return apiClient.baseURL.replace(/\/api$/, '');
}

const ServerConnectionModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState(() => getServerUrlOverride() || baseOfApi());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const normalize = (v: string) => v.trim().replace(/\/+$/, '');

  const handleTest = async () => {
    const target = normalize(url);
    if (!target) return;
    setTesting(true);
    setTestResult(null);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${target}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      setTestResult({ ok: true, message: `${t('serverConnection.testOk')} (${data.app || 'server'})` });
    } catch (e: any) {
      setTestResult({ ok: false, message: e?.name === 'AbortError' ? t('serverConnection.testTimeout') : t('serverConnection.testFail') });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const target = normalize(url);
    if (!target) return;
    apiClient.setBaseURL(target);
    window.location.reload();
  };

  const handleReset = () => {
    try {
      window.localStorage.removeItem('bomba_server_url');
    } catch {}
    window.location.reload();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{t('serverConnection.title')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('serverConnection.desc')}</p>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('serverConnection.current')}
          </label>
          <p className="text-sm font-mono bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 mb-4 break-all" dir="ltr">
            {baseOfApi()}
          </p>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('serverConnection.newUrl')}
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://192.168.1.10:5000"
            dir="ltr"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-orange-400 outline-none mb-2"
          />

          {testResult && (
            <p className={`text-sm mb-2 ${testResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {testResult.message}
            </p>
          )}

          <div className="flex gap-2 mt-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex-1 py-2.5 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded-xl font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
            >
              {testing ? t('serverConnection.testing') : t('serverConnection.test')}
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold"
            >
              {t('serverConnection.save')}
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={handleReset} className="flex-1 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              {t('serverConnection.reset')}
            </button>
            <button onClick={onClose} className="flex-1 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ServerConnectionModal;
