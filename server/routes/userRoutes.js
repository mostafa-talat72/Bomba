import express from "express";
import User from "../models/User.js";
import {
    getUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    updateProfile,
    changePassword,
    updateUserPermissions,
    updateUserStatus,
} from "../controllers/userController.js";
import { protect, authorize } from "../middleware/auth.js";
import {
    validateUserRegistration,
    validateRequest,
} from "../middleware/validation.js";

const router = express.Router();

// Profile routes (no special permissions needed)
router.use(protect);
router.put("/profile", updateProfile);
router.put("/change-password", changePassword);

// User management routes - Remove general authorization, handle it per route
router.route("/")
    .get((req, res, next) => {
        // تسجيل مؤقت لتشخيص المشكلة
       
        // Allow admins and users with users permission to view users
        if (req.user.role === 'admin' || req.user.hasPermission('users') || req.user.hasPermission('all')) {
            return next();
        }
        return res.status(403).json({
            success: false,
            message: 'ليس لديك صلاحية لعرض المستخدمين'
        });
    }, getUsers)
    .post((req, res, next) => {
        // تسجيل مؤقت لتشخيص المشكلة

        // Allow admins and users with users permission to create users
        if (req.user.role === 'admin' || req.user.hasPermission('users') || req.user.hasPermission('all')) {
            return next();
        }
        return res.status(403).json({
            success: false,
            message: 'ليس لديك صلاحية لإنشاء المستخدمين'
        });
    }, validateUserRegistration, validateRequest, createUser);

router.route("/:id")
    .get((req, res, next) => {
        // Allow admins and users with users permission to view user details
        if (req.user.role === 'admin' || req.user.hasPermission('users') || req.user.hasPermission('all')) {
            return next();
        }
        return res.status(403).json({
            success: false,
            message: 'ليس لديك صلاحية لعرض تفاصيل المستخدم'
        });
    }, getUser);

// Update route with special authorization (admin or users permission)
router.put("/:id", (req, res, next) => {
  
    // Allow admins to update users even without explicit users permission
    if (req.user.role === 'admin' || req.user.hasPermission('users') || req.user.hasPermission('all')) {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لتعديل المستخدمين'
    });
}, updateUser);

// Delete route with special authorization (admin or users permission)
router.delete("/:id", (req, res, next) => {
  
    // Allow admins to delete users even without explicit users permission
    if (req.user.role === 'admin' || req.user.hasPermission('users') || req.user.hasPermission('all')) {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لحذف المستخدمين'
    });
}, deleteUser);

// Additional user management routes
router.put("/:id/permissions", (req, res, next) => {
    // Allow admins and users with users permission to update permissions
    if (req.user.role === 'admin' || req.user.hasPermission('users') || req.user.hasPermission('all')) {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لتعديل صلاحيات المستخدمين'
    });
}, updateUserPermissions);

router.put("/:id/status", (req, res, next) => {
    // Allow admins and users with users permission to update status
    if (req.user.role === 'admin' || req.user.hasPermission('users') || req.user.hasPermission('all')) {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لتعديل حالة المستخدمين'
    });
}, updateUserStatus);

// @desc    Get user statistics
// @route   GET /api/users/stats/overview
// @access  Private (Admin)
router.get("/stats/overview", (req, res, next) => {
    // Allow admins and users with users permission to view stats
    if (req.user.role === 'admin' || req.user.hasPermission('users') || req.user.hasPermission('all')) {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لعرض إحصائيات المستخدمين'
    });
}, async (req, res) => {
    try {
        const query = { organization: req.user.organization };
        
        const totalUsers = await User.countDocuments(query);
        const activeUsers = await User.countDocuments({ ...query, status: "active" });
        const adminUsers = await User.countDocuments({ ...query, role: "admin" });
        const staffUsers = await User.countDocuments({ ...query, role: "staff" });

        // Recent logins (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const recentLogins = await User.countDocuments({
            ...query,
            lastLogin: { $gte: weekAgo },
        });

        res.json({
            success: true,
            data: {
                totalUsers,
                activeUsers,
                adminUsers,
                staffUsers,
                recentLogins,
                inactiveUsers: totalUsers - activeUsers,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب إحصائيات المستخدمين",
            error: error.message,
        });
    }
});

export default router;
