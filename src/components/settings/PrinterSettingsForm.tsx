import React from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
}

// Shared printer-settings fields UI (used by organization section and "my printer settings").
// NOTE: the JSX below is a verbatim move from Settings.tsx — the local
// organization/setOrganization adapter keeps every handler working unchanged.
const PrinterSettingsForm: React.FC<PrinterSettingsFormProps> = ({
  settings,
  onPatch,
  menuSections,
  availablePrinters,
  detecting,
  onDetect,
  onSelectDetected,
  onTestPrinter,
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

  return (
                    <div className="space-y-4">
                      {/* Printer Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('settings.organization.printSettings.printerType')}
                        </label>
                        <select
                          value={organization.printSettings?.printerType || 'none'}
                          onChange={(e) =>
                            setOrganization({
                              ...organization,
                              printSettings: {
                                ...organization.printSettings,
                                printerType: e.target.value,
                              },
                            })
                          }
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

                      {/* Printer Device (for USB) */}
                      {organization.printSettings?.printerType === 'usb' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('settings.organization.printSettings.printerDevice')}
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={organization.printSettings?.printerDevice || ''}
                              onChange={(e) =>
                                setOrganization({
                                  ...organization,
                                  printSettings: {
                                    ...organization.printSettings,
                                    printerDevice: e.target.value,
                                  },
                                })
                              }
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
                          
                          {/* قائمة الطابعات المتاحة */}
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
                                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                        {printer.name}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {printer.path} {printer.driver && `(${printer.driver})`}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        testPrinter(printer);
                                      }}
                                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                    >
                                      {t('settings.organization.printSettings.test')}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="mt-4 rounded-xl border border-orange-200 dark:border-gray-600 bg-white/60 dark:bg-gray-800/40 p-4">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">الطابعات المتعددة وتوجيه الطباعة</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">أضف الطابعات المكتشفة ثم اربط كل قسم أو نوع مستند بالطابعة المناسبة.</p>
                            <div className="mt-3 space-y-2">
                              {(organization.printSettings?.printers || []).map(printer => (
                                <div key={printer.id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700 p-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-800 dark:text-gray-100">{printer.name}</span>
                                    <input type="number" min={30} max={150} step={1} value={printer.paperWidthMm || 80} aria-label={`عرض ورق ${printer.name} بالملليمتر`} onChange={e => setOrganization(prev => ({ ...prev, printSettings: { ...prev.printSettings, printers: (prev.printSettings?.printers || []).map(item => item.id === printer.id ? { ...item, paperWidthMm: Number(e.target.value) || 80 } : item) } }))} className="w-20 rounded border border-gray-300 p-1 text-xs" />
                                    <span className="text-xs text-gray-500">مم</span>
                                  </div>
                                  <button type="button" className="text-xs text-red-600" onClick={() => setOrganization(prev => ({ ...prev, printSettings: { ...prev.printSettings, printers: (prev.printSettings?.printers || []).filter(item => item.id !== printer.id) } }))}>إزالة</button>
                                </div>
                              ))}
                              {availablePrinters.map(printer => {
                                const id = String(printer.path || printer.name);
                                const exists = organization.printSettings?.printers?.some(item => item.id === id);
                                return exists ? null : (
                                  <button key={id} type="button" className="w-full rounded-lg border border-dashed border-orange-300 p-2 text-sm text-orange-700 hover:bg-orange-50 text-right" onClick={() => setOrganization(prev => ({ ...prev, printSettings: { ...prev.printSettings, printers: [...(prev.printSettings?.printers || []), { id, name: printer.name, printerName: printer.name, printerPath: printer.path || '', paperWidthMm: 80 }] } }))}>
                                    + إضافة {printer.name}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {[
                                ['bill', 'الفواتير'],
                                ['consumptionReport', 'تقرير الاستهلاك'],
                                ['dailyReport', 'التقرير اليومي'],
                              ].map(([key, label]) => (
                                <label key={key} className="text-xs text-gray-600 dark:text-gray-300">{label}
                                  <select value={organization.printSettings?.documentPrinterMap?.[key] || ''} onChange={e => setOrganization(prev => ({ ...prev, printSettings: { ...prev.printSettings, documentPrinterMap: { ...(prev.printSettings?.documentPrinterMap || {}), [key]: e.target.value } } }))} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2">
                                    <option value="">الطابعة الافتراضية</option>
                                    {(organization.printSettings?.printers || []).map(printer => <option key={printer.id} value={printer.id}>{printer.name}</option>)}
                                  </select>
                                </label>
                              ))}
                            </div>
                            <div className="mt-3 space-y-2">
                              {menuSections.map(section => {
                                const sectionId = String(section._id || section.id);
                                return <label key={sectionId} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">{section.name}
                                  <select value={organization.printSettings?.sectionPrinterMap?.[sectionId] || ''} onChange={e => setOrganization(prev => ({ ...prev, printSettings: { ...prev.printSettings, sectionPrinterMap: { ...(prev.printSettings?.sectionPrinterMap || {}), [sectionId]: e.target.value } } }))} className="ml-auto rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5">
                                    <option value="">الافتراضية</option>
                                    {(organization.printSettings?.printers || []).map(printer => <option key={printer.id} value={printer.id}>{printer.name}</option>)}
                                  </select>
                                </label>;
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Printer IP and Port (for Network) */}
                      {organization.printSettings?.printerType === 'network' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {t('settings.organization.printSettings.printerIP')}
                            </label>
                            <input
                              type="text"
                              value={organization.printSettings?.printerIP || ''}
                              onChange={(e) =>
                                setOrganization({
                                  ...organization,
                                  printSettings: {
                                    ...organization.printSettings,
                                    printerIP: e.target.value,
                                  },
                                })
                              }
                              placeholder="192.168.1.100"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-gray-100"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {t('settings.organization.printSettings.printerIPDesc')}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {t('settings.organization.printSettings.printerPort')}
                            </label>
                            <input
                              type="number"
                              value={organization.printSettings?.printerPort || 9100}
                              onChange={(e) =>
                                setOrganization({
                                  ...organization,
                                  printSettings: {
                                    ...organization.printSettings,
                                    printerPort: parseInt(e.target.value) || 9100,
                                  },
                                })
                              }
                              placeholder="9100"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-gray-100"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {t('settings.organization.printSettings.printerPortDesc')}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Open Cash Drawer */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {t('settings.organization.printSettings.openCashDrawer')}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('settings.organization.printSettings.openCashDrawerDesc')}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={organization.printSettings?.openCashDrawer ?? true}
                            onChange={(e) =>
                              setOrganization({
                                ...organization,
                                printSettings: {
                                  ...organization.printSettings,
                                  openCashDrawer: e.target.checked,
                                },
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                        </label>
                      </div>

                      {/* Open Cash Drawer On Payment */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">اختصار فتح درج الكاشير (F12)</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">تفعيل أو تعطيل فتح درج الكاشير مباشرة باستخدام زر F12</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={organization.printSettings?.openCashDrawerShortcut ?? true}
                            onChange={(e) =>
                              setOrganization({
                                ...organization,
                                printSettings: {
                                  ...organization.printSettings,
                                  openCashDrawerShortcut: e.target.checked,
                                },
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                        </label>
                      </div>

                      {/* Open Cash Drawer On Payment */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {t('settings.organization.printSettings.openCashDrawerOnPayment')}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('settings.organization.printSettings.openCashDrawerOnPaymentDesc')}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={organization.printSettings?.openCashDrawerOnPayment ?? true}
                            onChange={(e) =>
                              setOrganization({
                                ...organization,
                                printSettings: {
                                  ...organization.printSettings,
                                  openCashDrawerOnPayment: e.target.checked,
                                },
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                        </label>
                      </div>

                      <div className="mt-4 rounded-xl border border-orange-200 dark:border-gray-700 p-4">
                        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.organization.printSettings.defaultOrderPrintSections', 'الأقسام الافتراضية لطباعة الطلب')}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.organization.printSettings.defaultOrderPrintSectionsDesc', 'اختر الأقسام التي تكون محددة تلقائيًا عند طباعة الطلب')}</p>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {menuSections.map(section => {
                            const sectionId = String(section._id || section.id);
                            const selected = organization.printSettings?.defaultOrderPrintSections?.includes(sectionId) === true;
                            return (
                              <label key={sectionId} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-2 cursor-pointer">
                                <input type="checkbox" checked={selected} onChange={() => setOrganization(prev => {
                                  const current = prev.printSettings?.defaultOrderPrintSections || [];
                                  const next = selected ? current.filter(id => id !== sectionId) : [...current, sectionId];
                                  return { ...prev, printSettings: { ...prev.printSettings, defaultOrderPrintSections: next } };
                                })} />
                                <span className="text-sm text-gray-800 dark:text-gray-200">{section.name}</span>
                              </label>
                            );
                          })}
                        </div>
                        <label className="mt-4 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                          <input type="checkbox" checked={organization.printSettings?.autoPrintOrderSections ?? false} onChange={e => setOrganization(prev => ({ ...prev, printSettings: { ...prev.printSettings, autoPrintOrderSections: e.target.checked } }))} />
                          {t('settings.organization.printSettings.autoPrintOrderSections', 'الطباعة مباشرة بالأقسام الافتراضية بدون نافذة')}
                        </label>
                      </div>

                      {/* Auto Print On Payment */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {t('settings.organization.printSettings.promptOrderPrintSections')}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('settings.organization.printSettings.promptOrderPrintSectionsDesc')}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={organization.printSettings?.promptOrderPrintSections ?? false}
                            onChange={(e) => setOrganization({
                              ...organization,
                              printSettings: { ...organization.printSettings, promptOrderPrintSections: e.target.checked },
                            })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                        </label>
                      </div>

                      {/* Auto Print On Payment */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {t('settings.organization.printSettings.autoPrintOnPayment')}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('settings.organization.printSettings.autoPrintOnPaymentDesc')}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={organization.printSettings?.autoPrintOnPayment ?? true}
                            onChange={(e) =>
                              setOrganization({
                                ...organization,
                                printSettings: {
                                  ...organization.printSettings,
                                  autoPrintOnPayment: e.target.checked,
                                },
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                        </label>
                      </div>

                      {/* Characters Per Line */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('settings.organization.printSettings.charactersPerLine')}
                        </label>
                        <input
                          type="number"
                          value={organization.printSettings?.charactersPerLine || 48}
                          onChange={(e) =>
                            setOrganization({
                              ...organization,
                              printSettings: {
                                ...organization.printSettings,
                                charactersPerLine: parseInt(e.target.value) || 48,
                              },
                            })
                          }
                          min="32"
                          max="64"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-gray-100"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {t('settings.organization.printSettings.charactersPerLineDesc')}
                        </p>
                      </div>

                      {/* Print Header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {t('settings.organization.printSettings.printHeader')}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('settings.organization.printSettings.printHeaderDesc')}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={organization.printSettings?.printHeader ?? true}
                            onChange={(e) =>
                              setOrganization({
                                ...organization,
                                printSettings: {
                                  ...organization.printSettings,
                                  printHeader: e.target.checked,
                                },
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                        </label>
                      </div>

                      {/* Print Footer */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {t('settings.organization.printSettings.printFooter')}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('settings.organization.printSettings.printFooterDesc')}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={organization.printSettings?.printFooter ?? true}
                            onChange={(e) =>
                              setOrganization({
                                ...organization,
                                printSettings: {
                                  ...organization.printSettings,
                                  printFooter: e.target.checked,
                                },
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                        </label>
                      </div>

                      {/* Auto Cut */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {t('settings.organization.printSettings.autoCut')}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('settings.organization.printSettings.autoCutDesc')}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={organization.printSettings?.autoCut ?? false}
                            onChange={(e) =>
                              setOrganization({
                                ...organization,
                                printSettings: {
                                  ...organization.printSettings,
                                  autoCut: e.target.checked,
                                },
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                        </label>
                      </div>

                      {/* Print QR Code */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {t('settings.organization.printSettings.printQRCode')}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('settings.organization.printSettings.printQRCodeDesc')}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={organization.printSettings?.printQRCode ?? true}
                            onChange={(e) =>
                              setOrganization({
                                ...organization,
                                printSettings: {
                                  ...organization.printSettings,
                                  printQRCode: e.target.checked,
                                },
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                        </label>
                      </div>
                    </div>
  );
};

export default PrinterSettingsForm;
