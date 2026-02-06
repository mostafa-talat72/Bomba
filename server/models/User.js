import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "الاسم مطلوب"],
            trim: true,
            maxlength: [50, "الاسم لا يجب أن يتجاوز 50 حرف"],
        },
        email: {
            type: String,
            required: [true, "البريد الإلكتروني مطلوب"],
            unique: true,
            lowercase: true,
            match: [
                /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
                "البريد الإلكتروني غير صحيح",
            ],
        },
        username: {
            type: String,
            default: null,
        },
        password: {
            type: String,
            required: function() {
                return this.isNew; // فقط مطلوب عند إنشاء مستخدم جديد
            },
            minlength: [6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"],
            select: false,
        },
        role: {
            type: String,
            enum: ["admin", "staff", "cashier", "kitchen", "owner"],
            default: "staff",
        },
        permissions: [
            {
                type: String,
                enum: [
                    "dashboard",
                    "playstation",
                    "computer",
                    "cafe",
                    "menu",
                    "billing",
                    "reports",
                    "consumption",
                    "inventory",
                    "costs",
                    "users",
                    "settings",
                    "staff",
                    "orders",
                    "all",
                ],
            },
        ],
        status: {
            type: String,
            enum: ["active", "inactive", "suspended", "pending"],
            default: "active",
        },
        lastLogin: {
            type: Date,
            default: null,
        },
        refreshToken: {
            type: String,
            select: false,
        },
        avatar: {
            type: String,
            default: null,
        },
        phone: {
            type: String,
            default: null,
        },
        address: {
            type: String,
            default: null,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
        },
        verificationToken: {
            type: String,
            default: null,
        },
        resetPasswordToken: {
            type: String,
            default: null,
        },
        resetPasswordExpire: {
            type: Date,
            default: null,
        },
        // إضافة حقول جديدة لتحسين إدارة المستخدمين
        department: {
            type: String,
            default: null,
        },
        position: {
            type: String,
            default: null,
        },
        hireDate: {
            type: Date,
            default: null,
        },
        salary: {
            type: Number,
            default: null,
        },
        notes: {
            type: String,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        profileImage: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
    // Skip password hashing if password is not modified or not present
    if (!this.isModified("password") || !this.password) return next();

    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Pre-validate middleware to handle password requirement
userSchema.pre("validate", function(next) {
    // If this is an update operation and password is not being modified, skip password validation
    if (!this.isNew && !this.isModified("password")) {
        this.schema.path('password').required(false);
    }
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Update last login
userSchema.methods.updateLastLogin = function () {
    this.lastLogin = new Date();
    return this.save({ validateBeforeSave: false });
};

// Check if user has permission
userSchema.methods.hasPermission = function (permission) {
    return (
        this.permissions.includes("all") ||
        this.permissions.includes(permission)
    );
};

// Check if user has any of the given permissions
userSchema.methods.hasAnyPermission = function (permissions) {
    if (this.permissions.includes("all")) return true;
    return permissions.some((permission) =>
        this.permissions.includes(permission)
    );
};

// Check if user has all of the given permissions
userSchema.methods.hasAllPermissions = function (permissions) {
    if (this.permissions.includes("all")) return true;
    return permissions.every((permission) =>
        this.permissions.includes(permission)
    );
};

// Get user's accessible pages based on permissions
userSchema.methods.getAccessiblePages = function () {
    const pagePermissions = {
        dashboard: ["dashboard"],
        playstation: ["playstation"],
        computer: ["computer"],
        cafe: ["cafe"],
        menu: ["menu"],
        billing: ["billing"],
        reports: ["reports"],
        consumption: ["consumption"],
        inventory: ["inventory"],
        costs: ["costs"],
        users: ["users"],
        settings: ["settings"],
        notifications: [
            "dashboard",
            "playstation",
            "computer",
            "cafe",
            "menu",
            "billing",
            "reports",
            "consumption",
            "inventory",
            "costs",
            "users",
            "settings",
        ],
    };

    const accessiblePages = [];

    for (const [page, requiredPermissions] of Object.entries(pagePermissions)) {
        if (this.hasAnyPermission(requiredPermissions)) {
            accessiblePages.push(page);
        }
    }

    return accessiblePages;
};

// Get user's role display name
userSchema.methods.getRoleDisplayName = function () {
    const roleNames = {
        admin: "مدير",
        staff: "موظف",
        cashier: "كاشير",
        kitchen: "مطبخ",
        owner: "مالك",
    };
    return roleNames[this.role] || this.role;
};

// Check if user can access a specific page
userSchema.methods.canAccessPage = function (page) {
    const pagePermissions = {
        dashboard: ["dashboard"],
        playstation: ["playstation"],
        computer: ["computer"],
        cafe: ["cafe"],
        menu: ["menu"],
        billing: ["billing"],
        reports: ["reports"],
        consumption: ["consumption"],
        inventory: ["inventory"],
        costs: ["costs"],
        users: ["users"],
        settings: ["settings"],
        notifications: [
            "dashboard",
            "playstation",
            "computer",
            "cafe",
            "menu",
            "billing",
            "reports",
            "consumption",
            "inventory",
            "costs",
            "users",
            "settings",
        ],
    };

    const requiredPermissions = pagePermissions[page];
    if (!requiredPermissions) return false;

    return this.hasAnyPermission(requiredPermissions);
};

// Apply sync middleware
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";
applySyncMiddleware(userSchema);

export default mongoose.model("User", userSchema);
