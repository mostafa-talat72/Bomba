import Settings from "../models/Settings.js";
import Logger from "../middleware/logger.js";

// Helper function to check permissions
const checkSettingsPermission = (user, category) => {
    // Owner has all permissions
    if (user.role === "owner" || user.permissions.includes("all")) {
        return true;
    }

    // Check specific permissions
    const categoryPermissions = {
        general: ["settings"],
        business: ["settings"],
        notifications: ["settings"],
    };

    const requiredPermissions = categoryPermissions[category] || ["settings"];
    return requiredPermissions.some((permission) =>
        user.permissions.includes(permission)
    );
};

// Helper function to auto-create missing settings
const ensureSettingsExist = async (organization, category, userId = null) => {
    try {
        let settings = await Settings.findOne({
            category,
            organization,
        });

        if (!settings) {
            const defaultSettings = Settings.getDefaultSettings(category);
            settings = new Settings({
                category,
                settings: defaultSettings,
                organization,
                createdBy: userId || organization,
                updatedBy: userId || organization,
                isDefault: true,
            });
            await settings.save();
            Logger.info(`Auto-created settings for category: ${category}`, {
                organization: organization.toString(),
                createdBy: userId || organization.toString(),
            });
        }

        return settings;
    } catch (error) {
        Logger.error("Error ensuring settings exist", {
            error: error.message,
            category,
            organization: organization.toString(),
        });
        throw error;
    }
};

// @desc    Get settings by category
// @route   GET /api/settings/:category
// @access  Private
export const getSettings = async (req, res) => {
    try {
        const { category } = req.params;

        // Check if user has organization
        if (!req.user.organization) {
            return res.status(400).json({
                success: false,
                message: "المستخدم غير مرتبط بأي منشأة",
            });
        }

        // Check permissions
        if (!checkSettingsPermission(req.user, category)) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية للوصول لهذه الإعدادات",
            });
        }

        // Ensure settings exist
        const settings = await ensureSettingsExist(
            req.user.organization,
            category,
            req.user._id
        );

        // Validate settings
        const isValid = settings.validateSettings();

        // Populate updatedBy
        await settings.populate("updatedBy", "name");

        res.json({
            success: true,
            data: {
                ...settings.toObject(),
                isValid,
                validationErrors: settings.validationErrors || [],
            },
        });
    } catch (error) {
        Logger.error("Error getting settings", {
            error: error.message,
            category: req.params.category,
            userId: req.user._id,
            organization: req.user.organization,
        });
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الإعدادات",
            error: error.message,
        });
    }
};

// @desc    Update settings
// @route   PUT /api/settings/:category
// @access  Private
export const updateSettings = async (req, res) => {
    try {
        const { category } = req.params;
        const { settings: newSettings } = req.body;

        // Check if user has organization
        if (!req.user.organization) {
            return res.status(400).json({
                success: false,
                message: "المستخدم غير مرتبط بأي منشأة",
            });
        }

        // Check permissions
        if (!checkSettingsPermission(req.user, category)) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية لتعديل هذه الإعدادات",
            });
        }

        // Get existing settings or create new ones
        let existingSettings = await Settings.findOne({
            category,
            organization: req.user.organization,
        });

        if (!existingSettings) {
            existingSettings = new Settings({
                category,
                settings: Settings.getDefaultSettings(category),
                organization: req.user.organization,
                createdBy: req.user._id,
                updatedBy: req.user._id,
                isDefault: false,
            });
            await existingSettings.save();
        }

        // Merge settings (preserve existing settings not in the update)
        const mergedSettings = {
            ...existingSettings.settings,
            ...newSettings,
        };

        // Update settings
        existingSettings.settings = mergedSettings;
        existingSettings.updatedBy = req.user._id;
        existingSettings.isDefault = false;

        // Validate settings
        const isValid = existingSettings.validateSettings();

        if (!isValid && existingSettings.validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: "الإعدادات تحتوي على أخطاء",
                validationErrors: existingSettings.validationErrors,
            });
        }

        await existingSettings.save();

        // Populate updatedBy
        await existingSettings.populate("updatedBy", "name");

        Logger.info("Settings updated", {
            category,
            userId: req.user._id,
            organization: req.user.organization.toString(),
        });

        res.json({
            success: true,
            message: "تم تحديث الإعدادات بنجاح",
            data: {
                ...existingSettings.toObject(),
                isValid,
                validationErrors: existingSettings.validationErrors || [],
            },
        });
    } catch (error) {
        Logger.error("Error updating settings", {
            error: error.message,
            category: req.params.category,
            userId: req.user._id,
        });
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
        // Check if user has organization
        if (!req.user.organization) {
            return res.status(400).json({
                success: false,
                message: "المستخدم غير مرتبط بأي منشأة",
            });
        }

        // Check permissions
        if (!checkSettingsPermission(req.user, "general")) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية للوصول للإعدادات",
            });
        }

        const settings = await Settings.find({
            organization: req.user.organization,
        })
            .populate("updatedBy", "name")
            .sort({ category: 1 });

        // Get all categories and ensure they exist
        const categories = ["general", "business", "notifications"];

        const allSettings = [];
        for (const category of categories) {
            let categorySettings = settings.find(
                (s) => s.category === category
            );

            if (!categorySettings) {
                // Auto-create missing settings
                categorySettings = await ensureSettingsExist(
                    req.user.organization,
                    category,
                    req.user._id
                );
                await categorySettings.populate("updatedBy", "name");
            }

            // Validate settings
            const isValid = categorySettings.validateSettings();

            allSettings.push({
                ...categorySettings.toObject(),
                isValid,
                validationErrors: categorySettings.validationErrors || [],
            });
        }

        res.json({
            success: true,
            count: allSettings.length,
            data: allSettings,
        });
    } catch (error) {
        Logger.error("Error getting all settings", {
            error: error.message,
            userId: req.user._id,
        });
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الإعدادات",
            error: error.message,
        });
    }
};

// @desc    Reset settings to default
// @route   POST /api/settings/:category/reset
// @access  Private
export const resetSettings = async (req, res) => {
    try {
        const { category } = req.params;

        // Check if user has organization
        if (!req.user.organization) {
            return res.status(400).json({
                success: false,
                message: "المستخدم غير مرتبط بأي منشأة",
            });
        }

        // Check permissions
        if (!checkSettingsPermission(req.user, category)) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية لإعادة تعيين هذه الإعدادات",
            });
        }

        const defaultSettings = Settings.getDefaultSettings(category);

        const updatedSettings = await Settings.findOneAndUpdate(
            { category, organization: req.user.organization },
            {
                settings: defaultSettings,
                updatedBy: req.user._id,
                isDefault: true,
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
            }
        ).populate("updatedBy", "name");

        Logger.info("Settings reset to default", {
            category,
            userId: req.user._id,
            organization: req.user.organization.toString(),
        });

        res.json({
            success: true,
            message: "تم إعادة تعيين الإعدادات بنجاح",
            data: updatedSettings,
        });
    } catch (error) {
        Logger.error("Error resetting settings", {
            error: error.message,
            category: req.params.category,
            userId: req.user._id,
        });
        res.status(500).json({
            success: false,
            message: "خطأ في إعادة تعيين الإعدادات",
            error: error.message,
        });
    }
};

// @desc    Validate settings
// @route   POST /api/settings/:category/validate
// @access  Private
export const validateSettings = async (req, res) => {
    try {
        const { category } = req.params;
        const { settings } = req.body;

        // Check permissions
        if (!checkSettingsPermission(req.user, category)) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية للتحقق من هذه الإعدادات",
            });
        }

        // Create temporary settings object for validation
        const tempSettings = new Settings({
            category,
            settings,
            organization: req.user.organization,
            updatedBy: req.user._id,
        });

        const isValid = tempSettings.validateSettings();

        res.json({
            success: true,
            isValid,
            validationErrors: tempSettings.validationErrors,
        });
    } catch (error) {
        Logger.error("Error validating settings", {
            error: error.message,
            category: req.params.category,
            userId: req.user._id,
        });
        res.status(500).json({
            success: false,
            message: "خطأ في التحقق من الإعدادات",
            error: error.message,
        });
    }
};

// @desc    Export settings
// @route   GET /api/settings/export
// @access  Private
export const exportSettings = async (req, res) => {
    try {
        // Check permissions
        if (!checkSettingsPermission(req.user, "general")) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية لتصدير الإعدادات",
            });
        }

        const settings = await Settings.find({
            organization: req.user.organization,
        }).populate("updatedBy", "name");

        const exportData = {
            exportedAt: new Date().toISOString(),
            organization: req.user.organization.toString(),
            exportedBy: req.user._id.toString(),
            settings: settings.map((s) => ({
                category: s.category,
                settings: s.settings,
                version: s.version,
                isDefault: s.isDefault,
                updatedAt: s.updatedAt,
            })),
        };

        Logger.info("Settings exported", {
            userId: req.user._id,
            organization: req.user.organization.toString(),
            categoriesCount: settings.length,
        });

        res.json({
            success: true,
            data: exportData,
        });
    } catch (error) {
        Logger.error("Error exporting settings", {
            error: error.message,
            userId: req.user._id,
        });
        res.status(500).json({
            success: false,
            message: "خطأ في تصدير الإعدادات",
            error: error.message,
        });
    }
};

// @desc    Import settings
// @route   POST /api/settings/import
// @access  Private
export const importSettings = async (req, res) => {
    try {
        const { settings: importData } = req.body;

        // Check permissions
        if (!checkSettingsPermission(req.user, "general")) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية لاستيراد الإعدادات",
            });
        }

        if (!importData || !Array.isArray(importData.settings)) {
            return res.status(400).json({
                success: false,
                message: "بيانات الاستيراد غير صحيحة",
            });
        }

        const importedSettings = [];
        const errors = [];

        for (const settingData of importData.settings) {
            try {
                const { category, settings: newSettings } = settingData;

                // Validate the imported settings
                const tempSettings = new Settings({
                    category,
                    settings: newSettings,
                    organization: req.user.organization,
                    updatedBy: req.user._id,
                });

                const isValid = tempSettings.validateSettings();

                if (
                    !isValid &&
                    tempSettings.validationErrors.some(
                        (err) => err.severity === "error"
                    )
                ) {
                    errors.push({
                        category,
                        errors: tempSettings.validationErrors,
                    });
                    continue;
                }

                // Update or create settings
                const updatedSettings = await Settings.findOneAndUpdate(
                    { category, organization: req.user.organization },
                    {
                        settings: newSettings,
                        updatedBy: req.user._id,
                        isDefault: false,
                        version:
                            (
                                await Settings.findOne({
                                    category,
                                    organization: req.user.organization,
                                })
                            )?.version + 1 || 1,
                    },
                    {
                        new: true,
                        upsert: true,
                        runValidators: true,
                    }
                );

                importedSettings.push(updatedSettings);
            } catch (error) {
                errors.push({
                    category: settingData.category,
                    error: error.message,
                });
            }
        }

        Logger.info("Settings imported", {
            userId: req.user._id,
            organization: req.user.organization.toString(),
            importedCount: importedSettings.length,
            errorCount: errors.length,
        });

        res.json({
            success: true,
            message: `تم استيراد ${importedSettings.length} فئة إعدادات بنجاح`,
            data: {
                imported: importedSettings.length,
                errors: errors.length,
                details: errors,
            },
        });
    } catch (error) {
        Logger.error("Error importing settings", {
            error: error.message,
            userId: req.user._id,
        });
        res.status(500).json({
            success: false,
            message: "خطأ في استيراد الإعدادات",
            error: error.message,
        });
    }
};

// @desc    Get settings summary
// @route   GET /api/settings/summary
// @access  Private
export const getSettingsSummary = async (req, res) => {
    try {
        // Check permissions
        if (!checkSettingsPermission(req.user, "general")) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية للوصول لملخص الإعدادات",
            });
        }

        const settings = await Settings.find({
            organization: req.user.organization,
        });

        const summary = {
            totalCategories: settings.length,
            defaultSettings: settings.filter((s) => s.isDefault).length,
            customSettings: settings.filter((s) => !s.isDefault).length,
            lastUpdated:
                settings.length > 0
                    ? Math.max(...settings.map((s) => s.updatedAt))
                    : null,
        };

        res.json({
            success: true,
            data: summary,
        });
    } catch (error) {
        Logger.error("Error getting settings summary", {
            error: error.message,
            userId: req.user._id,
        });
        res.status(500).json({
            success: false,
            message: "خطأ في جلب ملخص الإعدادات",
            error: error.message,
        });
    }
};
