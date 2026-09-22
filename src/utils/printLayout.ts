/**
 * تنسيق الورقة المطبوعة لكل مستند (فاتورة / تحضير / استهلاك) — مع افتراضي + استعادة.
 * يُحفظ في printSettings.printLayout = { bill, order, consumption } على مستوى المنشأة.
 */

export type LogoPosition = 'above' | 'beside' | 'hide';

export interface DocPrintLayout {
  logoShow: boolean;
  logoPosition: LogoPosition;
  logoWidth: number; // px
  fontTitle: number; // px
  fontItems: number; // px
  fontTotals: number; // px
  fontFooter: number; // px
  showPhone: boolean;
  showAddress: boolean;
  showQR: boolean;
  showThanks: boolean;
}

export const DEFAULT_DOC_LAYOUT: DocPrintLayout = {
  logoShow: true,
  logoPosition: 'above',
  logoWidth: 110,
  fontTitle: 19,
  fontItems: 15,
  fontTotals: 16,
  fontFooter: 12,
  showPhone: true,
  showAddress: true,
  showQR: true,
  showThanks: true,
};

export const resolveDocLayout = (
  settings: any,
  doc: 'bill' | 'order' | 'consumption'
): DocPrintLayout => ({
  ...DEFAULT_DOC_LAYOUT,
  ...(settings?.printLayout?.[doc] || {}),
});

export const resolveDocCopies = (
  settings: any,
  key: string,
  fallbackKey?: string,
  def = 1
): number => {
  const raw =
    settings?.documentCopies?.[key] ??
    (fallbackKey ? settings?.documentCopies?.[fallbackKey] : undefined) ??
    def;
  const n = Number(raw) || def;
  return Math.min(5, Math.max(1, n));
};

/** شعار + اسم المنشأة حسب الموضع (بجانب/فوق/إخفاء) — حجم مضبوط لا يكبر */
export const brandHtml = (
  logoUrl: string | undefined | null,
  layout: DocPrintLayout,
  orgName: string
): string => {
  const w = Math.min(200, Math.max(40, Number(layout.logoWidth) || 110));
  const show =
    layout.logoShow !== false &&
    layout.logoPosition !== 'hide' &&
    !!logoUrl;
  if (!show) return `<div class="org-name">${orgName}</div>`;
  const img = `<img src="${logoUrl}" style="width:${w}px;max-width:${w}px;height:auto;" />`;
  if (layout.logoPosition === 'beside') {
    return `<div class="org-brand-row" style="display:flex;align-items:center;justify-content:center;gap:8px;"><div class="org-logo">${img}</div><div class="org-name" style="margin:0;">${orgName}</div></div>`;
  }
  return `<div class="org-logo" style="text-align:center;margin-bottom:4px;">${img}</div><div class="org-name">${orgName}</div>`;
};

/** تجاوز أحجام الخطوط ( style واحد يُحقن في القالب — !important يتغلب على المضمن) */
export const layoutCss = (l: DocPrintLayout): string => `
.org-name,.title,.header h1{font-size:${Number(l.fontTitle) || 19}px !important;}
.items-table,.items-table th,.items-table td,table.items,table.items th,table.items td{font-size:${Number(l.fontItems) || 15}px !important;}
.totals-table,.totals-table th,.totals-table td,.category-total{font-size:${Number(l.fontTotals) || 16}px !important;}
.footer,.thank-you{font-size:${Number(l.fontFooter) || 12}px !important;}`;
