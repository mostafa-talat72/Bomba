import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PrintDesigner from './PrintDesigner';

export interface DetectedPrinter {
  name: string;
  path?: string;
  port?: string;
  driver?: string;
}

export interface MenuSectionRef {
  _id?: string;
  id?: string;
  name: string;
}

export interface PrinterSettingsFormProps {
  settings: Record<string, any>;
  onPatch: (patch: Record<string, any>) => void;
  menuSections: MenuSectionRef[];
  availablePrinters: DetectedPrinter[];
  detecting: boolean;
  onDetect: () => void;
  onSelectDetected: (printer: DetectedPrinter) => void;
  onTestPrinter: (printer: { path?: string; name?: string }) => void;
  logoUrl?: string;
  orgName?: string;
  // Ø¥Ø®ÙØ§Ø¡ Ù…ÙØ§ØªÙŠØ­ Ø§Ù„Ø·Ø¨Ø§Ø¹Ø© Ø§Ù„Ù…Ø²Ø¯ÙˆØ¬Ø© (ØªØ¨ÙˆÙŠØ¨ "Ø·Ø§Ø¨Ø¹ØªÙŠ" ÙŠØ¹Ø±Ø¶Ù‡Ø§ Ù…Ù†ÙØµÙ„Ø© Ø£Ø¹Ù„Ø§Ù‡) â€” Ù„Ù„Ù…Ù†Ø´Ø£Ø© ØªØ¸Ù‡Ø± Ø¯Ø§Ø®Ù„ Ø§Ù„Ø£ØªÙ…ØªØ©
  showPrintBoth?: boolean;
  saveNote?: string;
}

const PrinterSettingsForm: React.FC<PrinterSettingsFormProps> = ({
  settings,
  onPatch,
  menuSections,
  availablePrinters,
  detecting,
  onDetect,
  onSelectDetected,
  onTestPrinter,
  logoUrl,
  orgName,
  showPrintBoth = true,
  saveNote,
}) => {
  const { t } = useTranslation();
  const organization = { printSettings: settings };
  const setOrganization: any = (updater: any) => {
    const next = typeof updater === 'function' ? updater(organization) : updater;
    onPatch(next?.printSettings || {});
  };
  const detectPrinters = onDetect;
  const detectingPrinters = detecting;
  const selectPrinter = onSelectDetected;
  const testPrinter = onTestPrinter;
  const [subTab, setSubTab] = useState('printers');
  const TabBtn = ({ id, label }: { id: string; label: string }) => (
    <button type="button" onClick={() => setSubTab(id)} className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${subTab === id ? 'bg-orange-600 text-white border-orange-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}>{label}</button>
  );

  const patch = (extra: Record<string, any>) => setOrganization((prev: any) => ({ ...prev, printSettings: { ...prev.printSettings, ...extra } }));

  // â€”â€” Ø£ØªÙ…ØªØ© Ù„ÙƒÙ„ Ù†ÙˆØ¹ Ø·Ù„Ø¨: Ù†ÙØ³ Ø§Ù„ØªØ­ÙƒÙ…Ø§ØªØŒ ÙƒÙ„ Ù†ÙˆØ¹ Ø¨Ø¥Ø¹Ø¯Ø§Ø¯Ø§ØªÙ‡ (Ø§Ù„ÙØ§Ø±Øº ÙŠØªØ¨Ø¹ Ø§Ù„Ø·Ø§ÙˆÙ„Ø§Øª)
  const getAuto = (base: string, sfx: '' | 'Takeaway' | 'Delivery'): any => {
    if (!sfx) return (organization.printSettings as any)?.[base];
    const v = (organization.printSettings as any)?.[`${base}${sfx}`];
    return v !== undefined ? v : (organization.printSettings as any)?.[base];
  };
  const isAutoInherited = (base: string, sfx: '' | 'Takeaway' | 'Delivery'): boolean =>
    !!sfx && (organization.printSettings as any)?.[`${base}${sfx}`] === undefined;
  const setAuto = (base: string, sfx: '' | 'Takeaway' | 'Delivery', v: any) =>
    patch({ [`${base}${sfx}`]: v });
  const FollowBadge = () => (
    <span className="ms-2 inline-block rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 text-[10px] font-bold">{t('settings.organization.printSettings.routingFollowTables')}</span>
  );
  const AutoToggle = ({ base, sfx, titleKey, descKey, def }: { base: string; sfx: '' | 'Takeaway' | 'Delivery'; titleKey: string; descKey: string; def: boolean }) => {
    const raw = getAuto(base, sfx);
    const checked = raw === undefined ? def : raw === true;
    return (
      <div className="flex items-center justify-between py-1">
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {t(`settings.organization.printSettings.${titleKey}` as any)}
            {isAutoInherited(base, sfx) && <FollowBadge />}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t(`settings.organization.printSettings.${descKey}` as any)}</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input type="checkbox" checked={checked} onChange={(e) => setAuto(base, sfx, e.target.checked)} className="sr-only peer" />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
        </label>
      </div>
    );
  };
  const autoGroups: Array<{ f: string; sfx: '' | 'Takeaway' | 'Delivery'; title: string; desc: string }> = [
    { f: 'dine_in', sfx: '', title: t('settings.organization.printSettings.autoGroupDineInTitle'), desc: t('settings.organization.printSettings.autoGroupDineInDesc') },
    { f: 'takeaway', sfx: 'Takeaway', title: t('settings.organization.printSettings.autoGroupTakeawayTitle'), desc: t('settings.organization.printSettings.autoGroupTakeawayDesc') },
    { f: 'delivery', sfx: 'Delivery', title: t('settings.organization.printSettings.autoGroupDeliveryTitle'), desc: t('settings.organization.printSettings.autoGroupDeliveryDesc') },
  ];

  // Ù‚Ø±Ø§Ø¡Ø© Ø¢Ù…Ù†Ø© Ù„Ø®Ø±Ø§Ø¦Ø· Ø§Ù„ØªÙˆØ¬ÙŠÙ‡ (ÙƒØ§Ø¦Ù† Ø¹Ø§Ø¯ÙŠ Ù…Ù† API Ø£Ùˆ Map Ù…Ù† Mongoose Ù…Ø¨Ø§Ø´Ø±Ø©)
  // ØªØ¯Ø¹Ù… string (Ù„Ù„Ø·Ø§Ø¨Ø¹Ø§Øª) Ùˆ string[] (Ù„Ù†Ø³Ø® Ø§Ù„Ø£Ù‚Ø³Ø§Ù…)
  const getMapVal = (obj: any, key: string): string | string[] => {
    if (!obj) return '';
    if (typeof obj.get === 'function') {
      try { const v = obj.get(key); return v === undefined || v === null ? '' : v; } catch { return ''; }
    }
    const v = obj[key];
    return v === undefined || v === null ? '' : v;
  };
  const setMapVal = (mapKey: string, sectionId: string, value: string | string[]) =>
    setOrganization((prev: any) => {
      const cur = (prev.printSettings as any)?.[mapKey];
      const plain = cur && typeof cur === 'object' && typeof cur.get === 'function'
        ? Object.fromEntries(cur.entries())
        : { ...(cur || {}) };
      if (!value || (Array.isArray(value) && value.length === 0) || value === '') delete plain[sectionId];
      else plain[sectionId] = value;
      return { ...prev, printSettings: { ...prev.printSettings, [mapKey]: plain } };
    });

  // â€”â€” Ù†Ø³Ø® Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª ÙˆØ·Ø§Ø¨Ø¹Ø© ÙƒÙ„ Ù†Ø³Ø®Ø© (ØªØ¨ÙˆÙŠØ¨ Ø§Ù„ØªÙˆØ¬ÙŠÙ‡): Ø§Ù„Ù…ØµÙÙˆÙØ© Ù‡ÙŠ Ø§Ù„Ù…Ø±Ø¬Ø¹ØŒ ÙˆØ§Ù„Ø¹Ø¯Ø¯ Ø§Ù„Ù‚Ø¯ÙŠÙ… Ø§Ø­ØªÙŠØ§Ø·ÙŠ
  const getCopyList = (key: string, legacyFallback?: string): string[] => {
    const maps = (organization.printSettings as any)?.documentCopyPrinters;
    const raw = maps && typeof maps.get === 'function'
      ? (() => { try { return maps.get(key); } catch { return undefined; } })()
      : maps?.[key];
    if (Array.isArray(raw) && raw.length) return raw.slice(0, 5).map((x) => String(x || ''));
    const copiesObj = (organization.printSettings as any)?.documentCopies;
    const getNum = (k: string) => copiesObj && typeof copiesObj.get === 'function'
      ? (() => { try { return copiesObj.get(k); } catch { return undefined; } })()
      : copiesObj?.[k];
    const n = Math.min(5, Math.max(1, Number(getNum(key) ?? (legacyFallback ? getNum(legacyFallback) : undefined) ?? 1) || 1));
    return Array(n).fill('');
  };
  const setCopyList = (key: string, list: string[]) =>
    setOrganization((prev: any) => ({
      ...prev,
      printSettings: {
        ...prev.printSettings,
        documentCopyPrinters: { ...((prev.printSettings as any)?.documentCopyPrinters || {}), [key]: list },
      },
    }));
  const setCopyCount = (key: string, n: number) => {
    const cur = getCopyList(key);
    const count = Math.min(5, Math.max(1, Number(n) || 1));
    setCopyList(key, Array.from({ length: count }, (_, i) => cur[i] || ''));
  };
  const docDefaultPrinterName = (docKey: string): string => {
    const pid = (organization.printSettings as any)?.documentPrinterMap?.[docKey] || '';
    if (!pid) return '';
    return (organization.printSettings?.printers || []).find((p: any) => p.id === pid)?.name || '';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <TabBtn id="printers" label={t('settings.organization.printSettings.tabPrinters')} />
        <TabBtn id="routing" label={t('settings.organization.printSettings.tabRouting')} />
        <TabBtn id="automation" label={t('settings.organization.printSettings.tabAutomation')} />
        <TabBtn id="designer" label={t('settings.organization.printSettings.designerTab')} />
      </div>

      {subTab === 'printers' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('settings.organization.printSettings.printerType')}
            </label>
            <select
              value={organization.printSettings?.printerType || 'none'}
              onChange={(e) => patch({ printerType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="none">{t('settings.organization.printSettings.none')}</option>
              <option value="usb">{t('settings.organization.printSettings.usb')}</option>
              <option value="network">{t('settings.organization.printSettings.network')}</option>
              <option value="bluetooth">{t('settings.organization.printSettings.bluetooth')}</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('settings.organization.printSettings.printerTypeDesc')}
            </p>
          </div>

          {organization.printSettings?.printerType === 'usb' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.organization.printSettings.printerDevice')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={organization.printSettings?.printerDevice || ''}
                  onChange={(e) => patch({ printerDevice: e.target.value })}
                  placeholder="e.g., /dev/usb/lp0 or COM1"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={detectPrinters}
                  disabled={detectingPrinters}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {detectingPrinters ? (
                    <>
                      <span className="animate-spin">âŸ³</span>
                      {t('settings.organization.printSettings.detecting')}
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      {t('settings.organization.printSettings.detectPrinters')}
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('settings.organization.printSettings.printerDeviceDesc')}
              </p>

              {availablePrinters.length > 0 && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.organization.printSettings.availablePrinters')}
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-2">
                    {availablePrinters.map((printer, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer"
                        onClick={() => selectPrinter(printer)}
                      >
                        <div>
                          <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{printer.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{printer.port || printer.path} {printer.driver && `(${printer.driver})`}</div>
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); testPrinter(printer); }} className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                          {t('settings.organization.printSettings.test')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-xl border border-orange-200 dark:border-gray-600 bg-white/60 dark:bg-gray-800/40 p-4">
<h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('settings.organization.printSettings.multiTitle')}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.multiDesc')}</p>
                <label className="mt-3 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">{t('settings.organization.printSettings.defaultPrinter')}
                  <select value={organization.printSettings?.printerName || ''} onChange={(e) => patch({ printerName: e.target.value })} className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5">
                    <option value="">{t('settings.organization.printSettings.none')}</option>
                    {(organization.printSettings?.printers || []).map((printer: any) => <option key={printer.id} value={printer.printerName || printer.name}>{printer.name}</option>)}
                  </select>
                </label>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.defaultPrinterDesc')}</p>
                <div className="mt-3 space-y-2">
                  {(organization.printSettings?.printers || []).map((printer: any) => (
                    <div key={printer.id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700 p-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-800 dark:text-gray-100">{printer.name}</span>
                        <input type="number" min={30} max={150} step={1} value={printer.paperWidthMm || 80} aria-label={printer.name} onChange={e => setOrganization((prev: any) => ({ ...prev, printSettings: { ...prev.printSettings, printers: (prev.printSettings?.printers || []).map((item: any) => item.id === printer.id ? { ...item, paperWidthMm: Number(e.target.value) || 80 } : item) } }))} className="w-20 rounded border border-gray-300 p-1 text-xs" />
                        <span className="text-xs text-gray-500">{t('settings.organization.printSettings.mm')}</span>
                      </div>
                      <button type="button" className="text-xs text-red-600" onClick={() => setOrganization((prev: any) => ({ ...prev, printSettings: { ...prev.printSettings, printers: (prev.printSettings?.printers || []).filter((item: any) => item.id !== printer.id) } }))}>{t('settings.organization.printSettings.remove')}</button>
                    </div>
                  ))}
                  {availablePrinters.map((printer) => {
                    const id = String(printer.path || printer.name);
                    const exists = organization.printSettings?.printers?.some((item: any) => item.id === id);
                    return exists ? null : (
                      <button key={id} type="button" className="w-full rounded-lg border border-dashed border-orange-300 p-2 text-sm text-orange-700 hover:bg-orange-50 text-right" onClick={() => setOrganization((prev: any) => ({ ...prev, printSettings: { ...prev.printSettings, printers: [...(prev.printSettings?.printers || []), { id, name: printer.name, printerName: printer.name, printerPath: printer.path || '', paperWidthMm: 80 }] } }))}>
                        {t('settings.organization.printSettings.add')} {printer.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'routing' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-orange-200 dark:border-gray-600 bg-white/60 dark:bg-gray-800/40 p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('settings.organization.printSettings.docRoutingTitle')}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.docRoutingDesc')}</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                ['bill', t('settings.organization.printSettings.docBill')],
                ['bill_takeaway', t('settings.organization.printSettings.docBillTakeaway')],
                ['bill_delivery', t('settings.organization.printSettings.docBillDelivery')],
                ['consumptionReport', t('settings.organization.printSettings.docConsumptionReport')],
                ['dailyReport', t('settings.organization.printSettings.docDailyReport')],
              ] as [string, string][]).map(([key, label]) => (
                <div key={key} className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                  <label className="text-xs text-gray-600 dark:text-gray-300">{label}
                    <select value={organization.printSettings?.documentPrinterMap?.[key] || ''} onChange={e => setOrganization((prev: any) => ({ ...prev, printSettings: { ...prev.printSettings, documentPrinterMap: { ...(prev.printSettings?.documentPrinterMap || {}), [key]: e.target.value } } }))} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2">
                      <option value="">{t('settings.organization.printSettings.defaultPrinter')}</option>
                      {(organization.printSettings?.printers || []).map((printer: any) => <option key={printer.id} value={printer.id}>{printer.name}</option>)}
                    </select>
                  </label>
                </div>
              ))}
            </div>
          </div>
          {organization.printSettings?.printerType === 'network' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.organization.printSettings.printerIP')}</label>
                <input type="text" value={organization.printSettings?.printerIP || ''} onChange={(e) => patch({ printerIP: e.target.value })} placeholder="192.168.1.100" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-gray-100" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.printerIPDesc')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.organization.printSettings.printerPort')}</label>
                <input type="number" value={organization.printSettings?.printerPort || 9100} onChange={(e) => patch({ printerPort: parseInt(e.target.value) || 9100 })} placeholder="9100" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-gray-100" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.printerPortDesc')}</p>
              </div>
            </div>
          )}

          {menuSections.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {([
                ['sectionPrinterMap', t('settings.organization.printSettings.routingDineInTitle'), t('settings.organization.printSettings.routingDineInDesc'), t('settings.organization.printSettings.defaultSection'), false],
                ['sectionPrinterMapTakeaway', t('settings.organization.printSettings.routingTakeawayTitle'), t('settings.organization.printSettings.routingTakeawayDesc'), t('settings.organization.printSettings.routingFollowTables'), true],
                ['sectionPrinterMapDelivery', t('settings.organization.printSettings.routingDeliveryTitle'), t('settings.organization.printSettings.routingDeliveryDesc'), t('settings.organization.printSettings.routingFollowTables'), true],
              ] as [string, string, string, string, boolean][]).map(([mapKey, title, desc, emptyLabel, isFollow]) => (
                <div key={mapKey} className="rounded-xl border border-orange-200 dark:border-gray-600 bg-white/60 dark:bg-gray-800/40 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{desc}</p>
                  <div className="mt-3 space-y-2">
                    {menuSections.map(section => {
                      const sectionId = String(section._id || section.id);
                      return <label key={`${mapKey}-${sectionId}`} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">{section.name}
                        <select value={getMapVal(organization.printSettings?.[mapKey], sectionId)} onChange={e => setMapVal(mapKey, sectionId, e.target.value)} className="ml-auto rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5">
                          <option value="">{emptyLabel}</option>
                          {(organization.printSettings?.printers || []).map((printer: any) => <option key={printer.id} value={printer.id}>{printer.name}</option>)}
                        </select>
                      </label>;
                      })}
                      </div>
                   {isFollow && (
                    <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{t('settings.organization.printSettings.routingEmptyHint')}</p>
                  )}
                </div>
              ))}
            </div>
          )}
              <div className="rounded-xl border border-orange-200 dark:border-gray-600 bg-white/60 dark:bg-gray-800/40 p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('settings.organization.printSettings.copiesRoutingTitle')}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.copiesRoutingDesc')}</p>
            <div className="mt-3 space-y-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {([
                ['bill', t('settings.organization.printSettings.docBill'), 'doc', 'bill'],
                ['bill_takeaway', t('settings.organization.printSettings.docBillTakeaway'), 'doc', 'bill_takeaway'],
                ['bill_delivery', t('settings.organization.printSettings.docBillDelivery'), 'doc', 'bill_delivery'],
                ['prep', t('settings.organization.printSettings.prepCopiesGeneral'), 'sections', 'prep'],
                ['prep_takeaway', t('settings.organization.printSettings.prepCopiesTakeaway'), 'sections', 'prep_takeaway'],
                ['prep_delivery', t('settings.organization.printSettings.prepCopiesDelivery'), 'sections', 'prep_delivery'],
                ['consumptionReport', t('settings.organization.printSettings.docConsumptionReport'), 'doc', 'consumptionReport'],
] as [string, string, 'doc' | 'sections', string][]).map(([key, label, mode, docType]) => {
                // التحضير: نسخ لكل قسم — الفواتير والتقارير: قائمة نسخ مسطحة (مستند واحد)
                const flatList = getCopyList(key);

                return (
                  <div key={key} className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{label}</span>
                    </div>

                    {(mode === 'sections') ? (
                    <div className="mt-2 space-y-2">
                    {menuSections.map(section => {
                      const sectionId = String(section._id || section.id);
                      const sectionName = section.name;
                      const sectionCopyKey = docType === 'prep' ? 'sectionCopyPrinterMap'
                        : docType === 'prep_takeaway' ? 'sectionCopyPrinterMapTakeaway'
                        : docType === 'prep_delivery' ? 'sectionCopyPrinterMapDelivery'
                        : docType === 'bill' ? 'sectionCopyPrinterMapBill'
                        : docType === 'bill_takeaway' ? 'sectionCopyPrinterMapBillTakeaway'
                        : docType === 'bill_delivery' ? 'sectionCopyPrinterMapBillDelivery'
                        : docType === 'consumptionReport' ? 'sectionCopyPrinterMapConsumption'
                        : 'sectionCopyPrinterMap';
                      const sectionPrinters = (organization.printSettings as any)?.[sectionCopyKey]?.[sectionId] || [];
                      const globalList = getCopyList(key);
                      const printers = (sectionPrinters.length > 0 ? sectionPrinters : getCopyList(key)).slice(0, 5);

                      return (
                        <div key={sectionId} className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-blue-800 dark:text-blue-200">{sectionName}</span>
                            <span className="text-xs text-blue-600 dark:text-blue-400">{t('settings.organization.printSettings.copiesCount', { count: printers.length })}</span>
                          </div>
                          <div className="space-y-1">
                            {printers.map((pid, i) => (
                              <label key={`${sectionId}-${i}`} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                                <span>{sectionName} - {t('settings.organization.printSettings.copySlot')} {i + 1}</span>
                                {printers.length > 1 ? (
                                  <select value={pid} onChange={(e) => {
                                    const mapKey = docType === 'prep' ? 'sectionCopyPrinterMap'
                                      : docType === 'prep_takeaway' ? 'sectionCopyPrinterMapTakeaway'
                                      : docType === 'prep_delivery' ? 'sectionCopyPrinterMapDelivery'
                                      : docType === 'bill' ? 'sectionCopyPrinterMapBill'
                                      : docType === 'bill_takeaway' ? 'sectionCopyPrinterMapBillTakeaway'
                                      : docType === 'bill_delivery' ? 'sectionCopyPrinterMapBillDelivery'
                                      : docType === 'consumptionReport' ? 'sectionCopyPrinterMapConsumption'
                                      : 'sectionCopyPrinterMap';
                                    const current = (organization.printSettings as any)?.[mapKey]?.[sectionId] || [];
                                    const updated = [...current];
                                    updated[i] = e.target.value;
                                    setMapVal(mapKey, sectionId, updated);
                                  }} className="ml-auto rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5">
                                    <option value="">{t('settings.organization.printSettings.copyFollowSections')}</option>
                                    {(organization.printSettings?.printers || []).map((printer: any) => <option key={printer.id} value={printer.id}>{printer.name}</option>)}
                                  </select>
                                ) : (
                                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{t('settings.organization.printSettings.copyFollowsSection')}</span>
                                )}
                                {printers.length > 1 && (
                                  <button type="button" className="text-xs text-red-600 dark:text-red-400 hover:underline ml-1" onClick={() => {
                                    const mapKey = docType === 'prep' ? 'sectionCopyPrinterMap'
                                      : docType === 'prep_takeaway' ? 'sectionCopyPrinterMapTakeaway'
                                      : docType === 'prep_delivery' ? 'sectionCopyPrinterMapDelivery'
                                      : docType === 'bill' ? 'sectionCopyPrinterMapBill'
                                      : docType === 'bill_takeaway' ? 'sectionCopyPrinterMapBillTakeaway'
                                      : docType === 'bill_delivery' ? 'sectionCopyPrinterMapBillDelivery'
                                      : docType === 'consumptionReport' ? 'sectionCopyPrinterMapConsumption'
                                      : 'sectionCopyPrinterMap';
                                    const current = (organization.printSettings as any)?.[mapKey]?.[sectionId] || [];
                                    const updated = current.filter((_, idx) => idx !== i);
                                    setMapVal(mapKey, sectionId, updated);
                                  }}>
                                    {t('settings.organization.printSettings.removeCopy')}
                                  </button>
                                )}
                              </label>
                            ))}
                            {printers.length < 5 && (
                              <button type="button" className="text-xs text-blue-600 dark:text-blue-400 hover:underline" onClick={() => {
                                const mapKey = docType === 'prep' ? 'sectionCopyPrinterMap'
                                  : docType === 'prep_takeaway' ? 'sectionCopyPrinterMapTakeaway'
                                  : docType === 'prep_delivery' ? 'sectionCopyPrinterMapDelivery'
                                  : docType === 'bill' ? 'sectionCopyPrinterMapBill'
                                  : docType === 'bill_takeaway' ? 'sectionCopyPrinterMapBillTakeaway'
                                  : docType === 'bill_delivery' ? 'sectionCopyPrinterMapBillDelivery'
                                  : docType === 'consumptionReport' ? 'sectionCopyPrinterMapConsumption'
                                  : 'sectionCopyPrinterMap';
                                const current = (organization.printSettings as any)?.[mapKey]?.[sectionId] || [];
                                const updated = [...current, ''];
                                setMapVal(mapKey, sectionId, updated);
                              }}>
                                {t('settings.organization.printSettings.addCopy')}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                     })}
                     </div>
                     ) : (
                     <div className="mt-2 space-y-1.5">
                       {flatList.map((pid, i) => {
                         const docName = docDefaultPrinterName(key);
                         return (
                           <label key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                             <span>{t('settings.organization.printSettings.copySlot')} {i + 1}</span>
                             {flatList.length > 1 ? (
                               <select value={pid} onChange={(e) => setCopyList(key, flatList.map((v, j) => (j === i ? e.target.value : v)))} className="ml-auto rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5">
                                 <option value="">{`${t('settings.organization.printSettings.copyFollowDoc')}${docName ? ` (${docName})` : ''}`}</option>
                                 {(organization.printSettings?.printers || []).map((printer: any) => <option key={printer.id} value={printer.id}>{printer.name}</option>)}
                               </select>
                             ) : (
                               <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{`${t('settings.organization.printSettings.copyFollowDoc')}${docName ? ` (${docName})` : ''}`}</span>
                             )}
                             {flatList.length > 1 && (
                               <button type="button" className="text-xs text-red-600 dark:text-red-400 hover:underline ml-1" onClick={() => setCopyList(key, flatList.filter((_, j) => j !== i))}>
                                 {t('settings.organization.printSettings.removeCopy')}
                               </button>
                             )}
                           </label>
                         );
                       })}
                       {flatList.length < 5 && (
                         <button type="button" className="text-xs text-blue-600 dark:text-blue-400 hover:underline" onClick={() => setCopyCount(key, flatList.length + 1)}>
                           {t('settings.organization.printSettings.addCopy')}
                         </button>
                       )}
                     </div>
                     )}
                   </div>
                 );
               })}
             </div>
               </div>
         </div>
       )}

      {subTab === 'automation' && (
        <div className="space-y-4">
          {/* Ø¹Ø§Ù… Ø¨Ù„Ø§ Ø³ÙŠØ§Ù‚ Ù†ÙˆØ¹ Ø·Ù„Ø¨: Ø§Ø®ØªØµØ§Ø± Ù„ÙˆØ­Ø© Ø§Ù„Ù…ÙØ§ØªÙŠØ­ */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.organization.printSettings.drawerShortcut')}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.drawerShortcutDesc')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={organization.printSettings?.openCashDrawerShortcut ?? true} onChange={(e) => patch({ openCashDrawerShortcut: e.target.checked })} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
            </label>
          </div>

          {autoGroups.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {autoGroups.map((g) => (
            <div key={g.f} className="rounded-xl border border-orange-200 dark:border-gray-700 p-4">
              <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">{g.title}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{g.desc}</p>
              <div className="mt-2">
                <AutoToggle base="openCashDrawer" sfx={g.sfx} titleKey="openCashDrawer" descKey="openCashDrawerDesc" def />
                <AutoToggle base="openCashDrawerOnPayment" sfx={g.sfx} titleKey="openCashDrawerOnPayment" descKey="openCashDrawerOnPaymentDesc" def />
                <AutoToggle base="autoPrintOnPayment" sfx={g.sfx} titleKey="autoPrintOnPayment" descKey="autoPrintOnPaymentDesc" def={false} />
                <AutoToggle base="printMarksPaid" sfx={g.sfx} titleKey="printMarksPaid" descKey="printMarksPaidDesc" def={false} />
                <AutoToggle base="promptOrderPrintSections" sfx={g.sfx} titleKey="promptOrderPrintSections" descKey="promptOrderPrintSectionsDesc" def={false} />
              </div>
              <div className="mt-3">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t('settings.organization.printSettings.defaultOrderPrintSections')}
                  {g.sfx && isAutoInherited('defaultOrderPrintSections', g.sfx) && <FollowBadge />}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.defaultOrderPrintSectionsDesc')}</p>
                <div className="mt-2 grid grid-cols-1 2xl:grid-cols-2 gap-2">
                  {menuSections.map(section => {
                    const sectionId = String(section._id || section.id);
                    const effList = ((getAuto('defaultOrderPrintSections', g.sfx) || []) as string[]).map(String);
                    const selected = effList.includes(sectionId);
                    return (
                      <label key={sectionId} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-2 cursor-pointer">
                        <input type="checkbox" checked={selected} onChange={() => {
                          const next = selected ? effList.filter((id: string) => id !== sectionId) : [...effList, sectionId];
                          setAuto('defaultOrderPrintSections', g.sfx, next);
                        }} />
                        <span className="text-sm text-gray-800 dark:text-gray-200">{section.name}</span>
                      </label>
                    );
                  })}
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                  <input type="checkbox" checked={(getAuto('autoPrintOrderSections', g.sfx) ?? false) === true} onChange={e => setAuto('autoPrintOrderSections', g.sfx, e.target.checked)} />
                  {t('settings.organization.printSettings.autoPrintOrderSections')}
                  {g.sfx && isAutoInherited('autoPrintOrderSections', g.sfx) && <FollowBadge />}
                </label>
              </div>
            </div>
          ))}
          </div>
          )}

          {showPrintBoth !== false && (
            <div className="mt-4 rounded-xl border border-orange-200 dark:border-gray-700 p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('settings.organization.printSettings.doublePrintTitle')}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.doublePrintDesc')}</p>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.organization.printSettings.printBothDelivery')}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.printBothDeliveryDesc')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={organization.printSettings?.printBothDelivery ?? false} onChange={(e) => patch({ printBothDelivery: e.target.checked })} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                </label>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.organization.printSettings.printBothTakeaway')}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.printBothTakeawayDesc')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={organization.printSettings?.printBothTakeaway ?? false} onChange={(e) => patch({ printBothTakeaway: e.target.checked })} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'designer' && (
        <PrintDesigner settings={settings} onPatch={onPatch} logoUrl={logoUrl} orgName={orgName} saveNote={saveNote} />
      )}
    </div>
  );
};

export default PrinterSettingsForm;





