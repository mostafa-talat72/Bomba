import dotenv from "dotenv";
import mongoose from "mongoose";
import { runTask } from "./utils/scheduler.js";
import Logger from "./middleware/logger.js";

// Load environment variables
dotenv.config();

const testProductionScheduler = async () => {
    try {
        Logger.info("=== اختبار الجدولة الزمنية في وضع الإنتاج ===");

        // تعيين البيئة كإنتاج للاختبار
        process.env.NODE_ENV = "production";
        Logger.info("🔧 تم تعيين البيئة كإنتاج للاختبار");

        // الاتصال بقاعدة البيانات
        Logger.info("📡 الاتصال بقاعدة البيانات...");
        await mongoose.connect(process.env.MONGODB_URI);
        Logger.info("✅ تم الاتصال بقاعدة البيانات بنجاح");

        // اختبار التقرير اليومي
        Logger.info("📊 اختبار التقرير اليومي...");
        await runTask("dailyReport");
        Logger.info("✅ تم تشغيل التقرير اليومي بنجاح");

        // اختبار فحص المخزون المنخفض
        Logger.info("📦 اختبار فحص المخزون المنخفض...");
        await runTask("lowStock");
        Logger.info("✅ تم فحص المخزون المنخفض بنجاح");

        // اختبار تنظيف الإشعارات المنتهية
        Logger.info("🧹 اختبار تنظيف الإشعارات المنتهية...");
        await runTask("cleanNotifications");
        Logger.info("✅ تم تنظيف الإشعارات المنتهية بنجاح");

        Logger.info("🎯 جميع اختبارات الجدولة الزمنية مكتملة بنجاح!");
        Logger.info(
            "📅 التقرير اليومي سيعمل تلقائياً في الساعة 11:59 مساءً كل يوم"
        );
    } catch (error) {
        Logger.error("❌ خطأ في اختبار الجدولة الزمنية:", {
            error: error.message,
            stack: error.stack,
        });
    } finally {
        await mongoose.disconnect();
        Logger.info("📡 تم قطع الاتصال بقاعدة البيانات");
    }
};

// تشغيل الاختبار
testProductionScheduler();
