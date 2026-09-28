export interface DeviceCustomer {
  name: string;
  phone: string;
  address: string;
  count: number;
  lastUsed: number;
}

const DEVICE_CUSTOMERS_KEY = 'deliveryCustomers';

export const loadDeviceCustomers = (): DeviceCustomer[] => {
  try {
    const r = JSON.parse(localStorage.getItem(DEVICE_CUSTOMERS_KEY) || '[]');
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
};

export const saveDeviceCustomer = (name: string, phone: string, address: string): void => {
  try {
    const p = phone.replace(/\D/g, '');
    if (!p) return;
    const list = loadDeviceCustomers();
    const idx = list.findIndex((c) => c.phone.replace(/\D/g, '') === p);
    if (idx >= 0) {
      list[idx] = {
        name: name || list[idx].name,
        phone: list[idx].phone,
        address: address || list[idx].address,
        count: (list[idx].count || 1) + 1,
        lastUsed: Date.now(),
      };
    } else {
      list.push({ name, phone, address, count: 1, lastUsed: Date.now() });
    }
    list.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
    localStorage.setItem(DEVICE_CUSTOMERS_KEY, JSON.stringify(list.slice(0, 100)));
  } catch {}
};

// مطابقة فاتورة لنص البحث محلياً (للسوكت) — نفس حقول بحث السيرفر: رقم/اسم/هاتف/عنوان/ملاحظات/صنف
export const phoneVariants = (d: string): string[] => {
  const out = [d];
  if (/^01\d{9}$/.test(d)) out.push('20' + d.slice(1));
  if (/^20\d{10}$/.test(d)) out.push('0' + d.slice(2));
  if (/^0020\d{10}$/.test(d)) out.push('0' + d.slice(4));
  return out;
};

export const normalizeDigits = (s: any): string =>
  String(s || '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

export const digitsOf = (p: any): string => normalizeDigits(p).replace(/\D/g, '');

export const phoneMatches = (stored: any, query: string): boolean => {
  const qd = digitsOf(query);
  if (qd.length < 2) return false;
  const sd = digitsOf(stored);
  if (!sd) return false;
  return phoneVariants(qd).some((v) => sd.includes(v));
};

// الصيغة القياسية المحلية (01XXXXXXXXX) للمقارنة الدقيقة عبر صيغ الدولة.
export const canonicalPhone = (d: string): string => {
  const s = digitsOf(d);
  if (/^0020\d{10}$/.test(s)) return '0' + s.slice(4);
  if (/^20\d{10}$/.test(s)) return '0' + s.slice(2);
  return s;
};

// كل الصيغ المحتملة لرقم جزئي أثناء الكتابة (01 ↔ 20 ↔ 0020).
export const partialVariants = (d: string): string[] => {
  const out = new Set<string>([d]);
  if (d.startsWith('0020')) {
    out.add(d.slice(4));
    out.add('0' + d.slice(4));
    out.add('20' + d.slice(4));
  } else if (d.startsWith('20')) {
    out.add(d.slice(2));
    out.add('0' + d.slice(2));
  } else if (d.startsWith('01')) {
    out.add('20' + d.slice(1));
  } else if (d.startsWith('1')) {
    out.add('0' + d);
    out.add('20' + d);
  }
  return Array.from(out).filter((v) => v.length >= 2);
};

// درجة القرب عبر كل الصيغ: مطابق تمامًا أولاً، ثم بادئة (الأقصر أولاً)، ثم احتواء.
export const scorePhoneVariants = (cp: string, q: string): number | null => {
  let best: number | null = null;
  for (const qv of partialVariants(q)) {
    for (const sv of partialVariants(cp)) {
      let s: number | null = null;
      if (sv === qv) s = -1000;
      else if (sv.startsWith(qv)) s = sv.length - qv.length;
      else if (sv.includes(qv)) s = 100 + sv.indexOf(qv);
      if (s !== null && (best === null || s < best)) best = s;
    }
  }
  return best;
};
