import Organization from "../models/Organization.js";
import User from "../models/User.js";
import organizationWebsiteService from "../services/organizationWebsiteService.js";
import { getUserLocale } from "../utils/localeHelper.js";

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
        const organizationId = req.user.organization?._id || req.user.organization;

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

        // التحقق من الصلاحيات
        const isOwner = organization.owner.toString() === req.user._id.toString();
        const isAuthorizedAdmin = req.user.role === 'admin' && 
            organization.permissions.allowManagersToEditOrganization &&
            organization.permissions.authorizedManagers.some(
                manager => manager._id.toString() === req.user._id.toString()
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
            timezone
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
        const isOwner = organization.owner.toString() === req.user._id.toString();

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

        const isOwner = organization.owner.toString() === req.user._id.toString();
        const isAuthorizedAdmin = req.user.role === 'admin' && 
            organization.permissions.allowManagersToEditOrganization &&
            organization.permissions.authorizedManagers.some(
                manager => manager._id.toString() === req.user._id.toString()
            );

        const canEdit = isOwner || isAuthorizedAdmin;
        res.json({
            success: true,
            data: {
                canEdit,
                isOwner,
                isAuthorizedAdmin,
                allowManagersToEditOrganization: organization.permissions.allowManagersToEditOrganization,
                authorizedManagers: organization.permissions.authorizedManagers
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
        const isOwner = organization.owner.toString() === req.user._id.toString();

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
        const isOwner = organization.owner.toString() === req.user._id.toString();
        const isAuthorized = organization.reportSettings?.authorizedToManageReports?.some(
            managerId => managerId.toString() === req.user._id.toString()
        );

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

        const isOwner = organization.owner.toString() === req.user._id.toString();
        const isAuthorized = organization.reportSettings?.authorizedToManageReports?.some(
            managerId => managerId.toString() === req.user._id.toString()
        );

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

        const isOwner = organization.owner.toString() === req.user._id.toString();
        const isAuthorized = organization.permissions?.authorizedPayrollManagers?.some(
            managerId => managerId.toString() === req.user._id.toString()
        );

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
        const isOwner = organization.owner.toString() === req.user._id.toString();

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
        const isOwner = organization.owner.toString() === req.user._id.toString();
        const isAuthorized = organization.reportSettings?.authorizedToManageReports?.some(
            managerId => managerId.toString() === req.user._id.toString()
        );

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
        const { default: Order } = await import('../models/Order.js');
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

        console.log('📊 ===== SEND REPORT NOW =====');
        console.log('Organization:', organization.name);
        const userLocale = getUserLocale(req.user);
        console.log('Report Period:', {
            start: startOfReport.toLocaleString(userLocale),
            end: endOfReport.toLocaleString(userLocale)
        });

        // Fetch data using the SAME logic as Reports page
        // Get ALL orders (not just specific statuses)
        const orders = await Order.find({
            createdAt: { $gte: startOfReport, $lte: endOfReport },
            organization: organizationId,
        }).lean();

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

        console.log('📊 Data fetched:', {
            ordersCount: orders.length,
            sessionsCount: sessions.length,
            costsCount: costs.length,
            sessionsSample: sessions.slice(0, 2).map(s => ({
                id: s._id,
                deviceType: s.deviceType,
                endTime: s.endTime,
                finalCost: s.finalCost
            }))
        });


        // Calculate revenues using SAME logic as Reports page
        const cafeRevenue = orders.reduce((sum, order) => sum + (Number(order.finalAmount) || 0), 0);
        
        const playstationSessions = sessions.filter(s => s.deviceType === "playstation");
        const computerSessions = sessions.filter(s => s.deviceType === "computer");
        
        console.log('🎮 Sessions breakdown:', {
            totalSessions: sessions.length,
            playstationCount: playstationSessions.length,
            computerCount: computerSessions.length
        });
        
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

        console.log('💰 Revenue calculation:', {
            cafeRevenue,
            playstationRevenue,
            computerRevenue,
            totalRevenue,
            netProfit
        });

        // Get top products
        const productSales = {};
        orders.forEach((order) => {
            if (!order.items || !Array.isArray(order.items)) return;
            
            order.items.forEach((item) => {
                if (!item.name) return;
                
                if (!productSales[item.name]) {
                    productSales[item.name] = { quantity: 0, revenue: 0 };
                }
                
                const itemQuantity = Number(item.quantity) || 0;
                const itemPrice = Number(item.price) || 0;
                const itemTotal = item.itemTotal || (itemPrice * itemQuantity);
                
                productSales[item.name].quantity += itemQuantity;
                productSales[item.name].revenue += itemTotal;
            });
        });

        const topProducts = Object.entries(productSales)
            .map(([name, data]) => ({ name, ...data }))
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
                const itemTotal = item.itemTotal || (itemPrice * itemQuantity);

                if (!sectionData[sectionId].products[item.name]) {
                    sectionData[sectionId].products[item.name] = {
                        name: item.name,
                        quantity: 0,
                        revenue: 0
                    };
                }

                sectionData[sectionId].products[item.name].quantity += itemQuantity;
                sectionData[sectionId].products[item.name].revenue += itemTotal;
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

        // Send report via email with PDF attachment
        await sendDailyReport(reportData, reportEmails, pdfBuffer, ownerLanguage, organizationCurrency);

        // Check if today is the 1st of the month - send monthly report too
        const today = new Date();
        const isFirstDayOfMonth = today.getDate() === 1;
        let monthlySent = false;
        
        if (isFirstDayOfMonth) {
            try {
                console.log('📅 First day of month detected - sending monthly report too...');
                
                const { sendMonthlyReport } = await import('../utils/email.js');
                
                // Calculate last month's period
                const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 1);
                lastMonthEnd.setHours(startHour, startMinute || 0, 0, 0);
                
                const lastMonthStart = new Date(lastMonthEnd);
                lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
                
                console.log('📊 Monthly report period:', {
                    start: lastMonthStart.toLocaleString(userLocale),
                    end: lastMonthEnd.toLocaleString(userLocale)
                });
                
                // Fetch monthly data
                const [monthlyOrders, monthlySessions, monthlyCosts] = await Promise.all([
                    Order.find({
                        createdAt: { $gte: lastMonthStart, $lt: lastMonthEnd },
                        organization: organizationId,
                    }).lean(),
                    Session.find({
                        endTime: { $gte: lastMonthStart, $lt: lastMonthEnd },
                        status: "completed",
                        organization: organizationId,
                    }).lean(),
                    Cost.find({
                        date: { $gte: lastMonthStart, $lt: lastMonthEnd },
                        organization: organizationId,
                    }).lean(),
                ]);
                
                // Calculate monthly revenues
                const monthlyCafeRevenue = monthlyOrders.reduce((sum, order) => sum + (Number(order.finalAmount) || 0), 0);
                const monthlyPlaystationSessions = monthlySessions.filter(s => s.deviceType === "playstation");
                const monthlyComputerSessions = monthlySessions.filter(s => s.deviceType === "computer");
                const monthlyPlaystationRevenue = monthlyPlaystationSessions.reduce((sum, s) => sum + (Number(s.finalCost) || 0), 0);
                const monthlyComputerRevenue = monthlyComputerSessions.reduce((sum, s) => sum + (Number(s.finalCost) || 0), 0);
                const monthlyTotalRevenue = monthlyCafeRevenue + monthlyPlaystationRevenue + monthlyComputerRevenue;
                const monthlyTotalCosts = monthlyCosts.reduce((sum, cost) => sum + (Number(cost.paidAmount) || Number(cost.amount) || 0), 0);
                const monthlyNetProfit = monthlyTotalRevenue - monthlyTotalCosts;
                
                // Get monthly top products
                const monthlyProductSales = {};
                monthlyOrders.forEach((order) => {
                    if (!order.items || !Array.isArray(order.items)) return;
                    order.items.forEach((item) => {
                        if (!item.name) return;
                        if (!monthlyProductSales[item.name]) {
                            monthlyProductSales[item.name] = { quantity: 0, revenue: 0 };
                        }
                        const itemQuantity = Number(item.quantity) || 0;
                        const itemPrice = Number(item.price) || 0;
                        const itemTotal = item.itemTotal || (itemPrice * itemQuantity);
                        monthlyProductSales[item.name].quantity += itemQuantity;
                        monthlyProductSales[item.name].revenue += itemTotal;
                    });
                });
                
                const monthlyTopProducts = Object.entries(monthlyProductSales)
                    .map(([name, data]) => ({ name, ...data }))
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 10);
                
                // Get monthly top products by section
                const monthlySectionData = {};
                monthlyOrders.forEach(order => {
                    if (!order.items || !Array.isArray(order.items)) return;
                    order.items.forEach(item => {
                        if (!item.name) return;
                        const menuItem = menuItemMap[item.name];
                        let sectionId = 'other';
                        let sectionName = 'أخرى';
                        if (menuItem && menuItem.category && menuItem.category.section) {
                            const section = menuItem.category.section;
                            sectionId = section._id ? section._id.toString() : 'other';
                            sectionName = section.name || 'أخرى';
                        }
                        if (!monthlySectionData[sectionId]) {
                            monthlySectionData[sectionId] = {
                                sectionId, sectionName, products: {}, totalRevenue: 0, totalQuantity: 0
                            };
                        }
                        const itemPrice = Number(item.price) || 0;
                        const itemQuantity = Number(item.quantity) || 0;
                        const itemTotal = item.itemTotal || (itemPrice * itemQuantity);
                        if (!monthlySectionData[sectionId].products[item.name]) {
                            monthlySectionData[sectionId].products[item.name] = { name: item.name, quantity: 0, revenue: 0 };
                        }
                        monthlySectionData[sectionId].products[item.name].quantity += itemQuantity;
                        monthlySectionData[sectionId].products[item.name].revenue += itemTotal;
                        monthlySectionData[sectionId].totalRevenue += itemTotal;
                        monthlySectionData[sectionId].totalQuantity += itemQuantity;
                    });
                });
                
                const monthlyTopProductsBySection = Object.values(monthlySectionData).map(section => ({
                    sectionId: section.sectionId,
                    sectionName: section.sectionName,
                    totalRevenue: section.totalRevenue,
                    totalQuantity: section.totalQuantity,
                    products: Object.values(section.products).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
                })).sort((a, b) => b.totalRevenue - a.totalRevenue);
                
                const daysInPeriod = Math.ceil((lastMonthEnd - lastMonthStart) / (1000 * 60 * 60 * 24));
                const avgDailyRevenue = daysInPeriod > 0 ? monthlyTotalRevenue / daysInPeriod : 0;
                
                const monthlyReportData = {
                    month: lastMonthStart.toLocaleDateString(userLocale, { month: "long", year: "numeric" }),
                    organizationName: organization.name,
                    totalRevenue: monthlyTotalRevenue || 0,
                    totalCosts: monthlyTotalCosts || 0,
                    netProfit: monthlyNetProfit || 0,
                    profitMargin: monthlyTotalRevenue > 0 ? ((monthlyNetProfit / monthlyTotalRevenue) * 100) : 0,
                    totalBills: monthlyOrders.length + monthlySessions.length,
                    totalOrders: monthlyOrders.length || 0,
                    totalSessions: monthlySessions.length || 0,
                    topProducts: monthlyTopProducts,
                    topProductsBySection: monthlyTopProductsBySection,
                    revenueByType: {
                        playstation: monthlyPlaystationRevenue || 0,
                        computer: monthlyComputerRevenue || 0,
                        cafe: monthlyCafeRevenue || 0
                    },
                    avgDailyRevenue: avgDailyRevenue || 0,
                    daysInPeriod: daysInPeriod,
                    startOfReport: lastMonthStart,
                    endOfReport: lastMonthEnd,
                    reportPeriod: `من ${startTimeStr} يوم ${lastMonthStart.toLocaleDateString(userLocale, {day: 'numeric', month: 'long', year: 'numeric'})} 
                                 إلى ${startTimeStr} يوم ${lastMonthEnd.toLocaleDateString(userLocale, {day: 'numeric', month: 'long', year: 'numeric'})}`,
                    language: ownerLanguage,
                    currency: organizationCurrency
                };
                
                // Send monthly report
                await sendMonthlyReport(monthlyReportData, reportEmails, ownerLanguage, organizationCurrency);
                
                // Update lastMonthlyReportSentAt
                if (!organization.reportSettings) {
                    organization.reportSettings = {};
                }
                organization.reportSettings.lastMonthlyReportSentAt = new Date();
                await organization.save();
                
                monthlySent = true;
                console.log('✅ Monthly report sent successfully');
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
