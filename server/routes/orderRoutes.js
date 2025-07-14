import express from "express";
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
    getTodayOrdersStats,
    deliverItem,
} from "../controllers/orderController.js";
import { authenticateToken, authorize } from "../middleware/auth.js";
import { validateOrder, validateRequest } from "../middleware/validation.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get orders (cafe and menu permissions)
router.get("/", authorize("cafe", "menu", "all"), getOrders);
router.get("/pending", authorize("cafe", "menu", "all"), getPendingOrders);
router.get("/stats", authorize("cafe", "menu", "all"), getOrderStats);
router.get(
    "/today-stats",
    authorize("cafe", "menu", "all"),
    getTodayOrdersStats
);
router.get("/:id", authorize("cafe", "menu", "all"), getOrder);

// Create order (cafe and menu permissions)
router.post(
    "/",
    authorize("cafe", "menu", "all"),
    validateOrder,
    validateRequest,
    createOrder
);

// Update order (cafe and menu permissions)
router.patch(
    "/:id/status",
    authorize("cafe", "menu", "all"),
    updateOrderStatus
);
router.put("/:id/status", authorize("cafe", "menu", "all"), updateOrderStatus);
router.patch(
    "/:id/items/:itemIndex/status",
    authorize("cafe", "menu", "all"),
    updateOrderItemStatus
);
router.patch("/:id/cancel", authorize("cafe", "menu", "all"), cancelOrder);

// Update preparedCount for an item in an order (cafe and menu permissions)
router.put(
    "/:orderId/items/:itemIndex/prepared",
    authorize("cafe", "menu", "all"),
    updateOrderItemPrepared
);

// Deliver specific item in order (cafe and menu permissions)
router.put(
    "/:id/deliver-item/:itemIndex",
    authorize("cafe", "menu", "all"),
    deliverItem
);

export default router;
