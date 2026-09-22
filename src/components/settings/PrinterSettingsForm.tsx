import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PrintDesigner from './PrintDesigner';

export interface DetectedPrinter {
  name: string;
  path?: string;
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

  // قراءة آمنة لخرائط التوجيه (كائن عادي من API أو Map من Mongoose مباشرة)
  const getMapVal = (obj: any, key: string): string => {
    if (!obj) return '';
    if (typeof obj.get === 'function') {
      try { const v = obj.get(key); return v === undefined || v === null ? '' : String(v); } catch { return ''; }
    }
    const v = obj[key];
    return v === undefined || v === null ? '' : String(v);
  };
  const setMapVal = (mapKey: string, sectionId: string, value: string) =>
    setOrganization((prev: any) => {
      const cur = (prev.printSettings as any)?.[mapKey];
      const plain = cur && typeof cur === 'object' && typeof cur.get === 'function'
        ? Object.fromEntries(cur.entries())
        : { ...(cur || {}) };
      if (!value) delete plain[sectionId];
      else plain[sectionId] = value;
      return { ...prev, printSettings: { ...prev.printSettings, [mapKey]: plain } };
    });

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
                      <span className="animate-spin">⟳</span>
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
                          <div className="text-xs text-gray-500 dark:text-gray-400">{printer.path} {printer.driver && `(${printer.driver})`}</div>
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

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      {key !== 'dailyReport' && (
                        <label className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">{t('settings.organization.printSettings.copiesLabel')}
                          <input type="number" min={1} max={5} step={1} value={organization.printSettings?.documentCopies?.[key] ?? 1} onChange={e => setOrganization((prev: any) => ({ ...prev, printSettings: { ...prev.printSettings, documentCopies: { ...(prev.printSettings?.documentCopies || {}), [key]: Math.min(5, Math.max(1, Number(e.target.value) || 1)) } } }))} className="w-16 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5" />
                        </label>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {([
                    ['prep', t('settings.organization.printSettings.prepCopiesGeneral'), false],
                    ['prep_takeaway', t('settings.organization.printSettings.prepCopiesTakeaway'), true],
                    ['prep_delivery', t('settings.organization.printSettings.prepCopiesDelivery'), true],
                  ] as [string, string, boolean][]).map(([key, label, follows]) => {
                    const copiesObj = organization.printSettings?.documentCopies;
                    const raw = copiesObj && typeof copiesObj.get === 'function' ? copiesObj.get(key) : copiesObj?.[key];
                    const base = copiesObj && typeof copiesObj.get === 'function' ? copiesObj.get('prep') : copiesObj?.prep;
                    const shown = raw ?? (follows ? base : undefined) ?? 1;
                    const isFollowing = follows && (raw === undefined || raw === null);
                    return (
                      <label key={key} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">{label}
                        {isFollowing && (
                          <span className="rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 text-[10px] font-bold">{t('settings.organization.printSettings.prepFollowsTables')}</span>
                        )}
                        <input type="number" min={1} max={5} step={1} value={shown} onChange={e => setOrganization((prev: any) => ({ ...prev, printSettings: { ...prev.printSettings, documentCopies: { ...(prev.printSettings?.documentCopies || {}), [key]: Math.min(5, Math.max(1, Number(e.target.value) || 1)) } } }))} className="w-16 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5" />
                      </label>
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
            <div className="space-y-3">
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
        </div>
      )}

      {subTab === 'automation' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.organization.printSettings.openCashDrawer')}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.openCashDrawerDesc')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={organization.printSettings?.openCashDrawer ?? true} onChange={(e) => patch({ openCashDrawer: e.target.checked })} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
            </label>
          </div>

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

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.organization.printSettings.openCashDrawerOnPayment')}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.openCashDrawerOnPaymentDesc')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={organization.printSettings?.openCashDrawerOnPayment ?? true} onChange={(e) => patch({ openCashDrawerOnPayment: e.target.checked })} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-orange-200 dark:border-gray-700 p-4">
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.organization.printSettings.defaultOrderPrintSections')}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.defaultOrderPrintSectionsDesc')}</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {menuSections.map(section => {
                const sectionId = String(section._id || section.id);
                const selected = organization.printSettings?.defaultOrderPrintSections?.includes(sectionId) === true;
                return (
                  <label key={sectionId} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-2 cursor-pointer">
                    <input type="checkbox" checked={selected} onChange={() => setOrganization((prev: any) => {
                      const current = prev.printSettings?.defaultOrderPrintSections || [];
                      const next = selected ? current.filter((id: string) => id !== sectionId) : [...current, sectionId];
                      return { ...prev, printSettings: { ...prev.printSettings, defaultOrderPrintSections: next } };
                    })} />
                    <span className="text-sm text-gray-800 dark:text-gray-200">{section.name}</span>
                  </label>
                );
              })}
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
              <input type="checkbox" checked={organization.printSettings?.autoPrintOrderSections ?? false} onChange={e => patch({ autoPrintOrderSections: e.target.checked })} />
              {t('settings.organization.printSettings.autoPrintOrderSections')}
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.organization.printSettings.promptOrderPrintSections')}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.promptOrderPrintSectionsDesc')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={organization.printSettings?.promptOrderPrintSections ?? false} onChange={(e) => patch({ promptOrderPrintSections: e.target.checked })} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.organization.printSettings.autoPrintOnPayment')}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.autoPrintOnPaymentDesc')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={organization.printSettings?.autoPrintOnPayment ?? false} onChange={(e) => patch({ autoPrintOnPayment: e.target.checked })} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.organization.printSettings.printMarksPaid')}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.printMarksPaidDesc')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={organization.printSettings?.printMarksPaid ?? false} onChange={(e) => patch({ printMarksPaid: e.target.checked })} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-orange-200 dark:border-gray-700 p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('settings.organization.printSettings.autoTriggersTitle')}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.autoTriggersDesc')}</p>

            <div className="mt-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.organization.printSettings.autoPrintOnBillCreate')}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.autoPrintOnBillCreateDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={organization.printSettings?.autoPrintOnBillCreate ?? false} onChange={(e) => patch({ autoPrintOnBillCreate: e.target.checked })} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
              </label>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.organization.printSettings.autoPrintOnOrderCreate')}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.autoPrintOnOrderCreateDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={organization.printSettings?.autoPrintOnOrderCreate ?? false} onChange={(e) => patch({ autoPrintOnOrderCreate: e.target.checked })} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
              </label>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.organization.printSettings.autoPrintOnOrderUpdate')}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.autoPrintOnOrderUpdateDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={organization.printSettings?.autoPrintOnOrderUpdate ?? false} onChange={(e) => patch({ autoPrintOnOrderUpdate: e.target.checked })} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
              </label>
            </div>
          </div>
        </div>
      )}

      {subTab === 'designer' && (
        <PrintDesigner settings={settings} onPatch={onPatch} logoUrl={logoUrl} orgName={orgName} />
      )}
    </div>
  );
};

export default PrinterSettingsForm;
