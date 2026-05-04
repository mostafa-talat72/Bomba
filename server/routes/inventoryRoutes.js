import express from 'express';
import {
  getInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  updateStock,
  getLowStockItems,
  getStockMovements,
  deleteInventoryItem,
  deleteStockMovement,
  updateStockMovement
} from '../controllers/inventoryController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validateInventoryItem, validateRequest } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// View inventory items - requires canViewInventory or inventory or all permission
router.route('/')
  .get(authorize('canViewInventory', 'inventory', 'all'), getInventoryItems)
  .post(authorize('canAddInventoryItem', 'inventory', 'all'), validateInventoryItem, validateRequest, createInventoryItem);

// View low stock items - requires canViewInventory or inventory or all permission
router.get('/low-stock', authorize('canViewInventory', 'inventory', 'all'), getLowStockItems);

// Single item operations
router.route('/:id')
  .get(authorize('canViewInventory', 'inventory', 'all'), getInventoryItem)
  .put(authorize('canEditInventoryItem', 'inventory', 'all'), updateInventoryItem)
  .delete(authorize('canDeleteInventoryItem', 'inventory', 'all'), deleteInventoryItem);

// Stock operations - add/remove/adjust stock
router.put('/:id/stock', authorize('canAddStock', 'canRemoveStock', 'canAdjustStock', 'inventory', 'all'), updateStock);

// View movements - requires canViewStockMovements or canViewInventory or inventory or all
router.get('/:id/movements', authorize('canViewStockMovements', 'canViewInventory', 'inventory', 'all'), getStockMovements);

// Movement management routes
router.route('/:id/movements/:movementId')
  .put(authorize('canEditStockMovement', 'inventory', 'all'), updateStockMovement)
  .delete(authorize('canDeleteStockMovement', 'inventory', 'all'), deleteStockMovement);

export default router;