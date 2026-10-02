import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import {
  DocPrintLayout,
  DEFAULT_DOC_LAYOUT,
  resolveDocLayout,
  layoutCss,
  brandHtml,
  printFontImport,
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
  saveNote?: string;
}

export interface PreviewItem {
  name: string;
  price: number;
  qty: number;
}

const PAPER_OPTIONS = [58, 80];
const FONT_OPTIONS = ['Tajawal', 'Cairo', 'Amiri', 'IBM Plex Sans Arabic'];

let cachedOrg: { name?: string; phone?: string; url?: string; expiresAt: number } | null = null;

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

// سطر مدمج: العنوان + سويتش الإظهار + حجم الخط — حتى لا يتكرر العنصر في مجموعتين
const HeaderPairRow: React.FC<{
  title: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
  font: number | undefined;
  fontFallback: number;
  onFont: (v: number | undefined) => void;
  labelChecked?: boolean;
  labelOnToggle?: (v: boolean) => void;
  labelFont?: number | undefined;
  labelFontFallback?: number;
  labelOnFont?: (v: number | undefined) => void;
  labelWord?: string;
  dataWord?: string;
}> = ({ title, checked, onToggle, font, fontFallback, onFont, labelChecked, labelOnToggle, labelFont, labelFontFallback, labelOnFont, labelWord, dataWord }) => {
  if (labelOnToggle === undefined) {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="flex-1 min-w-0 truncate text-xs font-bold text-gray-800 dark:text-gray-100">{title}</span>
        <label className="flex items-center cursor-pointer flex-shrink-0" title={title}>
          <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4 accent-orange-600" />
        </label>
        <input
          type="number" min={8} max={60} step={1}
          value={font ?? ''}
          placeholder={String(font ?? fontFallback)}
          onChange={(e) => onFont(numOrUndef(e.target.value))}
          className="w-14 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1 text-[11px] flex-shrink-0"
        />
        <span className="text-[10px] text-gray-400 flex-shrink-0">px</span>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white/50 dark:bg-gray-800/30 p-2 space-y-1.5">
      <div className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{title}</div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2 py-1 border border-gray-200 dark:border-gray-600">
          <span className="text-xs font-bold text-gray-800 dark:text-gray-100">{labelWord}</span>
          <input type="checkbox" checked={labelChecked} onChange={(e) => labelOnToggle(e.target.checked)} className="h-4 w-4 accent-orange-600 flex-shrink-0" />
          <input
            type="number" min={8} max={60} step={1}
            value={labelFont ?? ''}
            placeholder={String(labelFont ?? labelFontFallback)}
            onChange={(e) => labelOnFont(numOrUndef(e.target.value))}
            className="w-12 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-0.5 text-[11px] flex-shrink-0"
          />
          <span className="text-[10px] text-gray-400 flex-shrink-0">px</span>
        </span>
        <span className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2 py-1 border border-gray-200 dark:border-gray-600">
          <span className="text-xs font-bold text-gray-800 dark:text-gray-100">{dataWord}</span>
          <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4 accent-orange-600 flex-shrink-0" />
          <input
            type="number" min={8} max={60} step={1}
            value={font ?? ''}
            placeholder={String(font ?? fontFallback)}
            onChange={(e) => onFont(numOrUndef(e.target.value))}
            className="w-12 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-0.5 text-[11px] flex-shrink-0"
          />
          <span className="text-[10px] text-gray-400 flex-shrink-0">px</span>
        </span>
      </div>
    </div>
  );
};

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
  printFont: string, footerText: string, t: any, data: PreviewData, fulfillment: DesignerFulfillment,
  orgPhone?: string, printQRCode: boolean = true
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
      phone: orgPhone || '',
      socialLinks: {},
      printSettings: {
        printFont,
        printQRCode,
        customFooterBill: footerText,
        printLayout: { bill: { ...layout } },
      },
    },
  };
}

function sampleOrder(lang: string, data: PreviewData, fulfillment: DesignerFulfillment) {
  const now = new Date();
  const tenMinAgo = new Date(now.getTime() - 10 * 60000);
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
      createdAt: tenMinAgo.toISOString(),
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
  t: any, data: PreviewData, printFont: string = 'Tajawal', customFooterText: string = ''
): string {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const effFont = (layout as any)?.printFont || printFont || 'Tajawal';
  const cat = sampleText(lang, 'المشويات', 'Grill');
  const items = (data.items ?? defaultItems(lang)).filter((r) => r.name.trim() !== '');
  const rows = (items.length > 0 ? items : defaultItems(lang)).map((r) => ({
    name: r.name,
    q: String(r.qty),
    p: String(r.price),
    tot: String(r.price * r.qty),
  }));
  const half = Math.max(1, Math.ceil(rows.length / 2));
  const catA = sampleText(lang, 'فئة أولى', 'First category');
  const catB = sampleText(lang, 'فئة ثانية', 'Second category');
  const rowsA = rows.slice(0, half);
  const rowsB = rows.slice(half);
  const totA = rowsA.reduce((s, r) => s + Number(r.tot), 0);
  const totB = rowsB.reduce((s, r) => s + Number(r.tot), 0);
  const secTot = totA + totB;
  const sampleRows = (list: typeof rows) => list.map((r) => `<tr><td class="item-name">${r.name}</td><td class="item-quantity">${r.q}</td><td class="item-price">${r.p}</td><td class="item-total">${r.tot}</td></tr>`).join('');
  const sampleTable = `<table class="items-table"><thead><tr>
<th class="item-name">${t('consumptionReport.table.itemName')}</th><th class="item-quantity">${t('consumptionReport.table.quantity')}</th><th class="item-price">${t('consumptionReport.table.unitPrice')}</th><th class="item-total">${t('consumptionReport.table.total')}</th>
</tr></thead><tbody>`;
  const sampleTableEnd = `</tbody></table>`;
  return `<!DOCTYPE html>
<html dir="${dir}" lang="${lang}">
<head><meta charset="UTF-8"><title>${t('consumptionReport.print.title')}</title>
<style>${effFont !== 'Tajawal' ? `@import url('https://fonts.googleapis.com/css2?family=${printFontImport(effFont)}&display=swap');` : ''}${layoutCss(layout, 'consumption')}
*{font-family:'${effFont}',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box;}
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
${layout.showSectionTitle !== false ? `<div class="category-name">${catA}</div>` : ''}
${sampleTable}${sampleRows(rowsA)}${sampleTableEnd}
<div class="category-total">${t('consumptionReport.print.categoryTotal', { category: catA })}: ${totA}</div>
${rowsB.length > 0 ? `${layout.showSectionTitle !== false ? `<div class="category-name">${catB}</div>` : ''}
${sampleTable}${sampleRows(rowsB)}${sampleTableEnd}
<div class="category-total">${t('consumptionReport.print.categoryTotal', { category: catB })}: ${totB}</div>` : ''}
${layout.showDividers !== false ? `<div class="divider"></div>` : ''}
<div class="category-total">${t('consumptionReport.print.categoryTotal', { category: cat })}: ${secTot}</div>
${layout.showThanks !== false ? `<div class="thank-you">${customFooterText || t('consumptionReport.print.thankYou')}</div>` : ''}
<div class="dev-sign" style="margin-top:10px;text-align:center;font-size:1em;border-top:2px dashed #000;padding-top:10px;font-weight:900;"><strong>${t('consumptionReport.print.footer')}</strong></div>
</body></html>`;
}

const PrintDesigner: React.FC<PrintDesignerProps> = ({ settings, onPatch, logoUrl, orgName, saveNote }) => {
  const { t } = useTranslation();
  const [doc, setDoc] = useState<DesignerDoc>('bill');
  // مسودة مستقلة لكل مستند + علم تعديل مستقل — التنقل بين التبويبات
  // لا يخلط التصاميم أبداً (كل ورقة مختصة بتصميمها فقط).
  const [drafts, setDrafts] = useState<Record<DesignerDoc, DocPrintLayout>>(() => ({
    bill: resolveDocLayout(settings, 'bill'),
    order: resolveDocLayout(settings, 'order'),
    consumption: resolveDocLayout(settings, 'consumption'),
  }));
  const [dirtyDocs, setDirtyDocs] = useState<Record<DesignerDoc, boolean>>({ bill: false, order: false, consumption: false });
  const touchedDocs = useRef<Record<DesignerDoc, boolean>>({ bill: false, order: false, consumption: false });
  const draft = drafts[doc];
  const dirty = dirtyDocs[doc] === true;
  const [previewLang, setPreviewLang] = useState<'ar' | 'en'>('ar');
  const [fulfillment, setFulfillment] = useState<DesignerFulfillment>('dine_in');
  const [paperWidth, setPaperWidth] = useState<number>(80);
  const widthTouched = useRef(false);
  // نوع الخط لكل مستند على حدة (من المسودة، والعام القديم كاحتياطي للترحيل فقط)
  const effPrintFont = draft.printFont || (settings as any)?.printFont || 'Tajawal';
  const [footers, setFooters] = useState<Record<DesignerDoc, string>>({
    bill: settings?.customFooterBill || '',
    order: settings?.customFooterOrder || '',
    consumption: settings?.customFooterConsumption || '',
  });
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
  const [orgInfo, setOrgInfo] = useState<{ name?: string; phone?: string; url?: string }>({ name: orgName, url: logoUrl });
  const buildId = useRef(0);

  const P = (key: string, fallback?: string) => t(`settings.organization.printSettings.${key}` as any, fallback);
  const lwLabel = P('designerLabelWord', 'العنوان');
  const lwData = P('designerDataWord', 'البيانات');
  const lblShow = (showKey: string, lblKey: string, dataShow: boolean) => (draft as any)[lblKey] === undefined ? dataShow : (draft as any)[lblKey] === true;
  const previewData: PreviewData = useMemo(() => ({
    tableNo, custName, custPhone, address, items: customItems,
  }), [tableNo, custName, custPhone, address, customItems]);

  useEffect(() => {
    // وصول الإعدادات متأخراً (تحميل غير متزامن): حدّث مسودة كل مستند
    // فقط إن لم يحررها المستخدم — حتى لا تضيع تعديلاته ولا تُبنى
    // المعاينة على قيم افتراضية قديمة. كل ورقة مستقلة عن الأخرى.
    setDrafts((prev) => {
      const next = { ...prev };
      (['bill', 'order', 'consumption'] as DesignerDoc[]).forEach((d) => {
        if (!touchedDocs.current[d]) next[d] = resolveDocLayout(settings, d);
      });
      return next;
    });
    const anyTouched = touchedDocs.current.bill || touchedDocs.current.order || touchedDocs.current.consumption;
    if (anyTouched) return;
    setFooters({
      bill: settings?.customFooterBill || '',
      order: settings?.customFooterOrder || '',
      consumption: settings?.customFooterConsumption || '',
    });
    setAutoCut(settings?.autoCut ?? false);
    setCharsPerLine(settings?.charactersPerLine || 48);
    setPrintHeader(settings?.printHeader ?? true);
    setPrintFooter(settings?.printFooter ?? true);
    setPrintQRCode(settings?.printQRCode ?? true);
    if (!widthTouched.current) {
      const w = Number((settings as any)?.printers?.[0]?.paperWidthMm) || 80;
      setPaperWidth(Math.min(150, Math.max(30, w)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify({
    pl: (settings as any)?.printLayout ?? null,
    cfb: (settings as any)?.customFooterBill ?? null,
    cfo: (settings as any)?.customFooterOrder ?? null,
    cfc: (settings as any)?.customFooterConsumption ?? null,
    ac: (settings as any)?.autoCut ?? null,
    ch: (settings as any)?.charactersPerLine ?? null,
    ph: (settings as any)?.printHeader ?? null,
    pf2: (settings as any)?.printFooter ?? null,
    qr: (settings as any)?.printQRCode ?? null,
  }), doc]);

  // props أولاً، والناقص (الاسم/الهاتف الحقيقي) من السيرفر — المعاينة ببيانات المنشأة الفعلية
  useEffect(() => {
    setOrgInfo((p) => ({
      ...p,
      ...(orgName !== undefined ? { name: orgName } : {}),
      ...(logoUrl !== undefined ? { url: logoUrl } : {}),
    }));
  }, [orgName, logoUrl]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (cachedOrg && cachedOrg.expiresAt > Date.now()) {
          if (alive) setOrgInfo((p) => ({ name: p.name ?? cachedOrg!.name, phone: p.phone ?? cachedOrg!.phone, url: p.url ?? cachedOrg!.url }));
          return;
        }
        const { api } = await import('../../services/api');
        const r: any = await api.getOrganization().catch(() => null);
        cachedOrg = { name: r?.data?.name, phone: r?.data?.phone, url: r?.data?.logo, expiresAt: Date.now() + 60000 };
        if (alive) setOrgInfo((p) => ({ name: p.name ?? cachedOrg!.name, phone: p.phone ?? cachedOrg!.phone, url: p.url ?? cachedOrg!.url }));
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  const effOrgName = orgInfo.name || sampleText(previewLang, 'مطعم المشويات', 'Grill Restaurant');
  const previewLogo = orgInfo.url;
  const previewPhone = orgInfo.phone || '01001234567';

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
              sampleBill(previewLang, draft, effOrgName, previewLogo, effPrintFont, footers.bill, ft as any, previewData, fulfillment, previewPhone, printQRCode) as any,
              effOrgName,
              previewLang,
              ft as any
            );
          } else if (doc === 'order') {
            const s = sampleOrder(previewLang, previewData, fulfillment);
            // للتيك أوي/الدليفري: الفاتورة تحمل النوع ويورثه الطلب
            if (fulfillment !== 'dine_in') (s.order as any).fulfillmentType = fulfillment;
            (s.order as any).billNumber = 'BILL-XXXXXX-000001';
            // معاينة واقعية: إجمالي الفاتورة = مجموع أصناف الطلب
            (s.order as any).billTotal = (s.order.items || []).reduce((sum: number, it: any) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
            out = await buildOrderPrintHTML(
              s.order, s.menuSections, s.menuItemsMap,
              effOrgName, previewLang, ft as any,
              sampleText(previewLang, 'القسم الأول', 'Section A'), undefined,
              { logoUrl: previewLogo, layout: draft, printFont: effPrintFont, customFooter: footers.order }
            );
          } else {
            out = sampleConsumptionHtml(previewLang, draft, effOrgName, previewLogo, ft as any, previewData, effPrintFont, footers.consumption);
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
  }, [doc, draft, previewLang, fulfillment, paperWidth, effOrgName, previewLogo, previewPhone, effPrintFont, footers, previewData]);

  const setL = (patch: Partial<DocPrintLayout>) => {
    touchedDocs.current[doc] = true;
    setDirtyDocs((prev) => ({ ...prev, [doc]: true }));
    setDrafts((prev) => ({ ...prev, [doc]: { ...prev[doc], ...patch } }));
  };
  const markRootDirty = () => {
    touchedDocs.current[doc] = true;
    setDirtyDocs((prev) => ({ ...prev, [doc]: true }));
  };

  const handleTestPrint = async () => {
    if (!html) return;
    try {
      const { printThroughLocalBridge } = await import('../../utils/localPrintBridge');
      const { toast } = await import('react-toastify');
      const ok = await printThroughLocalBridge(html, undefined, { copies: 1 });
      if (ok) toast.success(P('designerTestSent', 'تم إرسال التجربة للطباعة'));
      else toast.error(P('designerTestFailed', 'فشلت الطباعة التجريبية'));
    } catch {
      try {
        const { toast } = await import('react-toastify');
        toast.error(P('designerTestFailed', 'فشلت الطباعة التجريبية'));
      } catch {}
    }
  };
  const handleSave = () => {
    const footerKey = doc === 'bill' ? 'customFooterBill' : doc === 'order' ? 'customFooterOrder' : 'customFooterConsumption';
    onPatch({
      printLayout: { ...((settings as any)?.printLayout || {}), [doc]: { ...draft } },
      autoCut,
      charactersPerLine: charsPerLine,
      printHeader,
      printFooter,
      printQRCode,
      [footerKey]: footers[doc],
    });
    setDirtyDocs((prev) => ({ ...prev, [doc]: false }));
  };
  const handleReset = () => {
    touchedDocs.current[doc] = true;
    setDirtyDocs((prev) => ({ ...prev, [doc]: true }));
    setDrafts((prev) => ({ ...prev, [doc]: { ...DEFAULT_DOC_LAYOUT } }));
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
  // بطاقات الأعمدة: كل عمود وكل ما يخصه (عرض/اتجاه/خط/ظهور) معاً
  interface ColCard {
    k: 'colA' | 'colB' | 'colC' | 'colD' | 'colE';
    label: string;
    fontKey: 'fontNameCol' | 'fontQtyCol' | 'fontPaidCol' | 'fontPriceCol' | 'fontTotalCol';
    visKey?: 'showPaidCol' | 'showPriceCol' | 'showTotalCol';
    visDefTrue?: boolean;
  }
  const colCards = useMemo((): ColCard[] => {
    if (doc === 'bill') return [
      { k: 'colA', label: P('designerColName', 'الصنف'), fontKey: 'fontNameCol' },
      { k: 'colB', label: P('designerColQty', 'الكمية'), fontKey: 'fontQtyCol' },
      { k: 'colC', label: P('designerColPaid', 'المدفوع'), fontKey: 'fontPaidCol', visKey: 'showPaidCol', visDefTrue: true },
      { k: 'colE', label: P('designerColPrice', 'السعر'), fontKey: 'fontPriceCol', visKey: 'showPriceCol', visDefTrue: false },
      { k: 'colD', label: P('designerColTotal', 'الإجمالي'), fontKey: 'fontTotalCol' },
    ];
    if (doc === 'order') return [
      { k: 'colA', label: P('designerColName', 'الصنف'), fontKey: 'fontNameCol' },
      { k: 'colB', label: P('designerColQty', 'الكمية'), fontKey: 'fontQtyCol' },
      { k: 'colC', label: P('designerColPrice', 'السعر'), fontKey: 'fontPriceCol', visKey: 'showPriceCol', visDefTrue: false },
      { k: 'colD', label: P('designerColTotal', 'الإجمالي'), fontKey: 'fontTotalCol', visKey: 'showTotalCol', visDefTrue: false },
    ];
    return [
      { k: 'colA', label: P('designerColName', 'الصنف'), fontKey: 'fontNameCol' },
      { k: 'colB', label: P('designerColQty', 'الكمية'), fontKey: 'fontQtyCol' },
      { k: 'colC', label: P('designerColPrice', 'سعر الوحدة'), fontKey: 'fontPriceCol' },
      { k: 'colD', label: P('designerColTotal', 'الإجمالي'), fontKey: 'fontTotalCol' },
    ];
  }, [doc, t]);
  const orientSel = (kind: 'headOrient' | 'bodyOrient', letter: string) => {
    const key = `${kind}${letter}` as keyof DocPrintLayout;
    const val = (draft[key] as string | undefined) ?? 'h';
    return (
      <select
        value={val}
        onChange={(e) => setL({ [key]: e.target.value === 'h' ? undefined : 'v' } as any)}
        className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1 text-[11px]"
      >
        <option value="h">{P('designerOrientH', 'أفقي')}</option>
        <option value="v">{P('designerOrientV', 'رأسي')}</option>
      </select>
    );
  };

  const DocBtn = ({ id, label }: { id: DesignerDoc; label: string }) => (
    <button type="button" onClick={() => setDoc(id)} className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${doc === id ? 'bg-orange-600 text-white border-orange-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}>{label}</button>
  );
  const MiniBtn = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
    <button type="button" onClick={onClick} className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border ${active ? 'bg-orange-600 text-white border-orange-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}>{label}</button>
  );

  const items = customItems ?? defaultItems(previewLang);

  return (
    <div className="space-y-4 text-gray-900 dark:text-gray-100">
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
          <MiniBtn key={w} active={paperWidth === w} label={`${w} ${P('designerMm', 'مم')}`} onClick={() => { widthTouched.current = true; setPaperWidth(w); }} />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
            <label className="flex items-center justify-between gap-2 py-1 text-xs text-gray-700 dark:text-gray-200">
              <span>{P('designerLogoPosition', 'موضع الشعار')}</span>
              <select value={draft.logoPosition || 'above'} onChange={(e) => setL({ logoPosition: e.target.value as any, logoShow: true })} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-xs">
                <option value="above">{t('settings.organization.printSettings.logoAbove')}</option>
                <option value="beside">{t('settings.organization.printSettings.logoBeside')}</option>
                <option value="hide">{t('settings.organization.printSettings.logoHide')}</option>
              </select>
            </label>
            <NumRow label={P('designerLogoWidth', 'عرض الشعار (بكسل)')} value={draft.logoWidth} fallback={110} min={40} max={200} onChange={(v) => setL({ logoWidth: v ?? 110 })} />
            </div>
          </Group>

          <Group title={P('designerGroupFonts', 'الخطوط')}>
            <label className="flex items-center justify-between gap-2 py-1 text-xs text-gray-700 dark:text-gray-200">
              <span>{P('designerPrintFont', 'نوع الخط')}</span>
              <select value={effPrintFont} onChange={(e) => { setL({ printFont: e.target.value }); }} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-xs">
                {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
            <HeaderPairRow title={P('designerShowOrgName', 'اسم المنشأة')} checked={draft.showOrgName !== false} onToggle={(v) => setL({ showOrgName: v })} font={draft.fontOrgName} fontFallback={19} onFont={(v) => setL({ fontOrgName: v })} />
            {doc === 'bill' && (
              <div className="sm:col-span-2">
              <HeaderPairRow title={P('designerShowBillNumber', 'رقم الفاتورة')} checked={draft.showBillNumber !== false} onToggle={(v) => setL({ showBillNumber: v })} font={draft.fontBillNumber} fontFallback={19} onFont={(v) => setL({ fontBillNumber: v })}
                labelChecked={lblShow('showBillNumber', 'showBillNumberLabel', draft.showBillNumber !== false)} labelOnToggle={(v) => setL({ showBillNumberLabel: v })}
                labelFont={draft.fontBillNumberLabel} labelFontFallback={14} labelOnFont={(v) => setL({ fontBillNumberLabel: v })}
                labelWord={lwLabel} dataWord={lwData} />
              </div>
            )}
            {doc === 'order' && (
              <>
                <div className="sm:col-span-2">
                <HeaderPairRow title={P('designerShowOrderNumber', 'رقم الطلب')} checked={draft.showOrderNumber !== false} onToggle={(v) => setL({ showOrderNumber: v })} font={draft.fontBillNumber} fontFallback={19} onFont={(v) => setL({ fontBillNumber: v })}
                  labelChecked={lblShow('showOrderNumber', 'showOrderNumberLabel', draft.showOrderNumber !== false)} labelOnToggle={(v) => setL({ showOrderNumberLabel: v })}
                  labelFont={draft.fontOrderNumberLabel} labelFontFallback={14} labelOnFont={(v) => setL({ fontOrderNumberLabel: v })}
                  labelWord={lwLabel} dataWord={lwData} />
                </div>
                <div className="sm:col-span-2">
                <HeaderPairRow title={P('designerShowRelatedBill', 'رقم الفاتورة المرتبط')} checked={draft.showRelatedBill !== false} onToggle={(v) => setL({ showRelatedBill: v })} font={draft.fontRelatedBill} fontFallback={16} onFont={(v) => setL({ fontRelatedBill: v })}
                  labelChecked={lblShow('showRelatedBill', 'showRelatedBillLabel', draft.showRelatedBill !== false)} labelOnToggle={(v) => setL({ showRelatedBillLabel: v })}
                  labelFont={draft.fontRelatedBillLabel} labelFontFallback={14} labelOnFont={(v) => setL({ fontRelatedBillLabel: v })}
                  labelWord={lwLabel} dataWord={lwData} />
                </div>
              </>
            )}
            {(doc === 'bill' || doc === 'order') && (
              <div className="sm:col-span-2">
              <HeaderPairRow title={P('designerShowFulfillmentBadge', 'شارة النوع (دليفري/تيك أوي)')} checked={draft.showFulfillmentBadge !== false} onToggle={(v) => setL({ showFulfillmentBadge: v })} font={draft.fontFulfillmentBadge} fontFallback={20} onFont={(v) => setL({ fontFulfillmentBadge: v })}
                labelChecked={lblShow('showFulfillmentBadge', 'showFulfillmentBadgeLabel', draft.showFulfillmentBadge !== false)} labelOnToggle={(v) => setL({ showFulfillmentBadgeLabel: v })}
                labelFont={draft.fontFulfillmentBadgeLabel} labelFontFallback={15} labelOnFont={(v) => setL({ fontFulfillmentBadgeLabel: v })}
                labelWord={lwLabel} dataWord={lwData} />
              </div>
            )}
            <div className="sm:col-span-2">
            <HeaderPairRow title={P('designerShowDate', 'سطر التاريخ')} checked={draft.showDate !== false} onToggle={(v) => setL({ showDate: v })} font={draft.fontDate} fontFallback={12} onFont={(v) => setL({ fontDate: v })}
              labelChecked={lblShow('showDate', 'showDateLabel', draft.showDate !== false)} labelOnToggle={(v) => setL({ showDateLabel: v })}
              labelFont={draft.fontDateLabel} labelFontFallback={12} labelOnFont={(v) => setL({ fontDateLabel: v })}
              labelWord={lwLabel} dataWord={lwData} />
            </div>
            {doc !== 'consumption' && (
              <div className="sm:col-span-2">
              <HeaderPairRow title={P('designerShowTime', 'الوقت')} checked={draft.showTime !== false} onToggle={(v) => setL({ showTime: v })} font={draft.fontTime} fontFallback={12} onFont={(v) => setL({ fontTime: v })}
                labelChecked={lblShow('showTime', 'showTimeLabel', draft.showTime !== false)} labelOnToggle={(v) => setL({ showTimeLabel: v })}
                labelFont={draft.fontTimeLabel} labelFontFallback={12} labelOnFont={(v) => setL({ fontTimeLabel: v })}
                labelWord={lwLabel} dataWord={lwData} />
              </div>
            )}
            {doc !== 'consumption' && (
              <div className="sm:col-span-2">
              <HeaderPairRow title={P('designerShowUser', 'اسم الكاشير')} checked={draft.showUser !== false} onToggle={(v) => setL({ showUser: v })} font={draft.fontUser} fontFallback={12} onFont={(v) => setL({ fontUser: v })}
                labelChecked={lblShow('showUser', 'showUserLabel', draft.showUser !== false)} labelOnToggle={(v) => setL({ showUserLabel: v })}
                labelFont={draft.fontUserLabel} labelFontFallback={12} labelOnFont={(v) => setL({ fontUserLabel: v })}
                labelWord={lwLabel} dataWord={lwData} />
              </div>
            )}
            {doc !== 'consumption' && (
              <>
                <ToggleRow title={P('designerShowTable', 'سطر الطاولة')} checked={draft.showTable !== false} onChange={(v) => setL({ showTable: v })} />
                <ToggleRow title={P('designerShowCustomer', 'سطر العميل')} checked={draft.showCustomer !== false} onChange={(v) => setL({ showCustomer: v })} />
                <div className="sm:col-span-2">
                <HeaderPairRow title={P('designerShowCustName', 'اسم العميل')} checked={draft.showCustName !== false} onToggle={(v) => setL({ showCustName: v })} font={draft.fontCustName} fontFallback={14} onFont={(v) => setL({ fontCustName: v })}
                  labelChecked={lblShow('showCustName', 'showCustNameLabel', draft.showCustName !== false)} labelOnToggle={(v) => setL({ showCustNameLabel: v })}
                  labelFont={draft.fontCustNameLabel} labelFontFallback={13} labelOnFont={(v) => setL({ fontCustNameLabel: v })}
                  labelWord={lwLabel} dataWord={lwData} />
                </div>
                <div className="sm:col-span-2">
                <HeaderPairRow title={P('designerShowPhone', 'هاتف العميل')} checked={draft.showPhone !== false} onToggle={(v) => setL({ showPhone: v })} font={draft.fontCustPhone} fontFallback={13} onFont={(v) => setL({ fontCustPhone: v })}
                  labelChecked={lblShow('showPhone', 'showPhoneLabel', draft.showPhone !== false)} labelOnToggle={(v) => setL({ showPhoneLabel: v })}
                  labelFont={draft.fontPhoneLabel} labelFontFallback={13} labelOnFont={(v) => setL({ fontPhoneLabel: v })}
                  labelWord={lwLabel} dataWord={lwData} />
                </div>
              </>
            )}
            {doc === 'bill' && (
              <div className="sm:col-span-2">
              <HeaderPairRow title={t('settings.organization.printSettings.show_showAddress')} checked={draft.showAddress !== false} onToggle={(v) => setL({ showAddress: v })} font={draft.fontAddress} fontFallback={12} onFont={(v) => setL({ fontAddress: v })}
                labelChecked={lblShow('showAddress', 'showAddressLabel', draft.showAddress !== false)} labelOnToggle={(v) => setL({ showAddressLabel: v })}
                labelFont={draft.fontAddressLabel} labelFontFallback={12} labelOnFont={(v) => setL({ fontAddressLabel: v })}
                labelWord={lwLabel} dataWord={lwData} />
              </div>
            )}
            {doc === 'bill' && (
              <div className="sm:col-span-2">
              <HeaderPairRow title={P('designerShowOrgPhone', 'هاتف المنشأة')} checked={draft.showOrgPhone !== false} onToggle={(v) => setL({ showOrgPhone: v })} font={draft.fontOrgPhone} fontFallback={14} onFont={(v) => setL({ fontOrgPhone: v })} />
              </div>
            )}
            <NumRow label={P('designerFontHeader', 'سطور الرأس الأخرى')} value={draft.fontHeader} fallback={12} min={8} max={60} suffix="px" onChange={(v) => setL({ fontHeader: v })} />
            <NumRow label={P('designerFontItems', 'الأصناف')} value={draft.fontItems} fallback={15} min={8} max={60} suffix="px" onChange={(v) => setL({ fontItems: v ?? 15 })} />
            <NumRow label={P('designerFontTableHeader', 'رأس الجدول')} value={draft.fontTableHeader} fallback={13} min={8} max={60} suffix="px" onChange={(v) => setL({ fontTableHeader: v })} />
            <NumRow label={P('designerFontTableBody', 'بيانات الجدول')} value={draft.fontTableBody} fallback={15} min={8} max={60} suffix="px" onChange={(v) => setL({ fontTableBody: v })} />
            {doc === 'order' && (
              <NumRow label={P('designerFontNotes', 'الملاحظات')} value={draft.fontNotes} fallback={11} min={8} max={60} suffix="px" onChange={(v) => setL({ fontNotes: v })} />
            )}
            {doc !== 'order' && (
              <NumRow label={P('designerFontTotals', 'الإجماليات')} value={draft.fontTotals} fallback={16} min={8} max={60} suffix="px" onChange={(v) => setL({ fontTotals: v ?? 16 })} />
            )}
            <NumRow label={P('designerFontFooter', 'التذييل')} value={draft.fontFooter} fallback={12} min={8} max={60} suffix="px" onChange={(v) => setL({ fontFooter: v ?? 12 })} />
            </div>
          </Group>

          <Group title={P('designerGroupTable', 'الجدول')}>
            {colCards.map((col) => {
              const letter = col.k.replace('col', '');
              const visible = !col.visKey || (col.visDefTrue ? draft[col.visKey] !== false : draft[col.visKey] === true);
              return (
                <div key={col.k} className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-100">{col.label}</span>
                    {col.visKey && (
                      <label className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 cursor-pointer">
                        <input type="checkbox" checked={visible} onChange={(e) => setL({ [col.visKey as string]: e.target.checked } as any)} className="h-3.5 w-3.5 accent-orange-600" />
                        {P('designerShow', 'إظهار')}
                      </label>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300 flex-wrap">
                    <span>{P('designerCardWidth', 'العرض')}</span>
                    <span className="flex items-center gap-1">
                      <input type="number" min={5} max={90} step={1} value={draft[col.k] ?? ''} placeholder={col.k === 'colA' ? '50' : '17'} onChange={(e) => setL({ [col.k]: numOrUndef(e.target.value) } as any)} className="w-14 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1 text-[11px]" />
                      <span className="text-gray-400">%</span>
                    </span>
                    <span className="text-gray-400">{P('designerOrientHead', 'الرأس')}</span>
                    {orientSel('headOrient', letter)}
                    <span className="text-gray-400">{P('designerOrientBody', 'القيم')}</span>
                    {orientSel('bodyOrient', letter)}
                    <input type="number" min={8} max={60} step={1} value={draft[col.fontKey] ?? ''} placeholder="15" title={P('designerFontColHint', 'حجم خط قيم العمود')} onChange={(e) => setL({ [col.fontKey]: numOrUndef(e.target.value) } as any)} className="w-14 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1 text-[11px]" />
                    <span className="text-gray-400">px</span>
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{P('designerColsNote', 'تُطبّع النسب تلقائيًا على 100% — وحجم عمود القيم يغلب حجم البيانات العام عند الضبط.')}</p>
            <NumRow label={P('designerTableBorder', 'سمك الحدود (0 = بدون)')} value={draft.tableBorder} fallback={1} min={0} max={4} suffix="px" onChange={(v) => setL({ tableBorder: v })} />
            <NumRow label={P('designerRowPadding', 'تباعد الصفوف')} value={draft.rowPadding} fallback={1} min={0} max={12} suffix="px" onChange={(v) => setL({ rowPadding: v })} />
            <ToggleRow title={P('designerShowSectionTitle', 'عناوين الأقسام')} checked={draft.showSectionTitle !== false} onChange={(v) => setL({ showSectionTitle: v })} />
            {doc !== 'order' && (
              <ToggleRow title={P('designerShowDividers', 'الخطوط الفاصلة')} checked={draft.showDividers !== false} onChange={(v) => setL({ showDividers: v })} />
            )}
            {doc === 'bill' && (
              <>
                <ToggleRow title={P('designerShowItemDetails', 'تفاصيل الصنف (مقاس/إضافات)')} checked={draft.showItemDetails !== false} onChange={(v) => setL({ showItemDetails: v })} />
                <ToggleRow title={P('designerShowSessions', 'جدول الجلسات')} checked={draft.showSessions !== false} onChange={(v) => setL({ showSessions: v })} />
              </>
            )}
            {doc === 'order' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                  <ToggleRow title={P('designerShowSectionTotal', 'إجمالي القسم')} checked={draft.showSectionTotal !== false} onChange={(v) => setL({ showSectionTotal: v })} />
                  <ToggleRow title={P('designerShowBillTotal', 'إجمالي الفاتورة')} checked={draft.showBillTotal !== false} onChange={(v) => setL({ showBillTotal: v })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                  <NumRow label={P('designerFontSectionTotal', 'حجم خط إجمالي القسم')} value={draft.fontSectionTotal} fallback={16} min={8} max={60} suffix="px" onChange={(v) => setL({ fontSectionTotal: v })} />
                  <NumRow label={P('designerFontBillTotal', 'حجم خط إجمالي الفاتورة')} value={draft.fontBillTotal} fallback={18} min={8} max={60} suffix="px" onChange={(v) => setL({ fontBillTotal: v })} />
                </div>
                <ToggleRow title={P('designerShowOrderNotes', 'ملاحظات الطلب')} checked={draft.showOrderNotes !== false} onChange={(v) => setL({ showOrderNotes: v })} />
                <ToggleRow title={P('designerShowItemNotes', 'ملاحظات كل صنف')} checked={draft.showItemNotes !== false} onChange={(v) => setL({ showItemNotes: v })} />
                <ToggleRow title={P('designerShowUpdateBanner', 'بانر "طلب مُحدّث"')} checked={draft.showUpdateBanner !== false} onChange={(v) => setL({ showUpdateBanner: v })} />
              </>
            )}
          </Group>

          {doc === 'bill' && (
            <Group title={P('designerGroupTotals', 'الإجماليات')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
              <ToggleRow title={P('designerShowTotalsTable', 'جدول الإجماليات')} checked={draft.showTotalsTable !== false} onChange={(v) => setL({ showTotalsTable: v })} />
              <ToggleRow title={P('designerShowZeroRows', 'إظهار الخصم/الضريبة/التوصيل ولو صفر')} checked={draft.showZeroRows === true} onChange={(v) => setL({ showZeroRows: v })} />
              <ToggleRow title={P('designerHidePaidWhenZero', 'إخفاء المدفوع عند الصفر')} checked={draft.hidePaidWhenZero === true} onChange={(v) => setL({ hidePaidWhenZero: v })} />
              <ToggleRow title={P('designerHideRemainingWhenZero', 'إخفاء المتبقي عند الصفر')} checked={draft.hideRemainingWhenZero === true} onChange={(v) => setL({ hideRemainingWhenZero: v })} />
              <ToggleRow title={P('designerHideBothWhenEitherZero', 'إخفاء الاثنين معاً عند تصفير أحدهما')} checked={draft.hideBothWhenEitherZero === true} onChange={(v) => setL({ hideBothWhenEitherZero: v })} />
              </div>
            </Group>
          )}

          <Group title={P('designerGroupFooter', 'التذييل')}>
            <ToggleRow title={t('settings.organization.printSettings.show_showThanks')} checked={draft.showThanks !== false} onChange={(v) => setL({ showThanks: v })} />
            <label className="block py-1 text-xs text-gray-700 dark:text-gray-200">
              <span className="block mb-1">{P('designerCustomFooter', 'نص التذييل المخصص (أكثر من سطر)')}</span>
              <textarea value={footers[doc]} rows={3} onChange={(e) => { setFooters((f) => ({ ...f, [doc]: e.target.value })); markRootDirty(); }} placeholder={t('settings.organization.printSettings.customFooterPlaceholder')} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-xs" />
            </label>
            {doc === 'bill' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                <ToggleRow title={t('settings.organization.printSettings.show_showQR')} checked={draft.showQR !== false} onChange={(v) => setL({ showQR: v })} />
                <NumRow label={P('designerQrSize', 'حجم رمز QR')} value={draft.qrSize} fallback={120} min={80} max={220} suffix="px" onChange={(v) => setL({ qrSize: v })} />
                <label className="flex items-center justify-between gap-2 py-1 text-xs text-gray-700 dark:text-gray-200">
                  <span>{P('designerQrTextPosition', 'موضع وصف QR')}</span>
                  <select value={draft.qrTextPosition || 'beside'} onChange={(e) => setL({ qrTextPosition: e.target.value as any })} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-xs">
                    <option value="beside">{P('designerQrTextBeside', 'بجانب الرمز')}</option>
                    <option value="below">{P('designerQrTextBelow', 'أسفل الرمز')}</option>
                  </select>
                </label>
                <NumRow label={P('designerFontQrText', 'حجم خط وصف QR')} value={draft.fontQrText} fallback={13} min={8} max={60} suffix="px" onChange={(v) => setL({ fontQrText: v })} />
                <label className="flex items-center justify-between gap-2 py-1 text-xs text-gray-700 dark:text-gray-200">
                  <span>{P('designerQrTextDirection', 'اتجاه سطور الوصف')}</span>
                  <select value={draft.qrTextDirection || 'horizontal'} onChange={(e) => setL({ qrTextDirection: e.target.value as any })} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-xs">
                    <option value="horizontal">{P('designerQrDirHorizontal', 'أفقي (فوق بعض)')}</option>
                    <option value="vertical">{P('designerQrDirVertical', 'رأسي (بالطول)')}</option>
                  </select>
                </label>
              </div>
            )}
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{P('designerDevSignNote', 'توقيع المطور أسفل الورقة ثابت دائماً ولا يمكن إخفاؤه.')}</p>
          </Group>

          <Group title={P('designerGroupPrint', 'خيارات الطباعة')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
            <ToggleRow title={t('settings.organization.printSettings.autoCut')} desc={t('settings.organization.printSettings.autoCutDesc')} checked={autoCut} onChange={(v) => { setAutoCut(v); markRootDirty(); }} />
            <NumRow label={t('settings.organization.printSettings.charactersPerLine')} value={charsPerLine} fallback={48} min={32} max={64} onChange={(v) => { setCharsPerLine(v ?? 48); markRootDirty(); }} />
            <ToggleRow title={t('settings.organization.printSettings.printHeader')} desc={t('settings.organization.printSettings.printHeaderDesc')} checked={printHeader} onChange={(v) => { setPrintHeader(v); markRootDirty(); }} />
            <ToggleRow title={t('settings.organization.printSettings.printFooter')} desc={t('settings.organization.printSettings.printFooterDesc')} checked={printFooter} onChange={(v) => { setPrintFooter(v); markRootDirty(); }} />
            <ToggleRow title={t('settings.organization.printSettings.printQRCode')} desc={t('settings.organization.printSettings.printQRCodeDesc')} checked={printQRCode} onChange={(v) => { setPrintQRCode(v); markRootDirty(); }} />
            </div>
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
          {saveNote ? <p className="text-[11px] text-gray-500 dark:text-gray-400">{saveNote}</p> : null}
        </div>

        <div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                {P('designerPreview', 'معاينة')} — {paperWidth} {P('designerMm', 'مم')} — {previewLang === 'ar' ? P('designerLangAr', 'عربي') : P('designerLangEn', 'English')}
                {doc !== 'consumption' && ` — ${fulfillment === 'dine_in' ? P('designerFulDineIn', 'طاولات') : fulfillment === 'takeaway' ? P('designerFulTakeaway', 'تيك أوي') : P('designerFulDelivery', 'دليفري')}`}
              </span>
              {building && <span className="text-[11px] text-gray-500">…</span>}
              <button type="button" onClick={handleTestPrint} disabled={!html} className="px-2.5 py-1 text-[11px] font-bold rounded-lg border bg-emerald-600 text-white border-emerald-600 disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed">
                {P('designerTestPrint', 'طباعة تجريبية')}
              </button>
            </div>
            <div className="mx-auto bg-white shadow overflow-hidden" style={{ width: pxWidth, maxWidth: '100%' }}>
              {/* نفس تحجيم وإزاحة وكيل الطباعة (scale 0.93 و left -3mm) — المعاينة بحجم الطباعة الفعلي */}
              {html
                ? <iframe title="print-preview" srcDoc={html} style={{ width: pxWidth, maxWidth: '100%', height: 620, border: 0, background: '#fff', transform: 'scale(0.93)', transformOrigin: 'top center', position: 'relative', left: '-11px' }} />
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
