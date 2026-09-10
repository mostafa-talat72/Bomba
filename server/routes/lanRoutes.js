/**
 * LAN peer-sync HTTP endpoints (offline-first, no auth — LAN-trusted).
 *
 * - GET  /api/lan/peers        list discovered peers (+ self info for the badge)
 * - POST /api/lan/receive      upsert/delete one doc pushed by a peer
 * - POST /api/lan/sync-missing catch-up: { collection, since, limit } -> docs changed since
 *
 * Mounted in server.js alongside the existing /api/lan/health + /api/lan/status.
 */
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import lanMeshDiscovery from "../utils/lanDiscovery.js";
import { applyReceivedDoc } from "../utils/lanPeerSync.js";
import Logger from "../middleware/logger.js";

const router = express.Router();

function isSafeCollection(name) {
    if (typeof name !== "string" || !name) return false;
    if (name.startsWith("system.")) return false;
    if (name.includes("$") || name.includes("\0")) return false;
    if (name.length > 120) return false;
    return true;
}

// Collection+operation -> the exact socket event the screens already handle
// for local writes. Re-emitting it makes LAN changes instant (<100ms, no fetch).
const LAN_SPECIFIC_EVENTS = {
    orders: { insert: "order:created", update: "order:updated", delete: "order:deleted" },
    bills: { insert: "bill:created", update: "bill:updated", delete: "bill:deleted" },
    sessions: { insert: "session:created", update: "session:updated" }, // delete via generic handler
    tables: { insert: "table:created", update: "table:updated", delete: "table:deleted" },
    tablesections: { insert: "tableSection:created", update: "tableSection:updated", delete: "tableSection:deleted" },
};

// ---- App update over LAN: serve this device's installer to peers ----
// The admin drops the newest Setup exe into the updates dir (or it is the
// project's desktop/release output); peers compare + download it.
const __lanDir = path.dirname(fileURLToPath(import.meta.url)); // server/routes
const __serverDir = path.resolve(__lanDir, "..");
const __projectDir = path.resolve(__serverDir, "..");

const findLocalInstaller = () => {
    const dirs = [
        process.env.UPDATE_DIR,
        process.env.DESKTOP_DATA_DIR ? path.join(process.env.DESKTOP_DATA_DIR, "updates") : null,
        path.join(__projectDir, "desktop", "release"),
    ].filter(Boolean);
    let best = null;
    for (const dir of dirs) {
        try {
            if (!fs.existsSync(dir)) continue;
            for (const f of fs.readdirSync(dir)) {
                if (!/setup.*\.exe$/i.test(f) || f.startsWith("__uninstaller")) continue;
                const full = path.join(dir, f);
                const st = fs.statSync(full);
                if (!best || st.mtimeMs > best.mtimeMs) {
                    best = { name: f, path: full, size: st.size, mtimeMs: st.mtimeMs, mtime: st.mtime };
                }
            }
        } catch {}
    }
    return best;
};

const getLocalAppVersion = () => {
    const candidates = [
        path.join(__projectDir, "desktop", "package.json"),
        path.join(__projectDir, "package.json"),
        path.join(__serverDir, "package.json"),
    ];
    for (const p of candidates) {
        try {
            if (fs.existsSync(p)) {
                const raw = JSON.parse(fs.readFileSync(p, "utf8"));
                if (raw?.version) return String(raw.version);
            }
        } catch {}
    }
    return "unknown";
};

// GET /api/lan/update -> { appVersion, installer: {name,size,mtime}|null }
router.get("/update", (req, res) => {
    try {
        const found = findLocalInstaller();
        res.json({
            success: true,
            appVersion: getLocalAppVersion(),
            installer: found ? { name: found.name, size: found.size, mtime: found.mtime } : null,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/lan/update/download -> streams the installer exe
router.get("/update/download", (req, res) => {
    try {
        const found = findLocalInstaller();
        if (!found) return res.status(404).json({ success: false, error: "No installer found on this device" });
        res.download(found.path, found.name);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/lan/time-sync — fully automatic clock convergence (no manual IP).
// Elects the time authority from discovery and configures w32tm accordingly.
// Needs administrator once; otherwise returns a clear message.
router.post("/time-sync", async (req, res) => {
    try {
        const { ensureLanTimeSync } = await import("../utils/lanTimeSync.js");
        const result = await ensureLanTimeSync({ forced: true });
        res.json({ success: result.success, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/lan/time-source {enabled} — pin/unpin THIS device as the time
// authority (for the device whose clock you verified, e.g. against a phone).
router.post("/time-source", async (req, res) => {
    try {
        const { setTimeSourcePinned, isTimeSourcePinned } = await import("../utils/deviceIdentity.js");
        const enabled = req.body?.enabled !== false;
        const ok = setTimeSourcePinned(enabled);
        res.json({ success: ok, pinned: enabled && ok ? true : isTimeSourcePinned() });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// List discovered peers (polled by the frontend LAN badge every 10s)
router.get("/peers", (req, res) => {
    try {
        const self = lanMeshDiscovery.getStatus();
        res.json({
            success: true,
            connected: self.peers.length > 0,
            count: self.peers.length,
            peers: self.peers,
            self: {
                deviceId: self.deviceId,
                name: self.name,
                ip: self.localIP,
                port: self.port,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Receive a live write pushed by a peer: { collection, doc, operation }
router.post("/receive", async (req, res) => {
    try {
        const { collection, doc, operation } = req.body || {};
        if (!isSafeCollection(collection)) {
            return res.status(400).json({ success: false, error: "Invalid collection" });
        }
        if (!doc || typeof doc !== "object") {
            return res.status(400).json({ success: false, error: "Invalid doc" });
        }
        if (!["insert", "update", "delete"].includes(operation)) {
            return res.status(400).json({ success: false, error: "Invalid operation" });
        }

        const result = await applyReceivedDoc(collection, doc, operation);
        Logger.info(`[LanMesh] received ${operation}:${collection}:${doc._id}`);

        // Instant UI: re-emit the specific event this device's screens already
        // handle (same handlers as local writes — zero refetch), plus a generic
        // event carrying the doc for collections without specific handlers.
        try {
            const appliedDoc = result?.doc || doc;
            const specific = LAN_SPECIFIC_EVENTS[collection]?.[operation]
                || ((operation === "insert" || operation === "update") ? LAN_SPECIFIC_EVENTS[collection]?.update : undefined);
            if (specific && req.io) req.io.emit(specific, appliedDoc);
            req.io?.emit("lan:remote-change", {
                collection,
                operation,
                _id: String(doc._id),
                doc: appliedDoc,
            });
        } catch {}

        res.json({ success: true, ...result });
    } catch (err) {
        Logger.warn(`[LanMesh] /receive failed: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Catch-up for a returning device: { collection, since: ISO ts, limit }
router.post("/sync-missing", async (req, res) => {
    try {
        const { collection, since, limit } = req.body || {};
        if (!isSafeCollection(collection)) {
            return res.status(400).json({ success: false, error: "Invalid collection" });
        }
        const db = mongoose.connection?.db;
        if (!db) return res.status(503).json({ success: false, error: "DB not connected" });

        const sinceDate = since ? new Date(since) : new Date(0);
        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 500, 1), 1000);

        const docs = await db
            .collection(collection)
            .find({
                $or: [
                    { updatedAt: { $gte: sinceDate } },
                    { createdAt: { $gte: sinceDate } },
                ],
            })
            .sort({ updatedAt: 1 })
            .limit(safeLimit)
            .toArray();

        res.json({ success: true, collection, count: docs.length, docs });
    } catch (err) {
        Logger.warn(`[LanMesh] /sync-missing failed: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
