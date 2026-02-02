import Organization from "../models/Organization.js";
import User from "../models/User.js";
import organizationWebsiteService from "../services/organizationWebsiteService.js";

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
            logo
        } = req.body;

        // تحديث البيانات
        if (name) organization.name = name;
        if (description !== undefined) organization.description = description;
        if (address !== undefined) organization.address = address;
        if (phone !== undefined) organization.phone = phone;
        if (email !== undefined) organization.email = email;
        if (website !== undefined) organization.website = website;
        if (logo !== undefined) organization.logo = logo;
        
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