import express from 'express';
import {
  getOrders,
  getPendingOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  updateOrderItemStatus,
  cancelOrder,
  getOrderStats,
  updateOrderItemPrepared,
  getTodayOrdersStats
} from '../controllers/orderController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { validateOrder, validateRequest } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get orders
router.get('/', getOrders);
router.get('/pending', getPendingOrders);
router.get('/stats', authorizeRoles(['admin', 'manager']), getOrderStats);
router.get('/today-stats', authorizeRoles(['admin', 'manager', 'staff']), getTodayOrdersStats);
router.get('/:id', getOrder);

// Create order
router.post('/', authorizeRoles(['admin', 'manager', 'staff']), validateOrder, validateRequest, createOrder);

// Update order
router.patch('/:id/status', authorizeRoles(['admin', 'manager', 'staff']), updateOrderStatus);
router.patch('/:id/items/:itemIndex/status', authorizeRoles(['admin', 'manager', 'staff']), updateOrderItemStatus);
router.patch('/:id/cancel', authorizeRoles(['admin', 'manager']), cancelOrder);

// Update preparedCount for an item in an order
router.put('/:orderId/item/:itemIndex/prepared', authorizeRoles(['admin', 'manager', 'staff']), updateOrderItemPrepared);

export default router;
