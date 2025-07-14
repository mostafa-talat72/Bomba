import express from "express";
import {
    getUserNotifications,
    getNotificationStats,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createNotification,
    sendToRole,
    sendToPermission,
    broadcastNotification,
    cleanExpiredNotifications,
} from "../controllers/notificationController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get user notifications (any authenticated user)
router.get("/", getUserNotifications);

// Get notification stats (any authenticated user)
router.get("/stats", getNotificationStats);

// Mark notification as read (any authenticated user)
router.put("/:id/read", markAsRead);

// Mark all notifications as read (any authenticated user)
router.put("/read-all", markAllAsRead);

// Delete notification (any authenticated user)
router.delete("/:id", deleteNotification);

// Admin only routes (all permission required)
router.use(authorize("all"));

// Create custom notification
router.post("/", createNotification);

// Send notification to role
router.post("/role/:role", sendToRole);

// Send notification to permission
router.post("/permission/:permission", sendToPermission);

// Broadcast notification to all users
router.post("/broadcast", broadcastNotification);

// Clean expired notifications
router.delete("/clean-expired", cleanExpiredNotifications);

export default router;
