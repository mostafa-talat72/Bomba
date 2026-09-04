import mongoose from "mongoose";
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";

const OrganizationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: {
        type: String,
        enum: ["cafe", "restaurant", "playstation"],
        default: "cafe",
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    // معلومات المنشأة الأساسية
    description: { type: String, default: "" },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    website: { type: String, default: "" },

    // إعدادات العملة والمنطقة الزمنية
    currency: {
        type: String,
        enum: [
            // Africa
            'DZD', 'AOA', 'BWP', 'BIF', 'XAF', 'XOF', 'KMF', 'CDF', 'DJF', 'EGP', 
            'ERN', 'ETB', 'GMD', 'GHS', 'GNF', 'KES', 'LSL', 'LRD', 'LYD', 'MGA', 
            'MWK', 'MUR', 'MAD', 'MZN', 'NAD', 'NGN', 'RWF', 'STN', 'SCR', 'SLL', 
            'SOS', 'ZAR', 'SSP', 'SDG', 'SZL', 'TZS', 'TND', 'UGX', 'ZMW', 'ZWL', 'MRU',
            
            // Americas
            'ARS', 'AWG', 'BSD', 'BBD', 'BZD', 'BMD', 'BOB', 'BRL', 'CAD', 'KYD', 
            'CLP', 'COP', 'CRC', 'CUP', 'DOP', 'XCD', 'SVC', 'FKP', 'GTQ', 'GYD', 
            'HTG', 'HNL', 'JMD', 'MXN', 'NIO', 'PAB', 'PYG', 'PEN', 'SRD', 'TTD', 
            'USD', 'UYU', 'VES',
            
            // Asia
            'AFN', 'AMD', 'AZN', 'BHD', 'BDT', 'BTN', 'BND', 'KHR', 'CNY', 'GEL', 
            'HKD', 'INR', 'IDR', 'IRR', 'IQD', 'ILS', 'JPY', 'JOD', 'KZT', 'KWD', 
            'KGS', 'LAK', 'LBP', 'MOP', 'MYR', 'MVR', 'MNT', 'MMK', 'NPR', 'KPW', 
            'OMR', 'PKR', 'PHP', 'QAR', 'SAR', 'SGD', 'KRW', 'LKR', 'SYP', 'TWD', 
            'TJS', 'THB', 'TMT', 'AED', 'UZS', 'VND', 'YER',
            
            // Europe
            'ALL', 'EUR', 'BAM', 'BGN', 'HRK', 'CZK', 'DKK', 'GBP', 'HUF', 'ISK', 
            'CHF', 'MDL', 'MKD', 'NOK', 'PLN', 'RON', 'RUB', 'RSD', 'SEK', 'TRY', 
            'UAH', 'GIP', 'BYN',
            
            // Oceania
            'AUD', 'FJD', 'NZD', 'PGK', 'WST', 'SBD', 'TOP', 'VUV', 'XPF'
        ],
        default: "EGP"
    },
    timezone: {
        type: String,
        default: "Africa/Cairo"
    },

    // الروابط الاجتماعية
    socialLinks: {
        facebook: { type: String, default: "" },
        instagram: { type: String, default: "" },
        twitter: { type: String, default: "" },
        linkedin: { type: String, default: "" },
        youtube: { type: String, default: "" },
        tiktok: { type: String, default: "" },
        whatsapp: { type: String, default: "" },
        telegram: { type: String, default: "" },
        location: { type: String, default: "" }
    },

    // إعدادات الصلاحيات
    permissions: {
        allowManagersToEditOrganization: { type: Boolean, default: false },
        authorizedManagers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }],
        // صلاحيات إدارة المرتبات
        allowManagersToManagePayroll: { type: Boolean, default: false },
        authorizedPayrollManagers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }]
    },

    // إعدادات التقارير والإيميلات
    reportSettings: {
        dailyReportEnabled: { type: Boolean, default: true },
        dailyReportStartTime: { type: String, default: "08:00" }, // وقت بداية فترة التقرير (24 ساعة من هذا الوقت)
        dailyReportSendTime: { type: String, default: "09:00" }, // وقت إرسال التقرير عبر الإيميل
        dailyReportEmails: [{
            email: { type: String, required: true },
            language: {
                type: String,
                // Accept any valid ISO 639-1/639-2 language code (2-3 lowercase letters)
                validate: {
                    validator: function(v) {
                        return /^[a-z]{2,3}$/.test(v);
                    },
                    message: props => `${props.value} is not a valid language code!`
                },
                default: 'ar'
            }
        }], // قائمة الإيميلات المستقبلة مع اللغة المفضلة لكل مستلم
        lastReportSentAt: { type: Date }, // آخر مرة تم فيها إرسال التقرير اليومي
        lastMonthlyReportSentAt: { type: Date }, // آخر مرة تم فيها إرسال التقرير الشهري
        authorizedToManageReports: [{ // المستخدمون المصرح لهم بإدارة إعدادات التقارير
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }]
    },

    // إعدادات الطباعة
    printSettings: {
        printQRCode: { type: Boolean, default: true },
        printerType: { 
            type: String, 
            enum: ['none', 'usb', 'network', 'bluetooth'],
            default: 'none'
        },
        printerDevice: { type: String, default: '' }, // معرف الجهاز للطابعة
        printerIP: { type: String, default: '' }, // عنوان IP للطابعة الشبكية
        printerPort: { type: Number, default: 9100 }, // منفذ الطابعة الشبكية
        openCashDrawer: { type: Boolean, default: true }, // فتح درج الكاشير عند طباعة الفواتير
        openCashDrawerOnPayment: { type: Boolean, default: true }, // فتح درج الكاشير عند الدفع الكامل
        openCashDrawerShortcut: { type: Boolean, default: true }, // فتح درج الكاشير باختصار F12
        autoPrintOnPayment: { type: Boolean, default: true }, // طباعة الفاتورة تلقائياً عند الدفع الكامل
        promptOrderPrintSections: { type: Boolean, default: false }, // اختيار أقسام الطلب قبل الطباعة
        defaultOrderPrintSections: { type: [String], default: [] }, // الأقسام الافتراضية للطباعة
        autoPrintOrderSections: { type: Boolean, default: false }, // الطباعة المباشرة بالأقسام الافتراضية
        printers: [{
            id: { type: String, required: true },
            name: { type: String, required: true },
            printerName: { type: String, required: true },
            printerPath: { type: String, default: '' },
            paperWidthMm: { type: Number, default: 80, min: 30, max: 150 },
        }],
        sectionPrinterMap: { type: Map, of: String, default: {} },
        documentPrinterMap: { type: Map, of: String, default: {} },
        charactersPerLine: { type: Number, default: 48 }, // عدد الأحرف في السطر
        printHeader: { type: Boolean, default: true }, // طباعة الرأس
        printFooter: { type: Boolean, default: true }, // طباعة التذييل
        autoCut: { type: Boolean, default: false }, // قص تلقائي للورق
    },

    // تخزين معرفات الطابعات لكل جهاز/مستخدم (منفصل عن printSettings)
    devicePrinters: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        deviceId: { type: String }, // معرف الجهاز الفريد
        printerPath: { type: String }, // مسار الطابعة (e.g., COM1, /dev/usb/lp0)
        printerName: { type: String }, // اسم الطابعة
        lastUsed: { type: Date, default: Date.now }
    }],

    // معلومات إضافية
    logo: { type: String, default: "" },
    websiteUrl: { type: String, default: "" },
    workingHours: {
        monday: {
            open: String,
            close: String,
            closed: { type: Boolean, default: false },
            is24Hours: { type: Boolean, default: false }
        },
        tuesday: {
            open: String,
            close: String,
            closed: { type: Boolean, default: false },
            is24Hours: { type: Boolean, default: false }
        },
        wednesday: {
            open: String,
            close: String,
            closed: { type: Boolean, default: false },
            is24Hours: { type: Boolean, default: false }
        },
        thursday: {
            open: String,
            close: String,
            closed: { type: Boolean, default: false },
            is24Hours: { type: Boolean, default: false }
        },
        friday: {
            open: String,
            close: String,
            closed: { type: Boolean, default: false },
            is24Hours: { type: Boolean, default: false }
        },
        saturday: {
            open: String,
            close: String,
            closed: { type: Boolean, default: false },
            is24Hours: { type: Boolean, default: false }
        },
        sunday: {
            open: String,
            close: String,
            closed: { type: Boolean, default: false },
            is24Hours: { type: Boolean, default: false }
        }
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// تحديث updatedAt عند الحفظ
OrganizationSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

// Soft delete fields - isDeleted, deletedAt, deletedBy
OrganizationSchema.add({
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
});
// Apply sync middleware
applySyncMiddleware(OrganizationSchema, 'Organization');

export default mongoose.model("Organization", OrganizationSchema);