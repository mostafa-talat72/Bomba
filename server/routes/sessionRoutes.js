import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import sessionController from "../controllers/sessionController.js";

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Get all sessions (playstation and computer permissions)
router.get(
    "/",
    authorize("playstation", "computer", "all"),
    sessionController.getSessions
);

// Get single session (playstation and computer permissions)
router.get(
    "/:id",
    authorize("playstation", "computer", "all"),
    sessionController.getSession
);

// Create new session (playstation and computer permissions)
router.post(
    "/",
    authorize("playstation", "computer", "all"),
    sessionController.createSession
);

// Create new session with existing bill (playstation and computer permissions)
router.post(
    "/with-existing-bill",
    authorize("playstation", "computer", "all"),
    sessionController.createSessionWithExistingBill
);

// Update controllers during session (playstation and computer permissions)
router.put(
    "/:sessionId/controllers",
    authorize("playstation", "computer", "all"),
    sessionController.updateControllers
);

// Update session cost in real-time (playstation and computer permissions)
router.put(
    "/:id/update-cost",
    authorize("playstation", "computer", "all"),
    sessionController.updateSessionCost
);

// End session (playstation and computer permissions)
router.put(
    "/:id/end",
    authorize("playstation", "computer", "all"),
    sessionController.endSession
);

// Unlink session from table (playstation and computer permissions)
router.put(
    "/:sessionId/unlink-table",
    authorize("playstation", "computer", "all"),
    sessionController.unlinkTableFromSession
);

// Get active sessions (playstation and computer permissions)
router.get(
    "/status/active",
    (req, res, next) => {
        if (!req.user) {
            return res.sendStatus(401);
        }
        const allowed = ["playstation", "computer", "all"];
        const hasPermission =
            req.user.permissions &&
            allowed.some((p) => req.user.permissions.includes(p));
        if (!hasPermission) {
            return res.sendStatus(403);
        }
        next();
    },
    sessionController.getActiveSessions
);

export default router;
