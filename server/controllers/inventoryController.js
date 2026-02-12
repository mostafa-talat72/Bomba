import InventoryItem from "../models/InventoryItem.js";
import Logger from "../middleware/logger.js";
import NotificationService from "../services/notificationService.js";
import Cost from "../models/Cost.js";
import CostCategory from "../models/CostCategory.js";

// @desc    Get all inventory items
// @route   GET /api/inventory
// @access  Private
export const getInventoryItems = async (req, res) => {
    try {
        // Validate user organization
        if (!req.user || !req.user.organization) {
            return res.status(400).json({
                success: false,
                message: "معلومات المستخدم غير صحيحة",
            });
        }

        const { category, lowStock, page = 1, limit = 10, search } = req.query;

        const query = { isActive: true };

        if (category) query.category = category;
        if (lowStock === "true") {
            query.$expr = { $lte: ["$currentStock", "$minStock"] };
        }
        if (search) {
            query.name = { $regex: search, $options: "i" };
        }
        query.organization = req.user.organization;

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
        // Validate user organization
        if (!req.user || !req.user.organization) {
            return res.status(400).json({
                success: false,
                message: "معلومات المستخدم غير صحيحة",
            });
        }

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
            costStatus = "pending",
            paidAmount = 0,
            date,
        } = req.body;

        // Validate required fields
        if (!name || !category || !unit || !price || !minStock) {
            return res.status(400).json({
                success: false,
                message: "جميع الحقول المطلوبة يجب أن تكون موجودة",
            });
        }

        // Validate user organization
        if (!req.user || !req.user.organization) {
            return res.status(400).json({
                success: false,
                message: "معلومات المستخدم غير صحيحة",
            });
        }

        // دائماً أنشئ المنتج بكمية 0
        const item = await InventoryItem.create({
            name,
            category,
            currentStock: 0,
            minStock,
            maxStock,
            unit,
            price,
            cost,
            supplier,
            supplierContact,
            barcode,
            description,
            isRawMaterial: Boolean(isRawMaterial),
            recipe,
            expiryDate,
            organization: req.user.organization,
        });

        // إذا كان هناك كمية أولية، أضفها كحركة مخزون
        if (currentStock > 0) {
            await item.addStockMovement(
                "in",
                currentStock,
                "المخزون الأولي",
                req.user._id,
                null,
                price,
                date ? new Date(date) : null
            );
        }

        // إضافة سجل تكلفة تلقائي عند إضافة منتج جديد
        try {
            // Find or create an inventory cost category
            const inventoryCategoryName = "مخزون";
            let inventoryCategory = await CostCategory.findOne({
                name: inventoryCategoryName,
                organization: req.user.organization,
            });

            // If no inventory category exists, skip cost creation
            if (inventoryCategory && currentStock > 0) {
                const totalCost = price * currentStock;
                // التأكد من أن المبلغ المدفوع لا يتجاوز المبلغ الكلي
                const validatedPaidAmount = Math.min(paidAmount, totalCost);

                await Cost.create({
                    category: inventoryCategory._id,
                    subcategory: category,
                    description: `شراء مخزون جديد: ${name}`,
                    amount: totalCost,
                    paidAmount: validatedPaidAmount,
                    currency: "EGP",
                    date: new Date(),
                    status: costStatus,
                    paymentMethod: "cash",
                    vendor: supplier || undefined,
                    createdBy: req.user._id,
                    organization: req.user.organization,
                    notes: `إضافة تلقائية عند إضافة منتج جديد للمخزون (${name})`,
                });
            }
        } catch (costError) {
            Logger.error(
                "فشل في تسجيل التكلفة تلقائياً عند إضافة منتج للمخزون",
                costError
            );
        }

        // Check for low stock and notify
        if (item.isLowStock && req.io) {
            try {
                req.io.notifyInventoryUpdate(item);
            } catch (ioError) {
                Logger.error("فشل في إرسال إشعار تحديث المخزون", {
                    error: ioError.message,
                });
            }
        }

        res.status(201).json({
            success: true,
            message: "تم إضافة المنتج بنجاح",
            data: item,
        });
    } catch (error) {
        Logger.error("خطأ في إضافة المنتج", {
            error: error.message,
            stack: error.stack,
        });

        // معالجة خطأ تكرار الاسم
        if (error.code === 11000) {
            if (
                error.keyPattern &&
                (error.keyPattern.name ||
                    (error.keyPattern.name && error.keyPattern.organization))
            ) {
                return res.status(400).json({
                    success: false,
                    message: `المنتج "${name}" موجود بالفعل في هذه المنشأة. يمكنك إضافة كمية جديدة للمنتج الموجود بدلاً من إنشاء منتج جديد.`,
                    error: "اسم المنتج مكرر في نفس المنشأة",
                });
            }
        }

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
        // Validate user organization
        if (!req.user || !req.user.organization) {
            return res.status(400).json({
                success: false,
                message: "معلومات المستخدم غير صحيحة",
            });
        }

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
            try {
                req.io.notifyInventoryUpdate(item);
            } catch (ioError) {
                Logger.error("فشل في إرسال إشعار تحديث المخزون", {
                    error: ioError.message,
                });
            }
        }

        res.json({
            success: true,
            message: "تم تحديث المنتج بنجاح",
            data: item,
        });
    } catch (error) {
        Logger.error("خطأ في تحديث المنتج", {
            error: error.message,
            stack: error.stack,
        });

        // معالجة خطأ تكرار الاسم
        if (error.code === 11000) {
            if (
                error.keyPattern &&
                (error.keyPattern.name ||
                    (error.keyPattern.name && error.keyPattern.organization))
            ) {
                return res.status(400).json({
                    success: false,
                    message: `المنتج "${name}" موجود بالفعل في هذه المنشأة.`,
                    error: "اسم المنتج مكرر في نفس المنشأة",
                });
            }
        }

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
        // Validate user organization
        if (!req.user || !req.user.organization) {
            return res.status(400).json({
                success: false,
                message: "معلومات المستخدم غير صحيحة",
            });
        }

        const {
            type,
            quantity,
            reason,
            reference,
            price,
            supplier,
            date,
            costStatus = "paid",
            paidAmount = 0,
        } = req.body;

        const item = await InventoryItem.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "المنتج غير موجود",
            });
        }

        // Validation for quantity
        if (!quantity || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: "الكمية يجب أن تكون أكبر من صفر",
            });
        }

        // Validation for 'out' type - check if enough stock available
        if (type === 'out') {
            if (quantity > item.currentStock) {
                return res.status(400).json({
                    success: false,
                    message: `المخزون غير كافٍ. المتوفر: ${item.currentStock} ${item.unit}، المطلوب: ${quantity} ${item.unit}`,
                });
            }

            // Check if there are enough batches with prices for FIFO calculation
            const inMovements = item.stockMovements
                .filter(m => m.type === 'in' && m.price)
                .sort((a, b) => {
                    const aTime = new Date(a.timestamp || a.date).getTime();
                    const bTime = new Date(b.timestamp || b.date).getTime();
                    return aTime - bTime;
                });

            let availableQty = 0;
            for (const inMov of inMovements) {
                availableQty += inMov.quantity;
            }

            if (availableQty < quantity && !price) {
                return res.status(400).json({
                    success: false,
                    message: "لا توجد دفعات شراء كافية لحساب السعر. يرجى إدخال السعر يدوياً",
                });
            }
        }

        // Validation for 'adjustment' type
        if (type === 'adjustment') {
            if (quantity < 0) {
                return res.status(400).json({
                    success: false,
                    message: "كمية التعديل يجب أن تكون موجبة أو صفر",
                });
            }
        }

        // Validation for price
        if (type === 'in' && price !== undefined && price < 0) {
            return res.status(400).json({
                success: false,
                message: "السعر يجب أن يكون موجباً",
            });
        }

        // Validation for reason
        if (!reason || reason.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "السبب مطلوب",
            });
        }

        // Calculate price for 'out' or 'adjustment' movements if not provided
        let finalPrice = price;
        let finalTotalCost = null;
        
        if ((type === 'out' || type === 'adjustment') && !price) {
            // Get the date of this movement
            const movementDate = date ? new Date(date) : new Date();
            
            // Get all movements sorted by timestamp (oldest first)
            const allMovements = item.stockMovements
                .map(m => ({
                    type: m.type,
                    quantity: m.quantity,
                    price: m.price,
                    timestamp: new Date(m.timestamp || m.date)
                }))
                .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            
            // Build batches with remaining quantities (FIFO simulation)
            const batches = [];
            
            for (const movement of allMovements) {
                // Only process movements before the current movement date
                if (movement.timestamp >= movementDate) break;
                
                if (movement.type === 'in' && movement.price) {
                    // Add new batch
                    batches.push({
                        quantity: movement.quantity,
                        price: movement.price,
                        remaining: movement.quantity
                    });
                } else if (movement.type === 'out') {
                    // Deduct from oldest batches first (FIFO)
                    let toDeduct = movement.quantity;
                    
                    for (const batch of batches) {
                        if (toDeduct <= 0) break;
                        
                        const deductFromBatch = Math.min(batch.remaining, toDeduct);
                        batch.remaining -= deductFromBatch;
                        toDeduct -= deductFromBatch;
                    }
                } else if (movement.type === 'adjustment') {
                    // For adjustment, recalculate all batches proportionally
                    const totalRemaining = batches.reduce((sum, b) => sum + b.remaining, 0);
                    
                    if (totalRemaining > 0) {
                        const ratio = movement.quantity / totalRemaining;
                        batches.forEach(batch => {
                            batch.remaining = batch.remaining * ratio;
                        });
                    }
                }
            }
            
            // Now calculate cost for current deduction using remaining quantities
            let remainingToDeduct = Math.abs(quantity);
            let totalCost = 0;
            
            for (const batch of batches) {
                if (remainingToDeduct <= 0) break;
                if (batch.remaining <= 0) continue;
                
                const qtyFromThisBatch = Math.min(remainingToDeduct, batch.remaining);
                totalCost += qtyFromThisBatch * batch.price;
                remainingToDeduct -= qtyFromThisBatch;
            }
            
            // CRITICAL: Calculate totalCost FIRST (actual FIFO sum)
            finalTotalCost = Math.round(totalCost * 100) / 100;
            
            // THEN calculate price = totalCost / quantity
            if (Math.abs(quantity) > 0 && finalTotalCost > 0) {
                finalPrice = Math.round((finalTotalCost / Math.abs(quantity)) * 100) / 100;
            }
        } else if (price) {
            // If price is provided, calculate total cost = price × quantity
            finalTotalCost = Math.round(price * Math.abs(quantity) * 100) / 100;
        } else if (type === 'in' && price) {
            // For 'in' movements with price, calculate totalCost
            finalTotalCost = Math.round(price * quantity * 100) / 100;
        }

        // Add stock movement with calculated or provided price and custom timestamp
        await item.addStockMovement(
            type,
            quantity,
            reason,
            req.user._id,
            reference,
            finalPrice,
            date ? new Date(date) : null,
            finalTotalCost
        );

        // Update item price to be from the most recent 'in' movement by date
        if (type === 'in' && finalPrice) {
            const inMovements = item.stockMovements
                .filter(m => m.type === 'in' && m.price)
                .sort((a, b) => {
                    const aTime = new Date(a.timestamp || a.date).getTime();
                    const bTime = new Date(b.timestamp || b.date).getTime();
                    return bTime - aTime; // Descending: newest first
                });
            
            if (inMovements.length > 0) {
                item.price = inMovements[0].price;
            }
        }

        // Update reasons: oldest movement should be "المخزون الأولي", others "شراء مخزون جديد"
        if (type === 'in') {
            const inMovements = item.stockMovements
                .filter(m => m.type === 'in')
                .sort((a, b) => {
                    const aTime = new Date(a.timestamp || a.date).getTime();
                    const bTime = new Date(b.timestamp || b.date).getTime();
                    return aTime - bTime; // Ascending: oldest first
                });
            
            // Update all movements
            inMovements.forEach((movement, index) => {
                if (index === 0) {
                    // Oldest movement = المخزون الأولي
                    if (movement.reason === "شراء مخزون جديد" || movement.reason === "المخزون الأولي") {
                        movement.reason = "المخزون الأولي";
                    }
                } else {
                    // All other movements = شراء مخزون جديد
                    if (movement.reason === "المخزون الأولي") {
                        movement.reason = "شراء مخزون جديد";
                    }
                }
            });
        }

        await item.save();

        // تسجيل تكلفة الشراء إذا كانت إضافة للمخزون (شراء)
        if (type === "in" && quantity > 0 && finalPrice) {
            try {
                // Find inventory cost category
                const inventoryCategoryName = "مخزون";
                const inventoryCategory = await CostCategory.findOne({
                    name: inventoryCategoryName,
                    organization: req.user.organization,
                });

                // Only create cost if category exists
                if (inventoryCategory) {
                    const totalCost = finalPrice * quantity;
                    // التأكد من أن المبلغ المدفوع لا يتجاوز المبلغ الكلي
                    const validatedPaidAmount = Math.min(paidAmount, totalCost);

                    await Cost.create({
                        category: inventoryCategory._id,
                        subcategory: item.category,
                        description: `شراء كمية جديدة: ${item.name}`,
                        amount: totalCost,
                        paidAmount: validatedPaidAmount,
                        currency: "EGP",
                        date: date || new Date(),
                        vendor: supplier || item.supplier || "",
                        createdBy: req.user._id,
                        organization: req.user.organization,
                        notes: reason || "",
                        status: costStatus,
                    });
                }
            } catch (costError) {
                Logger.error(
                    "فشل في تسجيل التكلفة تلقائياً عند إضافة كمية للمخزون",
                    costError
                );
            }
        }

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
            try {
                req.io.notifyInventoryUpdate(item);
            } catch (ioError) {
                Logger.error("فشل في إرسال إشعار تحديث المخزون", {
                    error: ioError.message,
                });
            }
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
        // Validate user organization
        if (!req.user || !req.user.organization) {
            return res.status(400).json({
                success: false,
                message: "معلومات المستخدم غير صحيحة",
            });
        }

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
        // Validate user organization
        if (!req.user || !req.user.organization) {
            return res.status(400).json({
                success: false,
                message: "معلومات المستخدم غير صحيحة",
            });
        }

        const item = await InventoryItem.findById(req.params.id)
            .populate("stockMovements.user", "name");

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "المنتج غير موجود",
            });
        }

        // Sort movements by timestamp (oldest first for calculation)
        const movements = item.stockMovements
            .map((movement) => movement.toObject())
            .sort((a, b) => {
                const aTime = new Date(a.timestamp || a.date).getTime();
                const bTime = new Date(b.timestamp || b.date).getTime();
                return aTime - bTime; // Ascending order (oldest first)
            });
        
        // Calculate balance after each movement (forward from oldest)
        let balance = 0;
        const movementsWithBalance = movements.map((movement) => {
            // Calculate balance after this movement
            if (movement.type === 'in') {
                balance += movement.quantity;
            } else if (movement.type === 'out') {
                balance -= movement.quantity;
            } else if (movement.type === 'adjustment') {
                balance = movement.quantity;
            }
            
            return {
                ...movement,
                balanceAfter: balance
            };
        });

        res.json({
            success: true,
            data: movementsWithBalance.reverse(), // Reverse to show newest first
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
        // Validate user organization
        if (!req.user || !req.user.organization) {
            return res.status(400).json({
                success: false,
                message: "معلومات المستخدم غير صحيحة",
            });
        }

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

// @desc    Delete stock movement
// @route   DELETE /api/inventory/:id/movements/:movementId
// @access  Private
export const deleteStockMovement = async (req, res) => {
    try {
        if (!req.user || !req.user.organization) {
            return res.status(400).json({
                success: false,
                message: "معلومات المستخدم غير صحيحة",
            });
        }

        const { id, movementId } = req.params;
        const item = await InventoryItem.findById(id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "المنتج غير موجود",
            });
        }

        // Find the movement to delete
        const movementIndex = item.stockMovements.findIndex(
            m => m._id.toString() === movementId
        );

        if (movementIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "الحركة غير موجودة",
            });
        }

        const movementToDelete = item.stockMovements[movementIndex];

        // منع حذف الحركات المرتبطة بالطلبات
        if (movementToDelete.reason && movementToDelete.reason.includes('طلب رقم')) {
            return res.status(403).json({
                success: false,
                message: "لا يمكن حذف الحركات المرتبطة بالطلبات. يجب حذف الطلب نفسه.",
            });
        }

        // Sort movements by timestamp to check if deletion is valid
        const sortedMovements = [...item.stockMovements].sort((a, b) => {
            const aTime = new Date(a.timestamp || a.date).getTime();
            const bTime = new Date(b.timestamp || b.date).getTime();
            return aTime - bTime;
        });

        // Simulate deletion and recalculate stock
        let simulatedStock = 0;
        let canDelete = true;
        let errorMessage = "";

        for (const movement of sortedMovements) {
            // Skip the movement we want to delete
            if (movement._id.toString() === movementId) {
                continue;
            }

            if (movement.type === 'in') {
                simulatedStock += movement.quantity;
            } else if (movement.type === 'out') {
                simulatedStock -= movement.quantity;
                if (simulatedStock < 0) {
                    canDelete = false;
                    errorMessage = "لا يمكن حذف هذه الحركة لأنها ستؤدي إلى رصيد سالب في حركات لاحقة";
                    break;
                }
            } else if (movement.type === 'adjustment') {
                simulatedStock = movement.quantity;
            }
        }

        if (!canDelete) {
            return res.status(400).json({
                success: false,
                message: errorMessage,
            });
        }

        // Remove the movement
        item.stockMovements.splice(movementIndex, 1);

        // Recalculate current stock
        item.currentStock = 0;
        const recalcSorted = [...item.stockMovements].sort((a, b) => {
            const aTime = new Date(a.timestamp || a.date).getTime();
            const bTime = new Date(b.timestamp || b.date).getTime();
            return aTime - bTime;
        });

        for (const movement of recalcSorted) {
            if (movement.type === 'in') {
                item.currentStock += movement.quantity;
            } else if (movement.type === 'out') {
                item.currentStock -= movement.quantity;
            } else if (movement.type === 'adjustment') {
                item.currentStock = movement.quantity;
            }
        }

        // Update price to be from most recent 'in' movement
        const inMovements = item.stockMovements
            .filter(m => m.type === 'in' && m.price)
            .sort((a, b) => {
                const aTime = new Date(a.timestamp || a.date).getTime();
                const bTime = new Date(b.timestamp || b.date).getTime();
                return bTime - aTime;
            });

        if (inMovements.length > 0) {
            item.price = inMovements[0].price;
        }

        // Update reasons (oldest = المخزون الأولي, others = شراء مخزون جديد)
        const inMovementsSorted = item.stockMovements
            .filter(m => m.type === 'in')
            .sort((a, b) => {
                const aTime = new Date(a.timestamp || a.date).getTime();
                const bTime = new Date(b.timestamp || b.date).getTime();
                return aTime - bTime;
            });

        inMovementsSorted.forEach((movement, index) => {
            if (index === 0) {
                if (movement.reason === "شراء مخزون جديد" || movement.reason === "المخزون الأولي") {
                    movement.reason = "المخزون الأولي";
                }
            } else {
                if (movement.reason === "المخزون الأولي") {
                    movement.reason = "شراء مخزون جديد";
                }
            }
        });

        await item.save();

        // Emit Socket.IO event for inventory update
        if (req.io) {
            try {
                req.io.notifyInventoryUpdate(item);
            } catch (ioError) {
                Logger.error("فشل في إرسال إشعار تحديث المخزون", {
                    error: ioError.message,
                });
            }
        }

        res.json({
            success: true,
            message: "تم حذف الحركة بنجاح",
            data: item,
        });
    } catch (error) {
        Logger.error("خطأ في حذف الحركة", error);
        res.status(500).json({
            success: false,
            message: "خطأ في حذف الحركة",
            error: error.message,
        });
    }
};

// @desc    Update stock movement
// @route   PUT /api/inventory/:id/movements/:movementId
// @access  Private
export const updateStockMovement = async (req, res) => {
    try {
        if (!req.user || !req.user.organization) {
            return res.status(400).json({
                success: false,
                message: "معلومات المستخدم غير صحيحة",
            });
        }

        const { id, movementId } = req.params;
        const { quantity, price, reason, date } = req.body;

        const item = await InventoryItem.findById(id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "المنتج غير موجود",
            });
        }

        // Find the movement to update
        const movement = item.stockMovements.find(
            m => m._id.toString() === movementId
        );

        if (!movement) {
            return res.status(404).json({
                success: false,
                message: "الحركة غير موجودة",
            });
        }

        // منع تعديل الحركات المرتبطة بالطلبات
        if (movement.reason && movement.reason.includes('طلب رقم')) {
            return res.status(403).json({
                success: false,
                message: "لا يمكن تعديل الحركات المرتبطة بالطلبات. يجب تعديل الطلب نفسه.",
            });
        }

        // Validate quantity
        if (quantity !== undefined && quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: "الكمية يجب أن تكون أكبر من صفر",
            });
        }

        // Validate price for 'in' movements
        if (movement.type === 'in' && price !== undefined && price < 0) {
            return res.status(400).json({
                success: false,
                message: "السعر يجب أن يكون موجباً",
            });
        }

        // Store old values for simulation
        const oldQuantity = movement.quantity;
        const oldType = movement.type;

        // Update movement fields
        if (quantity !== undefined) movement.quantity = quantity;
        if (price !== undefined) {
            movement.price = price;
            // Recalculate totalCost when price changes
            if (movement.type === 'in') {
                movement.totalCost = Math.round(price * quantity * 100) / 100;
            }
        }
        if (reason !== undefined) movement.reason = reason;
        if (date !== undefined) movement.timestamp = new Date(date);
        
        // Recalculate totalCost for 'out' movements using FIFO
        if (movement.type === 'out' && quantity !== undefined) {
            const movementDate = movement.timestamp || new Date();
            
            // Get all movements sorted by timestamp (oldest first)
            const allMovements = item.stockMovements
                .map(m => ({
                    _id: m._id.toString(),
                    type: m.type,
                    quantity: m.quantity,
                    price: m.price,
                    timestamp: new Date(m.timestamp || m.date)
                }))
                .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            
            // Build batches with remaining quantities (FIFO simulation)
            const batches = [];
            
            for (const mov of allMovements) {
                // Skip the movement we're editing
                if (mov._id === movementId) continue;
                
                // Only process movements before the current movement date
                if (mov.timestamp >= movementDate) break;
                
                if (mov.type === 'in' && mov.price) {
                    // Add new batch
                    batches.push({
                        quantity: mov.quantity,
                        price: mov.price,
                        remaining: mov.quantity
                    });
                } else if (mov.type === 'out') {
                    // Deduct from oldest batches first (FIFO)
                    let toDeduct = mov.quantity;
                    
                    for (const batch of batches) {
                        if (toDeduct <= 0) break;
                        
                        const deductFromBatch = Math.min(batch.remaining, toDeduct);
                        batch.remaining -= deductFromBatch;
                        toDeduct -= deductFromBatch;
                    }
                } else if (mov.type === 'adjustment') {
                    // For adjustment, recalculate all batches proportionally
                    const totalRemaining = batches.reduce((sum, b) => sum + b.remaining, 0);
                    
                    if (totalRemaining > 0) {
                        const ratio = mov.quantity / totalRemaining;
                        batches.forEach(batch => {
                            batch.remaining = batch.remaining * ratio;
                        });
                    }
                }
            }
            
            // Now calculate cost for current deduction using remaining quantities
            let remainingToDeduct = Math.abs(quantity);
            let totalCost = 0;
            
            for (const batch of batches) {
                if (remainingToDeduct <= 0) break;
                if (batch.remaining <= 0) continue;
                
                const qtyFromThisBatch = Math.min(remainingToDeduct, batch.remaining);
                totalCost += qtyFromThisBatch * batch.price;
                remainingToDeduct -= qtyFromThisBatch;
            }
            
            // Calculate totalCost FIRST
            movement.totalCost = Math.round(totalCost * 100) / 100;
            
            // THEN calculate price = totalCost / quantity
            if (Math.abs(quantity) > 0 && movement.totalCost > 0) {
                movement.price = Math.round((movement.totalCost / Math.abs(quantity)) * 100) / 100;
            }
        }

        // Sort movements by timestamp and simulate to check validity
        const sortedMovements = [...item.stockMovements].sort((a, b) => {
            const aTime = new Date(a.timestamp || a.date).getTime();
            const bTime = new Date(b.timestamp || b.date).getTime();
            return aTime - bTime;
        });

        let simulatedStock = 0;
        let isValid = true;
        let errorMessage = "";

        for (const mov of sortedMovements) {
            if (mov.type === 'in') {
                simulatedStock += mov.quantity;
            } else if (mov.type === 'out') {
                simulatedStock -= mov.quantity;
                if (simulatedStock < 0) {
                    isValid = false;
                    errorMessage = "التعديل سيؤدي إلى رصيد سالب في حركات لاحقة";
                    break;
                }
            } else if (mov.type === 'adjustment') {
                simulatedStock = mov.quantity;
            }
        }

        if (!isValid) {
            // Restore old values
            movement.quantity = oldQuantity;
            return res.status(400).json({
                success: false,
                message: errorMessage,
            });
        }

        // Recalculate current stock
        item.currentStock = simulatedStock;

        // Update price to be from most recent 'in' movement
        if (movement.type === 'in' && price !== undefined) {
            const inMovements = item.stockMovements
                .filter(m => m.type === 'in' && m.price)
                .sort((a, b) => {
                    const aTime = new Date(a.timestamp || a.date).getTime();
                    const bTime = new Date(b.timestamp || b.date).getTime();
                    return bTime - aTime;
                });

            if (inMovements.length > 0) {
                item.price = inMovements[0].price;
            }
        }

        // Update reasons (oldest = المخزون الأولي, others = شراء مخزون جديد)
        const inMovementsSorted = item.stockMovements
            .filter(m => m.type === 'in')
            .sort((a, b) => {
                const aTime = new Date(a.timestamp || a.date).getTime();
                const bTime = new Date(b.timestamp || b.date).getTime();
                return aTime - bTime;
            });

        inMovementsSorted.forEach((mov, index) => {
            if (index === 0) {
                if (mov.reason === "شراء مخزون جديد" || mov.reason === "المخزون الأولي") {
                    mov.reason = "المخزون الأولي";
                }
            } else {
                if (mov.reason === "المخزون الأولي") {
                    mov.reason = "شراء مخزون جديد";
                }
            }
        });

        await item.save();

        // Emit Socket.IO event for inventory update
        if (req.io) {
            try {
                req.io.notifyInventoryUpdate(item);
            } catch (ioError) {
                Logger.error("فشل في إرسال إشعار تحديث المخزون", {
                    error: ioError.message,
                });
            }
        }

        res.json({
            success: true,
            message: "تم تحديث الحركة بنجاح",
            data: item,
        });
    } catch (error) {
        Logger.error("خطأ في تحديث الحركة", error);
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث الحركة",
            error: error.message,
        });
    }
};
