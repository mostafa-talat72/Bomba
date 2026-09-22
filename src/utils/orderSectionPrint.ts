import type { TFunction } from 'i18next';
import { printOrder } from './printOrder';
import { resolveUserPrintSettings } from './resolvePrintSettings';
import { getCurrentUserCache } from './currentUser';
import { resolveDocLayout, DocPrintLayout } from './printLayout';
import api from '../services/api';

// كاش قصير لشعار المنشأة (10 ثوانٍ) — يُستدعى لكل طلب في الدفعة
let cachedOrgLogo: { logo?: string; expiresAt: number } | null = null;
async function resolveOrgLogo(user: any): Promise<string | undefined> {
  try {
    const orgObj = (user as any)?.organization;
    if (orgObj && typeof orgObj === 'object' && (orgObj as any).logo) {
      return (orgObj as any).logo;
    }
    if (!cachedOrgLogo || cachedOrgLogo.expiresAt < Date.now()) {
      const r: any = await api.getOrganization().catch(() => null);
      cachedOrgLogo = { logo: r?.data?.logo, expiresAt: Date.now() + 10000 };
    }
    return cachedOrgLogo?.logo;
  } catch {
    return undefined;
  }
}

export interface SectionPrintCtx {
  menuItems: any[];
  menuSections: any[];
  user: any;
  organizationName: string;
  language: string;
  t: TFunction;
}

export interface PreparedSection {
  id: string;
  name: string;
}

export interface PreparedBillOrders {
  bill: any;
  orders: any[];
  sections: PreparedSection[];
  menuItemsMap: Map<string, any>;
}

/** حل صنف المنيو: خريطة المنيو الكاملة أولاً (فيها category/section)، ثم الكائن المضمّن.
 *  ضروري لأن استجابات الحفظ تحمل menuItem معبأ جزئياً (name/price بلا category). */
export function resolveMenuItem(item: any, map: Map<string, any>): any {
  const raw = item?.menuItem;
  const key = raw && typeof raw === 'object' ? String(raw._id || raw.id || '') : String(raw || '');
  if (key) {
    const fromMap = map.get(key);
    if (fromMap) return fromMap;
  }
  return raw && typeof raw === 'object' ? raw : undefined;
}

/**
 * منطق طباعة أقسام التحضير المشترك (تيك أوي/دليفري) — نفس قواعد الطاولات:
 * مطابقة الأصناف بالأقسام عبر خريطة المنيو، ثم إعدادات (تلقائي/سؤال/الكل)،
 * ثم توجيه كل قسم لطابعته (sectionPrinterMap). الطاولات لها نسختها الخاصة.
 */
export function prepareBillSections(bill: any, ctx: SectionPrintCtx): PreparedBillOrders | { error: string } {
  const orders = Array.isArray((bill as any)?.orders)
    ? (bill as any).orders.filter((o: any) => o && typeof o === 'object' && Array.isArray(o.items) && o.items.length > 0)
    : [];
  if (orders.length === 0) {
    return { error: ctx.language === 'ar' ? 'لا توجد أصناف للتحضير في هذه الفاتورة' : 'No items to prepare in this bill' };
  }
  const billCustomerName = (bill as any)?.deliveryInfo?.customerName || (bill as any)?.customerName || '';
  const billCustomerPhone = (bill as any)?.deliveryInfo?.phone || (bill as any)?.customerPhone || '';
  const billDeliveryAddress = (bill as any)?.deliveryInfo?.address || '';
  const normalized = orders.map((order: any, idx: number) => ({
    ...order,
    _id: order._id || order.id || `temp-${idx}`,
    fulfillmentType: order.fulfillmentType || (bill as any).fulfillmentType || 'dine_in',
    customerName: order.customerName || billCustomerName,
    customerPhone: order.customerPhone || billCustomerPhone,
    deliveryAddress: (order as any).deliveryAddress || billDeliveryAddress,
    createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
  }));
  const map = new Map<string, any>();
  (ctx.menuItems || []).forEach((mi: any) => {
    map.set(mi.id, mi);
    map.set(mi._id, mi);
  });
  const sectionMap = new Map<string, string>();
  normalized.forEach((order: any) => {
    (order.items || []).forEach((item: any) => {
      const menuItem = resolveMenuItem(item, map);
      const section = menuItem?.category?.section;
      const id = typeof section === 'object' ? section?._id || section?.id : section;
      if (id) {
        const sectionData = (ctx.menuSections || []).find((s: any) => String(s._id || s.id) === String(id));
        sectionMap.set(String(id), sectionData?.name || ctx.t('orderPrint.unspecifiedSection'));
      } else {
        sectionMap.set('other', ctx.t('orderPrint.otherSection'));
      }
    });
  });
  const sections = Array.from(sectionMap, ([id, name]) => ({ id, name }));
  return { bill, orders: normalized, sections, menuItemsMap: map };
}

async function resolvePrintSettings(user: any): Promise<any> {
  // طازجة أولاً (كاش 10 ثوانٍ): المحفوظ حديثاً يُطبق فوراً بلا إعادة دخول.
  // عند الفشل نرجع للقطة الذاكرة ثم المنشأة — مثل printBill.
  try {
    const { getEffectivePrintSettingsFresh } = await import('./freshPrintSettings');
    const fresh = await getEffectivePrintSettingsFresh(user).catch(() => null);
    if (fresh && Object.keys(fresh).length) return fresh;
  } catch {}
  const mine = resolveUserPrintSettings(getCurrentUserCache() || user);
  if (mine) return mine;
  return (
    (user as any)?.organization?.printSettings ??
    (await api.getOrganization().catch(() => null))?.data?.printSettings
  );
}

function orderSectionIds(order: any, map: Map<string, any>): string[] {
  const ids = new Set<string>();
  (order.items || []).forEach((item: any) => {
    const menuItem = resolveMenuItem(item, map);
    const section = menuItem?.category?.section;
    const id = typeof section === 'object' ? section?._id || section?.id : section;
    ids.add(id ? String(id) : 'other');
  });
  return Array.from(ids);
}

/** طباعة طلب واحد لمجموعة أقسام مختارة مع توجيه الطابعات — تُتخطى الطلبات بلا تقاطع. */
export async function printOneOrderSections(
  order: any,
  selectedIds: string[],
  map: Map<string, any>,
  ctx: SectionPrintCtx
): Promise<boolean> {
  const mine = orderSectionIds(order, map).filter((id) => selectedIds.includes(id));
  if (mine.length === 0) return false;
  const settings = await resolvePrintSettings(ctx.user);
  const profiles = settings?.printers || [];
  // طابعة القسم حسب نوع الطلب (طاولة/تيك أوي/دليفري) — يسقط على الطاولة إن لم يُخصص
  const fulfillment = (order as any)?.fulfillmentType as string | undefined;
  const mapKey = fulfillment === 'takeaway' ? 'sectionPrinterMapTakeaway' : fulfillment === 'delivery' ? 'sectionPrinterMapDelivery' : 'sectionPrinterMap';
  const specificMap = (settings as any)?.[mapKey] || {};
  const fallbackMap = (settings as any)?.sectionPrinterMap || {};
  const routes: Record<string, string> = { ...fallbackMap, ...specificMap };
  const prepKey = fulfillment === 'takeaway' ? 'prep_takeaway' : fulfillment === 'delivery' ? 'prep_delivery' : 'prep';
  // الفارغ يتبع الطاولات (مثل التوجيه) — المحدد صراحةً له الأولوية دائماً.
  const prepCopies = Math.min(5, Math.max(1, Number(settings?.documentCopies?.[prepKey] ?? settings?.documentCopies?.prep ?? 1) || 1));
  const layout: DocPrintLayout = resolveDocLayout(settings, 'order');
  const logoUrl = await resolveOrgLogo(ctx.user);
  const groups = new Map<string, string[]>();
  mine.forEach((sectionId) => {
    const printerId = routes[sectionId] || '';
    groups.set(printerId, [...(groups.get(printerId) || []), sectionId]);
  });
  await Promise.all(
    Array.from(groups.entries()).map(async ([printerId, sectionIds]) => {
      const profile = profiles.find((item: any) => item.id === printerId);
      return printOrder(
        order,
        ctx.menuSections,
        map,
        ctx.organizationName || '',
        ctx.language,
        ctx.t,
        undefined,
        sectionIds,
        profile?.printerName,
        profile?.paperWidthMm,
        prepCopies,
        { logoUrl, layout }
      );
    })
  );
  return true;
}

/**
 * طباعة تحضير فاتورة كاملة: تحضير → قواعد الإعدادات (تلقائي/سؤال/الكل).
 * تُرجع 'printed' أو بيانات المطالبة {orders, sections} ليعرضها المودال، ثم تُستكمل بـ confirmBillPrep.
 */
export async function startBillPrep(
  bill: any,
  ctx: SectionPrintCtx
): Promise<
  | { status: 'printed' }
  | { status: 'prompt'; orders: any[]; sections: PreparedSection[]; menuItemsMap: Map<string, any> }
  | { status: 'error'; message: string }
> {
  const prepared = prepareBillSections(bill, ctx);
  if ('error' in prepared) return { status: 'error', message: prepared.error };
  const { orders, sections, menuItemsMap } = prepared;
  const printSettings = await resolvePrintSettings(ctx.user);
  const defaultSections = (printSettings?.defaultOrderPrintSections || [])
    .map((id: string) => String(id))
    .filter((id: string) => sections.some((section) => section.id === id));
  const selectedDefaults = defaultSections.length > 0 ? defaultSections : sections.map((section) => section.id);
  const prompt = printSettings?.promptOrderPrintSections === true;
  if (printSettings?.autoPrintOrderSections === true) {
    for (const order of orders) {
      await printOneOrderSections(order, selectedDefaults, menuItemsMap, ctx);
    }
    return { status: 'printed' };
  }
  if (prompt && sections.length > 1) {
    return { status: 'prompt', orders, sections, menuItemsMap };
  }
  for (const order of orders) {
    await printOneOrderSections(order, sections.map((section) => section.id), menuItemsMap, ctx);
  }
  return { status: 'printed' };
}

/** إتمام المطالبة: طباعة كل طلبات الفاتورة للأقسام المؤكدة. */
export async function confirmBillPrep(
  orders: any[],
  selectedIds: string[],
  menuItemsMap: Map<string, any>,
  ctx: SectionPrintCtx
): Promise<{ printed: number; skipped: number }> {
  let printed = 0;
  let skipped = 0;
  for (const order of orders) {
    const ok = await printOneOrderSections(order, selectedIds, menuItemsMap, ctx);
    if (ok) printed += 1;
    else skipped += 1;
  }
  return { printed, skipped };
}
