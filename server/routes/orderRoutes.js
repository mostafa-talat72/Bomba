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
    deliverOrderSection,
    updateOrder,
    deleteOrder,
    calculateOrderRequirements,
    deductOrderInventory,
} from "../controllers/orderController.js";
import { authenticateToken, authorize } from "../middleware/auth.js";
import {
    validateOrder,
    validateOrderUpdate,
    validateRequest,
} from "../middleware/validation.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get orders (cafe, menu, staff permissions)
router.get("/", authorize("cafe", "tables", "menu", "staff", "all"), getOrders);
router.get("/pending", authorize("cafe", "tables", "menu", "staff", "all"), getPendingOrders);
router.get("/stats", authorize("cafe", "tables", "menu", "staff", "all"), getOrderStats);
router.get(
    "/today-stats",
    authorize("cafe", "tables", "menu", "all"),
    getTodayOrdersStats
);
router.get("/:id", authorize("cafe", "tables", "menu", "all"), getOrder);

// إضافة مسار حذف الطلب
router.delete("/:id", authorize("cafe", "tables", "menu", "all"), deleteOrder);

// إضافة مسار تحديث الطلبات
router.patch(
    "/:id",
    authorize("cafe", "tables", "menu", "all"),
    validateOrderUpdate,
    validateRequest,
    updateOrder
);

// Calculate order requirements (cafe and menu permissions)
router.post(
    "/calculate",
    authorize("cafe", "tables", "menu", "all"),
    validateRequest,
    calculateOrderRequirements
);

// Create order (cafe, menu, staff permissions)
router.post(
    "/",
    authorize("cafe", "tables", "menu", "staff", "all"),
    validateOrder,
    validateRequest,
    createOrder
);

// Update order (cafe and menu permissions)
router.patch(
    "/:id/status",
    authorize("cafe", "tables", "menu", "all"),
    updateOrderStatus
);
router.put("/:id/status", authorize("cafe", "tables", "menu", "staff", "all"), updateOrderStatus);
router.patch(
    "/:id/items/:itemIndex/status",
    authorize("cafe", "tables", "menu", "all"),
    updateOrderItemStatus
);
router.patch("/:id/cancel", authorize("cafe", "tables", "menu", "all"), cancelOrder);

// Update preparedCount for an item in an order (cafe and menu permissions)
router.put(
    "/:orderId/items/:itemIndex/prepared",
    authorize("cafe", "tables", "menu", "all"),
    updateOrderItemPrepared
);

// Deduct all inventory for order preparation (cafe and menu permissions)
router.post(
    "/:orderId/deduct-inventory",
    authorize("cafe", "tables", "menu", "all"),
    deductOrderInventory
);

// Deliver specific item in order (cafe and menu permissions)
router.put(
    "/:id/deliver-item/:itemIndex",
    authorize("cafe", "tables", "menu", "all"),
    deliverItem
);

// Deliver all items of a section within an order (cafe and menu permissions)
router.put(
    "/:orderId/deliver-section",
    authorize("cafe", "tables", "menu", "all"),
    deliverOrderSection
);

export default router;
