import express from 'express';
import {
  getInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  updateStock,
  getLowStockItems,
  getStockMovements,
  deleteInventoryItem
} from '../controllers/inventoryController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validateInventoryItem, validateRequest } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.route('/')
  .get(authorize('inventory', 'all'), getInventoryItems)
  .post(authorize('inventory', 'all'), validateInventoryItem, validateRequest, createInventoryItem);

router.get('/low-stock', authorize('inventory', 'all'), getLowStockItems);

router.route('/:id')
  .get(authorize('inventory', 'all'), getInventoryItem)
  .put(authorize('inventory', 'all'), updateInventoryItem)
  .delete(authorize('inventory', 'all'), deleteInventoryItem);

router.put('/:id/stock', authorize('inventory', 'all'), updateStock);
router.get('/:id/movements', authorize('inventory', 'all'), getStockMovements);

export default router;