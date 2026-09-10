import syncQueueManager from "../services/sync/syncQueueManager.js";
import syncWorker from "../services/sync/syncWorker.js";
import dualDatabaseManager from "../config/dualDatabaseManager.js";
import lanMeshDiscovery from "../utils/lanDiscovery.js";
import { getLastBackupStatus } from "../utils/backup.js";

// @desc    Get node-level sync status (queue, worker, atlas, lan peers, last backup)
// @route   GET /api/sync-status
// @access  Private (Admin only — authorize("settings", "all") in routes)
export const getSyncStatus = async (req, res) => {
    try {
        // Queue stats — never let one source break the response
        let queue = { size: 0, maxSize: 0, byType: {}, byCollection: {} };
        try {
            const stats = syncQueueManager.getStats();
            queue = {
                size: stats?.size ?? syncQueueManager.size(),
                maxSize: stats?.maxSize ?? 0,
                byType: stats?.byType || {},
                byCollection: stats?.byCollection || {},
            };
        } catch {}

        // Worker stats
        let worker = { isRunning: false, successCount: 0, failureCount: 0, lastProcessTime: null };
        try {
            const stats = syncWorker.getStats();
            worker = {
                isRunning: Boolean(stats?.isRunning),
                successCount: stats?.successCount ?? 0,
                failureCount: stats?.failureCount ?? 0,
                lastProcessTime: stats?.lastProcessTime ?? null,
            };
        } catch {}

        // Atlas availability
        let atlas = { available: false };
        try {
            atlas = { available: Boolean(dualDatabaseManager.isAtlasAvailable()) };
        } catch {}

        // LAN mesh peers
        let lan = { peers: [] };
        try {
            const peers = lanMeshDiscovery.getPeers() || [];
            lan = {
                peers: peers.map((p) => ({
                    deviceId: p.deviceId,
                    name: p.name,
                    ip: p.ip,
                    port: p.port,
                })),
            };
        } catch {}

        // Last backup status
        let backup = { at: null, success: null, fileName: null, error: null };
        try {
            backup = getLastBackupStatus() || backup;
        } catch {}

        res.json({
            success: true,
            data: { queue, worker, atlas, lan, backup },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "فشل في جلب حالة المزامنة",
            error: error.message,
        });
    }
};
