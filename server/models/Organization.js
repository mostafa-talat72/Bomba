import mongoose from "mongoose";

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
        }]
    },
    
    // معلومات إضافية
    logo: { type: String, default: "" },
    websiteUrl: { type: String, default: "" },
    workingHours: {
        monday: { open: String, close: String, closed: { type: Boolean, default: false } },
        tuesday: { open: String, close: String, closed: { type: Boolean, default: false } },
        wednesday: { open: String, close: String, closed: { type: Boolean, default: false } },
        thursday: { open: String, close: String, closed: { type: Boolean, default: false } },
        friday: { open: String, close: String, closed: { type: Boolean, default: false } },
        saturday: { open: String, close: String, closed: { type: Boolean, default: false } },
        sunday: { open: String, close: String, closed: { type: Boolean, default: false } }
    },
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// تحديث updatedAt عند الحفظ
OrganizationSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Apply sync middleware
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";
applySyncMiddleware(OrganizationSchema);

export default mongoose.model("Organization", OrganizationSchema);
