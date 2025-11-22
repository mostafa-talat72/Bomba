import express from "express";
import {
    getDashboardStats,
    getSalesReport,
    getInventoryReport,
    getFinancialReport,
    getSessionsReport,
    getRecentActivity,
    exportReportToExcel,
    exportReportToPDF,
} from "../controllers/reportController.js";
import { protect, authorize } from "../middleware/auth.js";
import Bill from "../models/Bill.js";
import Session from "../models/Session.js";
import Order from "../models/Order.js";
import InventoryItem from "../models/InventoryItem.js";
import Cost from "../models/Cost.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// All routes require reports permission
router.use(authorize("reports", "all"));

// Dashboard stats
router.get("/dashboard", getDashboardStats);

// Recent activity
router.get("/recent-activity", getRecentActivity);

// Export routes
router.get("/export/excel", exportReportToExcel);
router.get("/export/pdf", exportReportToPDF);

// Helper function to get date range
const getDateRange = (period) => {
    const now = new Date();
    const start = new Date();

    switch (period) {
        case "today":
            start.setHours(0, 0, 0, 0);
            break;
        case "week":
            start.setDate(now.getDate() - 7);
            break;
        case "month":
            start.setMonth(now.getMonth() - 1);
            break;
        case "quarter":
            start.setMonth(now.getMonth() - 3);
            break;
        case "year":
            start.setFullYear(now.getFullYear() - 1);
            break;
        default:
            start.setHours(0, 0, 0, 0);
    }

    return { start, end: now };
};

// @desc    Get sales report
// @route   GET /api/reports/sales
// @access  Private (Reports permission)
router.get("/sales", getSalesReport);

// @desc    Get sessions report
// @route   GET /api/reports/sessions
// @access  Private (Reports permission)
router.get("/sessions", getSessionsReport);

// @desc    Get inventory report
// @route   GET /api/reports/inventory
// @access  Private (Reports permission)
router.get("/inventory", getInventoryReport);

// @desc    Get financial report
// @route   GET /api/reports/financial
// @access  Private (Reports permission)
router.get("/financial", getFinancialReport);

export default router;
