import rateLimit from 'express-rate-limit';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'تم تجاوز الحد المسموح من الطلبات، حاول مرة أخرى لاحقاً'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for auth routes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'تم تجاوز الحد المسموح من محاولات تسجيل الدخول، حاول مرة أخرى بعد 15 دقيقة'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Create account limiter
export const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 account creation requests per hour
  message: {
    success: false,
    message: 'تم تجاوز الحد المسموح من إنشاء الحسابات، حاول مرة أخرى بعد ساعة'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset limiter
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    message: 'تم تجاوز الحد المسموح من طلبات إعادة تعيين كلمة المرور، حاول مرة أخرى بعد ساعة'
  },
  standardHeaders: true,
  legacyHeaders: false,
});