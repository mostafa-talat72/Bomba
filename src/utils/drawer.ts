import { openCashDrawerThroughAgent } from './localPrintBridge';
import { resolveEffectivePrintSettings } from './resolvePrintSettings';

export type DrawerReason = 'f12' | 'bill' | 'payment';

export const requestDrawerOpen = async (
  reason: DrawerReason,
  bill?: { _id?: string; id?: string; billNumber?: string },
  user?: any
): Promise<boolean> => {
  try {
    const settings: any = user ? resolveEffectivePrintSettings(user, user?.organization) : null;
    const settingName = reason === 'payment' ? 'openCashDrawerOnPayment' : reason === 'bill' ? 'openCashDrawer' : 'openCashDrawerShortcut';
    if (settings && settings[settingName] === false) {
      console.log(`[drawer] skip disabled reason=${reason}`);
      return false;
    }

    const billPrinterId = settings?.documentPrinterMap?.bill;
    const printer = settings?.printers?.find((p: any) => p.id === billPrinterId) || settings?.printers?.[0];
    const printerName = printer?.printerName || printer?.name;

    const billId = bill ? String((bill as any)._id || (bill as any).id || '') : '';
    const key = reason === 'f12'
      ? 'f12-drawer'
      : `bill:${billId || (bill as any)?.billNumber || 'unknown'}:${reason}`;

    console.log(`[drawer] request reason=${reason} key=${key} printer=${printerName || 'default'}`);
    const ok = await openCashDrawerThroughAgent(printerName, key);
    console.log(`[drawer] ${ok ? 'opened' : 'suppressed/failed'} reason=${reason} key=${key}`);
    return ok;
  } catch (e) {
    console.log(`[drawer] error reason=${reason}`, e);
    return false;
  }
};
