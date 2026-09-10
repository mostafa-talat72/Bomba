import fs from "fs";
import os from "os";
import path from "path";
import lanMeshDiscovery from "../utils/lanDiscovery.js";
import { getAppVersion, UPDATE_DIR } from "../utils/appVersion.js";

/**
 * Tiny semver compare: returns 1 if a > b, -1 if a < b, 0 if equal.
 * Non-numeric segments are treated as 0. Missing segments are 0.
 */
export function compareVersions(a, b) {
    const pa = String(a || "0.0.0").split(".").map((n) => parseInt(n, 10) || 0);
    const pb = String(b || "0.0.0").split(".").map((n) => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const x = pa[i] || 0;
        const y = pb[i] || 0;
        if (x > y) return 1;
        if (x < y) return -1;
    }
    return 0;
}

async function fetchPeerVersion(ip, port) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
        const res = await fetch(`http://${ip}:${port}/api/update/version`, {
            signal: controller.signal,
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.data?.version || data?.version || null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

// @desc    This device's app version
// @route   GET /api/update/version
// @access  Private (settings/all)
export const getVersion = async (req, res) => {
    try {
        return res.json({
            success: true,
            data: {
                version: getAppVersion(),
                name: process.env.LAN_DEVICE_NAME || os.hostname(),
                platform: process.platform,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "فشل جلب إصدار التطبيق",
            error: error.message,
        });
    }
};

// @desc    Compare this device's version against LAN peers
// @route   GET /api/update/check
// @access  Private (settings/all)
export const checkPeerVersions = async (req, res) => {
    try {
        const self = getAppVersion();
        const peers = lanMeshDiscovery.getPeers() || [];
        const results = await Promise.all(
            peers.map(async (peer) => {
                try {
                    const version = await fetchPeerVersion(peer.ip, peer.port || 5000);
                    return {
                        deviceId: peer.deviceId,
                        name: peer.name || "unknown",
                        ip: peer.ip,
                        version: version || "غير معروف",
                        newer: version ? compareVersions(version, self) > 0 : false,
                    };
                } catch {
                    return {
                        deviceId: peer.deviceId,
                        name: peer.name || "unknown",
                        ip: peer.ip,
                        version: "غير معروف",
                        newer: false,
                    };
                }
            })
        );
        return res.json({ success: true, data: { self, peers: results } });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "فشل فحص إصدارات الأجهزة",
            error: error.message,
        });
    }
};

// @desc    Download the newest installer (*.exe) from the release dir
// @route   GET /api/update/download
// @access  Private (settings/all)
export const downloadInstaller = async (req, res) => {
    try {
        let entries;
        try {
            entries = fs.readdirSync(UPDATE_DIR);
        } catch {
            return res.status(404).json({ success: false, message: "لا يوجد مثبت متاح" });
        }
        const exes = entries.filter((f) => String(f).toLowerCase().endsWith(".exe"));
        if (exes.length === 0) {
            return res.status(404).json({ success: false, message: "لا يوجد مثبت متاح" });
        }
        let newest = null;
        let newestMtime = -1;
        for (const file of exes) {
            try {
                const full = path.join(UPDATE_DIR, file);
                const stat = fs.statSync(full);
                if (!stat.isFile()) continue;
                if (stat.mtimeMs > newestMtime) {
                    newestMtime = stat.mtimeMs;
                    newest = full;
                }
            } catch {
                // skip unreadable entries
            }
        }
        if (!newest) {
            return res.status(404).json({ success: false, message: "لا يوجد مثبت متاح" });
        }
        return res.download(newest, path.basename(newest));
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "فشل تنزيل المثبت",
            error: error.message,
        });
    }
};
