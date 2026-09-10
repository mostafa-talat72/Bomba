import rateLimit from "express-rate-limit";

// General API rate limiter — LAN-first app: dashboard polls every 30s and every
// socket event refetches several lists, so rush hour on one device exceeds 500.
// 2000 still blocks abuse floods; auth routes stay strict below.
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "تم تجاوز الحد المسموح للطلبات، حاول بعد 15 دقيقة",
    },
});

// Strict rate limiter for auth routes (login)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "محاولات كثيرة جدًا، حاول بعد 15 دقيقة",
    },
});

// Create account limiter
export const createAccountLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "تم تجاوز الحد المسموح لإنشاء الحسابات، حاول بعد ساعة",
    },
});

// Password reset limiter
export const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "تم تجاوز الحد المسموح لإعادة تعيين كلمة المرور، حاول بعد ساعة",
    },
});
