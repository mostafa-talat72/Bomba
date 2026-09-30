import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Copy, Check, QrCode, RefreshCw, Printer, FileDown } from 'lucide-react';
import ModalPortal from '../ModalPortal';
import { apiClient } from '../../services/api';
import { getTableDisplay } from './tableHelpers';

interface TableQrModalProps {
  tableNumber: string | number;
  tableId: string;
  orgId: string;
  onClose: () => void;
}

interface QrEntry {
  ip: string;
  url: string;
  qr: string | null;
}

function apiBase(): string {
  try {
    return String((apiClient as any).baseURL || '').replace(/\/api$/, '');
  } catch {
    return '';
  }
}

const TableQrModal: React.FC<TableQrModalProps> = ({ tableNumber, tableId, orgId, onClose }) => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<QrEntry[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setEntries([]);
    try {
      const base = apiBase();
      if (!base || !orgId || !tableId) return;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${base}/api/lan/status`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const ips: string[] = [];
      const all = data?.discovery?.allLocalIPs;
      if (Array.isArray(all)) {
        for (const e of all) {
          const ip = typeof e === 'string' ? e : e?.ip;
          if (ip && ip !== '127.0.0.1' && ip !== 'localhost' && !ips.includes(ip)) ips.push(ip);
        }
      }
      if (!ips.length) {
        const ip = data?.discovery?.localIP || data?.lan?.localIP || null;
        if (ip && ip !== '127.0.0.1' && ip !== 'localhost') ips.push(ip);
      }
      if (!ips.length) return;
      const built: QrEntry[] = [];
      for (const ip of ips) {
        const u = new URL(window.location.href);
        u.hostname = ip;
        // منشأ العميل دائماً على منفذ الواجهة 3000 (البروكسي للـ API)
        u.port = '3000';
        u.pathname = '/menu-view';
        u.search = `?org=${encodeURIComponent(orgId)}&table=${encodeURIComponent(tableId)}`;
        const url = u.toString();
        let qr: string | null = null;
        try {
          const { default: QRCode } = await import('qrcode');
          qr = await QRCode.toDataURL(url, { width: 260, margin: 1 });
        } catch {
          qr = null;
        }
        built.push({ ip, url, qr });
      }
      setEntries(built);
      setActiveIdx(0);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, tableId]);

  useEffect(() => {
    load();
  }, [load]);

  const active = entries[activeIdx] || null;

  const handleCopy = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = active.url;
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

  const qrTitle = `${t('tables.qr.title')} ${getTableDisplay(tableNumber, i18n.language)}`;

  const handlePrint = () => {
    if (!active?.qr) return;
    const w = window.open('', '_blank', 'width=420,height=560');
    if (!w) return;
    const dir = i18n.dir() === 'rtl' ? 'rtl' : 'ltr';
    w.document.write(
      `<html dir="${dir}"><head><title>${qrTitle}</title>` +
      `<style>body{font-family:sans-serif;text-align:center;padding:24px;color:#111}` +
      `img{width:260px;height:260px;margin:8px auto}` +
      `p.url{word-break:break-all;font-size:12px;color:#555;margin-top:12px}</style></head>` +
      `<body><h2>${qrTitle}</h2><img src="${active.qr}" alt="QR"/>` +
      `<p class="url">${active.url}</p>` +
      `<script>window.onload=function(){window.print()}<\/script></body></html>`
    );
    w.document.close();
  };

  const handlePdf = async () => {
    if (!active?.qr) return;
    try {
      const { jsPDF } = await import('jspdf');
      // بطاقة مربعة مناسبة للطباعة على الطاولة (نص لاتيني فقط لتوافق خطوط PDF)
      const doc = new jsPDF({ unit: 'mm', format: [100, 130] });
      doc.setFontSize(15);
      doc.text(`Table ${String(tableNumber)}`, 50, 14, { align: 'center' });
      doc.addImage(active.qr, 'PNG', 15, 20, 70, 70);
      doc.setFontSize(7.5);
      const lines = doc.splitTextToSize(active.url, 90);
      doc.text(lines, 50, 96, { align: 'center' });
      doc.save(`table-${String(tableNumber)}-qr.pdf`);
    } catch {
      // fallback: نافذة الطباعة (الحفظ كـ PDF من المتصفح)
      handlePrint();
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-5 border border-gray-200 dark:border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <QrCode className="h-5 w-5 text-orange-500" />
              {t('tables.qr.title')} {getTableDisplay(tableNumber, i18n.language)}
            </h3>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('tables.qr.hint')}</p>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
            </div>
          ) : !active ? (
            <div className="text-center py-6">
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">{t('tables.qr.noLan')}</p>
              <button
                onClick={load}
                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-bold text-gray-700 dark:text-gray-200 inline-flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                {t('tables.qr.retry')}
              </button>
            </div>
          ) : (
            <>
              {entries.length > 1 && (
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {entries.map((e, i) => (
                    <button
                      key={e.ip}
                      onClick={() => setActiveIdx(i)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                        i === activeIdx
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      {e.ip}
                    </button>
                  ))}
                </div>
              )}
              <div className="bg-white p-3 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-center">
                {active.qr ? (
                  <img src={active.qr} alt="QR" className="w-56 h-56" />
                ) : (
                  <p className="text-sm text-gray-400 py-10">{t('tables.qr.failed')}</p>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2 break-all" dir="ltr">{active.url}</p>
              <button
                onClick={handleCopy}
                className="mt-3 w-full py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? t('tables.qr.copied') : t('tables.qr.copy')}
              </button>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={handlePrint}
                  disabled={!active.qr}
                  className="py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" />
                  {t('tables.qr.print')}
                </button>
                <button
                  onClick={handlePdf}
                  disabled={!active.qr}
                  className="py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <FileDown className="h-4 w-4" />
                  {t('tables.qr.pdf')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalPortal>
  );
};

export default TableQrModal;
