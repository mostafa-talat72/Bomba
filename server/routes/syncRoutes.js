import express from "express";
import {
    getMetrics,
    getOverview,
    getHealth,
    getReport,
    getQueueStatus,
    getWorkerStatus,
    getConnectionStatus,
    controlWorker,
    clearQueue,
    resetStats,
    getConfig,
    getBidirectionalMetrics,
    getBidirectionalHealth,
    getBidirectionalConflicts,
    toggleBidirectionalSync,
    getExcludedCollections,
    updateExcludedCollections,
    getMonitorStatus,
    controlMonitor,
    runTypeAudit,
} from "../controllers/syncController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public health check (no auth required)
router.get("/health", getHealth);

// Combined overview for the Sync Status dashboard (granular permission)
router.get("/overview", protect, authorize("syncStatus", "settings", "all"), getOverview);

// All other routes require authentication and admin role
router.use(protect);
router.use(authorize("admin"));

// Metrics and monitoring
router.get("/metrics", getMetrics);
router.get("/report", getReport);
router.get("/config", getConfig);

// Queue management
router.get("/queue", getQueueStatus);
router.post("/queue/clear", clearQueue);

// Worker management
router.get("/worker", getWorkerStatus);
router.post("/worker/control", controlWorker);

// Connection status
router.get("/connections", getConnectionStatus);

// Statistics management
router.post("/stats/reset", resetStats);

// Bidirectional sync endpoints
router.get("/bidirectional/metrics", getBidirectionalMetrics);
router.get("/bidirectional/health", getBidirectionalHealth);
router.get("/bidirectional/conflicts", getBidirectionalConflicts);
router.post("/bidirectional/toggle", toggleBidirectionalSync);

// Excluded collections management
router.get("/bidirectional/excluded-collections", getExcludedCollections);
router.put("/bidirectional/excluded-collections", updateExcludedCollections);

// Monitor management
router.get("/monitor", getMonitorStatus);
router.post("/monitor/control", controlMonitor);

// On-demand BSON type audit (same self-heal as startup). Body: { fix?: boolean }
router.post("/type-audit", runTypeAudit);

export default router;
