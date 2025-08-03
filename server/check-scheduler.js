import dotenv from "dotenv";
import Logger from "./middleware/logger.js";

// Load environment variables
dotenv.config();

const checkScheduler = () => {
    try {
        Logger.info("=== فحص حالة الجدولة الزمنية ===");

        // التحقق من متغيرات البيئة
        Logger.info("1. فحص متغيرات البيئة:");
        Logger.info(`   - NODE_ENV: ${process.env.NODE_ENV}`);
        Logger.info(
            `   - EMAIL_HOST: ${
                process.env.EMAIL_HOST ? "مُعيّن" : "غير مُعيّن"
            }`
        );
        Logger.info(
            `   - EMAIL_USER: ${
                process.env.EMAIL_USER ? "مُعيّن" : "غير مُعيّن"
            }`
        );
        Logger.info(
            `   - EMAIL_PASS: ${
                process.env.EMAIL_PASS ? "مُعيّن" : "غير مُعيّن"
            }`
        );

        // عرض الجدولة الزمنية
        Logger.info("2. الجدولة الزمنية المُعيّنة:");
        Logger.info("   - التقرير اليومي: كل يوم في الساعة 11:59 مساءً");
        Logger.info("   - فحص المخزون المنخفض: كل ساعة");
        Logger.info(
            "   - التقرير الشهري: آخر يوم من الشهر في الساعة 11:59 مساءً"
        );
        Logger.info("   - تحديث الفواتير المتأخرة: كل 6 ساعات");
        Logger.info("   - إنشاء التكاليف المتكررة: كل يوم في منتصف الليل");
        Logger.info(
            "   - نسخ احتياطي للقاعدة: كل أسبوع يوم الأحد في الساعة 2 صباحاً"
        );
        Logger.info("   - تنظيف الإشعارات المنتهية: كل يوم في الساعة 3 صباحاً");

        if (process.env.NODE_ENV === "development") {
            Logger.info(
                "   - 🧪 وضع التطوير: التقرير اليومي يعمل كل ساعة للاختبار"
            );
        }

        // التحقق من الوقت الحالي
        const now = new Date();
        Logger.info("3. الوقت الحالي:", {
            date: now.toLocaleDateString("ar-EG"),
            time: now.toLocaleTimeString("ar-EG"),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });

        // حساب الوقت المتبقي للتقرير اليومي
        const nextDailyReport = new Date();
        nextDailyReport.setHours(23, 59, 0, 0);

        if (now > nextDailyReport) {
            nextDailyReport.setDate(nextDailyReport.getDate() + 1);
        }

        const timeUntilNextReport = nextDailyReport.getTime() - now.getTime();
        const hoursUntilNextReport = Math.floor(
            timeUntilNextReport / (1000 * 60 * 60)
        );
        const minutesUntilNextReport = Math.floor(
            (timeUntilNextReport % (1000 * 60 * 60)) / (1000 * 60)
        );

        Logger.info("4. التقرير اليومي التالي:", {
            nextReportTime: nextDailyReport.toLocaleString("ar-EG"),
            timeUntilNextReport: `${hoursUntilNextReport} ساعة و ${minutesUntilNextReport} دقيقة`,
        });

        Logger.info("✅ فحص الجدولة الزمنية مكتمل!");
        Logger.info(
            "📧 التقرير اليومي سيرسل تلقائياً في الساعة 11:59 مساءً كل يوم"
        );
    } catch (error) {
        Logger.error("❌ خطأ في فحص الجدولة الزمنية:", {
            error: error.message,
            stack: error.stack,
        });
    }
};

// تشغيل الفحص
checkScheduler();
