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
  // —— تحكم موسع (مصمم الطباعة): كلها اختيارية — الغائب = الشكل الحالي بدون تغيير
  fontTableHeader?: number; // px — خط رأس الجدول وعناوين الأقسام
  fontTableBody?: number; // px — خط بيانات الجدول (الصفوف) منفصلاً عن الرأس
  fontNameCol?: number; // px — عمود الصنف منفصلاً
  fontQtyCol?: number; // px — عمود الكمية منفصلاً
  fontPaidCol?: number; // px — عمود المدفوع منفصلاً (الفاتورة)
  fontPriceCol?: number; // px — عمود السعر منفصلاً
  fontTotalCol?: number; // px — عمود الإجمالي منفصلاً
  fontNotes?: number; // px — خط الملاحظات (ملاحظات الطلب وملاحظات كل صنف)
  fontHeader?: number; // px — سطور معلومات الرأس (التاريخ/الطاولة/العميل)
  fontOrgName?: number; // px — اسم المنشأة منفصلاً عن رقم الفاتورة
  fontBillNumber?: number;
  fontFulfillmentBadge?: number;
  fontDate?: number; // px — سطر التاريخ منفصلاً
  fontTime?: number; // px — سطر الوقت منفصلاً
  fontUser?: number; // px — اسم المستخدم (الكاشير) منفصلاً
  fontCustName?: number; // px — حجم اسم العميل منفصلاً
  fontCustPhone?: number; // px — حجم هاتف العميل منفصلاً
  fontAddress?: number; // px — حجم سطر العنوان (الدليفري)
  fontOrgPhone?: number; // px — حجم سطر هاتف المنشأة (أسفل الشكر)
  colA?: number; // % — العمود الأول (الصنف)
  colB?: number; // % — العمود الثاني (الكمية)
  colC?: number; // % — العمود الثالث (المدفوع)
  colD?: number; // % — العمود الرابع (الإجمالي)
  colE?: number; // % — عمود السعر (سعر الصنف)
  // اتجاه النص: 'h' أفقي (الافتراضي) / 'v' رأسي — الرأسي = الكلمة مائلة 90° وحروفها
  // متصلة (text-orientation:mixed) — مناسب للعربية، وليس رصّ الحروف عمودياً
  headOrientA?: 'h' | 'v'; headOrientB?: 'h' | 'v'; headOrientC?: 'h' | 'v';
  headOrientD?: 'h' | 'v'; headOrientE?: 'h' | 'v';
  bodyOrientA?: 'h' | 'v'; bodyOrientB?: 'h' | 'v'; bodyOrientC?: 'h' | 'v';
  bodyOrientD?: 'h' | 'v'; bodyOrientE?: 'h' | 'v';
  tableBorder?: number; // px — سمك حدود الجدول (0 = بدون حدود)
  rowPadding?: number; // px — تباعد صفوف الجدول عمودياً
  showPaidCol?: boolean; // الفاتورة: إظهار عمود المدفوع
  showPriceCol?: boolean; // الفاتورة والتحضير: إظهار عمود السعر
  showTotalCol?: boolean; // التحضير: إظهار عمود إجمالي الصنف
  showDate?: boolean; // إظهار سطر التاريخ
  showTime?: boolean; // إظهار سطر الوقت — منفصل عن التاريخ
  showUser?: boolean; // إظهار اسم المستخدم (الكاشير) — منفصل عن التاريخ
  showCustName?: boolean; // إظهار اسم العميل — منفصل عن الهاتف
  showTable?: boolean; // إظهار سطر الطاولة
  showCustomer?: boolean;
  showOrgName?: boolean; // إظهار سطر العميل
  showOrgPhone?: boolean; // إظهار هاتف المنشأة في الرأس
  showSessions?: boolean; // الفاتورة: إظهار جدول الجلسات
  showSectionTitle?: boolean; // إظهار عناوين الأقسام (الطلبات/الجلسات/اسم القسم)
  showTotalsTable?: boolean; // الفاتورة: إظهار جدول الإجماليات
  showOrderNotes?: boolean; // التحضير: إظهار ملاحظات الطلب
  showUpdateBanner?: boolean; // التحضير: إظهار بانر "طلب مُحدّث"
  showDividers?: boolean; // إظهار الخطوط الفاصلة المتقطعة
  showItemNotes?: boolean; // التحضير: إظهار ملاحظات كل صنف
  showBillNumber?: boolean; // الفاتورة: إظهار رقم الفاتورة
  showItemDetails?: boolean; // الفاتورة: إظهار المقاس/الإضافات بجانب الصنف
  showOrderNumber?: boolean; // التحضير: إظهار رقم الطلب
  showFulfillmentBadge?: boolean; // التحضير: إظهار شارة (دليفري/تيك أوي)
  showRelatedBill?: boolean; // التحضير: إظهار رقم الفاتورة المرتبط
  fontRelatedBill?: number; // px — حجم رقم الفاتورة المرتبط (التحضير)
  // تحكم منفصل: عنوان (label) كل عنصر أمام بياناته
  showBillNumberLabel?: boolean; fontBillNumberLabel?: number;
  showOrderNumberLabel?: boolean; fontOrderNumberLabel?: number;
  showRelatedBillLabel?: boolean; fontRelatedBillLabel?: number;
  showFulfillmentBadgeLabel?: boolean; fontFulfillmentBadgeLabel?: number;
  showDateLabel?: boolean; fontDateLabel?: number;
  showTimeLabel?: boolean; fontTimeLabel?: number;
  showUserLabel?: boolean; fontUserLabel?: number;
  showCustNameLabel?: boolean; fontCustNameLabel?: number;
  showPhoneLabel?: boolean; fontPhoneLabel?: number;
  showAddressLabel?: boolean; fontAddressLabel?: number;
  printFont?: string; // عائلة الخط — لكل مستند على حدة (Tajawal/Cairo/Amiri/IBM Plex Sans Arabic)
  showSectionTotal?: boolean; // التحضير: إظهار إجمالي القسم
  // ملاحظة: توقيع المطور (.dev-sign) مقفل دائماً — لا يخضع لأي إظهار/تنسيق
  showZeroRows?: boolean; // الفاتورة: إظهار الخصم/الضريبة/التوصيل حتى لو صفر
  hidePaidWhenZero?: boolean; // الفاتورة: إخفاء صف المدفوع عند الصفر
  hideRemainingWhenZero?: boolean; // الفاتورة: إخفاء صف المتبقي عند الصفر
  hideBothWhenEitherZero?: boolean; // الفاتورة: إخفاء المدفوع والمتبقي معاً عند تصفير أحدهما
  qrSize?: number; // px — حجم رمز QR
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

const readStringList = (obj: any, key: string): string[] | undefined => {
  if (!obj) return undefined;
  const v = typeof obj.get === 'function'
    ? (() => { try { return obj.get(key); } catch { return undefined; } })()
    : obj[key];
  if (!Array.isArray(v) || v.length === 0) return undefined;
  return v.slice(0, 5).map((x) => String(x || ''));
};

/**
 * طابعات نسخ مستند: مصفوفة بطول عدد النسخ — كل عنصر معرف طابعة النسخة
 * (الفارغ = طابعة المستند الافتراضية / توجيه الأقسام للتحضير).
 * عند غيابها يُستخدم عدد النسخ القديم (documentCopies) — الكل على الافتراضي.
 */
export function resolveDocCopyPrinters(settings: any, key: string, fallbackKey?: string): string[] {
  const maps = (settings as any)?.documentCopyPrinters;
  const arr = readStringList(maps, key) ?? (fallbackKey ? readStringList(maps, fallbackKey) : undefined);
  if (arr) return arr;
  const raw = (settings as any)?.documentCopies?.[key]
    ?? (fallbackKey ? (settings as any)?.documentCopies?.[fallbackKey] : undefined)
    ?? 1;
  const n = Math.min(5, Math.max(1, Number(raw) || 1));
  return Array(n).fill('');
}

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
  const showName = layout.showOrgName !== false;
  if (!show && !showName) return '';
  if (!show) return `<div class="org-name">${orgName}</div>`;
  const img = `<img src="${logoUrl}" style="width:${w}px;max-width:${w}px;height:auto;" />`;
  if (layout.logoPosition === 'beside') {
    // الاسم يمين والشعار يسار (أول عنصر في flex مع RTL يظهر يميناً)
    return `<div class="org-brand-row" style="display:flex;align-items:center;justify-content:center;gap:8px;">${showName ? `<div class="org-name" style="margin:0;">${orgName}</div>` : ''}<div class="org-logo">${img}</div></div>`;
  }
  return `<div class="org-logo" style="text-align:center;margin-bottom:4px;">${img}</div>${showName ? `<div class="org-name">${orgName}</div>` : ''}`;
};

/** اسم عائلة خط الطباعة + رابط الاستيراد — موحد للقوالب الثلاثة */
export const printFontImport = (font?: string): string => {
  const f = font || 'Tajawal';
  if (f === 'Cairo') return 'Cairo:wght@400;700';
  if (f === 'Amiri') return 'Amiri:wght@400;700';
  if (f === 'IBM Plex Sans Arabic') return 'IBM+Plex+Sans+Arabic:wght@400;700';
  return 'Tajawal:wght@400;500;700;800;900';
};
export const layoutCss = (
  l: DocPrintLayout,
  doc: 'bill' | 'order' | 'consumption' = 'bill'
): string => {
  const num = (v: any, fb: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, Number(v) || fb));
  const set = (v: any) => v !== undefined && v !== null && String(v) !== '';
  const css: string[] = [`
.org-name,.title,.header h1{font-size:${num(l.fontTitle, 19, 8, 60)}px !important;}
.items-table,.items-table th,.items-table td,table.items,table.items th,table.items td{font-size:${num(l.fontItems, 15, 8, 60)}px !important;}
.totals-table,.totals-table th,.totals-table td,.category-total{font-size:${num(l.fontTotals, 16, 8, 60)}px !important;}
.thank-you{font-size:${num(l.fontFooter, 12, 8, 60)}px !important;white-space:pre-line !important;}`];

  // —— موسع: يُبث فقط عند الضبط الصريح — الغائب = شكل الطباعة الحالي بدون أي تغيير
  if (set(l.fontOrgName)) {
    css.push(`.org-name,.header h1{font-size:${num(l.fontOrgName, 19, 8, 60)}px !important;}`);
  }
  if (set(l.fontBillNumber)) {
    css.push(`.title,.title span,.title strong,.order-number,.order-number strong{font-size:${num(l.fontBillNumber, 19, 8, 60)}px !important;}`);
  }
  if (set(l.fontFulfillmentBadge)) {
    css.push(`.fulfill-badge{font-size:${num(l.fontFulfillmentBadge, 20, 8, 60)}px !important;}`);
  }
  if (set(l.fontRelatedBill)) {
    css.push(`.related-bill{font-size:${num(l.fontRelatedBill, 16, 8, 60)}px !important;}`);
  }
  if (set(l.fontBillNumberLabel)) {
    css.push(`.bill-number-label{font-size:${num(l.fontBillNumberLabel, 14, 8, 60)}px !important;}`);
  }
  if (set(l.fontOrderNumberLabel)) {
    css.push(`.order-number-label{font-size:${num(l.fontOrderNumberLabel, 14, 8, 60)}px !important;}`);
  }
  if (set(l.fontRelatedBillLabel)) {
    css.push(`.related-bill-label{font-size:${num(l.fontRelatedBillLabel, 14, 8, 60)}px !important;}`);
  }
  if (set(l.fontFulfillmentBadgeLabel)) {
    css.push(`.bill-type-label,.order-type-label{font-size:${num(l.fontFulfillmentBadgeLabel, 15, 8, 60)}px !important;}`);
  }
  if (set(l.fontDateLabel)) {
    css.push(`.bill-date-label,.order-date-label{font-size:${num(l.fontDateLabel, 12, 8, 60)}px !important;}`);
  }
  if (set(l.fontTimeLabel)) {
    css.push(`.bill-time-label,.order-time-label{font-size:${num(l.fontTimeLabel, 12, 8, 60)}px !important;}`);
  }
  if (set(l.fontUserLabel)) {
    css.push(`.bill-user-label,.order-user-label{font-size:${num(l.fontUserLabel, 12, 8, 60)}px !important;}`);
  }
  if (set(l.fontCustNameLabel)) {
    css.push(`.bill-custname-label,.order-custname-label{font-size:${num(l.fontCustNameLabel, 13, 8, 60)}px !important;}`);
  }
  if (set(l.fontPhoneLabel)) {
    css.push(`.bill-phone-label,.order-phone-label{font-size:${num(l.fontPhoneLabel, 13, 8, 60)}px !important;}`);
  }
  if (set(l.fontAddressLabel)) {
    css.push(`.bill-address-label,.order-address-label{font-size:${num(l.fontAddressLabel, 12, 8, 60)}px !important;}`);
  }
  if (set(l.fontDate)) {
    css.push(`.bill-date,.order-date,.date-info{font-size:${num(l.fontDate, 12, 8, 60)}px !important;}`);
  }
  if (set(l.fontTime)) {
    css.push(`.bill-time,.order-time{font-size:${num(l.fontTime, 12, 8, 60)}px !important;}`);
  }
  if (set(l.fontUser)) {
    css.push(`.bill-user,.order-user{font-size:${num(l.fontUser, 12, 8, 60)}px !important;}`);
  }
  if (set(l.fontOrgPhone)) {
    css.push(`.org-phone{font-size:${num(l.fontOrgPhone, 14, 8, 60)}px !important;}`);
  }
  if (l.fontTableHeader !== undefined && l.fontTableHeader !== null && String(l.fontTableHeader) !== '') {
    css.push(`.items-table th,table.items th{font-size:${num(l.fontTableHeader, 13, 8, 60)}px !important;}`);
    css.push(`.section-title,.section-name,.category-name{font-size:${num(l.fontTableHeader, 13, 8, 60)}px !important;}`);
  }
  if (l.fontTableBody !== undefined && l.fontTableBody !== null && String(l.fontTableBody) !== '') {
    css.push(`.items-table td,table.items td{font-size:${num(l.fontTableBody, 15, 8, 60)}px !important;}`);
  }
  if (l.fontNotes !== undefined && l.fontNotes !== null && String(l.fontNotes) !== '') {
    css.push(`.notes,.notes small,.item-name small{font-size:${num(l.fontNotes, 11, 8, 60)}px !important;}`);
  }
  const colFont = (v: any, sel: string, fb: number) => {
    if (v !== undefined && v !== null && String(v) !== '') {
      css.push(`${sel}{font-size:${num(v, fb, 8, 60)}px !important;}`);
    }
  };
  colFont(l.fontNameCol, '.items-table .item-name,table.items .item-name', 15);
  colFont(l.fontQtyCol, '.items-table .item-quantity,table.items .item-qty', 15);
  colFont(l.fontPaidCol, '.items-table .item-paid-qty', 15);
  colFont(l.fontPriceCol, '.items-table .item-price,table.items .item-price', 15);
  colFont(l.fontTotalCol, '.items-table .item-total,.section-block .total,table.items .item-total', 16);
  // اتجاه النص لكل عمود (رأس/قيم): الرأسي ميلان متصل — يُبث فقط عند الضبط
  const orient = (v: any, sel: string) => {
    if (v === 'v') css.push(`${sel}{writing-mode:vertical-rl !important;text-orientation:mixed !important;white-space:nowrap !important;}`);
  };
  if (doc === 'bill') {
    const th = (c: string) => `.items-table:not(.sessions-table) th.${c}`;
    const td = (c: string) => `.items-table:not(.sessions-table) td.${c}`;
    orient(l.headOrientA, th('col-name')); orient(l.headOrientB, th('col-quantity'));
    orient(l.headOrientC, th('col-paid-qty')); orient(l.headOrientE, th('col-price')); orient(l.headOrientD, th('col-total'));
    orient(l.bodyOrientA, td('item-name')); orient(l.bodyOrientB, td('item-quantity'));
    orient(l.bodyOrientC, td('item-paid-qty')); orient(l.bodyOrientE, td('item-price')); orient(l.bodyOrientD, td('item-total'));
  } else if (doc === 'order') {
    orient(l.headOrientA, 'table.items th.item-name'); orient(l.headOrientB, 'table.items th.item-qty');
    orient(l.headOrientC, 'table.items th.item-price'); orient(l.headOrientD, 'table.items th.item-total');
    orient(l.bodyOrientA, 'table.items td.item-name'); orient(l.bodyOrientB, 'table.items td.item-qty');
    orient(l.bodyOrientC, 'table.items td.item-price'); orient(l.bodyOrientD, 'table.items td.item-total');
  } else {
    orient(l.headOrientA, '.items-table th.item-name'); orient(l.headOrientB, '.items-table th.item-quantity');
    orient(l.headOrientC, '.items-table th.item-price'); orient(l.headOrientD, '.items-table th.item-total');
    orient(l.bodyOrientA, '.items-table td.item-name'); orient(l.bodyOrientB, '.items-table td.item-quantity');
    orient(l.bodyOrientC, '.items-table td.item-price'); orient(l.bodyOrientD, '.items-table td.item-total');
  }
  colFont(l.fontCustName, '.cust-name', 14);
  colFont(l.fontCustPhone, '.cust-phone', 13);
  colFont(l.fontAddress, '.delivery-address', 12);
  if (l.fontHeader !== undefined && l.fontHeader !== null && String(l.fontHeader) !== '') {
    css.push(`.info,.order-info,.date-info{font-size:${num(l.fontHeader, 12, 8, 60)}px !important;}`);
  }
  if (l.rowPadding !== undefined && l.rowPadding !== null && String(l.rowPadding) !== '') {
    const p = Math.min(12, Math.max(0, Number(l.rowPadding) || 0));
    css.push(`.items-table td,table.items td{padding-top:${p}px !important;padding-bottom:${p}px !important;}`);
  }
  if (l.tableBorder !== undefined && l.tableBorder !== null && String(l.tableBorder) !== '') {
    const b = Math.min(4, Math.max(0, Number(l.tableBorder) || 0));
    css.push(`.items-table,.totals-table,table.items{border-width:${b}px !important;}`);
    css.push(`.items-table th,.items-table td,.totals-table th,.totals-table td,table.items th,table.items td{border-width:${b}px !important;}`);
  }
  if (l.qrSize !== undefined && l.qrSize !== null && String(l.qrSize) !== '') {
    css.push(`.qr-code{max-width:${Math.min(220, Math.max(50, Number(l.qrSize) || 120))}px !important;}`);
  }

  // —— عروض الأعمدة (تُطبّع دائماً على 100%)
  const norm = (arr: number[]): number[] => {
    const clean = arr.map((v) => Math.max(5, Number(v) || 10));
    const sum = clean.reduce((a, b) => a + b, 0) || 1;
    return clean.map((v) => Math.round((v / sum) * 1000) / 10);
  };
  const hasCols = set(l.colA) || set(l.colB) || set(l.colC) || set(l.colD) || set(l.colE);
  if (doc === 'bill') {
    const paid = l.showPaidCol !== false;
    const price = l.showPriceCol === true;
    const priceSel = (w: number | string) => `.items-table .item-price,.items-table .col-price{width:${w}% !important;}`;
    if (paid && price) {
      const [a, b, c, e, d] = hasCols
        ? norm([l.colA ?? 40, l.colB ?? 12, l.colC ?? 12, l.colE ?? 14, l.colD ?? 22])
        : [40, 12, 12, 14, 22];
      css.push(`.items-table .item-name,.items-table .col-name{width:${a}% !important;}`);
      css.push(`.items-table .item-quantity,.items-table .col-quantity{width:${b}% !important;}`);
      css.push(`.items-table .item-paid-qty,.items-table .col-paid-qty{width:${c}% !important;}`);
      css.push(priceSel(e));
      css.push(`.items-table .item-total,.items-table .col-total{width:${d}% !important;}`);
    } else if (paid && !price) {
      if (!hasCols) {
        // الشكل الحالي الافتراضي — بدون أي تجاوز
      } else {
      const [a, b, c, d] = norm([l.colA ?? 50, l.colB ?? 17, l.colC ?? 17, l.colD ?? 16]);
      css.push(`.items-table .item-name,.items-table .col-name{width:${a}% !important;}`);
      css.push(`.items-table .item-quantity,.items-table .col-quantity{width:${b}% !important;}`);
      css.push(`.items-table .item-paid-qty,.items-table .col-paid-qty{width:${c}% !important;}`);
      css.push(`.items-table .item-total,.items-table .col-total{width:${d}% !important;}`);
      }
    } else if (!paid && price) {
      const [a, b, e, d] = hasCols
        ? norm([l.colA ?? 44, l.colB ?? 14, l.colE ?? 16, l.colD ?? 26])
        : [44, 14, 16, 26];
      css.push(`.items-table .item-name,.items-table .col-name{width:${a}% !important;}`);
      css.push(`.items-table .item-quantity,.items-table .col-quantity{width:${b}% !important;}`);
      css.push(priceSel(e));
      css.push(`.items-table .item-total,.items-table .col-total{width:${d}% !important;}`);
    } else if (hasCols) {
      const [a3, b3, d3] = norm([l.colA ?? 60, l.colB ?? 20, l.colD ?? 20]);
      css.push(`.items-table .item-name,.items-table .col-name{width:${a3}% !important;}`);
      css.push(`.items-table .item-quantity,.items-table .col-quantity{width:${b3}% !important;}`);
      css.push(`.items-table .item-total,.items-table .col-total{width:${d3}% !important;}`);
    } else if (!paid) {
      css.push(`.items-table .item-name,.items-table .col-name{width:60% !important;}`);
      css.push(`.items-table .item-quantity,.items-table .col-quantity{width:20% !important;}`);
      css.push(`.items-table .item-total,.items-table .col-total{width:20% !important;}`);
    }
  } else if (doc === 'order') {
    const price = l.showPriceCol === true;
    const total = l.showTotalCol === true;
    if (price && total) {
      const [a, b, e, d] = hasCols
        ? norm([l.colA ?? 46, l.colB ?? 14, l.colC ?? 18, l.colD ?? 22])
        : [46, 14, 18, 22];
      css.push(`table.items .item-name{width:${a}% !important;}`);
      css.push(`table.items .item-qty{width:${b}% !important;}`);
      css.push(`table.items .item-price{width:${e}% !important;}`);
      css.push(`table.items .item-total{width:${d}% !important;}`);
    } else if (price || total) {
      const [a, b, x] = hasCols
        ? norm([l.colA ?? 54, l.colB ?? 16, (price ? l.colC : l.colD) ?? 30])
        : [54, 16, 30];
      css.push(`table.items .item-name{width:${a}% !important;}`);
      css.push(`table.items .item-qty{width:${b}% !important;}`);
      css.push(`table.items .${price ? 'item-price' : 'item-total'}{width:${x}% !important;}`);
    } else if (hasCols) {
      const [a, b] = norm([l.colA ?? 70, l.colB ?? 30]);
      css.push(`table.items .item-name{width:${a}% !important;}`);
      css.push(`table.items .item-qty{width:${b}% !important;}`);
    }
  } else {
    if (hasCols) {
      const [a, b, c, d] = norm([l.colA ?? 40, l.colB ?? 20, l.colC ?? 20, l.colD ?? 20]);
      css.push(`.items-table .item-name{width:${a}% !important;}`);
      css.push(`.items-table .item-quantity{width:${b}% !important;}`);
      css.push(`.items-table .item-price{width:${c}% !important;}`);
      css.push(`.items-table .item-total{width:${d}% !important;}`);
    }
  }
  return css.join('\n');
};
