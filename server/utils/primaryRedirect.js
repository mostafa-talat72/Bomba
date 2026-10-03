import http from "http";
import Logger from "../middleware/logger.js";

// تحويل تصفح المتصفح (صفحات HTML فقط) من جهاز ثانوي إلى الرئيس لحظيًا.
// - لا يمس /api ولا /socket.io ولا الملفات (Accept: text/html فقط)
// - لا يمس نافذة الديسكتوب (localhost/127.0.0.1 مستثناة)
// - عند تعذر الرئيس (فحص صحي كل 10ث) يُخدم محليًا تلقائيًا (استمرارية)
// - الرئيس نفسه لا يحوّل أبدًا (لا حلقات)

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const PROBE_MS = 10000;
const HEALTHY_TTL_MS = 15000;

let lastProbeAt = 0;
let primaryHealthy = false;
let probeTimer = null;

function primaryBase() {
    try {
        const disc = global.lanDiscovery;
        if (!disc || typeof disc.getStatus !== "function") return null;
        const s = disc.getStatus();
        if (!s || s.role !== "secondary" || !s.primary?.address) return null;
        const port = s.primary.port || 5000;
        return `http://${s.primary.address}:${port}`;
    } catch {
        return null;
    }
}

function probePrimary(base) {
    return new Promise((resolve) => {
        try {
            const req = http.get(`${base}/api/lan/health`, { timeout: 4000 }, (res) => {
                res.resume();
                resolve(res.statusCode >= 200 && res.statusCode < 500);
            });
            req.on("timeout", () => { try { req.destroy(); } catch {} resolve(false); });
            req.on("error", () => resolve(false));
        } catch {
            resolve(false);
        }
    });
}

async function refreshProbe() {
    const base = primaryBase();
    if (!base) {
        primaryHealthy = false;
        lastProbeAt = Date.now();
        return;
    }
    primaryHealthy = await probePrimary(base);
    lastProbeAt = Date.now();
}

export function startPrimaryProbe() {
    if (probeTimer) return;
    void refreshProbe();
    probeTimer = setInterval(() => { void refreshProbe(); }, PROBE_MS);
    if (probeTimer.unref) probeTimer.unref();
}

function isLoopback(hostname) {
    if (!hostname) return true;
    const h = String(hostname).split(":")[0].toLowerCase();
    return LOOPBACK.has(h);
}

function wantsHtml(req) {
    const accept = String(req.headers.accept || "");
    return accept.includes("text/html");
}

function wantsLocal(req, res) {
    try {
        const url = new URL(req.originalUrl, "http://x");
        if (url.searchParams.get("direct") === "1") {
            res.cookie("bomba_direct", "1", { maxAge: 24 * 60 * 60 * 1000, sameSite: "lax" });
            return true;
        }
        if (url.searchParams.get("direct") === "0") {
            res.clearCookie("bomba_direct");
            return false;
        }
    } catch {}
    const cookie = String(req.headers.cookie || "");
    return /(?:^|;\s*)bomba_direct=1(?:;|$)/.test(cookie);
}

export function primaryRedirect(req, res, next) {
    try {
        if (req.method !== "GET" || !wantsHtml(req)) return next();
        if (isLoopback(req.hostname)) return next();
        if (wantsLocal(req, res)) return next();
        const base = primaryBase();
        if (!base) return next();
        if (Date.now() - lastProbeAt > HEALTHY_TTL_MS) {
            // فحص لمرة واحدة بلا انتظار (النتيجة للطلبات القادمة)
            void refreshProbe();
            if (!primaryHealthy && Date.now() - lastProbeAt > HEALTHY_TTL_MS) return next();
        }
        if (!primaryHealthy) return next();
        // لا تحويل لنفس العنوان (أمان)
        try {
            const here = `${req.protocol}://${req.get("host")}`;
            if (here.startsWith(base)) return next();
        } catch {}
        Logger.info(`[PrimaryRedirect] ${req.originalUrl} -> ${base}${req.originalUrl}`);
        return res.redirect(302, `${base}${req.originalUrl}`);
    } catch {
        return next();
    }
}

export default { primaryRedirect, startPrimaryProbe };
