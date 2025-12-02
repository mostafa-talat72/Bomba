import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from server directory
dotenv.config({ path: join(__dirname, '../.env') });

/**
 * Test Atlas connection
 */

const testAtlasConnection = async () => {
    console.log('\n🧪 Testing Atlas Connection...\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const atlasUri = process.env.MONGODB_ATLAS_URI;
    
    if (!atlasUri) {
        console.log('❌ MONGODB_ATLAS_URI not found in .env file\n');
        process.exit(1);
    }
    
    console.log('📋 Atlas URI (masked):');
    const maskedUri = atlasUri.replace(/:[^:@]+@/, ':****@');
    console.log('   ' + maskedUri + '\n');

    try {
        console.log('📡 Attempting to connect to Atlas...\n');
        
        const options = {
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 45000,
            family: 4,
            retryWrites: true,
            w: 'majority',
        };

        const connection = mongoose.createConnection(atlasUri, options);
        
        // Wait for connection to be ready
        await new Promise((resolve, reject) => {
            connection.once('open', resolve);
            connection.once('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 20000);
        });
        
        console.log('✅ Connected to Atlas!\n');
        console.log('📊 Connection Details:');
        console.log('   - Database: ' + connection.name);
        console.log('   - Host: ' + connection.host);
        console.log('   - Ready State: ' + connection.readyState + ' (1 = connected)\n');

        // Test ping
        console.log('🏓 Testing database ping...\n');
        await connection.db.admin().ping();
        console.log('✅ Ping successful!\n');

        // List collections
        console.log('📂 Listing collections...\n');
        const collections = await connection.db.listCollections().toArray();
        console.log('   Found ' + collections.length + ' collections:');
        collections.forEach(col => {
            console.log('   - ' + col.name);
        });
        console.log('');

        // Test Change Streams capability
        console.log('🔄 Testing Change Streams...\n');
        try {
            const testCollection = connection.db.collection('_test_change_stream');
            const changeStream = testCollection.watch();
            console.log('✅ Change Streams are working!\n');
            await changeStream.close();
        } catch (csError) {
            console.log('❌ Change Streams failed:', csError.message);
            console.log('   This might be because:');
            console.log('   - Atlas cluster is M0 (free tier) - Change Streams require M10+');
            console.log('   - Cluster is not a replica set\n');
        }

        await connection.close();
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 Atlas connection test PASSED!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.log('❌ Atlas connection FAILED\n');
        console.log('Error:', error.message);
        console.log('');
        console.log('💡 Possible causes:');
        console.log('   1. Internet connection issue');
        console.log('   2. Incorrect credentials in MONGODB_ATLAS_URI');
        console.log('   3. Atlas cluster is paused or deleted');
        console.log('   4. IP address not whitelisted in Atlas');
        console.log('   5. Network firewall blocking connection\n');
        
        console.log('🔧 Troubleshooting steps:');
        console.log('   1. Check your internet connection');
        console.log('   2. Verify Atlas credentials at: https://cloud.mongodb.com');
        console.log('   3. Check Atlas cluster status');
        console.log('   4. Add 0.0.0.0/0 to IP whitelist (for testing)');
        console.log('   5. Try connecting from MongoDB Compass\n');
        
        process.exit(1);
    }
};

// Run the test
testAtlasConnection();
