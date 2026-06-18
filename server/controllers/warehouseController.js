import WarehouseItem from "../models/WarehouseItem.js";
import InventoryItem from "../models/InventoryItem.js";
import Cost from "../models/Cost.js";
import CostCategory from "../models/CostCategory.js";
import Logger from "../middleware/logger.js";
import NotificationService from "../services/notificationService.js";

export const getWarehouseItems = async (req, res) => {
    try {
        if (!req.user || !req.user.organization) {
            return res.status(400).json({ success: false, message: "معلومات المستخدم غير صحيحة" });
        }

        const { category, lowStock, page = 1, limit, search } = req.query;
        const query = { isActive: true, organization: req.user.organization };

        if (category) query.category = category;
        if (lowStock === "true") {
            query.$expr = { $lte: ["$currentStock", "$minStock"] };
        }
        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        let itemsQuery = WarehouseItem.find(query).sort({ name: 1 });
        if (limit) {
            itemsQuery = itemsQuery.limit(limit * 1).skip((page - 1) * limit);
        }

        const items = await itemsQuery;
        const total = await WarehouseItem.countDocuments(query);

        res.json({ success: true, count: items.length, total, data: items });
    } catch (error) {
        res.status(500).json({ success: false, message: "خطأ في جلب المخزن الرئيسي", error: error.message });
    }
};

export const getWarehouseItem = async (req, res) => {
    try {
        if (!req.user || !req.user.organization) {
            return res.status(400).json({ success: false, message: "معلومات المستخدم غير صحيحة" });
        }

        const item = await WarehouseItem.findById(req.params.id)
            .populate("stockMovements.user", "name");

        if (!item) {
            return res.status(404).json({ success: false, message: "المنتج غير موجود" });
        }

        res.json({ success: true, data: item });
    } catch (error) {
        res.status(500).json({ success: false, message: "خطأ في جلب المنتج", error: error.message });
    }
};

export const createWarehouseItem = async (req, res) => {
    try {
        const {
            name, category, currentStock, minStock, maxStock, unit, price, cost,
            supplier, supplierContact, barcode, description, isRawMaterial,
            expiryDate, costStatus = "pending", paidAmount = 0, date,
        } = req.body;

        if (!name || !category || !unit || !price || !minStock) {
            return res.status(400).json({ success: false, message: "جميع الحقول المطلوبة يجب أن تكون موجودة" });
        }

        if (!req.user || !req.user.organization) {
            return res.status(400).json({ success: false, message: "معلومات المستخدم غير صحيحة" });
        }

        const item = await WarehouseItem.create({
            name, category, currentStock: 0, minStock, maxStock, unit, price, cost,
            supplier, supplierContact, barcode, description,
            isRawMaterial: Boolean(isRawMaterial), expiryDate,
            organization: req.user.organization,
        });

        if (currentStock > 0) {
            await item.addStockMovement("in", currentStock, "المخزون الأولي", req.user._id, null, null, price, date ? new Date(date) : null);
        }

        try {
            const inventoryCategoryName = "مخزون";
            let inventoryCategory = await CostCategory.findOne({
                name: inventoryCategoryName, organization: req.user.organization,
            });

            if (inventoryCategory && currentStock > 0) {
                const totalCost = price * currentStock;
                const validatedPaidAmount = Math.min(paidAmount, totalCost);

                await Cost.create({
                    category: inventoryCategory._id, subcategory: category,
                    description: `شراء مخزون جديد (رئيسي): ${name}`,
                    amount: totalCost, paidAmount: validatedPaidAmount,
                    currency: "EGP", date: new Date(), status: costStatus,
                    paymentMethod: "cash", vendor: supplier || undefined,
                    createdBy: req.user._id, organization: req.user.organization,
                    notes: `إضافة تلقائية عند إضافة منتج للمخزن الرئيسي (${name})`,
                });
            }
        } catch (costError) {
            Logger.error("فشل في تسجيل التكلفة تلقائياً للمخزن الرئيسي", costError);
        }

        if (item.isLowStock && req.io) {
            try { req.io.notifyInventoryUpdate(item); } catch (ioError) { Logger.error("فشل في إرسال إشعار", ioError); }
        }

        res.status(201).json({ success: true, message: "تم إضافة المنتج للمخزن الرئيسي بنجاح", data: item });
    } catch (error) {
        Logger.error("خطأ في إضافة المنتج للمخزن الرئيسي", { error: error.message, stack: error.stack });

        if (error.code === 11000 && error.keyPattern && (error.keyPattern.name || (error.keyPattern.name && error.keyPattern.organization))) {
            return res.status(400).json({
                success: false,
                message: `المنتج "${req.body.name}" موجود بالفعل في المخزن الرئيسي لهذه المنشأة.`,
                error: "اسم المنتج مكرر في نفس المنشأة",
            });
        }

        res.status(500).json({ success: false, message: "خطأ في إضافة المنتج", error: error.message });
    }
};

export const updateWarehouseItem = async (req, res) => {
    try {
        if (!req.user || !req.user.organization) {
            return res.status(400).json({ success: false, message: "معلومات المستخدم غير صحيحة" });
        }

        const {
            name, category, minStock, maxStock, unit, price, cost,
            supplier, supplierContact, barcode, description, isRawMaterial, expiryDate, isActive,
        } = req.body;

        const item = await WarehouseItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: "المنتج غير موجود" });
        }

        if (name) item.name = name;
        if (category) item.category = category;
        if (minStock !== undefined) item.minStock = minStock;
        if (maxStock !== undefined) item.maxStock = maxStock;
        if (unit) item.unit = unit;
        if (price !== undefined) item.price = price;
        if (cost !== undefined) item.cost = cost;
        if (supplier !== undefined) item.supplier = supplier;
        if (supplierContact !== undefined) item.supplierContact = supplierContact;
        if (barcode !== undefined) item.barcode = barcode;
        if (description !== undefined) item.description = description;
        if (isRawMaterial !== undefined) item.isRawMaterial = isRawMaterial;
        if (expiryDate !== undefined) item.expiryDate = expiryDate;
        if (isActive !== undefined) item.isActive = isActive;

        await item.save();

        if (item.isLowStock && req.io) {
            try { req.io.notifyInventoryUpdate(item); } catch (ioError) { Logger.error("فشل في إرسال إشعار", ioError); }
        }

        res.json({ success: true, message: "تم تحديث المنتج في المخزن الرئيسي بنجاح", data: item });
    } catch (error) {
        Logger.error("خطأ في تحديث المنتج في المخزن الرئيسي", { error: error.message });

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: `المنتج "${req.body.name}" موجود بالفعل في المخزن الرئيسي لهذه المنشأة.`,
                error: "اسم المنتج مكرر في نفس المنشأة",
            });
        }

        res.status(500).json({ success: false, message: "خطأ في تحديث المنتج", error: error.message });
    }
};

export const updateWarehouseStock = async (req, res) => {
    try {
        if (!req.user || !req.user.organization) {
            return res.status(400).json({ success: false, message: "معلومات المستخدم غير صحيحة" });
        }

        const { type, quantity, reason, reference, price, date, costStatus = "paid", paidAmount = 0 } = req.body;

        const item = await WarehouseItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: "المنتج غير موجود" });
        }

        if (!quantity || quantity <= 0) {
            return res.status(400).json({ success: false, message: "الكمية يجب أن تكون أكبر من صفر" });
        }

        if (type === "out" && quantity > item.currentStock) {
            return res.status(400).json({
                success: false,
                message: `المخزون غير كافٍ. المتوفر: ${item.currentStock} ${item.unit}، المطلوب: ${quantity} ${item.unit}`,
            });
        }

        if (!reason || reason.trim() === "") {
            return res.status(400).json({ success: false, message: "السبب مطلوب" });
        }

        await item.addStockMovement(type, quantity, reason, req.user._id, reference, null, price, date ? new Date(date) : null);

        if (type === "in" && quantity > 0 && price) {
            try {
                const inventoryCategoryName = "مخزون";
                const inventoryCategory = await CostCategory.findOne({
                    name: inventoryCategoryName, organization: req.user.organization,
                });

                if (inventoryCategory) {
                    const totalCost = price * quantity;
                    const validatedPaidAmount = Math.min(paidAmount, totalCost);

                    await Cost.create({
                        category: inventoryCategory._id, subcategory: item.category || "",
                        description: `شراء كمية جديدة (رئيسي): ${item.name}`,
                        amount: totalCost, paidAmount: validatedPaidAmount,
                        currency: "EGP", date: date || new Date(),
                        vendor: item.supplier || "", createdBy: req.user._id,
                        organization: req.user.organization, notes: reason || "", status: costStatus,
                    });
                }
            } catch (costError) {
                Logger.error("فشل في تسجيل التكلفة للمخزن الرئيسي", costError);
            }
        }

        try {
            const userLanguage = req.user.preferences?.language || "ar";
            if (item.currentStock === 0) {
                await NotificationService.createInventoryNotification("out_of_stock", item, req.user._id, userLanguage);
            } else if (item.isLowStock) {
                await NotificationService.createInventoryNotification("low_stock", item, req.user._id, userLanguage);
            }
        } catch (notificationError) {
            Logger.error("Failed to create notification:", notificationError);
        }

        if (req.io) {
            try { req.io.notifyInventoryUpdate(item); } catch (ioError) { Logger.error("فشل في إرسال إشعار", ioError); }
        }

        res.json({ success: true, message: "تم تحديث المخزون الرئيسي بنجاح", data: item });
    } catch (error) {
        res.status(500).json({ success: false, message: "خطأ في تحديث المخزون الرئيسي", error: error.message });
    }
};

export const getWarehouseStockMovements = async (req, res) => {
    try {
        if (!req.user || !req.user.organization) {
            return res.status(400).json({ success: false, message: "معلومات المستخدم غير صحيحة" });
        }

        const item = await WarehouseItem.findById(req.params.id).populate("stockMovements.user", "name");
        if (!item) {
            return res.status(404).json({ success: false, message: "المنتج غير موجود" });
        }

        const movements = item.stockMovements
            .map((movement) => movement.toObject())
            .sort((a, b) => {
                const aTime = new Date(a.timestamp || a.date).getTime();
                const bTime = new Date(b.timestamp || b.date).getTime();
                return aTime - bTime;
            });

        let balance = 0;
        const movementsWithBalance = movements.map((movement) => {
            if (movement.type === "in" || movement.type === "transfer_in") {
                balance += movement.quantity;
            } else if (movement.type === "out" || movement.type === "transfer_out") {
                balance -= movement.quantity;
            } else if (movement.type === "adjustment") {
                balance = movement.quantity;
            }
            return { ...movement, balanceAfter: balance };
        });

        res.json({ success: true, data: movementsWithBalance.reverse() });
    } catch (error) {
        res.status(500).json({ success: false, message: "خطأ في جلب حركات المخزون الرئيسي", error: error.message });
    }
};

export const deleteWarehouseItem = async (req, res) => {
    try {
        if (!req.user || !req.user.organization) {
            return res.status(400).json({ success: false, message: "معلومات المستخدم غير صحيحة" });
        }

        const item = await WarehouseItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: "المنتج غير موجود" });
        }

        item.isActive = false;
        await item.save();

        res.json({ success: true, message: "تم حذف المنتج من المخزن الرئيسي بنجاح" });
    } catch (error) {
        res.status(500).json({ success: false, message: "خطأ في حذف المنتج", error: error.message });
    }
};

// ==================== Transfer: Warehouse → Inventory ====================
export const transferToInventory = async (req, res) => {
    try {
        if (!req.user || !req.user.organization) {
            return res.status(400).json({ success: false, message: "معلومات المستخدم غير صحيحة" });
        }

        const { warehouseItemId, inventoryItemId, quantity, price, date, reason } = req.body;

        if (!warehouseItemId || !quantity || quantity <= 0) {
            return res.status(400).json({ success: false, message: "بيانات النقل غير صحيحة" });
        }

        const warehouseItem = await WarehouseItem.findById(warehouseItemId);
        if (!warehouseItem) {
            return res.status(404).json({ success: false, message: "المنتج غير موجود في المخزن الرئيسي" });
        }

        if (quantity > warehouseItem.currentStock) {
            return res.status(400).json({
                success: false,
                message: `المخزون غير كافٍ في المخزن الرئيسي. المتوفر: ${warehouseItem.currentStock} ${warehouseItem.unit}`,
            });
        }

        const transferPrice = price || warehouseItem.price;

        // Deduct from warehouse
        await warehouseItem.addStockMovement(
            "transfer_out", quantity, reason || "نقل إلى المخزون الحالي",
            req.user._id, inventoryItemId || null, "InventoryItem",
            transferPrice, date ? new Date(date) : null
        );

        let inventoryItem = null;

        if (inventoryItemId) {
            // Add to existing inventory item
            inventoryItem = await InventoryItem.findById(inventoryItemId);
            if (!inventoryItem) {
                return res.status(404).json({ success: false, message: "المنتج غير موجود في المخزون الحالي" });
            }

            await inventoryItem.addStockMovement(
                "in", quantity, reason || "تحويل من المخزن الرئيسي",
                req.user._id, warehouseItem._id.toString(), transferPrice,
                date ? new Date(date) : null
            );
        } else {
            // Create new inventory item linked to warehouse
            inventoryItem = await InventoryItem.create({
                name: warehouseItem.name,
                category: warehouseItem.category,
                currentStock: 0,
                minStock: warehouseItem.minStock,
                maxStock: warehouseItem.maxStock,
                unit: warehouseItem.unit,
                price: transferPrice,
                cost: warehouseItem.cost || 0,
                supplier: warehouseItem.supplier,
                barcode: warehouseItem.barcode,
                description: warehouseItem.description,
                isRawMaterial: warehouseItem.isRawMaterial,
                warehouseItem: warehouseItem._id,
                organization: req.user.organization,
            });

            await inventoryItem.addStockMovement(
                "in", quantity, reason || "تحويل من المخزن الرئيسي",
                req.user._id, warehouseItem._id.toString(), transferPrice,
                date ? new Date(date) : null
            );
        }

        // Update warehouse transfer_out reference for new inventory items
        if (!inventoryItemId && inventoryItem) {
            const lastMovement = warehouseItem.stockMovements[warehouseItem.stockMovements.length - 1];
            if (lastMovement && lastMovement.type === "transfer_out") {
                lastMovement.reference = inventoryItem._id.toString();
                await warehouseItem.save();
            }
        }

        // Emit socket events
        if (req.io) {
            try {
                req.io.notifyInventoryUpdate(warehouseItem);
                req.io.notifyInventoryUpdate(inventoryItem);
            } catch (ioError) {
                Logger.error("فشل في إرسال إشعار", ioError);
            }
        }

        res.json({
            success: true,
            message: "تم النقل إلى المخزون الحالي بنجاح",
            data: { warehouseItem, inventoryItem },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "خطأ في النقل إلى المخزون الحالي", error: error.message });
    }
};

// ==================== Return: Inventory → Warehouse ====================
export const returnToWarehouse = async (req, res) => {
    try {
        if (!req.user || !req.user.organization) {
            return res.status(400).json({ success: false, message: "معلومات المستخدم غير صحيحة" });
        }

        const { inventoryItemId, warehouseItemId, quantity, price, date, reason } = req.body;

        if (!inventoryItemId || !warehouseItemId || !quantity || quantity <= 0) {
            return res.status(400).json({ success: false, message: "بيانات الإرجاع غير صحيحة" });
        }

        const inventoryItem = await InventoryItem.findById(inventoryItemId);
        if (!inventoryItem) {
            return res.status(404).json({ success: false, message: "المنتج غير موجود في المخزون الحالي" });
        }

        if (quantity > inventoryItem.currentStock) {
            return res.status(400).json({
                success: false,
                message: `المخزون غير كافٍ للإرجاع. المتوفر: ${inventoryItem.currentStock} ${inventoryItem.unit}`,
            });
        }

        const warehouseItem = await WarehouseItem.findById(warehouseItemId);
        if (!warehouseItem) {
            return res.status(404).json({ success: false, message: "المنتج غير موجود في المخزن الرئيسي" });
        }

        const returnPrice = price || inventoryItem.price;

        // Deduct from inventory
        await inventoryItem.addStockMovement(
            "out", quantity, reason || "إرجاع إلى المخزن الرئيسي",
            req.user._id, warehouseItem._id.toString(), returnPrice,
            date ? new Date(date) : null
        );

        // Add back to warehouse
        await warehouseItem.addStockMovement(
            "transfer_in", quantity, reason || "إرجاع من المخزون الحالي",
            req.user._id, inventoryItem._id.toString(), null, returnPrice,
            date ? new Date(date) : null
        );

        if (req.io) {
            try {
                req.io.notifyInventoryUpdate(warehouseItem);
                req.io.notifyInventoryUpdate(inventoryItem);
            } catch (ioError) {
                Logger.error("فشل في إرسال إشعار", ioError);
            }
        }

        res.json({
            success: true,
            message: "تم الإرجاع إلى المخزن الرئيسي بنجاح",
            data: { warehouseItem, inventoryItem },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "خطأ في الإرجاع إلى المخزن الرئيسي", error: error.message });
    }
};

// ==================== Delete stock movement ====================
export const deleteWarehouseStockMovement = async (req, res) => {
    try {
        if (!req.user || !req.user.organization) {
            return res.status(400).json({ success: false, message: "معلومات المستخدم غير صحيحة" });
        }

        const { id, movementId } = req.params;
        const item = await WarehouseItem.findById(id);

        if (!item) {
            return res.status(404).json({ success: false, message: "المنتج غير موجود" });
        }

        const movementIndex = item.stockMovements.findIndex(m => m._id.toString() === movementId);
        if (movementIndex === -1) {
            return res.status(404).json({ success: false, message: "الحركة غير موجودة" });
        }

        const movementToDelete = item.stockMovements[movementIndex];

        if (movementToDelete.reason && (movementToDelete.reason.includes("طلب رقم") || movementToDelete.type === "transfer_out" || movementToDelete.type === "transfer_in")) {
            return res.status(403).json({
                success: false,
                message: "لا يمكن حذف حركات النقل أو الحركات المرتبطة بالطلبات.",
            });
        }

        const sortedMovements = [...item.stockMovements].sort((a, b) => {
            const aTime = new Date(a.timestamp || a.date).getTime();
            const bTime = new Date(b.timestamp || b.date).getTime();
            return aTime - bTime;
        });

        let simulatedStock = 0;
        let canDelete = true;

        for (const movement of sortedMovements) {
            if (movement._id.toString() === movementId) continue;

            if (movement.type === "in" || movement.type === "transfer_in") {
                simulatedStock += movement.quantity;
            } else if (movement.type === "out" || movement.type === "transfer_out") {
                simulatedStock -= movement.quantity;
                if (simulatedStock < 0) {
                    canDelete = false;
                    break;
                }
            } else if (movement.type === "adjustment") {
                simulatedStock = movement.quantity;
            }
        }

        if (!canDelete) {
            return res.status(400).json({ success: false, message: "لا يمكن حذف هذه الحركة لأنها ستؤدي إلى رصيد سالب في حركات لاحقة" });
        }

        item.stockMovements.splice(movementIndex, 1);

        item.currentStock = 0;
        const recalcSorted = [...item.stockMovements].sort((a, b) => {
            const aTime = new Date(a.timestamp || a.date).getTime();
            const bTime = new Date(b.timestamp || b.date).getTime();
            return aTime - bTime;
        });

        for (const movement of recalcSorted) {
            if (movement.type === "in" || movement.type === "transfer_in") {
                item.currentStock += movement.quantity;
            } else if (movement.type === "out" || movement.type === "transfer_out") {
                item.currentStock -= movement.quantity;
            } else if (movement.type === "adjustment") {
                item.currentStock = movement.quantity;
            }
        }

        await item.save();

        if (req.io) {
            try { req.io.notifyInventoryUpdate(item); } catch (ioError) { Logger.error("فشل في إرسال إشعار", ioError); }
        }

        res.json({ success: true, message: "تم حذف الحركة بنجاح", data: item });
    } catch (error) {
        Logger.error("خطأ في حذف الحركة", error);
        res.status(500).json({ success: false, message: "خطأ في حذف الحركة", error: error.message });
    }
};

// ==================== Update stock movement ====================
export const updateWarehouseStockMovement = async (req, res) => {
    try {
        if (!req.user || !req.user.organization) {
            return res.status(400).json({ success: false, message: "معلومات المستخدم غير صحيحة" });
        }

        const { id, movementId } = req.params;
        const { quantity, price, reason, date } = req.body;

        const item = await WarehouseItem.findById(id);
        if (!item) {
            return res.status(404).json({ success: false, message: "المنتج غير موجود" });
        }

        const movement = item.stockMovements.find(m => m._id.toString() === movementId);
        if (!movement) {
            return res.status(404).json({ success: false, message: "الحركة غير موجودة" });
        }

        // Validate quantity
        if (quantity !== undefined && quantity <= 0) {
            return res.status(400).json({ success: false, message: "الكمية يجب أن تكون أكبر من صفر" });
        }

        const oldQuantity = movement.quantity;

        if (quantity !== undefined) movement.quantity = quantity;
        if (price !== undefined) movement.price = price;
        if (reason !== undefined) movement.reason = reason;
        if (date !== undefined) movement.timestamp = new Date(date);

        const sortedMovements = [...item.stockMovements].sort((a, b) => {
            const aTime = new Date(a.timestamp || a.date).getTime();
            const bTime = new Date(b.timestamp || b.date).getTime();
            return aTime - bTime;
        });

        let simulatedStock = 0;
        let isValid = true;

        for (const mov of sortedMovements) {
            if (mov.type === "in" || mov.type === "transfer_in") {
                simulatedStock += mov.quantity;
            } else if (mov.type === "out" || mov.type === "transfer_out") {
                simulatedStock -= mov.quantity;
                if (simulatedStock < 0) { isValid = false; break; }
            } else if (mov.type === "adjustment") {
                simulatedStock = mov.quantity;
            }
        }

        if (!isValid) {
            movement.quantity = oldQuantity;
            return res.status(400).json({ success: false, message: "التعديل سيؤدي إلى رصيد سالب في حركات لاحقة" });
        }

        item.currentStock = simulatedStock;
        await item.save();

        // Sync linked inventory movement for transfer/return
        if ((movement.type === "transfer_out" || movement.type === "transfer_in") && movement.reference) {
            try {
                const linkedItem = await InventoryItem.findById(movement.reference);
                if (linkedItem) {
                    const counterpartType = movement.type === "transfer_out" ? "in" : "out";
                    const movementTime = new Date(movement.timestamp || movement.date).getTime();
                    // Find the counterpart movement by matching type + cross-reference + closest timestamp
                    let counterpartMovement = null;
                    let closestDiff = Infinity;
                    for (const m of linkedItem.stockMovements) {
                        if (m.type === counterpartType && m.reference && m.reference.toString() === item._id.toString()) {
                            const mTime = new Date(m.timestamp || m.date).getTime();
                            const diff = Math.abs(mTime - movementTime);
                            if (diff < closestDiff) {
                                closestDiff = diff;
                                counterpartMovement = m;
                            }
                        }
                    }
                    if (counterpartMovement) {
                        const oldCounterpartQty = counterpartMovement.quantity;
                        if (quantity !== undefined) counterpartMovement.quantity = quantity;
                        if (price !== undefined) counterpartMovement.price = price;
                        if (reason !== undefined) counterpartMovement.reason = reason;
                        if (date !== undefined) counterpartMovement.timestamp = new Date(date);

                        const sortedInv = [...linkedItem.stockMovements].sort((a, b) => {
                            const aTime = new Date(a.timestamp || a.date).getTime();
                            const bTime = new Date(b.timestamp || b.date).getTime();
                            return aTime - bTime;
                        });

                        let invSimulated = 0;
                        let invValid = true;
                        for (const m of sortedInv) {
                            if (m.type === "in" || m.type === "transfer_in") {
                                invSimulated += m.quantity;
                            } else if (m.type === "out" || m.type === "transfer_out") {
                                invSimulated -= m.quantity;
                                if (invSimulated < 0) { invValid = false; break; }
                            } else if (m.type === "adjustment") {
                                invSimulated = m.quantity;
                            }
                        }

                        if (invValid) {
                            linkedItem.currentStock = invSimulated;
                            await linkedItem.save();
                            if (req.io) {
                                try { req.io.notifyInventoryUpdate(linkedItem); } catch (ioError) { Logger.error("فشل في إرسال إشعار للمخزون المرتبط", ioError); }
                            }
                        } else {
                            counterpartMovement.quantity = oldCounterpartQty;
                            Logger.warn("لم يتم تحديث الحركة المرتبطة في المخزون لتجنب رصيد سالب");
                        }
                    }
                }
            } catch (linkError) {
                Logger.error("خطأ في تحديث الحركة المرتبطة في المخزون", linkError);
            }
        }

        if (req.io) {
            try { req.io.notifyInventoryUpdate(item); } catch (ioError) { Logger.error("فشل في إرسال إشعار", ioError); }
        }

        res.json({ success: true, message: "تم تحديث الحركة بنجاح", data: item });
    } catch (error) {
        Logger.error("خطأ في تحديث الحركة", error);
        res.status(500).json({ success: false, message: "خطأ في تحديث الحركة", error: error.message });
    }
};
