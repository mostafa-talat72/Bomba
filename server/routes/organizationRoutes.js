import express from "express";
import {
    getOrganization,
    getOrganizationById,
    updateOrganization,
    updateOrganizationPermissions,
    canEditOrganization,
    getAvailableManagers,
} from "../controllers/organizationController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Add logging for all organization routes
router.use((req, res, next) => {
    next();
});

// Apply auth middleware to all routes
router.use(protect);

// Organization routes
router.route("/")
    .get(getOrganization)
    .put(updateOrganization);

// Specific routes must come before parameterized routes
router.put("/permissions", updateOrganizationPermissions);
router.get("/can-edit", canEditOrganization);
router.get("/available-managers", getAvailableManagers);

// Get organization by ID (for printing bills from other organizations)
// This must come AFTER specific routes to avoid conflicts
router.get("/:id", getOrganizationById);

export default router;