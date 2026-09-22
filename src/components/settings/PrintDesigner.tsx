import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import {
  DocPrintLayout,
  DEFAULT_DOC_LAYOUT,
  resolveDocLayout,
  layoutCss,
  brandHtml,
} from '../../utils/printLayout';
import { buildBillPrintHTML } from '../../utils/printBill';
import { buildOrderPrintHTML } from '../../utils/printOrder';

export type DesignerDoc = 'bill' | 'order' | 'consumption';
export type DesignerFulfillment = 'dine_in' | 'takeaway' | 'delivery';

interface PrintDesignerProps {
  settings: Record<string, any>;
  onPatch: (patch: Record<string, any>) => void;
  logoUrl?: string;
  orgName?: string;
}

export interface PreviewItem {
  name: string;
  price: number;
  qty: number;
}

const PAPER_OPTIONS = [58, 80];
const FONT_OPTIONS = ['Tajawal', 'Cairo', 'Amiri', 'IBM Plex Sans Arabic'];

let cachedLogo: { url?: string; expiresAt: number } | null = null;

const numOrUndef = (raw: string): number | undefined => {
  if (raw === '' || raw === null || raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

const defaultItems = (lang: string): PreviewItem[] => (lang === 'ar'
  ? [
    { name: 'مشكل مشويات', price: 120, qty: 2 },
    { name: 'كولا', price: 25, qty: 3 },
  ]
  : [
    { name: 'Grill mix', price: 120, qty: 2 },
    { name: 'Cola', price: 25, qty: 3 },
  ]);

const ToggleRow: React.FC<{ title: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  title, desc, checked, onChange,
}) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <div>
      <div className="text-xs font-bold text-gray-800 dark:text-gray-100">{title}</div>
      {desc ? <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{desc}</div> : null}
    </div>
    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
    </label>
  </div>
);

const NumRow: React.FC<{ label: string; value: number | undefined; fallback: number; min: number; max: number; suffix?: string; onChange: (v: number | undefined) => void }> = ({
  label, value, fallback, min, max, suffix, onChange,
}) => (
  <label className="flex items-center justify-between gap-2 py-1 text-xs text-gray-700 dark:text-gray-200">
    <span>{label}</span>
    <span className="flex items-center gap-1">
      <input
        type="number" min={min} max={max} step={1}
        value={value ?? ''}
        placeholder={String(value ?? fallback)}
        onChange={(e) => onChange(numOrUndef(e.target.value))}
        className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-xs"
      />
      {suffix ? <span className="text-[11px] text-gray-500">{suffix}</span> : null}
    </span>
  </label>
);

const TextRow: React.FC<{ label: string; value: string; placeholder?: string; onChange: (v: string) => void }> = ({
  label, value, placeholder, onChange,
}) => (
  <label className="flex items-center justify-between gap-2 py-1 text-xs text-gray-700 dark:text-gray-200">
    <span className="flex-shrink-0">{label}</span>
    <input
      type="text" value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-32 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-xs"
    />
  </label>
);

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40 p-3">
    <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-1">{title}</h4>
    {children}
  </div>
);

const sampleText = (lang: string, ar: string, en: string) => (lang === 'ar' ? ar : en);

export interface PreviewData {
  tableNo: string;
  custName: string;
  custPhone: string;
  address: string;
  items: PreviewItem[] | null; // null = الافتراضي حسب اللغة
}

function sampleBill(
  lang: string, layout: DocPrintLayout, orgName: string, logoUrl: string | undefined,
  printFont: string, footerText: string, t: any, data: PreviewData, fulfillment: DesignerFulfillment
): any {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 3600 * 1000);
  const items = (data.items ?? defaultItems(lang)).filter((r) => r.name.trim() !== '');
  const rows = items.length > 0 ? items : defaultItems(lang);
  const itemsTotal = rows.reduce((s, r) => s + r.price * r.qty, 0);
  const sessionCost = fulfillment === 'dine_in' ? 60 : 0;
  const discount = 10;
  const total = itemsTotal + sessionCost - discount;
  const paid = 200;
  return {
    _id: 'preview-bill',
    billNumber: 'BILL-XXXXXX-000001',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    fulfillmentType: fulfillment,
    status: 'open',
    table: fulfillment === 'dine_in' ? { number: data.tableNo || '5' } : undefined,
    customerName: fulfillment === 'dine_in' ? '' : data.custName,
    customerPhone: fulfillment === 'dine_in' ? '' : data.custPhone,
    deliveryInfo: fulfillment === 'delivery'
      ? { customerName: data.custName, phone: data.custPhone, address: data.address, deliveryFee: 20 }
      : undefined,
    discount,
    tax: 0,
    total,
    paid,
    remaining: Math.max(0, total - paid),
    orders: [
      {
        _id: 'preview-order-1',
        orderNumber: 'ORD-XXXXXX-000001',
        fulfillmentType: fulfillment,
        createdAt: now.toISOString(),
        items: rows.map((r, i) => ({
          name: r.name,
          price: r.price,
          quantity: r.qty,
          ...(i === 0 ? { variant: sampleText(lang, 'وسط', 'Medium'), addons: [{ name: sampleText(lang, 'طحينة', 'Tahini'), price: 5, quantity: 2 }] } : {}),
          menuItem: 'm1',
        })),
      },
    ],
    sessions: fulfillment === 'dine_in' ? [
      {
        _id: 'preview-session-1',
        deviceName: sampleText(lang, 'بلايستيشن 1', 'PlayStation 1'),
        deviceNumber: 1,
        startTime: twoHoursAgo.toISOString(),
        endTime: now.toISOString(),
        status: 'completed',
        finalCost: 60,
        totalCost: 60,
      },
    ] : [],
    organization: {
      name: orgName,
      logo: logoUrl,
      phone: '01001234567',
      socialLinks: {},
      printSettings: {
        printFont,
        printQRCode: true,
        customFooterBill: footerText,
        printLayout: { bill: { ...layout } },
      },
    },
  };
}

function sampleOrder(lang: string, data: PreviewData, fulfillment: DesignerFulfillment) {
  const now = new Date();
  const items = (data.items ?? defaultItems(lang)).filter((r) => r.name.trim() !== '');
  const rows = items.length > 0 ? items : defaultItems(lang);
  return {
    order: {
      _id: 'preview-order-1',
      orderNumber: 'ORD-XXXXXX-000001',
      status: 'preparing',
      fulfillmentType: fulfillment,
      table: fulfillment === 'dine_in' ? { _id: 't5', number: data.tableNo || '5' } : undefined,
      customerName: fulfillment === 'dine_in' ? '' : data.custName,
      customerPhone: fulfillment === 'dine_in' ? '' : data.custPhone,
      deliveryAddress: fulfillment === 'delivery' ? data.address : '',
      notes: '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      items: rows.map((r, i) => ({
        name: r.name,
        price: r.price,
        quantity: r.qty,
        ...(i === 0 ? { variant: sampleText(lang, 'وسط', 'Medium'), notes: sampleText(lang, 'بدون بصل', 'No onions') } : {}),
        menuItem: 'm1',
      })),
    } as any,
    menuSections: [
      { _id: 'sec1', name: sampleText(lang, 'المشويات', 'Grill') },
      { _id: 'sec2', name: sampleText(lang, 'المشروبات', 'Drinks') },
    ] as any,
    menuItemsMap: new Map<string, any>([
      ['m1', { category: { section: 'sec1' } }],
      ['m2', { category: { section: 'sec2' } }],
    ]),
  };
}

function sampleConsumptionHtml(
  lang: string, layout: DocPrintLayout, orgName: string, logoUrl: string | undefined,
  t: any, data: PreviewData
): string {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const cat = sampleText(lang, 'المشويات', 'Grill');
  const items = (data.items ?? defaultItems(lang)).filter((r) => r.name.trim() !== '');
  const rows = (items.length > 0 ? items : defaultItems(lang)).map((r) => ({
    name: r.name,
    q: String(r.qty),
    p: String(r.price),
    tot: String(r.price * r.qty),
  }));
  const catTotal = rows.reduce((s, r) => s + Number(r.tot), 0);
  return `<!DOCTYPE html>
<html dir="${dir}" lang="${lang}">
<head><meta charset="UTF-8"><title>${t('consumptionReport.print.title')}</title>
<style>${layoutCss(layout, 'consumption')}
*{font-family:'Tajawal',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box;}
body{margin:0;padding:0;font-size:11px;color:#000;font-weight:600;width:100%;max-width:100%;text-align:center;direction:${dir};}
.header{text-align:center;margin-bottom:8px;font-weight:900;border-bottom:2px dashed #000;padding-bottom:6px;}
.org-name{font-size:1.5em;font-weight:900;margin-bottom:6px;}
.title{font-size:1.2em;font-weight:900;margin-bottom:6px;}
.category-name{font-size:1.3em;font-weight:900;margin-bottom:8px;background:#e0e0e0;padding:8px;border-radius:4px;}
.date-info{margin-bottom:4px;font-weight:900;font-size:1.05em;}
.divider{border-top:2px dashed #000;margin:10px 0;}
.items-table{width:100%;border-collapse:collapse;margin:2px 0;font-size:1.1em;border:2px solid #000;table-layout:fixed;direction:${dir};}
.items-table thead{background:#e0e0e0;font-weight:900;}
.items-table th{padding:1px 0;text-align:center;border:1.5px solid #000;font-size:1.1em;}
.items-table td{padding:1px 0;text-align:center;border:1px solid #000;font-weight:900;}
.category-total{text-align:center;font-size:1.35em;font-weight:900;padding:12px;background:#f0f0f0;border-radius:4px;margin-top:10px;}
.footer{margin-top:10px;text-align:center;font-size:1em;border-top:2px dashed #000;padding-top:10px;font-weight:900;}
.thank-you{text-align:center;margin:12px 0 10px;font-size:1.2em;font-weight:800;}
</style></head>
<body>
<div class="header">
${brandHtml(logoUrl, layout, orgName)}
<div class="title">${t('consumptionReport.print.title')}</div>
${layout.showSectionTitle !== false ? `<div class="category-name">${cat}</div>` : ''}
${layout.showDate !== false ? `<div class="date-info">${t('consumptionReport.print.date')}: 2026/09/22</div>` : ''}
</div>
${layout.showDividers !== false ? `<div class="divider"></div>` : ''}
<table class="items-table"><thead><tr>
<th>${t('consumptionReport.table.itemName')}</th><th>${t('consumptionReport.table.quantity')}</th><th>${t('consumptionReport.table.unitPrice')}</th><th>${t('consumptionReport.table.total')}</th>
</tr></thead><tbody>
${rows.map((r) => `<tr><td class="item-name">${r.name}</td><td class="item-quantity">${r.q}</td><td class="item-price">${r.p}</td><td class="item-total">${r.tot}</td></tr>`).join('')}
</tbody></table>
${layout.showDividers !== false ? `<div class="divider"></div>` : ''}
<div class="category-total">${t('consumptionReport.print.categoryTotal', { category: cat })}: ${catTotal}</div>
${layout.showThanks !== false ? `<div class="thank-you">${t('consumptionReport.print.thankYou')}</div>` : ''}
<div class="dev-sign" style="margin-top:10px;text-align:center;font-size:1em;border-top:2px dashed #000;padding-top:10px;font-weight:900;"><strong>${t('consumptionReport.print.footer')}</strong></div>
</body></html>`;
}

const PrintDesigner: React.FC<PrintDesignerProps> = ({ settings, onPatch, logoUrl, orgName }) => {
  const { t } = useTranslation();
  const [doc, setDoc] = useState<DesignerDoc>('bill');
  const [draft, setDraft] = useState<DocPrintLayout>(() => resolveDocLayout(settings, 'bill'));
  const [dirty, setDirty] = useState(false);
  const [previewLang, setPreviewLang] = useState<'ar' | 'en'>('ar');
  const [fulfillment, setFulfillment] = useState<DesignerFulfillment>('dine_in');
  const [paperWidth, setPaperWidth] = useState<number>(80);
  const [printFont, setPrintFontState] = useState<string>(settings?.printFont || 'Tajawal');
  const [footerText, setFooterTextState] = useState<string>(
    settings?.customFooterBill || settings?.customFooterOrder || settings?.customFooterConsumption || ''
  );
  const [autoCut, setAutoCut] = useState<boolean>(settings?.autoCut ?? false);
  const [charsPerLine, setCharsPerLine] = useState<number>(settings?.charactersPerLine || 48);
  const [printHeader, setPrintHeader] = useState<boolean>(settings?.printHeader ?? true);
  const [printFooter, setPrintFooter] = useState<boolean>(settings?.printFooter ?? true);
  const [printQRCode, setPrintQRCode] = useState<boolean>(settings?.printQRCode ?? true);
  // بيانات المعاينة القابلة للتحرير
  const [tableNo, setTableNo] = useState('5');
  const [custName, setCustName] = useState(sampleText('ar', 'أحمد محمد', 'Ahmed Mohamed'));
  const [custPhone, setCustPhone] = useState('01001234567');
  const [address, setAddress] = useState(sampleText('ar', 'شارع الجمهورية ١٢', '12 Republic St'));
  const [customItems, setCustomItems] = useState<PreviewItem[] | null>(null);
  const [html, setHtml] = useState('');
  const [building, setBuilding] = useState(false);
  const [resolvedLogo, setResolvedLogo] = useState<string | undefined>(logoUrl);
  const buildId = useRef(0);

  const P = (key: string, fallback?: string) => t(`settings.organization.printSettings.${key}` as any, fallback);
  const previewData: PreviewData = useMemo(() => ({
    tableNo, custName, custPhone, address, items: customItems,
  }), [tableNo, custName, custPhone, address, customItems]);

  useEffect(() => {
    setDraft(resolveDocLayout(settings, doc));
    setDirty(false);
  }, [doc]);

  useEffect(() => {
    let alive = true;
    if (!cachedLogo || cachedLogo.expiresAt < Date.now()) {
      if (logoUrl) {
        cachedLogo = { url: logoUrl, expiresAt: Date.now() + 60000 };
        setResolvedLogo(logoUrl);
      } else {
        (async () => {
          try {
            const { api } = await import('../../services/api');
            const r: any = await api.getOrganization().catch(() => null);
            const url = r?.data?.logo as string | undefined;
            cachedLogo = { url, expiresAt: Date.now() + 60000 };
            if (alive) setResolvedLogo(url);
          } catch {}
        })();
      }
    } else {
      setResolvedLogo(logoUrl ?? cachedLogo.url);
    }
    return () => { alive = false; };
  }, [logoUrl]);

  const effOrgName = orgName || sampleText(previewLang, 'مطعم المشويات', 'Grill Restaurant');

  useEffect(() => {
    const id = ++buildId.current;
    setBuilding(true);
    const timer = setTimeout(() => {
      (async () => {
        try {
          const ft = i18next.getFixedT(previewLang);
          let out = '';
          if (doc === 'bill') {
            out = await buildBillPrintHTML(
              sampleBill(previewLang, draft, effOrgName, resolvedLogo, printFont, footerText, ft as any, previewData, fulfillment) as any,
              effOrgName,
              previewLang,
              ft as any
            );
          } else if (doc === 'order') {
            const s = sampleOrder(previewLang, previewData, fulfillment);
            // للتيك أوي/الدليفري: الفاتورة تحمل النوع ويورثه الطلب
            if (fulfillment !== 'dine_in') (s.order as any).fulfillmentType = fulfillment;
            out = await buildOrderPrintHTML(
              s.order, s.menuSections, s.menuItemsMap,
              effOrgName, previewLang, ft as any,
              undefined, undefined,
              { logoUrl: resolvedLogo, layout: draft }
            );
          } else {
            out = sampleConsumptionHtml(previewLang, draft, effOrgName, resolvedLogo, ft as any, previewData);
          }
          if (buildId.current === id) setHtml(out || '');
        } catch (e) {
          console.warn('[designer] preview build failed:', e);
          if (buildId.current === id) setHtml('');
        } finally {
          if (buildId.current === id) setBuilding(false);
        }
      })();
    }, 250);
    return () => clearTimeout(timer);
  }, [doc, draft, previewLang, fulfillment, paperWidth, effOrgName, resolvedLogo, printFont, footerText, previewData]);

  const setL = (patch: Partial<DocPrintLayout>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const markRootDirty = () => setDirty(true);

  const handleSave = () => {
    const footerKey = doc === 'bill' ? 'customFooterBill' : doc === 'order' ? 'customFooterOrder' : 'customFooterConsumption';
    onPatch({
      printLayout: { ...((settings as any)?.printLayout || {}), [doc]: { ...draft } },
      printFont,
      autoCut,
      charactersPerLine: charsPerLine,
      printHeader,
      printFooter,
      printQRCode,
      ...(doc === 'bill' ? { [footerKey]: footerText } : {}),
    });
    setDirty(false);
  };
  const handleReset = () => {
    setDraft({ ...DEFAULT_DOC_LAYOUT });
    setDirty(true);
  };

  const updateItem = (idx: number, patch: Partial<PreviewItem>) => {
    const base = customItems ?? defaultItems(previewLang);
    setCustomItems(base.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const addItem = () => {
    const base = customItems ?? defaultItems(previewLang);
    if (base.length >= 8) return;
    setCustomItems([...base, { name: '', price: 0, qty: 1 }]);
  };
  const removeItem = (idx: number) => {
    const base = customItems ?? defaultItems(previewLang);
    setCustomItems(base.filter((_, i) => i !== idx));
  };

  const pxWidth = Math.round(paperWidth * 3.78);
  const colLabels = useMemo(() => {
    if (doc === 'bill') return [P('designerColName', 'الصنف'), P('designerColQty', 'الكمية'), P('designerColPaid', 'المدفوع'), P('designerColPrice', 'السعر'), P('designerColTotal', 'الإجمالي')];
    if (doc === 'order') return [P('designerColName', 'الصنف'), P('designerColQty', 'الكمية')];
    return [P('designerColName', 'الصنف'), P('designerColQty', 'الكمية'), P('designerColPrice', 'سعر الوحدة'), P('designerColTotal', 'الإجمالي')];
  }, [doc, t]);
  const colKeys: Array<'colA' | 'colB' | 'colC' | 'colD' | 'colE'> = useMemo(() => (
    doc === 'bill' ? ['colA', 'colB', 'colC', 'colE', 'colD'] : doc === 'order' ? ['colA', 'colB'] : ['colA', 'colB', 'colC', 'colD']
  ), [doc]);

  const DocBtn = ({ id, label }: { id: DesignerDoc; label: string }) => (
    <button type="button" onClick={() => setDoc(id)} className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${doc === id ? 'bg-orange-600 text-white border-orange-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}>{label}</button>
  );
  const MiniBtn = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
    <button type="button" onClick={onClick} className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border ${active ? 'bg-orange-600 text-white border-orange-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}>{label}</button>
  );

  const items = customItems ?? defaultItems(previewLang);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{P('designerTitle', 'مصمم شكل الورقة المطبوعة')}</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{P('designerDesc', 'عدّل أي عنصر وشاهد النتيجة فوراً بنفس كود الطباعة — ما تراه هو ما سيُطبع.')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DocBtn id="bill" label={P('designerDocBill', 'الفاتورة')} />
        <DocBtn id="order" label={P('designerDocOrder', 'طلب التحضير')} />
        <DocBtn id="consumption" label={P('designerDocConsumption', 'تقرير الاستهلاك')} />
        <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-600" />
        <MiniBtn active={previewLang === 'ar'} label={P('designerLangAr', 'عربي')} onClick={() => setPreviewLang('ar')} />
        <MiniBtn active={previewLang === 'en'} label={P('designerLangEn', 'English')} onClick={() => setPreviewLang('en')} />
        <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-600" />
        {PAPER_OPTIONS.map((w) => (
          <MiniBtn key={w} active={paperWidth === w} label={`${w} ${P('designerMm', 'مم')}`} onClick={() => setPaperWidth(w)} />
        ))}
        {doc !== 'consumption' && (
          <>
            <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-600" />
            <MiniBtn active={fulfillment === 'dine_in'} label={P('designerFulDineIn', 'طاولات')} onClick={() => setFulfillment('dine_in')} />
            <MiniBtn active={fulfillment === 'takeaway'} label={P('designerFulTakeaway', 'تيك أوي')} onClick={() => setFulfillment('takeaway')} />
            <MiniBtn active={fulfillment === 'delivery'} label={P('designerFulDelivery', 'دليفري')} onClick={() => setFulfillment('delivery')} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3 max-h-[640px] overflow-y-auto pe-1">
          <Group title={P('designerGroupData', 'بيانات المعاينة (تجريبية)')}>
            {doc !== 'consumption' && fulfillment === 'dine_in' && (
              <TextRow label={P('designerTableNo', 'رقم الطاولة')} value={tableNo} onChange={setTableNo} />
            )}
            {doc !== 'consumption' && fulfillment !== 'dine_in' && (
              <>
                <TextRow label={P('designerCustName', 'اسم العميل')} value={custName} onChange={setCustName} />
                <TextRow label={P('designerCustPhone', 'هاتف العميل')} value={custPhone} onChange={setCustPhone} />
                {fulfillment === 'delivery' && (
                  <TextRow label={P('designerAddress', 'العنوان')} value={address} onChange={setAddress} />
                )}
              </>
            )}
            <div className="mt-2">
              <div className="text-xs font-bold text-gray-800 dark:text-gray-100 mb-1">{P('designerItems', 'الأصناف')}</div>
              <div className="space-y-1.5">
                {items.map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input type="text" value={r.name} placeholder={P('designerItemName', 'الصنف')} onChange={(e) => updateItem(i, { name: e.target.value })} className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-xs" />
                    <input type="number" value={r.price} min={0} title={P('designerItemPrice', 'السعر')} onChange={(e) => updateItem(i, { price: Number(e.target.value) || 0 })} className="w-16 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-xs" />
                    <input type="number" value={r.qty} min={1} max={99} title={P('designerItemQty', 'الكمية')} onChange={(e) => updateItem(i, { qty: Math.max(1, Number(e.target.value) || 1) })} className="w-14 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-xs" />
                    <button type="button" onClick={() => removeItem(i)} className="text-xs text-red-600 px-1" title={P('designerDelete', 'حذف')}>✕</button>
                  </div>
                ))}
              </div>
              {items.length < 8 && (
                <button type="button" onClick={addItem} className="mt-1.5 text-[11px] font-bold text-orange-600 hover:text-orange-700">+ {P('designerAddItem', 'إضافة صنف')}</button>
              )}
            </div>
          </Group>

          <Group title={P('designerGroupLogo', 'الشعار')}>
            <ToggleRow title={P('designerLogoShow', 'إظهار الشعار')} checked={draft.logoShow !== false} onChange={(v) => setL({ logoShow: v })} />
            <label className="flex items-center justify-between gap-2 py-1 text-xs text-gray-700 dark:text-gray-200">
              <span>{P('designerLogoPosition', 'موضع الشعار')}</span>
              <select value={draft.logoPosition || 'above'} onChange={(e) => setL({ logoPosition: e.target.value as any, logoShow: true })} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-xs">
                <option value="above">{t('settings.organization.printSettings.logoAbove')}</option>
                <option value="beside">{t('settings.organization.printSettings.logoBeside')}</option>
                <option value="hide">{t('settings.organization.printSettings.logoHide')}</option>
              </select>
            </label>
            <NumRow label={P('designerLogoWidth', 'عرض الشعار (بكسل)')} value={draft.logoWidth} fallback={110} min={40} max={200} onChange={(v) => setL({ logoWidth: v ?? 110 })} />
          </Group>

          <Group title={P('designerGroupFonts', 'الخطوط')}>
            <label className="flex items-center justify-between gap-2 py-1 text-xs text-gray-700 dark:text-gray-200">
              <span>{P('designerPrintFont', 'نوع الخط')}</span>
              <select value={printFont} onChange={(e) => { setPrintFontState(e.target.value); markRootDirty(); }} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-xs">
                {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <NumRow label={P('designerFontOrgName', 'اسم المنشأة')} value={draft.fontOrgName} fallback={19} min={8} max={60} suffix="px" onChange={(v) => setL({ fontOrgName: v })} />
            <NumRow label={P('designerFontBillNumber', 'رقم الفاتورة/الطلب')} value={draft.fontBillNumber} fallback={19} min={8} max={60} suffix="px" onChange={(v) => setL({ fontBillNumber: v })} />
            <NumRow label={P('designerFontDate', 'التاريخ')} value={draft.fontDate} fallback={12} min={8} max={60} suffix="px" onChange={(v) => setL({ fontDate: v })} />
            <NumRow label={P('designerFontUser', 'المستخدم (الكاشير)')} value={draft.fontUser} fallback={12} min={8} max={60} suffix="px" onChange={(v) => setL({ fontUser: v })} />
            {doc !== 'consumption' && (
              <>
                <NumRow label={P('designerFontCustName', 'اسم العميل')} value={draft.fontCustName} fallback={14} min={8} max={60} suffix="px" onChange={(v) => setL({ fontCustName: v })} />
                <NumRow label={P('designerFontCustPhone', 'هاتف العميل')} value={draft.fontCustPhone} fallback={13} min={8} max={60} suffix="px" onChange={(v) => setL({ fontCustPhone: v })} />
              </>
            )}
            {doc !== 'consumption' && (
              <NumRow label={P('designerFontAddress', 'العنوان')} value={draft.fontAddress} fallback={12} min={8} max={60} suffix="px" onChange={(v) => setL({ fontAddress: v })} />
            )}
            {doc === 'bill' && (
              <NumRow label={P('designerFontOrgPhone', 'هاتف المنشأة')} value={draft.fontOrgPhone} fallback={14} min={8} max={60} suffix="px" onChange={(v) => setL({ fontOrgPhone: v })} />
            )}
            <NumRow label={P('designerFontHeader', 'سطور الرأس الأخرى')} value={draft.fontHeader} fallback={12} min={8} max={60} suffix="px" onChange={(v) => setL({ fontHeader: v })} />
            <NumRow label={P('designerFontItems', 'الأصناف')} value={draft.fontItems} fallback={15} min={8} max={60} suffix="px" onChange={(v) => setL({ fontItems: v ?? 15 })} />
            <NumRow label={P('designerFontTableHeader', 'رأس الجدول')} value={draft.fontTableHeader} fallback={13} min={8} max={60} suffix="px" onChange={(v) => setL({ fontTableHeader: v })} />
            <NumRow label={P('designerFontTableBody', 'بيانات الجدول')} value={draft.fontTableBody} fallback={15} min={8} max={60} suffix="px" onChange={(v) => setL({ fontTableBody: v })} />
            <NumRow label={P('designerFontNotes', 'الملاحظات')} value={draft.fontNotes} fallback={11} min={8} max={60} suffix="px" onChange={(v) => setL({ fontNotes: v })} />
            <NumRow label={P('designerFontTotals', 'الإجماليات')} value={draft.fontTotals} fallback={16} min={8} max={60} suffix="px" onChange={(v) => setL({ fontTotals: v ?? 16 })} />
            <NumRow label={P('designerFontFooter', 'التذييل')} value={draft.fontFooter} fallback={12} min={8} max={60} suffix="px" onChange={(v) => setL({ fontFooter: v ?? 12 })} />
          </Group>

          <Group title={P('designerGroupTable', 'الجدول')}>
            {colKeys.map((k, i) => {
              if (doc === 'bill' && k === 'colC' && draft.showPaidCol === false) return null;
              if (doc === 'bill' && k === 'colE' && draft.showPriceCol !== true) return null;
              return (
                <NumRow key={k} label={`${colLabels[i]} (%)`} value={draft[k]} fallback={k === 'colA' ? 50 : 17} min={5} max={90} suffix="%" onChange={(v) => setL({ [k]: v } as any)} />
              );
            })}
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{P('designerColsNote', 'تُطبّع النسب تلقائيًا على 100%')}</p>
            <NumRow label={P('designerTableBorder', 'سمك الحدود (0 = بدون)')} value={draft.tableBorder} fallback={1} min={0} max={4} suffix="px" onChange={(v) => setL({ tableBorder: v })} />
            <NumRow label={P('designerRowPadding', 'تباعد الصفوف')} value={draft.rowPadding} fallback={1} min={0} max={12} suffix="px" onChange={(v) => setL({ rowPadding: v })} />
            <NumRow label={`${P('designerFontColName', 'عمود الصنف')}`} value={draft.fontNameCol} fallback={15} min={8} max={60} suffix="px" onChange={(v) => setL({ fontNameCol: v })} />
            <NumRow label={`${P('designerFontColQty', 'عمود الكمية')}`} value={draft.fontQtyCol} fallback={15} min={8} max={60} suffix="px" onChange={(v) => setL({ fontQtyCol: v })} />
            {doc === 'bill' && draft.showPaidCol !== false && (
              <NumRow label={`${P('designerFontColPaid', 'عمود المدفوع')}`} value={draft.fontPaidCol} fallback={15} min={8} max={60} suffix="px" onChange={(v) => setL({ fontPaidCol: v })} />
            )}
            {(doc === 'bill' ? draft.showPriceCol === true : doc === 'consumption') && (
              <NumRow label={`${P('designerFontColPrice', 'عمود السعر')}`} value={draft.fontPriceCol} fallback={15} min={8} max={60} suffix="px" onChange={(v) => setL({ fontPriceCol: v })} />
            )}
            <NumRow label={`${P('designerFontColTotal', 'عمود الإجمالي')}`} value={draft.fontTotalCol} fallback={16} min={8} max={60} suffix="px" onChange={(v) => setL({ fontTotalCol: v })} />
            <ToggleRow title={P('designerShowSectionTitle', 'عناوين الأقسام')} checked={draft.showSectionTitle !== false} onChange={(v) => setL({ showSectionTitle: v })} />
            {doc !== 'order' && (
              <ToggleRow title={P('designerShowDividers', 'الخطوط الفاصلة')} checked={draft.showDividers !== false} onChange={(v) => setL({ showDividers: v })} />
            )}
            {doc === 'bill' && (
              <>
                <ToggleRow title={P('designerShowPaidCol', 'عمود المدفوع')} checked={draft.showPaidCol !== false} onChange={(v) => setL({ showPaidCol: v })} />
                <ToggleRow title={P('designerShowPriceCol', 'عمود السعر')} checked={draft.showPriceCol === true} onChange={(v) => setL({ showPriceCol: v })} />
                <ToggleRow title={P('designerShowItemDetails', 'تفاصيل الصنف (مقاس/إضافات)')} checked={draft.showItemDetails !== false} onChange={(v) => setL({ showItemDetails: v })} />
                <ToggleRow title={P('designerShowSessions', 'جدول الجلسات')} checked={draft.showSessions !== false} onChange={(v) => setL({ showSessions: v })} />
              </>
            )}
            {doc === 'order' && (
              <>
                <ToggleRow title={P('designerShowSectionTotal', 'إجمالي القسم')} checked={draft.showSectionTotal !== false} onChange={(v) => setL({ showSectionTotal: v })} />
                <ToggleRow title={P('designerShowOrderNotes', 'ملاحظات الطلب')} checked={draft.showOrderNotes !== false} onChange={(v) => setL({ showOrderNotes: v })} />
                <ToggleRow title={P('designerShowItemNotes', 'ملاحظات كل صنف')} checked={draft.showItemNotes !== false} onChange={(v) => setL({ showItemNotes: v })} />
              </>
            )}
          </Group>

          <Group title={P('designerGroupHeader', 'محتوى الرأس')}>
            {doc === 'bill' && (
              <ToggleRow title={P('designerShowBillNumber', 'رقم الفاتورة')} checked={draft.showBillNumber !== false} onChange={(v) => setL({ showBillNumber: v })} />
            )}
            {doc === 'order' && (
              <>
                <ToggleRow title={P('designerShowOrderNumber', 'رقم الطلب')} checked={draft.showOrderNumber !== false} onChange={(v) => setL({ showOrderNumber: v })} />
                <ToggleRow title={P('designerShowFulfillmentBadge', 'شارة النوع (دليفري/تيك أوي)')} checked={draft.showFulfillmentBadge !== false} onChange={(v) => setL({ showFulfillmentBadge: v })} />
              </>
            )}
            <ToggleRow title={P('designerShowDate', 'سطر التاريخ')} checked={draft.showDate !== false} onChange={(v) => setL({ showDate: v })} />
            {doc !== 'consumption' && (
              <ToggleRow title={P('designerShowUser', 'اسم الكاشير')} checked={draft.showUser !== false} onChange={(v) => setL({ showUser: v })} />
            )}
            {doc !== 'consumption' && (
              <>
                <ToggleRow title={P('designerShowTable', 'سطر الطاولة')} checked={draft.showTable !== false} onChange={(v) => setL({ showTable: v })} />
                <ToggleRow title={P('designerShowCustomer', 'سطر العميل')} checked={draft.showCustomer !== false} onChange={(v) => setL({ showCustomer: v })} />
                <ToggleRow title={P('designerShowCustName', 'اسم العميل')} checked={draft.showCustName !== false} onChange={(v) => setL({ showCustName: v })} />
              </>
            )}
            {doc === 'bill' && (
              <ToggleRow title={P('designerShowOrgPhone', 'هاتف المنشأة (أسفل الشكر)')} checked={draft.showOrgPhone !== false} onChange={(v) => setL({ showOrgPhone: v })} />
            )}
            <ToggleRow title={t('settings.organization.printSettings.show_showPhone')} checked={draft.showPhone !== false} onChange={(v) => setL({ showPhone: v })} />
            <ToggleRow title={t('settings.organization.printSettings.show_showAddress')} checked={draft.showAddress !== false} onChange={(v) => setL({ showAddress: v })} />
          </Group>

          {doc === 'bill' && (
            <Group title={P('designerGroupTotals', 'الإجماليات')}>
              <ToggleRow title={P('designerShowTotalsTable', 'جدول الإجماليات')} checked={draft.showTotalsTable !== false} onChange={(v) => setL({ showTotalsTable: v })} />
              <ToggleRow title={P('designerShowZeroRows', 'إظهار الخصم/الضريبة/التوصيل ولو صفر')} checked={draft.showZeroRows === true} onChange={(v) => setL({ showZeroRows: v })} />
            </Group>
          )}

          <Group title={P('designerGroupFooter', 'التذييل')}>
            <ToggleRow title={t('settings.organization.printSettings.show_showThanks')} checked={draft.showThanks !== false} onChange={(v) => setL({ showThanks: v })} />
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{P('designerDevSignNote', 'توقيع المطور أسفل الورقة ثابت دائماً ولا يمكن إخفاؤه.')}</p>
            {doc === 'bill' && (
              <>
                <ToggleRow title={t('settings.organization.printSettings.show_showQR')} checked={draft.showQR !== false} onChange={(v) => setL({ showQR: v })} />
                <NumRow label={P('designerQrSize', 'حجم رمز QR')} value={draft.qrSize} fallback={120} min={50} max={220} suffix="px" onChange={(v) => setL({ qrSize: v })} />
                <label className="block py-1 text-xs text-gray-700 dark:text-gray-200">
                  <span className="block mb-1">{P('designerCustomFooter', 'نص التذييل المخصص (أكثر من سطر)')}</span>
                  <textarea value={footerText} rows={3} onChange={(e) => { setFooterTextState(e.target.value); markRootDirty(); }} placeholder={t('settings.organization.printSettings.customFooterPlaceholder')} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-xs" />
                </label>
              </>
            )}
          </Group>

          <Group title={P('designerGroupPrint', 'خيارات الطباعة')}>
            <ToggleRow title={t('settings.organization.printSettings.autoCut')} desc={t('settings.organization.printSettings.autoCutDesc')} checked={autoCut} onChange={(v) => { setAutoCut(v); markRootDirty(); }} />
            <NumRow label={t('settings.organization.printSettings.charactersPerLine')} value={charsPerLine} fallback={48} min={32} max={64} onChange={(v) => { setCharsPerLine(v ?? 48); markRootDirty(); }} />
            <ToggleRow title={t('settings.organization.printSettings.printHeader')} desc={t('settings.organization.printSettings.printHeaderDesc')} checked={printHeader} onChange={(v) => { setPrintHeader(v); markRootDirty(); }} />
            <ToggleRow title={t('settings.organization.printSettings.printFooter')} desc={t('settings.organization.printSettings.printFooterDesc')} checked={printFooter} onChange={(v) => { setPrintFooter(v); markRootDirty(); }} />
            <ToggleRow title={t('settings.organization.printSettings.printQRCode')} desc={t('settings.organization.printSettings.printQRCodeDesc')} checked={printQRCode} onChange={(v) => { setPrintQRCode(v); markRootDirty(); }} />
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{P('designerRawNote', 'عدد الأحرف والرأس/التذييل هنا تُطبق على مسار الطوارئ النصي.')}</p>
          </Group>

          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSave} disabled={!dirty} className="px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
              {P('designerSave', 'حفظ التصميم')}
            </button>
            <button type="button" onClick={handleReset} className="px-4 py-2 bg-white dark:bg-gray-700 text-xs font-bold rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300">
              {P('designerReset', 'استعادة الافتراضي')}
            </button>
            {dirty
              ? <span className="text-[11px] text-orange-600 font-bold">{P('designerUnsaved', 'تغييرات غير محفوظة')}</span>
              : <span className="text-[11px] text-emerald-600 font-bold">{P('designerSaved', 'محفوظ')}</span>}
          </div>
        </div>

        <div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                {P('designerPreview', 'معاينة')} — {paperWidth} {P('designerMm', 'مم')} — {previewLang === 'ar' ? P('designerLangAr', 'عربي') : P('designerLangEn', 'English')}
                {doc !== 'consumption' && ` — ${fulfillment === 'dine_in' ? P('designerFulDineIn', 'طاولات') : fulfillment === 'takeaway' ? P('designerFulTakeaway', 'تيك أوي') : P('designerFulDelivery', 'دليفري')}`}
              </span>
              {building && <span className="text-[11px] text-gray-500">…</span>}
            </div>
            <div className="mx-auto bg-white shadow overflow-hidden" style={{ width: pxWidth, maxWidth: '100%' }}>
              {html
                ? <iframe title="print-preview" srcDoc={html} style={{ width: pxWidth, maxWidth: '100%', height: 620, border: 0, background: '#fff' }} />
                : <div className="p-6 text-center text-xs text-gray-500">{P('designerBuilding', 'جاري بناء المعاينة...')}</div>}
            </div>
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{P('designerPreviewNote', 'المعاينة ببيانات عينة وبنفس كود الطباعة — الناتج المطبوع مطابق.')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintDesigner;
