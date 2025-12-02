import mongoose from "mongoose";
import Device from "./Device.js";

const sessionSchema = new mongoose.Schema(
    {
        deviceNumber: {
            type: String,
            required: [true, "رقم الجهاز مطلوب"],
        },
        deviceName: {
            type: String,
            required: [true, "اسم الجهاز مطلوب"],
        },
        deviceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Device",
            required: [true, "معرف الجهاز مطلوب"],
        },
        deviceType: {
            type: String,
            enum: ["playstation", "computer"],
            required: true,
        },
        table: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Table",
            required: false,
            default: null,
        },
        customerName: {
            type: String,
            trim: true,
        },
        startTime: {
            type: Date,
            default: Date.now,
            required: true,
        },
        endTime: {
            type: Date,
        },
        status: {
            type: String,
            enum: ["active", "completed", "cancelled"],
            default: "active",
            required: true,
        },
        controllers: {
            type: Number,
            default: 1,
            min: 1,
            max: 4,
        },
        controllersHistory: [
            {
                controllers: {
                    type: Number,
                    required: true,
                    min: 1,
                    max: 4,
                },
                from: {
                    type: Date,
                    required: true,
                },
                to: {
                    type: Date,
                },
            },
        ],
        totalCost: {
            type: Number,
            default: 0,
        },
        discount: {
            type: Number,
            default: 0,
            min: 0,
        },
        finalCost: {
            type: Number,
            default: 0,
        },
        notes: {
            type: String,
            trim: true,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        bill: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bill",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
sessionSchema.index({ deviceNumber: 1, status: 1 });
sessionSchema.index({ status: 1 });
// Indexes for better query performance
sessionSchema.index({ startTime: -1 });
sessionSchema.index({ status: 1, organization: 1 }); // للبحث عن الجلسات النشطة
sessionSchema.index({ deviceNumber: 1, status: 1 }); // للتحقق من استخدام الجهاز
sessionSchema.index({ bill: 1 }); // للربط مع الفواتير
sessionSchema.index({ table: 1 }); // للربط مع الطاولات
sessionSchema.index({ organization: 1, createdAt: -1 }); // للتقارير

// Middleware to initialize controllersHistory on new session
sessionSchema.pre("save", function (next) {
    if (this.isNew && this.controllersHistory.length === 0) {
        this.controllersHistory.push({
            controllers: this.controllers,
            from: this.startTime,
            to: null,
        });
    }
    next();
});

// Helper function to round cost to nearest pound
const roundToNearestPound = (cost) => {
    if (cost <= 0) return 0;
    return Math.round(cost); // تقريب لأقرب جنيه صحيح
};

// دالة لحساب سعر الساعة للبلايستيشن
function getPlayStationHourlyRate(controllers) {
    if (controllers === 1 || controllers === 2) return 20;
    if (controllers === 3) return 25;
    if (controllers === 4) return 30;
    return 20;
}

// تعديل دالة حساب التكلفة لتستخدم الأسعار من بيانات الجهاز
sessionSchema.methods.calculateCost = async function () {
    
    // جلب بيانات الجهاز من قاعدة البيانات باستخدام deviceId
    const device = await Device.findById(this.deviceId);
    if (!device) {
        console.error('❌ Device not found for deviceId:', this.deviceId);
        throw new Error("لم يتم العثور على بيانات الجهاز لحساب التكلفة");
    }
    
   
    const getRate = (controllers) => {
        if (device.type === "playstation" && device.playstationRates) {
            return device.playstationRates.get(String(controllers)) || 0;
        } else if (device.type === "computer") {
            return device.hourlyRate || 0;
        }
        return 0;
    };
    if (!this.controllersHistory || this.controllersHistory.length === 0) {
        // If no history, calculate based on total session duration
        if (this.startTime && this.endTime) {
            const durationMs =
                new Date(this.endTime) - new Date(this.startTime);
            const minutes = durationMs / (1000 * 60);
            const hourlyRate = getRate(this.controllers);
            const minuteRate = hourlyRate / 60;
            const rawCost = minutes * minuteRate;
            
            // التقريب المخصص: إذا كان >= 0.5 ساعة، نقرب لأعلى، وإلا نبقيها كما هي
            const hours = minutes / 60;
            const fractionalPart = hours - Math.floor(hours);
            
            if (fractionalPart >= 0.5) {
                this.totalCost = Math.ceil(rawCost);
            } else {
                this.totalCost = Math.round(rawCost);
            }
        } else {
            this.totalCost = 0;
        }
        this.finalCost = this.totalCost - (this.discount || 0);
        return this.finalCost;
    }
    let total = 0;
    let hasValidPeriods = false;
    for (const period of this.controllersHistory) {
        let periodEnd = period.to;
        if (!periodEnd) {
            periodEnd = this.endTime || new Date();
        }
        if (period.from && periodEnd) {
            const durationMs = new Date(periodEnd) - new Date(period.from);
            const minutes = durationMs / (1000 * 60);
            if (minutes > 0) {
                hasValidPeriods = true;
                const hourlyRate = getRate(period.controllers);
                const minuteRate = hourlyRate / 60;
                const rawPeriodCost = minutes * minuteRate;
                // لا نقرب هنا، نجمع التكلفة الخام
                total += rawPeriodCost;
            }
        }
    }
    // If no valid periods found, calculate based on total session duration
    if (!hasValidPeriods && this.startTime && this.endTime) {
        const durationMs = new Date(this.endTime) - new Date(this.startTime);
        const minutes = durationMs / (1000 * 60);
        const hourlyRate = getRate(this.controllers);
        const minuteRate = hourlyRate / 60;
        const rawCost = minutes * minuteRate;
        total = rawCost; // لا نقرب هنا أيضاً
    }
    // Ensure minimum cost for very short sessions (less than 1 minute)
    if (total === 0 && this.startTime && this.endTime) {
        const durationMs = new Date(this.endTime) - new Date(this.startTime);
        const minutes = durationMs / (1000 * 60);
        if (minutes > 0) {
            const hourlyRate = getRate(this.controllers);
            const minuteRate = hourlyRate / 60;
            const rawCost = minutes * minuteRate;
            total = rawCost; // لا نقرب هنا أيضاً
        }
    }
    // التقريب المخصص: إذا كان >= 0.5 ساعة، نقرب لأعلى، وإلا نبقيها كما هي
    const hours = total / (getRate(this.controllers) || 1);
    const fractionalPart = hours - Math.floor(hours);
    
    if (fractionalPart >= 0.5) {
        // إذا كانت الساعات >= 0.5، نقرب لأعلى
        this.totalCost = Math.ceil(total);
    } else {
        // إذا كانت أقل من 0.5، نبقيها كما هي
        this.totalCost = Math.round(total);
    }
    
    this.finalCost = this.totalCost - (this.discount || 0);
    
    // Mark fields as modified to ensure they are saved
    this.markModified('totalCost');
    this.markModified('finalCost');
    
    return this.finalCost;
};

// Update controllers during active session
sessionSchema.methods.updateControllers = function (newControllers) {
    if (this.status !== "active") {
        throw new Error("لا يمكن تعديل عدد الدراعات في جلسة غير نشطة");
    }

    if (newControllers < 1 || newControllers > 4) {
        throw new Error("عدد الدراعات يجب أن يكون بين 1 و 4");
    }

    // Close current period
    if (this.controllersHistory.length > 0) {
        const currentPeriod =
            this.controllersHistory[this.controllersHistory.length - 1];
        if (!currentPeriod.to) {
            currentPeriod.to = new Date();
        }
    }

    // Add new period
    this.controllersHistory.push({
        controllers: newControllers,
        from: new Date(),
        to: null,
    });

    this.controllers = newControllers;
    return this;
};

// End session
sessionSchema.methods.endSession = async function () {
    if (this.status !== "active") {
        throw new Error("الجلسة غير نشطة");
    }

    this.status = "completed";
    this.endTime = new Date();

    // Close all open periods in controllersHistory
    if (this.controllersHistory && this.controllersHistory.length > 0) {
        for (const period of this.controllersHistory) {
            if (!period.to) {
                period.to = this.endTime;
            }
        }
    } else {
        // If no controllersHistory exists, create one based on the session

        this.controllersHistory = [
            {
                controllers: this.controllers,
                from: this.startTime,
                to: this.endTime,
            },
        ];
    }

    // Calculate final cost
    await this.calculateCost();
    
    
    return this;
};

// Calculate current cost for active sessions (async version using device rates from DB)
sessionSchema.methods.calculateCurrentCost = async function () {
    if (this.status !== "active") {
        return this.totalCost;
    }

    // Fetch device data from database
    const device = await Device.findById(this.deviceId);
    if (!device) {
        throw new Error("لم يتم العثور على بيانات الجهاز لحساب التكلفة");
    }

    const getRate = (controllers) => {
        if (device.type === "playstation" && device.playstationRates) {
            return device.playstationRates.get(String(controllers)) || 0;
        } else if (device.type === "computer") {
            return device.hourlyRate || 0;
        }
        return 0;
    };

    const now = new Date();
    let total = 0;

    // If no controllersHistory, calculate based on total duration
    if (!this.controllersHistory || this.controllersHistory.length === 0) {
        const durationMs = now - new Date(this.startTime);
        const minutes = durationMs / (1000 * 60);
        const hourlyRate = getRate(this.controllers);
        const minuteRate = hourlyRate / 60;
        const rawCost = minutes * minuteRate;
        total = rawCost;
    } else {
        // Calculate based on controllersHistory
        for (const period of this.controllersHistory) {
            let periodEnd = period.to;
            if (!periodEnd) {
                periodEnd = now; // Use current time for open periods
            }

            if (period.from && periodEnd) {
                const durationMs = new Date(periodEnd) - new Date(period.from);
                const minutes = durationMs / (1000 * 60);

                if (minutes > 0) {
                    const hourlyRate = getRate(period.controllers);
                    const minuteRate = hourlyRate / 60;
                    const rawPeriodCost = minutes * minuteRate;
                    total += rawPeriodCost;
                }
            }
        }
    }

    // Round only when returning final cost
    return Math.round(total);
};

// Get detailed cost breakdown for PlayStation sessions
sessionSchema.methods.getCostBreakdown = function () {
    if (this.deviceType !== "playstation") {
        return {
            totalCost: this.totalCost,
            breakdown: [],
        };
    }

    const breakdown = [];
    const now = new Date();

    if (this.controllersHistory && this.controllersHistory.length > 0) {
        for (const period of this.controllersHistory) {
            let periodEnd = period.to;
            if (!periodEnd) {
                periodEnd = this.status === "active" ? now : this.endTime;
            }

            if (period.from && periodEnd) {
                const durationMs = new Date(periodEnd) - new Date(period.from);
                const hours = durationMs / (1000 * 60 * 60);
                const minutes = durationMs / (1000 * 60);

                if (hours > 0) {
                    const hourlyRate = getPlayStationHourlyRate(
                        period.controllers
                    );
                    const periodCost = (minutes * hourlyRate) / 60; // لا نقرب هنا

                    breakdown.push({
                        controllers: period.controllers,
                        hours: Math.floor(hours),
                        minutes: Math.floor(minutes % 60),
                        hourlyRate,
                        cost: periodCost, // التكلفة الخام بدون تقريب
                        from: period.from,
                        to: periodEnd,
                    });
                }
            }
        }
    } else {
        // Fallback to total session duration
        const endTime = this.status === "active" ? now : this.endTime;
        if (this.startTime && endTime) {
            const durationMs = new Date(endTime) - new Date(this.startTime);
            const hours = durationMs / (1000 * 60 * 60);
            const minutes = durationMs / (1000 * 60);

            if (hours > 0) {
                const hourlyRate = getPlayStationHourlyRate(this.controllers);
                const periodCost = (minutes * hourlyRate) / 60; // لا نقرب هنا

                breakdown.push({
                    controllers: this.controllers,
                    hours: Math.floor(hours),
                    minutes: Math.floor(minutes % 60),
                    hourlyRate,
                    cost: periodCost, // التكلفة الخام بدون تقريب
                    from: this.startTime,
                    to: endTime,
                });
            }
        }
    }

    return {
        totalCost: breakdown.reduce((sum, item) => sum + item.cost, 0),
        breakdown,
    };
};

// دالة async لحساب breakdown بناءً على أسعار الجهاز من الداتا بيز
sessionSchema.methods.getCostBreakdownAsync = async function () {
    const Device = mongoose.model("Device");
    const device = await Device.findById(this.deviceId);
    // دالة لجلب سعر الساعة حسب نوع الجهاز
    const getRate = (controllers) => {
        if (
            this.deviceType === "playstation" &&
            device &&
            device.playstationRates
        ) {
            return device.playstationRates.get(String(controllers)) || 0;
        } else if (this.deviceType === "computer" && device) {
            return device.hourlyRate || 0;
        }
        return 0;
    };
    const breakdown = [];
    const now = new Date();
    if (this.controllersHistory && this.controllersHistory.length > 0) {
        for (const period of this.controllersHistory) {
            let periodEnd = period.to;
            if (!periodEnd) {
                periodEnd = this.status === "active" ? now : this.endTime;
            }
            if (period.from && periodEnd) {
                const durationMs = new Date(periodEnd) - new Date(period.from);
                const hours = durationMs / (1000 * 60 * 60);
                const minutes = durationMs / (1000 * 60);
                if (hours > 0) {
                    const hourlyRate = getRate(period.controllers);
                    const periodCost = (minutes * hourlyRate) / 60; // لا نقرب هنا
                    breakdown.push({
                        controllers: period.controllers,
                        hours: Math.floor(hours),
                        minutes: Math.floor(minutes % 60),
                        hourlyRate,
                        cost: periodCost, // التكلفة الخام بدون تقريب
                        from: period.from,
                        to: periodEnd,
                    });
                }
            }
        }
    } else {
        // Fallback to total session duration
        const endTime = this.status === "active" ? now : this.endTime;
        if (this.startTime && endTime) {
            const durationMs = new Date(endTime) - new Date(this.startTime);
            const hours = durationMs / (1000 * 60 * 60);
            const minutes = durationMs / (1000 * 60);
            if (hours > 0) {
                const hourlyRate = getRate(this.controllers);
                const periodCost = (minutes * hourlyRate) / 60; // لا نقرب هنا
                breakdown.push({
                    controllers: this.controllers,
                    hours: Math.floor(hours),
                    minutes: Math.floor(minutes % 60),
                    hourlyRate,
                    cost: periodCost, // التكلفة الخام بدون تقريب
                    from: this.startTime,
                    to: endTime,
                });
            }
        }
    }

    const total = breakdown.reduce((sum, item) => sum + item.cost, 0);
    return {
        totalCost: Math.round(total), // التقريب فقط عند حساب التكلفة النهائية
        breakdown,
    };
};

// Apply sync middleware
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";
applySyncMiddleware(sessionSchema);

const Session = mongoose.model("Session", sessionSchema);
export default Session;
