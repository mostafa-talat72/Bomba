import express from "express";
import { getHealth } from "../controllers/healthController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Same auth pattern as backupRoutes.js — settings admins only.
// NOTE: protect MUST run before authorize, otherwise every call gets 401.
router.use(protect);
router.use(authorize("settings", "all"));

router.get("/", getHealth);

export default router;
