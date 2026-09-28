import express from "express";
import {
    getOrders,
    getPendingOrders,
    getOrder,
    createOrder,
    createPublicOrder,
    acceptCustomerOrder,
    rejectCustomerOrder,
    getPublicOrderStatus,
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
    moveOrderToTable,
} from "../controllers/orderController.js";
import { authenticateToken, authorize } from "../middleware/auth.js";
import { publicOrderLimiter, publicStatusLimiter } from "../middleware/rateLimiter.js";
import {
    validateOrder,
    validateOrderUpdate,
    validateRequest,
} from "../middleware/validation.js";

const router = express.Router();

// Public customer ordering from QR menu — NO AUTH (strict validation + rate limit inside)
router.post("/public", publicOrderLimiter, createPublicOrder);
router.get("/public/:id", publicStatusLimiter, getPublicOrderStatus);

// All routes below require authentication
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
router.delete(
    "/:id",
    authorize("canDeleteOrder", "cafe", "tables", "menu", "all"),
    deleteOrder
);

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

// Update order status — requires the kitchen permission (same as client-side canUpdateOrderStatus gate)
router.patch(
    "/:id/status",
    authorize("canUpdateOrderStatus", "all"),
    updateOrderStatus
);
router.put("/:id/status", authorize("canUpdateOrderStatus", "all"), updateOrderStatus);
// Customer request review (accept/reject pending QR orders)
router.post("/:id/accept", authenticateToken, authorize("canReviewCustomerOrders", "all"), acceptCustomerOrder);
router.post("/:id/reject", authenticateToken, authorize("canReviewCustomerOrders", "all"), rejectCustomerOrder);
router.patch(
    "/:id/items/:itemIndex/status",
    authorize("canUpdateOrderStatus", "all"),
    updateOrderItemStatus
);
router.patch("/:id/cancel", authorize("canUpdateOrderStatus", "all"), cancelOrder);

// Update preparedCount for an item in an order — kitchen permission required
router.put(
    "/:orderId/items/:itemIndex/prepared",
    authorize("canUpdateOrderStatus", "all"),
    updateOrderItemPrepared
);

// Deduct all inventory for order preparation — kitchen permission required
router.post(
    "/:orderId/deduct-inventory",
    authorize("canUpdateOrderStatus", "all"),
    deductOrderInventory
);

// Deliver specific item in order — kitchen permission required
router.put(
    "/:id/deliver-item/:itemIndex",
    authorize("canUpdateOrderStatus", "all"),
    deliverItem
);

// Deliver all items of a section within an order — kitchen permission required
router.put(
    "/:orderId/deliver-section",
    authorize("canUpdateOrderStatus", "all"),
    deliverOrderSection
);

// Move single order to another table (smart bill handling)
router.post(
    "/:id/move-table",
    authorize("canMoveOrderTableToTable", "all"),
    moveOrderToTable
);

export default router;
