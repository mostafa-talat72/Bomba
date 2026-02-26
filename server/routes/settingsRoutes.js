import express from "express";
import {
    getSettings,
    updateSettings,
    getAllSettings,
    resetSettings,
    exportSettings,
    importSettings,
    getNotificationSettings,
    updateNotificationSettings,
    getGeneralSettings,
    updateGeneralSettings,
    getPayrollSettings,
    updatePayrollSettings,
} from "../controllers/settingsController.js";
import {
    updateProfile,
    changePassword,
} from "../controllers/userController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Profile routes (no special permissions needed)
router.put("/profile", updateProfile);
router.put("/change-password", changePassword);

// Notification settings routes
router.get("/notifications", getNotificationSettings);
router.put("/notifications", updateNotificationSettings);

// General settings routes
router.get("/general", getGeneralSettings);
router.put("/general", updateGeneralSettings);

// Payroll settings routes
router.get("/payroll", getPayrollSettings);
router.post("/payroll", updatePayrollSettings);

// Settings routes (require settings permission)
router.get("/", authorize("settings", "all"), getAllSettings);
router.get("/export", authorize("settings", "all"), exportSettings);
router.post("/import", authorize("settings", "all"), importSettings);

router
    .route("/:category")
    .get(authorize("settings", "all"), getSettings)
    .put(authorize("settings", "all"), updateSettings);

router.post("/:category/reset", authorize("settings", "all"), resetSettings);

export default router;
