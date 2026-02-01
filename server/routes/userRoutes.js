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

// User management routes (require users permission)
router.use(authorize("users", "all"));

router.route("/")
    .get(getUsers)
    .post(validateUserRegistration, validateRequest, createUser);

router.route("/:id")
    .get(getUser)
    .put(updateUser)
    .delete(deleteUser);

// @desc    Get user statistics
// @route   GET /api/users/stats/overview
// @access  Private (Admin)
router.get("/stats/overview", async (req, res) => {
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
