import express from "express";
import {
    getPerformanceStats,
    getRecentMetrics,
    clearMetrics,
    getPerformanceDashboard,
} from "../controllers/performanceController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(authorize("admin"));

// Performance monitoring routes
router.get("/stats", getPerformanceStats);
router.get("/metrics", getRecentMetrics);
router.get("/dashboard", getPerformanceDashboard);
router.delete("/metrics", clearMetrics);

export default router;
