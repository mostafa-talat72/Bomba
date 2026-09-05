import type { User } from '../services/api';

/** User's own print settings when they opted in, otherwise null (fall back to org). */
export function resolveUserPrintSettings(user: Partial<User> | any): Record<string, any> | null {
  if (!user || user.useCustomPrintSettings !== true) return null;
  const ps = user.printSettings;
  if (!ps || typeof ps !== 'object' || Array.isArray(ps)) return null;
  return Object.keys(ps).length ? { ...ps } : null;
}

/**
 * Effective print settings resolution (mirrors server resolvePrintSettingsForUser):
 * user custom settings over organization settings. Device-specific printer
 * path keeps resolving from devicePrinters on the caller side.
 */
export function resolveEffectivePrintSettings(
  user: Partial<User> | any,
  organization?: any
): Record<string, any> {
  const org = organization || user?.organization;
  const orgPs = org?.printSettings && typeof org.printSettings === 'object' ? org.printSettings : {};
  const userPs = resolveUserPrintSettings(user);
  if (!userPs) return { ...orgPs };
  return { ...orgPs, ...userPs };
}
