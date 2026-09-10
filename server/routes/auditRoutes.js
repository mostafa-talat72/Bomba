import express from "express";
import { listAuditLogs, listAuditActions } from "../controllers/auditController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.use(authorize("auditLog", "settings", "users", "all"));

router.get("/", listAuditLogs);
router.get("/actions", listAuditActions);

export default router;
