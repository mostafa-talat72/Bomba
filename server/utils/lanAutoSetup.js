/**
 * LAN zero-config: plug an Ethernet cable and the app connects by itself.
 *
 * - No static IP needed: on a direct cable Windows auto-assigns APIPA
 *   (169.254.x.x/16) on both ends, and discovery uses the packet's source
 *   address (see lanDiscovery.js), so any NIC works.
 * - Server already binds 0.0.0.0 (server.js) — reachable on every NIC.
 * - This module only tries to open the Windows Firewall for TCP `PORT`
 *   and UDP `LAN_DISCOVERY_PORT` silently at startup (fire-and-forget).
 *   Needs admin once; if not admin it fails silently and Windows shows the
 *   standard "allow access" prompt a single time — user clicks Allow.
 */
import { execFile } from "child_process";
import Logger from "../middleware/logger.js";

const RULE_TCP = "MTE Systems LAN (TCP)";
const RULE_UDP = "MTE Systems LAN Discovery (UDP)";

function addRule(ruleName, dir, protocol, port) {
    return new Promise((resolve) => {
        if (process.platform !== "win32") return resolve(false);
        const args = [
            "advfirewall", "firewall", "add", "rule",
            `name=${ruleName}`, "dir=in", "action=allow",
            `protocol=${protocol}`, `localport=${port}`,
            "profile=private,domain", "enable=yes",
        ];
        execFile("netsh", args, { windowsHide: true, timeout: 15000 }, (err) => {
            resolve(!err);
        });
    });
}

/**
 * Try to open firewall for LAN sync. Never throws, never blocks startup.
 * Call WITHOUT await: `ensureLanFirewall();`
 */
export function ensureLanFirewall() {
    try {
        const tcpPort = parseInt(process.env.PORT || "5000", 10);
        const udpPort = parseInt(process.env.LAN_DISCOVERY_PORT || "41234", 10);
        if (process.platform !== "win32") return;
        // Fire-and-forget: do not await, do not fail startup.
        Promise.all([
            addRule(RULE_TCP, "in", "TCP", String(tcpPort)),
            addRule(RULE_UDP, "in", "UDP", String(udpPort)),
        ]).then(([tcp, udp]) => {
            if (tcp || udp) {
                Logger.info(`✅ LAN firewall ready (TCP ${tcpPort}, UDP ${udpPort}) — plug the cable, no setup needed`);
            } else {
                Logger.info("ℹ️  LAN firewall not auto-opened (needs admin once) — allow access on the Windows prompt, or run as administrator one time");
            }
        }).catch(() => {});
    } catch {}
}

export default { ensureLanFirewall };
