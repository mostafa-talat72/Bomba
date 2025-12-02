import mongoose from "mongoose";
import dotenv from "dotenv";
import dualDatabaseManager from "../config/dualDatabaseManager.js";
import syncConfig from "../config/syncConfig.js";
import syncWorker from "../services/sync/syncWorker.js";
import syncQueueManager from "../services/sync/syncQueueManager.js";
import syncMonitor from "../services/sync/syncMonitor.js";

dotenv.config();

/**
 * اختبار سريع للمزامنة
 * يتحقق من أن جميع المكونات تعمل
 */

async function quickSyncTest() {
    console.log("🧪 اختبار سريع للمزامنة");
    console.log("=".repeat(60));

    try {
        // 1. التحقق من الإعدادات
        console.log("\n1️⃣ التحقق من الإعدادات:");
        console.log(`   SYNC_ENABLED: ${syncConfig.enabled}`);
        console.log(`   Local URI: ${syncConfig.localUri}`);
        console.log(`   Atlas URI: ${syncConfig.atlasUri ? "✅ موجود" : "❌ غير موجود"}`);

        if (!syncConfig.enabled) {
            console.log("\n❌ المزامنة معطلة في الإعدادات!");
            console.log("   قم بتعيين SYNC_ENABLED=true في .env");
            process.exit(1);
        }

        // 2. الاتصال بقواعد البيانات
        console.log("\n2️⃣ الاتصال بقواعد البيانات:");
        
        console.log("   🔄 الاتصال بـ Local...");
        await dualDatabaseManager.connectLocal(syncConfig.localUri);
        console.log("   ✅ Local متصل");

        console.log("   🔄 الاتصال بـ Atlas...");
        await dualDatabaseManager.connectAtlas(syncConfig.atlasUri);
        
        if (dualDatabaseManager.isAtlasAvailable()) {
            console.log("   ✅ Atlas متصل");
        } else {
            console.log("   ⚠️  Atlas غير متصل (سيتم إعادة المحاولة)");
        }

        // 3. حالة الاتصالات
        console.log("\n3️⃣ حالة الاتصالات:");
        const status = dualDatabaseManager.getConnectionStatus();
        console.log(`   Local: ${status.local.connected ? "✅" : "❌"} (${status.local.host})`);
        console.log(`   Atlas: ${status.atlas.connected ? "✅" : "❌"} (${status.atlas.host})`);

        // 4. حالة Queue
        console.log("\n4️⃣ حالة Queue:");
        const queueStats = syncQueueManager.getStats();
        console.log(`   الحجم: ${queueStats.size}/${queueStats.maxSize}`);
        console.log(`   الاستخدام: ${queueStats.utilizationPercent}%`);

        // 5. حالة Worker
        console.log("\n5️⃣ حالة Worker:");
        const workerStats = syncWorker.getStats();
        console.log(`   يعمل: ${workerStats.isRunning ? "✅" : "❌"}`);
        console.log(`   متوقف: ${workerStats.isPaused ? "⏸️" : "▶️"}`);

        // 6. بدء Worker إذا لم يكن يعمل
        if (!workerStats.isRunning) {
            console.log("\n   🚀 بدء Worker...");
            syncWorker.start();
            console.log("   ✅ Worker بدأ");
        }

        // 7. اختبار إضافة عملية للقائمة
        console.log("\n6️⃣ اختبار Queue:");
        const testOperation = {
            type: "insert",
            collection: "test",
            data: { test: true, timestamp: new Date() },
        };
        
        syncQueueManager.enqueue(testOperation);
        console.log("   ✅ أُضيفت عملية اختبار");
        console.log(`   حجم Queue الآن: ${syncQueueManager.size()}`);

        // 8. انتظر قليلاً للمعالجة
        console.log("\n7️⃣ انتظار المعالجة...");
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const queueAfter = syncQueueManager.size();
        console.log(`   حجم Queue بعد المعالجة: ${queueAfter}`);

        if (queueAfter === 0) {
            console.log("   ✅ تمت المعالجة بنجاح!");
        } else {
            console.log("   ⚠️  لا تزال هناك عمليات في الانتظار");
        }

        // 9. الإحصائيات النهائية
        console.log("\n8️⃣ الإحصائيات:");
        const finalStats = syncWorker.getStats();
        console.log(`   إجمالي العمليات: ${finalStats.totalProcessed}`);
        console.log(`   نجح: ${finalStats.successCount}`);
        console.log(`   فشل: ${finalStats.failureCount}`);
        console.log(`   معدل النجاح: ${finalStats.successRate}%`);

        // 10. فحص الصحة
        console.log("\n9️⃣ فحص الصحة:");
        const health = syncWorker.checkHealth();
        console.log(`   الحالة: ${health.status.toUpperCase()}`);
        
        if (health.warnings && health.warnings.length > 0) {
            console.log("   ⚠️  تحذيرات:");
            health.warnings.forEach((w) => console.log(`      - ${w}`));
        }
        
        if (health.issues && health.issues.length > 0) {
            console.log("   ❌ مشاكل:");
            health.issues.forEach((e) => console.log(`      - ${e}`));
        }

        console.log("\n" + "=".repeat(60));
        
        if (health.status === "healthy") {
            console.log("✅ نظام المزامنة يعمل بشكل صحيح!");
        } else if (health.status === "degraded") {
            console.log("⚠️  نظام المزامنة يعمل لكن مع تحذيرات");
        } else {
            console.log("❌ نظام المزامنة لا يعمل بشكل صحيح");
        }
        
        console.log("=".repeat(60));

    } catch (error) {
        console.log("\n" + "=".repeat(60));
        console.error("❌ فشل الاختبار!");
        console.log("=".repeat(60));
        console.error("\n📝 الخطأ:", error.message);
        console.error("\n📚 Stack:", error.stack);
        process.exit(1);
    } finally {
        // إيقاف Worker
        syncWorker.stop();
        
        // إغلاق الاتصالات
        await dualDatabaseManager.closeConnections();
        console.log("\n🔒 أُغلقت جميع الاتصالات");
        process.exit(0);
    }
}

// تشغيل الاختبار
quickSyncTest();
