import express from "express";
import {
    getWarehouseItems,
    getWarehouseItem,
    createWarehouseItem,
    updateWarehouseItem,
    updateWarehouseStock,
    getWarehouseStockMovements,
    deleteWarehouseItem,
    deleteWarehouseStockMovement,
    updateWarehouseStockMovement,
    transferToInventory,
    returnToWarehouse,
} from "../controllers/warehouseController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Main CRUD
router
    .route("/")
    .get(authorize("warehouse", "all"), getWarehouseItems)
    .post(authorize("canAddWarehouseItem", "all"), createWarehouseItem);

// Single item
router
    .route("/:id")
    .get(authorize("warehouse", "all"), getWarehouseItem)
    .put(authorize("canEditWarehouseItem", "all"), updateWarehouseItem)
    .delete(authorize("canDeleteWarehouseItem", "all"), deleteWarehouseItem);

// Stock operations
router.put("/:id/stock", authorize("canAdjustWarehouseStock", "canAddWarehouseItem", "all"), updateWarehouseStock);

// Movements
router.get("/:id/movements", authorize("canViewWarehouseMovements", "warehouse", "all"), getWarehouseStockMovements);

router
    .route("/:id/movements/:movementId")
    .put(authorize("canEditWarehouseMovement", "all"), updateWarehouseStockMovement)
    .delete(authorize("canDeleteWarehouseMovement", "all"), deleteWarehouseStockMovement);

// Transfer: Warehouse → Inventory
router.post("/transfer-to-inventory", authorize("canTransferToInventory", "all"), transferToInventory);

// Return: Inventory → Warehouse
router.post("/return-to-warehouse", authorize("canReturnToWarehouse", "all"), returnToWarehouse);

export default router;
