import { MongoClient } from 'mongodb';

/**
 * Script to initialize MongoDB Replica Set
 * This must be run AFTER editing mongod.cfg and restarting MongoDB
 */

const initializeReplicaSet = async () => {
    console.log('\n🔧 Initializing MongoDB Replica Set...\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const uri = 'mongodb://localhost:27017';
    const client = new MongoClient(uri);

    try {
        console.log('📡 Connecting to MongoDB...');
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const admin = client.db().admin();

        // Check if already initialized
        try {
            const status = await admin.command({ replSetGetStatus: 1 });
            console.log('✅ Replica Set is already initialized!');
            console.log(`   - Set Name: ${status.set}`);
            console.log(`   - State: ${status.members[0]?.stateStr || 'N/A'}\n`);
            
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('✅ Replica Set is ready!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            console.log('📋 Next Steps:');
            console.log('1. Update server/.env:');
            console.log('   MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba?replicaSet=rs0');
            console.log('   BIDIRECTIONAL_SYNC_ENABLED=true\n');
            console.log('2. Restart your server: npm run server:dev\n');
            
            return;
        } catch (error) {
            if (error.codeName !== 'NoReplicationEnabled') {
                throw error;
            }
            // Not initialized yet, continue
        }

        // Initialize Replica Set
        console.log('🔧 Initializing Replica Set...');
        const config = {
            _id: 'rs0',
            members: [
                { _id: 0, host: 'localhost:27017' }
            ]
        };

        const result = await admin.command({ replSetInitiate: config });
        
        if (result.ok === 1) {
            console.log('✅ Replica Set initialized successfully!\n');
            
            // Wait a bit for the replica set to stabilize
            console.log('⏳ Waiting for Replica Set to stabilize...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Check status
            try {
                const status = await admin.command({ replSetGetStatus: 1 });
                console.log('✅ Replica Set is active!');
                console.log(`   - Set Name: ${status.set}`);
                console.log(`   - State: ${status.members[0]?.stateStr || 'N/A'}\n`);
            } catch (e) {
                console.log('⚠️  Could not verify status immediately (this is normal)\n');
            }
            
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🎉 SUCCESS! Replica Set initialized!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            console.log('📋 Next Steps:');
            console.log('1. Update server/.env:');
            console.log('   MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba?replicaSet=rs0');
            console.log('   BIDIRECTIONAL_SYNC_ENABLED=true\n');
            console.log('2. Verify: npm run check:replica\n');
            console.log('3. Start server: npm run server:dev\n');
            
        } else {
            console.log('❌ Failed to initialize Replica Set');
            console.log('   Result:', JSON.stringify(result, null, 2));
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        
        if (error.message.includes('already initialized')) {
            console.log('\n✅ Replica Set is already initialized!');
            console.log('\n📋 Next Steps:');
            console.log('1. Update server/.env:');
            console.log('   MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba?replicaSet=rs0');
            console.log('   BIDIRECTIONAL_SYNC_ENABLED=true\n');
            console.log('2. Restart your server: npm run server:dev\n');
        } else {
            console.error('\nStack trace:', error.stack);
            console.log('\n📖 For help, see: SETUP_NOW.md\n');
        }
    } finally {
        await client.close();
        console.log('🔌 Disconnected from MongoDB\n');
        process.exit(0);
    }
};

// Run the initialization
initializeReplicaSet();
