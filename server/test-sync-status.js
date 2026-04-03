import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dualDatabaseManager from './config/dualDatabaseManager.js';
import syncQueueManager from './services/sync/syncQueueManager.js';
import syncWorker from './services/sync/syncWorker.js';
import syncMonitor from './services/sync/syncMonitor.js';
import bidirectionalSyncMonitor from './services/sync/bidirectionalSyncMonitor.js';

dotenv.config();

async function testSyncStatus() {
    console.log('\n🔍 فحص حالة المزامنة...\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    try {
        // 1. الاتصال بقواعد البيانات
        console.log('📡 الاتصال بقواعد البيانات...');
        
        const localUri = process.env.MONGODB_LOCAL_URI || process.env.MONGODB_URI;
        const atlasUri = process.env.MONGODB_ATLAS_URI;
        
        console.log(`   Local: ${localUri.substring(0, 50)}...`);
        console.log(`   Atlas: ${atlasUri ? atlasUri.substring(0, 50) + '...' : 'غير متوفر'}`);
        
        // الاتصال بـ Local
        const localConn = await mongoose.createConnection(localUri).asPromise();
        console.log('   ✅ Local متصل');
        
        // الاتصال بـ Atlas
        let atlasConn = null;
        if (atlasUri) {
            try {
                atlasConn = await mongoose.createConnection(atlasUri).asPromise();
                console.log('   ✅ Atlas متصل');
            } catch (error) {
                console.log('   ⚠️  Atlas غير متصل:', error.message);
            }
        }
        
        console.log('\n═══════════════════════════════════════════════════════════\n');
        
        // 2. فحص الإعدادات
        console.log('⚙️  إعدادات المزامنة:');
        console.log(`   SYNC_ENABLED: ${process.env.SYNC_ENABLED}`);
        console.log(`   BIDIRECTIONAL_SYNC_ENABLED: ${process.env.BIDIRECTIONAL_SYNC_ENABLED}`);
        console.log(`   SYNC_WORKER_INTERVAL: ${process.env.SYNC_WORKER_INTERVAL}ms`);
        console.log(`   INITIAL_SYNC_ENABLED: ${process.env.INITIAL_SYNC_ENABLED}`);
        
        console.log('\n═══════════════════════════════════════════════════════════\n');
        
        // 3. فحص المجموعات (Collections)
        console.log('📦 المجموعات المتاحة:\n');
        
        const localCollections = await localConn.db.listCollections().toArray();
        console.log('   Local Collections:');
        for (const coll of localCollections) {
            const count = await localConn.db.collection(coll.name).countDocuments();
            console.log(`      - ${coll.name}: ${count} مستند`);
        }
        
        if (atlasConn) {
            console.log('\n   Atlas Collections:');
            const atlasCollections = await atlasConn.db.listCollections().toArray();
            for (const coll of atlasCollections) {
                const count = await atlasConn.db.collection(coll.name).countDocuments();
                console.log(`      - ${coll.name}: ${count} مستند`);
            }
        }
        
        console.log('\n═══════════════════════════════════════════════════════════\n');
        
        // 4. فحص البيانات الأخيرة
        console.log('📊 آخر البيانات المضافة:\n');
        
        const collections = ['orders', 'sessions', 'bills', 'users', 'menuitems'];
        
        for (const collName of collections) {
            try {
                const localDocs = await localConn.db.collection(collName)
                    .find()
                    .sort({ createdAt: -1 })
                    .limit(1)
                    .toArray();
                
                if (localDocs.length > 0) {
                    const doc = localDocs[0];
                    console.log(`   ${collName}:`);
                    console.log(`      Local: ${doc._id} (${doc.createdAt ? new Date(doc.createdAt).toLocaleString('ar-EG') : 'لا يوجد تاريخ'})`);
                    
                    if (atlasConn) {
                        const atlasDocs = await atlasConn.db.collection(collName)
                            .find({ _id: doc._id })
                            .toArray();
                        
                        if (atlasDocs.length > 0) {
                            console.log(`      Atlas: ✅ موجود`);
                        } else {
                            console.log(`      Atlas: ❌ غير موجود (يحتاج مزامنة)`);
                        }
                    }
                }
            } catch (error) {
                // Collection doesn't exist
            }
        }
        
        console.log('\n═══════════════════════════════════════════════════════════\n');
        
        // 5. فحص قائمة انتظار المزامنة
        console.log('📋 حالة قائمة انتظار المزامنة:\n');
        
        try {
            const queueStats = syncQueueManager.getStats();
            console.log(`   حجم القائمة: ${queueStats.queueSize}`);
            console.log(`   العمليات الناجحة: ${queueStats.successCount}`);
            console.log(`   العمليات الفاشلة: ${queueStats.failureCount}`);
            console.log(`   معدل النجاح: ${queueStats.successRate.toFixed(2)}%`);
        } catch (error) {
            console.log('   ⚠️  لا يمكن الوصول لإحصائيات القائمة');
        }
        
        console.log('\n═══════════════════════════════════════════════════════════\n');
        
        // 6. التوصيات
        console.log('💡 التوصيات:\n');
        
        if (process.env.SYNC_ENABLED !== 'true') {
            console.log('   ⚠️  المزامنة معطلة - قم بتفعيلها في .env');
        } else {
            console.log('   ✅ المزامنة مفعّلة');
        }
        
        if (!atlasConn) {
            console.log('   ⚠️  Atlas غير متصل - تحقق من MONGODB_ATLAS_URI');
        } else {
            console.log('   ✅ Atlas متصل');
        }
        
        if (process.env.SYNC_WORKER_INTERVAL === '0') {
            console.log('   ✅ المزامنة الفورية مفعّلة (SYNC_WORKER_INTERVAL=0)');
        } else {
            console.log(`   ℹ️  المزامنة كل ${process.env.SYNC_WORKER_INTERVAL}ms`);
        }
        
        console.log('\n═══════════════════════════════════════════════════════════\n');
        
        // إغلاق الاتصالات
        await localConn.close();
        if (atlasConn) await atlasConn.close();
        
        console.log('✅ تم الفحص بنجاح\n');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        process.exit(1);
    }
}

testSyncStatus();
