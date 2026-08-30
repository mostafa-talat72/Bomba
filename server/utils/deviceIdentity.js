import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import os from "os";

const DEVICE_ID_FILE_CANDIDATES = [
    path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "bomba-desktop", "device-id.json"),
    path.join(os.homedir(), ".bomba", "device-id.json"),
    path.join(process.cwd(), "data", "device-id.json"),
];

function getDeviceIdPath() {
    // Prefer the first writable candidate; ensure directory exists
    for (const p of DEVICE_ID_FILE_CANDIDATES) {
        try {
            const dir = path.dirname(p);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            // Test write
            return p;
        } catch {}
    }
    return DEVICE_ID_FILE_CANDIDATES[DEVICE_ID_FILE_CANDIDATES.length - 1];
}

let cachedDeviceId = null;

export function getDeviceId() {
    if (process.env.LAN_DEVICE_ID) return process.env.LAN_DEVICE_ID;
    if (cachedDeviceId) return cachedDeviceId;
    const filePath = getDeviceIdPath();
    try {
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
            if (data.deviceId) {
                cachedDeviceId = data.deviceId;
                return cachedDeviceId;
            }
        }
    } catch {}
    const deviceId = `dev-${randomBytes(4).toString("hex")}-${Date.now().toString(36)}`;
    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify({ deviceId, hostname: os.hostname(), createdAt: new Date().toISOString() }, null, 2), "utf8");
    } catch {}
    cachedDeviceId = deviceId;
    return cachedDeviceId;
}

export function getDeviceInfo() {
    const ifaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name] || []) {
            if (iface.family === "IPv4" && !iface.internal) ips.push({ name, address: iface.address });
        }
    }
    return {
        deviceId: getDeviceId(),
        hostname: os.hostname(),
        ips,
        port: parseInt(process.env.PORT || "5000", 10),
    };
}
