import mongoose from "mongoose";
import dotenv from "dotenv";
import Logger from "../middleware/logger.js";

dotenv.config();

/**
 * Initial Sync Script
 * نسخ جميع البيانات من Atlas إلى Local MongoDB
 * يُستخدم عند أول تشغيل للنظام
 */

const ATLAS_URI = process.env.MONGODB_ATLAS_URI;
const LOCAL_URI = process.env.MONGODB_LOCAL_URI || "mongodb://localhost:27017/bomba";

// قائمة الـ Collections المطلوب نسخها
const COLLECTIONS_TO_SYNC = [
    "bills",
    "costs",
    "devices",
    "inventoryitems",
    "menucategories",
    "menuitems",
    "menusections",
    "notifications",
    "orders",
    "organizations",
    "sessions",
    "settings",
    "subscriptions",
    "tables",
    "tablesections",
    "users",
];

async function initialSync() {
    let atlasConnection = null;
    let localConnection = null;

    try {
        console.log("🔄 بدء المزامنة الأولية من Atlas إلى Local...");
        console.log("=" .repeat(60));

        // الاتصال بـ Atlas
        console.log("\n📡 الاتصال بـ MongoDB Atlas...");
        atlasConnection = await mongoose.createConnection(ATLAS_URI).asPromise();
        console.log("✅ متصل بـ Atlas");

        // الاتصال بـ Local
        console.log("\n📡 الاتصال بـ Local MongoDB...");
        localConnection = await mongoose.createConnection(LOCAL_URI).asPromise();
        console.log("✅ متصل بـ Local");

        let totalDocuments = 0;
        let totalCollections = 0;

        // نسخ كل collection
        for (const collectionName of COLLECTIONS_TO_SYNC) {
            try {
                console.log(`\n📦 معالجة: ${collectionName}`);

                // الحصول على البيانات من Atlas
                const atlasCollection = atlasConnection.db.collection(collectionName);
                const documents = await atlasCollection.find({}).toArray();

                if (documents.length === 0) {
                    console.log(`   ⏭️  فارغ - تخطي`);
                    continue;
                }

                console.log(`   📊 وُجد ${documents.length} وثيقة`);

                // حذف البيانات القديمة من Local (إن وجدت)
                const localCollection = localConnection.db.collection(collectionName);
                const deleteResult = await localCollection.deleteMany({});
                if (deleteResult.deletedCount > 0) {
                    console.log(`   🗑️  حُذف ${deleteResult.deletedCount} وثيقة قديمة`);
                }

                // إدراج البيانات الجديدة
                if (documents.length > 0) {
                    await localCollection.insertMany(documents, { ordered: false });
                    console.log(`   ✅ نُسخ ${documents.length} وثيقة`);
                    totalDocuments += documents.length;
                    totalCollections++;
                }
            } catch (error) {
                console.error(`   ❌ خطأ في ${collectionName}:`, error.message);
            }
        }

        console.log("\n" + "=".repeat(60));
        console.log("✅ اكتملت المزامنة الأولية بنجاح!");
        console.log(`📊 الإحصائيات:`);
        console.log(`   - Collections: ${totalCollections}/${COLLECTIONS_TO_SYNC.length}`);
        console.log(`   - Documents: ${totalDocuments}`);
        console.log("=".repeat(60));

        return {
            success: true,
            totalCollections,
            totalDocuments,
        };
    } catch (error) {
        console.error("\n❌ فشلت المزامنة الأولية!");
        console.error("📝 التفاصيل:", error.message);
        console.error("Stack:", error.stack);
        throw error;
    } finally {
        // إغلاق الاتصالات
        if (atlasConnection) {
            await atlasConnection.close();
            console.log("\n🔒 أُغلق اتصال Atlas");
        }
        if (localConnection) {
            await localConnection.close();
            console.log("🔒 أُغلق اتصال Local");
        }
    }
}

// تشغيل المزامنة
initialSync()
    .then((result) => {
        console.log("\n✅ تم بنجاح!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ فشل:", error.message);
        process.exit(1);
    });

export default initialSync;
