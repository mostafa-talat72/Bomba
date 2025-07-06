import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import deviceController from '../controllers/deviceController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Get all devices with filtering and pagination (available for all authenticated users)
router.get('/', deviceController.getDevices);

// Get device statistics (admin and staff)
router.get('/stats', authorize('admin', 'staff'), deviceController.getDeviceStats);

// Get single device by ID (available for all authenticated users)
router.get('/:id', deviceController.getDevice);

// Create new device (admin only)
router.post('/', authorize('admin'), deviceController.createDevice);

// Update device (admin only)
router.put('/:id', authorize('admin'), deviceController.updateDevice);

// Update device status only (admin and staff)
router.put('/:id/status', authorize('admin', 'staff'), deviceController.updateDeviceStatus);

// Bulk update devices (admin only)
router.put('/bulk/update', authorize('admin'), deviceController.bulkUpdateDevices);

// Delete device (admin only)
router.delete('/:id', authorize('admin'), deviceController.deleteDevice);

export default router;
