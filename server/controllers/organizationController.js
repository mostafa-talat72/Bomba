import Organization from "../models/Organization.js";
import User from "../models/User.js";
import Logger from "../middleware/logger.js";
import organizationWebsiteService from "../services/organizationWebsiteService.js";
import { getUserLocale } from "../utils/localeHelper.js";
import { getOrganizationId } from "../utils/organization.js";
import { findReportEligibleOrders } from "../utils/reportOrderFilter.js";

// مقارنة هويات آمنة عبر كل الأنواع: ObjectId / نص / كائن مدمج (populated) —
// تتجنب crash الـ .toString() على القيم الفارغة ورفض المالك المدمج.
const sameId = (a, b) => {
    if (a === undefined || a === null || b === undefined || b === null) return false;
    const na = (a && typeof a === 'object' && a._id !== undefined) ? a._id : a;
    const nb = (b && typeof b === 'object' && b._id !== undefined) ? b._id : b;
    if (na === undefined || na === null || nb === undefined || nb === null) return false;
    return String(na) === String(nb);
};
const isOrgOwner = (organization, user) => {
    const ownerId = organization?.owner?._id || organization?.owner;
    return (!!ownerId && sameId(ownerId, user?._id)) || user?.role === 'owner';
};
const includesUser = (list, user) => Array.isArray(list) && list.some(m => sameId(m?._id || m, user?._id));

// @desc    Get organization details by ID
// @route   GET /api/organization/:id
// @access  Private
export const getOrganizationById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const organization = await Organization.findById(id)
            .populate("owner", "name email")
            .populate('permissions.authorizedManagers', 'name email');

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: "المنشأة غير موجودة",
            });
        }

        res.json({
            success: true,
            data: organization,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب بيانات المنشأة",
            error: error.message,
        });
    }
};

// @desc    Get organization details
// @route   GET /api/organization
// @access  Private
export const getOrganization = async (req, res) => {
    try {
       

        // Extract organization ID if it's an object
        const organizationId = getOrganizationId(req.user);

        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: "المستخدم غير مرتبط بأي منشأة",
            });
        }


        const organization = await Organization.findById(organizationId)
            .populate("owner", "name email")
            .populate('permissions.authorizedManagers', 'name email');


        if (!organization) {
            return res.status(404).json({
                success: false,
                message: "المنشأة غير موجودة",
            });
        }

    
        res.json({
            success: true,
            data: organization,
        });
    } catch (error) {
        console.error('Error in getOrganization:', error);
        res.status(500).json({
            success: false,
            message: "خطأ في جلب بيانات المنشأة",
            error: error.message,
        });
    }
};

// @desc    Update organization details
// @route   PUT /api/organization
// @access  Private (Owner or Authorized Admin)
export const updateOrganization = async (req, res) => {
    try {
        // Extract organization ID if it's an object
        const organizationId = req.user.organization?._id || req.user.organization;
        
        const organization = await Organization.findById(organizationId)
            .populate('permissions.authorizedManagers', 'name email');

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: "المنشأة غير موجودة",
            });
        }

        // التحقق من الصلاحيات (آمن ضد owner/permissions الفارغة + دور owner)
        const ownerId = organization.owner?._id || organization.owner;
        const isOwner = (ownerId && ownerId.toString() === req.user._id.toString()) ||
            req.user.role === 'owner';
        const perms = organization.permissions || {};
        const isAuthorizedAdmin = req.user.role === 'admin' &&
            perms.allowManagersToEditOrganization &&
            (perms.authorizedManagers || []).some(
                manager => String(manager?._id || manager) === String(req.user._id)
            );

        if (!isOwner && !isAuthorizedAdmin) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية لتعديل بيانات المنشأة",
            });
        }

        const {
            name,
            description,
            address,
            phone,
            email,
            website,
            socialLinks,
            workingHours,
            logo,
            currency,
            timezone,
            printSettings
        } = req.body;

        // تحديث البيانات
        if (name) organization.name = name;
        if (description !== undefined) organization.description = description;
        if (address !== undefined) organization.address = address;
        if (phone !== undefined) organization.phone = phone;
        if (email !== undefined) organization.email = email;
        if (website !== undefined) organization.website = website;
        if (logo !== undefined) organization.logo = logo;
        if (currency !== undefined) organization.currency = currency;
        if (timezone !== undefined) organization.timezone = timezone;
        
        if (socialLinks) {
            organization.socialLinks = {
                ...organization.socialLinks,
                ...socialLinks
            };
        }
        
        if (workingHours) {
            organization.workingHours = {
                ...organization.workingHours,
                ...workingHours
            };
        }

        if (printSettings) {
            organization.printSettings = {
                ...organization.printSettings,
                ...printSettings
            };
        }

        await organization.save();

        // Generate website after saving organization data
        try {
            const websiteUrl = await organizationWebsiteService.generateWebsite(organization);
            organization.websiteUrl = websiteUrl;
            await organization.save();
        } catch (websiteError) {
            console.error('Error generating website:', websiteError);
            // Don't fail the entire operation if website generation fails
        }

        const updatedOrganization = await Organization.findById(organization._id)
            .populate("owner", "name email")
            .populate('permissions.authorizedManagers', 'name email');

        res.json({
            success: true,
            message: "تم تحديث بيانات المنشأة بنجاح",
            data: updatedOrganization,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث بيانات المنشأة",
            error: error.message,
        });
    }
};

// @desc    Update organization permissions
// @route   PUT /api/organization/permissions
// @access  Private (Owner only)
export const updateOrganizationPermissions = async (req, res) => {
    try {
        // Extract organization ID if it's an object
        const organizationId = req.user.organization?._id || req.user.organization;
        
        const organization = await Organization.findById(organizationId)
            .populate('permissions.authorizedManagers', 'name email');

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: "المنشأة غير موجودة",
            });
        }

        // التحقق من أن المستخدم هو المالك
        const isOwner = isOrgOwner(organization, req.user);

        if (!isOwner) {
            return res.status(403).json({
                success: false,
                message: "فقط مالك المنشأة يمكنه تعديل الصلاحيات",
            });
        }

        const { allowManagersToEditOrganization, authorizedManagers } = req.body;

        if (allowManagersToEditOrganization !== undefined) {
            organization.permissions.allowManagersToEditOrganization = allowManagersToEditOrganization;
        }

        if (authorizedManagers !== undefined) {
            organization.permissions.authorizedManagers = authorizedManagers;
        }

        await organization.save();

        const updatedOrganization = await Organization.findById(organization._id)
            .populate('permissions.authorizedManagers', 'name email');

        res.json({
            success: true,
            message: "تم تحديث صلاحيات المنشأة بنجاح",
            data: updatedOrganization,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث صلاحيات المنشأة",
            error: error.message,
        });
    }
};

// @desc    Check if user can edit organization
// @route   GET /api/organization/can-edit
// @access  Private
export const canEditOrganization = async (req, res) => {
    try {

        // Extract organization ID if it's an object
        const organizationId = req.user.organization?._id || req.user.organization;

        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: "المستخدم غير مرتبط بأي منشأة",
            });
        }


        const organization = await Organization.findById(organizationId)
            .populate('permissions.authorizedManagers', 'name email');


        if (!organization) {
            return res.status(404).json({
                success: false,
                message: "المنشأة غير موجودة",
            });
        }

        const ownerId = organization.owner?._id || organization.owner;
        const isOwner = (ownerId && ownerId.toString() === req.user._id.toString()) ||
            req.user.role === 'owner';
        const perms = organization.permissions || {};
        const isAuthorizedAdmin = req.user.role === 'admin' &&
            perms.allowManagersToEditOrganization &&
            (perms.authorizedManagers || []).some(
                manager => String(manager?._id || manager) === String(req.user._id)
            );

        const canEdit = isOwner || isAuthorizedAdmin;
        res.json({
            success: true,
            data: {
                canEdit,
                isOwner,
                isAuthorizedAdmin,
                allowManagersToEditOrganization: perms.allowManagersToEditOrganization,
                authorizedManagers: perms.authorizedManagers || []
            },
        });
    } catch (error) {
        console.error('Error in canEditOrganization:', error);
        res.status(500).json({
            success: false,
            message: "خطأ في التحقق من الصلاحيات",
            error: error.message,
        });
    }
};

// @desc    Get available managers for authorization
// @route   GET /api/organization/available-managers
// @access  Private (Owner only)
export const getAvailableManagers = async (req, res) => {
    try {
        // Extract organization ID if it's an object
        const organizationId = req.user.organization?._id || req.user.organization;
        
        const organization = await Organization.findById(organizationId);

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: "المنشأة غير موجودة",
            });
        }

        // التحقق من أن المستخدم هو المالك
        const isOwner = isOrgOwner(organization, req.user);

        if (!isOwner) {
            return res.status(403).json({
                success: false,
                message: "فقط مالك المنشأة يمكنه رؤية قائمة المديرين",
            });
        }

        // جلب جميع المديرين في المنشأة (ما عدا المالك)
        const managers = await User.find({
            organization: organizationId,
            role: 'admin',
            _id: { $ne: req.user._id }
        }).select('name email _id');

        res.json({
            success: true,
            data: managers,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب قائمة المديرين",
            error: error.message,
        });
    }
};


// @desc    Get report settings
// @route   GET /api/organization/report-settings
// @access  Private
export const getReportSettings = async (req, res) => {
    try {
        const organizationId = req.user.organization?._id || req.user.organization;

        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: "المستخدم غير مرتبط بأي منشأة",
            });
        }

        const organization = await Organization.findById(organizationId)
            .populate('reportSettings.authorizedToManageReports', 'name email role');

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: "المنشأة غير موجودة",
            });
        }

        res.json({
            success: true,
            data: {
                dailyReportEnabled: organization.reportSettings?.dailyReportEnabled ?? true,
                dailyReportStartTime: organization.reportSettings?.dailyReportStartTime || "08:00",
                dailyReportSendTime: organization.reportSettings?.dailyReportSendTime || "09:00",
                dailyReportEmails: organization.reportSettings?.dailyReportEmails || [],
                authorizedToManageReports: organization.reportSettings?.authorizedToManageReports || []
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب إعدادات التقارير",
            error: error.message,
        });
    }
};

// @desc    Update report settings
// @route   PUT /api/organization/report-settings
// @access  Private (Owner or Authorized Managers)
export const updateReportSettings = async (req, res) => {
    try {
        const organizationId = req.user.organization?._id || req.user.organization;

        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: "المستخدم غير مرتبط بأي منشأة",
            });
        }

        const organization = await Organization.findById(organizationId);

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: "المنشأة غير موجودة",
            });
        }

        // Check if user is owner or authorized to manage reports
        const isOwner = isOrgOwner(organization, req.user);
        const isAuthorized = includesUser(organization.reportSettings?.authorizedToManageReports, req.user);

        if (!isOwner && !isAuthorized) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية لتعديل إعدادات التقارير",
            });
        }

        const { 
            dailyReportEnabled, 
            dailyReportStartTime,
            dailyReportSendTime,
            dailyReportEmails,
            authorizedToManageReports 
        } = req.body;

        // Validate time format (HH:MM)
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        
        if (dailyReportStartTime && !timeRegex.test(dailyReportStartTime)) {
            return res.status(400).json({
                success: false,
                message: "صيغة وقت بداية التقرير غير صحيحة. يجب أن تكون بصيغة HH:MM (مثال: 08:00)",
            });
        }

        if (dailyReportSendTime && !timeRegex.test(dailyReportSendTime)) {
            return res.status(400).json({
                success: false,
                message: "صيغة وقت إرسال التقرير غير صحيحة. يجب أن تكون بصيغة HH:MM (مثال: 09:00)",
            });
        }

        // Validate email format (support both old and new format)
        if (dailyReportEmails && Array.isArray(dailyReportEmails)) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const invalidEmails = [];
            
            dailyReportEmails.forEach((item, index) => {
                let email;
                if (typeof item === 'string') {
                    // Old format: just email string
                    email = item;
                } else if (item && typeof item === 'object' && item.email) {
                    // New format: object with email and language
                    email = item.email;
                    // Validate language if provided
                    if (item.language && !['ar', 'en', 'fr'].includes(item.language)) {
                        invalidEmails.push({ index, email, reason: 'Invalid language. Must be ar, en, or fr' });
                    }
                    // Sanitize per-recipient report scope (mini-reports)
                    if (item.sectionIds !== undefined) {
                        if (!Array.isArray(item.sectionIds)) {
                            invalidEmails.push({ index, email, reason: 'sectionIds must be an array' });
                        } else {
                            item.sectionIds = item.sectionIds
                                .map(String)
                                .filter((id) => /^[0-9a-fA-F]{24}$/.test(id) || id === 'other')
                                .slice(0, 100);
                        }
                    }
                    for (const flag of ['includeEmployees', 'includeCosts', 'includePlaystation', 'includeComputer']) {
                        if (item[flag] !== undefined && typeof item[flag] !== 'boolean') {
                            invalidEmails.push({ index, email, reason: `${flag} must be boolean` });
                        }
                    }
                } else {
                    invalidEmails.push({ index, item, reason: 'Invalid format' });
                    return;
                }
                
                if (!emailRegex.test(email)) {
                    invalidEmails.push({ index, email, reason: 'Invalid email format' });
                }
            });
            
            if (invalidEmails.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "بعض الإيميلات غير صحيحة",
                    invalidEmails
                });
            }
        }

        // Only owner can update authorized managers
        if (authorizedToManageReports !== undefined && !isOwner) {
            return res.status(403).json({
                success: false,
                message: "فقط صاحب المنشأة يمكنه تعديل المستخدمين المصرح لهم",
            });
        }

        // Update report settings
        if (!organization.reportSettings) {
            organization.reportSettings = {};
        }

        if (dailyReportEnabled !== undefined) {
            organization.reportSettings.dailyReportEnabled = dailyReportEnabled;
        }

        if (dailyReportStartTime !== undefined) {
            organization.reportSettings.dailyReportStartTime = dailyReportStartTime;
        }

        if (dailyReportSendTime !== undefined) {
            organization.reportSettings.dailyReportSendTime = dailyReportSendTime;
        }

        if (dailyReportEmails !== undefined) {
            organization.reportSettings.dailyReportEmails = dailyReportEmails;
        }

        if (authorizedToManageReports !== undefined && isOwner) {
            // Verify all users exist and are managers
            const managers = await User.find({
                _id: { $in: authorizedToManageReports },
                organization: organizationId,
                role: 'admin'
            });

            if (managers.length !== authorizedToManageReports.length) {
                return res.status(400).json({
                    success: false,
                    message: "بعض المستخدمين غير موجودين أو ليسوا مديرين",
                });
            }

            organization.reportSettings.authorizedToManageReports = authorizedToManageReports;
        }

        await organization.save();

        // Reschedule the report with new settings
        try {
            const { rescheduleOrganizationReport } = await import('../utils/scheduler.js');
            await rescheduleOrganizationReport(organization._id);
        } catch (scheduleError) {
            Logger.error('Failed to reschedule organization report', {
                organizationId: organization._id,
                error: scheduleError.message
            });
            // Don't fail the entire operation if rescheduling fails
        }

        // Populate for response
        await organization.populate('reportSettings.authorizedToManageReports', 'name email role');

        res.json({
            success: true,
            message: "تم تحديث إعدادات التقارير بنجاح",
            data: {
                dailyReportEnabled: organization.reportSettings.dailyReportEnabled,
                dailyReportStartTime: organization.reportSettings.dailyReportStartTime,
                dailyReportSendTime: organization.reportSettings.dailyReportSendTime,
                dailyReportEmails: organization.reportSettings.dailyReportEmails,
                authorizedToManageReports: organization.reportSettings.authorizedToManageReports
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث إعدادات التقارير",
            error: error.message,
        });
    }
};

// @desc    Check if user can manage reports
// @route   GET /api/organization/can-manage-reports
// @access  Private
export const canManageReports = async (req, res) => {
    try {
        const organizationId = req.user.organization?._id || req.user.organization;

        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: "المستخدم غير مرتبط بأي منشأة",
            });
        }

        const organization = await Organization.findById(organizationId);

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: "المنشأة غير موجودة",
            });
        }

        const isOwner = isOrgOwner(organization, req.user);
        const isAuthorized = includesUser(organization.reportSettings?.authorizedToManageReports, req.user);

        res.json({
            success: true,
            canManage: isOwner || isAuthorized,
            isOwner: isOwner
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في التحقق من الصلاحيات",
            error: error.message,
        });
    }
};

// @desc    Check if user can manage payroll settings
// @route   GET /api/organization/can-manage-payroll
// @access  Private
export const canManagePayroll = async (req, res) => {
    try {
        const organizationId = req.user.organization?._id || req.user.organization;

        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: "المستخدم غير مرتبط بأي منشأة",
            });
        }

        const organization = await Organization.findById(organizationId);

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: "المنشأة غير موجودة",
            });
        }

        const isOwner = isOrgOwner(organization, req.user);
        const isAuthorized = includesUser(organization.permissions?.authorizedPayrollManagers, req.user);

        res.json({
            success: true,
            canManage: isOwner || isAuthorized,
            isOwner: isOwner
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في التحقق من الصلاحيات",
            error: error.message,
        });
    }
};

// @desc    Update payroll permissions
// @route   PUT /api/organization/payroll-permissions
// @access  Private (Owner only)
export const updatePayrollPermissions = async (req, res) => {
    try {
        const organizationId = req.user.organization?._id || req.user.organization;

        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: "المستخدم غير مرتبط بأي منشأة",
            });
        }

        const organization = await Organization.findById(organizationId);

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: "المنشأة غير موجودة",
            });
        }

        // التحقق من أن المستخدم هو المالك
        const isOwner = isOrgOwner(organization, req.user);

        if (!isOwner) {
            return res.status(403).json({
                success: false,
                message: "فقط مالك المنشأة يمكنه تعديل صلاحيات المرتبات",
            });
        }

        const { allowManagersToManagePayroll, authorizedPayrollManagers } = req.body;

        if (!organization.permissions) {
            organization.permissions = {};
        }

        if (allowManagersToManagePayroll !== undefined) {
            organization.permissions.allowManagersToManagePayroll = allowManagersToManagePayroll;
        }

        if (authorizedPayrollManagers !== undefined) {
            // Verify all users exist and are managers
            const managers = await User.find({
                _id: { $in: authorizedPayrollManagers },
                organization: organizationId,
                role: 'admin'
            });

            if (managers.length !== authorizedPayrollManagers.length) {
                return res.status(400).json({
                    success: false,
                    message: "بعض المستخدمين غير موجودين أو ليسوا مديرين",
                });
            }

            organization.permissions.authorizedPayrollManagers = authorizedPayrollManagers;
        }

        await organization.save();

        const updatedOrganization = await Organization.findById(organization._id)
            .populate('permissions.authorizedPayrollManagers', 'name email role');

        res.json({
            success: true,
            message: "تم تحديث صلاحيات المرتبات بنجاح",
            data: {
                allowManagersToManagePayroll: updatedOrganization.permissions.allowManagersToManagePayroll,
                authorizedPayrollManagers: updatedOrganization.permissions.authorizedPayrollManagers
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث صلاحيات المرتبات",
            error: error.message,
        });
    }
};


// @desc    Send daily report manually (now)
// دالة مشتركة لتوليد وإرسال التقرير - تُستخدم من الإرسال اليدوي والتلقائي
export const generateAndSendDailyReport = async (organizationId, userLocale = 'ar-EG') => {
    const organization = await Organization.findById(organizationId);

    if (!organization) {
        throw new Error('المنشأة غير موجودة');
    }

    // Check if report is enabled
    if (organization.reportSettings?.dailyReportEnabled === false) {
        Logger.info(`⏭️ Daily report is disabled for organization: ${organization.name}`);
        return {
            success: false,
            skipped: true,
            reason: 'التقرير اليومي غير مفعل',
            emailsSent: 0
        };
    }

    // Check if there are emails configured
    const reportEmails = organization.reportSettings?.dailyReportEmails || [];
    if (reportEmails.length === 0) {
        return {
            success: false,
            skipped: true,
            reason: 'لم يتم تحديد أي إيميلات لإرسال التقرير',
            emailsSent: 0
        };
    }

    // استدعاء نفس الكود الموجود في sendReportNow
    // سأنسخ الكود كاملاً هنا
    const { default: Session } = await import('../models/Session.js');
    const { default: Cost } = await import('../models/Cost.js');
    const { default: MenuItem } = await import('../models/MenuItem.js');
    const { sendDailyReport, sendMonthlyReport } = await import('../utils/email.js');
    const { generateDailyReportPDF } = await import('../utils/pdfGenerator.js');

    const startTimeStr = organization.reportSettings?.dailyReportStartTime || "08:00";
    const [startHour, startMinute] = startTimeStr.split(':').map(Number);

    const now = new Date();
    const endOfReport = new Date(now);
    endOfReport.setHours(startHour, startMinute || 0, 0, 0);
    
    if (now < endOfReport) {
        endOfReport.setDate(endOfReport.getDate() - 1);
    }
    
    const startOfReport = new Date(endOfReport);
    startOfReport.setDate(startOfReport.getDate() - 1);

    Logger.info('📊 ===== GENERATE AND SEND REPORT =====');
    Logger.info('Organization:', organization.name);
    Logger.info('Report Period:', {
        start: startOfReport.toLocaleString(userLocale),
        end: endOfReport.toLocaleString(userLocale)
    });

    // نفس منطق جلب البيانات من sendReportNow
    const orders = await findReportEligibleOrders(organizationId, {
        createdAt: { $gte: startOfReport, $lte: endOfReport },
    });

    const sessions = await Session.find({
        endTime: { $gte: startOfReport, $lte: endOfReport },
        status: "completed",
        organization: organizationId,
    }).lean();

    const costs = await Cost.find({
        date: { $gte: startOfReport, $lte: endOfReport },
        organization: organizationId,
    }).lean();

    // نفس حسابات الإيرادات
    const cafeRevenue = orders.reduce((sum, order) => sum + (Number(order.finalAmount) || 0), 0);
    
    const playstationSessions = sessions.filter(s => s.deviceType === "playstation");
    const computerSessions = sessions.filter(s => s.deviceType === "computer");
    
    const playstationRevenue = playstationSessions.reduce((sum, s) => sum + (Number(s.finalCost) || 0), 0);
    const computerRevenue = computerSessions.reduce((sum, s) => sum + (Number(s.finalCost) || 0), 0);
    
    const totalRevenue = cafeRevenue + playstationRevenue + computerRevenue;
    const totalCosts = costs.reduce((sum, cost) => sum + (Number(cost.paidAmount) || Number(cost.amount) || 0), 0);
    const netProfit = totalRevenue - totalCosts;

    // نفس منطق المنتجات والأقسام من sendReportNow - variant-aware (size separate)
    const productSales = {};
    orders.forEach((order) => {
        if (!order.items || !Array.isArray(order.items)) return;
        
        order.items.forEach((item) => {
            if (!item.name) return;
            
            const variant = item.variant || '';
            const key = `${item.name}|${variant}`;
            const variantText = variant && variant !== 'عادي' ? ` (${variant})` : '';
            const displayName = `${item.name}${variantText}`;
            if (!productSales[key]) {
                productSales[key] = { name: displayName, variant, quantity: 0, revenue: 0 };
            }
            
            const itemQuantity = Number(item.quantity) || 0;
            const itemPrice = Number(item.price) || 0;
            const itemTotal = Number(item.itemTotal) || (itemPrice * itemQuantity);
            
            productSales[key].quantity += itemQuantity;
            productSales[key].revenue += itemTotal;
        });
    });

    const topProducts = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

    const menuItems = await MenuItem.find({ organization: organizationId }).populate({
        path: 'category',
        populate: {
            path: 'section'
        }
    }).lean();

    const menuItemMap = {};
    menuItems.forEach(item => {
        menuItemMap[item.name] = item;
    });

    const sectionData = {};
    orders.forEach(order => {
        if (!order.items || !Array.isArray(order.items)) return;

        order.items.forEach(item => {
            if (!item.name) return;

            const variant = item.variant || '';
            const variantText = variant && variant !== 'عادي' ? ` (${variant})` : '';
            const displayName = `${item.name}${variantText}`;
            const productKey = `${item.name}|${variant}`;

            const menuItem = menuItemMap[item.name];
            let sectionId = 'other';
            let sectionName = 'أخرى';

            if (menuItem && menuItem.category && menuItem.category.section) {
                const section = menuItem.category.section;
                sectionId = section._id ? section._id.toString() : 'other';
                sectionName = section.name || 'أخرى';
            }

            if (!sectionData[sectionId]) {
                sectionData[sectionId] = {
                    sectionId,
                    sectionName,
                    products: {},
                    totalRevenue: 0,
                    totalQuantity: 0
                };
            }

            const itemPrice = Number(item.price) || 0;
            const itemQuantity = Number(item.quantity) || 0;
            const itemTotal = Number(item.itemTotal) || (itemPrice * itemQuantity);

            if (!sectionData[sectionId].products[productKey]) {
                sectionData[sectionId].products[productKey] = {
                    name: displayName,
                    variant,
                    quantity: 0,
                    revenue: 0
                };
            }

            sectionData[sectionId].products[productKey].quantity += itemQuantity;
            sectionData[sectionId].products[productKey].revenue += itemTotal;
            sectionData[sectionId].totalRevenue += itemTotal;
            sectionData[sectionId].totalQuantity += itemQuantity;
        });
    });

    const topProductsBySection = Object.values(sectionData).map(section => ({
        sectionId: section.sectionId,
        sectionName: section.sectionName,
        totalRevenue: section.totalRevenue,
        totalQuantity: section.totalQuantity,
        products: Object.values(section.products)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10)
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);

    const reportData = {
        date: startOfReport.toLocaleDateString(userLocale),
        organizationName: organization.name,
        totalRevenue: totalRevenue || 0,
        totalCosts: totalCosts || 0,
        netProfit: netProfit || 0,
        profitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0,
        totalBills: orders.length + sessions.length,
        totalOrders: orders.length || 0,
        totalSessions: sessions.length || 0,
        topProducts: topProducts,
        topProductsBySection: topProductsBySection,
        revenueByType: {
            playstation: playstationRevenue || 0,
            computer: computerRevenue || 0,
            cafe: cafeRevenue || 0
        },
        soldItemsBySection: Object.values(sectionData).map(section => ({
            sectionName: section.sectionName,
            items: Object.values(section.products).map(product => ({
                name: product.name,
                variant: product.variant,
                quantity: product.quantity,
                totalRevenue: product.revenue
            }))
        })),
        allSoldItems: Object.values(productSales).map((data) => ({
            name: data.name,
            variant: data.variant,
            quantity: data.quantity,
            totalRevenue: data.revenue
        })).sort((a, b) => b.totalRevenue - a.totalRevenue),
        startOfReport: startOfReport,
        endOfReport: endOfReport,
        reportPeriod: `من ${startTimeStr} يوم ${startOfReport.toLocaleDateString(userLocale, {weekday: 'long', day: 'numeric', month: 'long'})} 
                     إلى ${startTimeStr} يوم ${endOfReport.toLocaleDateString(userLocale, {weekday: 'long', day: 'numeric', month: 'long'})}`,
    };

    const pdfBuffer = await generateDailyReportPDF(reportData);

    const owner = await User.findById(organization.owner).select('preferences').lean();
    const ownerLanguage = owner?.preferences?.language || 'ar';
    const organizationCurrency = organization.currency || 'EGP';

    // ✅ استخدام دالة getPayrollSummary المشتركة بدلاً من تكرار الكود
    let payrollSummaryData = null;
    let allEmployeesPDFData = null;
    
    try {
        Logger.info('🔍 Starting payroll summary generation using shared function...');
        
        // استيراد دالة getPayrollSummary
        const { getPayrollSummaryData } = await import('./payrollController.js');
        
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        // استدعاء الدالة المشتركة
        payrollSummaryData = await getPayrollSummaryData(organizationId, currentMonth, currentYear);
        
        Logger.info('✅ Payroll summary generated successfully:', {
            totalEmployees: payrollSummaryData?.totalEmployees || 0,
            totalAdvances: payrollSummaryData?.statistics?.totalAdvances || 0,
            totalDeductions: payrollSummaryData?.statistics?.totalDeductions || 0
        });
        
    } catch (payrollError) {
        console.error(`❌ Failed to generate payroll summary for ${organization.name}:`, payrollError);
        console.error('Payroll error stack:', payrollError.stack);
    }


    // Generate all employees detailed PDF
    try {
      
        
        if (payrollSummaryData && payrollSummaryData.employees && payrollSummaryData.employees.length > 0) {
            
            const { default: Employee } = await import('../models/Employee.js');
            const { default: Attendance } = await import('../models/Attendance.js');
            const { default: Advance } = await import('../models/Advance.js');
            const { default: Payment } = await import('../models/Payment.js');
            const { default: Deduction } = await import('../models/Deduction.js');
            const { default: Bonus } = await import('../models/Bonus.js');
            
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            const monthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
            const startDate = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
            const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
                        
            // All employees resolve in parallel, and each employee's 6 queries run
            // in parallel too (were 6 sequential queries per employee — with N
            // employees this was 6xN sequential round-trips on every emailed report).
            const detailedResults = await Promise.all(payrollSummaryData.employees.map(async (empSummary) => {
                try {
                    const [employee, attendance, advances, bonuses, deductions, payments] = await Promise.all([
                        // Get full employee data
                        Employee.findById(empSummary.employeeId),
                        // Get attendance records
                        Attendance.find({
                            employeeId: empSummary.employeeId,
                            organizationId: organizationId,
                            date: { $gte: startDate, $lte: endDate }
                        }).sort({ date: 1 }).lean(),
                        // Get advances
                        Advance.find({
                            employeeId: empSummary.employeeId,
                            organizationId: organizationId,
                            month: monthStr
                        }).sort({ requestDate: -1 }).lean(),
                        // Get bonuses
                        Bonus.find({
                            employeeId: empSummary.employeeId,
                            organizationId: organizationId,
                            month: monthStr
                        }).sort({ date: -1 }).lean(),
                        // Get deductions
                        Deduction.find({
                            employeeId: empSummary.employeeId,
                            organizationId: organizationId,
                            month: monthStr
                        }).sort({ date: -1 }).lean(),
                        // Get payments
                        Payment.find({
                            employeeId: empSummary.employeeId,
                            organizationId: organizationId,
                            month: monthStr
                        }).sort({ paymentDate: -1 }).lean(),
                    ]);

                    if (!employee) {
                        console.warn(`Employee not found: ${empSummary.employeeId}`);
                        return null;
                    }

                    // Calculate stats (reuse from payrollSummaryData)
                    // remainingBalance should be current month's net salary minus current month's paid amount
                    const currentMonthNetSalary = (empSummary.grossSalary || 0) + (empSummary.bonuses || 0) - (empSummary.deductions || 0);
                    const currentMonthRemaining = currentMonthNetSalary - (empSummary.paidAmount || 0);

                    const stats = {
                        carriedForward: empSummary.carriedForward || 0,
                        currentMonthSalary: empSummary.grossSalary || 0,
                        currentMonthBonuses: empSummary.bonuses || 0,
                        currentMonthAdvances: empSummary.advances || 0,
                        currentMonthDeductions: empSummary.deductions || 0,
                        currentMonthPaid: empSummary.paidAmount || 0,
                        remainingBalance: (empSummary.carriedForward || 0) + currentMonthRemaining, // Total available = carried forward + current month remaining
                        attendanceDays: attendance.filter(a => a.status === 'present' || a.status === 'late').length
                    };

                    return {
                        employee: employee.toObject(),
                        stats,
                        attendance,
                        advances,
                        bonuses,
                        deductions,
                        payments
                    };

                } catch (empError) {
                    console.error(`Error preparing detailed data for employee ${empSummary.employeeId}:`, empError);
                    return null;
                }
            }));

            allEmployeesPDFData = detailedResults.filter(Boolean);
            
        } else {
            console.warn(`⚠️ Cannot prepare all employees PDF - missing data:`, {
                hasPayrollData: !!payrollSummaryData,
                hasEmployees: !!(payrollSummaryData?.employees),
                employeeCount: payrollSummaryData?.employees?.length || 0
            });
        }
    } catch (allEmpError) {
        console.error(`❌ Failed to prepare all employees PDF data for ${organization.name}:`, allEmpError);
        console.error('All employees error stack:', allEmpError.stack);
    }

    // Group recipients by scope: the default (full) group reuses the pipeline
    // above byte-for-byte; custom groups get filtered mini-reports below.
    const { groupRecipients, scopeKey } = await import('../utils/dailyReportBuilder.js');
    const FULL_KEY = 'ALL|1|1|1|1';
    const allGroups = groupRecipients(reportEmails, ownerLanguage);
    const defaultGroup = (allGroups.find(g => scopeKey(g.scope) === FULL_KEY)?.recipients) || [];
    const customGroups = allGroups.filter(g => scopeKey(g.scope) !== FULL_KEY);

    await sendDailyReport(reportData, defaultGroup, pdfBuffer, ownerLanguage, organizationCurrency, payrollSummaryData, allEmployeesPDFData);

    // Per-recipient mini-reports: groups with custom scope get their own
    // filtered build (shared builder) + payroll only when wanted.
    let customSent = 0;
    if (customGroups.length > 0) {
        const { buildDailyReportData, buildPayrollBlock } = await import('../utils/dailyReportBuilder.js');
        const { generateDailyReportPDF: genPdf } = await import('../utils/pdfGenerator.js');
        const menuItemMap = {};
        menuItems.forEach(item => { menuItemMap[item.name] = item; });
        for (const group of customGroups) {
            try {
                const scoped = buildDailyReportData({
                    organization, raw: { orders, sessions, costs, menuItemMap },
                    startOfReport, endOfReport, startTimeStr, userLocale, scope: group.scope,
                });
                let ppay = null;
                let pemp = null;
                if (group.scope.includeEmployees) {
                    ({ payrollSummaryData: ppay, allEmployeesPDFData: pemp } = await buildPayrollBlock(organizationId, organization.name));
                }
                const pdf = await genPdf(scoped);
                const results = await sendDailyReport(scoped, group.recipients, pdf, ownerLanguage, organizationCurrency, ppay, pemp);
                if (Array.isArray(results)) customSent += results.filter(r => r?.success).length;
            } catch (groupError) {
                console.error(`❌ Failed scoped report group:`, groupError);
            }
        }
    }

    if (!organization.reportSettings) {
        organization.reportSettings = {};
    }
    organization.reportSettings.lastReportSentAt = new Date();

    // Monthly report (1st of month only, once per calendar month): same
    // per-recipient mini-report semantics. Previously monthly lived only in
    // the manual button AND passed recipient objects as `to:` (silent fail).
    let monthlySentCount = 0;
    try {
        const nowMonthly = new Date();
        const { isSameCalendarMonth } = await import('../utils/dailyReportBuilder.js');
        if (nowMonthly.getDate() === 1 && !isSameCalendarMonth(organization.reportSettings.lastMonthlyReportSentAt, nowMonthly)) {
            const { sendGroupedMonthlyReports, groupRecipients: groupMonthly } = await import('../utils/dailyReportBuilder.js');
            const { findReportEligibleOrders: findMonthlyOrders } = await import('../utils/reportOrderFilter.js');
            const mEnd = new Date(nowMonthly.getFullYear(), nowMonthly.getMonth(), 1);
            mEnd.setHours(startHour, startMinute || 0, 0, 0);
            const mStart = new Date(mEnd);
            mStart.setMonth(mStart.getMonth() - 1);
            const mGroups = groupMonthly(reportEmails, ownerLanguage);
            monthlySentCount = await sendGroupedMonthlyReports({
                organization,
                groups: mGroups,
                month: { start: mStart, end: mEnd },
                startTimeStr,
                userLocale,
                currency: organizationCurrency,
                ownerLanguage,
                findReportEligibleOrders: findMonthlyOrders,
            });
            if (monthlySentCount > 0) {
                organization.reportSettings.lastMonthlyReportSentAt = new Date();
            }
        }
    } catch (monthlyError) {
        console.error('❌ Scheduled monthly report failed:', monthlyError);
    }

    await organization.save();

    return {
        success: true,
        emailsSent: defaultGroup.length + customSent,
        monthlySent: monthlySentCount,
        emails: reportEmails,
        reportData: reportData
    };
};

// @desc    Send daily report now (manual trigger)
// @route   POST /api/organization/send-report-now
// @access  Private (Owner or Authorized Managers)
export const sendReportNow = async (req, res) => {
    try {
        const organizationId = req.user.organization?._id || req.user.organization;

        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: "المستخدم غير مرتبط بأي منشأة",
            });
        }

        const organization = await Organization.findById(organizationId);

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: "المنشأة غير موجودة",
            });
        }

        // Check if user is owner or authorized to manage reports
        const isOwner = isOrgOwner(organization, req.user);
        const isAuthorized = includesUser(organization.reportSettings?.authorizedToManageReports, req.user);

        if (!isOwner && !isAuthorized) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية لإرسال التقارير",
            });
        }

        // Check if report is enabled
        if (organization.reportSettings?.dailyReportEnabled === false) {
            return res.status(400).json({
                success: false,
                message: "التقرير اليومي غير مفعل",
            });
        }

        // Check if there are emails configured
        const reportEmails = organization.reportSettings?.dailyReportEmails || [];
        if (reportEmails.length === 0) {
            return res.status(400).json({
                success: false,
                message: "لم يتم تحديد أي إيميلات لإرسال التقرير",
            });
        }

        // Import required modules
        const { default: Session } = await import('../models/Session.js');
        const { default: Cost } = await import('../models/Cost.js');
        const { default: MenuItem } = await import('../models/MenuItem.js');
        const { sendDailyReport } = await import('../utils/email.js');
        const { generateDailyReportPDF } = await import('../utils/pdfGenerator.js');

        // Get the configured start time
        const startTimeStr = organization.reportSettings?.dailyReportStartTime || "08:00";
        const [startHour, startMinute] = startTimeStr.split(':').map(Number);

        // Calculate report period (24 hours from configured start time)
        const now = new Date();
        const endOfReport = new Date(now);
        endOfReport.setHours(startHour, startMinute || 0, 0, 0);
        
        if (now < endOfReport) {
            endOfReport.setDate(endOfReport.getDate() - 1);
        }
        
        const startOfReport = new Date(endOfReport);
        startOfReport.setDate(startOfReport.getDate() - 1);

        Logger.info('📊 ===== SEND REPORT NOW =====');
        Logger.info('Organization:', organization.name);
        const userLocale = getUserLocale(req.user);
    
        // Fetch data using the SAME logic as Reports page
        // Get ALL orders (not just specific statuses)
        const orders = await findReportEligibleOrders(organizationId, {
            createdAt: { $gte: startOfReport, $lte: endOfReport },
        });

        // ✅ Get completed sessions - يجب استخدام endTime وليس createdAt!
        const sessions = await Session.find({
            endTime: { $gte: startOfReport, $lte: endOfReport },
            status: "completed",
            organization: organizationId,
        }).lean();

        // Get costs
        const costs = await Cost.find({
            date: { $gte: startOfReport, $lte: endOfReport },
            organization: organizationId,
        }).lean();

        // Calculate revenues using SAME logic as Reports page
        const cafeRevenue = orders.reduce((sum, order) => sum + (Number(order.finalAmount) || 0), 0);
        
        const playstationSessions = sessions.filter(s => s.deviceType === "playstation");
        const computerSessions = sessions.filter(s => s.deviceType === "computer");
               
        const playstationRevenue = playstationSessions.reduce((sum, s) => {
            const cost = Number(s.finalCost) || 0;
            return sum + cost;
        }, 0);
        
        const computerRevenue = computerSessions.reduce((sum, s) => {
            const cost = Number(s.finalCost) || 0;
            return sum + cost;
        }, 0);
        
        const totalRevenue = cafeRevenue + playstationRevenue + computerRevenue;
        const totalCosts = costs.reduce((sum, cost) => sum + (Number(cost.paidAmount) || Number(cost.amount) || 0), 0);
        const netProfit = totalRevenue - totalCosts;

        // Get top products - variant-aware (size separate)
        const productSales = {};
        orders.forEach((order) => {
            if (!order.items || !Array.isArray(order.items)) return;
            
            order.items.forEach((item) => {
                if (!item.name) return;
                
                const variant = item.variant || '';
                const key = `${item.name}|${variant}`;
                const variantText = variant && variant !== 'عادي' ? ` (${variant})` : '';
                const displayName = `${item.name}${variantText}`;
                if (!productSales[key]) {
                    productSales[key] = { name: displayName, variant, quantity: 0, revenue: 0 };
                }
                
                const itemQuantity = Number(item.quantity) || 0;
                const itemPrice = Number(item.price) || 0;
                const itemTotal = Number(item.itemTotal) || (itemPrice * itemQuantity);
                
                productSales[key].quantity += itemQuantity;
                productSales[key].revenue += itemTotal;
            });
        });

        const topProducts = Object.values(productSales)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        // Get top products by section (same as Reports page)
        const menuItems = await MenuItem.find({ organization: organizationId }).populate({
            path: 'category',
            populate: {
                path: 'section'
            }
        }).lean();

        const menuItemMap = {};
        menuItems.forEach(item => {
            menuItemMap[item.name] = item;
        });

        const sectionData = {};
        orders.forEach(order => {
            if (!order.items || !Array.isArray(order.items)) return;

            order.items.forEach(item => {
                if (!item.name) return;

                const variant = item.variant || '';
                const variantText = variant && variant !== 'عادي' ? ` (${variant})` : '';
                const displayName = `${item.name}${variantText}`;
                const productKey = `${item.name}|${variant}`;

                const menuItem = menuItemMap[item.name];
                let sectionId = 'other';
                let sectionName = 'أخرى';

                if (menuItem && menuItem.category && menuItem.category.section) {
                    const section = menuItem.category.section;
                    sectionId = section._id ? section._id.toString() : 'other';
                    sectionName = section.name || 'أخرى';
                }

                if (!sectionData[sectionId]) {
                    sectionData[sectionId] = {
                        sectionId,
                        sectionName,
                        products: {},
                        totalRevenue: 0,
                        totalQuantity: 0
                    };
                }

                const itemPrice = Number(item.price) || 0;
                const itemQuantity = Number(item.quantity) || 0;
                const itemTotal = Number(item.itemTotal) || (itemPrice * itemQuantity);

                if (!sectionData[sectionId].products[productKey]) {
                    sectionData[sectionId].products[productKey] = {
                        name: displayName,
                        variant,
                        quantity: 0,
                        revenue: 0
                    };
                }

                sectionData[sectionId].products[productKey].quantity += itemQuantity;
                sectionData[sectionId].products[productKey].revenue += itemTotal;
                sectionData[sectionId].totalRevenue += itemTotal;
                sectionData[sectionId].totalQuantity += itemQuantity;
            });
        });

        const topProductsBySection = Object.values(sectionData).map(section => ({
            sectionId: section.sectionId,
            sectionName: section.sectionName,
            totalRevenue: section.totalRevenue,
            totalQuantity: section.totalQuantity,
            products: Object.values(section.products)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10)
        })).sort((a, b) => b.totalRevenue - a.totalRevenue);

        const reportData = {
            date: startOfReport.toLocaleDateString(userLocale),
            organizationName: organization.name,
            totalRevenue: totalRevenue || 0,
            totalCosts: totalCosts || 0,
            netProfit: netProfit || 0,
            profitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0,
            totalBills: orders.length + sessions.length,
            totalOrders: orders.length || 0,
            totalSessions: sessions.length || 0,
            topProducts: topProducts,
            topProductsBySection: topProductsBySection,
            revenueByType: {
                playstation: playstationRevenue || 0,
                computer: computerRevenue || 0,
                cafe: cafeRevenue || 0
            },
            // إضافة البيانات الجديدة للأقسام وجميع الأصناف - variant-aware
            soldItemsBySection: Object.values(sectionData).map(section => ({
                sectionName: section.sectionName,
                items: Object.values(section.products).map(product => ({
                    name: product.name,
                    variant: product.variant,
                    quantity: product.quantity,
                    totalRevenue: product.revenue
                }))
            })),
            allSoldItems: Object.values(productSales).map((data) => ({
                name: data.name,
                variant: data.variant,
                quantity: data.quantity,
                totalRevenue: data.revenue
            })).sort((a, b) => b.totalRevenue - a.totalRevenue),
            startOfReport: startOfReport,
            endOfReport: endOfReport,
            reportPeriod: `من ${startTimeStr} يوم ${startOfReport.toLocaleDateString(userLocale, {weekday: 'long', day: 'numeric', month: 'long'})} 
                         إلى ${startTimeStr} يوم ${endOfReport.toLocaleDateString(userLocale, {weekday: 'long', day: 'numeric', month: 'long'})}`,
        };

        // Generate PDF
        const pdfBuffer = await generateDailyReportPDF(reportData);

        // Get organization owner's language and currency preferences
        const owner = await User.findById(organization.owner).select('preferences').lean();
        const ownerLanguage = owner?.preferences?.language || 'ar';
        const organizationCurrency = organization.currency || 'EGP';

        // ✅ استخدام دالة getPayrollSummary المشتركة بدلاً من تكرار الكود
        let payrollSummaryData = null;
        try {
            Logger.info('🔍 Starting payroll summary generation using shared function...');
            
            // استيراد دالة getPayrollSummary
            const { getPayrollSummaryData } = await import('./payrollController.js');
            
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            
            // استدعاء الدالة المشتركة
            payrollSummaryData = await getPayrollSummaryData(organizationId, currentMonth, currentYear);
            
            Logger.info('✅ Payroll summary generated successfully:', {
                totalEmployees: payrollSummaryData?.totalEmployees || 0,
                totalAdvances: payrollSummaryData?.statistics?.totalAdvances || 0,
                totalDeductions: payrollSummaryData?.statistics?.totalDeductions || 0
            });
            
        } catch (payrollError) {
            console.error(`❌ Failed to generate payroll summary for ${organization.name}:`, payrollError);
            console.error('Payroll error stack:', payrollError.stack);
        }

        // Generate all employees detailed PDF
        let allEmployeesPDFData = null;
        try {
            
            if (payrollSummaryData && payrollSummaryData.employees && payrollSummaryData.employees.length > 0) {
                
                const { default: Employee } = await import('../models/Employee.js');
                const { default: Attendance } = await import('../models/Attendance.js');
                const { default: Advance } = await import('../models/Advance.js');
                const { default: Payment } = await import('../models/Payment.js');
                const { default: Deduction } = await import('../models/Deduction.js');
                const { default: Bonus } = await import('../models/Bonus.js');
                
                const currentMonth = now.getMonth() + 1;
                const currentYear = now.getFullYear();
                const monthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
                const startDate = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
                const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

                
                const detailedEmployeesData = [];
                
                for (const empSummary of payrollSummaryData.employees) {
                    try {
                        
                        // Get full employee data
                        const employee = await Employee.findById(empSummary.employeeId);
                        if (!employee) {
                            console.warn(`Employee not found: ${empSummary.employeeId}`);
                            continue;
                        }
                        
                        // Get attendance records
                        const attendance = await Attendance.find({
                            employeeId: employee._id,
                            organizationId: organizationId,
                            date: { $gte: startDate, $lte: endDate }
                        }).sort({ date: 1 }).lean();
                        
                        // Get advances
                        const advances = await Advance.find({
                            employeeId: employee._id,
                            organizationId: organizationId,
                            month: monthStr
                        }).sort({ requestDate: -1 }).lean();
                        
                        // Get bonuses
                        const bonuses = await Bonus.find({
                            employeeId: employee._id,
                            organizationId: organizationId,
                            month: monthStr
                        }).sort({ date: -1 }).lean();
                        
                        // Get deductions
                        const deductions = await Deduction.find({
                            employeeId: employee._id,
                            organizationId: organizationId,
                            month: monthStr
                        }).sort({ date: -1 }).lean();
                        
                        // Get payments
                        const payments = await Payment.find({
                            employeeId: employee._id,
                            organizationId: organizationId,
                            month: monthStr
                        }).sort({ paymentDate: -1 }).lean();
                        
                        // Calculate stats (reuse from payrollSummaryData)
                        // remainingBalance should be current month's net salary minus current month's paid amount
                        const currentMonthNetSalary = (empSummary.grossSalary || 0) + (empSummary.bonuses || 0) - (empSummary.deductions || 0);
                        const currentMonthRemaining = currentMonthNetSalary - (empSummary.paidAmount || 0);
                        
                        const stats = {
                            carriedForward: empSummary.carriedForward || 0,
                            currentMonthSalary: empSummary.grossSalary || 0,
                            currentMonthBonuses: empSummary.bonuses || 0,
                            currentMonthAdvances: empSummary.advances || 0,
                            currentMonthDeductions: empSummary.deductions || 0,
                            currentMonthPaid: empSummary.paidAmount || 0,
                            remainingBalance: (empSummary.carriedForward || 0) + currentMonthRemaining, // Total available = carried forward + current month remaining
                            attendanceDays: attendance.filter(a => a.status === 'present' || a.status === 'late').length
                        };
                        
                        detailedEmployeesData.push({
                            employee: employee.toObject(),
                            stats,
                            attendance,
                            advances,
                            bonuses,
                            deductions,
                            payments
                        });
                        
                        
                    } catch (empError) {
                        console.error(`Error preparing detailed data for employee ${empSummary.employeeId}:`, empError);
                    }
                }
                
                allEmployeesPDFData = detailedEmployeesData;
                

            } else {
                console.warn(`⚠️ Cannot prepare all employees PDF - missing data:`, {
                    hasPayrollData: !!payrollSummaryData,
                    hasEmployees: !!(payrollSummaryData?.employees),
                    employeeCount: payrollSummaryData?.employees?.length || 0
                });
            }
        } catch (allEmpError) {
            console.error(`❌ Failed to prepare all employees PDF data for ${organization.name}:`, allEmpError);
            console.error('All employees error stack:', allEmpError.stack);
        }

        // Send report via email with PDF attachment (grouped per-recipient scope;
        // the default group reuses the full pipeline above byte-for-byte).
        const { groupRecipients: groupRecipientsNow, scopeKey: scopeKeyNow } = await import('../utils/dailyReportBuilder.js');
        const FULL_KEY_NOW = 'ALL|1|1|1|1';
        const allGroupsNow = groupRecipientsNow(reportEmails, ownerLanguage);
        const defaultGroupNow = (allGroupsNow.find(g => scopeKeyNow(g.scope) === FULL_KEY_NOW)?.recipients) || [];
        const customGroupsNow = allGroupsNow.filter(g => scopeKeyNow(g.scope) !== FULL_KEY_NOW);
        await sendDailyReport(reportData, defaultGroupNow, pdfBuffer, ownerLanguage, organizationCurrency, payrollSummaryData, allEmployeesPDFData);
        if (customGroupsNow.length > 0) {
            const { buildDailyReportData: buildScoped, buildPayrollBlock: buildPayrollNow } = await import('../utils/dailyReportBuilder.js');
            const { generateDailyReportPDF: genPdfNow } = await import('../utils/pdfGenerator.js');
            const menuItemMapNow = {};
            menuItems.forEach(item => { menuItemMapNow[item.name] = item; });
            for (const group of customGroupsNow) {
                try {
                    const scoped = buildScoped({
                        organization, raw: { orders, sessions, costs, menuItemMap: menuItemMapNow },
                        startOfReport, endOfReport, startTimeStr, userLocale, scope: group.scope,
                    });
                    let ppay = null;
                    let pemp = null;
                    if (group.scope.includeEmployees) {
                        ({ payrollSummaryData: ppay, allEmployeesPDFData: pemp } = await buildPayrollNow(organizationId, organization.name));
                    }
                    const pdf = await genPdfNow(scoped);
                    await sendDailyReport(scoped, group.recipients, pdf, ownerLanguage, organizationCurrency, ppay, pemp);
                } catch (groupError) {
                    console.error(`❌ Failed scoped report group (send-now):`, groupError);
                }
            }
        }

        // Monthly report (1st of month, once per calendar month): same grouped
        // mini-report semantics as the scheduled flow ( deduped via
        // lastMonthlyReportSentAt so manual + scheduled can't double-send).
        const today = new Date();
        const isFirstDayOfMonth = today.getDate() === 1;
        let monthlySent = false;
        const { isSameCalendarMonth: sameMonthNow } = await import('../utils/dailyReportBuilder.js');
        if (isFirstDayOfMonth && !sameMonthNow(organization.reportSettings?.lastMonthlyReportSentAt, today)) {
            try {
                Logger.info('📅 First day of month detected - sending grouped monthly reports...');
                const { sendGroupedMonthlyReports: sendMonthlyNow, groupRecipients: groupMonthlyNow } = await import('../utils/dailyReportBuilder.js');
                const { findReportEligibleOrders: findMonthlyOrdersNow } = await import('../utils/reportOrderFilter.js');
                const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 1);
                lastMonthEnd.setHours(startHour, startMinute || 0, 0, 0);
                const lastMonthStart = new Date(lastMonthEnd);
                lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
                const mGroupsNow = groupMonthlyNow(reportEmails, ownerLanguage);
                const mSent = await sendMonthlyNow({
                    organization,
                    groups: mGroupsNow,
                    month: { start: lastMonthStart, end: lastMonthEnd },
                    startTimeStr,
                    userLocale,
                    currency: organizationCurrency,
                    ownerLanguage,
                    findReportEligibleOrders: findMonthlyOrdersNow,
                });
                if (mSent > 0) {
                    if (!organization.reportSettings) organization.reportSettings = {};
                    organization.reportSettings.lastMonthlyReportSentAt = new Date();
                    await organization.save();
                }
                monthlySent = mSent > 0;
                Logger.info(`✅ Monthly reports sent: ${mSent}`);
            } catch (monthlyError) {
                console.error('❌ Error sending monthly report:', monthlyError);
                // Don't fail the whole request if monthly report fails
            }
        }

        res.json({
            success: true,
            message: monthlySent 
                ? `تم إرسال التقرير اليومي والشهري بنجاح إلى ${reportEmails.length} إيميل`
                : `تم إرسال التقرير اليومي بنجاح إلى ${reportEmails.length} إيميل`,
            data: {
                emailsSent: reportEmails.length,
                emails: reportEmails,
                reportPeriod: reportData.reportPeriod,
                monthlySent: monthlySent,
                summary: {
                    totalRevenue: reportData.totalRevenue,
                    totalOrders: reportData.totalOrders,
                    totalSessions: reportData.totalSessions,
                    netProfit: reportData.netProfit
                }
            }
        });
    } catch (error) {
        console.error('Error sending report now:', error);
        res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء إرسال التقرير",
            error: error.message,
        });
    }
};
