import mongoose from "mongoose";

/**
 * حارس الاستبدال الكامل (replaceOne): يمنع مسح مستند سليم بنسخة ناقصة.
 *
 * الخلفية: إعادة تشغيل عمليات الطابور كانت تستبدل المستند كاملاً بأي
 * حمولة، فنسخة ناقصة (بلا name/price/...) تمحو النسخة السليمة نهائياً.
 * هذا الفحص يرفض الاستبدال عندما يفتقد المستند حقولاً يوجبها السكيما.
 * عند تعذر التقييم (موديل غير مسجل) يُسمح كالسابق — بلا تغيير سلوك.
 */
export function getRequiredTopPaths(collectionName) {
    try {
        const models = (mongoose && mongoose.models) || {};
        const model = Object.values(models).find(
            (m) => m && m.collection && m.collection.name === collectionName
        );
        if (!model || !model.schema || typeof model.schema.requiredPaths !== "function") {
            return null;
        }
        return model.schema
            .requiredPaths()
            .filter((p) => typeof p === "string" && p && !p.includes("."));
    } catch {
        return null;
    }
}

export function missingRequiredFields(collectionName, doc) {
    const required = getRequiredTopPaths(collectionName);
    if (!required || required.length === 0) return null; // لا يمكن التقييم
    return required.filter((p) => {
        const v = doc ? doc[p] : undefined;
        return v === undefined || v === null || v === "";
    });
}

export function isViableReplacementDoc(collectionName, doc) {
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return false;
    if (doc._id === undefined || doc._id === null) return false;
    const missing = missingRequiredFields(collectionName, doc);
    if (missing === null) return true; // لا يمكن التقييم — السماح كالسابق
    return missing.length === 0;
}
