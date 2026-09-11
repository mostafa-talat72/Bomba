import ConnectedDevice from "../models/ConnectedDevice.js";

// Throttle lastSeen writes: at most one DB write per device per minute.
const lastTouch = new Map(); // instanceId -> timestamp ms
const TOUCH_INTERVAL_MS = 60 * 1000;
// Considered "online" when seen within this window (socket-free heuristic).
export const ONLINE_WINDOW_MS = 90 * 1000;
// Adoption window: a "new" id matching a recently-seen same context device
// (phones that wipe storage every visit) reuses that row instead of
// duplicating — keeps the admin's label + print permission.
const ADOPT_WINDOW_MS = 24 * 60 * 60 * 1000;

function parseClient(uaRaw) {
    const ua = String(uaRaw || "");
    let deviceType = "browser";
    let platform = "";
    let browser = "";
    if (/electron/i.test(ua)) {
        deviceType = "desktop";
        browser = "Desktop";
        if (/windows/i.test(ua)) platform = "Windows";
        else if (/macintosh|mac os/i.test(ua)) platform = "macOS";
        else if (/linux/i.test(ua)) platform = "Linux";
    } else if (/android/i.test(ua)) {
        deviceType = "mobile";
        platform = "Android";
    } else if (/iphone|ipad|ipod/i.test(ua)) {
        deviceType = "mobile";
        platform = /ipad/i.test(ua) ? "iPad" : "iPhone";
    } else if (/mobile|iemobile|opera mini/i.test(ua)) {
        deviceType = "mobile";
    } else if (/windows/i.test(ua)) {
        platform = "Windows";
    } else if (/macintosh|mac os/i.test(ua)) {
        platform = "macOS";
    } else if (/linux/i.test(ua)) {
        platform = "Linux";
    }
    if (!browser) {
        if (/edg/i.test(ua)) browser = "Edge";
        else if (/samsungbrowser/i.test(ua)) browser = "Samsung";
        else if (/chrome/i.test(ua)) browser = "Chrome";
        else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
        else if (/safari/i.test(ua)) browser = "Safari";
    }
    return { deviceType, platform, browser };
}

function clientIp(req) {
    try {
        const raw = req.ip || req.socket?.remoteAddress || "";
        return String(raw).replace(/^::ffff:/, "");
    } catch {
        return "";
    }
}

function isLoopback(ip) {
    return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

// Find by instanceId, else adopt a recently-seen row from the same context
// (same deviceType + ip + platform + browser + user). Returns the doc or null.
async function findOrAdoptDevice({ instanceId, deviceType, platform, browser, ip, userId, orgId, defaultAllow }) {
    let doc = await ConnectedDevice.findOne({ instanceId });
    if (doc) return doc;
    const since = new Date(Date.now() - ADOPT_WINDOW_MS);
    const sib = await ConnectedDevice.findOne({
        instanceId: { $ne: instanceId },
        deviceType,
        ip: ip || "",
        platform: platform || "",
        browser: browser || "",
        user: userId || null,
        lastSeen: { $gte: since },
    }).sort({ lastSeen: -1 });
    if (sib) {
        // Same physical context with a fresh random id (wiped storage):
        // adopt the row — admin's label + canPrint survive, no duplicate.
        sib.instanceId = instanceId;
        sib.deviceType = deviceType;
        if (platform) sib.platform = platform;
        if (browser) sib.browser = browser;
        if (ip) sib.ip = ip;
        if (userId) sib.user = userId;
        if (orgId && !sib.organization) sib.organization = orgId;
        sib.lastSeen = new Date();
        try {
            await sib.save();
        } catch {
            return null; // unique race lost -> caller treats as unknown
        }
        return sib;
    }
    try {
        doc = await ConnectedDevice.create({
            instanceId,
            deviceType,
            platform,
            browser,
            ip,
            user: userId,
            organization: orgId,
            canPrint: defaultAllow,
            lastSeen: new Date(),
        });
    } catch {
        return null; // create race lost -> caller treats as unknown
    }
    return doc;
}

// Fire-and-forget device touch. Called from authenticateToken (has req.user).
// NEVER throws, NEVER delays the request.
export function touchDevice(req) {
    try {
        const instanceId = String(req.headers?.["x-instance-id"] || "").trim();
        if (!instanceId || instanceId === "UNKNOWN") return;
        const now = Date.now();
        if (now - (lastTouch.get(instanceId) || 0) < TOUCH_INTERVAL_MS) return;
        lastTouch.set(instanceId, now);

        const { deviceType, platform, browser } = parseClient(req.headers?.["user-agent"]);
        const ip = clientIp(req);
        const userId = req.user?._id || null;
        const orgId = req.user?.organization || null;

        // Allowlist default: desktops (and loopback) auto-allowed so the admin
        // never locks their own printing; phones/browsers start blocked.
        // Adoption: same context + fresh random id (wiped storage) reuses the
        // row instead of duplicating it.
        const defaultAllow = deviceType === "desktop" || isLoopback(ip);

        findOrAdoptDevice({ instanceId, deviceType, platform, browser, ip, userId, orgId, defaultAllow })
            .then((doc) => {
                if (!doc || doc.instanceId !== instanceId) return doc; // adopted/created already fresh
                doc.deviceType = deviceType;
                if (platform) doc.platform = platform;
                if (browser) doc.browser = browser;
                if (ip) doc.ip = ip;
                if (userId) doc.user = userId;
                if (orgId && !doc.organization) doc.organization = orgId;
                doc.lastSeen = new Date();
                // canPrint is NEVER auto-changed after creation (admin owns it).
                return doc.save();
            })
            .catch(() => {});
    } catch {}
}

// Gate for print-action endpoints. Missing header = allow (backward compat
// with old clients). Otherwise fail CLOSED: unknown devices are registered
// on the spot (blocked by default, desktops auto-allowed) and enforced.
export async function requireDevicePrintPermission(req, res, next) {
    const blocked = () =>
        res.status(403).json({
            success: false,
            code: "DEVICE_PRINT_BLOCKED",
            message: "الطباعة غير مسموحة لهذا الجهاز — تواصل مع الإدارة لتفعيلها",
        });
    try {
        const instanceId = String(req.headers?.["x-instance-id"] || "").trim();
        if (!instanceId || instanceId === "UNKNOWN") return next();
        const { deviceType, platform, browser } = parseClient(req.headers?.["user-agent"]);
        const ip = clientIp(req);
        const defaultAllow = deviceType === "desktop" || isLoopback(ip);
        const doc = await findOrAdoptDevice({
            instanceId,
            deviceType,
            platform,
            browser,
            ip,
            userId: req.user?._id || null,
            orgId: req.user?.organization || null,
            defaultAllow,
        });
        // null = lost a create race -> let the request through (fail-open).
        if (doc && doc.canPrint === false) return blocked();
        return next();
    } catch {
        return next();
    }
}
