import fs from "fs";
import path from "path";
import Logger from "../middleware/logger.js";

// دور الجهاز في بروتوكول الرئيس/الثانوي (LAN):
// - eligible=false → لا يرشح نفسه رئيسًا أبدًا (وضع مستقل/احتياطي صامت)
// - deviceClass: 'fixed' (كاشير ثابت، أولوية أعلى) | 'mobile' (أولوية أدنى)
// القاعدة المعتمدة: الأسبق المؤهل يفوز + الأولوية تكسر التعادل اللحظي فقط + بلا انتزاع.

const ROLE_FILE = path.join(process.cwd(), "data", "lan-role.json");

const DEFAULTS = { eligible: true, deviceClass: "fixed" };

export function classRank(cls) {
    if (cls === "fixed") return 2;
    if (cls === "mobile") return 1;
    return 0;
}

// مقارنة مُرشحين: الأعلى رتبة يفوز، والتعادل يُحسم بأصغر deviceId (حتمي بلا ساعات)
export function compareClaim(a, b) {
    const ra = classRank(a?.roleClass);
    const rb = classRank(b?.roleClass);
    if (ra !== rb) return ra > rb ? a : b;
    const ida = String(a?.deviceId || "");
    const idb = String(b?.deviceId || "");
    return ida <= idb ? a : b;
}

export function getRoleConfig() {
    try {
        if (fs.existsSync(ROLE_FILE)) {
            const raw = JSON.parse(fs.readFileSync(ROLE_FILE, "utf8"));
            return {
                eligible: raw.eligible !== false,
                deviceClass: raw.deviceClass === "mobile" ? "mobile" : "fixed",
            };
        }
    } catch (e) {
        Logger.warn("[LanRole] Failed reading role file", { error: e.message });
    }
    return { ...DEFAULTS };
}

export function saveRoleConfig(patch) {
    const clean = { ...getRoleConfig() };
    if (patch && typeof patch === "object") {
        if (patch.eligible !== undefined) clean.eligible = patch.eligible === true;
        if (patch.deviceClass === "fixed" || patch.deviceClass === "mobile") {
            clean.deviceClass = patch.deviceClass;
        } else if (patch.deviceClass !== undefined) {
            throw new Error("deviceClass must be 'fixed' or 'mobile'");
        }
    }
    try {
        fs.mkdirSync(path.dirname(ROLE_FILE), { recursive: true });
        fs.writeFileSync(
            ROLE_FILE,
            JSON.stringify({ ...clean, updatedAt: new Date().toISOString() }, null, 2)
        );
    } catch (e) {
        Logger.warn("[LanRole] Failed persisting role file", { error: e.message });
        throw e;
    }
    return clean;
}

export default { getRoleConfig, saveRoleConfig, classRank, compareClaim };
