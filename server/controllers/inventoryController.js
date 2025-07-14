import InventoryItem from "../models/InventoryItem.js";
import Logger from "../middleware/logger.js";
import NotificationService from "../services/notificationService.js";

// @desc    Get all inventory items
// @route   GET /api/inventory
// @access  Private
export const getInventoryItems = async (req, res) => {
    try {
        const { category, lowStock, page = 1, limit = 10, search } = req.query;

        const query = { isActive: true };

        if (category) query.category = category;
        if (lowStock === "true") {
            query.$expr = { $lte: ["$currentStock", "$minStock"] };
        }
        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        const items = await InventoryItem.find(query)
            .populate("recipe.ingredient", "name unit")
            .sort({ name: 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await InventoryItem.countDocuments(query);

        res.json({
            success: true,
            count: items.length,
            total,
            data: items,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب المخزون",
            error: error.message,
        });
    }
};

// @desc    Get single inventory item
// @route   GET /api/inventory/:id
// @access  Private
export const getInventoryItem = async (req, res) => {
    try {
        const item = await InventoryItem.findById(req.params.id)
            .populate("recipe.ingredient", "name unit")
            .populate("stockMovements.user", "name");

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "المنتج غير موجود",
            });
        }

        res.json({
            success: true,
            data: item,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب المنتج",
            error: error.message,
        });
    }
};

// @desc    Create new inventory item
// @route   POST /api/inventory
// @access  Private
export const createInventoryItem = async (req, res) => {
    try {
        const {
            name,
            category,
            currentStock,
            minStock,
            maxStock,
            unit,
            price,
            cost,
            supplier,
            supplierContact,
            barcode,
            description,
            isRawMaterial,
            recipe,
            expiryDate,
        } = req.body;

        const item = await InventoryItem.create({
            name,
            category,
            currentStock,
            minStock,
            maxStock,
            unit,
            price,
            cost,
            supplier,
            supplierContact,
            barcode,
            description,
            isRawMaterial,
            recipe,
            expiryDate,
        });

        // Add initial stock movement
        if (currentStock > 0) {
            await item.addStockMovement(
                "in",
                currentStock,
                "المخزون الأولي",
                req.user._id
            );
        }

        // Check for low stock and notify
        if (item.isLowStock && req.io) {
            req.io.notifyInventoryUpdate(item);
        }

        res.status(201).json({
            success: true,
            message: "تم إضافة المنتج بنجاح",
            data: item,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في إضافة المنتج",
            error: error.message,
        });
    }
};

// @desc    Update inventory item
// @route   PUT /api/inventory/:id
// @access  Private
export const updateInventoryItem = async (req, res) => {
    try {
        const {
            name,
            category,
            minStock,
            maxStock,
            unit,
            price,
            cost,
            supplier,
            supplierContact,
            barcode,
            description,
            isRawMaterial,
            recipe,
            expiryDate,
            isActive,
        } = req.body;

        const item = await InventoryItem.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "المنتج غير موجود",
            });
        }

        // Update fields
        if (name) item.name = name;
        if (category) item.category = category;
        if (minStock !== undefined) item.minStock = minStock;
        if (maxStock !== undefined) item.maxStock = maxStock;
        if (unit) item.unit = unit;
        if (price !== undefined) item.price = price;
        if (cost !== undefined) item.cost = cost;
        if (supplier !== undefined) item.supplier = supplier;
        if (supplierContact !== undefined)
            item.supplierContact = supplierContact;
        if (barcode !== undefined) item.barcode = barcode;
        if (description !== undefined) item.description = description;
        if (isRawMaterial !== undefined) item.isRawMaterial = isRawMaterial;
        if (recipe) item.recipe = recipe;
        if (expiryDate !== undefined) item.expiryDate = expiryDate;
        if (isActive !== undefined) item.isActive = isActive;

        await item.save();

        // Notify if low stock
        if (item.isLowStock && req.io) {
            req.io.notifyInventoryUpdate(item);
        }

        res.json({
            success: true,
            message: "تم تحديث المنتج بنجاح",
            data: item,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث المنتج",
            error: error.message,
        });
    }
};

// @desc    Update stock
// @route   PUT /api/inventory/:id/stock
// @access  Private
export const updateStock = async (req, res) => {
    try {
        const { type, quantity, reason, reference } = req.body;

        const item = await InventoryItem.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "المنتج غير موجود",
            });
        }

        await item.addStockMovement(
            type,
            quantity,
            reason,
            req.user._id,
            reference
        );

        // Create notification for low stock or out of stock
        try {
            if (item.currentStock === 0) {
                await NotificationService.createInventoryNotification(
                    "out_of_stock",
                    item,
                    req.user._id
                );
            } else if (item.isLowStock) {
                await NotificationService.createInventoryNotification(
                    "low_stock",
                    item,
                    req.user._id
                );
            }
        } catch (notificationError) {
            Logger.error(
                "Failed to create inventory notification:",
                notificationError
            );
        }

        // Notify if low stock
        if (item.isLowStock && req.io) {
            req.io.notifyInventoryUpdate(item);
        }

        res.json({
            success: true,
            message: "تم تحديث المخزون بنجاح",
            data: item,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث المخزون",
            error: error.message,
        });
    }
};

// @desc    Get low stock items
// @route   GET /api/inventory/low-stock
// @access  Private
export const getLowStockItems = async (req, res) => {
    try {
        const items = await InventoryItem.find({
            isActive: true,
            $expr: { $lte: ["$currentStock", "$minStock"] },
        }).sort({ currentStock: 1 });

        res.json({
            success: true,
            count: items.length,
            data: items,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب المنتجات منخفضة المخزون",
            error: error.message,
        });
    }
};

// @desc    Get stock movements
// @route   GET /api/inventory/:id/movements
// @access  Private
export const getStockMovements = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const item = await InventoryItem.findById(req.params.id)
            .populate("stockMovements.user", "name")
            .slice("stockMovements", [(page - 1) * limit, limit]);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "المنتج غير موجود",
            });
        }

        res.json({
            success: true,
            data: item.stockMovements.reverse(),
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب حركات المخزون",
            error: error.message,
        });
    }
};

// @desc    Delete inventory item
// @route   DELETE /api/inventory/:id
// @access  Private
export const deleteInventoryItem = async (req, res) => {
    try {
        const item = await InventoryItem.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "المنتج غير موجود",
            });
        }

        // Soft delete by setting isActive to false
        item.isActive = false;
        await item.save();

        res.json({
            success: true,
            message: "تم حذف المنتج بنجاح",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في حذف المنتج",
            error: error.message,
        });
    }
};
