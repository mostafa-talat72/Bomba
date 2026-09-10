/**
 * Fully automatic LAN time sync (no manual IP, no manual steps).
 *
 * - Authority election is deterministic: the smallest deviceId among
 *   self + discovered peers is the time source. Every device computes the
 *   same authority from its own peer view, so no coordination is needed.
 * - Authority device configures Windows built-in NTP server.
 * - Other devices point w32tm at the authority IP (taken from discovery,
 *   preferring the actual reachable interface) and resync.
 * - Needs administrator ONCE (Windows requirement for time config). Without
 *   admin it fails gracefully with a clear message instead of breaking.
 */
import { execFile } from "child_process";
import lanMeshDiscovery from "./lanDiscovery.js";
import { getDeviceId, isTimeSourcePinned } from "./deviceIdentity.js";
import Logger from "../middleware/logger.js";

const isWin = process.platform === "win32";

function run(cmd, args, timeoutMs = 25000) {
    return new Promise((resolve) => {
        execFile(cmd, args, { windowsHide: true, timeout: timeoutMs }, (err, stdout, stderr) => {
            resolve({
                ok: !err,
                out: String(stdout || "").slice(0, 2000),
                err: String((err && err.message) || stderr || "").slice(0, 500),
            });
        });
    });
}

/**
 * Authority election (self included):
 * 1. A manually pinned device always wins (admin verified its clock).
 * 2. Otherwise the smallest deviceId wins (deterministic, no coordination).
 * 3. Two pins = conflict → fall back to smallest id and report it.
 */
export function pickTimeAuthority() {
    const self = getDeviceId();
    const peers = lanMeshDiscovery.getPeers();
    const selfPinned = isTimeSourcePinned();
    const all = [{ deviceId: self, ip: null, name: "this device", timeSource: selfPinned }, ...peers];
    const byId = (a, b) => String(a.deviceId).localeCompare(String(b.deviceId));
    const pinned = all.filter((a) => a.timeSource === true).sort(byId);
    const authority = pinned.length > 0 ? pinned[0] : [...all].sort(byId)[0];
    return {
        authority,
        selfId: self,
        peers,
        pinned: authority.timeSource === true,
        conflict: pinned.length > 1,
    };
}

async function configureAsTimeServer() {
    const steps = [];
    steps.push(await run("reg", ["add", "HKLM\\SYSTEM\\CurrentControlSet\\Services\\W32Time\\TimeProviders\\NtpServer", "/v", "Enabled", "/t", "REG_DWORD", "/d", "1", "/f"]));
    steps.push(await run("reg", ["add", "HKLM\\SYSTEM\\CurrentControlSet\\Services\\W32Time\\Config", "/v", "AnnounceFlags", "/t", "REG_DWORD", "/d", "5", "/f"]));
    steps.push(await run("netsh", ["advfirewall", "firewall", "add", "rule", "name=MTE Systems NTP (UDP 123)", "dir=in", "action=allow", "protocol=UDP", "localport=123", "profile=private,domain", "enable=yes"]));
    steps.push(await run("net", ["stop", "w32time"]));
    steps.push(await run("net", ["start", "w32time"]));
    return steps.every((s) => s.ok);
}

async function configureAsTimeClient(authorityIp) {
    const steps = [];
    steps.push(await run("w32tm", ["/config", `/manualpeerlist:${authorityIp}`, "/syncfromflags:manual", "/reliable:no", "/update"]));
    steps.push(await run("net", ["stop", "w32time"]));
    steps.push(await run("net", ["start", "w32time"]));
    await new Promise((r) => setTimeout(r, 3000));
    const resync = await run("w32tm", ["/resync", "/force"]);
    steps.push(resync);
    return { ok: steps.every((s) => s.ok), detail: resync.out || resync.err };
}

/**
 * Ensure this device's clock follows the elected LAN authority.
 * Safe to call repeatedly (idempotent). Never throws.
 */
export async function ensureLanTimeSync({ forced = false } = {}) {
    if (!isWin) return { success: false, message: "مزامنة الوقت التلقائية تعمل على ويندوز فقط" };
    try {
        const pick = pickTimeAuthority();
        const { authority, selfId, peers } = pick;
        if (peers.length === 0) {
            return { success: true, role: "alone", message: "لا توجد أجهزة أخرى على الشبكة — لا حاجة للمزامنة" };
        }
        if (authority.deviceId === selfId) {
            const ok = await configureAsTimeServer();
            if (!ok) return { success: false, role: "server", message: "تعذر ضبط خدمة الوقت — شغّل البرنامج كمسؤول مرة واحدة" };
            const why = pick.pinned ? " (مثبّت يدوياً)" : " (بالانتخاب التلقائي)";
            if (pick.conflict) Logger.warn("⚠️ LAN time: two devices pinned as source — using smallest id");
            Logger.info(`✅ LAN time: this device is the time source${why}`);
            return { success: true, role: "server", pinned: pick.pinned, message: `هذا الجهاز هو مرجع الوقت للأجهزة الأخرى${why}` };
        }
        const ok = await configureAsTimeClient(authority.ip);
        if (!ok.ok) return { success: false, role: "client", message: "تعذر ضبط الوقت — شغّل البرنامج كمسؤول مرة واحدة" };
        Logger.info(`✅ LAN time: syncing to authority ${authority.name} (${authority.ip})`);
        return { success: true, role: "client", authorityIp: authority.ip, message: `تتم المزامنة مع ${authority.name || "الجهاز المرجعي"} (${authority.ip})` };
    } catch (e) {
        return { success: false, message: `فشل ضبط الوقت: ${e.message}` };
    }
}

let lastAutoRunAt = 0;
const AUTO_MIN_GAP_MS = 5 * 60 * 1000;
const AUTO_DRIFT_THRESHOLD_MS = 10000;

/**
 * Called on peer-up: silently converge clocks only when clearly wrong
 * (>10s drift) to avoid touching a healthy setup. Never throws.
 */
export function maybeAutoTimeSync(peer) {
    try {
        const now = Date.now();
        if (now - lastAutoRunAt < AUTO_MIN_GAP_MS) return;
        const off = peer && typeof peer.clockOffsetMs === "number" ? Math.abs(peer.clockOffsetMs) : Infinity;
        if (off <= AUTO_DRIFT_THRESHOLD_MS) return; // clocks already agree
        lastAutoRunAt = now;
        Logger.info(`⏰ LAN time drift detected (${Math.round(off / 1000)}s) — auto-converging...`);
        ensureLanTimeSync().then((r) => {
            Logger.info(`⏰ LAN time auto-sync: ${r.message}`);
        }).catch(() => {});
    } catch {}
}

export default { ensureLanTimeSync, maybeAutoTimeSync, pickTimeAuthority };
