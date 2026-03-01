import User from "../models/User.js";
// bcrypt is not needed here as password hashing is handled in the User model

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin only)
export const getUsers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = "",
            role = "",
            status = "",
            sortBy = "createdAt",
            sortOrder = "desc",
        } = req.query;

        // Build query
        const query = { organization: req.user.organization };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
            ];
        }

        if (role) {
            query.role = role;
        }

        if (status) {
            query.status = status;
        }

        // Execute query
        const users = await User.find(query)
            .select("-password -refreshToken")
            .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate("organization", "name");

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            count: users.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            data: users,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب المستخدمين",
            error: error.message,
        });
    }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private
export const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select("-password -refreshToken")
            .populate("organization", "name");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "المستخدم غير موجود",
            });
        }

        // Check if user belongs to same organization
        if (user.organization.toString() !== req.user.organization.toString()) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية لعرض هذا المستخدم",
            });
        }

        res.json({
            success: true,
            data: user,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب المستخدم",
            error: error.message,
        });
    }
};

// @desc    Create new user
// @route   POST /api/users
// @access  Private (Admin only)
export const createUser = async (req, res) => {
    try {
        const { 
            name, 
            email, 
            password, 
            role, 
            permissions, 
            phone, 
            address,
            department,
            position,
            hireDate,
            salary,
            notes,
            status
        } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "المستخدم موجود بالفعل",
            });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            role: role || "staff",
            permissions: permissions || [],
            phone,
            address,
            department,
            position,
            hireDate: hireDate ? new Date(hireDate) : null,
            salary,
            notes,
            status: status || "active",
            organization: req.user.organization,
        });

        // Remove password from response
        user.password = undefined;

        res.status(201).json({
            success: true,
            message: "تم إنشاء المستخدم بنجاح",
            data: user,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في إنشاء المستخدم",
            error: error.message,
        });
    }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin only)
export const updateUser = async (req, res) => {
    try {
        const { 
            name, 
            email, 
            password,
            role, 
            permissions, 
            status, 
            phone, 
            address,
            department,
            position,
            hireDate,
            salary,
            notes
        } = req.body;

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "المستخدم غير موجود",
            });
        }

        // Check if user belongs to same organization
        if (user.organization.toString() !== req.user.organization.toString()) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية لتعديل هذا المستخدم",
            });
        }

        // Additional check: Allow admins to update users even without explicit "users" permission
        const canUpdate = req.user.role === 'admin' || 
                         req.user.hasPermission('users') || 
                         req.user.hasPermission('all');

        if (!canUpdate) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية لتعديل المستخدمين. يجب أن تكون مديراً أو تملك صلاحية إدارة المستخدمين.",
            });
        }

        // New rule: Only organization owner can edit other admins
        // التحقق من قاعدة البيانات مباشرة
        const isTargetAdmin = user.role === 'admin';
        const isEditingSelf = user._id.toString() === req.user._id.toString();

        if (isTargetAdmin && !isEditingSelf) {
            // جلب المنشأة من قاعدة البيانات للتحقق من المالك
            const Organization = (await import('../models/Organization.js')).default;
            const organization = await Organization.findById(req.user.organization);
            
         
            if (!organization) {
                return res.status(404).json({
                    success: false,
                    message: "المنشأة غير موجودة",
                });
            }

            const isCurrentUserOwner = req.user._id.toString() === organization.owner.toString();

            if (!isCurrentUserOwner) {
                return res.status(403).json({
                    success: false,
                    message: "لا يمكن للمديرين تعديل بيانات مديرين آخرين. فقط مالك المنشأة يمكنه ذلك.",
                });
            }
        }

        // Update fields
        if (name) user.name = name;
        if (email) user.email = email;
        if (password) user.password = password; // Will be hashed by pre-save middleware
        if (role) user.role = role;
        if (permissions) user.permissions = permissions;
        if (status) user.status = status;
        if (phone !== undefined) user.phone = phone;
        if (address !== undefined) user.address = address;
        if (department !== undefined) user.department = department;
        if (position !== undefined) user.position = position;
        if (hireDate !== undefined) user.hireDate = hireDate ? new Date(hireDate) : null;
        if (salary !== undefined) user.salary = salary;
        if (notes !== undefined) user.notes = notes;

        await user.save();

        // Remove password from response
        user.password = undefined;

        res.json({
            success: true,
            message: "تم تحديث المستخدم بنجاح",
            data: user,
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث المستخدم",
            error: error.message,
        });
    }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
export const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "المستخدم غير موجود",
            });
        }

        // Check if user belongs to same organization
        if (user.organization.toString() !== req.user.organization.toString()) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية لحذف هذا المستخدم",
            });
        }

        // Prevent deleting yourself
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: "لا يمكنك حذف حسابك الخاص",
            });
        }

        // Additional check: Allow admins to delete users even without explicit "users" permission
        const canDelete = req.user.role === 'admin' || 
                         req.user.hasPermission('users') || 
                         req.user.hasPermission('all');

        if (!canDelete) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية لحذف المستخدمين. يجب أن تكون مديراً أو تملك صلاحية إدارة المستخدمين.",
            });
        }

        // New rule: Only organization owner can delete other admins
        // التحقق من قاعدة البيانات مباشرة
        const isTargetAdmin = user.role === 'admin';

     
        if (isTargetAdmin) {
            // جلب المنشأة من قاعدة البيانات للتحقق من المالك
            const Organization = (await import('../models/Organization.js')).default;
            const organization = await Organization.findById(req.user.organization);
            
         
            if (!organization) {
                return res.status(404).json({
                    success: false,
                    message: "المنشأة غير موجودة",
                });
            }

            const isCurrentUserOwner = req.user._id.toString() === organization.owner.toString();

            if (!isCurrentUserOwner) {
                return res.status(403).json({
                    success: false,
                    message: "لا يمكن للمديرين حذف مديرين آخرين. فقط مالك المنشأة يمكنه ذلك.",
                });
            }
        }

        await User.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: "تم حذف المستخدم بنجاح",
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: "خطأ في حذف المستخدم",
            error: error.message,
        });
    }
};

// @desc    Update user profile
// @route   PUT /api/settings/profile
// @access  Private
export const updateProfile = async (req, res) => {
    try {
        const { name, email, phone, address } = req.body;

       
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "المستخدم غير موجود",
            });
        }

        // Check if email is already taken by another user
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ 
                email, 
                _id: { $ne: req.user._id } 
            });
            
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: "البريد الإلكتروني مستخدم بالفعل",
                });
            }
        }

        // Update only the specified fields
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (address !== undefined) updateData.address = address;


        // Use findByIdAndUpdate to avoid password validation issues
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            updateData,
            { 
                new: true, 
                runValidators: true,
                select: '-password -refreshToken' // Exclude sensitive fields
            }
        );


        res.json({
            success: true,
            message: "تم تحديث الملف الشخصي بنجاح",
            data: updatedUser,
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث الملف الشخصي",
            error: error.message,
        });
    }
};

// @desc    Change password
// @route   PUT /api/settings/change-password
// @access  Private
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "جميع الحقول مطلوبة",
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "كلمة المرور الجديدة غير متطابقة",
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
            });
        }

        // Get user with password
        const user = await User.findById(req.user._id).select("+password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "المستخدم غير موجود",
            });
        }

        // Check current password
        const isCurrentPasswordCorrect = await user.comparePassword(currentPassword);

        if (!isCurrentPasswordCorrect) {
            return res.status(400).json({
                success: false,
                message: "كلمة المرور الحالية غير صحيحة",
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: "تم تغيير كلمة المرور بنجاح",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تغيير كلمة المرور",
            error: error.message,
        });
    }
};

// @desc    Update user permissions
// @route   PUT /api/users/:id/permissions
// @access  Private (Admin only)
export const updateUserPermissions = async (req, res) => {
    try {
        const { permissions } = req.body;

        if (!permissions || !Array.isArray(permissions)) {
            return res.status(400).json({
                success: false,
                message: "الصلاحيات مطلوبة ويجب أن تكون مصفوفة",
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "المستخدم غير موجود",
            });
        }

        // Check if user belongs to same organization
        if (user.organization.toString() !== req.user.organization.toString()) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية لتعديل صلاحيات هذا المستخدم",
            });
        }

        // Prevent removing admin permissions from yourself
        if (user._id.toString() === req.user._id.toString() && req.user.role === 'admin') {
            if (!permissions.includes('all') && !permissions.includes('users')) {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكنك إزالة صلاحيات الإدارة من حسابك الخاص",
                });
            }
        }

        user.permissions = permissions;
        await user.save();

        // Remove password from response
        user.password = undefined;

        res.json({
            success: true,
            message: "تم تحديث صلاحيات المستخدم بنجاح",
            data: user,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث صلاحيات المستخدم",
            error: error.message,
        });
    }
};

// @desc    Update user status
// @route   PUT /api/users/:id/status
// @access  Private (Admin only)
export const updateUserStatus = async (req, res) => {
    try {
        const { status } = req.body;

        if (!status || !['active', 'inactive', 'suspended'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "حالة المستخدم غير صحيحة",
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "المستخدم غير موجود",
            });
        }

        // Check if user belongs to same organization
        if (user.organization.toString() !== req.user.organization.toString()) {
            return res.status(403).json({
                success: false,
                message: "ليس لديك صلاحية لتعديل حالة هذا المستخدم",
            });
        }

        // Prevent deactivating yourself
        if (user._id.toString() === req.user._id.toString() && status !== 'active') {
            return res.status(400).json({
                success: false,
                message: "لا يمكنك تعطيل حسابك الخاص",
            });
        }

        user.status = status;
        await user.save();

        // Remove password from response
        user.password = undefined;

        res.json({
            success: true,
            message: "تم تحديث حالة المستخدم بنجاح",
            data: user,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث حالة المستخدم",
            error: error.message,
        });
    }
};