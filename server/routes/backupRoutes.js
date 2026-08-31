import express from "express";
import {
    createBackup,
    getBackups,
    restoreBackup,
    removeBackup,
} from "../controllers/backupController.js";
import { authorize } from "../middleware/auth.js";

const router = express.Router();

// All backup routes require admin permission
router.use(authorize("settings", "all"));

router.post("/create", createBackup);
router.get("/", getBackups);
router.post("/restore/:fileName", restoreBackup);
router.delete("/:fileName", removeBackup);

export default router;
