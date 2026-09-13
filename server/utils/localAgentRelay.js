/**
 * ترحيل HTML جاهز (نفس تصميم إيصال الديسكتوب) إلى وكيل الطباعة المحلي
 * على http://127.0.0.1:9100 لي renderه Chromium ويطبعه عبر تعريف الطابعة.
 * النتيجة مطابقة 100% لطباعة الديسكتوب (نفس المحرك ونفس التعريف).
 * يعمل فقط عندما يكون السيرفر على نفس جهاز الوكيل (الجهاز الرئيسي)؛
 * وعند غيابه يُترك القرار لمسار RAW النصي كملاذ أخير.
 */
import Logger from "../middleware/logger.js";

const LOCAL_AGENT_URL = process.env.LOCAL_PRINT_AGENT_URL || 'http://127.0.0.1:9100/print';

export async function relayHtmlToLocalAgent({
  html,
  printerName,
  openDrawer = false,
  paperWidthMm = 80,
  printKey,
  timeoutMs = 45000,
} = {}) {
  if (!html || typeof html !== 'string' || html.length === 0) {
    return { ok: false, message: 'No HTML to relay' };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(LOCAL_AGENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, printerName, openDrawer, paperWidthMm, printKey }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data && data.success) {
      Logger.info(
        `HTML relayed to local print agent (${data.printerName || 'auto'}${data.duplicate ? ', duplicate' : ''}) — desktop-identical design`
      );
      return { ok: true, printerName: data.printerName, duplicate: !!data.duplicate };
    }
    return { ok: false, message: (data && data.message) || `Local agent responded ${res.status}` };
  } catch (e) {
    const msg = e && e.name === 'AbortError' ? 'Local agent timeout' : (e && e.message) || 'Local agent unreachable';
    return { ok: false, message: msg };
  } finally {
    clearTimeout(timer);
  }
}
