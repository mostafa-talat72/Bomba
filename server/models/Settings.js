import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
    {
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        category: {
            type: String,
            enum: [
                "general",
                "business",
                "inventory",
                "notifications",
                "appearance",
                "security",
                "backup",
                "advanced",
                "reports",
                "users",
            ],
            required: true,
        },
        settings: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
        isDefault: {
            type: Boolean,
            default: false,
        },
        version: {
            type: Number,
            default: 1,
        },
        lastValidated: {
            type: Date,
            default: Date.now,
        },
        validationErrors: [
            {
                field: String,
                message: String,
                severity: {
                    type: String,
                    enum: ["error", "warning", "info"],
                    default: "error",
                },
            },
        ],
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// Compound unique index
settingsSchema.index({ organization: 1, category: 1 }, { unique: true });

// Pre-save hook to clear validation errors
settingsSchema.pre("save", function (next) {
    this.validationErrors = [];
    this.lastValidated = new Date();
    next();
});

// Static method to get default settings for a category
settingsSchema.statics.getDefaultSettings = function (category) {
    const defaults = {
        general: {
            cafeName: "مقهى بومبا",
            currency: "EGP",
            timezone: "Africa/Cairo",
            language: "ar",
            address: "",
            phone: "",
            email: "",
            taxRate: 0,
            taxInclusive: false,
        },
        business: {
            billNumberFormat: "INV-{YYYY}{MM}{DD}-{XXX}",
            autoGenerateBillNumber: true,
            defaultPaymentMethod: "cash",
            allowPartialPayments: false,
            maxDiscountPercentage: 10,
            sessionTimeout: 30,
            tableNumbering: "sequential",
            maxTables: 20,
            workingHours: {
                start: "08:00",
                end: "22:00",
                daysOff: [],
            },
            deliverySettings: {
                enabled: false,
                radius: 10,
                fee: 0,
            },
            loyaltyProgram: {
                enabled: false,
                pointsPerCurrency: 1,
                redemptionRate: 0.01,
            },
        },
        inventory: {
            lowStockThreshold: 10,
            criticalStockThreshold: 5,
            autoReorderEnabled: false,
            reorderThreshold: 5,
            defaultSupplier: "",
            unitConversions: {},
            expiryWarningDays: 7,
            barcodeEnabled: false,
            autoDeductStock: true,
            allowNegativeStock: false,
            stockMovementLogging: true,
            suppliers: [],
        },
        notifications: {
            sessions: {
                sessionEnd: true,
                sessionStart: true,
                sessionPause: false,
            },
            orders: {
                newOrder: true,
                orderReady: true,
                orderCancelled: true,
                orderDelivered: false,
            },
            inventory: {
                lowStock: true,
                outOfStock: true,
                expiryWarning: true,
                reorderReminder: false,
            },
            billing: {
                newBill: true,
                paymentReceived: true,
                partialPayment: true,
                overduePayment: true,
            },
            sound: {
                enabled: true,
                volume: 50,
                defaultTone: "default",
                priorityTones: true,
                customTones: {},
            },
            display: {
                showCount: true,
                autoMarkRead: false,
                displayDuration: 5000,
                position: "top-right",
            },
            email: {
                enabled: false,
                smtpSettings: {
                    host: "",
                    port: 587,
                    username: "",
                    password: "",
                    secure: false,
                },
                templates: {},
            },
        },
        appearance: {
            theme: "light",
            primaryColor: "#3B82F6",
            secondaryColor: "#6B7280",
            fontSize: "medium",
            fontFamily: "Cairo",
            sidebarVisible: true,
            userInfoVisible: true,
            fullscreenMode: false,
            rtlEnabled: true,
            animations: {
                enabled: true,
                duration: 300,
            },
            customCSS: "",
        },
        security: {
            passwordPolicy: {
                minLength: 8,
                requireUppercase: true,
                requireNumbers: true,
                requireSpecialChars: false,
                expiryDays: 90,
                preventReuse: 5,
            },
            session: {
                timeout: 30,
                maxConcurrent: 3,
                forceLogout: false,
                rememberMe: true,
                ipRestriction: false,
                allowedIPs: [],
            },
            audit: {
                enabled: true,
                logLevel: "info",
                retentionDays: 90,
                logActions: [
                    "login",
                    "logout",
                    "settings_change",
                    "data_export",
                ],
            },
            permissions: {
                allowMultiLogin: true,
                requireApproval: false,
                dataEncryption: false,
                twoFactorAuth: false,
                loginAttempts: 5,
                lockoutDuration: 15,
            },
            api: {
                rateLimit: 100,
                apiKeyExpiry: 30,
                corsEnabled: true,
                allowedOrigins: ["http://localhost:3000"],
            },
        },
        backup: {
            autoBackup: {
                enabled: false,
                frequency: "daily",
                keepCount: 7,
                time: "02:00",
                compression: true,
                encryption: false,
            },
            manualBackup: {
                lastBackup: "",
                backupSize: "0 MB",
                backupLocation: "./backups",
            },
            restore: {
                allowRestore: true,
                requireConfirmation: true,
                validateBackup: true,
            },
            cloud: {
                enabled: false,
                provider: "google",
                credentials: {},
                syncFrequency: 24,
            },
        },
        advanced: {
            performance: {
                cacheEnabled: true,
                cacheDuration: 300,
                maxCacheSize: 100,
                autoRefresh: true,
                refreshInterval: 30,
                compression: true,
                minification: true,
            },
            dataRetention: {
                logs: 90,
                backups: 30,
                tempFiles: 7,
                userSessions: 30,
                auditLogs: 365,
            },
            system: {
                debugMode: false,
                maintenanceMode: false,
                autoUpdate: true,
                errorReporting: true,
                analytics: false,
            },
            integrations: {
                paymentGateways: {},
                sms: {
                    enabled: false,
                    provider: "",
                    apiKey: "",
                    senderId: "",
                },
                printer: {
                    enabled: false,
                    type: "thermal",
                    connection: "usb",
                    settings: {},
                },
            },
        },
        reports: {
            defaultPeriod: "daily",
            autoGenerate: false,
            emailReports: false,
            reportFormat: "pdf",
            customReports: [],
            charts: {
                defaultType: "line",
                colors: ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"],
                animations: true,
            },
        },
        users: {
            roles: [
                {
                    id: "owner",
                    name: "صاحب المنشأة",
                    permissions: ["all"],
                    description: "صلاحيات كاملة على النظام",
                },
                {
                    id: "admin",
                    name: "مدير",
                    permissions: [
                        "dashboard",
                        "playstation",
                        "computer",
                        "cafe",
                        "menu",
                        "billing",
                        "reports",
                        "inventory",
                        "costs",
                        "users",
                        "settings",
                    ],
                    description: "إدارة كاملة للنظام",
                },
                {
                    id: "manager",
                    name: "مشرف",
                    permissions: [
                        "dashboard",
                        "playstation",
                        "computer",
                        "cafe",
                        "menu",
                        "billing",
                        "reports",
                        "inventory",
                    ],
                    description: "إدارة العمليات اليومية",
                },
                {
                    id: "cashier",
                    name: "كاشير",
                    permissions: [
                        "dashboard",
                        "playstation",
                        "computer",
                        "cafe",
                        "billing",
                    ],
                    description: "إدارة المبيعات والمدفوعات",
                },
                {
                    id: "kitchen",
                    name: "مطبخ",
                    permissions: ["dashboard", "cafe", "menu"],
                    description: "إدارة الطلبات والمطبخ",
                },
                {
                    id: "staff",
                    name: "موظف",
                    permissions: ["dashboard", "playstation", "computer"],
                    description: "إدارة الجلسات والأجهزة",
                },
            ],
            defaultPermissions: {
                owner: ["all"],
                admin: [
                    "dashboard",
                    "playstation",
                    "computer",
                    "cafe",
                    "menu",
                    "billing",
                    "reports",
                    "inventory",
                    "costs",
                    "users",
                    "settings",
                ],
                manager: [
                    "dashboard",
                    "playstation",
                    "computer",
                    "cafe",
                    "menu",
                    "billing",
                    "reports",
                    "inventory",
                ],
                cashier: [
                    "dashboard",
                    "playstation",
                    "computer",
                    "cafe",
                    "billing",
                ],
                kitchen: ["dashboard", "cafe", "menu"],
                staff: ["dashboard", "playstation", "computer"],
            },
            userManagement: {
                allowRegistration: false,
                requireEmailVerification: true,
                requirePhoneVerification: false,
                maxUsers: 50,
                inactiveUserTimeout: 90,
            },
            profile: {
                allowAvatar: true,
                allowCustomFields: true,
                requiredFields: ["name", "email", "role"],
            },
        },
    };

    return defaults[category] || {};
};

// Instance method to validate settings
settingsSchema.methods.validateSettings = function () {
    const errors = [];
    const category = this.category;
    const settings = this.settings;

    // Category-specific validation
    switch (category) {
        case "general":
            if (!settings.cafeName || settings.cafeName.trim().length < 2) {
                errors.push({
                    field: "cafeName",
                    message: "اسم المقهى مطلوب ويجب أن يكون أكثر من حرفين",
                    severity: "error",
                });
            }
            if (settings.taxRate < 0 || settings.taxRate > 100) {
                errors.push({
                    field: "taxRate",
                    message: "نسبة الضريبة يجب أن تكون بين 0 و 100",
                    severity: "error",
                });
            }
            if (
                settings.email &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)
            ) {
                errors.push({
                    field: "email",
                    message: "البريد الإلكتروني غير صحيح",
                    severity: "error",
                });
            }
            break;

        case "business":
            if (
                settings.maxDiscountPercentage < 0 ||
                settings.maxDiscountPercentage > 100
            ) {
                errors.push({
                    field: "maxDiscountPercentage",
                    message: "نسبة الخصم يجب أن تكون بين 0 و 100",
                    severity: "error",
                });
            }
            if (settings.sessionTimeout < 1 || settings.sessionTimeout > 1440) {
                errors.push({
                    field: "sessionTimeout",
                    message: "مهلة الجلسة يجب أن تكون بين 1 و 1440 دقيقة",
                    severity: "error",
                });
            }
            break;

        case "inventory":
            if (settings.lowStockThreshold < 0) {
                errors.push({
                    field: "lowStockThreshold",
                    message: "حد المخزون المنخفض يجب أن يكون أكبر من 0",
                    severity: "error",
                });
            }
            if (settings.criticalStockThreshold < 0) {
                errors.push({
                    field: "criticalStockThreshold",
                    message: "حد المخزون الحرج يجب أن يكون أكبر من 0",
                    severity: "error",
                });
            }
            break;

        case "security":
            if (settings.passwordPolicy.minLength < 6) {
                errors.push({
                    field: "passwordPolicy.minLength",
                    message:
                        "الحد الأدنى لطول كلمة المرور يجب أن يكون 6 أحرف على الأقل",
                    severity: "error",
                });
            }
            if (settings.session.timeout < 1) {
                errors.push({
                    field: "session.timeout",
                    message: "مهلة الجلسة يجب أن تكون أكبر من 0",
                    severity: "error",
                });
            }
            break;

        case "notifications":
            if (settings.sound.volume < 0 || settings.sound.volume > 100) {
                errors.push({
                    field: "sound.volume",
                    message: "مستوى الصوت يجب أن يكون بين 0 و 100",
                    severity: "error",
                });
            }
            break;
    }

    this.validationErrors = errors;
    this.lastValidated = new Date();
    return errors;
};

// Static method to ensure settings exist for an organization
settingsSchema.statics.ensureSettingsExist = async function (
    organizationId,
    category
) {
    const existingSettings = await this.findOne({
        organization: organizationId,
        category,
    });

    if (!existingSettings) {
        const defaultSettings = this.getDefaultSettings(category);
        const newSettings = new this({
            organization: organizationId,
            category,
            settings: defaultSettings,
            isDefault: true,
            createdBy: organizationId, // Using organization as creator for default settings
        });

        await newSettings.save();
        return newSettings;
    }

    return existingSettings;
};

// Static method to get settings summary
settingsSchema.statics.getSettingsSummary = async function (organizationId) {
    const settings = await this.find({ organization: organizationId });
    const categories = [
        "general",
        "business",
        "inventory",
        "notifications",
        "appearance",
        "security",
        "backup",
        "advanced",
        "reports",
        "users",
    ];

    const summary = {
        totalCategories: categories.length,
        completedSettings: 0,
        incompleteSettings: [],
        customSettings: 0,
        categoriesWithErrors: [],
        totalSettings: settings.length,
        lastUpdated: new Date().toISOString(),
        version: "1.0.0",
    };

    for (const category of categories) {
        const categorySettings = settings.find((s) => s.category === category);
        if (categorySettings) {
            summary.completedSettings++;
            if (!categorySettings.isDefault) {
                summary.customSettings++;
            }
            if (
                categorySettings.validationErrors &&
                categorySettings.validationErrors.length > 0
            ) {
                summary.categoriesWithErrors.push(category);
            }
        } else {
            summary.incompleteSettings.push(category);
        }
    }

    return summary;
};

const Settings = mongoose.model("Settings", settingsSchema);

export default Settings;
