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
    .get(authorize("canViewInventory", "inventory", "all"), getWarehouseItems)
    .post(authorize("canAddInventoryItem", "inventory", "all"), createWarehouseItem);

// Single item
router
    .route("/:id")
    .get(authorize("canViewInventory", "inventory", "all"), getWarehouseItem)
    .put(authorize("canEditInventoryItem", "inventory", "all"), updateWarehouseItem)
    .delete(authorize("canDeleteInventoryItem", "inventory", "all"), deleteWarehouseItem);

// Stock operations
router.put("/:id/stock", authorize("canAddStock", "inventory", "all"), updateWarehouseStock);

// Movements
router.get("/:id/movements", authorize("canViewStockMovements", "inventory", "all"), getWarehouseStockMovements);

router
    .route("/:id/movements/:movementId")
    .put(authorize("canEditStockMovement", "inventory", "all"), updateWarehouseStockMovement)
    .delete(authorize("canDeleteStockMovement", "inventory", "all"), deleteWarehouseStockMovement);

// Transfer: Warehouse → Inventory
router.post("/transfer-to-inventory", authorize("canAddStock", "inventory", "all"), transferToInventory);

// Return: Inventory → Warehouse
router.post("/return-to-warehouse", authorize("canAddStock", "inventory", "all"), returnToWarehouse);

export default router;
