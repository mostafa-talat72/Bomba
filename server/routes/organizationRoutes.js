import express from "express";
import {
    getOrganization,
    updateOrganization,
    updateOrganizationPermissions,
    canEditOrganization,
    getAvailableManagers,
} from "../controllers/organizationController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// Organization routes
router.route("/")
    .get(getOrganization)
    .put(updateOrganization);

router.put("/permissions", updateOrganizationPermissions);
router.get("/can-edit", canEditOrganization);
router.get("/available-managers", getAvailableManagers);

export default router;