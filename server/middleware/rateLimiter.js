import rateLimit from "express-rate-limit";

// General API rate limiter — LAN-first realtime app: several devices per IP NAT,
// socket-driven refetches and background polls add up; 2000 proved too tight
// (legit rush-hour traffic tripped 429s and retry storms). 6000 blocks real
// abuse floods while leaving headroom; auth routes stay strict below.
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000,
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
    max: 100,
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
    max: 100,
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
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "تم تجاوز الحد المسموح لإعادة تعيين كلمة المرور، حاول بعد ساعة",
    },
});
