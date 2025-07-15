import Session from "../models/Session.js";
import Device from "../models/Device.js";
import Bill from "../models/Bill.js";
import Logger from "../middleware/logger.js";
import NotificationService from "../services/notificationService.js";

const sessionController = {
    // Get all sessions
    getSessions: async (req, res) => {
        try {
            const { status, deviceType, page = 1, limit = 10 } = req.query;

            const query = {};
            if (status) query.status = status;
            if (deviceType) query.deviceType = deviceType;

            const sessions = await Session.find(query)
                .populate("createdBy", "name")
                .populate("updatedBy", "name")
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
            const session = await Session.findById(req.params.id)
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
                customerName,
                controllers,
            } = req.body;

            // Validate required fields
            if (!deviceNumber || !deviceName || !deviceType) {
                return res.status(400).json({
                    success: false,
                    message: "رقم الجهاز واسمه ونوعه مطلوبان",
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
                deviceType,
                customerName: `عميل (${deviceName})`,
                controllers: controllers || 1,
                createdBy: req.user._id,
            });

            // Create bill automatically for the session
            let bill = null;
            try {
                // تحديد اسم العميل ليكون دائماً "عميل (اسم الجهاز)"
                let billType = "cafe";
                let customerNameForBill = `عميل (${deviceName})`;
                let tableName = deviceName;

                if (deviceType === "playstation") {
                    billType = "playstation";
                } else if (deviceType === "computer") {
                    billType = "computer";
                }

                const billData = {
                    tableNumber: tableName,
                    customerName: customerNameForBill,
                    sessions: [], // سنضيف الجلسة بعد حفظها
                    subtotal: 0, // سيتم تحديثه عند إنهاء الجلسة
                    total: 0, // سيتم تحديثه عند إنهاء الجلسة
                    discount: 0,
                    tax: 0,
                    notes: `فاتورة جلسة ${tableName} - ${deviceType}`,
                    billType: billType,
                    status: "draft", // فاتورة مسودة حتى تنتهي الجلسة
                    createdBy: req.user._id,
                };

                bill = await Bill.create(billData);

                // Link session to bill
                session.bill = bill._id;

                // Save session with bill reference
                await session.save();
                await session.populate(["createdBy", "bill"], "name");

                // Add session to bill
                bill.sessions.push(session._id);
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
                } else {
                    Logger.info(
                        "✅ Session bill reference set successfully:",
                        session.bill
                    );
                }
            } catch (billError) {
                Logger.error("❌ خطأ في إنشاء الفاتورة التلقائية:", billError);
                // Save session without bill if bill creation fails
                await session.save();
                await session.populate("createdBy", "name");
            }

            // Update device status to active
            await Device.findOneAndUpdate(
                { number: deviceNumber },
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

            const session = await Session.findById(sessionId);

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

            // Update controllers using the method
            session.updateControllers(controllers);
            session.updatedBy = req.user._id;

            await session.save();
            await session.populate(["createdBy", "updatedBy"], "name");

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
            Logger.info("🔄 Updating session cost for ID:", id);

            const session = await Session.findById(id).populate("bill");

            if (!session) {
                Logger.error("❌ Session not found:", id);
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            if (session.status !== "active") {
                Logger.error("❌ Session is not active:", session.status);
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن تحديث تكلفة جلسة غير نشطة",
                    error: "Session is not active",
                });
            }

            // حساب التكلفة الحالية
            await session.calculateCost();
            await session.save();

            Logger.info("💰 Session cost updated:", {
                sessionId: session._id,
                currentCost: session.finalCost,
                totalCost: session.totalCost,
                duration: session.startTime
                    ? Math.floor(
                          (new Date() - new Date(session.startTime)) /
                              (1000 * 60)
                      )
                    : 0,
            });

            // تحديث الفاتورة المرتبطة إذا وجدت
            let billUpdated = false;
            if (session.bill) {
                try {
                    const bill = await Bill.findById(session.bill);
                    if (bill) {
                        await bill.calculateSubtotal();
                        await bill.save();
                        billUpdated = true;
                        Logger.info("✅ Bill updated successfully:", {
                            billId: bill._id,
                            billNumber: bill.billNumber,
                            newTotal: bill.total,
                        });
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
            Logger.info("🔄 Ending session with ID:", id);

            const session = await Session.findById(id).populate("bill");

            if (!session) {
                Logger.error("❌ Session not found:", id);
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            if (session.status !== "active") {
                Logger.error("❌ Session is not active:", session.status);
                return res.status(400).json({
                    success: false,
                    message: "الجلسة غير نشطة",
                    error: "Session is not active",
                });
            }

            Logger.info("📊 Session before ending:", {
                id: session._id,
                deviceType: session.deviceType,
                deviceName: session.deviceName,
                startTime: session.startTime,
                controllers: session.controllers,
                controllersHistory: session.controllersHistory,
            });

            // End session using the method
            session.endSession();
            session.updatedBy = req.user._id;

            await session.save();
            await session.populate(["createdBy", "updatedBy", "bill"], "name");

            Logger.info("✅ Session ended successfully:", {
                finalCost: session.finalCost,
                totalCost: session.totalCost,
                endTime: session.endTime,
            });

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
                { number: session.deviceNumber },
                { status: "available" }
            );

            // Update existing bill with final cost
            let bill = null;
            if (session.bill) {
                try {
                    bill = await Bill.findById(session.bill);
                    if (bill) {
                        // تحديد اسم العميل بنفس منطق البداية
                        let customerNameForBill = "";
                        const deviceType = session.deviceType;
                        const deviceNumber = session.deviceNumber;
                        const customerName = session.customerName;
                        if (deviceType === "playstation") {
                            if (!customerName || customerName.trim() === "") {
                                customerNameForBill = `عميل بلايستيشن PS${deviceNumber}`;
                            } else {
                                customerNameForBill = `${customerName.trim()} PS${deviceNumber}`;
                            }
                        } else if (deviceType === "computer") {
                            if (!customerName || customerName.trim() === "") {
                                customerNameForBill = `عميل كمبيوتر PC${deviceNumber}`;
                            } else {
                                customerNameForBill = `${customerName.trim()} PC${deviceNumber}`;
                            }
                        } else {
                            if (!customerName || customerName.trim() === "") {
                                customerNameForBill = "عميل";
                            } else {
                                customerNameForBill = customerName.trim();
                            }
                        }
                        // Update bill with final session cost and customer name
                        bill.customerName = customerNameForBill;
                        bill.subtotal = session.finalCost || 0;
                        bill.total = session.finalCost || 0;
                        bill.discount = session.discount || 0;
                        bill.status = "partial"; // تغيير الحالة من draft إلى partial
                        bill.updatedBy = req.user._id;

                        await bill.save();
                        await bill.calculateSubtotal();
                        await bill.populate(["sessions", "createdBy"], "name");

                        // Verify bill was updated successfully
                        if (bill.total !== (session.finalCost || 0)) {
                            Logger.error("❌ Bill total not updated correctly");
                        }
                    } else {
                        Logger.error(
                            "❌ Bill not found for session:",
                            session.bill
                        );
                    }
                } catch (billError) {
                    Logger.error("❌ خطأ في تحديث الفاتورة:", billError);
                    // Continue with session ending even if bill update fails
                }
            } else {
                Logger.error(
                    "❌ No bill reference found in session:",
                    session._id
                );
                Logger.error("❌ Session data:", {
                    id: session._id,
                    deviceName: session.deviceName,
                    deviceType: session.deviceType,
                    bill: session.bill,
                });
            }

            res.json({
                success: true,
                message: "تم إنهاء الجلسة وتحديث الفاتورة بنجاح",
                data: {
                    session,
                    bill: bill
                        ? {
                              id: bill._id,
                              billNumber: bill.billNumber,
                              customerName: bill.customerName,
                              total: bill.total,
                              status: bill.status,
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
                customerName,
                controllers,
                billId,
            } = req.body;

            // Validate required fields
            if (!deviceNumber || !deviceName || !deviceType || !billId) {
                return res.status(400).json({
                    success: false,
                    message: "رقم الجهاز واسمه ونوعه ومعرف الفاتورة مطلوبان",
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

            // تحقق من وجود جلسة نشطة في الفاتورة (كمبيوتر أو بلايستيشن)
            if (bill.sessions && bill.sessions.length > 0) {
                const activeSessions = await Session.find({
                    _id: { $in: bill.sessions },
                    status: "active",
                    deviceType: { $in: ["playstation", "computer"] },
                });
                if (activeSessions.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "لا يمكن ربط جلسة بفاتورة بها جلسة نشطة بالفعل (كمبيوتر أو بلايستيشن)",
                        error: "Bill already has an active session",
                    });
                }
            }

            // Create new session
            const session = new Session({
                deviceNumber,
                deviceName,
                deviceType,
                customerName: customerName ? customerName.trim() : "",
                controllers: controllers || 1,
                createdBy: req.user._id,
                bill: billId, // Link to existing bill
            });

            // Save session
            await session.save();
            await session.populate(["createdBy", "bill"], "name");

            // Add session to bill
            bill.sessions.push(session._id);
            await bill.save();
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
                { number: deviceNumber },
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
            const sessions = await Session.find({ status: "active" })
                .populate("createdBy", "name")
                .populate(
                    "bill",
                    "billNumber customerName total status billType"
                )
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
};

export default sessionController;
