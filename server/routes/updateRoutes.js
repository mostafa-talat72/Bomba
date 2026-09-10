import express from "express";
import {
    getVersion,
    checkPeerVersions,
    downloadInstaller,
} from "../controllers/updateController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// LAN update endpoints — authentication + settings permission.
// NOTE: protect MUST run before authorize, otherwise every call gets 401.
router.use(protect);
router.use(authorize("settings", "all"));

router.get("/version", getVersion);
router.get("/check", checkPeerVersions);
router.get("/download", downloadInstaller);

export default router;
