import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import Subscription from "../models/Subscription.js";
import { sendEmail } from "../utils/email.js";
import crypto from "crypto";

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || "7d",
    });
};

// Generate Refresh Token
const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRE || "30d",
    });
};

// دالة لتوحيد البريد الإلكتروني (إزالة النقاط من الجزء الأول)
function normalizeEmail(email) {
    if (!email) return "";
    return email.toLowerCase().trim();
}

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            role,
            permissions,
            businessName,
            businessType,
        } = req.body;
        const normalizedEmail = normalizeEmail(email);
        const userExists = await User.findOne({ email: normalizedEmail });
        if (userExists) {
            return res
                .status(400)
                .json({ success: false, message: "المستخدم موجود بالفعل" });
        }
        let user = null;
        let organization = null;
        const verificationToken = crypto.randomBytes(32).toString("hex");
        if (role === "owner") {
            user = await User.create({
                name,
                email: normalizedEmail,
                password,
                role: "admin",
                permissions: ["all"],
                status: "pending",
                verificationToken,
            });
            organization = await Organization.create({
                name: businessName,
                type: businessType,
                owner: user._id,
            });
            user.organization = organization._id;
            await user.save();
            // إضافة اشتراك وهمي تلقائي للمنشأة الجديدة
            await Subscription.create({
                organization: organization._id,
                plan: "yearly",
                status: "active",
                startDate: new Date(),
                endDate: new Date(2099, 0, 1),
                paymentMethod: "manual",
                paymentRef: "dummy",
                createdAt: new Date(),
            });
        } else {
            // إذا لم يتم تمرير organization، اربطه بنفس منشأة المستخدم الحالي (المدير)
            let orgId = req.body.organization;
            if (!orgId && req.user && req.user.organization) {
                orgId = req.user.organization;
            }
            // لا يسمح بإضافة مستخدم بدور owner من لوحة المدير
            let safeRole = role;
            if (role === "owner") {
                safeRole = "staff";
            }
            // توزيع الصلاحيات تلقائيًا حسب الدور
            let autoPermissions = [];
            if ((safeRole || "staff") === "admin") {
                autoPermissions = ["all"];
            } else if ((safeRole || "staff") === "staff") {
                autoPermissions = [
                    "playstation",
                    "computer",
                    "cafe",
                    "menu",
                    "billing",
                    "reports",
                    "inventory",
                    "costs",
                ];
            } else if ((safeRole || "staff") === "cashier") {
                autoPermissions = ["billing", "cafe"];
            } else if ((safeRole || "staff") === "kitchen") {
                autoPermissions = ["cafe"];
            }
            user = await User.create({
                name,
                email: normalizedEmail,
                password,
                role: safeRole || "staff",
                permissions:
                    permissions && permissions.length > 0
                        ? permissions
                        : autoPermissions,
                status: "pending",
                verificationToken,
                organization: orgId,
            });
        }
        // إرسال إيميل التفعيل
        const verificationUrl = `${
            process.env.FRONTEND_URL || "http://localhost:3000"
        }/verify-email?token=${verificationToken}`;
        try {
            await sendEmail({
                to: user.email,
                subject: "تفعيل حسابك - نظام Bomba",
                html: `<div dir="rtl"><h2>مرحباً ${user.name}</h2><p>يرجى تفعيل حسابك عبر الرابط التالي:</p><a href="${verificationUrl}" style="padding:10px 20px;background:#2563eb;color:#fff;border-radius:5px;text-decoration:none;">تفعيل الحساب</a></div>`,
            });
        } catch (emailError) {
            // إذا فشل الإرسال، احذف المستخدم والمنشأة (إن وجدت)
            if (user) await User.deleteOne({ _id: user._id });
            if (organization)
                await Organization.deleteOne({ _id: organization._id });
            return res.status(500).json({
                success: false,
                message:
                    "فشل إرسال رسالة التفعيل إلى بريدك الإلكتروني. يرجى المحاولة لاحقًا.",
                error: emailError.message,
            });
        }
        return res.status(201).json({
            success: true,
            message:
                "تم إرسال رابط التفعيل إلى بريدك الإلكتروني. يرجى تفعيل الحساب قبل تسجيل الدخول.",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في إنشاء المستخدم",
            error: error.message,
        });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedLoginEmail = normalizeEmail(email);
        let user = await User.findOne({ email: normalizedLoginEmail }).select(
            "+password"
        );
        if (!user) {
            const msg = { success: false, message: "بيانات الدخول غير صحيحة" };
            return res.status(401).json(msg);
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            const msg = { success: false, message: "بيانات الدخول غير صحيحة" };
            return res.status(401).json(msg);
        }
        if (user.status !== "active") {
            const msg = {
                success: false,
                message: "الحساب غير مفعل. يرجى تفعيل بريدك الإلكتروني أولاً.",
            };
            return res.status(401).json(msg);
        }
        await user.updateLastLogin();
        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        res.json({
            success: true,
            message: "تم تسجيل الدخول بنجاح",
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    permissions: user.permissions,
                    lastLogin: user.lastLogin,
                    organization: user.organization,
                },
                token,
                refreshToken,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تسجيل الدخول",
            error: error.message,
        });
    }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Public
export const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: "رمز التحديث مطلوب",
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET
        );
        const user = await User.findById(decoded.id).select("+refreshToken");

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(401).json({
                success: false,
                message: "رمز التحديث غير صحيح",
            });
        }

        // Generate new tokens
        const newToken = generateToken(user._id);
        const newRefreshToken = generateRefreshToken(user._id);

        // Update refresh token
        user.refreshToken = newRefreshToken;
        await user.save({ validateBeforeSave: false });

        res.json({
            success: true,
            data: {
                token: newToken,
                refreshToken: newRefreshToken,
            },
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: "رمز التحديث غير صحيح",
        });
    }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "يجب تسجيل الدخول أولاً",
            });
        }
        // Clear refresh token
        req.user.refreshToken = null;
        await req.user.save({ validateBeforeSave: false });

        res.json({
            success: true,
            message: "تم تسجيل الخروج بنجاح",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تسجيل الخروج",
            error: error.message,
        });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
    try {
        // استخراج التوكن من الهيدر
        const authHeader = req.headers.authorization;
        const token =
            authHeader && authHeader.startsWith("Bearer ")
                ? authHeader.split(" ")[1]
                : null;
        if (!token) {
            return res
                .status(401)
                .json({ success: false, message: "توكن مفقود" });
        }
        // تحقق من التوكن
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: "توكن غير صالح أو منتهي الصلاحية",
            });
        }
        const user = await User.findById(decoded.id);
        if (!user) {
            return res
                .status(401)
                .json({ success: false, message: "المستخدم غير موجود" });
        }
        res.json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    permissions: user.permissions,
                    lastLogin: user.lastLogin,
                    organization: user.organization,
                    status: user.status,
                },
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب بيانات المستخدم",
            error: error.message,
        });
    }
};

// @desc    Update password
// @route   PUT /api/auth/password
// @access  Private
export const updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user.id).select("+password");

        // Check current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
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
            message: "تم تحديث كلمة المرور بنجاح",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث كلمة المرور",
            error: error.message,
        });
    }
};

// @desc    Verify email
// @route   GET /api/auth/verify-email?token=...
// @access  Public
export const verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res
                .status(400)
                .json({ success: false, message: "رمز التفعيل مفقود" });
        }
        const user = await User.findOne({
            verificationToken: token,
            status: "pending",
        });
        if (!user) {
            const pendingUsers = await User.find({
                status: "pending",
                verificationToken: { $ne: null },
            }).select("email verificationToken");
            return res.status(400).json({
                success: false,
                message: "رابط التفعيل غير صالح أو الحساب مفعل بالفعل",
            });
        }
        user.status = "active";
        user.verificationToken = undefined;
        await user.save();
        return res.json({
            success: true,
            message: "تم تفعيل الحساب بنجاح. يمكنك الآن تسجيل الدخول.",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ أثناء تفعيل الحساب",
            error: error.message,
        });
    }
};
