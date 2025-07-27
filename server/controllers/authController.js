import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import Subscription from "../models/Subscription.js";
import { sendEmail } from "../utils/email.js";
import crypto from "crypto";
import Logger from "../middleware/logger.js";

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
        const { name, email, password, role, permissions, businessName } =
            req.body;
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
            Logger.info("Creating owner user", {
                name,
                email: normalizedEmail,
                businessName,
            });

            user = await User.create({
                name,
                email: normalizedEmail,
                password,
                role: "admin",
                permissions: ["all"],
                status: "pending",
                verificationToken,
            });

            Logger.info("User created successfully", {
                userId: user._id,
                email: user.email,
            });

            organization = await Organization.create({
                name: businessName,
                type: "cafe", // إضافة النوع المطلوب
                owner: user._id,
            });

            Logger.info("Organization created successfully", {
                organizationId: organization._id,
                organizationName: organization.name,
                ownerId: organization.owner,
            });

            user.organization = organization._id;
            await user.save();

            Logger.info("User linked to organization", {
                userId: user._id,
                organizationId: user.organization,
            });

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

            Logger.info("Subscription created for organization", {
                organizationId: organization._id,
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

        Logger.info("Attempting to send verification email", {
            to: user.email,
            verificationUrl: verificationUrl,
            frontendUrl: process.env.FRONTEND_URL,
        });

        try {
            await sendEmail({
                to: user.email,
                subject: "تفعيل حسابك - نظام Bomba",
                html: `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; color: white; text-align: center;">
                        <h1 style="margin: 0 0 20px 0; font-size: 24px;">مرحباً ${user.name}</h1>
                        <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6;">شكراً لك على التسجيل في نظام بومبا لإدارة المقهى</p>
                        <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6;">يرجى تفعيل حسابك عبر الرابط التالي:</p>
                        <a href="${verificationUrl}" style="display: inline-block; padding: 15px 30px; background: #ffffff; color: #667eea; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; transition: all 0.3s ease;">تفعيل الحساب</a>
                    </div>
                    <div style="margin-top: 20px; text-align: center; color: #666; font-size: 14px;">
                        <p>إذا لم تطلب هذا الحساب، يمكنك تجاهل هذا البريد الإلكتروني.</p>
                        <p>رابط التفعيل صالح لمدة 24 ساعة فقط.</p>
                    </div>
                </div>`,
            });

            Logger.info("Verification email sent successfully", {
                userId: user._id,
                email: user.email,
                organizationId: organization?._id,
            });
        } catch (emailError) {
            Logger.error("Failed to send verification email", {
                userId: user._id,
                email: user.email,
                error: emailError.message,
                stack: emailError.stack,
            });

            // لا نحذف المستخدم عند فشل الإيميل، فقط نرسل رسالة خطأ
            return res.status(500).json({
                success: false,
                message:
                    "تم إنشاء الحساب بنجاح ولكن فشل إرسال رسالة التفعيل. يرجى التواصل مع الإدارة لتفعيل الحساب.",
                error: emailError.message,
            });
        }
        return res.status(201).json({
            success: true,
            message:
                "تم إرسال رابط التفعيل إلى بريدك الإلكتروني. يرجى تفعيل الحساب قبل تسجيل الدخول.",
        });

        Logger.info("Registration process completed successfully", {
            userId: user._id,
            email: user.email,
            organizationId: organization?._id,
            role: role,
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

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
export const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;
        const normalizedEmail = normalizeEmail(email);

        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "البريد الإلكتروني غير موجود في النظام",
            });
        }

        if (user.status === "active") {
            return res.status(400).json({
                success: false,
                message: "الحساب مفعل بالفعل",
            });
        }

        // Generate new verification token
        const verificationToken = crypto.randomBytes(32).toString("hex");
        user.verificationToken = verificationToken;
        await user.save();

        // Send verification email
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

        try {
            await sendEmail({
                to: user.email,
                subject: "إعادة إرسال رابط التفعيل - نظام Bomba",
                html: `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; color: white; text-align: center;">
                        <h1 style="margin: 0 0 20px 0; font-size: 24px;">مرحباً ${user.name}</h1>
                        <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6;">تم إعادة إرسال رابط التفعيل لحسابك في نظام بومبا</p>
                        <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6;">يرجى تفعيل حسابك عبر الرابط التالي:</p>
                        <a href="${verificationUrl}" style="display: inline-block; padding: 15px 30px; background: #ffffff; color: #667eea; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; transition: all 0.3s ease;">تفعيل الحساب</a>
                    </div>
                    <div style="margin-top: 20px; text-align: center; color: #666; font-size: 14px;">
                        <p>إذا لم تطلب هذا الحساب، يمكنك تجاهل هذا البريد الإلكتروني.</p>
                        <p>رابط التفعيل صالح لمدة 24 ساعة فقط.</p>
                    </div>
                </div>`,
            });

            Logger.info("Verification email resent successfully", {
                userId: user._id,
                email: user.email,
            });

            res.json({
                success: true,
                message: "تم إرسال رابط التفعيل إلى بريدك الإلكتروني",
            });
        } catch (emailError) {
            Logger.error("Failed to resend verification email", {
                userId: user._id,
                email: user.email,
                error: emailError.message,
                stack: emailError.stack,
            });

            return res.status(500).json({
                success: false,
                message: "فشل إرسال رسالة التفعيل. يرجى المحاولة لاحقاً.",
                error: emailError.message,
            });
        }
    } catch (error) {
        Logger.error("Error in resendVerification", {
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({
            success: false,
            message: "خطأ في إعادة إرسال رابط التفعيل",
            error: error.message,
        });
    }
};

// @desc    Request password reset
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const normalizedEmail = normalizeEmail(email);

        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "البريد الإلكتروني غير موجود في النظام",
            });
        }

        // Allow all users to reset their password
        // No role restriction needed

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString("hex");
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        // Send reset email
        const resetUrl = `${
            process.env.FRONTEND_URL
        }/reset-password?token=${resetToken}&email=${encodeURIComponent(
            user.email
        )}`;

        try {
            await sendEmail({
                to: user.email,
                subject: "إعادة تعيين كلمة المرور - نظام Bomba",
                html: `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; color: white; text-align: center;">
                        <h1 style="margin: 0 0 20px 0; font-size: 24px;">مرحباً ${user.name}</h1>
                        <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6;">تم طلب إعادة تعيين كلمة المرور لحسابك في نظام بومبا</p>
                        <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6;">إذا لم تطلب هذا، يمكنك تجاهل هذا البريد الإلكتروني.</p>
                        <a href="${resetUrl}" style="display: inline-block; padding: 15px 30px; background: #ffffff; color: #667eea; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; transition: all 0.3s ease;">إعادة تعيين كلمة المرور</a>
                    </div>
                    <div style="margin-top: 20px; text-align: center; color: #666; font-size: 14px;">
                        <p>هذا الرابط صالح لمدة 10 دقائق فقط.</p>
                        <p>إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد الإلكتروني.</p>
                    </div>
                </div>`,
            });

            Logger.info("Password reset email sent successfully", {
                userId: user._id,
                email: user.email,
            });

            res.json({
                success: true,
                message:
                    "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني",
            });
        } catch (emailError) {
            Logger.error("Failed to send password reset email", {
                userId: user._id,
                email: user.email,
                error: emailError.message,
                stack: emailError.stack,
            });

            return res.status(500).json({
                success: false,
                message:
                    "فشل إرسال رسالة إعادة تعيين كلمة المرور. يرجى المحاولة لاحقاً.",
                error: emailError.message,
            });
        }
    } catch (error) {
        Logger.error("Error in forgotPassword", {
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({
            success: false,
            message: "خطأ في طلب إعادة تعيين كلمة المرور",
            error: error.message,
        });
    }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
    try {
        const { token, password, email } = req.body;

        if (!token || !password) {
            return res.status(400).json({
                success: false,
                message: "الرمز وكلمة المرور الجديدة مطلوبان",
            });
        }

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpire: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "الرمز غير صحيح أو منتهي الصلاحية",
            });
        }

        // التحقق من أن البريد الإلكتروني يتطابق مع التوكن
        if (email && user.email !== email) {
            return res.status(400).json({
                success: false,
                message: "البريد الإلكتروني لا يتطابق مع الرابط المرسل",
            });
        }

        // Set new password
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        Logger.info("Password reset successfully", {
            userId: user._id,
            email: user.email,
        });

        res.json({
            success: true,
            message: "تم تغيير كلمة المرور بنجاح",
        });
    } catch (error) {
        Logger.error("Error in resetPassword", {
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({
            success: false,
            message: "خطأ في إعادة تعيين كلمة المرور",
            error: error.message,
        });
    }
};
