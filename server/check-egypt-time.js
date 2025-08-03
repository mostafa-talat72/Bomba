import dotenv from "dotenv";
import Logger from "./middleware/logger.js";

// Load environment variables
dotenv.config();

const checkEgyptTime = () => {
    try {
        Logger.info("=== فحص التوقيت المصري والتقرير اليومي ===");

        // الوقت الحالي
        const now = new Date();

        // توقيت مصر (UTC+2)
        const egyptTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);

        Logger.info("1. التوقيت الحالي:", {
            localTime: now.toLocaleString("ar-EG"),
            egyptTime: egyptTime.toLocaleString("ar-EG"),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });

        // حساب التقرير اليومي التالي (11:59 مساءً بتوقيت مصر)
        const nextDailyReport = new Date();
        nextDailyReport.setHours(23, 59, 0, 0); // 11:59 PM

        // إذا كان الوقت الحالي بعد 11:59 مساءً، التقرير التالي غداً
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

        Logger.info("2. التقرير اليومي التالي:", {
            nextReportTime: nextDailyReport.toLocaleString("ar-EG"),
            timeUntilNextReport: `${hoursUntilNextReport} ساعة و ${minutesUntilNextReport} دقيقة`,
            egyptTime: nextDailyReport.toLocaleString("ar-EG", {
                timeZone: "Africa/Cairo",
            }),
        });

        // عرض الجدولة الزمنية
        Logger.info("3. الجدولة الزمنية (بتوقيت مصر):");
        Logger.info("   - التقرير اليومي: كل يوم في الساعة 11:59 مساءً");
        Logger.info("   - فحص المخزون: كل ساعة");
        Logger.info(
            "   - التقرير الشهري: آخر يوم من الشهر في الساعة 11:59 مساءً"
        );
        Logger.info("   - تحديث الفواتير المتأخرة: كل 6 ساعات");
        Logger.info("   - إنشاء التكاليف المتكررة: كل يوم في منتصف الليل");
        Logger.info("   - نسخ احتياطي: كل أسبوع يوم الأحد في الساعة 2 صباحاً");
        Logger.info("   - تنظيف الإشعارات: كل يوم في الساعة 3 صباحاً");

        // التحقق من متغيرات البيئة
        Logger.info("4. إعدادات النظام:");
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

        Logger.info("✅ فحص التوقيت المصري مكتمل!");
        Logger.info(
            "📧 التقرير اليومي سيرسل تلقائياً في الساعة 11:59 مساءً بتوقيت مصر كل يوم"
        );
    } catch (error) {
        Logger.error("❌ خطأ في فحص التوقيت المصري:", {
            error: error.message,
            stack: error.stack,
        });
    }
};

// تشغيل الفحص
checkEgyptTime();
