import Order from "../models/Order.js";
import InventoryItem from "../models/InventoryItem.js";
import MenuItem from "../models/MenuItem.js";
import Bill from "../models/Bill.js";
import Table from "../models/Table.js";
import Logger from "../middleware/logger.js";
import NotificationService from "../services/notificationService.js";
import mongoose from "mongoose";
import performanceMetrics from "../utils/performanceMetrics.js";
import {
    convertQuantity,
    calculateTotalInventoryNeeded,
    validateInventoryAvailability,
    calculateOrderTotalCost,
    createOrderErrorMessages,
    createOrderSuccessMessages,
} from "../utils/orderUtils.js";

// ==================== دوال مساعدة لإدارة المخزون ====================

/**
 * خصم المخزون للطلب
 * @param {Object} order - الطلب
 * @param {String} userId - معرف المستخدم
 */
async function deductInventoryForOrder(order, userId, billNumber = null) {
    const allIngredientsNeeded = new Map();

    for (const item of order.items) {
        if (item.menuItem) {
            const menuItem = await MenuItem.findById(item.menuItem);
            if (menuItem && menuItem.ingredients && menuItem.ingredients.length > 0) {
                for (const ingredient of menuItem.ingredients) {
                    const key = ingredient.item.toString();
                    const currentQuantity = allIngredientsNeeded.get(key)?.quantity || 0;
                    const totalQuantity = currentQuantity + (ingredient.quantity * item.quantity);

                    allIngredientsNeeded.set(key, {
                        quantity: totalQuantity,
                        unit: ingredient.unit,
                        itemName: menuItem.name,
                    });
                }
            }
        }
    }

    // خصم جميع المكونات مع حساب السعر باستخدام FIFO
    for (const [inventoryItemId, ingredientData] of allIngredientsNeeded) {
        const inventoryItem = await InventoryItem.findById(inventoryItemId);
        if (inventoryItem) {
            const convertedQuantityNeeded = convertQuantity(
                ingredientData.quantity,
                ingredientData.unit,
                inventoryItem.unit
            );

            // حساب السعر باستخدام FIFO
            const movementDate = new Date();
            
            // Get all movements sorted by timestamp (oldest first)
            const allMovements = inventoryItem.stockMovements
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
            let remainingToDeduct = Math.abs(convertedQuantityNeeded);
            let totalCost = 0;
            
            for (const batch of batches) {
                if (remainingToDeduct <= 0) break;
                if (batch.remaining <= 0) continue;
                
                const qtyFromThisBatch = Math.min(remainingToDeduct, batch.remaining);
                totalCost += qtyFromThisBatch * batch.price;
                remainingToDeduct -= qtyFromThisBatch;
            }
            
            // Calculate totalCost and price
            const finalTotalCost = Math.round(totalCost * 100) / 100;
            const finalPrice = Math.abs(convertedQuantityNeeded) > 0 && finalTotalCost > 0
                ? Math.round((finalTotalCost / Math.abs(convertedQuantityNeeded)) * 100) / 100
                : null;

            // بناء السبب مع رقم الفاتورة إذا كان متاحاً
            const reason = billNumber 
                ? `خصم لطلب رقم ${order.orderNumber} - فاتورة ${billNumber}`
                : `خصم لطلب رقم ${order.orderNumber}`;

            await inventoryItem.addStockMovement(
                "out",
                convertedQuantityNeeded,
                reason,
                userId,
                order._id.toString(),
                finalPrice,
                null,
                finalTotalCost
            );
        }
    }
}

/**
 * إرجاع المخزون للطلب
 * @param {Object} order - الطلب
 * @param {String} userId - معرف المستخدم
 */
export async function restoreInventoryForOrder(order, userId) {
    const allIngredientsToRestore = new Map();

    for (const item of order.items) {
        if (item.menuItem) {
            const menuItem = await MenuItem.findById(item.menuItem);
            if (menuItem && menuItem.ingredients && menuItem.ingredients.length > 0) {
                for (const ingredient of menuItem.ingredients) {
                    const key = ingredient.item.toString();
                    const currentQuantity = allIngredientsToRestore.get(key)?.quantity || 0;
                    const totalQuantity = currentQuantity + (ingredient.quantity * item.quantity);

                    allIngredientsToRestore.set(key, {
                        quantity: totalQuantity,
                        unit: ingredient.unit,
                        itemName: menuItem.name,
                    });
                }
            }
        }
    }

    // جلب معلومات الفاتورة إذا كانت موجودة
    let billNumber = null;
    if (order.bill) {
        const Bill = (await import("../models/Bill.js")).default;
        const billDoc = await Bill.findById(order.bill).select('billNumber');
        if (billDoc) {
            billNumber = billDoc.billNumber;
        }
    }

    // إرجاع جميع المكونات بنفس السعر الذي تم خصمه
    for (const [inventoryItemId, ingredientData] of allIngredientsToRestore) {
        const inventoryItem = await InventoryItem.findById(inventoryItemId);
        if (inventoryItem) {
            const convertedQuantityToRestore = convertQuantity(
                ingredientData.quantity,
                ingredientData.unit,
                inventoryItem.unit
            );

            // البحث عن حركة الخصم الأصلية لهذا الطلب
            const deductMovement = inventoryItem.stockMovements
                .filter(m => 
                    m.type === 'out' && 
                    m.reference && 
                    m.reference.toString() === order._id.toString()
                )
                .sort((a, b) => {
                    const aTime = new Date(a.timestamp || a.date).getTime();
                    const bTime = new Date(b.timestamp || b.date).getTime();
                    return bTime - aTime; // الأحدث أولاً
                })[0];
            
            // استخدام نفس السعر والتكلفة من حركة الخصم
            const priceToRestore = deductMovement?.price || null;
            const totalCostToRestore = deductMovement?.totalCost || null;

            // بناء السبب مع رقم الفاتورة إذا كان متاحاً
            const reason = billNumber 
                ? `استرداد من حذف طلب رقم ${order.orderNumber} - فاتورة ${billNumber}`
                : `استرداد من حذف طلب رقم ${order.orderNumber}`;

            await inventoryItem.addStockMovement(
                "in",
                convertedQuantityToRestore,
                reason,
                userId,
                order._id.toString(),
                priceToRestore,
                null,
                totalCostToRestore
            );
        }
    }
}

/**
 * تعديل المخزون عند تعديل الطلب
 * @param {Object} oldOrder - الطلب القديم
 * @param {Object} newOrder - الطلب الجديد
 * @param {String} userId - معرف المستخدم
 */
async function adjustInventoryForOrderUpdate(oldOrder, newOrder, userId) {
    // جلب معلومات الفاتورة إذا كانت موجودة
    let billNumber = null;
    if (newOrder.bill) {
        const Bill = (await import("../models/Bill.js")).default;
        const billDoc = await Bill.findById(newOrder.bill).select('billNumber');
        if (billDoc) {
            billNumber = billDoc.billNumber;
        }
    }

    // حساب المكونات القديمة مع الوحدات
    const oldIngredients = new Map();
    for (const item of oldOrder.items) {
        if (item.menuItem) {
            const menuItem = await MenuItem.findById(item.menuItem);
            if (menuItem && menuItem.ingredients && menuItem.ingredients.length > 0) {
                for (const ingredient of menuItem.ingredients) {
                    const key = ingredient.item.toString();
                    const currentQuantity = oldIngredients.get(key)?.quantity || 0;
                    const totalQuantity = currentQuantity + (ingredient.quantity * item.quantity);
                    oldIngredients.set(key, {
                        quantity: totalQuantity,
                        unit: ingredient.unit
                    });
                }
            }
        }
    }

    // حساب المكونات الجديدة مع الوحدات
    const newIngredients = new Map();
    for (const item of newOrder.items) {
        if (item.menuItem) {
            const menuItem = await MenuItem.findById(item.menuItem);
            if (menuItem && menuItem.ingredients && menuItem.ingredients.length > 0) {
                for (const ingredient of menuItem.ingredients) {
                    const key = ingredient.item.toString();
                    const currentQuantity = newIngredients.get(key)?.quantity || 0;
                    const totalQuantity = currentQuantity + (ingredient.quantity * item.quantity);
                    newIngredients.set(key, {
                        quantity: totalQuantity,
                        unit: ingredient.unit
                    });
                }
            }
        }
    }

    // حساب الفرق وتعديل المخزون
    const allIngredientIds = new Set([...oldIngredients.keys(), ...newIngredients.keys()]);
    
    for (const ingredientId of allIngredientIds) {
        const oldData = oldIngredients.get(ingredientId) || { quantity: 0, unit: '' };
        const newData = newIngredients.get(ingredientId) || { quantity: 0, unit: '' };
        
        const inventoryItem = await InventoryItem.findById(ingredientId);
        if (!inventoryItem) continue;

        // تحويل الكميات إلى وحدة المخزون
        const oldQtyConverted = convertQuantity(oldData.quantity, oldData.unit, inventoryItem.unit);
        const newQtyConverted = convertQuantity(newData.quantity, newData.unit, inventoryItem.unit);
        const difference = newQtyConverted - oldQtyConverted;

        if (difference !== 0) {
            if (difference > 0) {
                // زيادة في الكمية - خصم إضافي مع حساب السعر بـ FIFO
                const movementDate = new Date();
                
                // Get all movements sorted by timestamp (oldest first)
                const allMovements = inventoryItem.stockMovements
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
                    if (movement.timestamp >= movementDate) break;
                    
                    if (movement.type === 'in' && movement.price) {
                        batches.push({
                            quantity: movement.quantity,
                            price: movement.price,
                            remaining: movement.quantity
                        });
                    } else if (movement.type === 'out') {
                        let toDeduct = movement.quantity;
                        for (const batch of batches) {
                            if (toDeduct <= 0) break;
                            const deductFromBatch = Math.min(batch.remaining, toDeduct);
                            batch.remaining -= deductFromBatch;
                            toDeduct -= deductFromBatch;
                        }
                    } else if (movement.type === 'adjustment') {
                        const totalRemaining = batches.reduce((sum, b) => sum + b.remaining, 0);
                        if (totalRemaining > 0) {
                            const ratio = movement.quantity / totalRemaining;
                            batches.forEach(batch => {
                                batch.remaining = batch.remaining * ratio;
                            });
                        }
                    }
                }
                
                // Calculate cost for current deduction
                let remainingToDeduct = Math.abs(difference);
                let totalCost = 0;
                
                for (const batch of batches) {
                    if (remainingToDeduct <= 0) break;
                    if (batch.remaining <= 0) continue;
                    
                    const qtyFromThisBatch = Math.min(remainingToDeduct, batch.remaining);
                    totalCost += qtyFromThisBatch * batch.price;
                    remainingToDeduct -= qtyFromThisBatch;
                }
                
                const finalTotalCost = Math.round(totalCost * 100) / 100;
                const finalPrice = Math.abs(difference) > 0 && finalTotalCost > 0
                    ? Math.round((finalTotalCost / Math.abs(difference)) * 100) / 100
                    : null;

                // بناء السبب مع رقم الفاتورة إذا كان متاحاً
                const reason = billNumber 
                    ? `تعديل طلب رقم ${newOrder.orderNumber} (زيادة) - فاتورة ${billNumber}`
                    : `تعديل طلب رقم ${newOrder.orderNumber} (زيادة)`;

                await inventoryItem.addStockMovement(
                    "out",
                    Math.abs(difference),
                    reason,
                    userId,
                    newOrder._id.toString(),
                    finalPrice,
                    null,
                    finalTotalCost
                );
            } else {
                // نقصان في الكمية - إرجاع بنفس السعر من آخر حركة خصم
                const lastDeductMovement = inventoryItem.stockMovements
                    .filter(m => 
                        m.type === 'out' && 
                        m.reference && 
                        m.reference.toString() === newOrder._id.toString()
                    )
                    .sort((a, b) => {
                        const aTime = new Date(a.timestamp || a.date).getTime();
                        const bTime = new Date(b.timestamp || b.date).getTime();
                        return bTime - aTime;
                    })[0];
                
                const priceToRestore = lastDeductMovement?.price || null;
                const totalCostToRestore = lastDeductMovement?.totalCost 
                    ? Math.round((lastDeductMovement.totalCost / lastDeductMovement.quantity) * Math.abs(difference) * 100) / 100
                    : null;

                // بناء السبب مع رقم الفاتورة إذا كان متاحاً
                const reason = billNumber 
                    ? `تعديل طلب رقم ${newOrder.orderNumber} (نقصان) - فاتورة ${billNumber}`
                    : `تعديل طلب رقم ${newOrder.orderNumber} (نقصان)`;

                await inventoryItem.addStockMovement(
                    "in",
                    Math.abs(difference),
                    reason,
                    userId,
                    newOrder._id.toString(),
                    priceToRestore,
                    null,
                    totalCostToRestore
                );
            }
        }
    }
}

// ==================== نهاية دوال المخزون ====================

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private
export const getOrders = async (req, res) => {
    const queryStartTime = Date.now();
    try {
        const { 
            status, 
            table, 
            page = 1, 
            limit = 50, 
            startDate,  // NEW: Date range filtering
            endDate     // NEW: Date range filtering
        } = req.query;

        const query = {};
        if (status) query.status = status;
        if (table) query.table = table;
        query.organization = req.user.organization;

        // NEW: Date range filtering
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                try {
                    query.createdAt.$gte = new Date(startDate);
                } catch (error) {
                    Logger.error("Invalid startDate format", { startDate });
                    return res.status(400).json({
                        success: false,
                        message: "Invalid date format. Use ISO 8601 format (YYYY-MM-DD)",
                    });
                }
            }
            if (endDate) {
                try {
                    const endDateTime = new Date(endDate);
                    // Set to end of day to include all orders from that day
                    endDateTime.setHours(23, 59, 59, 999);
                    query.createdAt.$lte = endDateTime;
                } catch (error) {
                    Logger.error("Invalid endDate format", { endDate });
                    return res.status(400).json({
                        success: false,
                        message: "Invalid date format. Use ISO 8601 format (YYYY-MM-DD)",
                    });
                }
            }
        }

        // إزالة الحد - جلب جميع الطلبات بدون pagination
        // تم إزالة effectiveLimit لعرض جميع الطلبات القديمة والجديدة

        // Selective field projection - only essential fields + bill status + items
        const orders = await Order.find(query)
            .select('orderNumber table status total createdAt bill items organization')
            .populate('table', 'number name')
            .populate('bill', 'status') // إضافة populate للفاتورة لمعرفة حالتها
            .populate('organization', 'name') // إضافة populate للمنشأة
            .sort({ createdAt: -1 })
            .lean(); // Convert to plain JS objects for better performance - جلب جميع الطلبات بدون حد

        const total = await Order.countDocuments(query);

        const queryExecutionTime = Date.now() - queryStartTime;

        // Log query performance - بدون pagination
        Logger.queryPerformance('/api/orders', queryExecutionTime, orders.length, {
            filters: { status, table, startDate, endDate },
            totalRecords: total
        });

        // Record query metrics - بدون pagination
        performanceMetrics.recordQuery({
            endpoint: '/api/orders',
            executionTime: queryExecutionTime,
            recordCount: orders.length,
            filters: { status, table, startDate, endDate },
        });

        // Response بدون pagination metadata
        res.json({
            success: true,
            count: orders.length,
            total,
            data: orders
        });
    } catch (error) {
        Logger.error("خطأ في جلب الطلبات", {
            error: error.message,
            executionTime: `${Date.now() - queryStartTime}ms`
        });
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الطلبات",
            error: error.message,
        });
    }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
export const getOrder = async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            organization: req.user.organization,
        })
            .populate("createdBy", "name")
            .populate("preparedBy", "name")
            .populate("deliveredBy", "name")
            .populate("bill");

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "الطلب غير موجود",
            });
        }

        res.json({
            success: true,
            data: order,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الطلب",
            error: error.message,
        });
    }
};

// @desc    Calculate inventory requirements and total cost for order items
// @route   POST /api/orders/calculate
// @access  Private
export const calculateOrderRequirements = async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "يجب إضافة عنصر واحد على الأقل للطلب",
            });
        }

        // حساب المخزون المطلوب والتكلفة
        const inventoryNeeded = await calculateTotalInventoryNeeded(items);
        const totalCost = await calculateOrderTotalCost(items);

        // التحقق من توفر المخزون
        const { errors: validationErrors, details: insufficientDetails } =
            await validateInventoryAvailability(inventoryNeeded);

        // جلب تفاصيل المخزون المطلوب
        const InventoryItem = (await import("../models/InventoryItem.js"))
            .default;
        const inventoryDetails = [];

        for (const [inventoryItemId, { quantity, unit }] of inventoryNeeded) {
            const inventoryItem = await InventoryItem.findById(inventoryItemId);
            if (inventoryItem) {
                // تحويل الكمية المطلوبة من وحدة المكون إلى وحدة المخزون
                const convertedQuantityNeeded = convertQuantity(
                    quantity,
                    unit,
                    inventoryItem.unit
                );

                inventoryDetails.push({
                    inventoryItem: {
                        _id: inventoryItem._id,
                        name: inventoryItem.name,
                        unit: inventoryItem.unit,
                        currentStock: inventoryItem.currentStock,
                        cost: inventoryItem.cost,
                    },
                    requiredQuantity: convertedQuantityNeeded,
                    isAvailable:
                        inventoryItem.currentStock >= convertedQuantityNeeded,
                    cost: (inventoryItem.cost || 0) * convertedQuantityNeeded,
                });
            }
        }

        // حساب الإحصائيات
        const totalRevenue = items.reduce((sum, item) => {
            if (item.menuItem) {
                return sum + (item.price || 0) * item.quantity;
            }
            return sum + (item.price || 0) * item.quantity;
        }, 0);

        const profit = totalRevenue - totalCost;
        const profitMargin =
            totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

        const response = {
            success: true,
            data: {
                inventoryRequirements: inventoryDetails,
                totalCost,
                totalRevenue,
                profit,
                profitMargin,
                isInventoryAvailable: inventoryDetails.every(
                    (item) => item.isAvailable
                ),
                validationErrors: validationErrors,
                details: insufficientDetails, // تفاصيل المكونات الناقصة
            },
        };

        res.json(response);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في حساب متطلبات الطلب",
            error: error.message,
        });
    }
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const createOrder = async (req, res) => {
    try {
        const { table, customerName, customerPhone, items, notes, bill } =
            req.body;

        // Validate items
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "يجب إضافة عنصر واحد على الأقل للطلب",
            });
        }

        // Validate table ObjectId if provided
        if (table) {
            if (!mongoose.Types.ObjectId.isValid(table)) {
                return res.status(400).json({
                    success: false,
                    message: "معرف الطاولة غير صحيح",
                });
            }

            // Verify table exists
            const tableDoc = await Table.findById(table);
            if (!tableDoc) {
                return res.status(404).json({
                    success: false,
                    message: "الطاولة غير موجودة",
                });
            }
        }

        // حساب المخزون المطلوب لجميع الأصناف
        const inventoryNeeded = await calculateTotalInventoryNeeded(items);

        // التحقق من توفر المخزون
        const { errors: validationErrors, details: insufficientDetails } =
            await validateInventoryAvailability(inventoryNeeded);

        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: "المخزون غير كافي لإنشاء الطلب - راجع التفاصيل أدناه",
                errors: validationErrors,
                details: insufficientDetails,
                inventoryErrors: validationErrors,
            });
        }

        // Process items and calculate totals
        const processedItems = [];
        let subtotal = 0;

        for (const item of items) {
            if (item.menuItem) {
                const menuItem = await MenuItem.findById(item.menuItem);
                if (!menuItem) {
                    return res.status(400).json({
                        success: false,
                        message: `عنصر القائمة غير موجود: ${item.menuItem}`,
                    });
                }
                if (!menuItem.isAvailable) {
                    return res.status(400).json({
                        success: false,
                        message: `العنصر غير متاح: ${menuItem.name}`,
                    });
                }

                // Calculate item total
                const itemTotal = (menuItem.price || 0) * (item.quantity || 1);
                subtotal += itemTotal;
                processedItems.push({
                    menuItem: menuItem._id,
                    name: menuItem.name,
                    arabicName: menuItem.arabicName || menuItem.name,
                    price: menuItem.price || 0,
                    quantity: item.quantity || 1,
                    itemTotal: itemTotal,
                    notes: item.notes,
                    preparationTime: menuItem.preparationTime || 5,
                });
            } else {
                // إذا لم يوجد menuItem، استخدم بيانات العنصر كما هي
                const itemPrice = parseFloat(item.price) || 0;
                const itemQuantity = parseInt(item.quantity) || 1;
                const itemTotal = itemPrice * itemQuantity;
                subtotal += itemTotal;
                processedItems.push({
                    name: item.name || 'عنصر غير محدد',
                    price: itemPrice,
                    quantity: itemQuantity,
                    itemTotal: itemTotal,
                    notes: item.notes,
                    preparationTime: item.preparationTime || 5,
                });
            }
        }

        // Create order
        const orderData = {
            ...req.body,
            items: processedItems, // استخدام العناصر المعالجة
            subtotal: subtotal, // تعيين القيمة المحسوبة
            finalAmount: subtotal - (req.body.discount || 0), // حساب المبلغ النهائي
            organization: req.user.organization,
            createdBy: req.user._id,
            status: 'pending',
            // سيتم إنشاء رقم الطلب تلقائيًا في الخطاف pre-save
        };

        // التأكد من عدم وجود حقول غير مرغوب فيها
        delete orderData.orderNumber;
        delete orderData._id;

        // حساب التكلفة الإجمالية للطلب
        const totalCost = await calculateOrderTotalCost(processedItems);
        orderData.totalCost = totalCost;

        // Generate order number manually
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
        const count = await Order.countDocuments({
            createdAt: {
                $gte: new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate()
                ),
                $lt: new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate() + 1
                ),
            },
        });
        orderData.orderNumber = `ORD-${dateStr}-${String(count + 1).padStart(
            3,
            "0"
        )}`;

        // البحث عن فاتورة غير مدفوعة للطاولة أو إنشاء فاتورة جديدة
        let billToUse = bill;
        
        // إذا كان هناك table ولم يكن bill محدداً، ابحث عن فاتورة غير مدفوعة
        if (table && !billToUse) {
            try {
                // Get table info for logging
                const tableDoc = await Table.findById(table);
                const tableNumber = tableDoc ? tableDoc.number : table;
                
                // البحث عن فاتورة غير مدفوعة للطاولة (draft, partial, overdue)
                // يشمل جميع أنواع الفواتير: playstation, computer, cafe
                const existingBill = await Bill.findOne({
                    table: table,
                    organization: req.user.organization,
                    status: { $in: ['draft', 'partial', 'overdue'] }
                }).sort({ createdAt: -1 }); // أحدث فاتورة

                if (existingBill) {
                    billToUse = existingBill._id;
                    Logger.info(`✓ تم العثور على فاتورة موجودة للطاولة ${tableNumber}:`, {
                        billId: existingBill._id,
                        billNumber: existingBill.billNumber,
                        billType: existingBill.billType,
                        status: existingBill.status
                    });
                } else {
                    // إنشاء فاتورة جديدة للطاولة
                    const billData = {
                        table: table,
                        customerName: customerName || `طاولة ${tableNumber}`,
                        customerPhone: customerPhone || null,
                        orders: [],
                        sessions: [],
                        subtotal: 0,
                        total: 0,
                        discount: 0,
                        tax: 0,
                        paid: 0,
                        remaining: 0,
                        status: 'draft',
                        paymentMethod: 'cash',
                        billType: 'cafe',
                        createdBy: req.user._id,
                        organization: req.user.organization,
                    };

                    const newBill = await Bill.create(billData);
                    billToUse = newBill._id;
                    Logger.info(`✓ تم إنشاء فاتورة جديدة للطاولة ${tableNumber}:`, {
                        billId: newBill._id,
                        billNumber: newBill.billNumber,
                        billType: newBill.billType
                    });
                }

                // Update table status to 'occupied'
                if (tableDoc) {
                    tableDoc.status = 'occupied';
                    await tableDoc.save();
                    Logger.info(`✓ تم تحديث حالة الطاولة ${tableNumber} إلى محجوزة`);
                }
            } catch (error) {
                Logger.error('خطأ في البحث عن الفاتورة أو إنشائها:', error);
            }
        }

        // ربط الطلب بالفاتورة
        if (billToUse) {
            orderData.bill = billToUse;
        }

        const order = new Order(orderData);

        await order.save();

        // خصم المخزون فوراً عند إنشاء الطلب
        try {
            // جلب معلومات الفاتورة إذا كانت موجودة
            let billNumber = null;
            if (order.bill) {
                const Bill = (await import("../models/Bill.js")).default;
                const billDoc = await Bill.findById(order.bill).select('billNumber');
                if (billDoc) {
                    billNumber = billDoc.billNumber;
                }
            }
            await deductInventoryForOrder(order, req.user._id, billNumber);
            Logger.info(`✓ تم خصم المخزون للطلب ${order.orderNumber}`);
        } catch (inventoryError) {
            Logger.error('خطأ في خصم المخزون:', inventoryError);
            // لا نفشل الطلب، لكن نسجل الخطأ
        }

        // Populate only essential fields for response
        const populatedOrder = await Order.findById(order._id)
            .populate("table", "number name")
            .populate("organization", "name")
            .lean();

        // إرسال الاستجابة فوراً قبل العمليات الإضافية
        res.status(201).json({
            success: true,
            message: "تم إنشاء الطلب بنجاح",
            data: populatedOrder,
        });

        // تنفيذ العمليات الإضافية في الخلفية (non-blocking)
        setImmediate(async () => {
            // Add order to bill if bill exists
            if (billToUse) {
                try {
                    const billDoc = await Bill.findById(billToUse);
                    if (billDoc) {
                        // التأكد من أن الطلب غير موجود بالفعل في الفاتورة
                        if (!billDoc.orders.includes(order._id)) {
                            Logger.info(`✓ إضافة الطلب ${order.orderNumber} إلى الفاتورة ${billDoc.billNumber}`);
                            billDoc.orders.push(order._id);
                            
                            // Mark orders as modified to trigger pre-save hook
                            billDoc.markModified('orders');
                            
                            // حفظ الفاتورة - سيُشغل pre-save hook لتحديث itemPayments
                            await billDoc.save();
                            Logger.info(`✓ تم حفظ الفاتورة وتحديث itemPayments`);
                        } else {
                            Logger.info(`⚠️ الطلب ${order.orderNumber} موجود بالفعل في الفاتورة ${billDoc.billNumber}`);
                        }

                        // Recalculate bill totals
                        await billDoc.calculateSubtotal();
                    }
                } catch (error) {
                    Logger.error('خطأ في إضافة الطلب للفاتورة:', error);
                }
            }

            // Create notification for new order
            try {
                await NotificationService.createOrderNotification(
                    "created",
                    populatedOrder,
                    req.user._id
                );
            } catch (notificationError) {
                //
            }

            // Emit Socket.IO event for order creation
            if (req.io) {
                try {
                    req.io.notifyOrderUpdate("created", populatedOrder);
                } catch (socketError) {
                    Logger.error('فشل إرسال حدث Socket.IO', socketError);
                }
            }

            // Emit table status update event if table is linked
            if (table && req.io) {
                try {
                    req.io.emit('table-status-update', { 
                        tableId: table, 
                        status: 'occupied' 
                    });
                } catch (socketError) {
                    Logger.error('فشل إرسال حدث تحديث حالة الطاولة', socketError);
                }
            }
        });
    } catch (error) {
        if (error.name === "ValidationError") {
            const errors = Object.values(error.errors).map((e) => e.message);
            return res.status(400).json({
                success: false,
                message: "بيانات الطلب غير صحيحة",
                errors,
            });
        }

        res.status(500).json({
            success: false,
            message: "خطأ في إنشاء الطلب",
            error: error.message,
        });
    }
};

// @desc    Update order
// @route   PUT /api/orders/:id
// @access  Private
export const updateOrder = async (req, res) => {
    try {
        const { status, notes, preparedBy, deliveredBy, items } = req.body;

        // Check if the ID is a valid MongoDB ObjectId
        const mongoose = await import("mongoose");
        const isValidObjectId = mongoose.Types.ObjectId.isValid(req.params.id);

        // First check if the order exists without organization filter
        const orderWithoutOrg = await Order.findById(req.params.id);

        const order = await Order.findOne({
            _id: req.params.id,
            organization: req.user.organization,
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "الطلب غير موجود",
            });
        }

        // إذا تم تحديث العناصر، تحقق من المخزون
        let calculatedTotalCost = 0; // متغير لتخزين التكلفة المحسوبة
        
        // حفظ نسخة من العناصر القديمة قبل التعديل (للمخزون)
        const oldOrderItems = order.items.map(item => ({
            menuItem: item.menuItem,
            quantity: item.quantity,
            name: item.name
        }));

        // حساب التكلفة الإجمالية دائماً (حتى لو لم يتم تمرير items)
        if (items && Array.isArray(items) && items.length > 0) {
            // حساب المخزون المطلوب لجميع الأصناف
            const inventoryNeeded = await calculateTotalInventoryNeeded(items);

            // حساب التكلفة الإجمالية
            calculatedTotalCost = await calculateOrderTotalCost(items);

            // التحقق من توفر المخزون
            const { errors: validationErrors, details: insufficientDetails } =
                await validateInventoryAvailability(inventoryNeeded);

            if (validationErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message:
                        "المخزون غير كافي لتعديل الطلب - راجع التفاصيل أدناه",
                    errors: validationErrors,
                    details: insufficientDetails,
                    inventoryErrors: validationErrors,
                });
            }
        } else {
            // حساب التكلفة من عناصر الطلب الحالية إذا لم يتم تمرير items

            const currentItems = order.items.map((item) => ({
                menuItem: item.menuItem,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                notes: item.notes,
            }));

            calculatedTotalCost = await calculateOrderTotalCost(currentItems);
        }

        // Update fields
        if (status) {
            order.status = status;
            if (status === "preparing" && preparedBy) {
                order.preparedBy = preparedBy;
            } else if (status === "delivered" && deliveredBy) {
                order.deliveredBy = deliveredBy;
            }
        }

        if (notes !== undefined) order.notes = notes;

        // تحديث أصناف الطلب بالكامل (إضافة/تعديل/حذف)
        if (Array.isArray(items)) {
            // 1. حذف الأصناف التي لم تعد موجودة في الطلب الجديد
            const itemsToKeep = [];
            for (const existingItem of order.items) {
                let shouldKeep = false;

                for (const newItem of items) {
                    if (newItem.menuItem && existingItem.menuItem) {
                        // مقارنة بواسطة menuItem ID
                        if (
                            newItem.menuItem.toString() ===
                            existingItem.menuItem.toString()
                        ) {
                            shouldKeep = true;
                            break;
                        }
                    } else if (newItem.name && existingItem.name) {
                        // مقارنة بواسطة الاسم (fallback للتوافق مع البيانات القديمة)
                        // إضافة مقارنة السعر أيضاً لمزيد من الدقة
                        if (newItem.name === existingItem.name && 
                            (!newItem.price || !existingItem.price || newItem.price === existingItem.price)) {
                            shouldKeep = true;
                            break;
                        }
                    }
                }

                if (shouldKeep) {
                    itemsToKeep.push(existingItem);
                }
            }

            // استبدال قائمة الأصناف بالأصناف المتبقية
            order.items = itemsToKeep;

            // 2. تحديث أو إضافة الأصناف الجديدة
            for (let i = 0; i < items.length; i++) {
                const updatedItem = items[i];
                let orderItem = null;
                if (updatedItem.menuItem) {
                    orderItem = order.items.find(
                        (item) =>
                            item.menuItem?.toString() ===
                            updatedItem.menuItem.toString()
                    );
                } else {
                    orderItem = order.items.find(
                        (item) => item.name === updatedItem.name
                    );
                }
                if (orderItem) {
                    // تحديث الكمية والملاحظات
                    const newQuantity = Math.max(
                        updatedItem.quantity,
                        orderItem.preparedCount || 0
                    );
                    orderItem.quantity = newQuantity;
                    orderItem.notes =
                        updatedItem.notes !== undefined
                            ? updatedItem.notes
                            : orderItem.notes;
                    orderItem.price = updatedItem.price;
                    orderItem.name = updatedItem.name;
                    orderItem.menuItem = updatedItem.menuItem;
                    // أعد حساب itemTotal
                    orderItem.itemTotal = orderItem.price * orderItem.quantity;
                } else {
                    // إضافة صنف جديد
                    if (updatedItem.menuItem) {
                        const menuItem = await MenuItem.findById(
                            updatedItem.menuItem
                        );
                        if (!menuItem) {
                            return res.status(400).json({
                                success: false,
                                message: `عنصر القائمة غير موجود: ${updatedItem.menuItem}`,
                            });
                        }
                        if (!menuItem.isAvailable) {
                            return res.status(400).json({
                                success: false,
                                message: `العنصر غير متاح: ${menuItem.name}`,
                            });
                        }

                        const itemTotal = menuItem.price * updatedItem.quantity;
                        order.items.push({
                            menuItem: menuItem._id,
                            name: menuItem.name,
                            arabicName: menuItem.arabicName || menuItem.name,
                            price: menuItem.price,
                            quantity: updatedItem.quantity,
                            itemTotal,
                            notes: updatedItem.notes,
                            preparationTime: menuItem.preparationTime,
                        });
                    } else {
                        const itemTotal =
                            updatedItem.price * updatedItem.quantity;
                        order.items.push({
                            name: updatedItem.name,
                            price: updatedItem.price,
                            quantity: updatedItem.quantity,
                            itemTotal,
                            notes: updatedItem.notes,
                            preparationTime: updatedItem.preparationTime || 0,
                        });
                    }
                }
            }

            // 2. إعادة حساب المجموع
            order.subtotal = order.items.reduce(
                (sum, item) => sum + item.itemTotal,
                0
            );
            order.finalAmount = order.subtotal - (order.discount || 0);

            // حساب التكلفة الإجمالية للطلب
            if (calculatedTotalCost > 0) {
                order.totalCost = calculatedTotalCost;
            } else if (items && Array.isArray(items) && items.length > 0) {
                const totalCost = await calculateOrderTotalCost(items);
                order.totalCost = totalCost;
            } else {
                // حساب التكلفة من عناصر الطلب الحالية
                const currentItems = order.items.map((item) => ({
                    menuItem: item.menuItem,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    notes: item.notes,
                }));
                const totalCost = await calculateOrderTotalCost(currentItems);
                order.totalCost = totalCost;
            }
        }

        // تعديل المخزون إذا تم تغيير العناصر
        if (items && Array.isArray(items) && items.length > 0) {
            try {
                // استخدام العناصر القديمة المحفوظة
                const oldOrderData = {
                    _id: order._id,
                    orderNumber: order.orderNumber,
                    items: oldOrderItems
                };
                
                // الآن order.items تحتوي على العناصر الجديدة بعد التعديل
                await adjustInventoryForOrderUpdate(oldOrderData, order, req.user._id);
                Logger.info(`✓ تم تعديل المخزون للطلب ${order.orderNumber}`);
            } catch (inventoryError) {
                Logger.error('خطأ في تعديل المخزون:', inventoryError);
                // نستمر في حفظ الطلب حتى لو فشل تعديل المخزون
            }
        }

        await order.save();

        // Clean up invalid itemPayments and recalculate payments for this order's bill (if exists)
        if (order.bill) {
            setImmediate(async () => {
                try {
                    const Bill = (await import('../models/Bill.js')).default;
                    const billDoc = await Bill.findById(order.bill);
                    if (billDoc) {
                        Logger.info(`🔄 [updateOrder] Recalculating payments for bill ${billDoc.billNumber} after order update`);
                        
                        // Populate orders to get current items
                        await billDoc.populate('orders');
                        
                        if (billDoc.itemPayments && billDoc.itemPayments.length > 0) {
                            // Get all valid itemIds from current orders
                            const validItemIds = new Set();
                            const currentOrderItems = new Map(); // Map itemId -> item details
                            const itemsByType = new Map(); // Map itemKey -> array of itemIds
                            
                            billDoc.orders.forEach(orderDoc => {
                                if (orderDoc.items && Array.isArray(orderDoc.items)) {
                                    orderDoc.items.forEach((item, index) => {
                                        const itemId = `${orderDoc._id}-${index}`;
                                        validItemIds.add(itemId);
                                        
                                        const itemDetails = {
                                            name: item.name,
                                            price: item.price,
                                            quantity: item.quantity,
                                            orderId: orderDoc._id
                                        };
                                        currentOrderItems.set(itemId, itemDetails);
                                        
                                        // Group items by type (name + price)
                                        const itemKey = `${item.name}|${item.price}`;
                                        if (!itemsByType.has(itemKey)) {
                                            itemsByType.set(itemKey, []);
                                        }
                                        itemsByType.get(itemKey).push(itemId);
                                    });
                                }
                            });

                            // Track removed payments and payments to redistribute
                            const removedPayments = [];
                            const adjustedPayments = [];
                            const paymentsToRedistribute = new Map(); // Map itemKey -> total paid amount
                            let totalRemovedAmount = 0;
                            let totalAdjustedAmount = 0;

                            // Filter out invalid itemPayments and adjust quantities for modified items
                            billDoc.itemPayments = billDoc.itemPayments.filter(payment => {
                                if (!validItemIds.has(payment.itemId)) {
                                    // Item was deleted - collect payment for redistribution
                                    // Use menuItem ID if available, fallback to name|price for backward compatibility
                                    const itemKey = payment.menuItemId ? payment.menuItemId.toString() : `${payment.itemName}|${payment.pricePerUnit}`;
                                    const paidAmount = payment.paidAmount || 0;
                                    
                                    if (paidAmount > 0) {
                                        if (!paymentsToRedistribute.has(itemKey)) {
                                            paymentsToRedistribute.set(itemKey, 0);
                                        }
                                        paymentsToRedistribute.set(itemKey, paymentsToRedistribute.get(itemKey) + paidAmount);
                                    }
                                    
                                    removedPayments.push({
                                        itemName: payment.itemName,
                                        itemId: payment.itemId,
                                        paidAmount: paidAmount,
                                        paidQuantity: payment.paidQuantity || 0
                                    });
                                    totalRemovedAmount += paidAmount;
                                    Logger.info(`🗑️ [updateOrder] Collecting payment from deleted item: ${payment.itemName} (${payment.itemId}), amount: ${paidAmount}`);
                                    return false; // Remove this payment
                                }

                                // Item still exists - check if quantity changed
                                const currentItem = currentOrderItems.get(payment.itemId);
                                if (currentItem && currentItem.quantity !== payment.quantity) {
                                    const oldPaidAmount = payment.paidAmount || 0;
                                    const oldPaidQuantity = payment.paidQuantity || 0;
                                    
                                    // Update item details
                                    payment.itemName = currentItem.name;
                                    payment.pricePerUnit = currentItem.price;
                                    payment.quantity = currentItem.quantity;
                                    payment.totalPrice = currentItem.price * currentItem.quantity;
                                    
                                    // Adjust paid quantity if it exceeds new total quantity
                                    if (payment.paidQuantity > currentItem.quantity) {
                                        payment.paidQuantity = currentItem.quantity;
                                        payment.paidAmount = currentItem.price * currentItem.quantity;
                                        payment.isPaid = true;
                                        
                                        const adjustedAmount = oldPaidAmount - payment.paidAmount;
                                        totalAdjustedAmount += adjustedAmount;
                                        
                                        adjustedPayments.push({
                                            itemName: payment.itemName,
                                            itemId: payment.itemId,
                                            oldQuantity: oldPaidQuantity,
                                            newQuantity: payment.paidQuantity,
                                            adjustedAmount: adjustedAmount
                                        });
                                        
                                        Logger.info(`📉 [updateOrder] Adjusted payment for modified item: ${payment.itemName} (${payment.itemId})`, {
                                            oldPaidQuantity: oldPaidQuantity,
                                            newPaidQuantity: payment.paidQuantity,
                                            oldPaidAmount: oldPaidAmount,
                                            newPaidAmount: payment.paidAmount,
                                            adjustedAmount: adjustedAmount
                                        });
                                    } else {
                                        // Recalculate paid amount based on current price
                                        payment.paidAmount = payment.paidQuantity * currentItem.price;
                                        payment.isPaid = payment.paidQuantity >= payment.quantity;
                                    }
                                }
                                
                                return true; // Keep this payment
                            });

                            // Redistribute payments to remaining items of the same type
                            for (const [itemKey, totalPaidAmount] of paymentsToRedistribute) {
                                if (totalPaidAmount <= 0) continue;
                                
                                const remainingItemIds = itemsByType.get(itemKey) || [];
                                if (remainingItemIds.length === 0) continue;
                                
                                Logger.info(`🔄 [updateOrder] Redistributing ${totalPaidAmount} EGP for item type: ${itemKey} to ${remainingItemIds.length} remaining items`);
                                
                                // Calculate how much to distribute per unit
                                const [itemName, priceStr] = itemKey.split('|');
                                const unitPrice = parseFloat(priceStr);
                                const totalQuantityPaid = Math.round(totalPaidAmount / unitPrice);
                                
                                let remainingQuantityToDistribute = totalQuantityPaid;
                                
                                // Distribute payments to remaining items
                                for (const itemId of remainingItemIds) {
                                    if (remainingQuantityToDistribute <= 0) break;
                                    
                                    const existingPayment = billDoc.itemPayments.find(ip => ip.itemId === itemId);
                                    if (!existingPayment) continue;
                                    
                                    const availableQuantity = existingPayment.quantity - (existingPayment.paidQuantity || 0);
                                    if (availableQuantity <= 0) continue;
                                    
                                    const quantityToAdd = Math.min(remainingQuantityToDistribute, availableQuantity);
                                    const amountToAdd = quantityToAdd * unitPrice;
                                    
                                    existingPayment.paidQuantity = (existingPayment.paidQuantity || 0) + quantityToAdd;
                                    existingPayment.paidAmount = (existingPayment.paidAmount || 0) + amountToAdd;
                                    existingPayment.isPaid = existingPayment.paidQuantity >= existingPayment.quantity;
                                    existingPayment.paidAt = new Date();
                                    
                                    // Add to payment history
                                    if (!existingPayment.paymentHistory) {
                                        existingPayment.paymentHistory = [];
                                    }
                                    existingPayment.paymentHistory.push({
                                        quantity: quantityToAdd,
                                        amount: amountToAdd,
                                        paidAt: new Date(),
                                        method: 'redistribution',
                                        note: 'Redistributed from deleted items'
                                    });
                                    
                                    remainingQuantityToDistribute -= quantityToAdd;
                                    
                                    Logger.info(`✅ [updateOrder] Redistributed ${quantityToAdd} units (${amountToAdd} EGP) to item: ${existingPayment.itemName} (${itemId})`);
                                }
                                
                                if (remainingQuantityToDistribute > 0) {
                                    Logger.warn(`⚠️ [updateOrder] Could not redistribute ${remainingQuantityToDistribute} units for item type: ${itemKey}`);
                                }
                            }

                            // Log summary of changes
                            if (removedPayments.length > 0 || adjustedPayments.length > 0) {
                                Logger.info(`💰 [updateOrder] Payment adjustments summary for bill ${billDoc.billNumber}:`, {
                                    removedPayments: removedPayments.length,
                                    adjustedPayments: adjustedPayments.length,
                                    totalRemovedAmount,
                                    totalAdjustedAmount,
                                    redistributedTypes: paymentsToRedistribute.size,
                                    netAdjustment: totalRemovedAmount + totalAdjustedAmount
                                });
                            }
                        }

                        // Recalculate bill totals and save
                        await billDoc.calculateSubtotal();
                        await billDoc.save();
                        
                        Logger.info(`✅ [updateOrder] Bill ${billDoc.billNumber} payments recalculated successfully`);
                    }
                } catch (cleanupError) {
                    Logger.error('Error recalculating bill payments after order update:', cleanupError);
                }
            });
        }
        // Populate only essential fields for response
        const updatedOrder = await Order.findById(order._id)
            .populate("table", "number name")
            .populate("organization", "name")
            .lean();

        // Update bill totals in background (non-blocking)
        if (order.bill) {
            setImmediate(() => {
                Bill.findById(order.bill).then(billDoc => {
                    if (billDoc) {
                        return billDoc.calculateSubtotal();
                    }
                }).catch(err => {
                    Logger.error('Error updating bill totals:', err);
                });
            });
        }

        // Emit Socket.IO event in background (non-blocking)
        if (req.io) {
            setImmediate(() => {
                try {
                    req.io.notifyOrderUpdate("updated", updatedOrder);
                } catch (socketError) {
                    Logger.error('فشل إرسال حدث Socket.IO', socketError);
                }
            });
        }

        res.json({
            success: true,
            message: "تم تحديث الطلب بنجاح",
            data: updatedOrder,
        });
    } catch (error) {
        // Handle specific error types
        if (error.name === "ValidationError") {
            const errors = Object.values(error.errors).map((e) => e.message);
            return res.status(400).json({
                success: false,
                message: "بيانات الطلب غير صحيحة",
                errors,
            });
        }

        if (error.name === "CastError") {
            return res.status(400).json({
                success: false,
                message: "معرف الطلب غير صحيح",
            });
        }

        res.status(500).json({
            success: false,
            message: "خطأ في تحديث الطلب",
            error: error.message,
        });
    }
};

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  Private
export const deleteOrder = async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            organization: req.user.organization,
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "الطلب غير موجود",
            });
        }

        // استرداد المخزون عند حذف الطلب
        try {
            await restoreInventoryForOrder(order, req.user._id);
            Logger.info(`✓ تم استرداد المخزون للطلب ${order.orderNumber}`);
        } catch (inventoryError) {
            Logger.error('خطأ في استرداد المخزون:', inventoryError);
            // نستمر في الحذف حتى لو فشل استرداد المخزون
        }

        // Remove order from bill.orders if linked to a bill BEFORE deleting the order
        let billIdToCheck = null;
        let tableIdToUpdate = null;
        let refundedAmount = 0;
        
        if (order.bill) {
            const Bill = (await import("../models/Bill.js")).default;
            const Session = (await import("../models/Session.js")).default;
            const orderIdStr = order._id.toString();
            billIdToCheck = order.bill;
            
            let billDoc = await Bill.findById(order.bill); // بدون populate
            if (billDoc) {
                // Save bill ID and table ID before removing reference
                const billId = billDoc._id;
                tableIdToUpdate = billDoc.table;
                
                // التحقق من وجود دفعات جزئية لهذا الطلب
                if (billDoc.itemPayments && billDoc.itemPayments.length > 0) {
                    const orderItemPayments = billDoc.itemPayments.filter(
                        ip => ip.orderId.toString() === orderIdStr && ip.paidAmount > 0
                    );
                    
                    if (orderItemPayments.length > 0) {
                        // حساب المبلغ المدفوع للطلب
                        refundedAmount = orderItemPayments.reduce((sum, ip) => sum + ip.paidAmount, 0);
                        
                        // إزالة الدفعات الجزئية لهذا الطلب
                        billDoc.itemPayments = billDoc.itemPayments.filter(
                            ip => ip.orderId.toString() !== orderIdStr
                        );
                        
                        // تحديث المبلغ المدفوع في الفاتورة (استرداد المبلغ)
                        billDoc.paid = Math.max(0, billDoc.paid - refundedAmount);
                        
                        Logger.info(`✓ تم استرداد ${refundedAmount} ج.م من الدفعات الجزئية للطلب ${order.orderNumber}`);
                    }
                }
                
                // Remove order from bill
                billDoc.orders = billDoc.orders.filter(
                    (id) => id.toString() !== orderIdStr
                );
                
                // Remove bill reference from the order before deleting
                order.bill = undefined;
                await order.save();
                
                // Save bill after removing order
                await billDoc.save();
                
                // Check if bill is now empty (no orders and no sessions)
                // Reload bill to get fresh data after removing order
                billDoc = await Bill.findById(billId);
                if (billDoc) {
                    const hasOrders = billDoc.orders && billDoc.orders.length > 0;
                    const hasSessions = billDoc.sessions && billDoc.sessions.length > 0;
                    
                    if (!hasOrders && !hasSessions) {
                        // Delete the bill if it has no orders or sessions
                        // Remove bill reference from any remaining orders and sessions before deletion
                        await Order.updateMany({ bill: billId }, { $unset: { bill: 1 } });
                        await Session.updateMany({ bill: billId }, { $unset: { bill: 1 } });
                        
                        // Delete the bill from Local and Atlas
                        Logger.info(`🗑️ Deleting empty bill ${billDoc.billNumber}`);
                        const { deleteFromBothDatabases } = await import('../utils/deleteHelper.js');
                        await deleteFromBothDatabases(billDoc, 'bills', `bill ${billDoc.billNumber}`);

                        // Update table status to 'empty' if bill is deleted
                        if (tableIdToUpdate) {
                            try {
                                const tableDoc = await Table.findById(tableIdToUpdate);
                                if (tableDoc) {
                                    tableDoc.status = 'empty';
                                    await tableDoc.save();
                                    Logger.info(`✓ تم تحديث حالة الطاولة ${tableDoc.number} إلى فارغة`);

                                    // Emit table status update event
                                    if (req.io) {
                                        req.io.emit('table-status-update', { 
                                            tableId: tableIdToUpdate, 
                                            status: 'empty' 
                                        });
                                    }
                                }
                            } catch (tableError) {
                                Logger.error('خطأ في تحديث حالة الطاولة:', tableError);
                            }
                        }
                    } else {
                        // Recalculate bill totals if there are still orders/sessions
                        await billDoc.calculateSubtotal();
                        await billDoc.save();
                    }
                }
            }
        }

        // Delete the order from Local and Atlas
        const orderId = order._id;
        const orderNumber = order.orderNumber;
        
        // تعطيل Sync Middleware مؤقتاً لتجنب إعادة المزامنة
        const syncConfig = (await import('../config/syncConfig.js')).default;
        const dualDatabaseManager = (await import('../config/dualDatabaseManager.js')).default;
        const originalSyncEnabled = syncConfig.enabled;
        
        try {
            // تعطيل المزامنة التلقائية
            syncConfig.enabled = false;
            Logger.info(`🔒 Sync middleware disabled for direct delete operation`);
            
            // حذف من Local
            await order.deleteOne();
            Logger.info(`✓ Deleted order ${orderNumber} from Local MongoDB`);
            
            // حذف من Atlas مباشرة
            const atlasConnection = dualDatabaseManager.getAtlasConnection();
            if (atlasConnection) {
                try {
                    const atlasOrdersCollection = atlasConnection.collection('orders');
                    const atlasDeleteResult = await atlasOrdersCollection.deleteOne({ _id: orderId });
                    Logger.info(`✓ Deleted order ${orderNumber} from Atlas (deletedCount: ${atlasDeleteResult.deletedCount})`);
                } catch (atlasError) {
                    Logger.warn(`⚠️ Failed to delete order from Atlas: ${atlasError.message}`);
                }
            } else {
                Logger.warn(`⚠️ Atlas connection not available - order will be synced later`);
            }
        } finally {
            // إعادة تفعيل المزامنة
            syncConfig.enabled = originalSyncEnabled;
            Logger.info(`🔓 Sync middleware re-enabled`);
        }

        // Emit Socket.IO event for order deletion
        if (req.io) {
            try {
                req.io.notifyOrderUpdate("deleted", { _id: req.params.id });
            } catch (socketError) {
                Logger.error('فشل إرسال حدث Socket.IO', socketError);
            }
        }

        // إرجاع الاستجابة مع معلومات الاسترداد
        const response = {
            success: true,
            message: "تم حذف الطلب بنجاح",
        };

        if (refundedAmount > 0) {
            response.message = `تم حذف الطلب بنجاح واسترداد ${refundedAmount} ج.م من الدفعات الجزئية`;
            response.refundedAmount = refundedAmount;
        }

        res.json(response);
    } catch (error) {
        Logger.error("خطأ في حذف الطلب", error);
        res.status(500).json({
            success: false,
            message: "خطأ في حذف الطلب",
            error: error.message,
        });
    }
};

// @desc    Get pending orders
// @route   GET /api/orders/pending
// @access  Private
export const getPendingOrders = async (req, res) => {
    try {
        const orders = await Order.find({
            status: { $in: ["pending", "preparing"] },
            organization: req.user.organization,
        })
            .populate("items.menuItem", "name arabicName preparationTime")
            .populate("bill", "billNumber customerName table")
            .populate({
                path: "bill",
                populate: {
                    path: "table",
                    select: "number name"
                }
            })
            .populate("createdBy", "name")
            .sort({ createdAt: 1 });

        res.json({
            success: true,
            data: orders,
            count: orders.length,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الطلبات المعلقة",
            error: error.message,
        });
    }
};

// @desc    Get order statistics
// @route   GET /api/orders/stats
// @access  Private
export const getOrderStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const filter = {};
        if (startDate && endDate) {
            filter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            };
        }

        const stats = await Order.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$finalAmount" },
                },
            },
        ]);

        const totalOrders = await Order.countDocuments(filter);
        const totalAmount = await Order.aggregate([
            { $match: filter },
            { $group: { _id: null, total: { $sum: "$finalAmount" } } },
        ]);

        res.json({
            success: true,
            data: {
                stats,
                totalOrders,
                totalAmount: totalAmount[0]?.total || 0,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب إحصائيات الطلبات",
            error: error.message,
        });
    }
};

// @desc    Cancel order
// @route   PATCH /api/orders/:id/cancel
// @access  Private
export const cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const order = await Order.findOne({
            _id: id,
            organization: req.user.organization,
        });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "الطلب غير موجود",
            });
        }

        if (order.status === "delivered") {
            return res.status(400).json({
                success: false,
                message: "لا يمكن إلغاء طلب مسلم",
            });
        }

        order.status = "cancelled";
        if (reason) {
            order.notes = order.notes
                ? `${order.notes}\nسبب الإلغاء: ${reason}`
                : `سبب الإلغاء: ${reason}`;
        }
        // إزالة ربط الطلب من الفاتورة وتحديث الفاتورة
        if (order.bill) {
            const Bill = (await import("../models/Bill.js")).default;
            const billDoc = await Bill.findById(order.bill); // بدون populate
            if (billDoc) {
                await Bill.updateOne(
                    { _id: order.bill },
                    { $pull: { orders: order._id } }
                );
                const billDocAfter = await Bill.findById(order.bill);
                if (billDocAfter) {
                    await billDocAfter.calculateSubtotal();
                    await billDocAfter.save();
                }
                order.bill = undefined;
            }
        }
        await order.save();

        res.json({
            success: true,
            message: "تم إلغاء الطلب بنجاح",
            data: order,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في إلغاء الطلب",
            error: error.message,
        });
    }
};

// @desc    Update order item status
// @route   PATCH /api/orders/:id/items/:itemIndex/status
// @access  Private
export const updateOrderItemStatus = async (req, res) => {
    try {
        const { id, itemIndex } = req.params;
        const { isReady } = req.body;

        const order = await Order.findOne({
            _id: id,
            organization: req.user.organization,
        });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "الطلب غير موجود",
            });
        }

        if (itemIndex < 0 || itemIndex >= order.items.length) {
            return res.status(400).json({
                success: false,
                message: "فهرس العنصر غير صحيح",
            });
        }

        order.items[itemIndex].isReady = isReady;
        if (isReady) {
            order.items[itemIndex].readyTime = new Date();
        }

        // Check if all items are ready
        const allItemsReady = order.items.every((item) => item.isReady);
        if (allItemsReady && order.status === "preparing") {
            order.status = "ready";
            order.actualReadyTime = new Date();
        }

        await order.save();

        res.json({
            success: true,
            message: "تم تحديث حالة العنصر بنجاح",
            data: order,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث حالة العنصر",
            error: error.message,
        });
    }
};

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private
export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: "حالة الطلب مطلوبة",
            });
        }

        const order = await Order.findOne({
            _id: id,
            organization: req.user.organization,
        });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "الطلب غير موجود",
            });
        }

        // تحقق قبل السماح بتغيير الحالة إلى delivered
        if (status === "delivered") {
            // يجب أن تكون كل الأصناف تم تجهيزها بالكامل (preparedCount === quantity)
            const allItemsReady = order.items.every(
                (item) => (item.preparedCount || 0) >= (item.quantity || 0)
            );
            if (!allItemsReady) {
                return res.status(400).json({
                    success: false,
                    message:
                        "لا يمكن تسليم الطلب إلا بعد تجهيز جميع الأصناف بالكامل.",
                });
            }
        }

        const updateData = { status };

        // Set preparedBy when status changes to preparing
        if (status === "preparing" && order.status === "pending") {
            updateData.preparedBy = req.user.id;
        }

        // Set deliveredBy when status changes to delivered
        if (status === "delivered" && order.status !== "delivered") {
            updateData.deliveredBy = req.user.id;
            updateData.deliveredTime = new Date();
        }

        // استرداد المخزون عند إلغاء الطلب
        if (status === "cancelled" && order.status !== "cancelled") {
            try {
                const MenuItem = (await import("../models/MenuItem.js"))
                    .default;
                const InventoryItem = (
                    await import("../models/InventoryItem.js")
                ).default;

                // دالة لتحويل الوحدات

                for (const item of order.items) {
                    if (
                        item.preparedCount &&
                        item.preparedCount > 0 &&
                        item.menuItem
                    ) {
                        const menuItem = await MenuItem.findById(item.menuItem);
                        if (
                            menuItem &&
                            menuItem.ingredients &&
                            menuItem.ingredients.length > 0
                        ) {
                            for (const ingredient of menuItem.ingredients) {
                                const inventoryItem =
                                    await InventoryItem.findById(
                                        ingredient.item
                                    );
                                if (inventoryItem) {
                                    // حساب الكمية المستردة مع التحويل
                                    const quantityToRestore =
                                        convertQuantity(
                                            ingredient.quantity,
                                            ingredient.unit,
                                            inventoryItem.unit
                                        ) * item.preparedCount;

                                    // استرداد المخزون
                                    await inventoryItem.addStockMovement(
                                        "in",
                                        quantityToRestore,
                                        `استرداد من إلغاء طلب رقم ${order.orderNumber}`,
                                        req.user._id,
                                        order._id.toString()
                                    );
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                // لا نوقف عملية الإلغاء إذا فشل استرداد المخزون
            }
        }

        const updatedOrder = await Order.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        })
            .populate("items.menuItem", "name arabicName")
            .populate("bill", "billNumber customerName")
            .populate("table", "number name")
            .populate("createdBy", "name")
            .populate("preparedBy", "name")
            .populate("deliveredBy", "name");

        // التحقق من أن الأصناف تم تحديثها بشكل صحيح
        if (status === "delivered" && updatedOrder) {
        }

        // Create notification for order status change
        try {
            if (status === "ready") {
                await NotificationService.createOrderNotification(
                    "ready",
                    updatedOrder,
                    req.user._id
                );
            } else if (status === "cancelled") {
                await NotificationService.createOrderNotification(
                    "cancelled",
                    updatedOrder,
                    req.user._id
                );
            }
        } catch (notificationError) {
            //
        }

        res.json({
            success: true,
            message: "تم تحديث حالة الطلب بنجاح",
            data: updatedOrder,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث حالة الطلب",
            error: error.message,
        });
    }
};

// @desc    Update preparedCount for an item in an order
// @route   PUT /api/orders/:orderId/item/:itemIndex/prepared
// @access  Private
export const updateOrderItemPrepared = async (req, res) => {
    try {
        const { orderId, itemIndex } = req.params;
        const { preparedCount } = req.body;

        const order = await Order.findOne({
            _id: orderId,
            organization: req.user.organization,
        });
        if (!order) {
            return res
                .status(404)
                .json({ success: false, message: "الطلب غير موجود" });
        }

        if (!order.items[itemIndex]) {
            return res
                .status(404)
                .json({ success: false, message: "العنصر غير موجود في الطلب" });
        }

        const currentItem = order.items[itemIndex];
        const previousPreparedCount = currentItem.preparedCount || 0;
        const newPreparedCount = Math.max(
            0,
            Math.min(preparedCount, currentItem.quantity)
        );

        // حساب الكمية المضافة (الفرق بين الجديد والقديم)
        const addedQuantity = newPreparedCount - previousPreparedCount;

        // خصم المخزون إذا تم إضافة كمية جديدة
        if (addedQuantity > 0 && currentItem.menuItem) {
            try {
                const MenuItem = (await import("../models/MenuItem.js"))
                    .default;
                const InventoryItem = (
                    await import("../models/InventoryItem.js")
                ).default;

                // دالة لتحويل الوحدات

                const menuItem = await MenuItem.findById(currentItem.menuItem);

                if (
                    menuItem &&
                    menuItem.ingredients &&
                    menuItem.ingredients.length > 0
                ) {
                    for (const ingredient of menuItem.ingredients) {
                        const inventoryItem = await InventoryItem.findById(
                            ingredient.item
                        );

                        if (inventoryItem) {
                            // حساب الكمية المطلوبة خصمها مع التحويل
                            const quantityToDeduct =
                                convertQuantity(
                                    ingredient.quantity,
                                    ingredient.unit,
                                    inventoryItem.unit
                                ) * addedQuantity;

                            // التحقق من توفر المخزون
                            if (inventoryItem.currentStock < quantityToDeduct) {
                                return res.status(400).json({
                                    success: false,
                                    message: `المخزون غير كافي لـ ${inventoryItem.name}. المطلوب: ${quantityToDeduct} ${inventoryItem.unit}، المتوفر: ${inventoryItem.currentStock} ${inventoryItem.unit}`,
                                });
                            }

                            // خصم المخزون
                            await inventoryItem.addStockMovement(
                                "out",
                                quantityToDeduct,
                                `استهلاك لتحضير ${currentItem.name} - طلب رقم ${order.orderNumber}`,
                                req.user._id,
                                order._id.toString()
                            );
                        }
                    }
                }
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    message: "خطأ في خصم المخزون",
                    error: error.message,
                });
            }
        }

        // تحديث العدد الجاهز مع التأكد من عدم تجاوز الكمية المطلوبة
        order.items[itemIndex].preparedCount = newPreparedCount;

        // تحديث isReady و wasEverReady تلقائياً
        if (newPreparedCount >= order.items[itemIndex].quantity) {
            order.items[itemIndex].isReady = true;
            order.items[itemIndex].wasEverReady = true;
        }

        // التحقق من حالة الطلب الكلية وتحديثها إذا لزم الأمر
        const allItemsReady = order.items.every((item) => item.isReady);
        const anyItemsPrepared = order.items.some(
            (item) => item.preparedCount > 0
        );

        if (allItemsReady && order.status !== "ready") {
            order.status = "ready";
            order.preparedAt = new Date();
            order.preparedBy = req.user._id;
        } else if (anyItemsPrepared && order.status === "pending") {
            order.status = "preparing";
            if (!order.preparedBy) {
                order.preparedBy = req.user._id;
            }
        }

        await order.save();

        // Populate the order with related data for response
        const updatedOrder = await Order.findById(order._id)
            .populate("items.menuItem", "name arabicName")
            .populate("bill", "billNumber customerName")
            .populate("table", "number name")
            .populate("createdBy", "name")
            .populate("preparedBy", "name")
            .populate("deliveredBy", "name");

        // Create notification for order status change
        try {
            if (order.status === "ready") {
                await NotificationService.createOrderNotification(
                    "ready",
                    updatedOrder,
                    req.user._id
                );
            }
        } catch (notificationError) {
            //
        }

        res.json({
            success: true,
            message: "تم تحديث عدد الأصناف الجاهزة بنجاح",
            data: updatedOrder,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث عدد الأصناف الجاهزة",
            error: error.message,
        });
    }
};

// @desc    Deduct all inventory for order preparation
// @route   POST /api/orders/:orderId/deduct-inventory
// @access  Private
export const deductOrderInventory = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findOne({
            _id: orderId,
            organization: req.user.organization,
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "الطلب غير موجود",
            });
        }

        // تجميع جميع المكونات المطلوبة من جميع الأصناف
        const allIngredientsNeeded = new Map(); // Map<inventoryItemId, { quantity, unit, itemName }>

        for (const item of order.items) {
            if (item.menuItem) {
                const menuItem = await MenuItem.findById(item.menuItem);
                if (
                    menuItem &&
                    menuItem.ingredients &&
                    menuItem.ingredients.length > 0
                ) {
                    for (const ingredient of menuItem.ingredients) {
                        const key = ingredient.item.toString();
                        const currentQuantity =
                            allIngredientsNeeded.get(key)?.quantity || 0;
                        const totalQuantity =
                            currentQuantity +
                            ingredient.quantity * item.quantity;

                        allIngredientsNeeded.set(key, {
                            quantity: totalQuantity,
                            unit: ingredient.unit,
                            itemName: menuItem.name,
                        });
                    }
                }
            }
        }

        // التحقق من توفر المخزون لجميع المكونات
        const insufficientItems = [];

        for (const [inventoryItemId, ingredientData] of allIngredientsNeeded) {
            const inventoryItem = await InventoryItem.findById(inventoryItemId);
            if (!inventoryItem) {
                insufficientItems.push({
                    name: ingredientData.itemName,
                    required: ingredientData.quantity,
                    available: 0,
                    unit: ingredientData.unit,
                });
                continue;
            }

            // تحويل الوحدات
            const convertedQuantityNeeded = convertQuantity(
                ingredientData.quantity,
                ingredientData.unit,
                inventoryItem.unit
            );

            if (inventoryItem.currentStock < convertedQuantityNeeded) {
                insufficientItems.push({
                    name: inventoryItem.name,
                    required: convertedQuantityNeeded,
                    available: inventoryItem.currentStock,
                    unit: inventoryItem.unit,
                });
            }
        }

        // إذا كان هناك مكونات ناقصة، إرجاع الخطأ
        if (insufficientItems.length > 0) {
            const errorMessage = insufficientItems
                .map(
                    (item) =>
                        `• ${item.name}: المطلوب ${item.required} ${item.unit}، المتوفر ${item.available} ${item.unit}`
                )
                .join("\n");

            return res.status(400).json({
                success: false,
                message: "المخزون غير كافي لتجهيز الطلب",
                details: insufficientItems,
                errorMessage,
            });
        }

        // خصم جميع المكونات دفعة واحدة
        const deductionPromises = [];

        for (const [inventoryItemId, ingredientData] of allIngredientsNeeded) {
            const inventoryItem = await InventoryItem.findById(inventoryItemId);
            if (inventoryItem) {
                const convertedQuantityNeeded = convertQuantity(
                    ingredientData.quantity,
                    ingredientData.unit,
                    inventoryItem.unit
                );

                const deductionPromise = inventoryItem.addStockMovement(
                    "out",
                    convertedQuantityNeeded,
                    `استهلاك لتحضير طلب رقم ${order.orderNumber} - ${ingredientData.itemName}`,
                    req.user._id,
                    order._id.toString()
                );

                deductionPromises.push(deductionPromise);
            }
        }

        // انتظار اكتمال جميع عمليات الخصم
        await Promise.all(deductionPromises);

        // تحديث حالة جميع الأصناف إلى مجهزة بالكامل
        for (let i = 0; i < order.items.length; i++) {
            order.items[i].preparedCount = order.items[i].quantity;
            order.items[i].isReady = true;
            order.items[i].wasEverReady = true;
        }

        // تحديث حالة الطلب
        order.status = "ready";
        order.preparedAt = new Date();
        order.preparedBy = req.user._id;

        await order.save();

        // Populate the order with related data for response
        const updatedOrder = await Order.findById(order._id)
            .populate("items.menuItem", "name arabicName")
            .populate("bill", "billNumber customerName")
            .populate("table", "number name")
            .populate("createdBy", "name")
            .populate("preparedBy", "name")
            .populate("deliveredBy", "name");

        // Create notification for order status change
        try {
            await NotificationService.createOrderNotification(
                "ready",
                updatedOrder,
                req.user._id
            );
        } catch (notificationError) {
            //
        }

        res.json({
            success: true,
            message: "تم خصم المخزون وتجهيز الطلب بنجاح",
            data: updatedOrder,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في خصم المخزون",
            error: error.message,
        });
    }
};

// @desc    Get today's orders statistics
// @route   GET /api/orders/today-stats
// @access  Private
export const getTodayOrdersStats = async (req, res) => {
    try {
        // Get today's date range
        const today = new Date();
        const startOfDay = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
        );
        const endOfDay = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() + 1
        );

        // Get all orders created today
        const todayOrders = await Order.find({
            createdAt: {
                $gte: startOfDay,
                $lt: endOfDay,
            },
            organization: req.user.organization,
        }).select("finalAmount totalAmount status createdAt");

        // Calculate statistics
        const totalOrders = todayOrders.length;
        const totalSales = todayOrders
            .filter((order) => order.status !== "cancelled")
            .reduce(
                (sum, order) =>
                    sum + (order.finalAmount || order.totalAmount || 0),
                0
            );

        // Group by status
        const ordersByStatus = todayOrders.reduce((acc, order) => {
            const status = order.status;
            if (!acc[status]) {
                acc[status] = { count: 0, amount: 0 };
            }
            acc[status].count++;
            acc[status].amount += order.finalAmount || order.totalAmount || 0;
            return acc;
        }, {});

        res.json({
            success: true,
            data: {
                totalOrders,
                totalSales,
                ordersByStatus,
                date: today.toISOString().split("T")[0],
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب إحصائيات طلبات اليوم",
            error: error.message,
        });
    }
};

// @desc    Deliver specific item in order
// @route   PUT /api/orders/:id/deliver-item/:itemIndex
// @access  Private
export const deliverItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { itemIndex } = req.params;

        const order = await Order.findOne({
            _id: id,
            organization: req.user.organization,
        });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "الطلب غير موجود",
            });
        }

        if (!order.items || !order.items[itemIndex]) {
            return res.status(404).json({
                success: false,
                message: "الصنف غير موجود في الطلب",
            });
        }

        const item = order.items[itemIndex];
        const currentPreparedCount = item.preparedCount || 0;
        const requiredQuantity = item.quantity || 0;

        // حساب العدد المطلوب إضافته للوصول للكمية الكاملة
        const remainingToDeliver = requiredQuantity - currentPreparedCount;

        if (remainingToDeliver <= 0) {
            return res.status(400).json({
                success: false,
                message: `${item.name} تم تسليمه بالكامل بالفعل`,
            });
        }

        // تحديث preparedCount للصنف إلى الكمية الكاملة (تم تسليمه)
        item.preparedCount = requiredQuantity;

        // التحقق من حالة الطلب الكلية وتحديثها إذا لزم الأمر
        const allItemsReady = order.items.every(
            (item) => (item.preparedCount || 0) >= (item.quantity || 0)
        );

        if (allItemsReady && order.status !== "delivered") {
            // إذا تم تسليم جميع الأصناف، الطلب أصبح delivered
            order.status = "delivered";
            order.deliveredTime = new Date();
            order.deliveredBy = req.user.id;

            // تحديث الفاتورة المرتبطة إذا وجدت
            if (order.bill) {
                try {
                    const bill = await Bill.findById(order.bill);
                    if (bill) {
                        // إعادة حساب إجمالي الفاتورة
                        await bill.calculateSubtotal();
                    }
                } catch (error) {
                    //
                }
            }
        }

        await order.save();

        // Populate the order for response
        await order.populate(
            ["createdBy", "preparedBy", "deliveredBy"],
            "name"
        );

        // Notify via Socket.IO
        if (req.io) {
            req.io.notifyOrderUpdate("item-delivered", order);
        }

        res.json({
            success: true,
            message: `تم تسليم ${item.name} بنجاح (${remainingToDeliver} من ${requiredQuantity})`,
            data: order,
            deliveredItem: {
                name: item.name,
                previousCount: currentPreparedCount,
                newCount: requiredQuantity,
                deliveredAmount: remainingToDeliver,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تسليم الصنف",
            error: error.message,
        });
    }
};
