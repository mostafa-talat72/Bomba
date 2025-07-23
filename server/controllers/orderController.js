import Order from "../models/Order.js";
import InventoryItem from "../models/InventoryItem.js";
import MenuItem from "../models/MenuItem.js";
import Bill from "../models/Bill.js";
import Logger from "../middleware/logger.js";
import NotificationService from "../services/notificationService.js";

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private
export const getOrders = async (req, res) => {
    try {
        Logger.info("🔍 Getting orders with query:", req.query);

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

        Logger.info("🔍 Query:", query);

        const orders = await Order.find(query)
            .populate("createdBy", "name")
            .populate("preparedBy", "name")
            .populate("deliveredBy", "name")
            .populate("bill")
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        Logger.info("📋 Found orders:", orders.length);
        Logger.info("📋 Orders data:", orders);

        // Log details of each order
        orders.forEach((order, index) => {
            Logger.info(`📋 Order ${index + 1}:`, {
                _id: order._id,
                orderNumber: order.orderNumber,
                customerName: order.customerName,
                itemsCount: order.items ? order.items.length : 0,
                items: order.items,
                status: order.status,
                finalAmount: order.finalAmount,
            });
        });

        const total = await Order.countDocuments(query);

        res.json({
            success: true,
            count: orders.length,
            total,
            data: orders,
        });
    } catch (error) {
        Logger.error("❌ Error getting orders:", error);
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
        Logger.info("📝 Creating new order with data:", req.body);

        const { tableNumber, customerName, customerPhone, items, notes, bill } =
            req.body;

        // Validate items
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "يجب إضافة عنصر واحد على الأقل للطلب",
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

        Logger.info("💰 Order totals calculated:", {
            subtotal,
            finalAmount: orderData.finalAmount,
            itemsCount: processedItems.length,
        });

        Logger.info("📋 Processed items:", processedItems);
        Logger.info("📄 Order data:", orderData);

        const order = new Order(orderData);

        // Manual calculation as fallback
        order.finalAmount = order.subtotal - (order.discount || 0);

        Logger.info("💰 Final order amounts:", {
            subtotal: order.subtotal,
            discount: order.discount,
            finalAmount: order.finalAmount,
        });

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
        order.orderNumber = `ORD-${dateStr}-${String(count + 1).padStart(
            3,
            "0"
        )}`;

        Logger.info("🔢 Generated order number:", order.orderNumber);
        Logger.info("💾 Saving order...");

        await order.save();

        Logger.info("✅ Order saved successfully");

        // Populate the order with related data for response
        const populatedOrder = await Order.findById(order._id)
            .populate("createdBy", "name")
            .populate("bill")
            .populate("items.menuItem");

        Logger.info("📋 Final populated order:", populatedOrder);

        // Add order to bill if bill exists
        if (bill) {
            try {
                const billDoc = await Bill.findById(bill);
                if (billDoc) {
                    billDoc.orders.push(order._id);
                    await billDoc.save();
                    Logger.info("✅ Order added to bill:", billDoc.billNumber);

                    // Recalculate bill totals
                    await billDoc.calculateSubtotal();
                    Logger.info("✅ Bill totals recalculated");
                }
            } catch (error) {
                Logger.error("❌ Error adding order to bill:", error);
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
            Logger.error(
                "Failed to create order notification:",
                notificationError
            );
        }

        res.status(201).json({
            success: true,
            message: "تم إنشاء الطلب بنجاح",
            data: populatedOrder,
        });
    } catch (error) {
        Logger.error("❌ Error creating order:", error);

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
        const { status, notes, preparedBy, deliveredBy } = req.body;

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

        await order.save();
        await order.populate(
            ["createdBy", "preparedBy", "deliveredBy"],
            "name"
        );

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

        // Restore inventory if items were consumed
        for (const item of order.items) {
            if (item.inventoryItem) {
                const inventoryItem = await InventoryItem.findById(
                    item.inventoryItem
                );
                if (inventoryItem) {
                    await inventoryItem.addStockMovement(
                        "in",
                        item.quantity,
                        `استرداد من حذف طلب رقم ${order.orderNumber}`,
                        req.user._id,
                        order._id.toString()
                    );
                }
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
        Logger.info("🔍 Getting pending orders...");

        const orders = await Order.find({
            status: { $in: ["pending", "preparing"] },
            organization: req.user.organization,
        })
            .populate("items.menuItem", "name arabicName preparationTime")
            .populate("bill", "billNumber customerName tableNumber")
            .populate("createdBy", "name")
            .sort({ createdAt: 1 });

        Logger.info("📋 Found pending orders:", orders.length);

        // Log details of each order
        orders.forEach((order, index) => {
            Logger.info(`📋 Order ${index + 1}:`, {
                _id: order._id,
                orderNumber: order.orderNumber,
                customerName: order.customerName,
                itemsCount: order.items ? order.items.length : 0,
                items: order.items?.map((item) => ({
                    name: item.name,
                    quantity: item.quantity,
                    preparedCount: item.preparedCount || 0,
                })),
            });
        });

        res.json({
            success: true,
            data: orders,
            count: orders.length,
        });
    } catch (error) {
        Logger.error("❌ Error getting pending orders:", error);
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
        Logger.error("❌ Error getting order stats:", error);
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
            Logger.info("🚚 Order status changed to delivered");
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
            Logger.info("✅ Order delivered successfully - verifying items:");
            updatedOrder.items.forEach((item) => {
                Logger.info(
                    `📦 Item "${item.name}": preparedCount = ${item.preparedCount}`
                );
            });
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
            Logger.error(
                "Failed to create order status notification:",
                notificationError
            );
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

        Logger.info("🔄 Updating prepared count:", {
            orderId,
            itemIndex,
            preparedCount,
        });

        const order = await Order.findOne({
            _id: orderId,
            organization: req.user.organization,
        });
        if (!order) {
            Logger.error("❌ Order not found:", orderId);
            return res
                .status(404)
                .json({ success: false, message: "الطلب غير موجود" });
        }

        if (!order.items[itemIndex]) {
            Logger.error("❌ Item not found at index:", itemIndex);
            return res
                .status(404)
                .json({ success: false, message: "العنصر غير موجود في الطلب" });
        }

        Logger.info("📋 Before update - Item:", {
            name: order.items[itemIndex].name,
            quantity: order.items[itemIndex].quantity,
            preparedCount: order.items[itemIndex].preparedCount,
            isReady: order.items[itemIndex].isReady,
            wasEverReady: order.items[itemIndex].wasEverReady,
        });

        // تحديث العدد الجاهز مع التأكد من عدم تجاوز الكمية المطلوبة
        const newPreparedCount = Math.max(
            0,
            Math.min(preparedCount, order.items[itemIndex].quantity)
        );
        order.items[itemIndex].preparedCount = newPreparedCount;

        // تحديث isReady و wasEverReady تلقائياً
        if (newPreparedCount >= order.items[itemIndex].quantity) {
            order.items[itemIndex].isReady = true;
            order.items[itemIndex].wasEverReady = true;
        }
        // لا نضع isReady = false عند التسليم لأن الصنف كان جاهزاً مسبقاً

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
            Logger.info(
                "✅ Order status updated to ready (all items fully prepared)"
            );
        } else if (anyItemsPrepared && order.status !== "preparing") {
            // إذا كان هناك أي صنف مجهز، الطلب أصبح preparing
            order.status = "preparing";
            Logger.info(
                "✅ Order status updated to preparing (some items prepared)"
            );
        } else if (!anyItemsPrepared && order.status !== "pending") {
            // إذا لم تكن هناك أي أصناف مجهزة، الطلب أصبح pending
            order.status = "pending";
            Logger.info(
                "⚠ Order status updated to pending (no items prepared)"
            );
        }

        Logger.info("📋 After update - Item:", {
            name: order.items[itemIndex].name,
            quantity: order.items[itemIndex].quantity,
            preparedCount: order.items[itemIndex].preparedCount,
            isReady: order.items[itemIndex].isReady,
            wasEverReady: order.items[itemIndex].wasEverReady,
        });

        await order.save();
        Logger.info("✅ Order saved successfully");

        // إعادة تحميل الطلب مع البيانات المحدثة
        const updatedOrder = await Order.findById(order._id)
            .populate("items.menuItem", "name arabicName preparationTime")
            .populate("bill", "billNumber customerName tableNumber")
            .populate("createdBy", "name")
            .populate("preparedBy", "name")
            .populate("deliveredBy", "name")
            .lean(); // استخدام lean() للحصول على كائن JavaScript عادي

        if (!updatedOrder) {
            Logger.error("❌ Failed to reload updated order");
            return res.status(500).json({
                success: false,
                message: "خطأ في إعادة تحميل الطلب المحدث",
                error: "Order not found after update",
            });
        }

        Logger.info("📋 Updated order data:", {
            orderNumber: updatedOrder.orderNumber,
            itemsCount: updatedOrder.items?.length || 0,
            items: updatedOrder.items?.map((item) => ({
                name: item.name,
                quantity: item.quantity,
                preparedCount: item.preparedCount || 0,
                isReady: item.isReady,
                wasEverReady: item.wasEverReady,
            })),
        });

        // التحقق من حالة الطلب الكلية (بعد التحديث)
        const finalAllItemsReady = updatedOrder.items?.every(
            (item) => (item.preparedCount || 0) >= (item.quantity || 0)
        );
        const finalAnyItemsPrepared = updatedOrder.items?.some(
            (item) => (item.preparedCount || 0) > 0
        );
        // ملاحظة: الطلبات المُسلمة يجب أن يكون preparedCount = quantity (وليس 0)
        const finalAllItemsDelivered = updatedOrder.items?.every(
            (item) => (item.preparedCount || 0) === 0
        );
        const finalAllItemsWereReady = updatedOrder.items?.every(
            (item) => item.isReady === true
        );

        Logger.info("📋 Order overall status:", {
            allItemsReady: finalAllItemsReady,
            anyItemsPrepared: finalAnyItemsPrepared,
            allItemsDelivered: finalAllItemsDelivered,
            allItemsWereReady: finalAllItemsWereReady,
            currentStatus: updatedOrder.status,
        });

        return res.json({
            success: true,
            message: "تم تحديث حالة التجهيز بنجاح",
            data: updatedOrder,
            orderStatus: {
                allItemsReady: finalAllItemsReady,
                anyItemsPrepared: finalAnyItemsPrepared,
                allItemsDelivered: finalAllItemsDelivered,
                allItemsWereReady: finalAllItemsWereReady,
                shouldMoveToReady: finalAllItemsReady,
                shouldMoveToPending: !finalAnyItemsPrepared,
            },
        });
    } catch (error) {
        Logger.error("❌ Error updating preparedCount:", error);
        return res.status(500).json({
            success: false,
            message: "خطأ في تحديث حالة التجهيز",
            error: error.message,
        });
    }
};

// @desc    Get today's orders statistics
// @route   GET /api/orders/today-stats
// @access  Private
export const getTodayOrdersStats = async (req, res) => {
    try {
        Logger.info("📊 Getting today's orders statistics...");

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

        Logger.info("📅 Date range:", { startOfDay, endOfDay });

        // Get all orders created today
        const todayOrders = await Order.find({
            createdAt: {
                $gte: startOfDay,
                $lt: endOfDay,
            },
            organization: req.user.organization,
        }).select("finalAmount totalAmount status createdAt");

        Logger.info("📋 Found today's orders:", todayOrders.length);

        // Calculate statistics
        const totalOrders = todayOrders.length;
        const totalSales = todayOrders.reduce((sum, order) => {
            return sum + (order.finalAmount || order.totalAmount || 0);
        }, 0);

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

        Logger.info("📊 Today's statistics:", {
            totalOrders,
            totalSales,
            ordersByStatus,
        });

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
        Logger.error("❌ Error getting today's orders statistics:", error);
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

        Logger.info("🚚 Delivering item:", { orderId: id, itemIndex });

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
        Logger.info(
            `✅ Item ${item.name} delivered: ${currentPreparedCount} -> ${requiredQuantity}`
        );

        // التحقق من حالة الطلب الكلية وتحديثها إذا لزم الأمر
        const allItemsReady = order.items.every(
            (item) => (item.preparedCount || 0) >= (item.quantity || 0)
        );

        if (allItemsReady && order.status !== "delivered") {
            // إذا تم تسليم جميع الأصناف، الطلب أصبح delivered
            order.status = "delivered";
            order.deliveredTime = new Date();
            order.deliveredBy = req.user.id;
            Logger.info(
                "✅ Order status updated to delivered (all items fully delivered)"
            );

            // تحديث الفاتورة المرتبطة إذا وجدت
            if (order.bill) {
                try {
                    const bill = await Bill.findById(order.bill);
                    if (bill) {
                        // إعادة حساب إجمالي الفاتورة
                        await bill.calculateSubtotal();
                        Logger.info(
                            "✅ Bill totals recalculated after order delivery"
                        );
                    }
                } catch (error) {
                    Logger.error(
                        "❌ Error updating bill after order delivery:",
                        error
                    );
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
        Logger.error("❌ Error delivering item:", error);
        res.status(500).json({
            success: false,
            message: "خطأ في تسليم الصنف",
            error: error.message,
        });
    }
};
