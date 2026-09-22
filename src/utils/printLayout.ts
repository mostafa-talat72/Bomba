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
  fontBillNumber?: number; // px — رقم الفاتورة/الطلب منفصلاً
  fontDate?: number; // px — سطر التاريخ منفصلاً
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
  tableBorder?: number; // px — سمك حدود الجدول (0 = بدون حدود)
  rowPadding?: number; // px — تباعد صفوف الجدول عمودياً
  showPaidCol?: boolean; // الفاتورة: إظهار عمود المدفوع
  showPriceCol?: boolean; // الفاتورة: إظهار عمود السعر
  showDate?: boolean; // إظهار سطر التاريخ
  showUser?: boolean; // إظهار اسم المستخدم (الكاشير) — منفصل عن التاريخ
  showCustName?: boolean; // إظهار اسم العميل — منفصل عن الهاتف
  showTable?: boolean; // إظهار سطر الطاولة
  showCustomer?: boolean; // إظهار سطر العميل
  showOrgPhone?: boolean; // إظهار هاتف المنشأة في الرأس
  showSessions?: boolean; // الفاتورة: إظهار جدول الجلسات
  showSectionTitle?: boolean; // إظهار عناوين الأقسام (الطلبات/الجلسات/اسم القسم)
  showTotalsTable?: boolean; // الفاتورة: إظهار جدول الإجماليات
  showOrderNotes?: boolean; // التحضير: إظهار ملاحظات الطلب
  showDividers?: boolean; // إظهار الخطوط الفاصلة المتقطعة
  showItemNotes?: boolean; // التحضير: إظهار ملاحظات كل صنف
  showBillNumber?: boolean; // الفاتورة: إظهار رقم الفاتورة
  showItemDetails?: boolean; // الفاتورة: إظهار المقاس/الإضافات بجانب الصنف
  showOrderNumber?: boolean; // التحضير: إظهار رقم الطلب
  showFulfillmentBadge?: boolean; // التحضير: إظهار شارة (دليفري/تيك أوي)
  showSectionTotal?: boolean; // التحضير: إظهار إجمالي القسم
  // ملاحظة: توقيع المطور (.dev-sign) مقفل دائماً — لا يخضع لأي إظهار/تنسيق
  showZeroRows?: boolean; // الفاتورة: إظهار الخصم/الضريبة/التوصيل حتى لو صفر
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
    // الاسم يمين والشعار يسار (أول عنصر في flex مع RTL يظهر يميناً)
    return `<div class="org-brand-row" style="display:flex;align-items:center;justify-content:center;gap:8px;"><div class="org-name" style="margin:0;">${orgName}</div><div class="org-logo">${img}</div></div>`;
  }
  return `<div class="org-logo" style="text-align:center;margin-bottom:4px;">${img}</div><div class="org-name">${orgName}</div>`;
};

/** تجاوز أحجام الخطوط ( style واحد يُحقن في القالب — !important يتغلب على المضمن) */
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
    css.push(`.org-name{font-size:${num(l.fontOrgName, 19, 8, 60)}px !important;}`);
  }
  if (set(l.fontBillNumber)) {
    css.push(`.title,.header h1{font-size:${num(l.fontBillNumber, 19, 8, 60)}px !important;}`);
  }
  if (set(l.fontDate)) {
    css.push(`.bill-date,.order-date,.date-info{font-size:${num(l.fontDate, 12, 8, 60)}px !important;}`);
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
  colFont(l.fontPriceCol, '.items-table .item-price', 15);
  colFont(l.fontTotalCol, '.items-table .item-total,.section-block .total', 16);
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
    if (hasCols) {
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
