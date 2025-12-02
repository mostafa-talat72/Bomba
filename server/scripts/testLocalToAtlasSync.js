import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

/**
 * Test Local → Atlas sync
 * Creates a test document in Local and checks if it appears in Atlas
 */

const testLocalToAtlasSync = async () => {
    console.log('\n🧪 Testing Local → Atlas Sync...\n');
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
        // Connect to Local
        console.log('📡 Connecting to Local MongoDB...\n');
        localConnection = mongoose.createConnection(localUri);
        await new Promise((resolve, reject) => {
            localConnection.once('open', resolve);
            localConnection.once('error', reject);
            setTimeout(() => reject(new Error('Local connection timeout')), 15000);
        });
        console.log('✅ Connected to Local\n');

        // Connect to Atlas
        console.log('📡 Connecting to Atlas...\n');
        atlasConnection = mongoose.createConnection(atlasUri);
        await new Promise((resolve, reject) => {
            atlasConnection.once('open', resolve);
            atlasConnection.once('error', reject);
            setTimeout(() => reject(new Error('Atlas connection timeout')), 15000);
        });
        console.log('✅ Connected to Atlas\n');

        // Create test document in Local
        const testId = new mongoose.Types.ObjectId();
        const testDocument = {
            _id: testId,
            tableNumber: 'TEST-SYNC-' + Date.now(),
            status: 'open',
            items: [],
            totalAmount: 0,
            createdAt: new Date(),
            __test: true // Mark as test document
        };

        console.log('📝 Creating test document in Local...');
        console.log('   Test ID:', testId.toString());
        console.log('   Table Number:', testDocument.tableNumber);
        console.log('');

        const localCollection = localConnection.db.collection('bills');
        await localCollection.insertOne(testDocument);
        console.log('✅ Test document created in Local\n');

        // Wait for sync to happen
        console.log('⏳ Waiting 5 seconds for sync to complete...\n');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check if document exists in Atlas
        console.log('🔍 Checking if document exists in Atlas...\n');
        const atlasCollection = atlasConnection.db.collection('bills');
        const foundInAtlas = await atlasCollection.findOne({ _id: testId });

        if (foundInAtlas) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('✅ SUCCESS! Document found in Atlas!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            console.log('📊 Sync Details:');
            console.log('   - Document ID:', testId.toString());
            console.log('   - Table Number:', foundInAtlas.tableNumber);
            console.log('   - Synced successfully from Local to Atlas');
            console.log('');
            console.log('🎉 Local → Atlas sync is working correctly!\n');
        } else {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('❌ FAILED! Document NOT found in Atlas');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            console.log('💡 Possible causes:');
            console.log('   1. Sync worker not running');
            console.log('   2. Atlas connection issue');
            console.log('   3. Sync middleware not applied to Bill model');
            console.log('   4. SYNC_ENABLED=false in .env');
            console.log('');
            console.log('🔧 Troubleshooting:');
            console.log('   1. Check server logs for sync errors');
            console.log('   2. Verify SYNC_ENABLED=true in .env');
            console.log('   3. Check Atlas connection');
            console.log('   4. Try waiting longer (10-15 seconds)\n');
        }

        // Cleanup: Delete test document from both databases
        console.log('🧹 Cleaning up test document...\n');
        await localCollection.deleteOne({ _id: testId });
        if (foundInAtlas) {
            await atlasCollection.deleteOne({ _id: testId });
        }
        console.log('✅ Test document deleted\n');

    } catch (error) {
        console.log('❌ Test failed:', error.message);
        console.log('');
        console.log('💡 Troubleshooting:');
        console.log('   1. Make sure both Local and Atlas are accessible');
        console.log('   2. Check your internet connection');
        console.log('   3. Verify credentials in .env file');
        console.log('   4. Make sure server is running\n');
        process.exit(1);
    } finally {
        if (atlasConnection) await atlasConnection.close();
        if (localConnection) await localConnection.close();
        console.log('🔌 Disconnected from databases\n');
        process.exit(0);
    }
};

// Run the test
testLocalToAtlasSync();
