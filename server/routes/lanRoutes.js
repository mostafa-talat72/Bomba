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

        // Notify this device's own connected UI clients so screens refresh.
        try {
            req.io?.emit("lan:remote-change", { collection, operation, _id: String(doc._id) });
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
