import mongoose from "mongoose";
import Bill from "../models/Bill.js";
import Order from "../models/Order.js";
import Session from "../models/Session.js";
import Logger from "../middleware/logger.js";
import NotificationService from "../services/notificationService.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import { sendSubscriptionNotification } from "./notificationController.js";
import { createFawryPayment } from "../services/fawryService.js";

// @desc    Get all bills
// @route   GET /api/bills
// @access  Private
export const getBills = async (req, res) => {
    try {
        const {
            status,
            tableNumber,
            page = 1,
            limit = 10,
            date,
            customerName,
        } = req.query;

        const query = {};
        if (status) query.status = status;
        if (tableNumber) query.tableNumber = tableNumber;
        if (customerName)
            query.customerName = { $regex: customerName, $options: "i" };
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

        const bills = await Bill.find({
            organization: req.user.organization,
            ...query,
        })
            .populate({
                path: "orders",
                populate: {
                    path: "items.menuItem",
                    select: "name arabicName preparationTime",
                },
            })
            .populate({
                path: "sessions",
                populate: {
                    path: "createdBy",
                    select: "name",
                },
            })
            .populate("createdBy", "name")
            .populate("updatedBy", "name")
            .populate("payments.user", "name")
            .populate("partialPayments.items.paidBy", "name")
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        // Update bills that have orders but zero total
        for (const bill of bills) {
            if (bill.orders && bill.orders.length > 0 && bill.total === 0) {
                await bill.calculateSubtotal();
            }
        }

        const total = await Bill.countDocuments(query);

        res.json({
            success: true,
            count: bills.length,
            total,
            data: bills,
        });
    } catch (error) {
        Logger.error("خطأ في جلب الفواتير", error);
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الفواتير",
            error: error.message,
        });
    }
};

// @desc    Get single bill
// @route   GET /api/billing/:id
// @access  Public (for QR code access)
export const getBill = async (req, res) => {
    try {
        // إذا كان الطلب من /public/:id (أي لم يوجد req.user أو organization)
        if (!req.user || !req.user.organization) {
            // السماح بعرض الفاتورة للجميع إذا كان الطلب من المسار العام
            const bill = await Bill.findOne({ _id: req.params.id })
                .populate({
                    path: "orders",
                    populate: [
                        {
                            path: "items.menuItem",
                            select: "name arabicName preparationTime price",
                        },
                        {
                            path: "createdBy",
                            select: "name",
                        },
                    ],
                })
                .populate({
                    path: "sessions",
                    populate: {
                        path: "createdBy",
                        select: "name",
                    },
                })
                .populate("createdBy", "name")
                .populate("updatedBy", "name")
                .populate("payments.user", "name")
                .populate("partialPayments.items.paidBy", "name");
            if (!bill) {
                return res.status(404).json({
                    success: false,
                    message: "الفاتورة غير موجودة",
                });
            }
            // لا نتحقق من حالة الفاتورة هنا (نسمح بعرض أي فاتورة)
            return res.json({
                success: true,
                data: bill,
            });
        }
        // تحقق من وجود المستخدم والمنشأة للمسار المحمي
        if (!req.user || !req.user.organization) {
            return res.status(401).json({
                success: false,
                message:
                    "المستخدم غير مصرح أو لا يوجد منشأة مرتبطة به. يرجى إعادة تسجيل الدخول.",
            });
        }
        // تحقق من صحة معرف الفاتورة
        if (!req.params.id || req.params.id.length !== 24) {
            return res.status(400).json({
                success: false,
                message: "معرف الفاتورة غير صحيح",
            });
        }
        // جلب الفاتورة للمستخدم المسجل والمنشأة
        const bill = await Bill.findOne({
            _id: req.params.id,
            organization: req.user.organization,
        })
            .populate({
                path: "orders",
                populate: [
                    {
                        path: "items.menuItem",
                        select: "name arabicName preparationTime price",
                    },
                    {
                        path: "createdBy",
                        select: "name",
                    },
                ],
            })
            .populate({
                path: "sessions",
                populate: {
                    path: "createdBy",
                    select: "name",
                },
            })
            .populate("createdBy", "name")
            .populate("updatedBy", "name")
            .populate("payments.user", "name")
            .populate("partialPayments.items.paidBy", "name");
        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "الفاتورة غير موجودة أو غير مصرح لك بالوصول إليها",
            });
        }
        return res.json({
            success: true,
            data: bill,
        });
    } catch (error) {
        Logger.error("خطأ في جلب الفاتورة", error);
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الفاتورة",
            error: error.message,
        });
    }
};

// @desc    Create new bill
// @route   POST /api/bills
// @access  Private
export const createBill = async (req, res) => {
    try {
        const {
            customerName,
            customerPhone,
            orders,
            sessions,
            discount,
            tax,
            notes,
            billType,
            dueDate,
        } = req.body;

        // Validate required fields
        if (!req.user || !req.user._id) {
            Logger.error("يجب تسجيل الدخول أولاً", "No user found in request");
            return res.status(401).json({
                success: false,
                message: "يجب تسجيل الدخول أولاً",
            });
        }

        // Validate sessions if provided
        if (sessions && sessions.length > 0) {
            try {
                const sessionIds = sessions.map(
                    (id) => new mongoose.Types.ObjectId(id)
                );
                const existingSessions = await Session.find({
                    _id: { $in: sessionIds },
                });

                if (existingSessions.length !== sessions.length) {
                    Logger.error(
                        "بعض الجلسات غير موجودة",
                        "Some sessions not found"
                    );
                    return res.status(400).json({
                        success: false,
                        message: "بعض الجلسات غير موجودة",
                    });
                }
            } catch (error) {
                Logger.error(
                    "معرفات الجلسات غير صحيحة",
                    "Invalid session IDs",
                    error
                );
                return res.status(400).json({
                    success: false,
                    message: "معرفات الجلسات غير صحيحة",
                });
            }
        }

        const bill = await Bill.create({
            customerName,
            customerPhone,
            orders: orders || [],
            sessions: sessions || [],
            discount: discount || 0,
            tax: tax || 0,
            notes,
            billType: billType || "cafe",
            dueDate,
            createdBy: req.user._id,
            organization: req.user.organization,
        });

        // Calculate subtotal from orders and sessions (only if there are orders or sessions)
        if (
            (orders && orders.length > 0) ||
            (sessions && sessions.length > 0)
        ) {
            await bill.calculateSubtotal();
        }

        // Update orders and sessions to reference this bill
        if (orders && orders.length > 0) {
            await Order.updateMany(
                { _id: { $in: orders } },
                { bill: bill._id }
            );
        }

        if (sessions && sessions.length > 0) {
            await Session.updateMany(
                { _id: { $in: sessions } },
                { bill: bill._id }
            );
        }

        await bill.populate(["orders", "sessions", "createdBy"], "name");

        // Notify via Socket.IO
        if (req.io) {
            req.io.notifyBillUpdate("created", bill);
        }

        // Create notification for new bill
        try {
            await NotificationService.createBillingNotification(
                "created",
                bill,
                req.user._id
            );
        } catch (notificationError) {
            Logger.error(
                "Failed to create bill notification:",
                notificationError
            );
        }

        res.status(201).json({
            success: true,
            message: "تم إنشاء الفاتورة بنجاح",
            data: bill,
        });
    } catch (error) {
        Logger.error("خطأ في إنشاء الفاتورة", error);
        Logger.error("Error stack:", error.stack);
        res.status(500).json({
            success: false,
            message: "خطأ في إنشاء الفاتورة",
            error: error.message,
        });
    }
};

// @desc    Update bill
// @route   PUT /api/bills/:id
// @access  Private
export const updateBill = async (req, res) => {
    try {
        const { customerName, customerPhone, discount, tax, notes, dueDate } =
            req.body;

        const bill = await Bill.findById(req.params.id);

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "الفاتورة غير موجودة",
            });
        }

        // Don't allow updates if bill is paid
        if (bill.status === "paid") {
            return res.status(400).json({
                success: false,
                message: "لا يمكن تعديل فاتورة مدفوعة بالكامل",
            });
        }

        // Update fields
        if (customerName !== undefined) bill.customerName = customerName;
        if (customerPhone !== undefined) bill.customerPhone = customerPhone;
        if (discount !== undefined) bill.discount = discount;
        if (tax !== undefined) bill.tax = tax;
        if (notes !== undefined) bill.notes = notes;
        if (dueDate !== undefined) bill.dueDate = dueDate;

        bill.updatedBy = req.user._id;

        // Recalculate totals
        await bill.calculateSubtotal();

        await bill.populate(
            ["orders", "sessions", "createdBy", "updatedBy"],
            "name"
        );

        const prevStatus = bill.status;
        const updatedBill = await bill.save();

        if (prevStatus !== "paid" && updatedBill.status === "paid") {
            try {
                await NotificationService.createBillNotification(
                    "paid",
                    updatedBill,
                    req.user._id
                );
            } catch (notificationError) {
                Logger.error(
                    "Failed to create bill paid notification:",
                    notificationError
                );
            }
        }

        res.json({
            success: true,
            message: "تم تحديث الفاتورة بنجاح",
            data: bill,
        });
    } catch (error) {
        Logger.error("خطأ في تحديث الفاتورة", error);
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث الفاتورة",
            error: error.message,
        });
    }
};

// @desc    Add payment to bill
// @route   POST /api/bills/:id/payment
// @access  Private
export const addPayment = async (req, res) => {
    try {
        const {
            amount,
            method,
            reference,
            paid,
            remaining,
            status,
            paymentAmount,
        } = req.body;

        const bill = await Bill.findById(req.params.id);

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "الفاتورة غير موجودة",
            });
        }

        // إذا تم إرسال البيانات المحدثة مباشرة (من الفرونت إند الجديد)
        if (
            paid !== undefined &&
            remaining !== undefined &&
            status !== undefined
        ) {
            bill.paid = paid;
            bill.remaining = remaining;
            bill.status = status;

            // إضافة الدفع الجديد إلى قائمة المدفوعات
            if (paymentAmount && paymentAmount > 0) {
                await bill.addPayment(
                    paymentAmount,
                    method || "cash",
                    req.user._id,
                    reference
                );
            }

            bill.updatedBy = req.user._id;
            await bill.save();
        } else {
            // الطريقة القديمة (للتوافق مع الكود القديم)
            if (amount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "مبلغ الدفع يجب أن يكون أكبر من صفر",
                });
            }

            if (bill.remaining < amount) {
                return res.status(400).json({
                    success: false,
                    message: "مبلغ الدفع أكبر من المبلغ المتبقي",
                });
            }

            await bill.addPayment(amount, method, req.user._id, reference);
        }

        await bill.populate(
            ["orders", "sessions", "createdBy", "updatedBy", "payments.user"],
            "name"
        );

        // Notify via Socket.IO
        if (req.io) {
            req.io.notifyBillUpdate("payment-received", bill);
        }

        // Create notification for payment
        try {
            if (bill.status === "paid") {
                await NotificationService.createBillingNotification(
                    "paid",
                    bill,
                    req.user._id
                );
            } else if (bill.paid > 0) {
                await NotificationService.createBillingNotification(
                    "partial_payment",
                    bill,
                    req.user._id
                );
            }
        } catch (notificationError) {
            Logger.error(
                "Failed to create payment notification:",
                notificationError
            );
        }

        res.json({
            success: true,
            message: "تم تسجيل الدفع بنجاح",
            data: bill,
        });
    } catch (error) {
        Logger.error("خطأ في تسجيل الدفع", error);
        res.status(500).json({
            success: false,
            message: "خطأ في تسجيل الدفع",
            error: error.message,
        });
    }
};

// @desc    Add order to bill
// @route   POST /api/bills/:id/orders
// @access  Private
export const addOrderToBill = async (req, res) => {
    try {
        const { orderId } = req.body;

        const bill = await Bill.findById(req.params.id);

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "الفاتورة غير موجودة",
            });
        }

        if (bill.status === "paid") {
            return res.status(400).json({
                success: false,
                message: "لا يمكن إضافة طلبات لفاتورة مدفوعة",
            });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "الطلب غير موجود",
            });
        }

        if (order.bill) {
            return res.status(400).json({
                success: false,
                message: "الطلب مرتبط بفاتورة أخرى",
            });
        }

        // Add order to bill
        bill.orders.push(orderId);
        order.bill = bill._id;

        await Promise.all([bill.save(), order.save()]);

        // Recalculate totals
        await bill.calculateSubtotal();

        await bill.populate(
            ["orders", "sessions", "createdBy", "partialPayments.items.paidBy"],
            "name"
        );

        res.json({
            success: true,
            message: "تم إضافة الطلب للفاتورة بنجاح",
            data: bill,
        });
    } catch (error) {
        Logger.error("خطأ في إضافة الطلب للفاتورة", error);
        res.status(500).json({
            success: false,
            message: "خطأ في إضافة الطلب للفاتورة",
            error: error.message,
        });
    }
};

// @desc    Add session to bill
// @route   POST /api/bills/:id/sessions
// @access  Private
export const addSessionToBill = async (req, res) => {
    try {
        const { sessionId } = req.body;

        const bill = await Bill.findById(req.params.id);

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "الفاتورة غير موجودة",
            });
        }

        if (bill.status === "paid") {
            return res.status(400).json({
                success: false,
                message: "لا يمكن إضافة جلسات لفاتورة مدفوعة",
            });
        }

        const session = await Session.findById(sessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "الجلسة غير موجودة",
            });
        }

        if (session.status !== "completed") {
            return res.status(400).json({
                success: false,
                message: "لا يمكن إضافة جلسة غير مكتملة للفاتورة",
            });
        }

        // Add session to bill
        bill.sessions.push(sessionId);

        await bill.save();

        // Recalculate totals
        await bill.calculateSubtotal();

        await bill.populate(["orders", "sessions", "createdBy"], "name");

        res.json({
            success: true,
            message: "تم إضافة الجلسة للفاتورة بنجاح",
            data: bill,
        });
    } catch (error) {
        Logger.error("خطأ في إضافة الجلسة للفاتورة", error);
        res.status(500).json({
            success: false,
            message: "خطأ في إضافة الجلسة للفاتورة",
            error: error.message,
        });
    }
};

// @desc    Get bill by QR code
// @route   GET /api/bills/qr/:billId
// @access  Public
export const getBillByQR = async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.billId)
            .populate("orders")
            .populate("sessions")
            .select("-payments -createdBy -updatedBy");

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "الفاتورة غير موجودة",
            });
        }
        if (!["paid", "partial"].includes(bill.status)) {
            return res.status(403).json({
                success: false,
                message:
                    "لا يمكن عرض الفاتورة إلا إذا كانت مدفوعة أو مدفوعة جزئياً.",
            });
        }
        res.json({
            success: true,
            data: bill,
        });
    } catch (error) {
        Logger.error("خطأ في جلب الفاتورة", error);
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الفاتورة",
            error: error.message,
        });
    }
};

// @desc    Cancel bill
// @route   PUT /api/bills/:id/cancel
// @access  Private
export const cancelBill = async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id);

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "الفاتورة غير موجودة",
            });
        }

        // تحذير إذا كان هناك مدفوعات جزئية
        if (bill.paid > 0) {
            // لا نمنع الإلغاء، فقط نعطي تحذير
        }

        bill.status = "cancelled";
        bill.updatedBy = req.user._id;
        bill.subtotal = 0;
        bill.total = 0;
        bill.remaining = 0;
        await bill.save();

        // Remove bill reference from orders and sessions
        await Order.updateMany({ bill: bill._id }, { $unset: { bill: 1 } });

        await Session.updateMany({ bill: bill._id }, { $unset: { bill: 1 } });

        const message =
            bill.paid > 0
                ? "تم إلغاء الفاتورة بنجاح (تحذير: كانت هناك مدفوعات جزئية)"
                : "تم إلغاء الفاتورة بنجاح";

        res.json({
            success: true,
            message: message,
            data: bill,
        });
    } catch (error) {
        Logger.error("خطأ في إلغاء الفاتورة", error);
        Logger.error("Error stack:", error.stack);
        res.status(500).json({
            success: false,
            message: "خطأ في إلغاء الفاتورة",
            error: error.message,
        });
    }
};

// @desc    Add partial payment for specific items
// @route   POST /api/bills/:id/partial-payment
// @access  Private
export const addPartialPayment = async (req, res) => {
    try {
        const { orderId, items, paymentMethod } = req.body;

        const bill = await Bill.findById(req.params.id).populate("orders");

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "الفاتورة غير موجودة",
            });
        }

        // لا يوجد شرط يمنع الدفع الجزئي بسبب وجود جلسة نشطة، إذا وُجد مستقبلاً احذفه أو تجاهله.

        // Find the order
        const order = bill.orders.find((o) => o._id.toString() === orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "الطلب غير موجود في هذه الفاتورة",
            });
        }

        // Validate items
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "يجب تحديد العناصر المطلوب دفعها",
            });
        }

        // Validate that items exist in the order
        const orderItems = order.items || [];
        const validItems = items.filter((item) =>
            orderItems.some(
                (orderItem) =>
                    orderItem.name === item.itemName &&
                    orderItem.price === item.price
            )
        );

        if (validItems.length !== items.length) {
            return res.status(400).json({
                success: false,
                message: "بعض العناصر غير موجودة في الطلب",
            });
        }

        // Add partial payment
        await bill.addPartialPayment(
            orderId,
            order.orderNumber,
            validItems.map((item) => ({
                itemName: item.itemName,
                price: item.price,
                quantity: item.quantity,
            })),
            req.user,
            paymentMethod || "cash"
        );

        // Recalculate totals
        await bill.calculateSubtotal();

        await bill.populate(
            ["orders", "sessions", "createdBy", "partialPayments.items.paidBy"],
            "name"
        );

        res.json({
            success: true,
            message: "تم إضافة الدفع الجزئي بنجاح",
            data: bill,
        });
    } catch (error) {
        Logger.error("خطأ في إضافة الدفع الجزئي", error);
        res.status(500).json({
            success: false,
            message: "خطأ في إضافة الدفع الجزئي",
            error: error.message,
        });
    }
};

// @desc    Get bill items for partial payment
// @route   GET /api/bills/:id/items
// @access  Private
export const getBillItems = async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id).populate("orders");

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "الفاتورة غير موجودة",
            });
        }

        const items = [];
        // خريطة تتبع لكل قطعة: ما هي الإضافات التي تم دفعها معها
        const paidItemsMap = new Map(); // key: orderId-itemName, value: عدد القطع المدفوعة

        // تتبع المدفوعات الجزئية
        if (bill.partialPayments && bill.partialPayments.length > 0) {
            bill.partialPayments.forEach((payment) => {
                payment.items.forEach((item) => {
                    const key = `${payment.orderId}-${item.itemName}`;

                    paidItemsMap.set(
                        key,
                        (paidItemsMap.get(key) || 0) + (item.quantity || 0)
                    );
                });
            });
        }

        // Get items from orders with remaining quantities
        if (bill.orders && bill.orders.length > 0) {
            bill.orders.forEach((order) => {
                if (order.items && order.items.length > 0) {
                    order.items.forEach((item) => {
                        const key = `${order._id}-${item.name}`;
                        const paidQuantity = paidItemsMap.get(key) || 0;
                        const remainingQuantity = item.quantity - paidQuantity;
                        const allAddons = item.addons
                            ? item.addons.map((a) => ({
                                  name: a.name,
                                  price: a.price,
                              }))
                            : [];

                        // إضافة العنصر الأساسي فقط إذا كان لديه كمية متبقية
                        if (remainingQuantity > 0) {
                            items.push({
                                orderId: order._id,
                                orderNumber: order.orderNumber,
                                itemName: item.name,
                                price: item.price,
                                quantity: remainingQuantity, // الكمية المتبقية فقط
                                originalQuantity: item.quantity, // الكمية الأصلية
                                paidQuantity: paidQuantity, // الكمية المدفوعة
                                totalPrice: item.price * remainingQuantity,
                                isMainItem: true, // علامة للعنصر الأساسي
                            });
                        }

                        // إضافة الإضافات كأصناف منفصلة
                        if (allAddons.length > 0) {
                            allAddons.forEach((addon) => {
                                // حساب عدد مرات هذه الإضافة في الطلب الأصلي
                                const totalAddonCount = item.quantity; // كل قطعة تحتوي على الإضافة

                                // حساب عدد مرات دفع هذه الإضافة
                                const addonItemName = `${addon.name} (إضافة لـ ${item.name})`;
                                const addonKey = `${order._id}-${addonItemName}`;
                                const paidAddonCount =
                                    paidItemsMap.get(addonKey) || 0;

                                const remainingAddonCount =
                                    totalAddonCount - paidAddonCount;

                                if (remainingAddonCount > 0) {
                                    items.push({
                                        orderId: order._id,
                                        orderNumber: order.orderNumber,
                                        itemName: addonItemName,
                                        price: addon.price,
                                        quantity: remainingAddonCount,
                                        originalQuantity: totalAddonCount,
                                        paidQuantity: paidAddonCount,
                                        totalPrice:
                                            addon.price * remainingAddonCount,
                                        isAddon: true, // علامة للإضافة
                                        mainItemName: item.name, // اسم العنصر الأساسي
                                        addonName: addon.name, // اسم الإضافة
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }

        res.json({
            success: true,
            data: items,
        });
    } catch (error) {
        Logger.error("خطأ في جلب عناصر الفاتورة", error);
        res.status(500).json({
            success: false,
            message: "خطأ في جلب عناصر الفاتورة",
            error: error.message,
        });
    }
};

// @desc    Get available bills for session linking
// @route   GET /api/bills/available-for-session?type=playstation
export const getAvailableBillsForSession = async (req, res) => {
    try {
        const { type } = req.query; // playstation أو computer
        if (!type || (type !== "playstation" && type !== "computer")) {
            return res.status(400).json({
                success: false,
                message: "يجب تحديد نوع الجلسة (playstation أو computer)",
            });
        }

        // جلب الفواتير غير المدفوعة أو الملغاة
        const bills = await Bill.find({
            status: { $nin: ["paid", "cancelled"] },
            organization: req.user.organization,
        }).populate("sessions");

        // فلترة الفواتير التي لا تحتوي على جلسة نشطة من نفس النوع
        const availableBills = bills.filter((bill) => {
            const hasActiveSession = bill.sessions.some(
                (session) =>
                    session.deviceType === type && session.status === "active"
            );
            return !hasActiveSession;
        });

        res.json({
            success: true,
            data: availableBills,
        });
    } catch (error) {
        Logger.error("خطأ في جلب الفواتير المتاحة للربط", error);
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الفواتير المتاحة للربط",
            error: error.message,
        });
    }
};

export const getSubscriptionStatus = async (req, res) => {
    try {
        // جلب المستخدم الحالي
        const user = await User.findById(req.user.id);
        if (!user || !user.organization) {
            return res.status(401).json({
                status: "expired",
                message: "لا يوجد منشأة مرتبطة بهذا الحساب",
            });
        }
        // جلب أحدث اشتراك للمنشأة
        const subscription = await Subscription.findOne({
            organization: user.organization,
        }).sort({ endDate: -1 });
        if (!subscription) {
            return res
                .status(200)
                .json({ status: "expired", message: "لا يوجد اشتراك فعال" });
        }
        const now = new Date();
        if (subscription.status === "active" && subscription.endDate > now) {
            return res.status(200).json({ status: "active" });
        } else {
            return res.status(200).json({ status: "expired" });
        }
    } catch (error) {
        res.status(500).json({
            status: "expired",
            message: "خطأ في جلب حالة الاشتراك",
        });
    }
};

export const createSubscriptionPayment = async (req, res) => {
    try {
        const { plan } = req.body;
        const user = await User.findById(req.user.id);
        if (!user || !user.organization) {
            return res.status(401).json({
                success: false,
                message: "لا يوجد منشأة مرتبطة بهذا الحساب",
            });
        }
        // تحديد السعر حسب الباقة
        let amount = 0,
            description = "";
        if (plan === "monthly") {
            amount = 299;
            description = "اشتراك شهري في النظام";
        } else if (plan === "yearly") {
            amount = 2999;
            description = "اشتراك سنوي في النظام";
        } else {
            return res
                .status(400)
                .json({ success: false, message: "خطة اشتراك غير صحيحة" });
        }
        // رقم الطلب (يمكنك توليده بأي طريقة فريدة)
        const orderId = `${user.organization}-${Date.now()}`;
        // رابط العودة بعد الدفع
        const returnUrl = `${
            process.env.FRONTEND_URL || "http://localhost:5173"
        }/subscription?success=1`;
        // إنشاء طلب دفع فوري
        const payment = await createFawryPayment({
            customerEmail: user.email,
            customerName: user.name,
            amount,
            orderId,
            description,
            returnUrl,
        });
        res.json({ success: true, payment });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في إنشاء طلب الدفع",
            error: error.message,
        });
    }
};

export const fawryWebhook = async (req, res) => {
    try {
        const { merchantRefNumber, paymentStatus, paymentAmount } = req.body;
        // تحقق من نجاح الدفع
        if (paymentStatus !== "PAID") {
            return res.status(200).json({
                success: true,
                message: "تم الاستلام، لكن لم يتم الدفع بعد.",
            });
        }
        // استخراج organizationId من رقم الطلب
        const [organizationId] = merchantRefNumber.split("-");
        // جلب أحدث اشتراك غير مفعل لهذه المنشأة
        const subscription = await Subscription.findOne({
            organization: organizationId,
            status: { $ne: "active" },
        }).sort({ endDate: -1 });
        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: "لم يتم العثور على اشتراك لتفعيله",
            });
        }
        // تفعيل الاشتراك
        subscription.status = "active";
        await subscription.save();
        // إرسال إشعار للمالك
        const organization = subscription.organization;
        const orgOwner = await User.findOne({ organization, role: "owner" });
        if (orgOwner) {
            await sendSubscriptionNotification(
                orgOwner._id,
                "تم تفعيل اشتراك منشأتك بنجاح. شكراً لاستخدامك منصتنا!"
            );
        }
        res.status(200).json({
            success: true,
            message: "تم تفعيل الاشتراك بنجاح",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في معالجة Webhook",
            error: error.message,
        });
    }
};
