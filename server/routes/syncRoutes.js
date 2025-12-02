import express from "express";
import {
    getMetrics,
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
} from "../controllers/syncController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public health check (no auth required)
router.get("/health", getHealth);

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

export default router;
