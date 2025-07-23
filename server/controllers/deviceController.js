import Device from "../models/Device.js";
import Session from "../models/Session.js";

const deviceController = {
    // Get all devices with filtering and pagination
    getDevices: async (req, res) => {
        try {
            const {
                type,
                status,
                page = 1,
                limit = 10,
                search,
                sortBy = "number",
                sortOrder = "asc",
            } = req.query;

            // Build query
            const query = {};
            if (type) query.type = type;
            if (status) query.status = status;
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { number: { $regex: search, $options: "i" } },
                ];
            }

            // Build sort object
            const sort = {};
            sort[sortBy] = sortOrder === "desc" ? -1 : 1;

            // Execute query with pagination
            const devices = await Device.find({
                organization: req.user.organization,
                ...query,
            })
                .sort(sort)
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Device.countDocuments({
                organization: req.user.organization,
                ...query,
            });

            res.json({
                success: true,
                count: devices.length,
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / limit),
                data: devices,
            });
        } catch (err) {
            console.error("getDevices error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في جلب الأجهزة",
                error: err.message,
            });
        }
    },

    // Get single device by ID
    getDevice: async (req, res) => {
        try {
            const { id } = req.params;

            const device = await Device.findOne({
                _id: id,
                organization: req.user.organization,
            });

            if (!device) {
                return res.status(404).json({
                    success: false,
                    message: "الجهاز غير موجود",
                    error: "Device not found",
                });
            }

            // Get active session for this device
            const activeSession = await Session.findOne({
                status: "active",
            });

            const deviceWithSession = {
                ...device.toObject(),
                activeSession: activeSession || null,
            };

            res.json({
                success: true,
                data: deviceWithSession,
            });
        } catch (err) {
            console.error("getDevice error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في جلب الجهاز",
                error: err.message,
            });
        }
    },

    // Create new device
    createDevice: async (req, res) => {
        try {
            const {
                name,
                number,
                type,
                status,
                controllers,
                hourlyRate,
                playstationRates,
            } = req.body;

            // Validate required fields
            if (!name || !number) {
                return res.status(400).json({
                    success: false,
                    message: "اسم الجهاز ورقمه مطلوبان",
                    error: "الحقول المطلوبة ناقصة",
                });
            }

            // Validate number is positive
            if (number <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "رقم الجهاز يجب أن يكون أكبر من 0",
                    error: "Invalid device number",
                });
            }

            // Check if device number already exists for the same type
            const prefix =
                (type || "playstation") === "playstation" ? "ps" : "pc";
            const deviceNumber = `${prefix}${number}`;

            const existingDevice = await Device.findOne({
                number: deviceNumber,
                organization: req.user.organization,
            });
            if (existingDevice) {
                return res.status(400).json({
                    success: false,
                    message: `رقم الجهاز ${number} مستخدم بالفعل في نفس النوع`,
                    error: "Device number already exists for this type",
                });
            }

            // Validate controllers count
            if (controllers && (controllers < 1 || controllers > 4)) {
                return res.status(400).json({
                    success: false,
                    message: "عدد الدراعات يجب أن يكون بين 1 و 4",
                    error: "Invalid controllers count",
                });
            }

            // التحقق من الأسعار
            if (
                (type === "computer" || !type) &&
                (hourlyRate === undefined || hourlyRate < 0)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "سعر الساعة للكمبيوتر مطلوب ويجب أن يكون رقم موجب",
                    error: "hourlyRate required for computer",
                });
            }
            if (type === "playstation") {
                if (!playstationRates || typeof playstationRates !== "object") {
                    return res.status(400).json({
                        success: false,
                        message:
                            "أسعار الساعة لكل عدد دراعات مطلوبة للبلايستيشن",
                        error: "playstationRates required for playstation",
                    });
                }
                // تحقق من وجود أسعار لكل عدد دراعات
                for (let i = 1; i <= 4; i++) {
                    if (
                        playstationRates[i] === undefined ||
                        playstationRates[i] < 0
                    ) {
                        return res.status(400).json({
                            success: false,
                            message: `سعر الساعة للدراعات (${i}) مطلوب ويجب أن يكون رقم موجب`,
                            error: `playstationRates[${i}] required`,
                        });
                    }
                }
            }

            // Create new device
            const deviceData = {
                name: name.trim(),
                number: parseInt(number),
                type: type || "playstation",
                status: status || "available",
                controllers: controllers || 2,
                organization: req.user.organization,
            };
            if ((type === "computer" || !type) && hourlyRate !== undefined) {
                deviceData.hourlyRate = hourlyRate;
            }
            if (type === "playstation" && playstationRates) {
                deviceData.playstationRates = playstationRates;
            }

            const device = new Device(deviceData);
            await device.save();

            res.status(201).json({
                success: true,
                message: "تم إضافة الجهاز بنجاح",
                data: device,
            });
        } catch (err) {
            console.error("createDevice error:", err);
            // Handle mongoose validation errors
            if (err.name === "ValidationError") {
                const errors = Object.values(err.errors).map((e) => e.message);
                return res.status(400).json({
                    success: false,
                    message: "بيانات الجهاز غير صحيحة",
                    error: errors.join(", "),
                });
            }
            res.status(400).json({
                success: false,
                message: "خطأ في إضافة الجهاز",
                error: err.message,
            });
        }
    },

    // Update device
    updateDevice: async (req, res) => {
        try {
            const { id } = req.params;
            const {
                name,
                number,
                type,
                status,
                controllers,
                hourlyRate,
                playstationRates,
            } = req.body;

            // Check if device exists
            const existingDevice = await Device.findOne({
                _id: id,
                organization: req.user.organization,
            });
            if (!existingDevice) {
                return res.status(404).json({
                    success: false,
                    message: "الجهاز غير موجود",
                    error: "Device not found",
                });
            }

            // Check if new number conflicts with existing device of the same type
            if (number && number !== existingDevice.number) {
                const deviceType = type || existingDevice.type;
                const prefix = deviceType === "playstation" ? "ps" : "pc";
                const deviceNumber = `${prefix}${number}`;
                const numberConflict = await Device.findOne({
                    number: deviceNumber,
                    organization: req.user.organization,
                    _id: { $ne: id },
                });
                if (numberConflict) {
                    return res.status(400).json({
                        success: false,
                        message: `رقم الجهاز ${number} مستخدم بالفعل في نفس النوع`,
                        error: "Device number already exists for this type",
                    });
                }
            }

            // Validate controllers count
            if (controllers && (controllers < 1 || controllers > 4)) {
                return res.status(400).json({
                    success: false,
                    message: "عدد الدراعات يجب أن يكون بين 1 و 4",
                    error: "Invalid controllers count",
                });
            }

            // التحقق من الأسعار
            if (
                (type === "computer" ||
                    (!type && existingDevice.type === "computer")) &&
                (hourlyRate === undefined || hourlyRate < 0)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "سعر الساعة للكمبيوتر مطلوب ويجب أن يكون رقم موجب",
                    error: "hourlyRate required for computer",
                });
            }
            if (
                type === "playstation" ||
                (!type && existingDevice.type === "playstation")
            ) {
                if (!playstationRates || typeof playstationRates !== "object") {
                    return res.status(400).json({
                        success: false,
                        message:
                            "أسعار الساعة لكل عدد دراعات مطلوبة للبلايستيشن",
                        error: "playstationRates required for playstation",
                    });
                }
                for (let i = 1; i <= 4; i++) {
                    if (
                        playstationRates[i] === undefined ||
                        playstationRates[i] < 0
                    ) {
                        return res.status(400).json({
                            success: false,
                            message: `سعر الساعة للدراعات (${i}) مطلوب ويجب أن يكون رقم موجب`,
                            error: `playstationRates[${i}] required`,
                        });
                    }
                }
            }

            // Build update object
            const updateData = {};
            if (name) updateData.name = name.trim();
            if (number) updateData.number = parseInt(number);
            if (type) updateData.type = type;
            if (status) updateData.status = status;
            if (controllers) updateData.controllers = controllers;
            if (
                (type === "computer" ||
                    (!type && existingDevice.type === "computer")) &&
                hourlyRate !== undefined
            ) {
                updateData.hourlyRate = hourlyRate;
            }
            if (
                (type === "playstation" ||
                    (!type && existingDevice.type === "playstation")) &&
                playstationRates
            ) {
                updateData.playstationRates = playstationRates;
            }

            const device = await Device.findOneAndUpdate(
                { _id: id, organization: req.user.organization },
                updateData,
                {
                    new: true,
                    runValidators: true,
                }
            );

            res.status(200).json({
                success: true,
                message: "تم تحديث بيانات الجهاز بنجاح",
                data: device,
            });
        } catch (err) {
            console.error("updateDevice error:", err);
            res.status(400).json({
                success: false,
                message: "خطأ في تحديث بيانات الجهاز",
                error: err.message,
            });
        }
    },

    // Update device status only
    updateDeviceStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!status) {
                return res.status(400).json({
                    success: false,
                    message: "حالة الجهاز مطلوبة",
                    error: "Status field is required",
                });
            }

            // Validate status value
            const validStatuses = ["available", "active", "maintenance"];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "حالة الجهاز غير صحيحة",
                    error: "Invalid status value",
                });
            }

            const device = await Device.findOneAndUpdate(
                { _id: id, organization: req.user.organization },
                { status },
                { new: true, runValidators: true }
            );

            if (!device) {
                return res.status(404).json({
                    success: false,
                    message: "الجهاز غير موجود",
                    error: "Device not found",
                });
            }

            res.json({
                success: true,
                message: "تم تحديث حالة الجهاز بنجاح",
                data: device,
            });
        } catch (err) {
            console.error("updateDeviceStatus error:", err);
            res.status(400).json({
                success: false,
                message: "خطأ في تحديث حالة الجهاز",
                error: err.message,
            });
        }
    },

    // Delete device
    deleteDevice: async (req, res) => {
        try {
            const { id } = req.params;

            // Check if device exists
            const device = await Device.findOne({
                _id: id,
                organization: req.user.organization,
            });
            if (!device) {
                return res.status(404).json({
                    success: false,
                    message: "الجهاز غير موجود",
                    error: "Device not found",
                });
            }

            // Check if device has active sessions
            const activeSession = await Session.findOne({
                status: "active",
            });

            if (activeSession) {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن حذف الجهاز لأنه مستخدم حالياً",
                    error: "Device has active session",
                });
            }

            // Check if device has any sessions (for data integrity)
            const sessionCount = await Session.countDocuments({
                deviceNumber: device.number,
                organization: req.user.organization,
            });

            if (sessionCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن حذف الجهاز لأنه يحتوي على جلسات سابقة",
                    error: "Device has historical sessions",
                });
            }

            await Device.findOneAndDelete({
                _id: id,
                organization: req.user.organization,
            });

            res.json({
                success: true,
                message: "تم حذف الجهاز بنجاح",
                data: {
                    id: device._id,
                    name: device.name,
                    number: device.number,
                },
            });
        } catch (err) {
            console.error("deleteDevice error:", err);
            res.status(400).json({
                success: false,
                message: "خطأ في حذف الجهاز",
                error: err.message,
            });
        }
    },

    // Get device statistics
    getDeviceStats: async (req, res) => {
        try {
            const stats = await Device.aggregate([
                {
                    $group: {
                        _id: null,
                        totalDevices: { $sum: 1 },
                        availableDevices: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$status", "available"] },
                                    1,
                                    0,
                                ],
                            },
                        },
                        activeDevices: {
                            $sum: {
                                $cond: [{ $eq: ["$status", "active"] }, 1, 0],
                            },
                        },
                        maintenanceDevices: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$status", "maintenance"] },
                                    1,
                                    0,
                                ],
                            },
                        },
                    },
                },
            ]);

            const typeStats = await Device.aggregate([
                {
                    $group: {
                        _id: "$type",
                        count: { $sum: 1 },
                    },
                },
            ]);

            const result = {
                total: stats[0]?.totalDevices || 0,
                available: stats[0]?.availableDevices || 0,
                active: stats[0]?.activeDevices || 0,
                maintenance: stats[0]?.maintenanceDevices || 0,
                byType: typeStats.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
            };

            res.json({
                success: true,
                data: result,
            });
        } catch (err) {
            console.error("getDeviceStats error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في جلب إحصائيات الأجهزة",
                error: err.message,
            });
        }
    },

    // Bulk operations
    bulkUpdateDevices: async (req, res) => {
        try {
            const { deviceIds, updates } = req.body;

            if (
                !deviceIds ||
                !Array.isArray(deviceIds) ||
                deviceIds.length === 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "قائمة الأجهزة مطلوبة",
                    error: "Device IDs array is required",
                });
            }

            if (!updates || Object.keys(updates).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "التحديثات مطلوبة",
                    error: "Updates object is required",
                });
            }

            const result = await Device.updateMany(
                {
                    _id: { $in: deviceIds },
                    organization: req.user.organization,
                },
                updates,
                { runValidators: true }
            );

            res.json({
                success: true,
                message: `تم تحديث ${result.modifiedCount} جهاز بنجاح`,
                data: {
                    matched: result.matchedCount,
                    modified: result.modifiedCount,
                },
            });
        } catch (err) {
            console.error("bulkUpdateDevices error:", err);
            res.status(400).json({
                success: false,
                message: "خطأ في التحديث الجماعي",
                error: err.message,
            });
        }
    },
};

export default deviceController;
