import express from "express";
import {
    createBackup,
    getBackups,
    restoreBackup,
    removeBackup,
    getBackupSettings,
    saveBackupSettings,
    importBackup,
    verifyBackupFile,
    downloadBackup,
} from "../controllers/backupController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// All backup routes require authentication + admin permission
// NOTE: protect MUST run before authorize — authorize alone sees no req.user
// and rejects everything with 401.
router.use(protect);
router.use(authorize("settings", "all"));

router.post("/create", createBackup);
router.post("/import", importBackup);
router.post("/verify/:fileName", verifyBackupFile);
router.get("/download/:fileName", downloadBackup);
router.get("/", getBackups);
router.get("/settings", getBackupSettings);
router.put("/settings", saveBackupSettings);
router.post("/restore/:fileName", restoreBackup);
router.delete("/:fileName", removeBackup);

export default router;
