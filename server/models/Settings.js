import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
    {
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false, // يمكن أن تكون إعدادات عامة للمنظمة أو خاصة بالمستخدم
        },
        category: {
            type: String,
            enum: ["general", "business", "notifications"],
            required: true,
        },
        settings: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        isDefault: {
            type: Boolean,
            default: true,
        },
        isUserSpecific: {
            type: Boolean,
            default: false,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true,
    }
);

// Compound unique index - يمكن أن تكون إعدادات عامة أو خاصة بالمستخدم
settingsSchema.index(
    { organization: 1, category: 1, user: 1 },
    { unique: true }
);

// Default settings for each category
settingsSchema.statics.getDefaultSettings = function (category) {
    const defaults = {
        general: {
            systemName: "نظام إدارة المقهى",
            language: "ar",
            timezone: "Asia/Riyadh",
            currency: "SAR",
        },
        business: {
            businessName: "مقهى",
            businessType: "cafe",
            taxRate: 15,
            serviceCharge: 0,
        },
        notifications: {
            emailNotifications: false,
            smsNotifications: false,
            pushNotifications: true,
        },
    };

    return defaults[category] || {};
};

// Simple validation
settingsSchema.methods.validateSettings = function () {
    const errors = [];

    // Basic validation for each category
    switch (this.category) {
        case "general":
            if (
                !this.settings.systemName ||
                this.settings.systemName.length < 2
            ) {
                errors.push("اسم النظام يجب أن يكون أكثر من حرفين");
            }
            break;
        case "business":
            if (
                !this.settings.businessName ||
                this.settings.businessName.length < 2
            ) {
                errors.push("اسم المنشأة يجب أن يكون أكثر من حرفين");
            }
            if (this.settings.taxRate < 0 || this.settings.taxRate > 100) {
                errors.push("نسبة الضريبة يجب أن تكون بين 0 و 100");
            }
            break;
    }

    this.validationErrors = errors;
    return errors.length === 0;
};

// Ensure settings exist
settingsSchema.statics.ensureSettingsExist = async function (
    organizationId,
    category,
    userId,
    isUserSpecific = false
) {
    const query = {
        organization: organizationId,
        category,
    };

    // إذا كانت إعدادات خاصة بالمستخدم، أضف معرف المستخدم للاستعلام
    if (isUserSpecific) {
        query.user = userId;
    } else {
        query.user = { $exists: false };
    }

    const existingSettings = await this.findOne(query);

    if (!existingSettings) {
        const defaultSettings = this.getDefaultSettings(category);
        const newSettings = new this({
            organization: organizationId,
            user: isUserSpecific ? userId : null,
            category,
            settings: defaultSettings,
            isDefault: true,
            isUserSpecific,
            createdBy: userId,
        });

        await newSettings.save();
        return newSettings;
    }

    return existingSettings;
};

// Get settings summary
settingsSchema.statics.getSettingsSummary = async function (organizationId) {
    const settings = await this.find({ organization: organizationId });

    return {
        totalCategories: settings.length,
        defaultSettings: settings.filter((s) => s.isDefault).length,
        customSettings: settings.filter((s) => !s.isDefault).length,
        lastUpdated:
            settings.length > 0
                ? Math.max(...settings.map((s) => s.updatedAt))
                : null,
    };
};

const Settings = mongoose.model("Settings", settingsSchema);

export default Settings;
