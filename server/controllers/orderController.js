import Order from "../models/Order.js";
import InventoryItem from "../models/InventoryItem.js";
import MenuItem from "../models/MenuItem.js";
import Bill from "../models/Bill.js";
import Logger from "../middleware/logger.js";
import NotificationService from "../services/notificationService.js";
import mongoose from "mongoose";
import {
    convertQuantity,
    calculateTotalInventoryNeeded,
    validateInventoryAvailability,
    calculateOrderTotalCost,
    createOrderErrorMessages,
    createOrderSuccessMessages,
} from "../utils/orderUtils.js";

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
        console.error("Error in calculateOrderRequirements:", error);
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
        const { tableNumber, customerName, customerPhone, items, notes, bill } =
            req.body;

        // Validate items
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "يجب إضافة عنصر واحد على الأقل للطلب",
            });
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

        // حساب التكلفة الإجمالية للطلب
        const totalCost = await calculateOrderTotalCost(items);
        orderData.totalCost = totalCost;

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

        // إذا تم تحديث العناصر، تحقق من المخزون
        let calculatedTotalCost = 0; // متغير لتخزين التكلفة المحسوبة

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

        await order.save();

        // Populate the order with related data for response
        const updatedOrder = await Order.findById(order._id)
            .populate("items.menuItem", "name arabicName")
            .populate("bill", "billNumber customerName")
            .populate("createdBy", "name")
            .populate("preparedBy", "name")
            .populate("deliveredBy", "name");

        // Update bill totals if order is linked to a bill
        if (order.bill) {
            try {
                const billDoc = await Bill.findById(order.bill);
                if (billDoc) {
                    // Recalculate bill totals
                    await billDoc.calculateSubtotal();
                }
            } catch (error) {
                //
            }
        }

        res.json({
            success: true,
            message: "تم تحديث الطلب بنجاح",
            data: updatedOrder,
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
        console.error("Error deducting order inventory:", error);
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
