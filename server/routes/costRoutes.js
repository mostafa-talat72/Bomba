import express from 'express';
import {
  getCosts,
  getCost,
  createCost,
  updateCost,
  approveCost,
  deleteCost,
  getCostsSummary,
  getRecurringCosts
} from '../controllers/costController.js';
import { protect, authorize, adminOnly } from '../middleware/auth.js';
import { validateCost, validateRequest } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.route('/')
  .get(authorize('costs', 'all'), getCosts)
  .post(authorize('costs', 'all'), validateCost, validateRequest, createCost);

router.get('/summary', authorize('costs', 'all'), getCostsSummary);
router.get('/recurring', authorize('costs', 'all'), getRecurringCosts);

router.route('/:id')
  .get(authorize('costs', 'all'), getCost)
  .put(authorize('costs', 'all'), updateCost)
  .delete(authorize('costs', 'all'), deleteCost);

router.put('/:id/approve', protect, adminOnly, approveCost);

export default router;