import express from 'express';
import {
  getSettings,
  updateSettings,
  getAllSettings,
  resetSettings,
  exportSettings,
  importSettings
} from '../controllers/settingsController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get('/', getAllSettings);
router.get('/export', adminOnly, exportSettings);
router.post('/import', adminOnly, importSettings);

router.route('/:category')
  .get(getSettings)
  .put(adminOnly, updateSettings);

router.post('/:category/reset', adminOnly, resetSettings);

export default router;