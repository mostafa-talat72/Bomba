import { body, validationResult } from "express-validator";

export const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: "بيانات غير صحيحة",
            errors: errors.array().map((error) => ({
                field: error.path,
                message: error.msg,
                value: error.value,
            })),
        });
    }
    next();
};

// دالة للاستخدام كدالة عادية (بدون middleware)
export const validateRequestData = (req) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return {
            isValid: false,
            errors: errors.array().map((error) => ({
                field: error.path,
                message: error.msg,
                value: error.value,
            })),
        };
    }

    return {
        isValid: true,
        errors: [],
    };
};

// User validation rules
export const validateUserRegistration = [
    body("name")
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage("الاسم يجب أن يكون بين 2 و 50 حرف"),
    body("email")
        .isEmail()
        .normalizeEmail()
        .withMessage("البريد الإلكتروني غير صحيح"),
    body("password")
        .isLength({ min: 6 })
        .withMessage("كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
    body("role")
        .optional()
        .isIn(["admin", "staff", "cashier", "kitchen"])
        .withMessage("الدور غير صحيح"),
    body("status")
        .optional()
        .isIn(["active", "inactive", "suspended"])
        .withMessage("حالة المستخدم غير صحيحة"),
    body("phone")
        .optional()
        .trim()
        .isLength({ max: 20 })
        .withMessage("رقم الهاتف يجب أن يكون أقل من 20 حرف"),
    body("address")
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage("العنوان يجب أن يكون أقل من 200 حرف"),
    body("permissions")
        .optional()
        .isArray()
        .withMessage("الصلاحيات يجب أن تكون مصفوفة"),
];

export const validateUserLogin = [
    body("email")
        .isEmail()
        .normalizeEmail()
        .withMessage("البريد الإلكتروني غير صحيح"),
    body("password").notEmpty().withMessage("كلمة المرور مطلوبة"),
];

// Session validation rules
export const validateSession = [
    body("device")
        .isIn(["playstation", "computer"])
        .withMessage("نوع الجهاز غير صحيح"),
    body("deviceNumber")
        .isInt({ min: 1 })
        .withMessage("رقم الجهاز يجب أن يكون رقم صحيح أكبر من 0"),
    body("controllers")
        .optional()
        .isInt({ min: 1, max: 4 })
        .withMessage("عدد الدراعات يجب أن يكون بين 1 و 4"),
];

// Order validation rules
export const validateOrder = [
    body("tableNumber")
        .optional()
        .isInt({ min: 1 })
        .withMessage("رقم الطاولة يجب أن يكون رقم صحيح أكبر من 0"),
    body("customerName")
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage("اسم العميل يجب أن يكون بين 1 و 100 حرف"),
    body("customerPhone")
        .optional()
        .trim()
        .isLength({ min: 1, max: 20 })
        .withMessage("رقم الهاتف يجب أن يكون بين 1 و 20 حرف"),
    body("items")
        .isArray({ min: 1 })
        .withMessage("يجب أن يحتوي الطلب على عنصر واحد على الأقل"),
    body("items.*.name").trim().notEmpty().withMessage("اسم المنتج مطلوب"),
    body("items.*.price")
        .isFloat({ min: 0 })
        .withMessage("سعر المنتج يجب أن يكون رقم موجب"),
    body("items.*.quantity")
        .isInt({ min: 1 })
        .withMessage("الكمية يجب أن تكون رقم صحيح أكبر من 0"),
    body("items.*.notes")
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage("ملاحظات العنصر يجب أن تكون أقل من 200 حرف"),
    body("items.*.addons")
        .optional()
        .isArray()
        .withMessage("الإضافات يجب أن تكون مصفوفة"),
    body("items.*.addons.*.name")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("اسم الإضافة مطلوب"),
    body("items.*.addons.*.price")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("سعر الإضافة يجب أن يكون رقم موجب"),
    body("notes")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("ملاحظات الطلب يجب أن تكون أقل من 500 حرف"),
    body("bill").optional().isMongoId().withMessage("معرف الفاتورة غير صحيح"),
];

// Order update validation rules (more flexible for updates)
export const validateOrderUpdate = [
    body("tableNumber")
        .optional()
        .isInt({ min: 1 })
        .withMessage("رقم الطاولة يجب أن يكون رقم صحيح أكبر من 0"),
    body("customerName")
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage("اسم العميل يجب أن يكون بين 1 و 100 حرف"),
    body("customerPhone")
        .optional()
        .trim()
        .isLength({ min: 1, max: 20 })
        .withMessage("رقم الهاتف يجب أن يكون بين 1 و 20 حرف"),
    body("items")
        .optional()
        .isArray({ min: 1 })
        .withMessage("يجب أن يحتوي الطلب على عنصر واحد على الأقل"),
    body("items.*.name")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("اسم المنتج مطلوب"),
    body("items.*.price")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("سعر المنتج يجب أن يكون رقم موجب"),
    body("items.*.quantity")
        .optional()
        .isInt({ min: 1 })
        .withMessage("الكمية يجب أن تكون رقم صحيح أكبر من 0"),
    body("items.*.notes")
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage("ملاحظات العنصر يجب أن تكون أقل من 200 حرف"),
    body("items.*.menuItem")
        .optional()
        .isMongoId()
        .withMessage("معرف عنصر القائمة غير صحيح"),
    body("notes")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("ملاحظات الطلب يجب أن تكون أقل من 500 حرف"),
    body("status")
        .optional()
        .isIn(["pending", "preparing", "ready", "delivered", "cancelled"])
        .withMessage("حالة الطلب غير صحيحة"),
];

// Inventory validation rules
export const validateInventoryItem = [
    body("name").trim().notEmpty().withMessage("اسم المنتج مطلوب"),
    body("category")
        .isIn([
            "مشروبات ساخنة",
            "مشروبات باردة",
            "طعام",
            "حلويات",
            "مواد خام",
            "أخرى",
        ])
        .withMessage("فئة المنتج غير صحيحة"),
    body("currentStock")
        .isFloat({ min: 0 })
        .withMessage("المخزون الحالي يجب أن يكون رقم موجب"),
    body("minStock")
        .isFloat({ min: 0 })
        .withMessage("الحد الأدنى للمخزون يجب أن يكون رقم موجب"),
    body("price").isFloat({ min: 0 }).withMessage("السعر يجب أن يكون رقم موجب"),
    body("unit")
        .isIn(["قطعة", "كيلو", "جرام", "لتر", "مل", "علبة", "كيس", "زجاجة"])
        .withMessage("وحدة القياس غير صحيحة"),
];

// Cost validation rules
export const validateCost = [
    body("category")
        .notEmpty()
        .withMessage("فئة التكلفة مطلوبة")
        .isMongoId()
        .withMessage("معرف القسم غير صحيح"),
    body("description").trim().notEmpty().withMessage("وصف التكلفة مطلوب"),
    body("amount")
        .isFloat({ min: 0 })
        .withMessage("المبلغ يجب أن يكون رقم موجب"),
    body("date").isISO8601().withMessage("تاريخ غير صحيح"),
];
