import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import deviceController from "../controllers/deviceController.js";

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Get all devices (playstation and computer permissions)
router.get(
    "/",
    authorize("playstation", "computer", "all"),
    deviceController.getDevices
);

// Get device stats (playstation and computer permissions)
router.get(
    "/stats",
    authorize("playstation", "computer", "all"),
    deviceController.getDeviceStats
);

// Get single device (playstation and computer permissions)
router.get(
    "/:id",
    authorize("playstation", "computer", "all"),
    deviceController.getDevice
);

// Test endpoint to check auth
router.get("/test-auth", (req, res) => {
    res.json({
        success: true,
        message: "Authentication working",
        user: {
            id: req.user?.id,
            role: req.user?.role,
            permissions: req.user?.permissions,
            organization: req.user?.organization
        }
    });
});

// Create new device (admin only)
router.post("/", authorize("all"), deviceController.createDevice);

// Update device (admin only)
router.put("/:id", authorize("all"), deviceController.updateDevice);

// Update device status (playstation and computer permissions)
router.put(
    "/:id/status",
    authorize("playstation", "computer", "all"),
    deviceController.updateDeviceStatus
);

// Bulk update devices (admin only)
router.put(
    "/bulk/update",
    authorize("all"),
    deviceController.bulkUpdateDevices
);

// Delete device (admin only)
router.delete("/:id", authorize("all"), deviceController.deleteDevice);

export default router;
