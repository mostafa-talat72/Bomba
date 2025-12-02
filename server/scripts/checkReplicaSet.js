import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Script to check if Local MongoDB is configured as a Replica Set
 * This is required for bidirectional sync (Change Streams)
 */

const checkReplicaSet = async () => {
    console.log('\n🔍 Checking MongoDB Replica Set Configuration...\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        // Connect to Local MongoDB
        const localUri = process.env.MONGODB_LOCAL_URI || 'mongodb://localhost:27017/bomba';
        console.log(`📡 Connecting to Local MongoDB: ${localUri}\n`);

        await mongoose.connect(localUri);
        console.log('✅ Connected to Local MongoDB\n');

        // Check if it's a replica set
        const admin = mongoose.connection.db.admin();
        
        try {
            const replSetStatus = await admin.command({ replSetGetStatus: 1 });
            
            console.log('✅ MongoDB is configured as a Replica Set!\n');
            console.log('📊 Replica Set Information:');
            console.log(`   - Set Name: ${replSetStatus.set}`);
            console.log(`   - Members: ${replSetStatus.members.length}`);
            console.log(`   - Primary: ${replSetStatus.members.find(m => m.stateStr === 'PRIMARY')?.name || 'N/A'}`);
            console.log(`   - State: ${replSetStatus.members[0]?.stateStr || 'N/A'}\n`);
            
            // Check if URI includes replicaSet parameter
            if (!localUri.includes('replicaSet=')) {
                console.log('⚠️  WARNING: MONGODB_LOCAL_URI does not include replicaSet parameter');
                console.log('   Add "?replicaSet=rs0" to your MONGODB_LOCAL_URI in .env\n');
                console.log('   Example:');
                console.log('   MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba?replicaSet=rs0\n');
            } else {
                console.log('✅ MONGODB_LOCAL_URI includes replicaSet parameter\n');
            }
            
            // Check bidirectional sync configuration
            const bidirectionalEnabled = process.env.BIDIRECTIONAL_SYNC_ENABLED === 'true';
            console.log('🔄 Bidirectional Sync Configuration:');
            console.log(`   - BIDIRECTIONAL_SYNC_ENABLED: ${bidirectionalEnabled ? '✅ true' : '❌ false'}\n`);
            
            if (!bidirectionalEnabled) {
                console.log('ℹ️  To enable bidirectional sync, set in .env:');
                console.log('   BIDIRECTIONAL_SYNC_ENABLED=true\n');
            }
            
            // Test Change Streams capability
            console.log('🧪 Testing Change Streams capability...');
            const testCollection = mongoose.connection.db.collection('_test_change_stream');
            
            try {
                const changeStream = testCollection.watch();
                console.log('✅ Change Streams are working!\n');
                await changeStream.close();
                
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('🎉 SUCCESS! Your MongoDB is ready for bidirectional sync!');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                
                if (bidirectionalEnabled) {
                    console.log('✅ Bidirectional sync is ENABLED');
                    console.log('   Start your server with: npm run server:dev\n');
                } else {
                    console.log('ℹ️  To enable bidirectional sync:');
                    console.log('   1. Set BIDIRECTIONAL_SYNC_ENABLED=true in .env');
                    console.log('   2. Restart your server\n');
                }
                
            } catch (csError) {
                console.log('❌ Change Streams test failed:', csError.message);
                console.log('\nℹ️  This might be because:');
                console.log('   - Replica Set is not fully initialized');
                console.log('   - URI does not include replicaSet parameter\n');
            }
            
        } catch (replError) {
            if (replError.codeName === 'NoReplicationEnabled') {
                console.log('❌ MongoDB is NOT configured as a Replica Set\n');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('📋 To enable Replica Set, follow these steps:');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                
                console.log('1️⃣  Stop MongoDB (as Administrator):');
                console.log('   net stop MongoDB\n');
                
                console.log('2️⃣  Edit mongod.cfg file:');
                console.log('   Location: C:\\Program Files\\MongoDB\\Server\\{version}\\bin\\mongod.cfg');
                console.log('   Add these lines:\n');
                console.log('   replication:');
                console.log('     replSetName: "rs0"\n');
                
                console.log('3️⃣  Start MongoDB (as Administrator):');
                console.log('   net start MongoDB\n');
                
                console.log('4️⃣  Initialize Replica Set:');
                console.log('   mongosh');
                console.log('   rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] })\n');
                
                console.log('5️⃣  Update .env file:');
                console.log('   MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba?replicaSet=rs0');
                console.log('   BIDIRECTIONAL_SYNC_ENABLED=true\n');
                
                console.log('6️⃣  Run this script again to verify:');
                console.log('   node server/scripts/checkReplicaSet.js\n');
                
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('📖 For detailed instructions, see: ENABLE_BIDIRECTIONAL_SYNC.md');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            } else {
                throw replError;
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('\nStack trace:', error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Disconnected from MongoDB\n');
        process.exit(0);
    }
};

// Run the check
checkReplicaSet();
