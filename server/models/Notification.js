import mongoose from "mongoose";
import { getNotificationTranslation, getActionTranslation } from "../utils/notificationTranslations.js";
import { getCurrencySymbol } from "../utils/localeHelper.js";

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
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
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
    createdBy,
    language = 'ar',
    currency = 'EGP'
) {
    const currencySymbol = getCurrencySymbol(currency, language);
    
    // Get translations for all languages
    const translations = {
        ar: {},
        en: {},
        fr: {}
    };
    
    if (type === 'started') {
        translations.ar = getNotificationTranslation('session', 'started', 'ar', session.deviceName);
        translations.en = getNotificationTranslation('session', 'started', 'en', session.deviceName);
        translations.fr = getNotificationTranslation('session', 'started', 'fr', session.deviceName);
    } else if (type === 'ended') {
        const arSymbol = getCurrencySymbol(currency, 'ar');
        const enSymbol = getCurrencySymbol(currency, 'en');
        const frSymbol = getCurrencySymbol(currency, 'fr');
        translations.ar = getNotificationTranslation('session', 'ended', 'ar', session.deviceName, session.finalCost, arSymbol);
        translations.en = getNotificationTranslation('session', 'ended', 'en', session.deviceName, session.finalCost, enSymbol);
        translations.fr = getNotificationTranslation('session', 'ended', 'fr', session.deviceName, session.finalCost, frSymbol);
    } else if (type === 'paused') {
        translations.ar = getNotificationTranslation('session', 'paused', 'ar', session.deviceName);
        translations.en = getNotificationTranslation('session', 'paused', 'en', session.deviceName);
        translations.fr = getNotificationTranslation('session', 'paused', 'fr', session.deviceName);
    } else {
        return null;
    }

    // Use current language for title and message
    const currentTranslation = translations[language];

    return new this({
        title: currentTranslation.title,
        message: currentTranslation.message,
        type: type === 'paused' ? 'warning' : 'session',
        category: 'session',
        priority: type === 'paused' ? 'low' : 'medium',
        targetRoles: ['admin', 'staff'],
        targetPermissions: ['playstation', 'computer'],
        metadata: { 
            sessionId: session._id, 
            deviceType: session.deviceType,
            language,
            currency,
            translations
        },
        createdBy,
        // Always get organization from session (session always has organization)
        organization: session.organization,
    });
};

// Static method to create order notification
notificationSchema.statics.createOrderNotification = function (
    type,
    order,
    createdBy,
    language = 'ar'
) {
    // Get translations for all languages
    const translations = {
        ar: {},
        en: {},
        fr: {}
    };
    
    let actionText;
    
    if (type === 'created') {
        translations.ar = getNotificationTranslation('order', 'created', 'ar', order.customerName, order.items.length);
        translations.en = getNotificationTranslation('order', 'created', 'en', order.customerName, order.items.length);
        translations.fr = getNotificationTranslation('order', 'created', 'fr', order.customerName, order.items.length);
        actionText = getActionTranslation('viewOrder', language);
    } else if (type === 'ready') {
        translations.ar = getNotificationTranslation('order', 'ready', 'ar', order.orderNumber);
        translations.en = getNotificationTranslation('order', 'ready', 'en', order.orderNumber);
        translations.fr = getNotificationTranslation('order', 'ready', 'fr', order.orderNumber);
        actionText = getActionTranslation('deliverOrder', language);
    } else if (type === 'cancelled') {
        translations.ar = getNotificationTranslation('order', 'cancelled', 'ar', order.orderNumber);
        translations.en = getNotificationTranslation('order', 'cancelled', 'en', order.orderNumber);
        translations.fr = getNotificationTranslation('order', 'cancelled', 'fr', order.orderNumber);
        actionText = null;
    } else {
        return null;
    }

    // Use current language for title and message
    const currentTranslation = translations[language];

    const notificationData = {
        title: currentTranslation.title,
        message: currentTranslation.message,
        type: type === 'cancelled' ? 'error' : type === 'ready' ? 'success' : 'order',
        category: 'order',
        priority: type === 'created' ? 'high' : 'medium',
        targetRoles: type === 'created' ? ['kitchen', 'admin'] : type === 'ready' ? ['staff', 'admin'] : ['admin', 'kitchen'],
        targetPermissions: ['cafe'],
        actionRequired: type !== 'cancelled',
        actionUrl: type !== 'cancelled' ? `/cafe?tab=orders` : null,
        actionText,
        metadata: { 
            orderId: order._id, 
            orderNumber: order.orderNumber,
            language,
            translations
        },
        createdBy,
        // Always get organization from order (order always has organization)
        organization: order.organization,
    };

    return new this(notificationData);
};

// Static method to create inventory notification
notificationSchema.statics.createInventoryNotification = function (
    type,
    item,
    createdBy,
    language = 'ar'
) {
    // Get translations for all languages
    const translations = {
        ar: {},
        en: {},
        fr: {}
    };
    
    let actionText;
    
    if (type === 'low_stock') {
        translations.ar = getNotificationTranslation('inventory', 'low_stock', 'ar', item.name, item.currentStock, item.unit);
        translations.en = getNotificationTranslation('inventory', 'low_stock', 'en', item.name, item.currentStock, item.unit);
        translations.fr = getNotificationTranslation('inventory', 'low_stock', 'fr', item.name, item.currentStock, item.unit);
        actionText = getActionTranslation('manageInventory', language);
    } else if (type === 'out_of_stock') {
        translations.ar = getNotificationTranslation('inventory', 'out_of_stock', 'ar', item.name);
        translations.en = getNotificationTranslation('inventory', 'out_of_stock', 'en', item.name);
        translations.fr = getNotificationTranslation('inventory', 'out_of_stock', 'fr', item.name);
        actionText = getActionTranslation('restock', language);
    } else {
        return null;
    }

    // Use current language for title and message
    const currentTranslation = translations[language];

    return new this({
        title: currentTranslation.title,
        message: currentTranslation.message,
        type: type === 'out_of_stock' ? 'error' : 'warning',
        category: 'inventory',
        priority: type === 'out_of_stock' ? 'urgent' : 'high',
        targetRoles: ['admin'],
        targetPermissions: ['inventory'],
        actionRequired: true,
        actionUrl: `/inventory`,
        actionText,
        metadata: { 
            itemId: item._id, 
            itemName: item.name,
            language,
            translations
        },
        createdBy,
        // Always get organization from item (item always has organization)
        organization: item.organization,
    });
};

// Static method to create billing notification
notificationSchema.statics.createBillingNotification = function (
    type,
    bill,
    createdBy,
    language = 'ar',
    currency = 'EGP'
) {
    // Get translations for all languages
    const translations = {
        ar: {},
        en: {},
        fr: {}
    };
    
    let actionText;
    
    if (type === 'created') {
        translations.ar = getNotificationTranslation('billing', 'created', 'ar', bill.billNumber, bill.customerName);
        translations.en = getNotificationTranslation('billing', 'created', 'en', bill.billNumber, bill.customerName);
        translations.fr = getNotificationTranslation('billing', 'created', 'fr', bill.billNumber, bill.customerName);
        actionText = getActionTranslation('viewBill', language);
    } else if (type === 'paid') {
        translations.ar = getNotificationTranslation('billing', 'paid', 'ar', bill.billNumber);
        translations.en = getNotificationTranslation('billing', 'paid', 'en', bill.billNumber);
        translations.fr = getNotificationTranslation('billing', 'paid', 'fr', bill.billNumber);
        actionText = null;
    } else if (type === 'partial_payment') {
        const arSymbol = getCurrencySymbol(currency, 'ar');
        const enSymbol = getCurrencySymbol(currency, 'en');
        const frSymbol = getCurrencySymbol(currency, 'fr');
        translations.ar = getNotificationTranslation('billing', 'partial_payment', 'ar', bill.billNumber, bill.remaining, arSymbol);
        translations.en = getNotificationTranslation('billing', 'partial_payment', 'en', bill.billNumber, bill.remaining, enSymbol);
        translations.fr = getNotificationTranslation('billing', 'partial_payment', 'fr', bill.billNumber, bill.remaining, frSymbol);
        actionText = null;
    } else {
        return null;
    }

    // Use current language for title and message
    const currentTranslation = translations[language];

    return new this({
        title: currentTranslation.title,
        message: currentTranslation.message,
        type: type === 'paid' ? 'success' : type === 'partial_payment' ? 'info' : 'billing',
        category: 'billing',
        priority: type === 'paid' ? 'low' : 'medium',
        targetRoles: ['admin', 'cashier'],
        targetPermissions: ['billing'],
        actionRequired: type === 'created',
        actionUrl: type === 'created' ? `/billing` : null,
        actionText,
        metadata: { 
            billId: bill._id, 
            billNumber: bill.billNumber,
            language,
            currency,
            translations
        },
        createdBy,
        // Always get organization from bill (bill always has organization)
        organization: bill.organization,
    });
};

// Static method to get notifications for user
notificationSchema.statics.getForUser = function (userId, user, options = {}) {
    const query = {
        isActive: true,
        organization: user.organization,
        $or: [
            { targetUsers: userId },
            { targetRoles: "all" },
            { targetRoles: user.role },
            { targetPermissions: { $in: user.permissions } },
        ],
    };

    // Filter out notifications created before the user was created
    // This prevents new users from receiving previous notifications
    if (user.createdAt) {
        query.createdAt = { $gte: user.createdAt };
    }

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
notificationSchema.statics.markAllAsRead = function (userId, organization) {
    const query = {
        "readBy.user": { $ne: userId },
        isActive: true,
    };

    // إضافة فلتر المنظمة إذا تم توفيرها
    if (organization) {
        query.organization = organization;
    } else {
        // إذا لم يتم توفير المنظمة، نبحث عن الإشعارات التي ليس لها منظمة
        query.organization = { $exists: false };
    }

    return this.updateMany(
        query,
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
notificationSchema.statics.cleanExpired = function (organization) {
    return this.deleteMany({
        expiresAt: { $lt: new Date() },
        organization,
    });
};

// Apply sync middleware
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";
applySyncMiddleware(notificationSchema);

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
