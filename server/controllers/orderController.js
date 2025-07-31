import Order from "../models/Order.js";
import InventoryItem from "../models/InventoryItem.js";
import MenuItem from "../models/MenuItem.js";
import Bill from "../models/Bill.js";
import Logger from "../middleware/logger.js";
import NotificationService from "../services/notificationService.js";
import mongoose from "mongoose";

// دالة موحدة لتحويل الوحدات
const convertQuantity = (quantity, fromUnit, toUnit) => {
    const conversions = {
        // تحويلات الحجم
        لتر: { مل: 1000, لتر: 1 },
        مل: { لتر: 0.001, مل: 1 },
        // تحويلات الوزن
        كيلو: { جرام: 1000, كيلو: 1 },
        جرام: { كيلو: 0.001, جرام: 1 },
        كيلوجرام: { جرام: 1000, كيلو: 1, كيلوجرام: 1 },
        كيلوجرامات: { جرام: 1000, كيلو: 1, كيلوجرام: 1 },
        // الوحدات الأخرى
        قطعة: { قطعة: 1 },
        علبة: { علبة: 1 },
        كيس: { كيس: 1 },
        زجاجة: { زجاجة: 1 },
        حبة: { حبة: 1 },
        حبات: { حبة: 1 },
    };

    const conversionRate = conversions[fromUnit]?.[toUnit];
    const convertedQuantity = conversionRate
        ? quantity * conversionRate
        : quantity;

    return convertedQuantity;
};

// دالة مساعدة للتحقق من توفر المخزون
const checkInventoryAvailability = async (
    menuItemId,
    quantity,
    organization
) => {
    const menuItem = await MenuItem.findById(menuItemId);
    if (
        !menuItem ||
        !menuItem.ingredients ||
        menuItem.ingredients.length === 0
    ) {
        return { available: true, message: null };
    }

    const insufficientItems = [];

    for (const ingredient of menuItem.ingredients) {
        const inventoryItem = await InventoryItem.findOne({
            _id: ingredient.item,
            organization: organization,
        });

        if (!inventoryItem) {
            return {
                available: false,
                message: `الخامة ${ingredient.item} غير موجودة في المخزون`,
            };
        }

        // حساب الكمية المطلوبة للطلب مع التحويل
        const requiredQuantityForOrder =
            convertQuantity(
                ingredient.quantity,
                ingredient.unit,
                inventoryItem.unit
            ) * quantity;

        // التحقق من توفر المخزون
        if (inventoryItem.currentStock < requiredQuantityForOrder) {
            insufficientItems.push({
                name: inventoryItem.name,
                required: requiredQuantityForOrder,
                available: inventoryItem.currentStock,
                unit: inventoryItem.unit,
            });
        }
    }

    if (insufficientItems.length > 0) {
        const message = insufficientItems
            .map(
                (item) =>
                    `${item.name}: المطلوب ${item.required} ${item.unit}، المتوفر ${item.available} ${item.unit}`
            )
            .join(" | ");

        return {
            available: false,
            message: `المخزون غير كافي: ${message}`,
        };
    }

    return { available: true, message: null };
};

// دالة للتحقق من إجمالي استهلاك المكونات المشتركة في الطلب
const checkTotalInventoryForOrder = async (items, organization) => {
    // تجميع جميع المكونات المطلوبة من جميع الأصناف
    const totalIngredientsNeeded = {};

    for (const item of items) {
        if (!item.menuItem) continue;

        const menuItem = await MenuItem.findById(item.menuItem);
        if (
            !menuItem ||
            !menuItem.ingredients ||
            menuItem.ingredients.length === 0
        ) {
            continue;
        }

        for (const ingredient of menuItem.ingredients) {
            const ingredientKey = ingredient.item.toString();

            if (!totalIngredientsNeeded[ingredientKey]) {
                totalIngredientsNeeded[ingredientKey] = {
                    itemId: ingredient.item,
                    quantity: 0,
                    unit: null, // سنحدد الوحدة من المخزون
                    menuItems: [],
                };
            }

            // الحصول على معلومات المخزون لتحديد الوحدة
            const inventoryItem = await InventoryItem.findOne({
                _id: ingredient.item,
                organization: organization,
            });

            if (!inventoryItem) {
                return {
                    available: false,
                    message: `الخامة ${ingredient.item} غير موجودة في المخزون`,
                };
            }

            // تحديد الوحدة من المخزون إذا لم تكن محددة
            if (!totalIngredientsNeeded[ingredientKey].unit) {
                totalIngredientsNeeded[ingredientKey].unit = inventoryItem.unit;
            }

            // حساب الكمية المطلوبة لهذا الصنف مع التحويل
            const quantityForThisItem =
                convertQuantity(
                    ingredient.quantity,
                    ingredient.unit,
                    totalIngredientsNeeded[ingredientKey].unit
                ) * item.quantity;

            totalIngredientsNeeded[ingredientKey].quantity +=
                quantityForThisItem;
            totalIngredientsNeeded[ingredientKey].menuItems.push({
                name: menuItem.name,
                quantity: item.quantity,
                ingredientQuantity: quantityForThisItem,
            });
        }
    }

    // التحقق من توفر المخزون لكل مكون
    const insufficientItems = [];

    for (const [ingredientKey, ingredientData] of Object.entries(
        totalIngredientsNeeded
    )) {
        const inventoryItem = await InventoryItem.findOne({
            _id: ingredientData.itemId,
            organization: organization,
        });

        if (!inventoryItem) {
            return {
                available: false,
                message: `الخامة ${ingredientData.itemId} غير موجودة في المخزون`,
            };
        }

        if (inventoryItem.currentStock < ingredientData.quantity) {
            insufficientItems.push({
                name: inventoryItem.name,
                required: ingredientData.quantity,
                available: inventoryItem.currentStock,
                unit: inventoryItem.unit,
            });
        }
    }

    if (insufficientItems.length > 0) {
        const message = insufficientItems
            .map(
                (item) =>
                    `${item.name}: المطلوب ${item.required} ${item.unit}، المتوفر ${item.available} ${item.unit}`
            )
            .join(" | ");

        return {
            available: false,
            message: `المخزون غير كافي: ${message}`,
        };
    }

    return { available: true, message: null };
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private
export const getOrders = async (req, res) => {
    try {
        const { status, tableNumber, page = 1, limit = 10, date } = req.query;

        const query = {};
        if (status) query.status = status;
        if (tableNumber) query.tableNumber = tableNumber;
        query.organization = req.user.organization;

        // Filter by date if provided
        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);

            query.createdAt = {
                $gte: startDate,
                $lt: endDate,
            };
        }

        const orders = await Order.find(query)
            .populate("createdBy", "name")
            .populate("preparedBy", "name")
            .populate("deliveredBy", "name")
            .populate("bill")
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Order.countDocuments(query);

        res.json({
            success: true,
            count: orders.length,
            total,
            data: orders,
        });
    } catch (error) {
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

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const createOrder = async (req, res) => {
    try {
        const { tableNumber, customerName, customerPhone, items, notes, bill } =
            req.body;

        // Validate items
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "يجب إضافة عنصر واحد على الأقل للطلب",
            });
        }

        // التحقق من إجمالي المخزون لجميع الأصناف معاً
        const totalInventoryCheck = await checkTotalInventoryForOrder(
            items,
            req.user.organization
        );
        if (!totalInventoryCheck.available) {
            return res.status(400).json({
                success: false,
                message: totalInventoryCheck.message,
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

                // التحقق من توفر المخزون للعنصر
                if (menuItem.ingredients && menuItem.ingredients.length > 0) {
                    const inventoryCheck = await checkInventoryAvailability(
                        menuItem._id,
                        item.quantity,
                        req.user.organization
                    );

                    if (!inventoryCheck.available) {
                        return res.status(400).json({
                            success: false,
                            message: inventoryCheck.message,
                        });
                    }
                }

                // Calculate item total
                const itemTotal = menuItem.price * item.quantity;
                subtotal += itemTotal;
                processedItems.push({
                    menuItem: menuItem._id,
                    name: menuItem.name,
                    arabicName: menuItem.arabicName || menuItem.name,
                    price: menuItem.price,
                    quantity: item.quantity,
                    itemTotal,
                    notes: item.notes,
                    preparationTime: menuItem.preparationTime,
                });
            } else {
                // إذا لم يوجد menuItem، استخدم بيانات العنصر كما هي
                const itemTotal = item.price * item.quantity;
                subtotal += itemTotal;
                processedItems.push({
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    itemTotal,
                    notes: item.notes,
                    preparationTime: item.preparationTime || 0,
                });
            }
        }

        // Create order
        const orderData = {
            tableNumber,
            customerName,
            customerPhone,
            items: processedItems,
            subtotal,
            finalAmount: subtotal, // No discount initially
            notes,
            bill,
            createdBy: req.user.id,
            organization: req.user.organization,
        };

        // Manual calculation as fallback
        orderData.finalAmount = orderData.subtotal - (orderData.discount || 0);

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

        const order = new Order(orderData);

        await order.save();

        // Populate the order with related data for response
        const populatedOrder = await Order.findById(order._id)
            .populate("createdBy", "name")
            .populate("bill")
            .populate("items.menuItem");

        // Add order to bill if bill exists
        if (bill) {
            try {
                const billDoc = await Bill.findById(bill);
                if (billDoc) {
                    billDoc.orders.push(order._id);
                    await billDoc.save();

                    // Recalculate bill totals
                    await billDoc.calculateSubtotal();
                }
            } catch (error) {
                //
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

        res.status(201).json({
            success: true,
            message: "تم إنشاء الطلب بنجاح",
            data: populatedOrder,
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
            // التحقق من إجمالي المخزون لجميع الأصناف معاً
            const totalInventoryCheck = await checkTotalInventoryForOrder(
                items,
                req.user.organization
            );
            if (!totalInventoryCheck.available) {
                return res.status(400).json({
                    success: false,
                    message: totalInventoryCheck.message,
                });
            }

            // 1. تحديث أو إضافة الأصناف
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

                    // التحقق من توفر المخزون إذا زادت الكمية
                    if (
                        newQuantity > orderItem.quantity &&
                        orderItem.menuItem
                    ) {
                        const additionalQuantity =
                            newQuantity - orderItem.quantity;
                        const inventoryCheck = await checkInventoryAvailability(
                            orderItem.menuItem,
                            additionalQuantity,
                            req.user.organization
                        );

                        if (!inventoryCheck.available) {
                            return res.status(400).json({
                                success: false,
                                message: `لا يمكن زيادة الكمية: ${inventoryCheck.message}`,
                            });
                        }
                    }

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
                    // إضافة صنف جديد - التحقق من توفر المخزون
                    if (updatedItem.menuItem) {
                        const inventoryCheck = await checkInventoryAvailability(
                            updatedItem.menuItem,
                            updatedItem.quantity,
                            req.user.organization
                        );

                        if (!inventoryCheck.available) {
                            return res.status(400).json({
                                success: false,
                                message: inventoryCheck.message,
                            });
                        }

                        const MenuItem = (await import("../models/MenuItem.js"))
                            .default;
                        const menuItem = await MenuItem.findById(
                            updatedItem.menuItem
                        );
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
                                if (!inventoryItem) {
                                    return res.status(400).json({
                                        success: false,
                                        message: `الخامة ${ingredient.item} غير موجودة في المخزون`,
                                    });
                                }

                                // حساب الكمية المطلوبة للطلب مع التحويل
                                const requiredQuantityForOrder =
                                    convertQuantity(
                                        ingredient.quantity,
                                        ingredient.unit,
                                        inventoryItem.unit
                                    ) * updatedItem.quantity;

                                // التحقق من توفر المخزون
                                if (
                                    inventoryItem.currentStock <
                                    requiredQuantityForOrder
                                ) {
                                    return res.status(400).json({
                                        success: false,
                                        message: `المخزون غير كافي لـ ${inventoryItem.name}. المطلوب: ${requiredQuantityForOrder} ${inventoryItem.unit}، المتوفر: ${inventoryItem.currentStock} ${inventoryItem.unit}`,
                                    });
                                }
                            }
                        }
                    }

                    // إضافة صنف جديد
                    order.items.push({
                        menuItem: updatedItem.menuItem,
                        name: updatedItem.name,
                        price: updatedItem.price,
                        quantity: updatedItem.quantity,
                        notes: updatedItem.notes || "",
                        itemTotal: updatedItem.price * updatedItem.quantity,
                    });
                }
            }
            // 2. حذف الأصناف التي لم تعد موجودة في القائمة الجديدة
            order.items = order.items.filter((item) => {
                return items.some((updatedItem) => {
                    if (updatedItem.menuItem) {
                        return (
                            item.menuItem?.toString() ===
                            updatedItem.menuItem.toString()
                        );
                    } else {
                        return item.name === updatedItem.name;
                    }
                });
            });
        }

        // أعد حساب subtotal و finalAmount
        if (order.items && order.items.length > 0) {
            order.subtotal = order.items.reduce((total, item) => {
                const itemTotal = item.price * item.quantity;
                item.itemTotal = itemTotal;
                return total + itemTotal;
            }, 0);
        } else {
            order.subtotal = 0;
        }
        order.finalAmount = order.subtotal - (order.discount || 0);

        await order.save();
        await order.populate(
            ["createdBy", "preparedBy", "deliveredBy"],
            "name"
        );

        // تحديث الفاتورة إذا كان الطلب مرتبطًا بفاتورة
        if (order.bill) {
            const Bill = (await import("../models/Bill.js")).default;
            const billDoc = await Bill.findById(order.bill);
            if (billDoc) {
                await billDoc.calculateSubtotal();
                await billDoc.save();
            }
        }

        // Notify via Socket.IO
        if (req.io) {
            req.io.notifyOrderUpdate("status-changed", order);
        }

        res.json({
            success: true,
            message: "تم تحديث الطلب بنجاح",
            data: order,
        });
    } catch (error) {
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

        // Only allow deletion if order is pending
        if (order.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "لا يمكن حذف طلب تم البدء في تحضيره",
            });
        }

        // استرداد المخزون إذا كان الطلب يحتوي على عناصر مجهزة
        try {
            const MenuItem = (await import("../models/MenuItem.js")).default;
            const InventoryItem = (await import("../models/InventoryItem.js"))
                .default;

            // دالة لتحويل الوحدات
            const convertQuantity = (quantity, fromUnit, toUnit) => {
                const conversions = {
                    // تحويلات الحجم
                    لتر: { مل: 1000, لتر: 1 },
                    مل: { لتر: 0.001, مل: 1 },
                    // تحويلات الوزن
                    كيلو: { جرام: 1000, كيلو: 1 },
                    جرام: { كيلو: 0.001, جرام: 1 },
                    // الوحدات الأخرى
                    قطعة: { قطعة: 1 },
                    علبة: { علبة: 1 },
                    كيس: { كيس: 1 },
                    زجاجة: { زجاجة: 1 },
                };

                const conversionRate = conversions[fromUnit]?.[toUnit];
                return conversionRate ? quantity * conversionRate : quantity;
            };

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
                            const inventoryItem = await InventoryItem.findById(
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
                                    `استرداد من حذف طلب رقم ${order.orderNumber}`,
                                    req.user._id,
                                    order._id.toString()
                                );
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error restoring inventory:", error);
            // لا نوقف عملية الحذف إذا فشل استرداد المخزون
        }

        // Remove order from bill.orders if linked to a bill
        if (order.bill) {
            const Bill = (await import("../models/Bill.js")).default;
            const orderIdStr = order._id.toString();
            let billDoc = await Bill.findById(order.bill); // بدون populate
            if (billDoc) {
                billDoc.orders = billDoc.orders.filter(
                    (id) => id.toString() !== orderIdStr
                );
                await billDoc.save();
            }
        }

        await order.deleteOne();

        res.json({
            success: true,
            message: "تم حذف الطلب بنجاح",
        });
    } catch (error) {
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
            .populate("bill", "billNumber customerName tableNumber")
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
                const convertQuantity = (quantity, fromUnit, toUnit) => {
                    const conversions = {
                        // تحويلات الحجم
                        لتر: { مل: 1000, لتر: 1 },
                        مل: { لتر: 0.001, مل: 1 },
                        // تحويلات الوزن
                        كيلو: { جرام: 1000, كيلو: 1 },
                        جرام: { كيلو: 0.001, جرام: 1 },
                        // الوحدات الأخرى
                        قطعة: { قطعة: 1 },
                        علبة: { علبة: 1 },
                        كيس: { كيس: 1 },
                        زجاجة: { زجاجة: 1 },
                    };

                    const conversionRate = conversions[fromUnit]?.[toUnit];
                    return conversionRate
                        ? quantity * conversionRate
                        : quantity;
                };

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
                                    // حساب الكمية المستردة
                                    const quantityToRestore =
                                        ingredient.quantity *
                                        item.preparedCount;

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
                console.error(
                    "Error restoring inventory on cancellation:",
                    error
                );
                // لا نوقف عملية الإلغاء إذا فشل استرداد المخزون
            }
        }

        const updatedOrder = await Order.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        })
            .populate("items.menuItem", "name arabicName")
            .populate("bill", "billNumber customerName")
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
                const convertQuantity = (quantity, fromUnit, toUnit) => {
                    const conversions = {
                        // تحويلات الحجم
                        لتر: { مل: 1000, لتر: 1 },
                        مل: { لتر: 0.001, مل: 1 },
                        // تحويلات الوزن
                        كيلو: { جرام: 1000, كيلو: 1 },
                        جرام: { كيلو: 0.001, جرام: 1 },
                        // الوحدات الأخرى
                        قطعة: { قطعة: 1 },
                        علبة: { علبة: 1 },
                        كيس: { كيس: 1 },
                        زجاجة: { زجاجة: 1 },
                    };

                    const conversionRate = conversions[fromUnit]?.[toUnit];
                    return conversionRate
                        ? quantity * conversionRate
                        : quantity;
                };

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
                console.error("Error deducting inventory:", error);
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
        const allItemsReady = order.items.every(
            (item) => (item.preparedCount || 0) >= (item.quantity || 0)
        );
        const anyItemsPrepared = order.items.some(
            (item) => (item.preparedCount || 0) > 0
        );

        // تحديث حالة الطلب بناءً على حالة الأصناف - نظام مبسط
        if (allItemsReady && order.status !== "ready") {
            // إذا تم تجهيز جميع الأصناف بالكامل، الطلب أصبح ready
            order.status = "ready";
            order.actualReadyTime = new Date();
        } else if (anyItemsPrepared && order.status !== "preparing") {
            // إذا كان هناك أي صنف مجهز، الطلب أصبح preparing
            order.status = "preparing";
        } else if (!anyItemsPrepared && order.status !== "pending") {
            // إذا لم تكن هناك أي أصناف مجهزة، الطلب أصبح pending
            order.status = "pending";
        }

        await order.save();

        // إعادة تحميل الطلب مع البيانات المحدثة
        const updatedOrder = await Order.findById(order._id)
            .populate("items.menuItem", "name arabicName preparationTime")
            .populate("bill", "billNumber customerName tableNumber")
            .populate("createdBy", "name")
            .populate("preparedBy", "name")
            .populate("deliveredBy", "name")
            .lean(); // استخدام lean() للحصول على كائن JavaScript عادي

        if (!updatedOrder) {
            return res.status(500).json({
                success: false,
                message: "خطأ في إعادة تحميل الطلب المحدث",
                error: "Order not found after update",
            });
        }

        // التحقق من حالة الطلب الكلية (بعد التحديث)
        const finalAllItemsReady = updatedOrder.items?.every(
            (item) => (item.preparedCount || 0) >= (item.quantity || 0)
        );
        const finalAnyItemsPrepared = updatedOrder.items?.some(
            (item) => (item.preparedCount || 0) > 0
        );

        // تحديث حالة الطلب النهائية إذا لزم الأمر
        if (finalAllItemsReady && updatedOrder.status !== "ready") {
            await Order.findByIdAndUpdate(order._id, {
                status: "ready",
                actualReadyTime: new Date(),
            });
            updatedOrder.status = "ready";
            updatedOrder.actualReadyTime = new Date();
        } else if (
            finalAnyItemsPrepared &&
            updatedOrder.status !== "preparing"
        ) {
            await Order.findByIdAndUpdate(order._id, { status: "preparing" });
            updatedOrder.status = "preparing";
        } else if (
            !finalAnyItemsPrepared &&
            updatedOrder.status !== "pending"
        ) {
            await Order.findByIdAndUpdate(order._id, { status: "pending" });
            updatedOrder.status = "pending";
        }

        // Notify via Socket.IO
        if (req.io) {
            req.io.notifyOrderUpdate("item-prepared", updatedOrder);
        }

        res.json({
            success: true,
            message: `تم تحديث عدد التجهيز لـ ${currentItem.name} إلى ${newPreparedCount}`,
            data: updatedOrder,
            preparedItem: {
                name: currentItem.name,
                previousCount: previousPreparedCount,
                newCount: newPreparedCount,
                addedAmount: addedQuantity,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث عدد التجهيز",
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

// @desc    Check inventory availability for menu item
// @route   POST /api/orders/check-inventory
// @access  Private
export const checkInventoryForMenuItem = async (req, res) => {
    try {
        const { menuItemId, quantity } = req.body;

        if (!menuItemId || !quantity) {
            return res.status(400).json({
                success: false,
                message: "معرف الصنف والكمية مطلوبان",
            });
        }

        const inventoryCheck = await checkInventoryAvailability(
            menuItemId,
            quantity,
            req.user.organization
        );

        if (!inventoryCheck.available) {
            return res.status(400).json({
                success: false,
                message: inventoryCheck.message,
            });
        }

        res.json({
            success: true,
            message: "المخزون متوفر",
            data: {
                available: true,
                menuItemId,
                quantity,
            },
        });
    } catch (error) {
        console.error("Error in checkInventoryForMenuItem:", error);
        res.status(500).json({
            success: false,
            message: "خطأ في التحقق من المخزون",
            error: error.message,
        });
    }
};

// @desc    Check total inventory for order items
// @route   POST /api/orders/check-total-inventory
// @access  Private
export const checkTotalInventoryForOrderItems = async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "يجب إرسال قائمة الأصناف",
            });
        }

        const totalInventoryCheck = await checkTotalInventoryForOrder(
            items,
            req.user.organization
        );

        if (!totalInventoryCheck.available) {
            return res.status(400).json({
                success: false,
                message: totalInventoryCheck.message,
            });
        }

        res.json({
            success: true,
            message: "المخزون الإجمالي متوفر",
            data: {
                available: true,
                itemsCount: items.length,
            },
        });
    } catch (error) {
        console.error("Error in checkTotalInventoryForOrderItems:", error);
        res.status(500).json({
            success: false,
            message: "خطأ في التحقق من المخزون الإجمالي",
            error: error.message,
        });
    }
};
