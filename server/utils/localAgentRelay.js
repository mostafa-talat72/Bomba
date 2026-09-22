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
  copies = 1,
  timeoutMs = 45000,
} = {}) {
  if (!html || typeof html !== 'string' || html.length === 0) {
    return { ok: false, message: 'No HTML to relay' };
  }
  const total = Math.min(5, Math.max(1, Number(copies) || 1));
  let lastPrinter = null;
  let lastDuplicate = false;
  // كل نسخة طلب منفصل للوكيل (ورقة مقصوصة منفردة) — الدرج في الأولى فقط.
  for (let i = 0; i < total; i++) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(LOCAL_AGENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html,
        printerName,
        openDrawer: i === 0 ? openDrawer : false,
        paperWidthMm,
        printKey: total > 1 ? `${printKey || 'relay'}:copy${i + 1}` : printKey,
        copies: 1,
      }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data && data.success) {
      if (data.printerName) lastPrinter = data.printerName;
      if (data.duplicate) lastDuplicate = true;
      Logger.info(
        `HTML relayed to local print agent (${data.printerName || 'auto'}${data.duplicate ? ', duplicate' : ''}) — copy ${i + 1}/${total} desktop-identical design`
      );
      continue;
    }
    return { ok: false, message: (data && data.message) || `Local agent responded ${res.status}` };
  } catch (e) {
    const msg = e && e.name === 'AbortError' ? 'Local agent timeout' : (e && e.message) || 'Local agent unreachable';
    return { ok: false, message: msg };
  } finally {
    clearTimeout(timer);
  }
  }
  return { ok: true, printerName: lastPrinter, duplicate: lastDuplicate, copiesPrinted: total };
}
