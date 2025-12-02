import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

/**
 * Sync existing data from Atlas to Local
 * This is a one-time operation to sync data that existed before bidirectional sync was enabled
 */

const syncAtlasToLocal = async () => {
    console.log('\n🔄 Syncing Data from Atlas to Local...\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const atlasUri = process.env.MONGODB_ATLAS_URI;
    const localUri = process.env.MONGODB_LOCAL_URI || 'mongodb://localhost:27017/bomba?replicaSet=rs0';
    
    if (!atlasUri) {
        console.log('❌ MONGODB_ATLAS_URI not found in .env file\n');
        process.exit(1);
    }

    let atlasConnection = null;
    let localConnection = null;

    try {
        // Connect to Atlas
        console.log('📡 Connecting to Atlas...\n');
        atlasConnection = mongoose.createConnection(atlasUri);
        await new Promise((resolve, reject) => {
            atlasConnection.once('open', resolve);
            atlasConnection.once('error', reject);
            setTimeout(() => reject(new Error('Atlas connection timeout')), 15000);
        });
        console.log('✅ Connected to Atlas\n');

        // Connect to Local
        console.log('📡 Connecting to Local MongoDB...\n');
        localConnection = mongoose.createConnection(localUri);
        await new Promise((resolve, reject) => {
            localConnection.once('open', resolve);
            localConnection.once('error', reject);
            setTimeout(() => reject(new Error('Local connection timeout')), 15000);
        });
        console.log('✅ Connected to Local MongoDB\n');

        // Get all collections from Atlas
        console.log('📂 Getting collections from Atlas...\n');
        const collections = await atlasConnection.db.listCollections().toArray();
        console.log('Found ' + collections.length + ' collections\n');

        // Collections to sync
        const collectionsToSync = collections
            .map(c => c.name)
            .filter(name => !name.startsWith('system.') && name !== '_origin_tracking');

        console.log('📋 Collections to sync:');
        collectionsToSync.forEach(name => console.log('   - ' + name));
        console.log('');

        let totalSynced = 0;
        let totalSkipped = 0;

        // Sync each collection
        for (const collectionName of collectionsToSync) {
            console.log('🔄 Syncing collection: ' + collectionName);
            
            try {
                const atlasCollection = atlasConnection.db.collection(collectionName);
                const localCollection = localConnection.db.collection(collectionName);

                // Get all documents from Atlas
                const atlasDocuments = await atlasCollection.find({}).toArray();
                console.log('   Found ' + atlasDocuments.length + ' documents in Atlas');

                if (atlasDocuments.length === 0) {
                    console.log('   ⏭️  Skipping (empty collection)\n');
                    continue;
                }

                // Get existing document IDs from Local
                const localIds = await localCollection.distinct('_id');
                const localIdSet = new Set(localIds.map(id => id.toString()));

                // Filter documents that don't exist in Local
                const documentsToInsert = atlasDocuments.filter(doc => 
                    !localIdSet.has(doc._id.toString())
                );

                if (documentsToInsert.length === 0) {
                    console.log('   ✅ All documents already exist in Local\n');
                    totalSkipped += atlasDocuments.length;
                    continue;
                }

                // Insert missing documents
                if (documentsToInsert.length > 0) {
                    await localCollection.insertMany(documentsToInsert, { ordered: false });
                    console.log('   ✅ Inserted ' + documentsToInsert.length + ' new documents');
                    totalSynced += documentsToInsert.length;
                }

                const skipped = atlasDocuments.length - documentsToInsert.length;
                if (skipped > 0) {
                    console.log('   ⏭️  Skipped ' + skipped + ' existing documents');
                    totalSkipped += skipped;
                }

                console.log('');

            } catch (collError) {
                if (collError.code === 11000) {
                    // Duplicate key error - some documents already exist
                    console.log('   ⚠️  Some documents already exist (duplicate key)\n');
                } else {
                    console.log('   ❌ Error syncing collection:', collError.message);
                    console.log('');
                }
            }
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 Sync Complete!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('📊 Summary:');
        console.log('   ✅ Documents synced: ' + totalSynced);
        console.log('   ⏭️  Documents skipped (already exist): ' + totalSkipped);
        console.log('   📂 Collections processed: ' + collectionsToSync.length);
        console.log('');
        console.log('✅ Local database is now in sync with Atlas!');
        console.log('🔄 Bidirectional sync will keep them in sync from now on.\n');

    } catch (error) {
        console.log('❌ Sync failed:', error.message);
        console.log('');
        console.log('💡 Troubleshooting:');
        console.log('   1. Make sure both Atlas and Local are accessible');
        console.log('   2. Check your internet connection');
        console.log('   3. Verify credentials in .env file');
        console.log('   4. Make sure Local MongoDB is running\n');
        process.exit(1);
    } finally {
        if (atlasConnection) await atlasConnection.close();
        if (localConnection) await localConnection.close();
        console.log('🔌 Disconnected from databases\n');
        process.exit(0);
    }
};

// Run the sync
syncAtlasToLocal();
