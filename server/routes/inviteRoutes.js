import express from "express";
import { protect } from "../middleware/auth.js";
import Invite from "../models/Invite.js";

const router = express.Router();

router.use(protect);

const checkUsersPermission = (req, res, next) => {
    if (
        req.user.role === "admin" ||
        req.user.hasPermission("users") ||
        req.user.hasPermission("all")
    ) {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: "ليس لديك صلاحية لإدارة الدعوات",
    });
};

router.post("/", checkUsersPermission, async (req, res) => {
    try {
        const { email, role, expiresInDays } = req.body;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 7));

        const invite = await Invite.create({
            organization: req.user.organization,
            createdBy: req.user._id,
            email: email || null,
            role: role || "staff",
            expiresAt,
        });

        res.status(201).json({
            success: true,
            data: invite,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في إنشاء الدعوة",
            error: error.message,
        });
    }
});

router.get("/", checkUsersPermission, async (req, res) => {
    try {
        const invites = await Invite.find({
            organization: req.user.organization,
            used: false,
            expiresAt: { $gt: new Date() },
        })
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: invites.length,
            data: invites,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الدعوات",
            error: error.message,
        });
    }
});

router.delete("/:id", checkUsersPermission, async (req, res) => {
    try {
        const invite = await Invite.findOne({
            _id: req.params.id,
            organization: req.user.organization,
        });

        if (!invite) {
            return res.status(404).json({
                success: false,
                message: "الدعوة غير موجودة",
            });
        }

        await invite.deleteOne();

        res.json({
            success: true,
            message: "تم حذف الدعوة بنجاح",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في حذف الدعوة",
            error: error.message,
        });
    }
});

export default router;
