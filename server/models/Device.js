import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "اسم الجهاز مطلوب"],
            trim: true,
        },
        number: {
            type: String,
            required: [true, "رقم الجهاز مطلوب"],
            // إزالة unique: true لأن الفهرس المركب سيتولى هذا الأمر
        },
        type: {
            type: String,
            enum: ["playstation", "computer"],
            default: "playstation",
            required: true,
        },
        status: {
            type: String,
            enum: ["available", "active", "maintenance"],
            default: "available",
            required: true,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        controllers: {
            type: Number,
            default: 2,
            min: [1, "عدد الدراعات يجب أن يكون 1 على الأقل"],
            max: [4, "عدد الدراعات لا يمكن أن يتجاوز 4"],
        },
        // سعر الساعة للكمبيوتر
        hourlyRate: {
            type: Number,
            min: 0,
            default: 15, // قيمة افتراضية 15 جنيه/ساعة
            required: function () {
                return this.type === "computer";
            },
        },
        // أسعار الساعة لكل عدد دراعات للبلايستيشن
        playstationRates: {
            type: Object,
            required: function () {
                return this.type === "playstation";
            },
            // مثال: { '1': 20, '2': 20, '3': 25, '4': 30 }
            default: undefined,
            validate: {
                validator: function(value) {
                    if (this.type === "playstation" && value) {
                        // التحقق من أن القيم أرقام موجبة
                        return Object.values(value).every(rate => 
                            typeof rate === 'number' && rate > 0
                        );
                    }
                    return true;
                },
                message: 'أسعار البلايستيشن يجب أن تكون أرقام موجبة'
            }
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for faster queries
deviceSchema.index({ status: 1, organization: 1 }); // للبحث عن الأجهزة المتاحة
deviceSchema.index({ type: 1, organization: 1 }); // للبحث حسب النوع
deviceSchema.index({ number: 1, organization: 1 }, { unique: true }); // رقم الجهاز فريد لكل منظمة

// Middleware to generate number with prefix before saving
deviceSchema.pre("save", function (next) {
    // منع حفظ أجهزة فارغة نهائياً
    if (!this.name || this.name.trim() === '') {
        const error = new Error("اسم الجهاز مطلوب ولا يمكن أن يكون فارغاً");
        console.error(`❌ Prevented saving device without name:`, this.toObject());
        return next(error);
    }
    
    if (!this.organization) {
        const error = new Error("معرف المنظمة مطلوب");
        console.error(`❌ Prevented saving device without organization:`, this.toObject());
        return next(error);
    }

    // التحقق من الحقول المطلوبة الأساسية
    if (this.isNew) {
        if (!this.status) {
            this.status = 'available'; // قيمة افتراضية
        }
        if (!this.type) {
            this.type = 'playstation'; // قيمة افتراضية
        }
    }

    // إصلاح hourlyRate للكمبيوترات إذا كان مفقود
    if (this.type === "computer" && (!this.hourlyRate || this.hourlyRate <= 0)) {
        this.hourlyRate = 15; // القيمة الافتراضية
    }
    
    // إصلاح playstationRates للبلايستيشن إذا كان مفقود
    if (this.type === "playstation" && (!this.playstationRates || Object.keys(this.playstationRates).length === 0)) {
        this.playstationRates = {
            '1': 20,
            '2': 20,
            '3': 25,
            '4': 30
        };
    }

    if (this.isNew || this.isModified("number") || this.isModified("type")) {
        // إذا لم يكن هناك رقم، أنشئ واحد تلقائياً
        if (!this.number) {
            // البحث عن أعلى رقم موجود للنوع
            return Device.find({ 
                type: this.type, 
                organization: this.organization 
            })
            .sort({ number: -1 })
            .limit(1)
            .then(devices => {
                let nextNumber = 1;
                if (devices.length > 0) {
                    const lastNumber = devices[0].number;
                    const numericPart = lastNumber.replace(/[^0-9]/g, '');
                    nextNumber = parseInt(numericPart) + 1;
                }
                
                const prefix = this.type === "playstation" ? "ps" : "pc";
                this.number = `${prefix}${nextNumber}`;
                next();
            })
            .catch(next);
        }

        // If number is already a string with prefix, don't modify it
        if (
            typeof this.number === "string" &&
            (this.number.startsWith("ps") || this.number.startsWith("pc"))
        ) {
            return next();
        }

        // Extract the numeric part if it's a string
        const numericPart =
            typeof this.number === "string"
                ? this.number.replace(/[^0-9]/g, "")
                : this.number.toString();

        // Validate that we have a valid number
        if (!numericPart || parseInt(numericPart) <= 0) {
            return next(new Error("رقم الجهاز يجب أن يكون أكبر من 0"));
        }

        // Add prefix based on type
        const prefix = this.type === "playstation" ? "ps" : "pc";
        this.number = `${prefix}${numericPart}`;
    }
    next();
});

// Apply sync middleware with enhanced validation
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";
applySyncMiddleware(deviceSchema);

// Static method to fix devices with missing required fields
deviceSchema.statics.fixMissingFields = async function() {
    try {
        // حذف الأجهزة المعطوبة التي لا تحتوي على الحقول الأساسية
        const brokenDevicesDeleted = await this.deleteMany({
            $or: [
                { name: { $exists: false } },
                { name: null },
                { name: '' },
                { organization: { $exists: false } },
                { organization: null }
            ]
        });


        // Fix computer devices without hourlyRate
        const computerDevicesFixed = await this.updateMany(
            {
                type: 'computer',
                name: { $exists: true, $ne: null, $ne: '' },
                organization: { $exists: true, $ne: null },
                $or: [
                    { hourlyRate: { $exists: false } },
                    { hourlyRate: null },
                    { hourlyRate: { $lte: 0 } }
                ]
            },
            {
                $set: { hourlyRate: 15 }
            }
        );

        // Fix PlayStation devices without playstationRates
        const psDevicesFixed = await this.updateMany(
            {
                type: 'playstation',
                name: { $exists: true, $ne: null, $ne: '' },
                organization: { $exists: true, $ne: null },
                $or: [
                    { playstationRates: { $exists: false } },
                    { playstationRates: null }
                ]
            },
            {
                $set: {
                    playstationRates: {
                        '1': 20,
                        '2': 20,
                        '3': 25,
                        '4': 30
                    }
                }
            }
        );

        return {
            brokenDeleted: brokenDevicesDeleted.deletedCount,
            computersFixed: computerDevicesFixed.modifiedCount,
            playstationsFixed: psDevicesFixed.modifiedCount
        };
    } catch (error) {
        console.error('Error fixing devices:', error);
        return { brokenDeleted: 0, computersFixed: 0, playstationsFixed: 0 };
    }
};

const Device = mongoose.model("Device", deviceSchema);

// Auto-fix devices on startup (non-blocking)
setImmediate(() => {
    Device.fixMissingFields().catch(err => {
        console.error('Failed to auto-fix devices on startup:', err);
    });
});

// Clean up broken devices every 30 seconds (temporary solution)
const cleanupInterval = setInterval(async () => {
    try {
        const result = await Device.deleteMany({
            $or: [
                { name: { $exists: false } },
                { name: null },
                { name: '' },
                { organization: { $exists: false } },
                { organization: null }
            ]
        });
        
    } catch (error) {
        console.error('Error in device cleanup:', error);
    }
}, 30000); // كل 30 ثانية

// Clear interval after 10 minutes to avoid permanent cleanup
setTimeout(() => {
    clearInterval(cleanupInterval);
}, 600000); // 10 دقائق

export default Device;
