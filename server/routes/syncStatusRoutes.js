import express from "express";
import { getSyncStatus } from "../controllers/syncStatusController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// All sync-status routes require authentication + admin permission.
// NOTE: protect MUST run before authorize, otherwise every call gets 401.
router.use(protect);
router.use(authorize("settings", "all"));

router.get("/", getSyncStatus);

export default router;
