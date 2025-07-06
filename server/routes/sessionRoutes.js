import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import sessionController from '../controllers/sessionController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Get all sessions (admin and staff)
router.get('/', authorize('admin', 'staff'), sessionController.getSessions);

// Get single session (admin and staff)
router.get('/:id', authorize('admin', 'staff'), sessionController.getSession);

// Create new session (admin and staff)
router.post('/', authorize('admin', 'staff'), sessionController.createSession);

// Update controllers during session (admin and staff)
router.put('/:sessionId/controllers', authorize('admin', 'staff'), sessionController.updateControllers);

// End session (admin and staff)
router.put('/:id/end', authorize('admin', 'staff'), sessionController.endSession);

// Get active sessions (admin and staff)
router.get('/status/active', authorize('admin', 'staff'), sessionController.getActiveSessions);

export default router;
