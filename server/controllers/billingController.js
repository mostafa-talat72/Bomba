import mongoose from "mongoose";
import Bill from "../models/Bill.js";
import Order from "../models/Order.js";
import Session from "../models/Session.js";
import Table from "../models/Table.js";
import Logger from "../middleware/logger.js";
import NotificationService from "../services/notificationService.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import { sendSubscriptionNotification } from "./notificationController.js";
import { createFawryPayment } from "../services/fawryService.js";
import performanceMetrics from "../utils/performanceMetrics.js";
import dualDatabaseManager from "../config/dualDatabaseManager.js";
import syncConfig from "../config/syncConfig.js";

// دالة لتحويل الأرقام الإنجليزية إلى العربية
const convertToArabicNumbers = (str) => {
    const arabicNumbers = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
    return str.replace(/[0-9]/g, (match) => arabicNumbers[parseInt(match)]);
};

/**
 * Helper function to update table status based on unpaid bills
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 * @param {ObjectId|Object} tableId - The table ID or table object to update
 * @param {ObjectId} organizationId - The organization ID for filtering bills
 * @param {Object} io - Socket.IO instance for emitting events (optional)
 * @returns {Promise<string|null>} The new table status or null if no table
 */
async function updateTableStatusIfNeeded(tableId, organizationId, io = null) {
    if (!tableId) {
        return null;
    }

    // Extract the actual ID if tableId is an object
    const actualTableId = tableId._id || tableId;

    try {
        // Find all unpaid bills for this table (draft, partial, or overdue status)
        const unpaidBills = await Bill.find({
            table: actualTableId,
            status: { $in: ["draft", "partial", "overdue"] },
            organization: organizationId,
        });

        // Determine new status: occupied if there are unpaid bills, empty otherwise
        const newStatus = unpaidBills.length > 0 ? "occupied" : "empty";

        // Update table status
        await Table.findByIdAndUpdate(actualTableId, { status: newStatus });

        Logger.info(
            `✓ Table status updated to '${newStatus}' for table: ${actualTableId} (${unpaidBills.length} unpaid bills)`
        );

        // Emit table status update event if io is provided
        if (io) {
            io.emit("table-status-update", {
                tableId: actualTableId,
                status: newStatus,
            });
        }

        return newStatus;
    } catch (error) {
        Logger.error("خطأ في تحديث حالة الطاولة", error);
        // Don't throw error - table status update failure shouldn't break bill operations
        return null;
    }
}

// @desc    Get all bills
// @route   GET /api/bills
// @access  Private
export const getBills = async (req, res) => {
    const queryStartTime = Date.now();
    
    try {
        const {
            status,
            tableNumber,
            table,  // Support table parameter (ObjectId)
            page = 1,
            limit = 50,
            startDate,  // IGNORED - Date filtering removed per requirements
            endDate,    // IGNORED - Date filtering removed per requirements
            customerName,
        } = req.query;

        const query = {};
        if (status) query.status = status;
        
        // Support both table ObjectId and legacy tableNumber filtering
        // Priority: table parameter > tableNumber parameter
        if (table) {
            // New table parameter (ObjectId)
            if (mongoose.Types.ObjectId.isValid(table)) {
                query.table = new mongoose.Types.ObjectId(table);
            } else {
                return res.status(400).json({
                    success: false,
                    message: "معرف الطاولة غير صحيح",
                });
            }
        } else if (tableNumber) {
            // Check if tableNumber is a valid ObjectId (for table field filtering)
            if (mongoose.Types.ObjectId.isValid(tableNumber)) {
                query.table = new mongoose.Types.ObjectId(tableNumber);
            } else {
                // Legacy support for tableNumber field
                query.tableNumber = tableNumber;
            }
        }
        
        if (customerName) {
            query.customerName = { $regex: customerName, $options: "i" };
        }
        
        // Date range filtering COMPLETELY REMOVED per requirements 1.1, 1.2, 1.3
        // System now returns ALL bills regardless of creation date
        // startDate and endDate parameters are ignored
        
        query.organization = req.user.organization;

        // إزالة الحد - جلب جميع الفواتير بدون pagination
        // تم إزالة effectiveLimit لعرض جميع الفواتير القديمة والجديدة

        const bills = await Bill.find({
            organization: req.user.organization,
            ...query,
        })
            // Selective field projection - include new partial payment fields
            .select('billNumber customerName customerPhone table tableNumber status total paid remaining orders sessions createdAt discount discountPercentage tax notes itemPayments sessionPayments paymentHistory')
            .populate({
                path: "table",
                select: "number name section", // Populate table with number, name, and section
            })
            .populate({
                path: "table",
                select: "number name", // فقط الحقول الأساسية
            })
            .populate({
                path: "orders",
                select: "orderNumber status total", // حقول أساسية فقط بدون items
                options: { limit: 5 }, // تقليل العدد
            })
            .populate({
                path: "sessions",
                select: "deviceName deviceType status finalCost", // حقول أساسية فقط
                options: { limit: 3 }, // تقليل العدد
            })
            .sort({ createdAt: -1 })
            .lean(); // Convert to plain JS objects for better performance - جلب جميع الفواتير بدون حد

        // Update bills that have orders but zero total
        // Note: Since we're using .lean(), we need to update the database directly
        const billsToUpdate = bills.filter(
            bill => bill.orders && bill.orders.length > 0 && bill.total === 0
        );
        
        if (billsToUpdate.length > 0) {
            // Update these bills in the background without blocking the response
            Promise.all(
                billsToUpdate.map(bill => 
                    Bill.findById(bill._id).then(b => b && b.calculateSubtotal())
                )
            ).catch(err => Logger.error("خطأ في تحديث الفواتير", err));
        }

        const total = await Bill.countDocuments(query);

        const queryExecutionTime = Date.now() - queryStartTime;

        // Log query performance - بدون pagination
        Logger.queryPerformance('/api/bills', queryExecutionTime, bills.length, {
            filters: { status, table, tableNumber, customerName },
            totalRecords: total
        });

        // Record query metrics - بدون pagination
        performanceMetrics.recordQuery({
            endpoint: '/api/bills',
            executionTime: queryExecutionTime,
            recordCount: bills.length,
            filters: { status, table, tableNumber, customerName },
        });

        // Response بدون pagination metadata
        res.json({
            success: true,
            count: bills.length,
            total,
            data: bills
        });
    } catch (error) {
        Logger.error("خطأ في جلب الفواتير", {
            error: error.message,
            executionTime: `${Date.now() - queryStartTime}ms`
        });
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
        // تحقق من صحة معرف الفاتورة أولاً
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "معرف الفاتورة غير صحيح",
            });
        }

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
                    populate: [
                        {
                            path: "createdBy",
                            select: "name",
                        },
                        {
                            path: "table",
                            select: "number name",
                        },
                    ],
                })
                .populate("createdBy", "name")
                .populate("updatedBy", "name")
                .populate("payments.user", "name")
                .populate("partialPayments.items.paidBy", "name")
                .populate("itemPayments.paidBy", "name")
                .populate("sessionPayments.payments.paidBy", "name");
            if (!bill) {
                return res.status(404).json({
                    success: false,
                    message: "الفاتورة غير موجودة",
                });
            }

            // تحويل bill إلى object أولاً
            const billObj = bill.toObject();

            // إضافة controllersHistoryBreakdown لكل جلسة بلايستيشن
            if (bill.sessions && bill.sessions.length > 0) {
                const sessionsWithBreakdown = await Promise.all(
                    bill.sessions.map(async (session) => {
                        // حساب breakdown قبل تحويل إلى object
                        let breakdownData = null;
                        if (session.deviceType === 'playstation' && typeof session.getCostBreakdownAsync === 'function') {
                            try {
                                breakdownData = await session.getCostBreakdownAsync();
                            } catch (error) {
                                }
                        }
                        
                        // تحويل إلى object بعد حساب breakdown
                        const sessionObj = session.toObject ? session.toObject() : session;
                        
                        // إضافة breakdown إذا كان موجوداً
                        if (breakdownData && breakdownData.breakdown) {
                            sessionObj.controllersHistoryBreakdown = breakdownData.breakdown;
                        }
                        
                        return sessionObj;
                    })
                );
                billObj.sessions = sessionsWithBreakdown;
            }

            // لا نتحقق من حالة الفاتورة هنا (نسمح بعرض أي فاتورة)
            return res.json({
                success: true,
                data: billObj,
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
                populate: [
                    {
                        path: "createdBy",
                        select: "name",
                    },
                    {
                        path: "table",
                        select: "number name",
                    },
                ],
            })
            .populate("createdBy", "name")
            .populate("updatedBy", "name")
            .populate("payments.user", "name")
            .populate("partialPayments.items.paidBy", "name")
            .populate("itemPayments.paidBy", "name")
            .populate("sessionPayments.payments.paidBy", "name");
        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "الفاتورة غير موجودة أو غير مصرح لك بالوصول إليها",
            });
        }

        // Generate QR code if it doesn't exist
        if (!bill.qrCode) {
            Logger.info(`🔧 [getBill] Generating QR code for bill: ${bill.billNumber}`);
            await bill.generateQRCode();
            Logger.info(`✅ [getBill] QR code generated:`, {
                hasQrCode: !!bill.qrCode,
                qrCodeLength: bill.qrCode?.length,
                qrCodeUrl: bill.qrCodeUrl
            });
            // Save the QR code
            await Bill.updateOne(
                { _id: bill._id },
                {
                    $set: {
                        qrCode: bill.qrCode,
                        qrCodeUrl: bill.qrCodeUrl,
                    }
                },
                { timestamps: false }
            );
            Logger.info(`💾 [getBill] QR code saved to database`);
        } else {
            Logger.info(`✓ [getBill] QR code already exists for bill: ${bill.billNumber}`);
        }

        // إصلاح sessionPayments وحساب السعر الحالي للجلسات النشطة
        if (bill.sessions && bill.sessions.length > 0 && bill.sessionPayments && bill.sessionPayments.length > 0) {
            let needsUpdate = false;
            
            for (const session of bill.sessions) {
                const sessionPayment = bill.sessionPayments.find(
                    sp => sp.sessionId?.toString() === session._id?.toString()
                );
                
                if (sessionPayment) {
                    let sessionCost = session.finalCost || session.totalCost || 0;
                    
                    // للجلسات النشطة، نحسب السعر الحالي
                    if (session.status === 'active' && typeof session.calculateCurrentCost === 'function') {
                        try {
                            sessionCost = await session.calculateCurrentCost();
                            Logger.info(`✓ تم حساب السعر الحالي للجلسة ${session.deviceName}: ${sessionCost}`);
                        } catch (error) {
                            Logger.error(`خطأ في حساب السعر الحالي للجلسة ${session.deviceName}:`, error);
                        }
                    }
                    
                    const correctRemaining = sessionCost - (sessionPayment.paidAmount || 0);
                    
                    // إذا كان remainingAmount أو sessionCost خاطئ، نصلحه
                    if (sessionPayment.remainingAmount !== correctRemaining || sessionPayment.sessionCost !== sessionCost) {
                        sessionPayment.sessionCost = sessionCost;
                        sessionPayment.remainingAmount = correctRemaining;
                        needsUpdate = true;
                    }
                }
            }
            
            // حفظ التحديثات إذا لزم الأمر
            if (needsUpdate) {
                await bill.save();
                Logger.info(`✓ تم تحديث sessionPayments للفاتورة ${bill.billNumber}`);
            }
        }

        // تحويل bill إلى object أولاً
        const billObj = bill.toObject();

        // إضافة controllersHistoryBreakdown لكل جلسة بلايستيشن
        if (bill.sessions && bill.sessions.length > 0) {
            const sessionsWithBreakdown = await Promise.all(
                bill.sessions.map(async (session) => {
                    // حساب breakdown قبل تحويل إلى object
                    let breakdownData = null;
                    if (session.deviceType === 'playstation' && typeof session.getCostBreakdownAsync === 'function') {
                        try {
                            breakdownData = await session.getCostBreakdownAsync();
                        } catch (error) {
                            }
                    }
                    
                    // تحويل إلى object بعد حساب breakdown
                    const sessionObj = session.toObject ? session.toObject() : session;
                    
                    // إضافة breakdown إذا كان موجوداً
                    if (breakdownData && breakdownData.breakdown) {
                        sessionObj.controllersHistoryBreakdown = breakdownData.breakdown;
                    }
                    
                    return sessionObj;
                })
            );
            billObj.sessions = sessionsWithBreakdown;
        }

        return res.json({
            success: true,
            data: billObj,
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
            discountPercentage,
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

        // Get tableNumber from first order if orders are provided
        let tableNumber = req.body.tableNumber || null;
        if (!tableNumber && orders && orders.length > 0) {
            const firstOrder = await Order.findById(orders[0]);
            if (firstOrder && firstOrder.tableNumber) {
                tableNumber = firstOrder.tableNumber;
            }
        }

        const bill = await Bill.create({
            customerName,
            customerPhone,
            tableNumber: tableNumber,
            orders: orders || [],
            sessions: sessions || [],
            discount: discount || 0,
            discountPercentage: discountPercentage || 0,
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

        // Update table status if bill has a table (Requirement 2.3)
        if (bill.table) {
            await updateTableStatusIfNeeded(bill.table, req.user.organization, req.io);
        }

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
        const {
            customerName,
            customerPhone,
            discount,
            discountPercentage,
            tax,
            notes,
            dueDate,
            tableNumber,
            table, // إضافة table (ID)
        } = req.body;

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

        // Update fields if provided
        if (customerName !== undefined) bill.customerName = customerName;
        if (customerPhone !== undefined) bill.customerPhone = customerPhone;
        if (discount !== undefined) bill.discount = discount;
        if (discountPercentage !== undefined)
            bill.discountPercentage = discountPercentage;
        if (tax !== undefined) bill.tax = tax;
        if (notes !== undefined) bill.notes = notes;
        if (dueDate !== undefined) bill.dueDate = dueDate;
        
        // إذا تم تغيير الطاولة (باستخدام ID)
        if (table !== undefined) {
            const oldTableId = bill.table ? bill.table.toString() : null;
            const newTableId = table ? table.toString() : null;
            
            if (oldTableId !== newTableId && newTableId) {
                Logger.info(`🔄 تغيير الطاولة من ${oldTableId} إلى ${newTableId} للفاتورة ${bill.billNumber}`);
                
                // البحث عن فاتورة موجودة في الطاولة الجديدة (غير مدفوعة بالكامل)
                const existingBillInNewTable = await Bill.findOne({
                    _id: { $ne: bill._id }, // ليست نفس الفاتورة
                    table: newTableId,
                    organization: req.user.organization,
                    status: { $in: ['draft', 'partial', 'overdue'] }
                }).sort({ createdAt: -1 });

                if (existingBillInNewTable) {
                    // Case 1: الطاولة الجديدة تحتوي على فاتورة غير مدفوعة - دمج الفواتير
                    Logger.info(`📋 CASE 1: الطاولة الجديدة تحتوي على فاتورة غير مدفوعة - دمج مع ${existingBillInNewTable.billNumber}`);
                    
                    // حفظ معلومات الفاتورة القديمة قبل الدمج
                    const oldBillId = bill._id;
                    const oldBillNumber = bill.billNumber;
                    const oldBillOrders = [...(bill.orders || [])];
                    const oldBillSessions = [...(bill.sessions || [])];
                    
                    // STEP 1: إضافة الطلبات والجلسات إلى الفاتورة الموجودة في الطاولة الجديدة
                    if (oldBillOrders.length > 0) {
                        // إضافة الطلبات إلى الفاتورة الجديدة
                        existingBillInNewTable.orders.push(...oldBillOrders);
                        
                        // تحديث مرجع الفاتورة والطاولة في الطلبات
                        await Order.updateMany(
                            { _id: { $in: oldBillOrders } },
                            { $set: { table: newTableId, bill: existingBillInNewTable._id } }
                        );
                        Logger.info(`✅ STEP 1a: تم إضافة ${oldBillOrders.length} طلب إلى الفاتورة ${existingBillInNewTable.billNumber}`);
                    }
                    
                    if (oldBillSessions.length > 0) {
                        // إضافة الجلسات إلى الفاتورة الجديدة
                        existingBillInNewTable.sessions.push(...oldBillSessions);
                        
                        // تحديث مرجع الفاتورة والطاولة في الجلسات
                        await Session.updateMany(
                            { _id: { $in: oldBillSessions } },
                            { $set: { bill: existingBillInNewTable._id, table: newTableId } }
                        );
                        Logger.info(`✅ STEP 1b: تم إضافة ${oldBillSessions.length} جلسة إلى الفاتورة ${existingBillInNewTable.billNumber} والطاولة ${newTableId}`);
                    }
                    
                    // STEP 2: حفظ الفاتورة المدمجة وإعادة حساب المجاميع
                    await existingBillInNewTable.calculateSubtotal();
                    await existingBillInNewTable.save();
                    Logger.info(`✅ STEP 2: تم حفظ الفاتورة المدمجة ${existingBillInNewTable.billNumber}`);
                    
                    // STEP 3: حذف الفاتورة القديمة (التي أصبحت فارغة)
                    const { deleteFromBothDatabases } = await import('../utils/deleteHelper.js');
                    await deleteFromBothDatabases(bill, 'bills', `bill ${oldBillNumber}`);
                    Logger.info(`✅ STEP 3: تم حذف الفاتورة القديمة ${oldBillNumber}`);
                    
                    // تحديث حالة الطاولة القديمة
                    if (oldTableId) {
                        await updateTableStatusIfNeeded(oldTableId, req.user.organization, req.io);
                    }
                    
                    // إعادة تحميل الفاتورة المدمجة مع البيانات الكاملة
                    const reloadedBill = await Bill.findById(existingBillInNewTable._id)
                        .populate('orders')
                        .populate('sessions')
                        .populate('table')
                        .populate('createdBy', 'name')
                        .populate('updatedBy', 'name');
                    
                    // Emit Socket.IO events
                    if (req.io) {
                        req.io.notifyBillUpdate("deleted", { _id: oldBillId, billNumber: oldBillNumber });
                        req.io.notifyBillUpdate("updated", reloadedBill);
                    }
                    
                    Logger.info(`✅ تم دمج الفواتير بنجاح - الفاتورة النهائية: ${reloadedBill.billNumber}`);
                    
                    // إرجاع الفاتورة المدمجة
                    return res.json({
                        success: true,
                        message: "تم دمج الفاتورة مع الفاتورة الموجودة في الطاولة الجديدة بنجاح",
                        data: reloadedBill,
                    });
                    
                } else {
                    // Case 2: الطاولة الجديدة لا تحتوي على فاتورة غير مدفوعة - تغيير الطاولة فقط
                    Logger.info(`📋 CASE 2: الطاولة الجديدة فارغة - تغيير طاولة الفاتورة ${bill.billNumber}`);
                    
                    // تحديث طاولة الفاتورة
                    bill.table = newTableId;
                    
                    // تحديث اسم العميل ليكون اسم الطاولة الجديدة
                    const Table = (await import('../models/Table.js')).default;
                    const newTableDoc = await Table.findById(newTableId);
                    if (newTableDoc) {
                        bill.customerName = `طاولة ${newTableDoc.number}`;
                        Logger.info(`✓ تم تحديث اسم العميل إلى: ${bill.customerName}`);
                    }
                    
                    // تحديث جميع الطلبات المرتبطة بهذه الفاتورة
                    if (bill.orders && bill.orders.length > 0) {
                        try {
                            await Order.updateMany(
                                { _id: { $in: bill.orders } },
                                { $set: { table: newTableId } }
                            );
                            Logger.info(`✅ تم تحديث ${bill.orders.length} طلب للطاولة الجديدة`);
                        } catch (orderUpdateError) {
                            Logger.error('خطأ في تحديث الطلبات:', orderUpdateError);
                        }
                    }
                    
                    // تحديث جميع الجلسات المرتبطة بهذه الفاتورة لتشير إلى الطاولة الجديدة
                    if (bill.sessions && bill.sessions.length > 0) {
                        try {
                            await Session.updateMany(
                                { _id: { $in: bill.sessions } },
                                { $set: { table: newTableId } }
                            );
                            Logger.info(`✅ تم تحديث ${bill.sessions.length} جلسة للطاولة الجديدة`);
                        } catch (sessionUpdateError) {
                            Logger.error('خطأ في تحديث الجلسات:', sessionUpdateError);
                        }
                    }
                    
                    // تحديث حالة الطاولة القديمة
                    if (oldTableId) {
                        await updateTableStatusIfNeeded(oldTableId, req.user.organization, req.io);
                    }
                    
                    Logger.info(`✅ تم تغيير طاولة الفاتورة ${bill.billNumber} إلى الطاولة ${newTableId}`);
                }
            }
        }
        
        // إذا تم تغيير رقم الطاولة (للتوافق مع الكود القديم)
        if (tableNumber !== undefined && bill.tableNumber !== tableNumber) {
            bill.tableNumber = tableNumber;
            
            // تحديث جميع الطلبات المرتبطة بهذه الفاتورة
            if (bill.orders && bill.orders.length > 0) {
                try {
                    const Order = (await import('../models/Order.js')).default;
                    await Order.updateMany(
                        { _id: { $in: bill.orders } },
                        { $set: { tableNumber: tableNumber } }
                    );
                    Logger.info(`✓ تم تحديث ${bill.orders.length} طلب للطاولة ${tableNumber}`);
                } catch (orderUpdateError) {
                    Logger.error('خطأ في تحديث الطلبات:', orderUpdateError);
                }
            }
        }

        bill.updatedBy = req.user._id;

        // Recalculate totals
        await bill.calculateSubtotal();

        await bill.populate([
            { path: "orders", select: "orderNumber" },
            { path: "sessions", select: "deviceName deviceNumber" },
            { path: "createdBy", select: "name" },
            { path: "updatedBy", select: "name" },
            { path: "table", select: "number name" }
        ]);

        const prevStatus = bill.status;
        const updatedBill = await bill.save();

        // Update table status if bill status changed (Requirement 2.3, 2.4)
        if (bill.table && prevStatus !== updatedBill.status) {
            await updateTableStatusIfNeeded(bill.table, req.user.organization, req.io);
        }

        // Notify via Socket.IO (Requirement 8.1)
        if (req.io) {
            req.io.notifyBillUpdate("updated", updatedBill);
        }

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
            discountPercentage,
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
            // إضافة الدفع الجديد إلى قائمة المدفوعات
            if (paymentAmount && paymentAmount > 0) {
                // تحديث نسبة الخصم إذا تم إرسالها
                if (discountPercentage !== undefined) {
                    bill.discountPercentage = parseFloat(discountPercentage);
                    await bill.calculateSubtotal(); // إعادة حساب المبلغ الإجمالي مع الخصم الجديد
                }
                
                bill.addPayment(
                    paymentAmount,
                    method || "cash",
                    req.user._id,
                    reference,
                    false,
                    discountPercentage !== undefined
                        ? parseFloat(discountPercentage)
                        : undefined
                );
                bill.updatedBy = req.user._id;
                
                // Set flag to skip status recalculation in pre-save
                bill._skipStatusRecalculation = true;
                bill.paid = paid;
                bill.remaining = remaining;
                bill.status = status;
                
                
                await bill.save();
            } else {
                // إذا لم يكن هناك مبلغ دفع جديد، قم بتحديث الحالة مباشرة
                bill._skipStatusRecalculation = true;
                bill.paid = paid;
                bill.remaining = remaining;
                bill.status = status;
                bill.updatedBy = req.user._id;
                
             
                await bill.save();
            }

            // Mark all items as paid if bill is fully paid
            if (status === 'paid' && bill.orders && bill.orders.length > 0) {
                
                // Initialize itemPayments if not exists
                if (!bill.itemPayments) {
                    bill.itemPayments = [];
                }
                
                // Create or update itemPayments for all order items
                bill.orders.forEach(order => {
                    if (order.items && Array.isArray(order.items)) {
                        order.items.forEach((orderItem, itemIndex) => {
                            const itemId = `${order._id}-${itemIndex}`;
                            
                            // Find existing itemPayment or create new one
                            let itemPayment = bill.itemPayments.find(ip => ip.itemId === itemId);
                            
                            if (itemPayment) {
                                // Update existing
                                itemPayment.paidQuantity = itemPayment.quantity;
                                itemPayment.paidAmount = itemPayment.totalPrice;
                                itemPayment.isPaid = true;
                                itemPayment.paidAt = new Date();
                                itemPayment.paidBy = req.user._id;
                            } else {
                                // Create new itemPayment
                                bill.itemPayments.push({
                                    orderId: order._id,
                                    itemId: itemId,
                                    itemName: orderItem.name,
                                    quantity: orderItem.quantity,
                                    paidQuantity: orderItem.quantity,
                                    pricePerUnit: orderItem.price,
                                    totalPrice: orderItem.price * orderItem.quantity,
                                    paidAmount: orderItem.price * orderItem.quantity,
                                    isPaid: true,
                                    paidAt: new Date(),
                                    paidBy: req.user._id,
                                    paymentMethod: method || 'cash',
                                    addons: orderItem.addons || []
                                });
                            }
                        });
                    }
                });
                
            }

            // Mark all sessions as paid if bill is fully paid
            if (status === 'paid' && bill.sessionPayments && bill.sessionPayments.length > 0) {
                let sessionsUpdated = false;
                bill.sessionPayments.forEach(sessionPayment => {
                    const remainingAmount = sessionPayment.remainingAmount || 0;
                    if (remainingAmount > 0) {
                        // دفع المبلغ المتبقي للجلسة
                        if (!sessionPayment.payments) {
                            sessionPayment.payments = [];
                        }
                        sessionPayment.payments.push({
                            amount: remainingAmount,
                            method: method || 'cash',
                            paidBy: req.user._id,
                            paidAt: new Date(),
                            reference: reference || null
                        });
                        sessionPayment.paidAmount = (sessionPayment.paidAmount || 0) + remainingAmount;
                        sessionPayment.remainingAmount = 0;
                        sessionPayment.isPaid = true;
                        sessionsUpdated = true;
                    }
                });
                if (sessionsUpdated) {
                    await bill.save();
                }
            }
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

            bill.addPayment(amount, method, req.user._id, reference);
            
            // If this payment makes the bill fully paid, create itemPayments
            if (bill.status === 'paid' && bill.orders && bill.orders.length > 0) {
                
                // Initialize itemPayments if not exists
                if (!bill.itemPayments) {
                    bill.itemPayments = [];
                }
                
                // Create itemPayments for all order items
                bill.orders.forEach(order => {
                    if (order.items && Array.isArray(order.items)) {
                        order.items.forEach((orderItem, itemIndex) => {
                            const itemId = `${order._id}-${itemIndex}`;
                            
                            // Check if itemPayment already exists
                            const existingPayment = bill.itemPayments.find(ip => ip.itemId === itemId);
                            
                            if (!existingPayment) {
                                // Create new itemPayment
                                bill.itemPayments.push({
                                    orderId: order._id,
                                    itemId: itemId,
                                    itemName: orderItem.name,
                                    quantity: orderItem.quantity,
                                    paidQuantity: orderItem.quantity,
                                    pricePerUnit: orderItem.price,
                                    totalPrice: orderItem.price * orderItem.quantity,
                                    paidAmount: orderItem.price * orderItem.quantity,
                                    isPaid: true,
                                    paidAt: new Date(),
                                    paidBy: req.user._id,
                                    paymentMethod: method || 'cash',
                                    addons: orderItem.addons || []
                                });
                            }
                        });
                    }
                });
            }
            
            await bill.save();
        }

        // Mark all items as paid if bill is fully paid
        if (bill.status === 'paid' && bill.itemPayments && bill.itemPayments.length > 0) {
            let itemsUpdated = false;
            bill.itemPayments.forEach(item => {
                if (!item.isPaid || item.paidQuantity < item.quantity) {
                    item.paidQuantity = item.quantity;
                    item.isPaid = true;
                    item.paidAt = new Date();
                    item.paidBy = req.user._id;
                    itemsUpdated = true;
                }
            });
            if (itemsUpdated) {
                await bill.save();
            }
        }

        // Generate QR code if it doesn't exist
        if (!bill.qrCode) {
            Logger.info(`🔧 [addPayment] Generating QR code for bill: ${bill.billNumber}`);
            await bill.generateQRCode();
            Logger.info(`✅ [addPayment] QR code generated:`, {
                hasQrCode: !!bill.qrCode,
                qrCodeLength: bill.qrCode?.length,
                qrCodeUrl: bill.qrCodeUrl
            });
            // Save the QR code
            await Bill.updateOne(
                { _id: bill._id },
                {
                    $set: {
                        qrCode: bill.qrCode,
                        qrCodeUrl: bill.qrCodeUrl,
                    }
                },
                { timestamps: false }
            );
            Logger.info(`💾 [addPayment] QR code saved to database`);
        } else {
            Logger.info(`✓ [addPayment] QR code already exists for bill: ${bill.billNumber}`);
        }

        // Populate only essential fields for response
        await bill.populate([
            { path: "table", select: "number name" }
        ]);

        // Update table status in background (non-blocking)
        if (bill.table) {
            updateTableStatusIfNeeded(bill.table, req.user.organization, req.io).catch(err => {
                Logger.error("Error updating table status:", err);
            });
        }

        // Notify via Socket.IO (non-blocking)
        if (req.io) {
            setImmediate(() => {
                req.io.notifyBillUpdate("payment-received", bill);
            });
        }

        // Create notification in background (non-blocking)
        setImmediate(() => {
            if (bill.status === "paid") {
                NotificationService.createBillingNotification(
                    "paid",
                    bill,
                    req.user._id
                ).catch(err => Logger.error("Failed to create payment notification:", err));
            } else if (bill.paid > 0) {
                NotificationService.createBillingNotification(
                    "partial_payment",
                    bill,
                    req.user._id
                ).catch(err => Logger.error("Failed to create payment notification:", err));
            }
        });

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

        // Update bill tableNumber to match order tableNumber if bill doesn't have one or if order tableNumber is different
        if (
            order.tableNumber &&
            (!bill.tableNumber || bill.tableNumber !== order.tableNumber)
        ) {
            bill.tableNumber = order.tableNumber;
        }

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

// @desc    Remove order from bill
// @route   DELETE /api/bills/:id/orders/:orderId
// @access  Private
export const removeOrderFromBill = async (req, res) => {
    try {
        const { id, orderId } = req.params;

        const bill = await Bill.findById(id);

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "الفاتورة غير موجودة",
            });
        }

        if (bill.status === "paid") {
            return res.status(400).json({
                success: false,
                message: "لا يمكن إزالة طلبات من فاتورة مدفوعة",
            });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "الطلب غير موجود",
            });
        }

        if (order.bill?.toString() !== id) {
            return res.status(400).json({
                success: false,
                message: "الطلب غير مرتبط بهذه الفاتورة",
            });
        }

        // Remove order from bill
        bill.orders = bill.orders.filter((oid) => oid.toString() !== orderId);
        order.bill = undefined;

        await Promise.all([bill.save(), order.save()]);

        // Recalculate bill totals
        await bill.calculateSubtotal();
        await bill.save();

        // Check if bill is now empty (no orders and no sessions)
        const updatedBill = await Bill.findById(id);
        if (
            updatedBill &&
            (!updatedBill.orders || updatedBill.orders.length === 0) &&
            (!updatedBill.sessions || updatedBill.sessions.length === 0)
        ) {
            // Delete the bill if it has no orders or sessions from Local and Atlas
            Logger.info(`🗑️ Deleting empty bill ${updatedBill.billNumber} after removing order`);
            const { deleteFromBothDatabases } = await import('../utils/deleteHelper.js');
            await deleteFromBothDatabases(updatedBill, 'bills', `bill ${updatedBill.billNumber}`);
            
            // Update table status if bill had a table
            if (updatedBill.table) {
                await updateTableStatusIfNeeded(updatedBill.table, req.user.organization, req.io);
            }
        }

        await bill.populate(
            ["orders", "sessions", "createdBy", "partialPayments.items.paidBy"],
            "name"
        );

        res.json({
            success: true,
            message: "تم إزالة الطلب من الفاتورة بنجاح",
            data: bill,
        });
    } catch (error) {
        Logger.error("خطأ في إزالة الطلب من الفاتورة", error);
        res.status(500).json({
            success: false,
            message: "خطأ في إزالة الطلب من الفاتورة",
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

// @desc    Delete bill
// @route   DELETE /api/bills/:id
// @access  Private
export const deleteBill = async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id).populate('table');

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "الفاتورة غير موجودة",
            });
        }

        // Store table reference before deletion
        const tableId = bill.table?._id || bill.table;
        const organizationId = bill.organization;
        
        // Store order and session IDs before deletion
        let orderIds = bill.orders || [];
        let sessionIds = bill.sessions || [];

        // Fallback: البحث عن الطلبات والجلسات المرتبطة بالفاتورة مباشرة من قاعدة البيانات
        // في حالة عدم وجودها في bill.orders أو bill.sessions
        if (orderIds.length === 0) {
            const relatedOrders = await Order.find({ bill: bill._id }).select('_id');
            orderIds = relatedOrders.map(o => o._id);
            Logger.info(`📋 Found ${orderIds.length} orders by searching with bill reference`);
        }
        
        if (sessionIds.length === 0) {
            const relatedSessions = await Session.find({ bill: bill._id }).select('_id');
            sessionIds = relatedSessions.map(s => s._id);
            Logger.info(`🎮 Found ${sessionIds.length} sessions by searching with bill reference`);
        }

        Logger.info(`🗑️ Starting bill deletion: ${bill.billNumber}`, {
            billId: bill._id,
            ordersCount: orderIds.length,
            sessionsCount: sessionIds.length,
            orderIds: orderIds,
            sessionIds: sessionIds
        });

        // تعطيل Sync Middleware مؤقتاً لتجنب إعادة المزامنة
        const originalSyncEnabled = syncConfig.enabled;
        
        try {
            // تعطيل المزامنة التلقائية
            syncConfig.enabled = false;
            Logger.info(`🔒 Sync middleware disabled for direct delete operation`);
            
            // الحذف المباشر من Local و Atlas في نفس الوقت
            const localConnection = dualDatabaseManager.getLocalConnection();
            const atlasConnection = dualDatabaseManager.getAtlasConnection();
            
            // Delete all orders associated with this bill (cascade delete)
            if (orderIds.length > 0) {
                Logger.info(`🗑️ Deleting ${orderIds.length} orders associated with bill ${bill.billNumber}`);
                
                // حذف من Local
                const deleteResult = await Order.deleteMany({ _id: { $in: orderIds } });
                Logger.info(`✓ Deleted ${deleteResult.deletedCount} orders from Local MongoDB`);
                
                // حذف من Atlas مباشرة
                if (atlasConnection) {
                    try {
                        const atlasOrdersCollection = atlasConnection.collection('orders');
                        const atlasDeleteResult = await atlasOrdersCollection.deleteMany({ 
                            _id: { $in: orderIds } 
                        });
                        Logger.info(`✓ Deleted ${atlasDeleteResult.deletedCount} orders from Atlas MongoDB`);
                    } catch (atlasError) {
                        Logger.error(`❌ Failed to delete orders from Atlas: ${atlasError.message}`);
                    }
                } else {
                    Logger.warn(`⚠️ Atlas connection not available - orders will be synced for deletion later`);
                }
            } else {
                Logger.info(`ℹ️ No orders to delete for bill ${bill.billNumber}`);
            }

            // Delete all sessions associated with this bill (cascade delete)
            if (sessionIds.length > 0) {
                Logger.info(`🗑️ Deleting ${sessionIds.length} sessions associated with bill ${bill.billNumber}`);
                
                // حذف من Local
                const sessionDeleteResult = await Session.deleteMany({ _id: { $in: sessionIds } });
                Logger.info(`✓ Deleted ${sessionDeleteResult.deletedCount} sessions from Local MongoDB`);
                
                // حذف من Atlas مباشرة
                if (atlasConnection) {
                    try {
                        const atlasSessionsCollection = atlasConnection.collection('sessions');
                        const atlasDeleteResult = await atlasSessionsCollection.deleteMany({ 
                            _id: { $in: sessionIds } 
                        });
                        Logger.info(`✓ Deleted ${atlasDeleteResult.deletedCount} sessions from Atlas MongoDB`);
                    } catch (atlasError) {
                        Logger.error(`❌ Failed to delete sessions from Atlas: ${atlasError.message}`);
                    }
                } else {
                    Logger.warn(`⚠️ Atlas connection not available - sessions will be synced for deletion later`);
                }
            } else {
                Logger.info(`ℹ️ No sessions to delete for bill ${bill.billNumber}`);
            }

            // Delete the bill from Local MongoDB
            await bill.deleteOne();
            Logger.info(`✓ Deleted bill ${bill.billNumber} from Local`);
            
            // Delete the bill from Atlas MongoDB مباشرة
            if (atlasConnection) {
                try {
                    const atlasBillsCollection = atlasConnection.collection('bills');
                    const atlasDeleteResult = await atlasBillsCollection.deleteOne({ _id: bill._id });
                    Logger.info(`✓ Deleted bill ${bill.billNumber} from Atlas (deletedCount: ${atlasDeleteResult.deletedCount})`);
                } catch (atlasError) {
                    Logger.warn(`⚠️ Failed to delete bill from Atlas: ${atlasError.message}`);
                }
            } else {
                Logger.warn(`⚠️ Atlas connection not available - bill will be synced later`);
            }
        } finally {
            // إعادة تفعيل المزامنة
            syncConfig.enabled = originalSyncEnabled;
            Logger.info(`🔓 Sync middleware re-enabled`);
        }

        // Update table status based on remaining unpaid bills (Requirement 2.5)
        if (tableId) {
            await updateTableStatusIfNeeded(tableId, organizationId, req.io);
        }

        // Emit bill-deleted event
        if (req.io) {
            req.io.notifyBillUpdate("deleted", { _id: bill._id, billNumber: bill.billNumber });
        }

        res.json({
            success: true,
            message: "تم حذف الفاتورة بنجاح",
        });
    } catch (error) {
        Logger.error("خطأ في حذف الفاتورة", error);
        Logger.error("Error stack:", error.stack);
        res.status(500).json({
            success: false,
            message: "خطأ في حذف الفاتورة",
            error: error.message,
        });
    }
};

// @desc    Add partial payment for specific items (REBUILT)
// @route   POST /api/bills/:id/partial-payment
// @access  Private
export const addPartialPayment = async (req, res) => {
    try {
        const { items, paymentMethod } = req.body;

        Logger.info(`🔄 [addPartialPayment] Processing partial payment for bill: ${req.params.id}`, {
            itemsCount: items?.length,
            paymentMethod,
            items: items
        });

        const bill = await Bill.findById(req.params.id).populate("orders");

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "الفاتورة غير موجودة",
            });
        }

        // Validate items
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "يجب تحديد العناصر المطلوب دفعها",
            });
        }

        // تأكد من وجود itemPayments
        if (!bill.itemPayments || bill.itemPayments.length === 0) {
            Logger.info(`🔧 [addPartialPayment] Initializing itemPayments for bill: ${bill.billNumber}`);
            
            bill.itemPayments = [];
            if (bill.orders && bill.orders.length > 0) {
                bill.orders.forEach((order) => {
                    if (order.items && order.items.length > 0) {
                        order.items.forEach((item, index) => {
                            bill.itemPayments.push({
                                orderId: order._id,
                                itemId: `${order._id}-${index}`,
                                itemName: item.name,
                                quantity: item.quantity,
                                paidQuantity: 0,
                                pricePerUnit: item.price,
                                totalPrice: item.price * item.quantity,
                                paidAmount: 0,
                                isPaid: false,
                                addons: item.addons || [],
                                paymentHistory: [],
                            });
                        });
                    }
                });
            }
        }

        let totalPaymentAmount = 0;
        const processedItems = [];

        // معالجة كل عنصر للدفع
        for (const paymentItem of items) {
            Logger.info(`🔍 [addPartialPayment] Processing payment item:`, paymentItem);

            // التحقق من صحة البيانات
            if (!paymentItem.quantity || paymentItem.quantity <= 0) {
                Logger.error(`❌ [addPartialPayment] Invalid quantity:`, paymentItem);
                continue;
            }

            // الاعتماد على itemId فقط
            if (!paymentItem.itemId) {
                Logger.error(`❌ [addPartialPayment] Missing itemId:`, paymentItem);
                continue;
            }

            // البحث عن الصنف بالـ itemId مباشرة
            const targetItem = bill.itemPayments.find(ip => ip.itemId === paymentItem.itemId);
            
            if (!targetItem) {
                Logger.error(`❌ [addPartialPayment] ItemPayment not found for itemId: ${paymentItem.itemId}`);
                return res.status(400).json({
                    success: false,
                    message: `الصنف بمعرف "${paymentItem.itemId}" غير موجود في الفاتورة`
                });
            }

            Logger.info(`🔍 [addPartialPayment] Processing: ${targetItem.itemName} (ID: ${paymentItem.itemId}), quantity: ${paymentItem.quantity}`);

            // حساب الكمية المتبقية للصنف المحدد
            const remainingQuantity = (targetItem.quantity || 0) - (targetItem.paidQuantity || 0);

            if (remainingQuantity <= 0) {
                Logger.error(`❌ [addPartialPayment] Item already fully paid: ${targetItem.itemName}`);
                return res.status(400).json({
                    success: false,
                    message: `الصنف "${targetItem.itemName}" مدفوع بالكامل بالفعل`
                });
            }

            // التحقق من أن الكمية المطلوبة لا تتجاوز المتبقية
            if (paymentItem.quantity > remainingQuantity) {
                return res.status(400).json({
                    success: false,
                    message: `الكمية المطلوبة (${paymentItem.quantity}) أكبر من الكمية المتبقية (${remainingQuantity}) للصنف "${targetItem.itemName}"`
                });
            }

            // تحديث الدفع للصنف المحدد
            const paymentAmount = targetItem.pricePerUnit * paymentItem.quantity;

            targetItem.paidQuantity = (targetItem.paidQuantity || 0) + paymentItem.quantity;
            targetItem.paidAmount = (targetItem.paidAmount || 0) + paymentAmount;
            targetItem.isPaid = targetItem.paidQuantity >= targetItem.quantity;
            targetItem.paidAt = new Date();
            targetItem.paidBy = req.user._id;

            // إضافة سجل الدفع
            if (!targetItem.paymentHistory) {
                targetItem.paymentHistory = [];
            }
            targetItem.paymentHistory.push({
                quantity: paymentItem.quantity,
                amount: paymentAmount,
                paidAt: new Date(),
                paidBy: req.user._id,
                method: paymentMethod || "cash"
            });

            totalPaymentAmount += paymentAmount;

            Logger.info(`✅ [addPartialPayment] Paid ${paymentItem.quantity} from item ${targetItem.itemId}`, {
                itemName: targetItem.itemName,
                newPaidQuantity: targetItem.paidQuantity,
                totalQuantity: targetItem.quantity,
                paymentAmount: paymentAmount
            });

            // إضافة العنصر المعالج إلى القائمة
            processedItems.push({
                itemName: targetItem.itemName,
                quantity: paymentItem.quantity,
                price: targetItem.pricePerUnit,
                amount: paymentAmount
            });
        }

        if (totalPaymentAmount === 0) {
            return res.status(400).json({
                success: false,
                message: "لم يتم معالجة أي عناصر للدفع",
            });
        }

        Logger.info(`💰 [addPartialPayment] Payment processed successfully:`, {
            totalPaymentAmount,
            processedItemsCount: processedItems.length,
            processedItems
        });

        // حفظ الفاتورة
        await bill.save();

        Logger.info(`📊 [addPartialPayment] Bill status after save:`, {
            billId: bill._id,
            status: bill.status,
            paid: bill.paid,
            remaining: bill.remaining,
            total: bill.total
        });

        // Populate للاستجابة
        await bill.populate([
            "orders",
            "sessions", 
            "createdBy",
            "itemPayments.paidBy",
            "payments.user"
        ]);

        // إرسال تحديث Socket.IO
        if (req.io) {
            req.io.emit('partial-payment-received', {
                type: 'partial-payment',
                bill: bill,
                amount: totalPaymentAmount,
                items: processedItems,
                message: 'تم إضافة الدفع الجزئي بنجاح'
            });
        }

        res.json({
            success: true,
            message: `تم دفع ${totalPaymentAmount} جنيه بنجاح`,
            data: bill,
            paymentDetails: {
                amount: totalPaymentAmount,
                items: processedItems,
                method: paymentMethod || "cash"
            }
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

// @desc    Clean up orphaned itemPayments for a bill
// @route   POST /api/bills/:id/cleanup-payments
// @access  Private
export const cleanupBillPayments = async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id).populate("orders");

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "الفاتورة غير موجودة",
            });
        }

        Logger.info(`🧹 [cleanupBillPayments] Cleaning up payments for bill: ${bill.billNumber}`);

        // تنظيف itemPayments
        const cleanupResult = await bill.cleanupItemPayments();

        // إعادة حساب المجاميع
        await bill.calculateSubtotal();
        
        // حفظ التحديثات
        await bill.save();

        Logger.info(`✅ [cleanupBillPayments] Cleanup completed:`, {
            billId: bill._id,
            cleaned: cleanupResult.cleaned,
            remaining: cleanupResult.remaining,
            newStatus: bill.status,
            newPaid: bill.paid,
            newRemaining: bill.remaining
        });

        res.json({
            success: true,
            message: `تم تنظيف ${cleanupResult.cleaned} دفعة يتيمة`,
            data: {
                cleaned: cleanupResult.cleaned,
                remaining: cleanupResult.remaining,
                cleanedItems: cleanupResult.cleanedItems,
                bill: {
                    _id: bill._id,
                    billNumber: bill.billNumber,
                    status: bill.status,
                    paid: bill.paid,
                    remaining: bill.remaining,
                    total: bill.total
                }
            }
        });

    } catch (error) {
        Logger.error("خطأ في تنظيف دفعات الفاتورة", error);
        res.status(500).json({
            success: false,
            message: "خطأ في تنظيف دفعات الفاتورة",
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

        Logger.info(`🔍 [getBillItems] Processing bill: ${bill.billNumber}`, {
            ordersCount: bill.orders?.length || 0,
            itemPaymentsCount: bill.itemPayments?.length || 0
        });

        // تأكد من وجود itemPayments - إذا لم تكن موجودة، قم بتهيئتها
        if (!bill.itemPayments || bill.itemPayments.length === 0) {
            Logger.info(`🔧 [getBillItems] Initializing itemPayments for bill: ${bill.billNumber}`);
            
            // تهيئة itemPayments من الطلبات
            bill.itemPayments = [];
            if (bill.orders && bill.orders.length > 0) {
                bill.orders.forEach((order) => {
                    if (order.items && order.items.length > 0) {
                        order.items.forEach((item, index) => {
                            const itemName = item.name || "Unknown";
                            const price = item.price || 0;
                            const quantity = item.quantity || 1;
                            const addons = item.addons || [];

                            bill.itemPayments.push({
                                orderId: order._id,
                                itemId: `${order._id}-${index}`,
                                itemName,
                                quantity,
                                paidQuantity: 0,
                                pricePerUnit: price,
                                totalPrice: price * quantity,
                                paidAmount: 0,
                                isPaid: false,
                                addons: addons,
                                paymentHistory: [],
                            });
                        });
                    }
                });
                
                // حفظ التحديثات
                await bill.save();
                Logger.info(`✅ [getBillItems] ItemPayments initialized: ${bill.itemPayments.length} items`);
            }
        }

        const items = [];

        // استخدام itemPayments (النظام الجديد) بدلاً من partialPayments
        if (bill.itemPayments && bill.itemPayments.length > 0) {
            bill.itemPayments.forEach((itemPayment) => {
                const remainingQuantity = (itemPayment.quantity || 0) - (itemPayment.paidQuantity || 0);
                
                Logger.info(`🔍 [getBillItems] Item: ${itemPayment.itemName}`, {
                    totalQuantity: itemPayment.quantity,
                    paidQuantity: itemPayment.paidQuantity,
                    remainingQuantity,
                    price: itemPayment.pricePerUnit
                });

                // إضافة العنصر فقط إذا كان لديه كمية متبقية
                if (remainingQuantity > 0) {
                    items.push({
                        itemId: itemPayment.itemId, // مهم للـ frontend
                        orderId: itemPayment.orderId,
                        itemName: itemPayment.itemName,
                        price: itemPayment.pricePerUnit,
                        quantity: remainingQuantity, // الكمية المتبقية فقط
                        originalQuantity: itemPayment.quantity, // الكمية الأصلية
                        paidQuantity: itemPayment.paidQuantity || 0, // الكمية المدفوعة
                        totalPrice: itemPayment.pricePerUnit * remainingQuantity,
                        addons: itemPayment.addons || [],
                        hasAddons: !!(itemPayment.addons && itemPayment.addons.length > 0)
                    });
                }
            });
        } else {
            // Fallback: إذا لم توجد itemPayments، استخدم الطلبات مباشرة
            Logger.warn(`⚠️ [getBillItems] No itemPayments found, using orders directly`);
            
            if (bill.orders && bill.orders.length > 0) {
                bill.orders.forEach((order) => {
                    if (order.items && order.items.length > 0) {
                        order.items.forEach((item, index) => {
                            items.push({
                                itemId: `${order._id}-${index}`,
                                orderId: order._id,
                                itemName: item.name,
                                price: item.price,
                                quantity: item.quantity,
                                originalQuantity: item.quantity,
                                paidQuantity: 0,
                                totalPrice: item.price * item.quantity,
                                addons: item.addons || [],
                                hasAddons: !!(item.addons && item.addons.length > 0)
                            });
                        });
                    }
                });
            }
        }

        Logger.info(`✅ [getBillItems] Returning ${items.length} items for bill: ${bill.billNumber}`);

        res.json({
            success: true,
            data: items,
            meta: {
                billId: bill._id,
                billNumber: bill.billNumber,
                totalItems: items.length,
                hasItemPayments: !!(bill.itemPayments && bill.itemPayments.length > 0)
            }
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

// @desc    Pay for specific items in a bill with quantities
// @route   POST /api/bills/:id/pay-items
// @access  Private
// Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3
export const payForItems = async (req, res) => {
    try {
        const { items, paymentMethod = "cash" } = req.body;

        // Validate items array (Requirement 4.2)
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "يجب تحديد الأصناف والكميات المراد دفعها",
            });
        }

        // Validate each item has itemId and quantity (Requirement 4.2)
        for (const item of items) {
            if (!item.itemId) {
                return res.status(400).json({
                    success: false,
                    message: "يجب تحديد معرف الصنف لكل صنف",
                });
            }

            // Validate quantity is provided and is a positive number (Requirement 4.2)
            if (item.quantity === undefined || item.quantity === null) {
                return res.status(400).json({
                    success: false,
                    message: "يجب تحديد الكمية لكل صنف",
                });
            }

            if (typeof item.quantity !== 'number' || item.quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "يجب إدخال كمية صحيحة أكبر من صفر",
                });
            }

            // Validate quantity is not a decimal (must be whole number)
            if (!Number.isInteger(item.quantity)) {
                return res.status(400).json({
                    success: false,
                    message: "يجب أن تكون الكمية رقماً صحيحاً",
                });
            }
        }

        // Find the bill
        const bill = await Bill.findById(req.params.id);

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "الفاتورة غير موجودة",
            });
        }

        // Check if bill is already paid (Requirement 4.3)
        if (bill.status === "paid") {
            return res.status(400).json({
                success: false,
                message: "لا يمكن دفع أصناف من فاتورة مدفوعة بالكامل",
            });
        }

        // Check if bill is cancelled
        if (bill.status === "cancelled") {
            return res.status(400).json({
                success: false,
                message: "لا يمكن دفع أصناف من فاتورة ملغاة",
            });
        }

        // Validate that all itemIds exist in the bill
        const invalidItems = [];
        for (const item of items) {
            const billItem = bill.itemPayments.find(
                (bi) => bi._id.toString() === item.itemId.toString()
            );
            
            if (!billItem) {
                invalidItems.push(item.itemId);
            }
        }

        if (invalidItems.length > 0) {
            return res.status(404).json({
                success: false,
                message: "بعض الأصناف المحددة غير موجودة في الفاتورة",
                invalidItems: invalidItems,
            });
        }

        // Validate quantities for each item (Requirements 4.1, 4.3)
        for (const item of items) {
            const billItem = bill.itemPayments.find(
                (bi) => bi._id.toString() === item.itemId.toString()
            );

            const remainingQuantity = (billItem.quantity || 0) - (billItem.paidQuantity || 0);

            // Check if item is already fully paid (Requirement 4.3)
            if (remainingQuantity === 0) {
                return res.status(400).json({
                    success: false,
                    message: `الصنف "${billItem.itemName}" مدفوع بالكامل`,
                    itemId: item.itemId,
                    itemName: billItem.itemName,
                });
            }

            // Check if quantity exceeds remaining (Requirement 4.1)
            if (item.quantity > remainingQuantity) {
                return res.status(400).json({
                    success: false,
                    message: `الكمية المطلوبة (${item.quantity}) أكبر من الكمية المتبقية (${remainingQuantity}) للصنف "${billItem.itemName}"`,
                    itemId: item.itemId,
                    itemName: billItem.itemName,
                    requestedQuantity: item.quantity,
                    remainingQuantity: remainingQuantity,
                });
            }
        }

        // Process the payment (Requirements 1.1, 1.2, 1.3)
        try {
            const result = bill.payForItems(
                items,
                paymentMethod,
                req.user._id
            );
            await bill.save();

            // Update table status based on all unpaid bills
            if (bill.table) {
                await updateTableStatusIfNeeded(bill.table, req.user.organization, req.io);
            }

            // Populate bill data for response
            await bill.populate([
                { path: "table", select: "number name section" },
                { path: "orders", select: "orderNumber items status total" },
                {
                    path: "sessions",
                    select: "deviceName deviceNumber status totalCost",
                },
                { path: "createdBy", select: "name" },
                { path: "updatedBy", select: "name" },
                { path: "itemPayments.paidBy", select: "name" },
                { path: "paymentHistory.paidBy", select: "name" },
            ]);

            // Notify via Socket.IO
            if (req.io) {
                req.io.notifyBillUpdate("payment-received", bill);
            }

            // Create notification for item payment
            try {
                await NotificationService.createBillingNotification(
                    bill.status === "paid" ? "paid" : "partial_payment",
                    bill,
                    req.user._id
                );
            } catch (notificationError) {
                Logger.error(
                    "Failed to create item payment notification:",
                    notificationError
                );
            }

            // Return response with paid quantities (Requirement 1.4)
            res.json({
                success: true,
                message: "تم دفع الأصناف بنجاح",
                data: {
                    bill,
                    paidItems: result.paidItems.map(item => ({
                        itemName: item.itemName,
                        paidQuantity: item.quantity,
                        amount: item.amount,
                        remainingQuantity: item.remainingQuantity,
                    })),
                    totalPaid: result.totalAmount,
                    remaining: bill.remaining,
                    status: bill.status,
                },
            });
        } catch (paymentError) {
            Logger.error("خطأ في معالجة دفع الأصناف", paymentError);
            return res.status(400).json({
                success: false,
                message: paymentError.message || "خطأ في معالجة دفع الأصناف",
            });
        }
    } catch (error) {
        Logger.error("خطأ في دفع الأصناف", error);
        res.status(500).json({
            success: false,
            message: "خطأ في دفع الأصناف",
            error: error.message,
        });
    }
};

// @desc    Pay partial amount for a session
// @route   POST /api/bills/:id/pay-session-partial
// @access  Private
export const paySessionPartial = async (req, res) => {
    try {
        const { sessionId, amount, paymentMethod = "cash" } = req.body;

        // Validate sessionId and amount
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: "يجب تحديد الجلسة",
            });
        }

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "يجب إدخال مبلغ صحيح أكبر من صفر",
            });
        }

        // Find the bill
        const bill = await Bill.findById(req.params.id);

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "الفاتورة غير موجودة",
            });
        }

        // Check if bill is already paid or cancelled
        if (bill.status === "paid") {
            return res.status(400).json({
                success: false,
                message: "لا يمكن دفع جلسة من فاتورة مدفوعة بالكامل",
            });
        }

        if (bill.status === "cancelled") {
            return res.status(400).json({
                success: false,
                message: "لا يمكن دفع جلسة من فاتورة ملغاة",
            });
        }

        // Validate that sessionId exists in the bill
        const sessionPayment = bill.sessionPayments.find(
            (s) => s.sessionId.toString() === sessionId.toString()
        );

        if (!sessionPayment) {
            return res.status(404).json({
                success: false,
                message: "الجلسة غير موجودة في الفاتورة",
            });
        }

        // Validate that amount doesn't exceed remaining balance
        if (amount > sessionPayment.remainingAmount) {
            return res.status(400).json({
                success: false,
                message: `المبلغ (${amount} جنيه) أكبر من المبلغ المتبقي (${sessionPayment.remainingAmount} جنيه)`,
                remainingAmount: sessionPayment.remainingAmount,
            });
        }

        // Process the payment
        try {
            const result = bill.paySessionPartial(
                sessionId,
                amount,
                paymentMethod,
                req.user._id
            );
            await bill.save();

            // Update table status based on all unpaid bills (Requirement 2.4)
            if (bill.table) {
                await updateTableStatusIfNeeded(bill.table, req.user.organization, req.io);
            }

            // Populate bill data for response
            await bill.populate([
                { path: "table", select: "number name section" },
                { path: "orders", select: "orderNumber items status total" },
                {
                    path: "sessions",
                    select: "deviceName deviceNumber status totalCost finalCost",
                },
                { path: "createdBy", select: "name" },
                { path: "updatedBy", select: "name" },
                { path: "sessionPayments.payments.paidBy", select: "name" },
                { path: "paymentHistory.paidBy", select: "name" },
            ]);

            // Notify via Socket.IO (Requirement 8.2)
            if (req.io) {
                req.io.notifyBillUpdate("payment-received", bill);
            }

            // Create notification for session payment
            try {
                await NotificationService.createBillingNotification(
                    bill.status === "paid" ? "paid" : "partial_payment",
                    bill,
                    req.user._id
                );
            } catch (notificationError) {
                Logger.error(
                    "Failed to create session payment notification:",
                    notificationError
                );
            }

            res.json({
                success: true,
                message: "تم دفع جزء من الجلسة بنجاح",
                data: {
                    bill,
                    sessionId: result.sessionId,
                    paidAmount: result.paidAmount,
                    sessionRemaining: result.remaining,
                    billRemaining: bill.remaining,
                    billStatus: bill.status,
                },
            });
        } catch (paymentError) {
            Logger.error("خطأ في معالجة الدفع الجزئي للجلسة", paymentError);
            return res.status(400).json({
                success: false,
                message: paymentError.message || "خطأ في معالجة الدفع الجزئي للجلسة",
            });
        }
    } catch (error) {
        Logger.error("خطأ في الدفع الجزئي للجلسة", error);
        res.status(500).json({
            success: false,
            message: "خطأ في الدفع الجزئي للجلسة",
            error: error.message,
        });
    }
};
