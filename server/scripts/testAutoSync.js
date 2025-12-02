import mongoose from "mongoose";
import dotenv from "dotenv";
import dualDatabaseManager from "../config/dualDatabaseManager.js";
import syncConfig from "../config/syncConfig.js";
import syncWorker from "../services/sync/syncWorker.js";
import applySyncToAllModels from "../config/applySync.js";

dotenv.config();

/**
 * اختبار المزامنة التلقائية
 * يضيف بيانات ويتحقق من مزامنتها تلقائياً
 */

// تعريف Schema بسيط للاختبار
const TestSchema = new mongoose.Schema({
    name: String,
    value: Number,
    timestamp: { type: Date, default: Date.now },
});

async function testAutoSync() {
    console.log("🧪 اختبار المزامنة التلقائية");
    console.log("=".repeat(60));

    try {
        // 1. الاتصال بقواعد البيانات
        console.log("\n1️⃣ الاتصال بقواعد البيانات...");
        await dualDatabaseManager.connectLocal(syncConfig.localUri);
        await dualDatabaseManager.connectAtlas(syncConfig.atlasUri);
        console.log("   ✅ متصل بـ Local و Atlas");

        // 2. تطبيق Sync Middleware على Schema أولاً
        console.log("\n2️⃣ تطبيق Sync Middleware...");
        const { applySyncMiddleware } = await import("../middleware/sync/syncMiddleware.js");
        applySyncMiddleware(TestSchema);
        console.log("   ✅ Middleware مطبق على Schema");

        // 3. إنشاء Model بعد تطبيق Middleware
        const localConnection = dualDatabaseManager.getLocalConnection();
        const atlasConnection = dualDatabaseManager.getAtlasConnection();

        const TestModel = localConnection.model("Test", TestSchema);
        console.log("   ✅ Model جاهز");

        // 4. بدء Worker
        console.log("\n4️⃣ بدء Sync Worker...");
        syncWorker.start();
        console.log("   ✅ Worker يعمل");

        // 5. حذف البيانات القديمة
        console.log("\n5️⃣ تنظيف البيانات القديمة...");
        await TestModel.deleteMany({});
        await atlasConnection.collection("tests").deleteMany({});
        console.log("   ✅ تم التنظيف");

        // انتظر قليلاً للتأكد من معالجة عمليات الحذف
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // 6. إضافة بيانات جديدة في Local
        console.log("\n6️⃣ إضافة بيانات جديدة في Local...");
        
        const testData = [
            { name: "Test 1", value: 100 },
            { name: "Test 2", value: 200 },
            { name: "Test 3", value: 300 },
        ];

        for (const data of testData) {
            const doc = new TestModel(data);
            await doc.save();
            console.log(`   ✅ أُضيف: ${data.name}`);
        }

        // 7. التحقق من Local
        console.log("\n7️⃣ التحقق من Local...");
        const localCount = await TestModel.countDocuments();
        console.log(`   📊 عدد الوثائق في Local: ${localCount}`);

        // 8. انتظار المزامنة
        console.log("\n8️⃣ انتظار المزامنة التلقائية...");
        console.log("   ⏳ انتظار 3 ثواني...");
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // 9. التحقق من Atlas
        console.log("\n9️⃣ التحقق من Atlas...");
        const atlasCount = await atlasConnection
            .collection("tests")
            .countDocuments();
        console.log(`   📊 عدد الوثائق في Atlas: ${atlasCount}`);

        // 10. مقارنة البيانات
        console.log("\n🔟 مقارنة البيانات...");
        
        if (localCount === atlasCount && atlasCount === testData.length) {
            console.log("   ✅ المزامنة نجحت!");
            console.log(`   ✅ Local: ${localCount} = Atlas: ${atlasCount}`);
            
            // عرض البيانات من Atlas
            console.log("\n🔍 البيانات في Atlas:");
            const atlasDocs = await atlasConnection
                .collection("tests")
                .find({})
                .toArray();
            
            atlasDocs.forEach((doc, index) => {
                console.log(`   ${index + 1}. ${doc.name} = ${doc.value}`);
            });
        } else {
            console.log("   ⚠️  المزامنة لم تكتمل بعد");
            console.log(`   Local: ${localCount}, Atlas: ${atlasCount}`);
        }

        // 11. إحصائيات Worker
        console.log("\n1️⃣1️⃣ إحصائيات Worker:");
        const stats = syncWorker.getStats();
        console.log(`   إجمالي العمليات: ${stats.totalProcessed}`);
        console.log(`   نجح: ${stats.successCount}`);
        console.log(`   فشل: ${stats.failureCount}`);
        console.log(`   معدل النجاح: ${stats.successRate}%`);

        console.log("\n" + "=".repeat(60));
        
        if (localCount === atlasCount) {
            console.log("✅ المزامنة التلقائية تعمل بشكل مثالي!");
            console.log("\n💡 الخلاصة:");
            console.log("   - أضفنا ${testData.length} وثائق في Local");
            console.log("   - زُامنت تلقائياً إلى Atlas");
            console.log("   - بدون أي كود إضافي!");
            console.log("   - كل شيء تلقائي 100%! 🎉");
        } else {
            console.log("⚠️  المزامنة تحتاج وقت أطول");
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
testAutoSync();
