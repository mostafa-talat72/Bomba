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
            unique: true,
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
            required: function () {
                return this.type === "computer";
            },
        },
        // أسعار الساعة لكل عدد دراعات للبلايستيشن
        playstationRates: {
            type: Map,
            of: Number,
            required: function () {
                return this.type === "playstation";
            },
            // مثال: { '1': 20, '2': 20, '3': 25, '4': 30 }
            default: undefined,
        },
    },
    {
        timestamps: true,
    }
);

// Index for faster queries
deviceSchema.index({ status: 1 });

// Middleware to generate number with prefix before saving
deviceSchema.pre("save", function (next) {
    if (this.isNew || this.isModified("number") || this.isModified("type")) {
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

const Device = mongoose.model("Device", deviceSchema);
export default Device;
