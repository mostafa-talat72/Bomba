import express from "express";
import {
    getSettings,
    updateSettings,
    getAllSettings,
    resetSettings,
    exportSettings,
    importSettings,
    validateSettings,
    getSettingsSummary,
} from "../controllers/settingsController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get settings summary
router.get("/summary", authorize("settings", "all"), getSettingsSummary);

// Get all settings
router.get("/", authorize("settings", "all"), getAllSettings);

// Export/Import settings
router.get("/export", authorize("settings", "all"), exportSettings);
router.post("/import", authorize("settings", "all"), importSettings);

// Category-specific routes
router
    .route("/:category")
    .get(authorize("settings", "all"), getSettings)
    .put(authorize("settings", "all"), updateSettings);

// Reset settings to default
router.post("/:category/reset", authorize("settings", "all"), resetSettings);

// Validate settings
router.post(
    "/:category/validate",
    authorize("settings", "all"),
    validateSettings
);

export default router;
