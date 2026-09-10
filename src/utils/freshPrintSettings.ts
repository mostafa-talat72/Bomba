import api from '../services/api';
import { resolveEffectivePrintSettings } from './resolvePrintSettings';

/**
 * إعدادات طباعة طازجة من السيرفر (كاش 10 ثوانٍ).
 * السبب: user.organization لقطة من لحظة تسجيل الدخول ولا تتحدث بعد حفظ
 * الإعدادات — فقرارات printMarksPaid/autoPrintOnPayment كانت تُبنى على
 * قيم قديمة ويظن المستخدم أن الزر لا يعمل. عند الفشل نرجع لذاكرة العميل.
 */
let freshOrgCache: { at: number; org: any } | null = null;

export function clearFreshPrintSettingsCache(): void {
  freshOrgCache = null;
}

export async function getEffectivePrintSettingsFresh(user?: any): Promise<Record<string, any>> {
  const memory = resolveEffectivePrintSettings(user, (user as any)?.organization) || {};
  try {
    if (!freshOrgCache || Date.now() - freshOrgCache.at > 10000) {
      const r: any = await api.getOrganization().catch(() => null);
      if (r?.success && r.data) freshOrgCache = { at: Date.now(), org: r.data };
    }
    if (freshOrgCache?.org) {
      return resolveEffectivePrintSettings(user, freshOrgCache.org) || memory;
    }
  } catch {}
  return memory;
}

export async function getPrintFlagFresh(user: any, flag: string): Promise<boolean> {
  try {
    return (await getEffectivePrintSettingsFresh(user))?.[flag] === true;
  } catch {
    return false;
  }
}
