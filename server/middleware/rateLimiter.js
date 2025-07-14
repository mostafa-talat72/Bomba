import rateLimit from "express-rate-limit";

// General API rate limiter (مفتوح العدد)
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: Infinity, // لا يوجد حد للطلبات
    handler: (req, res, next) => next(), // لا تمنع أي طلب
    skip: () => true, // تخطى دائماً
});

// Strict rate limiter for auth routes (مفتوح العدد)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Infinity,
    handler: (req, res, next) => next(),
    skip: () => true,
});

// Create account limiter (مفتوح العدد)
export const createAccountLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: Infinity,
    handler: (req, res, next) => next(),
    skip: () => true,
});

// Password reset limiter (مفتوح العدد)
export const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: Infinity,
    handler: (req, res, next) => next(),
    skip: () => true,
});
