import Session from "../models/Session.js";
import Device from "../models/Device.js";
import Bill from "../models/Bill.js";
import Table from "../models/Table.js";
import Logger from "../middleware/logger.js";
import NotificationService from "../services/notificationService.js";

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
                // تحديد نوع الفاتورة
                let billType = "cafe";
                let customerNameForBill = `عميل (${deviceName})`;
                let tableName = deviceName;

                if (deviceType === "playstation") {
                    billType = "playstation";
                } else if (deviceType === "computer") {
                    billType = "computer";
                }

                // إذا كان هناك table، ابحث عن فاتورة موجودة غير مدفوعة
                let tableNumber = null;
                if (table) {
                    // Get table info for logging
                    const tableDoc = await Table.findById(table);
                    tableNumber = tableDoc ? tableDoc.number : table;
                    
                    const existingBill = await Bill.findOne({
                        table: table,
                        organization: req.user.organization,
                        status: { $in: ['draft', 'partial', 'overdue'] }
                    }).sort({ createdAt: -1 }); // أحدث فاتورة

                    if (existingBill) {
                        bill = existingBill;
                        Logger.info(`✓ تم العثور على فاتورة موجودة للطاولة ${tableNumber}:`, {
                            billId: bill._id,
                            billNumber: bill.billNumber,
                            billType: bill.billType,
                            status: bill.status
                        });
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

                // Save session with bill reference
                await session.save();
                await session.populate(["createdBy", "bill"], "name");

                // Add session to bill (تأكد من عدم التكرار)
                if (!bill.sessions.includes(session._id)) {
                    bill.sessions.push(session._id);
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
                        // تحديد اسم العميل بنفس منطق البداية
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
                        
                        Logger.info(`✓ Updating bill with customer name: ${customerNameForBill}`);
                        
                        // Update bill with final session cost and customer name
                        updatedBill.customerName = customerNameForBill;
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
                    // تحديد اسم العميل
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

                    Logger.info(`✓ Creating new bill with customer name: ${customerNameForBill}`);

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
                
                // Determine customer name for new bill
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
                await NotificationService.createNotification({
                    type: "session",
                    title: "فك ربط جلسة من طاولة",
                    message: `تم فك ربط جلسة ${session.deviceName} من الطاولة ${tableNumber}`,
                    organization: req.user.organization,
                    createdBy: req.user._id,
                });
            } catch (notificationError) {
                Logger.error(
                    "Failed to create unlink notification:",
                    notificationError
                );
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
                // Case 1: Table has an existing unpaid bill - merge bills
                Logger.info(`✓ Found existing bill on table ${table.number}, merging...`, {
                    sessionBillId: sessionBill._id,
                    sessionBillNumber: sessionBill.billNumber,
                    tableBillId: existingTableBill._id,
                    tableBillNumber: existingTableBill.billNumber,
                });

                // Merge bills using helper function
                finalBill = await mergeBills(sessionBill, existingTableBill, session, req.user._id);

            } else {
                // Case 2: No existing bill on table - transfer session bill to table
                Logger.info(`✓ No existing bill on table ${table.number}, transferring session bill...`, {
                    sessionBillId: sessionBill._id,
                    sessionBillNumber: sessionBill.billNumber,
                });

                sessionBill.table = tableId;
                sessionBill.billType = "cafe"; // Change to cafe type when linked to table
                sessionBill.updatedBy = req.user._id;
                await sessionBill.save();
                
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
                        title: "ربط جلسة بطاولة",
                        message: `تم ربط جلسة ${session.deviceName} بالطاولة ${table.number}`,
                        organization: req.user.organization,
                        createdBy: req.user._id,
                    });
                }
            } catch (notificationError) {
                Logger.error(
                    "Failed to create link notification:",
                    notificationError
                );
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
}

export default sessionController;
