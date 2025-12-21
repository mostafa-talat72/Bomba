import mongoose from "mongoose";
import Session from "../models/Session.js";
import Device from "../models/Device.js";
import Bill from "../models/Bill.js";
import Table from "../models/Table.js";
import Logger from "../middleware/logger.js";
import NotificationService from "../services/notificationService.js";

// Helper function to perform cleanup - defined outside the controller object
const performCleanupHelper = async (organizationId) => {
    Logger.info("🧹 Starting automatic cleanup of duplicate session references...");
    
    // Get all sessions for this organization
    const sessions = await Session.find({ organization: organizationId });
    let cleanedCount = 0;
    let deletedBillsCount = 0;
    
    Logger.info(`📊 Found ${sessions.length} sessions to check`);
    
    for (const session of sessions) {
        if (!session.bill) {
            Logger.info(`⚠️ Session ${session._id} (${session.status}) has no bill reference, skipping`);
            continue;
        }
        
        const correctBillId = session.bill.toString();
        Logger.info(`🔍 Checking session ${session._id} (${session.status}) - should be in bill ${correctBillId}`);
        
        // Find ALL bills that contain this session in their sessions array
        // Use $in to match ObjectId properly
        const billsWithSession = await Bill.find({
            sessions: { $in: [session._id] },
            organization: organizationId
        });
        
        Logger.info(`📋 Session ${session._id} found in ${billsWithSession.length} bills: ${billsWithSession.map(b => b.billNumber).join(', ')}`);
        
        // Remove session from any bill that is NOT the correct bill
        for (const bill of billsWithSession) {
            Logger.info(`🔎 Checking bill ${bill.billNumber} (${bill._id}) - ${bill._id.toString() === correctBillId ? 'CORRECT' : 'INCORRECT'}`);
            
            if (bill._id.toString() !== correctBillId) {
                Logger.info(`❌ REMOVING: Session ${session._id} from incorrect bill ${bill.billNumber}`);
                
                // Remove session from this incorrect bill
                const originalLength = bill.sessions.length;
                const sessionIdStr = session._id.toString();
                
                bill.sessions = bill.sessions.filter(s => {
                    const sIdStr = s._id ? s._id.toString() : s.toString();
                    const shouldKeep = sIdStr !== sessionIdStr;
                    if (!shouldKeep) {
                        Logger.info(`🗑️ Removing session ${sIdStr} from bill ${bill.billNumber}`);
                    }
                    return shouldKeep;
                });
                
                Logger.info(`📝 Bill ${bill.billNumber}: sessions reduced from ${originalLength} to ${bill.sessions.length}`);
                
                if (originalLength !== bill.sessions.length) {
                    await bill.calculateSubtotal();
                    await bill.save();
                    cleanedCount++;
                    Logger.info(`✅ Successfully cleaned bill ${bill.billNumber}`);
                    
                    // If bill is now empty (no sessions and no orders), try to merge it
                    if (bill.sessions.length === 0 && bill.orders.length === 0) {
                        Logger.info(`🔄 Bill ${bill.billNumber} is now empty, attempting to merge...`);
                        
                        // Look for another unpaid bill to merge with
                        let targetBillForMerge = null;
                        
                        // First, try to find a bill on the same table (if empty bill had a table)
                        if (bill.table) {
                            targetBillForMerge = await Bill.findOne({
                                _id: { $ne: bill._id }, // Not the same bill
                                table: bill.table,
                                organization: organizationId,
                                status: { $in: ['draft', 'partial', 'overdue'] }
                            }).sort({ createdAt: -1 });
                        }
                        
                        // If no bill on same table, find any unpaid bill
                        if (!targetBillForMerge) {
                            targetBillForMerge = await Bill.findOne({
                                _id: { $ne: bill._id }, // Not the same bill
                                organization: organizationId,
                                status: { $in: ['draft', 'partial', 'overdue'] }
                            }).sort({ createdAt: -1 });
                        }
                        
                        try {
                            if (targetBillForMerge) {
                                // Merge the empty bill with the target bill
                                Logger.info(`🔗 Merging empty bill ${bill.billNumber} with ${targetBillForMerge.billNumber}`);
                                
                                // Add merge information to target bill notes
                                const currentNotes = targetBillForMerge.notes || '';
                                targetBillForMerge.notes = currentNotes + `\n[تم دمج فاتورة فارغة ${bill.billNumber}]`;
                                
                                // Update target bill
                                await targetBillForMerge.calculateSubtotal();
                                await targetBillForMerge.save();
                                
                                Logger.info(`✅ Successfully merged empty bill ${bill.billNumber} with ${targetBillForMerge.billNumber}`);
                            } else {
                                Logger.info(`ℹ️ No suitable bill found for merge, deleting empty bill ${bill.billNumber}`);
                            }
                            
                            // Delete the empty bill
                            await bill.deleteOne();
                            deletedBillsCount++;
                            Logger.info(`✅ Successfully processed empty bill ${bill.billNumber}`);
                            
                        } catch (mergeError) {
                            Logger.error(`❌ Failed to merge/delete empty bill ${bill.billNumber}:`, mergeError);
                        }
                    }
                } else {
                    Logger.warn(`⚠️ No changes made to bill ${bill.billNumber} - session might not have been found`);
                }
            } else {
                Logger.info(`✅ CORRECT: Session ${session._id} belongs in bill ${bill.billNumber}`);
            }
        }
        
        // Double check: make sure session is in the correct bill
        const correctBill = await Bill.findById(correctBillId);
        if (correctBill) {
            const sessionInCorrectBill = correctBill.sessions.some(s => {
                const sIdStr = s._id ? s._id.toString() : s.toString();
                return sIdStr === session._id.toString();
            });
            
            if (!sessionInCorrectBill) {
                Logger.info(`🔧 Adding session ${session._id} to correct bill ${correctBill.billNumber}`);
                correctBill.sessions.push(session._id);
                await correctBill.calculateSubtotal();
                await correctBill.save();
                cleanedCount++;
            }
        }
    }
    
    Logger.info(`🧹 Automatic cleanup completed. Fixed ${cleanedCount} duplicates, deleted ${deletedBillsCount} empty bills.`);
    
    return { cleanedCount, deletedBillsCount };
};

const sessionController = {
    // Get all sessions
    getSessions: async (req, res) => {
        try {
            const { status, deviceType, page = 1, limit = 10, startDate, endDate } = req.query;

            const query = {};
            if (status) query.status = status;
            if (deviceType) query.deviceType = deviceType;
            query.organization = req.user.organization;
            
            // Add date filtering if provided
            if (startDate || endDate) {
                query.endTime = {};
                if (startDate) {
                    const startDateTime = new Date(startDate);
                    query.endTime.$gte = startDateTime;
                    Logger.info('📅 Session date filter - start:', {
                        received: startDate,
                        parsed: startDateTime.toISOString(),
                        local: startDateTime.toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })
                    });
                }
                if (endDate) {
                    const endDateTime = new Date(endDate);
                    query.endTime.$lte = endDateTime;
                    Logger.info('📅 Session date filter - end:', {
                        received: endDate,
                        parsed: endDateTime.toISOString(),
                        local: endDateTime.toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })
                    });
                }
            }

            const sessions = await Session.find(query)
                .populate("createdBy", "name")
                .populate("updatedBy", "name")
                .populate({
                    path: "bill",
                    populate: {
                        path: "table",
                        select: "number name"
                    }
                })
                .sort({ startTime: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Session.countDocuments(query);

            res.json({
                success: true,
                count: sessions.length,
                total,
                data: sessions,
            });
        } catch (err) {
            Logger.error("getSessions error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في جلب الجلسات",
                error: err.message,
            });
        }
    },

    // Get single session
    getSession: async (req, res) => {
        try {
            const session = await Session.findOne({
                _id: req.params.id,
                organization: req.user.organization,
            })
                .populate("createdBy", "name")
                .populate("updatedBy", "name");

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            res.json({
                success: true,
                data: session,
            });
        } catch (err) {
            Logger.error("getSession error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في جلب الجلسة",
                error: err.message,
            });
        }
    },

    // Create new session
    createSession: async (req, res) => {
        try {
            const {
                deviceNumber,
                deviceName,
                deviceType,
                deviceId,
                customerName,
                controllers,
                table,
            } = req.body;

            // Validate required fields
            if (!deviceNumber || !deviceName || !deviceType || !deviceId) {
                return res.status(400).json({
                    success: false,
                    message: "رقم الجهاز واسمه ونوعه ومعرف الجهاز مطلوبان",
                    error: "الحقول المطلوبة ناقصة",
                });
            }

            // Check if device is already in use
            const existingSession = await Session.findOne({
                deviceNumber,
                status: "active",
            });

            if (existingSession) {
                return res.status(400).json({
                    success: false,
                    message: "الجهاز مستخدم حالياً",
                    error: "Device is already in use",
                });
            }

            // Create new session
            // اسم العميل دائماً "عميل (اسم الجهاز)"
            const session = new Session({
                deviceNumber,
                deviceName,
                deviceId,
                deviceType,
                table: table || null,
                customerName: `عميل (${deviceName})`,
                controllers: controllers || 1,
                createdBy: req.user._id,
                organization: req.user.organization,
            });

            // البحث عن فاتورة موجودة للطاولة أو إنشاء فاتورة جديدة
            let bill = null;
            try {
                // تحديد نوع الفاتورة واسم العميل
                let billType = "cafe";
                let customerNameForBill;
                let tableName = deviceName;

                if (deviceType === "playstation") {
                    billType = "playstation";
                } else if (deviceType === "computer") {
                    billType = "computer";
                }

                // إذا كان هناك table، ابحث عن فاتورة موجودة غير مدفوعة
                let tableNumber = null;
                if (table) {
                    // Get table info for logging and customer name
                    const tableDoc = await Table.findById(table);
                    tableNumber = tableDoc ? tableDoc.number : table;
                    
                    // إذا كانت الجلسة مرتبطة بطاولة، اسم العميل يكون اسم الطاولة
                    customerNameForBill = `طاولة ${tableNumber}`;
                    tableName = `طاولة ${tableNumber}`;
                    
                    // البحث عن فاتورة موجودة للطاولة (غير مدفوعة بالكامل)
                    const existingBill = await Bill.findOne({
                        table: table,
                        organization: req.user.organization,
                        status: { $in: ['draft', 'partial', 'overdue'] }
                    }).sort({ createdAt: -1 }); // أحدث فاتورة

                    if (existingBill) {
                        bill = existingBill;
                        Logger.info(`✓ تم العثور على فاتورة موجودة للطاولة ${tableNumber} - سيتم ربط الجلسة بها:`, {
                            billId: bill._id,
                            billNumber: bill.billNumber,
                            billType: bill.billType,
                            status: bill.status,
                            existingOrders: bill.orders?.length || 0,
                            existingSessions: bill.sessions?.length || 0
                        });
                    } else {
                        Logger.info(`ℹ️ لم يتم العثور على فاتورة موجودة للطاولة ${tableNumber} - سيتم إنشاء فاتورة جديدة`);
                    }
                } else {
                    // إذا لم تكن مرتبطة بطاولة، اسم العميل يكون عميل + نوع الجهاز
                    if (deviceType === "playstation") {
                        customerNameForBill = `عميل بلايستيشن ${deviceName}`;
                    } else if (deviceType === "computer") {
                        customerNameForBill = `عميل كمبيوتر ${deviceName}`;
                    } else {
                        customerNameForBill = `عميل (${deviceName})`;
                    }
                }

                // إذا لم يتم العثور على فاتورة، أنشئ فاتورة جديدة
                if (!bill) {
                    const billData = {
                        customerName: customerNameForBill,
                        sessions: [], // سنضيف الجلسة بعد حفظها
                        subtotal: 0, // سيتم تحديثه عند إنهاء الجلسة
                        total: 0, // سيتم تحديثه عند إنهاء الجلسة
                        discount: 0,
                        tax: 0,
                        notes: `فاتورة جلسة ${tableName} - ${deviceType}${
                            tableNumber ? ` (طاولة ${tableNumber})` : ""
                        }`,
                        billType: billType,
                        status: "draft", // فاتورة مسودة حتى تنتهي الجلسة
                        createdBy: req.user._id,
                        organization: req.user.organization,
                    };

                    // إضافة table فقط إذا تم تحديده صراحة
                    if (table) {
                        billData.table = table;
                    }

                    bill = await Bill.create(billData);
                    Logger.info(`✓ تم إنشاء فاتورة جديدة للجلسة:`, {
                        billId: bill._id,
                        billNumber: bill.billNumber,
                        billType: bill.billType,
                        tableNumber: tableNumber
                    });
                }

                // Link session to bill
                session.bill = bill._id;
                Logger.info(`🔗 ربط الجلسة بالفاتورة:`, {
                    sessionId: session._id,
                    billId: bill._id,
                    billNumber: bill.billNumber
                });

                // Save session with bill reference
                await session.save();
                await session.populate(["createdBy", "bill"], "name");

                // Add session to bill (تأكد من عدم التكرار)
                if (!bill.sessions.includes(session._id)) {
                    bill.sessions.push(session._id);
                    Logger.info(`✓ تمت إضافة الجلسة إلى الفاتورة ${bill.billNumber}`);
                } else {
                    Logger.info(`ℹ️ الجلسة موجودة بالفعل في الفاتورة ${bill.billNumber}`);
                }
                await bill.save();
                await bill.populate(["sessions", "createdBy"], "name");

                // Create notification for session start
                try {
                    await NotificationService.createSessionNotification(
                        "started",
                        session,
                        req.user._id
                    );
                } catch (notificationError) {
                    Logger.error(
                        "Failed to create session start notification:",
                        notificationError
                    );
                }

                // Verify the link was created successfully
                if (!session.bill) {
                    Logger.error("❌ Session bill reference not set properly");
                }
            } catch (billError) {
                Logger.error("❌ خطأ في إنشاء الفاتورة التلقائية:", billError);
                // Save session without bill if bill creation fails
                await session.save();
                await session.populate("createdBy", "name");
            }

            // Update device status to active
            await Device.findOneAndUpdate(
                { _id: deviceId },
                { status: "active" }
            );

            res.status(201).json({
                success: true,
                message: "تم بدء الجلسة وإنشاء الفاتورة بنجاح",
                data: {
                    session,
                    bill: bill
                        ? {
                              id: bill._id,
                              billNumber: bill.billNumber,
                              customerName: bill.customerName,
                              status: bill.status,
                              billType: bill.billType,
                          }
                        : null,
                },
            });
        } catch (err) {
            Logger.error("createSession error:", err);
            res.status(400).json({
                success: false,
                message: "خطأ في إنشاء الجلسة",
                error: err.message,
            });
        }
    },

    // Update controllers during session
    updateControllers: async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { controllers } = req.body;

            if (!controllers || controllers < 1 || controllers > 4) {
                return res.status(400).json({
                    success: false,
                    message: "عدد الدراعات يجب أن يكون بين 1 و 4",
                    error: "Invalid controllers count",
                });
            }

            const session = await Session.findOne({
                _id: sessionId,
                organization: req.user.organization,
            });

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            if (session.status !== "active") {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن تعديل عدد الدراعات في جلسة غير نشطة",
                    error: "Session is not active",
                });
            }

            // Update controllers using the method (this updates controllersHistory)
            session.updateControllers(controllers);
            session.updatedBy = req.user._id;

            // Save the session with updated controllersHistory
            await session.save();
            await session.populate(["createdBy", "updatedBy"], "name");

            // Log the controllersHistory for debugging
            Logger.info(`Controllers updated for session ${sessionId}:`, {
                newControllers: controllers,
                historyLength: session.controllersHistory.length,
                latestPeriod: session.controllersHistory[session.controllersHistory.length - 1]
            });

            res.json({
                success: true,
                message: "تم تحديث عدد الدراعات بنجاح",
                data: session,
            });
        } catch (err) {
            Logger.error("updateControllers error:", err);
            res.status(400).json({
                success: false,
                message: "خطأ في تحديث عدد الدراعات",
                error: err.message,
            });
        }
    },

    // Update session cost in real-time
    updateSessionCost: async (req, res) => {
        try {
            const { id } = req.params;

            const session = await Session.findOne({
                _id: id,
                organization: req.user.organization,
            }).populate("bill");

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            if (session.status !== "active") {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن تحديث تكلفة جلسة غير نشطة",
                    error: "Session is not active",
                });
            }

            // حساب التكلفة الحالية باستخدام calculateCurrentCost
            const currentCost = await session.calculateCurrentCost();
            
            // تحديث totalCost و finalCost بدون حفظ (للعرض فقط)
            session.totalCost = currentCost;
            session.finalCost = currentCost - (session.discount || 0);

            // تحديث الفاتورة المرتبطة إذا وجدت
            let billUpdated = false;
            if (session.bill) {
                try {
                    const bill = await Bill.findById(session.bill);
                    if (bill) {
                        await bill.calculateSubtotal();
                        await bill.save();
                        billUpdated = true;
                    }
                } catch (billError) {
                    Logger.error("❌ Error updating bill:", billError);
                }
            }

            res.json({
                success: true,
                message: "تم تحديث تكلفة الجلسة بنجاح",
                data: {
                    sessionId: session._id,
                    currentCost: session.finalCost,
                    totalCost: session.totalCost,
                    billUpdated: billUpdated,
                    duration: session.startTime
                        ? Math.floor(
                              (new Date() - new Date(session.startTime)) /
                                  (1000 * 60)
                          )
                        : 0,
                    controllersHistory: session.controllersHistory,
                },
            });
        } catch (err) {
            Logger.error("❌ updateSessionCost error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في تحديث تكلفة الجلسة",
                error: err.message,
            });
        }
    },

    // End session
    endSession: async (req, res) => {
        try {
            const { id } = req.params;
            const { customerName } = req.body;

            const session = await Session.findOne({
                _id: id,
                organization: req.user.organization,
            }).populate("bill");

            if (!session) {
                Logger.error("❌ Session not found:", id);
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            if (session.status !== "active") {
                return res.status(400).json({
                    success: false,
                    message: "الجلسة غير نشطة",
                    error: "Session is not active",
                });
            }

            // Check if session is linked to a table
            const bill = session.bill;
            const isLinkedToTable = bill && bill.table;

            // If not linked to table and no customer name provided, require it
            if (!isLinkedToTable && (!customerName || customerName.trim() === '')) {
                return res.status(400).json({
                    success: false,
                    message: 'اسم العميل مطلوب للجلسات غير المرتبطة بطاولة',
                    error: 'Customer name required'
                });
            }

            // Update customer name if provided
            if (customerName && customerName.trim() !== "") {
                session.customerName = customerName.trim();
            }

            // End session using the method
            Logger.info('🔍 Before endSession:', {
                sessionId: session._id,
                totalCost: session.totalCost,
                finalCost: session.finalCost
            });
            
            await session.endSession();
            
            Logger.info('🔍 After endSession:', {
                sessionId: session._id,
                totalCost: session.totalCost,
                finalCost: session.finalCost
            });
            
            session.updatedBy = req.user._id;

            await session.save();
            
            Logger.info('🔍 After save:', {
                sessionId: session._id,
                totalCost: session.totalCost,
                finalCost: session.finalCost
            });
            
            // Reload session to get updated data
            const updatedSession = await Session.findById(session._id).populate(["createdBy", "updatedBy", "bill"], "name");
            if (!updatedSession) {
                Logger.error("❌ Failed to reload session after save");
                return res.status(500).json({
                    success: false,
                    message: "خطأ في تحديث الجلسة",
                    error: "Failed to reload session",
                });
            }

            // Create notification for session end
            try {
                await NotificationService.createSessionNotification(
                    "ended",
                    session,
                    req.user._id
                );
            } catch (notificationError) {
                Logger.error(
                    "Failed to create session end notification:",
                    notificationError
                );
            }

            // Update device status to available
            await Device.findOneAndUpdate(
                { _id: session.deviceId },
                { status: "available" }
            );

            // Update existing bill with final cost OR create new bill if missing
            let updatedBill = null;
            if (updatedSession.bill) {
                try {
                    updatedBill = await Bill.findById(updatedSession.bill);
                    if (updatedBill) {
                        // تحديد اسم العميل فقط إذا لم تكن الفاتورة مرتبطة بطاولة
                        if (!updatedBill.table) {
                            let customerNameForBill = "";
                            const deviceType = updatedSession.deviceType;
                            const deviceNumber = updatedSession.deviceNumber;
                            const custName = updatedSession.customerName;
                            if (deviceType === "playstation") {
                                if (!custName || custName.trim() === "") {
                                    customerNameForBill = `عميل بلايستيشن PS${deviceNumber}`;
                                } else {
                                    customerNameForBill = `${custName.trim()} PS${deviceNumber}`;
                                }
                            } else if (deviceType === "computer") {
                                if (!custName || custName.trim() === "") {
                                    customerNameForBill = `عميل كمبيوتر PC${deviceNumber}`;
                                } else {
                                    customerNameForBill = `${custName.trim()} PC${deviceNumber}`;
                                }
                            } else {
                                if (!custName || custName.trim() === "") {
                                    customerNameForBill = "عميل";
                                } else {
                                    customerNameForBill = custName.trim();
                                }
                            }
                            
                            Logger.info(`✓ Updating bill customer name (not linked to table): ${customerNameForBill}`);
                            updatedBill.customerName = customerNameForBill;
                        } else {
                            Logger.info(`✓ Bill is linked to table ${updatedBill.table}, keeping existing customer name: ${updatedBill.customerName}`);
                        }
                        updatedBill.subtotal = updatedSession.finalCost || 0;
                        updatedBill.total = updatedSession.finalCost || 0;
                        updatedBill.discount = updatedSession.discount || 0;
                        updatedBill.status = "partial"; // تغيير الحالة من draft إلى partial
                        updatedBill.updatedBy = req.user._id;

                        await updatedBill.save();
                        await updatedBill.calculateSubtotal();
                        await updatedBill.populate(["sessions", "createdBy"], "name");

                        Logger.info(`✓ Bill updated successfully: ${updatedBill.billNumber}, Customer: ${updatedBill.customerName}`);
                    } else {
                        Logger.error(
                            "❌ Bill not found for session:",
                            updatedSession.bill
                        );
                    }
                } catch (billError) {
                    Logger.error("❌ خطأ في تحديث الفاتورة:", billError);
                    // Continue with session ending even if bill update fails
                }
            } else {
                // إنشاء فاتورة جديدة للجلسة إذا لم تكن موجودة
                Logger.warn(
                    "⚠️ No bill reference found in session, creating new bill:",
                    updatedSession._id
                );
                
                try {
                    // تحديد اسم العميل (هذا الجزء للفواتير الجديدة فقط - غير مرتبطة بطاولة)
                    let customerNameForBill = "";
                    const deviceType = updatedSession.deviceType;
                    const deviceNumber = updatedSession.deviceNumber;
                    const custName = updatedSession.customerName;
                    
                    if (deviceType === "playstation") {
                        if (!custName || custName.trim() === "") {
                            customerNameForBill = `عميل بلايستيشن PS${deviceNumber}`;
                        } else {
                            customerNameForBill = `${custName.trim()} PS${deviceNumber}`;
                        }
                    } else if (deviceType === "computer") {
                        if (!custName || custName.trim() === "") {
                            customerNameForBill = `عميل كمبيوتر PC${deviceNumber}`;
                        } else {
                            customerNameForBill = `${custName.trim()} PC${deviceNumber}`;
                        }
                    } else {
                        if (!custName || custName.trim() === "") {
                            customerNameForBill = "عميل";
                        } else {
                            customerNameForBill = custName.trim();
                        }
                    }

                    Logger.info(`✓ Creating new bill (not linked to table) with customer name: ${customerNameForBill}`);

                    // إنشاء الفاتورة
                    const billData = {
                        customerName: customerNameForBill,
                        sessions: [updatedSession._id],
                        subtotal: updatedSession.finalCost || 0,
                        total: updatedSession.finalCost || 0,
                        discount: updatedSession.discount || 0,
                        tax: 0,
                        notes: `فاتورة جلسة ${updatedSession.deviceName} - ${deviceType}`,
                        billType: deviceType === "playstation" ? "playstation" : deviceType === "computer" ? "computer" : "cafe",
                        status: "partial",
                        createdBy: req.user._id,
                        organization: req.user.organization,
                    };

                    updatedBill = await Bill.create(billData);
                    
                    // ربط الفاتورة بالجلسة
                    updatedSession.bill = updatedBill._id;
                    await updatedSession.save();
                    
                    await updatedBill.populate(["sessions", "createdBy"], "name");
                    
                    Logger.info("✅ Created new bill for session:", {
                        sessionId: updatedSession._id,
                        billId: updatedBill._id,
                        billNumber: updatedBill.billNumber,
                        customerName: updatedBill.customerName,
                    });
                } catch (createBillError) {
                    Logger.error("❌ خطأ في إنشاء الفاتورة:", createBillError);
                    // Continue with session ending even if bill creation fails
                }
            }

            res.json({
                success: true,
                message: "تم إنهاء الجلسة وتحديث الفاتورة بنجاح",
                data: {
                    session: updatedSession,
                    bill: updatedBill
                        ? {
                              id: updatedBill._id,
                              billNumber: updatedBill.billNumber,
                              customerName: updatedBill.customerName,
                              total: updatedBill.total,
                              status: updatedBill.status,
                          }
                        : null,
                },
            });
        } catch (err) {
            Logger.error("❌ endSession error:", err);
            res.status(400).json({
                success: false,
                message: "خطأ في إنهاء الجلسة",
                error: err.message,
            });
        }
    },

    // Create new session with existing bill
    createSessionWithExistingBill: async (req, res) => {
        try {
            const {
                deviceNumber,
                deviceName,
                deviceType,
                deviceId,
                customerName,
                controllers,
                billId,
                table,
            } = req.body;

            // Validate required fields
            if (
                !deviceNumber ||
                !deviceName ||
                !deviceType ||
                !deviceId ||
                !billId
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "رقم الجهاز واسمه ونوعه ومعرف الجهاز ومعرف الفاتورة مطلوبان",
                    error: "الحقول المطلوبة ناقصة",
                });
            }

            // Check if device is already in use
            const existingSession = await Session.findOne({
                deviceNumber,
                status: "active",
            });

            if (existingSession) {
                return res.status(400).json({
                    success: false,
                    message: "الجهاز مستخدم حالياً",
                    error: "Device is already in use",
                });
            }

            // Check if bill exists and is not paid/cancelled
            const bill = await Bill.findById(billId);
            if (!bill) {
                return res.status(404).json({
                    success: false,
                    message: "الفاتورة غير موجودة",
                    error: "Bill not found",
                });
            }

            if (bill.status === "paid" || bill.status === "cancelled") {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن ربط جلسة بفاتورة مدفوعة أو ملغية",
                    error: "Cannot link session to paid or cancelled bill",
                });
            }

            // السماح بإضافة جلسات متعددة على نفس الفاتورة
            // (عدة أجهزة بلايستيشن على نفس الطاولة يمكن أن تكون لها نفس الفاتورة)

            // Create new session
            const session = new Session({
                deviceNumber,
                deviceName,
                deviceId,
                deviceType,
                table: table || null,
                customerName: customerName ? customerName.trim() : "",
                controllers: controllers || 1,
                createdBy: req.user._id,
                bill: billId, // Link to existing bill
                organization: req.user.organization,
            });

            // Save session
            await session.save();
            await session.populate(["createdBy", "bill"], "name");

            // Add session to bill without updating customer name
            bill.sessions.push(session._id);

            // تحديث table في الفاتورة إذا تم توفيره
            const updateData = {
                $addToSet: { sessions: session._id },
            };

            // إذا تم توفير table ولم تكن الفاتورة مرتبطة بطاولة، قم بتحديثها
            if (table && !bill.table) {
                updateData.table = table;
            }

            // Save bill without modifying customer name
            await Bill.findByIdAndUpdate(bill._id, updateData, { new: true });
            await bill.populate(["sessions", "createdBy"], "name");

            // إرسال إشعار بدء الجلسة
            try {
                await NotificationService.createSessionNotification(
                    "started",
                    session,
                    req.user._id
                );
            } catch (notificationError) {
                Logger.error(
                    "Failed to create session start notification:",
                    notificationError
                );
            }

            // Update device status to active
            await Device.findOneAndUpdate(
                { _id: deviceId },
                { status: "active" }
            );

            res.status(201).json({
                success: true,
                message: "تم بدء الجلسة وربطها بالفاتورة بنجاح",
                data: {
                    session,
                    bill: {
                        id: bill._id,
                        billNumber: bill.billNumber,
                        customerName: bill.customerName,
                        status: bill.status,
                        billType: bill.billType,
                    },
                },
            });
        } catch (err) {
            Logger.error("createSessionWithExistingBill error:", err);
            res.status(400).json({
                success: false,
                message: "خطأ في إنشاء الجلسة",
                error: err.message,
            });
        }
    },

    // Get active sessions
    getActiveSessions: async (req, res) => {
        try {
            const sessions = await Session.find({
                status: "active",
                organization: req.user.organization,
            })
                .populate("createdBy", "name")
                .populate({
                    path: "bill",
                    select: "billNumber customerName total status billType table",
                    populate: {
                        path: "table",
                        select: "number name"
                    }
                })
                .sort({ startTime: -1 });

            res.json({
                success: true,
                count: sessions.length,
                data: sessions,
            });
        } catch (err) {
            Logger.error("getActiveSessions error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في جلب الجلسات النشطة",
                error: err.message,
            });
        }
    },

    // Unlink session from table
    unlinkTableFromSession: async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { customerName } = req.body;

            // Find the session
            const session = await Session.findOne({
                _id: sessionId,
                organization: req.user.organization,
            }).populate("bill");

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            if (session.status !== "active") {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن فك ربط جلسة غير نشطة",
                    error: "Session is not active",
                });
            }

            // Check if session is linked to a bill with table
            if (!session.bill) {
                return res.status(400).json({
                    success: false,
                    message: "الجلسة غير مرتبطة بفاتورة",
                    error: "Session is not linked to a bill",
                });
            }

            const bill = await Bill.findById(session.bill).populate("sessions orders");
            
            if (!bill) {
                return res.status(404).json({
                    success: false,
                    message: "الفاتورة غير موجودة",
                    error: "Bill not found",
                });
            }

            const table = bill.table;
            
            if (!table) {
                return res.status(400).json({
                    success: false,
                    message: "الجلسة غير مرتبطة بطاولة",
                    error: "Session is not linked to a table",
                });
            }
            
            // Get table number for logging
            const tableDoc = await Table.findById(table);
            const tableNumber = tableDoc ? tableDoc.number : table;

            // Update customer name if provided
            if (customerName && customerName.trim() !== "") {
                session.customerName = customerName.trim();
            } else if (!session.customerName || session.customerName.includes("عميل (")) {
                // If no customer name provided and current name is default, require it
                return res.status(400).json({
                    success: false,
                    message: "اسم العميل مطلوب عند فك الربط من الطاولة",
                    error: "Customer name required",
                });
            }

            // Check if bill has cafe orders in addition to the session
            const hasOrders = bill.orders && bill.orders.length > 0;
            const hasMultipleSessions = bill.sessions && bill.sessions.length > 1;

            let newBill = null;

            if (hasOrders || hasMultipleSessions) {
                // Case 1: Bill has cafe orders or multiple sessions
                // Create a new bill for this session only
                
                // Calculate current session cost
                const currentCost = await session.calculateCurrentCost();
                
                // تحديد اسم العميل للفاتورة الجديدة (بدون طاولة)
                let customerNameForBill = "";
                const deviceType = session.deviceType;
                const deviceName = session.deviceName;
                
                if (deviceType === "playstation") {
                    customerNameForBill = `عميل بلايستيشن ${deviceName}`;
                } else if (deviceType === "computer") {
                    customerNameForBill = `عميل كمبيوتر ${deviceName}`;
                } else {
                    customerNameForBill = `عميل (${deviceName})`;
                }

                // Create new bill for the session
                newBill = await Bill.create({
                    customerName: customerNameForBill,
                    sessions: [session._id],
                    subtotal: currentCost,
                    total: currentCost,
                    discount: session.discount || 0,
                    tax: 0,
                    notes: `فاتورة جلسة ${session.deviceName} - ${deviceType} (تم فك الربط من طاولة ${tableNumber})`,
                    billType: deviceType === "playstation" ? "playstation" : deviceType === "computer" ? "computer" : "cafe",
                    status: "draft",
                    createdBy: req.user._id,
                    organization: req.user.organization,
                });

                // Remove session from old bill
                bill.sessions = bill.sessions.filter(
                    (s) => s._id.toString() !== session._id.toString()
                );
                
                // Recalculate old bill subtotal
                await bill.calculateSubtotal();
                await bill.save();

                // Update session to point to new bill
                session.bill = newBill._id;
                session.updatedBy = req.user._id;
                await session.save();

                Logger.info(`✓ Created new bill for unlinked session:`, {
                    sessionId: session._id,
                    oldBillId: bill._id,
                    newBillId: newBill._id,
                    tableNumber: tableNumber,
                });

            } else {
                // Case 2: Bill has only this session
                // Just remove table from the bill and change type
                
                bill.table = null;
                bill.billType = session.deviceType === "playstation" ? "playstation" : session.deviceType === "computer" ? "computer" : "cafe";
                
                // Update customer name
                let customerNameForBill = "";
                const deviceType = session.deviceType;
                const deviceNumber = session.deviceNumber;
                const custName = session.customerName;
                
                if (deviceType === "playstation") {
                    if (!custName || custName.trim() === "") {
                        customerNameForBill = `عميل بلايستيشن PS${deviceNumber}`;
                    } else {
                        customerNameForBill = `${custName.trim()} PS${deviceNumber}`;
                    }
                } else if (deviceType === "computer") {
                    if (!custName || custName.trim() === "") {
                        customerNameForBill = `عميل كمبيوتر PC${deviceNumber}`;
                    } else {
                        customerNameForBill = `${custName.trim()} PC${deviceNumber}`;
                    }
                } else {
                    customerNameForBill = custName || "عميل";
                }
                
                bill.customerName = customerNameForBill;
                bill.notes = `فاتورة جلسة ${session.deviceName} - ${deviceType} (تم فك الربط من طاولة ${tableNumber})`;
                bill.updatedBy = req.user._id;
                
                await bill.save();
                
                session.updatedBy = req.user._id;
                await session.save();

                newBill = bill;

                Logger.info(`✓ Removed table from bill:`, {
                    sessionId: session._id,
                    billId: bill._id,
                    tableNumber: tableNumber,
                });
            }

            // Populate session data
            await session.populate(["createdBy", "updatedBy", "bill"], "name");
            await newBill.populate(["sessions", "createdBy"], "name");

            // Create notification
            try {
                if (req.user && req.user.organization) {
                    await NotificationService.createNotification({
                        type: "session",
                        category: "session",
                        title: "فك ربط جلسة من طاولة",
                        message: `تم فك ربط جلسة ${session.deviceName} من الطاولة ${tableNumber}`,
                        createdBy: req.user._id,
                    }, req.user);
                }
            } catch (notificationError) {
                Logger.error(
                    "Failed to create unlink notification:",
                    notificationError
                );
            }

            // Perform automatic cleanup after unlinking
            try {
                await performCleanupHelper(req.user.organization);
            } catch (cleanupError) {
                Logger.error("Auto cleanup failed after unlinking:", cleanupError);
            }

            res.json({
                success: true,
                message: "تم فك ربط الجلسة من الطاولة بنجاح",
                data: {
                    session,
                    bill: {
                        id: newBill._id,
                        billNumber: newBill.billNumber,
                        customerName: newBill.customerName,
                        total: newBill.total,
                        status: newBill.status,
                        billType: newBill.billType,
                        tableNumber: newBill.tableNumber,
                    },
                    unlinkedFromTable: tableNumber,
                },
            });
        } catch (err) {
            Logger.error("unlinkTableFromSession error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في فك ربط الجلسة من الطاولة",
                error: err.message,
            });
        }
    },

    // Link session to table with smart bill merging
    linkSessionToTable: async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { tableId } = req.body;

            // Validate inputs
            if (!tableId) {
                return res.status(400).json({
                    success: false,
                    message: "معرف الطاولة مطلوب",
                    error: "Table ID is required",
                });
            }

            // Find the session
            const session = await Session.findOne({
                _id: sessionId,
                organization: req.user.organization,
            }).populate("bill");

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            if (session.status !== "active") {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن ربط جلسة غير نشطة بطاولة",
                    error: "Session is not active",
                });
            }

            // Verify table exists
            const table = await Table.findOne({
                _id: tableId,
                organization: req.user.organization,
            });

            if (!table) {
                return res.status(404).json({
                    success: false,
                    message: "الطاولة غير موجودة",
                    error: "Table not found",
                });
            }

            // Get session's bill
            const sessionBill = await Bill.findById(session.bill);
            
            if (!sessionBill) {
                return res.status(404).json({
                    success: false,
                    message: "فاتورة الجلسة غير موجودة",
                    error: "Session bill not found",
                });
            }

            // Check if session bill is already linked to this table
            if (sessionBill.table && sessionBill.table.toString() === tableId.toString()) {
                return res.status(400).json({
                    success: false,
                    message: "الجلسة مرتبطة بالفعل بهذه الطاولة",
                    error: "Session is already linked to this table",
                });
            }

            // Search for existing unpaid bill on the table
            const existingTableBill = await Bill.findOne({
                table: tableId,
                organization: req.user.organization,
                status: { $in: ['draft', 'partial', 'overdue'] }
            }).sort({ createdAt: -1 });

            let finalBill = null;

            if (existingTableBill && existingTableBill._id.toString() !== sessionBill._id.toString()) {
                // Case 1: الطاولة تحتوي على فاتورة غير مدفوعة بالكامل
                Logger.info(`🔗 CASE 1: Table ${table.number} has existing unpaid bill - following same process as changeSessionTable`, {
                    sessionBillId: sessionBill._id,
                    sessionBillNumber: sessionBill.billNumber,
                    tableBillId: existingTableBill._id,
                    tableBillNumber: existingTableBill.billNumber,
                });

                const sessionIdStr = session._id.toString();

                // STEP 1: Add session to table bill first (same as changeSessionTable)
                const sessionAlreadyInTableBill = existingTableBill.sessions.some(s => {
                    const sIdStr = s._id ? s._id.toString() : s.toString();
                    return sIdStr === sessionIdStr;
                });
                
                if (!sessionAlreadyInTableBill) {
                    existingTableBill.sessions.push(session._id);
                    Logger.info(`✅ STEP 1: Added session to table bill`, {
                        sessionId: sessionIdStr,
                        tableBillId: existingTableBill._id.toString(),
                        totalSessions: existingTableBill.sessions.length,
                    });
                }
                
                await existingTableBill.calculateSubtotal();
                await existingTableBill.save();

                // Update session's bill reference
                session.bill = existingTableBill._id;
                await session.save();

                // STEP 2: Remove session from old bill (same as changeSessionTable)
                sessionBill.sessions = sessionBill.sessions.filter(s => {
                    const sIdStr = s._id ? s._id.toString() : s.toString();
                    return sIdStr !== sessionIdStr;
                });
                
                Logger.info(`✅ STEP 2: Removed session from old bill`, {
                    sessionId: sessionIdStr,
                    sessionBillId: sessionBill._id.toString(),
                    remainingSessions: sessionBill.sessions.length,
                });
                
                await sessionBill.calculateSubtotal();
                await sessionBill.save();

                // STEP 3: Check if old bill is now empty and merge with destination bill (same as changeSessionTable)
                const updatedSessionBill = await Bill.findById(sessionBill._id);
                if (updatedSessionBill && 
                    updatedSessionBill.sessions.length === 0 && 
                    updatedSessionBill.orders.length === 0) {
                    
                    Logger.info(`🔄 STEP 3: Old bill ${updatedSessionBill.billNumber} is now empty, merging with table bill...`, {
                        billId: updatedSessionBill._id,
                        destinationBill: existingTableBill.billNumber,
                    });
                    
                    // Copy any useful information from empty bill to table bill
                    let mergeNotes = '';
                    if (updatedSessionBill.notes && updatedSessionBill.notes.trim()) {
                        mergeNotes = `\n[مدمج من ${updatedSessionBill.billNumber}]: ${updatedSessionBill.notes}`;
                    }
                    
                    // Copy any payments from empty bill to table bill
                    if (updatedSessionBill.payments && updatedSessionBill.payments.length > 0) {
                        Logger.info(`💰 Transferring ${updatedSessionBill.payments.length} payments from empty bill to table bill`);
                        existingTableBill.payments = existingTableBill.payments || [];
                        existingTableBill.payments.push(...updatedSessionBill.payments);
                        
                        // Update paid amount
                        const transferredAmount = updatedSessionBill.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
                        existingTableBill.paid = (existingTableBill.paid || 0) + transferredAmount;
                        
                        mergeNotes += `\n[تم نقل مدفوعات بقيمة ${transferredAmount} ج.م]`;
                    }
                    
                    // Copy any partial payments
                    if (updatedSessionBill.partialPayments && updatedSessionBill.partialPayments.length > 0) {
                        Logger.info(`💳 Transferring ${updatedSessionBill.partialPayments.length} partial payments from empty bill`);
                        existingTableBill.partialPayments = existingTableBill.partialPayments || [];
                        existingTableBill.partialPayments.push(...updatedSessionBill.partialPayments);
                    }
                    
                    // Add merge information to table bill notes
                    const currentNotes = existingTableBill.notes || '';
                    existingTableBill.notes = currentNotes + `\n[تم دمج فاتورة فارغة ${updatedSessionBill.billNumber}]` + mergeNotes;
                    
                    // Update table bill totals
                    await existingTableBill.calculateSubtotal();
                    existingTableBill.remaining = existingTableBill.total - (existingTableBill.paid || 0);
                    await existingTableBill.save();
                    
                    // Delete the empty bill
                    await updatedSessionBill.deleteOne();
                    
                    Logger.info(`✅ STEP 3: Successfully merged empty bill ${updatedSessionBill.billNumber} with table bill ${existingTableBill.billNumber}`, {
                        finalBillTotal: existingTableBill.total,
                        finalBillPaid: existingTableBill.paid,
                        finalBillRemaining: existingTableBill.remaining
                    });
                    
                } else if (updatedSessionBill) {
                    Logger.info(`ℹ️ Old bill ${updatedSessionBill.billNumber} still has content, keeping it`, {
                        sessionsCount: updatedSessionBill.sessions.length,
                        ordersCount: updatedSessionBill.orders.length,
                    });
                }
                
                finalBill = existingTableBill;

            } else {
                // Case 2: الطاولة لا تحتوي على فاتورة غير مدفوعة - ربط الطاولة بفاتورة الجلسة الحالية
                Logger.info(`📌 CASE 2: Table ${table.number} has no unpaid bill - linking table to session bill`, {
                    sessionBillId: sessionBill._id,
                    sessionBillNumber: sessionBill.billNumber,
                });

                // إضافة الطاولة إلى فاتورة الجلسة الحالية
                sessionBill.table = tableId;
                sessionBill.billType = "cafe"; // تغيير نوع الفاتورة إلى كافيه عند الربط بطاولة
                sessionBill.customerName = `طاولة ${table.number}`; // تحديث اسم العميل
                sessionBill.updatedBy = req.user._id;
                
                // إضافة ملاحظة عن الربط
                const linkNote = `\n[تم ربط الفاتورة بالطاولة ${table.number}]`;
                sessionBill.notes = (sessionBill.notes || '') + linkNote;
                
                await sessionBill.save();
                Logger.info(`✅ Linked table ${table.number} to session bill ${sessionBill.billNumber}`);
                
                finalBill = sessionBill;
            }

            // Populate final bill data including table
            await finalBill.populate([
                { path: "sessions", select: "deviceName deviceNumber" },
                { path: "orders", select: "orderNumber" },
                { path: "createdBy", select: "name" },
                { path: "table", select: "number name" }
            ]);

            // Reload session with populated bill and table
            const updatedSession = await Session.findById(session._id)
                .populate({
                    path: "bill",
                    populate: {
                        path: "table",
                        select: "number name"
                    }
                });

            // Create notification
            try {
                if (req.user && req.user.organization) {
                    await NotificationService.createNotification({
                        type: "session",
                        category: "session",
                        title: "ربط جلسة بطاولة",
                        message: `تم ربط جلسة ${session.deviceName} بالطاولة ${table.number}`,
                        createdBy: req.user._id,
                    }, req.user);
                }
            } catch (notificationError) {
                Logger.error(
                    "Failed to create link notification:",
                    notificationError
                );
            }

            // Perform automatic cleanup after linking
            try {
                await performCleanupHelper(req.user.organization);
            } catch (cleanupError) {
                Logger.error("Auto cleanup failed after linking:", cleanupError);
            }

            res.json({
                success: true,
                message: "تم ربط الجلسة بالطاولة بنجاح",
                data: {
                    session: updatedSession, // Return full session with populated data
                    bill: {
                        id: finalBill._id,
                        billNumber: finalBill.billNumber,
                        customerName: finalBill.customerName,
                        total: finalBill.total,
                        status: finalBill.status,
                        billType: finalBill.billType,
                        table: table.number,
                        sessionsCount: finalBill.sessions.length,
                        ordersCount: finalBill.orders.length,
                    },
                },
            });

        } catch (err) {
            Logger.error("linkSessionToTable error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في ربط الجلسة بالطاولة",
                error: err.message,
            });
        }
    },

    // Change session table - moves only the specific session to a new table
    // Process order: 1) Add session to new bill, 2) Remove from old bill, 3) Delete old bill if empty
    changeSessionTable: async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { newTableId } = req.body;

            // Validate inputs
            if (!newTableId) {
                return res.status(400).json({
                    success: false,
                    message: "معرف الطاولة الجديدة مطلوب",
                    error: "New table ID is required",
                });
            }

            // Find the session
            const session = await Session.findOne({
                _id: sessionId,
                organization: req.user.organization,
            }).populate("bill");

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            if (session.status !== "active") {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن تغيير طاولة جلسة غير نشطة",
                    error: "Cannot change table for inactive session",
                });
            }

            // Verify new table exists
            const newTable = await Table.findOne({
                _id: newTableId,
                organization: req.user.organization,
            });

            if (!newTable) {
                return res.status(404).json({
                    success: false,
                    message: "الطاولة الجديدة غير موجودة",
                    error: "New table not found",
                });
            }

            // Get session's current bill
            const currentBill = await Bill.findById(session.bill);
            
            if (!currentBill) {
                return res.status(404).json({
                    success: false,
                    message: "فاتورة الجلسة غير موجودة",
                    error: "Session bill not found",
                });
            }

            // Check if session is already on this table
            if (currentBill.table && currentBill.table.toString() === newTableId.toString()) {
                return res.status(400).json({
                    success: false,
                    message: "الجلسة موجودة بالفعل على هذه الطاولة",
                    error: "Session is already on this table",
                });
            }

            const oldTable = await Table.findById(currentBill.table);
            const oldTableNumber = oldTable ? oldTable.number : 'غير محدد';

            // Search for existing unpaid bill on the new table
            const existingNewTableBill = await Bill.findOne({
                table: newTableId,
                organization: req.user.organization,
                status: { $in: ['draft', 'partial', 'overdue'] }
            }).sort({ createdAt: -1 });

            let finalBill = null;

            if (existingNewTableBill) {
                // Case 1: New table has an existing unpaid bill - move session to it
                Logger.info(`🔄 Moving session to existing bill on table ${newTable.number}`, {
                    sessionId: session._id,
                    fromBill: currentBill.billNumber,
                    toBill: existingNewTableBill.billNumber,
                });

                const sessionIdStr = session._id.toString();

                // STEP 1: Add session to new table bill first
                const sessionAlreadyInNewBill = existingNewTableBill.sessions.some(s => {
                    const sIdStr = s._id ? s._id.toString() : s.toString();
                    return sIdStr === sessionIdStr;
                });
                
                if (!sessionAlreadyInNewBill) {
                    existingNewTableBill.sessions.push(session._id);
                    Logger.info(`✅ STEP 1: Added session to new bill`, {
                        sessionId: sessionIdStr,
                        newBillId: existingNewTableBill._id.toString(),
                        totalSessions: existingNewTableBill.sessions.length,
                    });
                }
                
                await existingNewTableBill.calculateSubtotal();
                await existingNewTableBill.save();

                // Update session's bill reference
                session.bill = existingNewTableBill._id;
                await session.save();

                // STEP 2: Remove session from old bill
                currentBill.sessions = currentBill.sessions.filter(s => {
                    const sIdStr = s._id ? s._id.toString() : s.toString();
                    return sIdStr !== sessionIdStr;
                });
                
                Logger.info(`✅ STEP 2: Removed session from old bill`, {
                    sessionId: sessionIdStr,
                    currentBillId: currentBill._id.toString(),
                    remainingSessions: currentBill.sessions.length,
                });
                
                await currentBill.calculateSubtotal();
                await currentBill.save();

                finalBill = existingNewTableBill;

            } else {
                // Case 2: New table has no unpaid bill - create new bill for it
                Logger.info(`🆕 Creating new bill for table ${newTable.number}`, {
                    sessionId: session._id,
                    fromBill: currentBill.billNumber,
                });

                const sessionIdStr = session._id.toString();

                // STEP 1: Create new bill for the new table with session
                const newBill = new Bill({
                    table: newTableId,
                    customerName: `طاولة ${newTable.number}`,
                    sessions: [session._id],
                    orders: [],
                    billType: "cafe",
                    status: "draft",
                    organization: req.user.organization,
                    createdBy: req.user._id,
                    updatedBy: req.user._id,
                });

                await newBill.calculateSubtotal();
                await newBill.save();
                
                Logger.info(`✅ STEP 1: Created new bill with session`, {
                    sessionId: sessionIdStr,
                    newBillId: newBill._id.toString(),
                    billNumber: newBill.billNumber,
                });

                // Update session's bill reference
                session.bill = newBill._id;
                await session.save();

                // STEP 2: Remove session from old bill
                currentBill.sessions = currentBill.sessions.filter(s => {
                    const sIdStr = s._id ? s._id.toString() : s.toString();
                    return sIdStr !== sessionIdStr;
                });
                
                Logger.info(`✅ STEP 2: Removed session from old bill`, {
                    sessionId: sessionIdStr,
                    currentBillId: currentBill._id.toString(),
                    remainingSessions: currentBill.sessions.length,
                });
                
                await currentBill.calculateSubtotal();
                await currentBill.save();

                finalBill = newBill;
            }

            // STEP 3: Check if old bill is now empty and delete it properly if so
            // This uses the same deletion mechanism as the delete button in billing management page
            const updatedCurrentBill = await Bill.findById(currentBill._id);
            if (updatedCurrentBill && 
                updatedCurrentBill.sessions.length === 0 && 
                updatedCurrentBill.orders.length === 0) {
                
                Logger.info(`🔄 STEP 3: Old bill ${updatedCurrentBill.billNumber} is now empty, merging with destination bill...`, {
                    billId: updatedCurrentBill._id,
                    destinationBill: finalBill.billNumber,
                });
                
                // Merge the empty bill with the final bill (where the session moved to)
                Logger.info(`🔗 Merging empty bill ${updatedCurrentBill.billNumber} with destination bill ${finalBill.billNumber}`);
                
                // Copy any useful information from empty bill to final bill
                let mergeNotes = '';
                if (updatedCurrentBill.notes && updatedCurrentBill.notes.trim()) {
                    mergeNotes = `\n[مدمج من ${updatedCurrentBill.billNumber}]: ${updatedCurrentBill.notes}`;
                }
                
                // Copy any payments from empty bill to final bill
                if (updatedCurrentBill.payments && updatedCurrentBill.payments.length > 0) {
                    Logger.info(`💰 Transferring ${updatedCurrentBill.payments.length} payments from empty bill to destination bill`);
                    finalBill.payments = finalBill.payments || [];
                    finalBill.payments.push(...updatedCurrentBill.payments);
                    
                    // Update paid amount
                    const transferredAmount = updatedCurrentBill.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
                    finalBill.paid = (finalBill.paid || 0) + transferredAmount;
                    
                    mergeNotes += `\n[تم نقل مدفوعات بقيمة ${transferredAmount} ج.م]`;
                }
                
                // Copy any partial payments
                if (updatedCurrentBill.partialPayments && updatedCurrentBill.partialPayments.length > 0) {
                    Logger.info(`💳 Transferring ${updatedCurrentBill.partialPayments.length} partial payments from empty bill`);
                    finalBill.partialPayments = finalBill.partialPayments || [];
                    finalBill.partialPayments.push(...updatedCurrentBill.partialPayments);
                }
                
                // Add merge information to final bill notes
                const currentNotes = finalBill.notes || '';
                finalBill.notes = currentNotes + `\n[تم دمج فاتورة فارغة ${updatedCurrentBill.billNumber}]` + mergeNotes;
                
                // Update final bill totals
                await finalBill.calculateSubtotal();
                finalBill.remaining = finalBill.total - (finalBill.paid || 0);
                await finalBill.save();
                
                // Delete the empty bill
                await updatedCurrentBill.deleteOne();
                
                Logger.info(`✅ STEP 3: Successfully merged empty bill ${updatedCurrentBill.billNumber} with destination bill ${finalBill.billNumber}`, {
                    finalBillTotal: finalBill.total,
                    finalBillPaid: finalBill.paid,
                    finalBillRemaining: finalBill.remaining
                });
                
                // Update table status if needed
                if (updatedCurrentBill.table) {
                    const unpaidBills = await Bill.find({
                        table: updatedCurrentBill.table,
                        status: { $in: ['draft', 'partial', 'overdue'] }
                    });
                    
                    const newTableStatus = unpaidBills.length > 0 ? 'occupied' : 'empty';
                    await Table.findByIdAndUpdate(updatedCurrentBill.table, { status: newTableStatus });
                    Logger.info(`✅ Updated table status to: ${newTableStatus}`);
                }
            } else if (updatedCurrentBill) {
                Logger.info(`ℹ️ Old bill ${updatedCurrentBill.billNumber} still has content, keeping it`, {
                    sessionsCount: updatedCurrentBill.sessions.length,
                    ordersCount: updatedCurrentBill.orders.length,
                });
            }

            // Wait a moment for all database operations to complete
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Populate final bill data
            await finalBill.populate([
                { path: "sessions", select: "deviceName deviceNumber" },
                { path: "orders", select: "orderNumber" },
                { path: "table", select: "number name" }
            ]);

            // Reload session with populated bill and table
            const updatedSession = await Session.findById(session._id)
                .populate({
                    path: "bill",
                    populate: {
                        path: "table",
                        select: "number name"
                    }
                });

            // Create notification
            try {
                if (req.user && req.user.organization) {
                    await NotificationService.createNotification({
                        type: "session",
                        category: "session",
                        title: "تغيير طاولة الجلسة",
                        message: `تم نقل جلسة ${session.deviceName} من طاولة ${oldTableNumber} إلى طاولة ${newTable.number}`,
                        createdBy: req.user._id,
                    }, req.user);
                }
            } catch (notificationError) {
                Logger.error("Failed to create table change notification:", notificationError);
            }

            Logger.info(`✓ Session table changed successfully:`, {
                sessionId: session._id,
                deviceName: session.deviceName,
                fromTable: oldTableNumber,
                toTable: newTable.number,
                finalBillId: finalBill._id,
                updatedBy: req.user.name,
            });

            // Skip automatic cleanup after changing table since we already handled it manually
            // The manual process above (STEP 1, 2, 3) already ensures data consistency
            Logger.info("✅ Manual cleanup completed during table change - skipping automatic cleanup");
            
            // Final verification that old bill is gone
            const finalBillCheck = await Bill.findById(currentBill._id);
            if (finalBillCheck) {
                Logger.warn(`⚠️ WARNING: Old bill ${currentBill.billNumber} still exists after table change!`, {
                    billId: finalBillCheck._id,
                    sessionsCount: finalBillCheck.sessions?.length || 0,
                    ordersCount: finalBillCheck.orders?.length || 0
                });
            } else {
                Logger.info(`✅ CONFIRMED: Old bill was successfully removed`);
            }

            res.json({
                success: true,
                message: `تم نقل الجلسة من طاولة ${oldTableNumber} إلى طاولة ${newTable.number} بنجاح`,
                data: {
                    session: updatedSession,
                    bill: {
                        id: finalBill._id,
                        billNumber: finalBill.billNumber,
                        customerName: finalBill.customerName,
                        total: finalBill.total,
                        status: finalBill.status,
                        table: newTable.number,
                        sessionsCount: finalBill.sessions.length,
                        ordersCount: finalBill.orders.length,
                    },
                    oldTable: oldTableNumber,
                    newTable: newTable.number,
                },
            });

        } catch (err) {
            Logger.error("changeSessionTable error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في تغيير طاولة الجلسة",
                error: err.message,
            });
        }
    },

    // Clean up duplicate session references in bills - can be called automatically
    cleanupDuplicateSessionReferences: async (req, res) => {
        try {
            const result = await performCleanupHelper(req.user.organization);
            
            res.json({
                success: true,
                message: `تم تنظيف ${result.cleanedCount} مرجع مكرر بنجاح`,
                data: result
            });
            
        } catch (err) {
            Logger.error("cleanupDuplicateSessionReferences error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في تنظيف المراجع المكررة",
                error: err.message,
            });
        }
    },

    // Helper function to perform cleanup - can be called internally
    performCleanup: async (organizationId) => {
        return await performCleanupHelper(organizationId);
    },

    // Update session start time
    updateSessionStartTime: async (req, res) => {
        try {
            const { id } = req.params;
            const { startTime } = req.body;

            // Validate input
            if (!startTime) {
                return res.status(400).json({
                    success: false,
                    message: "وقت البدء الجديد مطلوب",
                    error: "Start time is required",
                });
            }

            // Find the session
            const session = await Session.findOne({
                _id: id,
                organization: req.user.organization,
            }).populate("bill");

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            if (session.status !== "active") {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن تعديل وقت بدء جلسة غير نشطة",
                    error: "Cannot edit start time of inactive session",
                });
            }

            // Parse and validate the new start time
            const newStartTime = new Date(startTime);
            const currentTime = new Date();

            // Check if the new start time is valid
            if (isNaN(newStartTime.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "وقت البدء غير صحيح",
                    error: "Invalid start time format",
                });
            }

            // Check if the new start time is not in the future
            if (newStartTime > currentTime) {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن تعديل وقت البدء إلى وقت في المستقبل",
                    error: "Start time cannot be in the future",
                });
            }

            // Check if the new start time is not more than 24 hours ago
            const twentyFourHoursAgo = new Date(currentTime.getTime() - (24 * 60 * 60 * 1000));
            if (newStartTime < twentyFourHoursAgo) {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن تعديل وقت البدء إلى أكثر من 24 ساعة في الماضي",
                    error: "Start time cannot be more than 24 hours ago",
                });
            }

            // Store old start time for logging
            const oldStartTime = session.startTime;

            // Update session start time
            session.startTime = newStartTime;
            session.updatedBy = req.user._id;

            // Update controllers history if it exists
            if (session.controllersHistory && session.controllersHistory.length > 0) {
                // Update the first period's start time
                session.controllersHistory[0].from = newStartTime;
            }

            // Save the session
            await session.save();

            // Recalculate current cost with new start time
            const currentCost = await session.calculateCurrentCost();
            session.totalCost = currentCost;
            session.finalCost = currentCost - (session.discount || 0);

            // Update the associated bill if it exists
            if (session.bill) {
                try {
                    const bill = await Bill.findById(session.bill);
                    if (bill) {
                        await bill.calculateSubtotal();
                        await bill.save();
                    }
                } catch (billError) {
                    Logger.error("❌ Error updating bill after start time change:", billError);
                }
            }

            // Populate session data
            await session.populate(["createdBy", "updatedBy", "bill"], "name");

            // Create notification
            try {
                if (req.user && req.user.organization) {
                    await NotificationService.createNotification({
                        type: "session",
                        category: "session",
                        title: "تعديل وقت بدء الجلسة",
                        message: `تم تعديل وقت بدء جلسة ${session.deviceName} من ${oldStartTime.toLocaleString('ar-EG')} إلى ${newStartTime.toLocaleString('ar-EG')}`,
                        createdBy: req.user._id,
                    }, req.user);
                }
            } catch (notificationError) {
                Logger.error(
                    "Failed to create start time update notification:",
                    notificationError
                );
            }

            Logger.info(`✓ Session start time updated:`, {
                sessionId: session._id,
                deviceName: session.deviceName,
                oldStartTime: oldStartTime.toISOString(),
                newStartTime: newStartTime.toISOString(),
                updatedBy: req.user.name,
            });

            res.json({
                success: true,
                message: "تم تعديل وقت بدء الجلسة بنجاح",
                data: session,
            });

        } catch (err) {
            Logger.error("updateSessionStartTime error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في تعديل وقت بدء الجلسة",
                error: err.message,
            });
        }
    },
};

// Helper function to merge two bills
async function mergeBills(sourceBill, targetBill, session, userId) {
    try {
        Logger.info(`🔄 Starting bill merge:`, {
            sourceBillId: sourceBill._id,
            sourceBillNumber: sourceBill.billNumber,
            targetBillId: targetBill._id,
            targetBillNumber: targetBill.billNumber,
        });

        // Transfer session to target bill (avoid duplicates)
        if (!targetBill.sessions.includes(session._id)) {
            targetBill.sessions.push(session._id);
        }

        // Transfer all other sessions from source bill (avoid duplicates)
        for (const sessionId of sourceBill.sessions) {
            if (!targetBill.sessions.some(s => s.toString() === sessionId.toString())) {
                targetBill.sessions.push(sessionId);
            }
        }

        // Transfer all orders from source bill (avoid duplicates)
        if (sourceBill.orders && sourceBill.orders.length > 0) {
            for (const orderId of sourceBill.orders) {
                if (!targetBill.orders.some(o => o.toString() === orderId.toString())) {
                    targetBill.orders.push(orderId);
                }
            }
        }

        // Transfer all payments from source bill
        if (sourceBill.payments && sourceBill.payments.length > 0) {
            targetBill.payments.push(...sourceBill.payments);
        }

        // Aggregate paid amounts
        targetBill.paid = (targetBill.paid || 0) + (sourceBill.paid || 0);

        // Update bill metadata
        targetBill.updatedBy = userId;

        // Recalculate subtotal and total
        await targetBill.calculateSubtotal();
        await targetBill.save();

        // Update session reference to point to target bill
        session.bill = targetBill._id;
        await session.save();

        // Update all other sessions from source bill to point to target bill
        await Session.updateMany(
            { bill: sourceBill._id },
            { $set: { bill: targetBill._id } }
        );

        // Delete source bill
        await Bill.findByIdAndDelete(sourceBill._id);

        Logger.info(`✅ Bill merge completed successfully:`, {
            deletedBillId: sourceBill._id,
            deletedBillNumber: sourceBill.billNumber,
            finalBillId: targetBill._id,
            finalBillNumber: targetBill.billNumber,
            finalTotal: targetBill.total,
            finalPaid: targetBill.paid,
            sessionsCount: targetBill.sessions.length,
            ordersCount: targetBill.orders.length,
        });

        return targetBill;

    } catch (error) {
        Logger.error("❌ Bill merge failed:", error);
        throw error;
    }
    // Helper function to properly delete a bill (similar to billingController.deleteBill)
    deleteBillProperly: async (bill) => {
        try {
            Logger.info(`🗑️ Starting proper deletion of bill: ${bill.billNumber}`, {
                billId: bill._id,
                ordersCount: bill.orders?.length || 0,
                sessionsCount: bill.sessions?.length || 0
            });

            // Store table reference before deletion
            const tableId = bill.table?._id || bill.table;
            const organizationId = bill.organization;
            
            // Store order and session IDs before deletion
            let orderIds = bill.orders || [];
            let sessionIds = bill.sessions || [];

            // Import required modules
            const { default: Order } = await import('../models/Order.js');
            const { default: dualDatabaseManager } = await import('../config/dualDatabaseManager.js');
            const { default: syncConfig } = await import('../config/syncConfig.js');
            const { updateTableStatusIfNeeded } = await import('../utils/tableUtils.js');

            // Fallback: البحث عن الطلبات والجلسات المرتبطة بالفاتورة مباشرة من قاعدة البيانات
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
                    }
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
                    }
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
                }
            } finally {
                // إعادة تفعيل المزامنة
                syncConfig.enabled = originalSyncEnabled;
                Logger.info(`🔓 Sync middleware re-enabled`);
            }

            // Update table status based on remaining unpaid bills
            if (tableId) {
                await updateTableStatusIfNeeded(tableId, organizationId);
            }

            Logger.info(`✅ Successfully deleted bill ${bill.billNumber} properly`);
            
        } catch (error) {
            Logger.error(`❌ Error in deleteBillProperly for bill ${bill.billNumber}:`, error);
            throw error;
        }
    }

}

export default sessionController;
