import { api } from '../services/api';

// علم الطباعة المزدوجة (تحضير + فاتورة معاً) لكل نوع طلب — من إعدادات طباعتي.
// قيمة المستخدم أولاً ثم افتراضيات المنشأة ثم مغلق.
export const loadPrintBothFlag = async (
  key: 'printBothDelivery' | 'printBothTakeaway'
): Promise<boolean> => {
  try {
    const res: any = await (api as any).getMyPrintSettings?.();
    const data = res?.success && res.data ? res.data : res?.data || null;
    if (!data) return false;
    const mine = data.printSettings || {};
    const org = data.organizationDefaults || {};
    const v = mine[key] ?? org[key] ?? false;
    return v === true;
  } catch {
    return false;
  }
};
