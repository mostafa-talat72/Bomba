import Settings from "../models/Settings.js";
import User from "../models/User.js";

// @desc    Get notification settings
// @route   GET /api/settings/notifications
// @access  Private
export const getNotificationSettings = async (req, res) => {
    try {
        const settings = await Settings.findOne({
            category: 'notifications',
            organization: req.user.organization,
        });

        // Default notification settings if not found
        const defaultSettings = {
            sessionNotifications: true,
            orderNotifications: true,
            inventoryNotifications: true,
            billingNotifications: true,
            soundEnabled: true,
            emailNotifications: false,
            showNotificationCount: true,
            autoMarkAsRead: false,
        };

        res.json({
            success: true,
            data: settings ? settings.settings : defaultSettings,
        });
    } catch (error) {
        console.error('Error getting notification settings:', error);
        res.status(500).json({
            success: false,
            message: "خطأ في جلب إعدادات الإشعارات",
            error: error.message,
        });
    }
};

// @desc    Update notification settings
// @route   PUT /api/settings/notifications
// @access  Private
export const updateNotificationSettings = async (req, res) => {
    try {
        const { settings } = req.body;

        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({
                success: false,
                message: "بيانات الإعدادات غير صحيحة",
            });
        }

        const updatedSettings = await Settings.findOneAndUpdate(
            { category: 'notifications', organization: req.user.organization },
            {
                category: 'notifications',
                settings,
                updatedBy: req.user._id,
                organization: req.user.organization,
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
            }
        ).populate("updatedBy", "name");

        console.log('Notification settings updated successfully:', updatedSettings);

        res.json({
            success: true,
            message: "تم تحديث إعدادات الإشعارات بنجاح",
            data: updatedSettings,
        });
    } catch (error) {
        console.error('Error updating notification settings:', error);
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث إعدادات الإشعارات",
            error: error.message,
        });
    }
};

// @desc    Get general settings
// @route   GET /api/settings/general
// @access  Private
export const getGeneralSettings = async (req, res) => {
    try {
        const settings = await Settings.findOne({
            category: 'general',
            organization: req.user.organization,
        });

        // Default general settings if not found
        const defaultSettings = {
            theme: 'light',
            language: 'ar',
            timezone: 'Africa/Cairo',
            currency: 'EGP',
        };

        res.json({
            success: true,
            data: settings ? settings.settings : defaultSettings,
        });
    } catch (error) {
        console.error('Error getting general settings:', error);
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الإعدادات العامة",
            error: error.message,
        });
    }
};

// @desc    Update general settings
// @route   PUT /api/settings/general
// @access  Private
export const updateGeneralSettings = async (req, res) => {
    try {
        const { settings } = req.body;

        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({
                success: false,
                message: "بيانات الإعدادات غير صحيحة",
            });
        }

        const updatedSettings = await Settings.findOneAndUpdate(
            { category: 'general', organization: req.user.organization },
            {
                category: 'general',
                settings,
                updatedBy: req.user._id,
                organization: req.user.organization,
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
            }
        ).populate("updatedBy", "name");

        console.log('General settings updated successfully:', updatedSettings);

        res.json({
            success: true,
            message: "تم تحديث الإعدادات العامة بنجاح",
            data: updatedSettings,
        });
    } catch (error) {
        console.error('Error updating general settings:', error);
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث الإعدادات العامة",
            error: error.message,
        });
    }
};

// @desc    Get settings by category
// @route   GET /api/settings/:category
// @access  Private
export const getSettings = async (req, res) => {
    try {
        const { category } = req.params;

        const settings = await Settings.findOne({
            category,
            organization: req.user.organization,
        }).populate("updatedBy", "name");

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: "الإعدادات غير موجودة",
            });
        }

        res.json({
            success: true,
            data: settings,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الإعدادات",
            error: error.message,
        });
    }
};

// @desc    Update settings
// @route   PUT /api/settings/:category
// @access  Private (Admin only)
export const updateSettings = async (req, res) => {
    try {
        const { category } = req.params;
        const { settings } = req.body;

        const updatedSettings = await Settings.findOneAndUpdate(
            { category, organization: req.user.organization },
            {
                category,
                settings,
                updatedBy: req.user._id,
                organization: req.user.organization,
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
            }
        ).populate("updatedBy", "name");

        res.json({
            success: true,
            message: "تم تحديث الإعدادات بنجاح",
            data: updatedSettings,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث الإعدادات",
            error: error.message,
        });
    }
};

// @desc    Get all settings categories
// @route   GET /api/settings
// @access  Private
export const getAllSettings = async (req, res) => {
    try {
        const settings = await Settings.find({
            organization: req.user.organization,
        })
            .populate("updatedBy", "name")
            .sort({ category: 1 });

        res.json({
            success: true,
            count: settings.length,
            data: settings,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الإعدادات",
            error: error.message,
        });
    }
};

// @desc    Reset settings to default
// @route   POST /api/settings/:category/reset
// @access  Private (Admin only)
export const resetSettings = async (req, res) => {
    try {
        const { category } = req.params;

        // Default settings for different categories
        const defaultSettings = {
            general: {
                cafeName: "Bomba Café",
                currency: "EGP",
                timezone: "Africa/Cairo",
                language: "ar",
                address: "",
                phone: "",
                email: "",
            },
            pricing: {
                playstationBaseRate: 15,
                playstationControllerRate: 5,
                computerHourlyRate: 20,
                taxRate: 0,
                serviceCharge: 0,
            },
            notifications: {
                sessionNotifications: true,
                orderNotifications: true,
                inventoryNotifications: true,
                billNotifications: true,
                soundEnabled: true,
                emailNotifications: false,
            },
            appearance: {
                theme: "light",
                primaryColor: "#2563eb",
                fontSize: "medium",
                showSidebar: true,
                compactMode: false,
            },
            security: {
                sessionTimeout: 60,
                autoLogout: true,
                passwordExpiry: 90,
                maxLoginAttempts: 5,
                requirePasswordChange: false,
            },
            backup: {
                autoBackup: true,
                backupFrequency: "weekly",
                retentionDays: 30,
                backupLocation: "local",
            },
        };

        const settings = defaultSettings[category];

        if (!settings) {
            return res.status(400).json({
                success: false,
                message: "فئة إعدادات غير صحيحة",
            });
        }

        const updatedSettings = await Settings.findOneAndUpdate(
            { category, organization: req.user.organization },
            {
                category,
                settings,
                updatedBy: req.user._id,
                organization: req.user.organization,
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
            }
        ).populate("updatedBy", "name");

        res.json({
            success: true,
            message: "تم إعادة تعيين الإعدادات للقيم الافتراضية",
            data: updatedSettings,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في إعادة تعيين الإعدادات",
            error: error.message,
        });
    }
};

// @desc    Export settings
// @route   GET /api/settings/export
// @access  Private (Admin only)
export const exportSettings = async (req, res) => {
    try {
        const settings = await Settings.find({
            organization: req.user.organization,
        }).select("-updatedBy -createdAt -updatedAt -__v");

        const exportData = {
            exportDate: new Date(),
            version: "1.0",
            settings: settings.reduce((acc, setting) => {
                acc[setting.category] = setting.settings;
                return acc;
            }, {}),
        };

        res.setHeader("Content-Type", "application/json");
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=bomba-settings.json"
        );

        res.json({
            success: true,
            data: exportData,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تصدير الإعدادات",
            error: error.message,
        });
    }
};

// @desc    Import settings
// @route   POST /api/settings/import
// @access  Private (Admin only)
export const importSettings = async (req, res) => {
    try {
        const { settings } = req.body;

        if (!settings || typeof settings !== "object") {
            return res.status(400).json({
                success: false,
                message: "بيانات الإعدادات غير صحيحة",
            });
        }

        const importedSettings = [];

        for (const [category, categorySettings] of Object.entries(settings)) {
            const updatedSetting = await Settings.findOneAndUpdate(
                { category, organization: req.user.organization },
                {
                    category,
                    settings: categorySettings,
                    updatedBy: req.user._id,
                    organization: req.user.organization,
                },
                {
                    new: true,
                    upsert: true,
                    runValidators: true,
                }
            );

            importedSettings.push(updatedSetting);
        }

        res.json({
            success: true,
            message: "تم استيراد الإعدادات بنجاح",
            data: importedSettings,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في استيراد الإعدادات",
            error: error.message,
        });
    }
};
