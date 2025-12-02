import { MongoClient } from 'mongodb';

/**
 * Initialize MongoDB Replica Set
 * This script connects to MongoDB and initializes the replica set
 */

const initializeReplicaSet = async () => {
    console.log('\n🔧 Initializing MongoDB Replica Set...\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Connect WITHOUT replica set parameter first
    const uri = 'mongodb://localhost:27017/?directConnection=true';
    const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 10000
    });

    try {
        console.log('📡 Connecting to MongoDB (direct connection)...\n');
        await client.connect();
        console.log('✅ Connected!\n');

        const admin = client.db('admin');
        
        // Try to get replica set status
        console.log('🔍 Checking current replica set status...\n');
        
        try {
            const status = await admin.command({ replSetGetStatus: 1 });
            console.log('ℹ️  Replica Set is already initialized!\n');
            console.log('📊 Current Status:');
            console.log('   - Set Name: ' + status.set);
            console.log('   - Members: ' + status.members.length);
            const memberState = status.members[0]?.stateStr || 'N/A';
            console.log('   - State: ' + memberState + '\n');
            
            if (status.members[0]?.stateStr === 'PRIMARY') {
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('✅ Replica Set is working correctly!');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                
                console.log('📋 Next Steps:');
                console.log('   1. Make sure .env has:');
                console.log('      MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba?replicaSet=rs0');
                console.log('      BIDIRECTIONAL_SYNC_ENABLED=true\n');
                console.log('   2. Run: node server/scripts/checkReplicaSet.js\n');
                console.log('   3. Start server: npm run server:dev\n');
            } else {
                console.log('⚠️  Replica Set exists but state is: ' + memberState);
                console.log('   Wait a few seconds for it to become PRIMARY.\n');
            }
            
        } catch (error) {
            // Replica set not initialized yet
            console.log('ℹ️  Replica Set not initialized yet.\n');
            console.log('🔄 Initializing Replica Set now...\n');
            
            const config = {
                _id: 'rs0',
                members: [
                    { _id: 0, host: 'localhost:27017' }
                ]
            };
            
            try {
                const result = await admin.command({ replSetInitiate: config });
                
                if (result.ok === 1) {
                    console.log('✅ Replica Set initialized successfully!\n');
                    console.log('📊 Configuration:');
                    console.log('   - Set Name: rs0');
                    console.log('   - Member: localhost:27017\n');
                    
                    console.log('⏳ Waiting 5 seconds for replica set to become ready...\n');
                    
                    // Wait for the replica set to initialize
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    // Check status again
                    try {
                        const newStatus = await admin.command({ replSetGetStatus: 1 });
                        const newState = newStatus.members[0]?.stateStr || 'N/A';
                        console.log('✅ Replica Set Status:');
                        console.log('   - State: ' + newState + '\n');
                        
                        if (newStatus.members[0]?.stateStr === 'PRIMARY') {
                            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                            console.log('🎉 SUCCESS! Replica Set is ready!');
                            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                            
                            console.log('📋 Next Steps:');
                            console.log('   1. Make sure .env has:');
                            console.log('      MONGODB_LOCAL_URI=mongodb://localhost:27017/bomba?replicaSet=rs0');
                            console.log('      BIDIRECTIONAL_SYNC_ENABLED=true\n');
                            console.log('   2. Run: node server/scripts/checkReplicaSet.js\n');
                            console.log('   3. Start server: npm run server:dev\n');
                        } else {
                            console.log('⏳ Replica Set is still initializing (State: ' + newState + ')');
                            console.log('   This is normal. Wait 10 more seconds and run:');
                            console.log('   node server/scripts/checkReplicaSet.js\n');
                        }
                    } catch (statusError) {
                        console.log('⏳ Replica Set is initializing...');
                        console.log('   Wait 10 seconds and run: node server/scripts/checkReplicaSet.js\n');
                    }
                    
                } else {
                    console.log('❌ Failed to initialize Replica Set\n');
                    console.log('Response:', JSON.stringify(result, null, 2));
                }
            } catch (initError) {
                console.log('❌ Error during initialization:', initError.message);
                
                if (initError.message.includes('already initialized')) {
                    console.log('\nℹ️  Replica Set might already be initialized.');
                    console.log('   Run: node server/scripts/checkReplicaSet.js\n');
                } else {
                    console.log('\n💡 Troubleshooting:');
                    console.log('   1. Make sure mongod.cfg has:');
                    console.log('      replication:');
                    console.log('        replSetName: "rs0"');
                    console.log('   2. Restart MongoDB service');
                    console.log('   3. Try running this script again\n');
                }
            }
        }

    } catch (error) {
        console.error('❌ Connection Error:', error.message);
        console.error('\n💡 Troubleshooting:');
        console.error('   1. Make sure MongoDB is running: Get-Service MongoDB');
        console.error('   2. Make sure port 27017 is not blocked');
        console.error('   3. Check MongoDB logs at:');
        console.error('      C:\\Program Files\\MongoDB\\Server\\8.2\\log\\mongod.log\n');
    } finally {
        await client.close();
        console.log('🔌 Disconnected from MongoDB\n');
        process.exit(0);
    }
};

// Run the initialization
initializeReplicaSet();
