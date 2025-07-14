import express from "express";
import {
    getSettings,
    updateSettings,
    getAllSettings,
    resetSettings,
    exportSettings,
    importSettings,
} from "../controllers/settingsController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get("/", authorize("settings", "all"), getAllSettings);
router.get("/export", authorize("settings", "all"), exportSettings);
router.post("/import", authorize("settings", "all"), importSettings);

router
    .route("/:category")
    .get(authorize("settings", "all"), getSettings)
    .put(authorize("settings", "all"), updateSettings);

router.post("/:category/reset", authorize("settings", "all"), resetSettings);

export default router;
