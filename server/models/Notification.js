import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "عنوان الإشعار مطلوب"],
            trim: true,
        },
        message: {
            type: String,
            required: [true, "محتوى الإشعار مطلوب"],
            trim: true,
        },
        type: {
            type: String,
            enum: [
                "info",
                "success",
                "warning",
                "error",
                "session",
                "order",
                "inventory",
                "billing",
                "system",
            ],
            default: "info",
        },
        category: {
            type: String,
            enum: [
                "session",
                "order",
                "inventory",
                "billing",
                "system",
                "security",
                "backup",
            ],
            required: true,
        },
        priority: {
            type: String,
            enum: ["low", "medium", "high", "urgent"],
            default: "medium",
        },
        targetRoles: [
            {
                type: String,
                enum: ["admin", "staff", "cashier", "kitchen", "all"],
                default: "all",
            },
        ],
        targetPermissions: [
            {
                type: String,
                enum: [
                    "dashboard",
                    "playstation",
                    "computer",
                    "cafe",
                    "billing",
                    "reports",
                    "inventory",
                    "costs",
                    "users",
                    "settings",
                    "all",
                ],
            },
        ],
        targetUsers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        readBy: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                readAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        actionRequired: {
            type: Boolean,
            default: false,
        },
        actionUrl: {
            type: String,
            default: null,
        },
        actionText: {
            type: String,
            default: null,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        expiresAt: {
            type: Date,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for better performance
notificationSchema.index({ targetRoles: 1, isActive: 1, createdAt: -1 });
notificationSchema.index({ targetUsers: 1, isActive: 1, createdAt: -1 });
notificationSchema.index({ category: 1, isActive: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for checking if notification is expired
notificationSchema.virtual("isExpired").get(function () {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
});

// Method to mark as read by user
notificationSchema.methods.markAsRead = function (userId) {
    const existingRead = this.readBy.find(
        (read) => read.user.toString() === userId.toString()
    );
    if (!existingRead) {
        this.readBy.push({ user: userId, readAt: new Date() });
    }
    return this.save();
};

// Method to check if user has read this notification
notificationSchema.methods.isReadByUser = function (userId) {
    return this.readBy.some(
        (read) => read.user.toString() === userId.toString()
    );
};

// Method to check if user should receive this notification
notificationSchema.methods.shouldReceive = function (user) {
    // Check if notification is active and not expired
    if (!this.isActive || this.isExpired) {
        return false;
    }

    // Check if user is specifically targeted
    if (this.targetUsers.length > 0) {
        return this.targetUsers.some(
            (targetUser) => targetUser.toString() === user._id.toString()
        );
    }

    // Check if user's role is targeted
    if (this.targetRoles.length > 0 && !this.targetRoles.includes("all")) {
        return this.targetRoles.includes(user.role);
    }

    // Check if user has required permissions
    if (this.targetPermissions.length > 0) {
        return this.targetPermissions.some((permission) =>
            user.hasPermission(permission)
        );
    }

    // If no specific targeting, send to all
    return true;
};

// Static method to create session notification
notificationSchema.statics.createSessionNotification = function (
    type,
    session,
    createdBy
) {
    const notifications = {
        started: {
            title: "جلسة جديدة",
            message: `تم بدء جلسة جديدة على ${session.deviceName}`,
            type: "session",
            category: "session",
            priority: "medium",
            targetRoles: ["admin", "staff"],
            targetPermissions: ["playstation", "computer"],
        },
        ended: {
            title: "انتهاء الجلسة",
            message: `انتهت الجلسة على ${session.deviceName} - التكلفة: ${session.finalCost} ج.م`,
            type: "session",
            category: "session",
            priority: "medium",
            targetRoles: ["admin", "staff"],
            targetPermissions: ["playstation", "computer"],
        },
        paused: {
            title: "إيقاف مؤقت للجلسة",
            message: `تم إيقاف الجلسة مؤقتاً على ${session.deviceName}`,
            type: "warning",
            category: "session",
            priority: "low",
            targetRoles: ["admin", "staff"],
            targetPermissions: ["playstation", "computer"],
        },
    };

    const notificationData = notifications[type];
    if (!notificationData) return null;

    return new this({
        ...notificationData,
        metadata: { sessionId: session._id, deviceType: session.deviceType },
        createdBy,
    });
};

// Static method to create order notification
notificationSchema.statics.createOrderNotification = function (
    type,
    order,
    createdBy
) {
    const notifications = {
        created: {
            title: "طلب جديد",
            message: `طلب جديد من ${order.customerName} - ${order.items.length} عنصر`,
            type: "order",
            category: "order",
            priority: "high",
            targetRoles: ["kitchen", "admin"],
            targetPermissions: ["cafe"],
            actionRequired: true,
            actionUrl: `/cafe?tab=orders`,
            actionText: "عرض الطلب",
        },
        ready: {
            title: "طلب جاهز",
            message: `الطلب ${order.orderNumber} جاهز للتسليم`,
            type: "success",
            category: "order",
            priority: "medium",
            targetRoles: ["staff", "admin"],
            targetPermissions: ["cafe"],
            actionRequired: true,
            actionUrl: `/cafe?tab=orders`,
            actionText: "تسليم الطلب",
        },
        cancelled: {
            title: "طلب ملغي",
            message: `تم إلغاء الطلب ${order.orderNumber}`,
            type: "error",
            category: "order",
            priority: "medium",
            targetRoles: ["admin", "kitchen"],
            targetPermissions: ["cafe"],
        },
    };

    const notificationData = notifications[type];
    if (!notificationData) return null;

    return new this({
        ...notificationData,
        metadata: { orderId: order._id, orderNumber: order.orderNumber },
        createdBy,
    });
};

// Static method to create inventory notification
notificationSchema.statics.createInventoryNotification = function (
    type,
    item,
    createdBy
) {
    const notifications = {
        low_stock: {
            title: "مخزون منخفض",
            message: `المخزون منخفض للمنتج: ${item.name} (${item.currentStock} ${item.unit})`,
            type: "warning",
            category: "inventory",
            priority: "high",
            targetRoles: ["admin"],
            targetPermissions: ["inventory"],
            actionRequired: true,
            actionUrl: `/inventory`,
            actionText: "إدارة المخزون",
        },
        out_of_stock: {
            title: "نفاد المخزون",
            message: `نفد المخزون للمنتج: ${item.name}`,
            type: "error",
            category: "inventory",
            priority: "urgent",
            targetRoles: ["admin"],
            targetPermissions: ["inventory"],
            actionRequired: true,
            actionUrl: `/inventory`,
            actionText: "إعادة التوريد",
        },
    };

    const notificationData = notifications[type];
    if (!notificationData) return null;

    return new this({
        ...notificationData,
        metadata: { itemId: item._id, itemName: item.name },
        createdBy,
    });
};

// Static method to create billing notification
notificationSchema.statics.createBillingNotification = function (
    type,
    bill,
    createdBy
) {
    const notifications = {
        created: {
            title: "فاتورة جديدة",
            message: `فاتورة جديدة ${bill.billNumber} - ${bill.customerName}`,
            type: "billing",
            category: "billing",
            priority: "medium",
            targetRoles: ["admin", "cashier"],
            targetPermissions: ["billing"],
            actionRequired: true,
            actionUrl: `/billing`,
            actionText: "عرض الفاتورة",
        },
        paid: {
            title: "دفع مكتمل",
            message: `تم دفع الفاتورة ${bill.billNumber} بالكامل`,
            type: "success",
            category: "billing",
            priority: "low",
            targetRoles: ["admin", "cashier"],
            targetPermissions: ["billing"],
        },
        partial_payment: {
            title: "دفع جزئي",
            message: `تم دفع جزء من الفاتورة ${bill.billNumber} - المتبقي: ${bill.remaining} ج.م`,
            type: "info",
            category: "billing",
            priority: "medium",
            targetRoles: ["admin", "cashier"],
            targetPermissions: ["billing"],
        },
    };

    const notificationData = notifications[type];
    if (!notificationData) return null;

    return new this({
        ...notificationData,
        metadata: { billId: bill._id, billNumber: bill.billNumber },
        createdBy,
    });
};

// Static method to get notifications for user
notificationSchema.statics.getForUser = function (userId, user, options = {}) {
    const query = {
        isActive: true,
        $or: [
            { targetUsers: userId },
            { targetRoles: "all" },
            { targetRoles: user.role },
            { targetPermissions: { $in: user.permissions } },
        ],
    };

    if (options.category) {
        query.category = options.category;
    }

    if (options.unreadOnly) {
        query["readBy.user"] = { $ne: userId };
    }

    return this.find(query)
        .sort({ createdAt: -1 })
        .limit(options.limit || 50)
        .populate("createdBy", "name")
        .populate("targetUsers", "name");
};

// Static method to mark all notifications as read for user
notificationSchema.statics.markAllAsRead = function (userId) {
    return this.updateMany(
        {
            "readBy.user": { $ne: userId },
            isActive: true,
        },
        {
            $push: {
                readBy: {
                    user: userId,
                    readAt: new Date(),
                },
            },
        }
    );
};

// Static method to clean expired notifications
notificationSchema.statics.cleanExpired = function () {
    return this.deleteMany({
        expiresAt: { $lt: new Date() },
    });
};

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
