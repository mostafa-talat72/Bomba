import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function forceFullSync() {
    console.log('\n🔄 بدء المزامنة الكاملة من Local إلى Atlas...\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    try {
        // الاتصال بقواعد البيانات
        const localUri = process.env.MONGODB_LOCAL_URI || process.env.MONGODB_URI;
        const atlasUri = process.env.MONGODB_ATLAS_URI;
        
        if (!atlasUri) {
            throw new Error('MONGODB_ATLAS_URI غير موجود في .env');
        }
        
        console.log('📡 الاتصال بقواعد البيانات...');
        const localConn = await mongoose.createConnection(localUri).asPromise();
        const atlasConn = await mongoose.createConnection(atlasUri).asPromise();
        console.log('   ✅ تم الاتصال بنجاح\n');
        
        // قائمة المجموعات المهمة للمزامنة
        const collectionsToSync = [
            'users',
            'organizations',
            'settings',
            'devices',
            'tables',
            'tablesections',
            'menusections',
            'menucategories',
            'menuitems',
            'inventoryitems',
            'costcategories',
            'costs',
            'employees',
            'departments',
            'advances',
            'deductions',
            'attendances',
            'payrolls',
            'orders',
            'sessions',
            'bills',
            'payments',
            'notifications',
            'subscriptions'
        ];
        
        let totalSynced = 0;
        let totalErrors = 0;
        
        for (const collName of collectionsToSync) {
            try {
                console.log(`\n📦 مزامنة ${collName}...`);
                
                // جلب جميع المستندات من Local
                const localDocs = await localConn.db.collection(collName).find({}).toArray();
                
                if (localDocs.length === 0) {
                    console.log(`   ⏭️  لا توجد مستندات`);
                    continue;
                }
                
                console.log(`   📊 عدد المستندات: ${localDocs.length}`);
                
                // حذف المجموعة من Atlas أولاً (لتجنب التكرار)
                try {
                    await atlasConn.db.collection(collName).drop();
                    console.log(`   🗑️  تم حذف المجموعة القديمة من Atlas`);
                } catch (error) {
                    // المجموعة غير موجودة، لا مشكلة
                }
                
                // إدراج جميع المستندات في Atlas
                if (localDocs.length > 0) {
                    // تقسيم إلى دفعات لتجنب مشاكل الذاكرة
                    const batchSize = 1000;
                    let synced = 0;
                    
                    for (let i = 0; i < localDocs.length; i += batchSize) {
                        const batch = localDocs.slice(i, i + batchSize);
                        await atlasConn.db.collection(collName).insertMany(batch, { ordered: false });
                        synced += batch.length;
                        
                        const progress = ((synced / localDocs.length) * 100).toFixed(1);
                        process.stdout.write(`\r   ⏳ التقدم: ${synced}/${localDocs.length} (${progress}%)`);
                    }
                    
                    console.log(`\n   ✅ تمت المزامنة بنجاح`);
                    totalSynced += localDocs.length;
                }
                
            } catch (error) {
                console.log(`\n   ❌ خطأ: ${error.message}`);
                totalErrors++;
            }
        }
        
        console.log('\n═══════════════════════════════════════════════════════════\n');
        console.log('📊 ملخص المزامنة:\n');
        console.log(`   ✅ إجمالي المستندات المزامنة: ${totalSynced}`);
        console.log(`   ❌ عدد الأخطاء: ${totalErrors}`);
        
        // التحقق من النتائج
        console.log('\n🔍 التحقق من النتائج...\n');
        
        for (const collName of collectionsToSync.slice(0, 5)) { // فحص أول 5 مجموعات فقط
            const localCount = await localConn.db.collection(collName).countDocuments();
            const atlasCount = await atlasConn.db.collection(collName).countDocuments();
            
            const status = localCount === atlasCount ? '✅' : '⚠️';
            console.log(`   ${status} ${collName}: Local=${localCount}, Atlas=${atlasCount}`);
        }
        
        console.log('\n═══════════════════════════════════════════════════════════\n');
        
        // إغلاق الاتصالات
        await localConn.close();
        await atlasConn.close();
        
        console.log('✅ تمت المزامنة الكاملة بنجاح!\n');
        console.log('💡 الآن المزامنة التلقائية ستعمل على البيانات الجديدة\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ خطأ في المزامنة:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

forceFullSync();
