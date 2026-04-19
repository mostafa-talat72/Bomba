/**
 * Test Atlas Connection
 * Run with: node server/test-atlas-connection.js
 */

import './config/env-loader.js';
import mongoose from 'mongoose';

console.log('\n═══════════════════════════════════════════════════════════');
console.log('🧪 ATLAS CONNECTION TEST');
console.log('═══════════════════════════════════════════════════════════\n');

const ATLAS_URI = process.env.MONGODB_ATLAS_URI;

if (!ATLAS_URI) {
    console.log('❌ ERROR: MONGODB_ATLAS_URI not found in .env');
    process.exit(1);
}

console.log('📋 Connection Details:');
console.log(`   URI: ${ATLAS_URI.replace(/\/\/.*@/, '//***@')}`);
console.log('');

console.log('📋 Step 1: Attempting to connect to Atlas...');
console.log('   This may take up to 60 seconds...\n');

const startTime = Date.now();

try {
    await mongoose.connect(ATLAS_URI);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('✅ SUCCESS: Connected to Atlas!');
    console.log(`   Connection time: ${duration}s`);
    console.log(`   Host: ${mongoose.connection.host}`);
    console.log(`   Database: ${mongoose.connection.name}`);
    console.log(`   Ready State: ${mongoose.connection.readyState} (1 = connected)`);
    console.log('');
    
    // Test if Change Streams are available
    console.log('📋 Step 2: Testing Change Streams availability...');
    
    try {
        const db = mongoose.connection.db;
        
        // Try to create a Change Stream (will fail if not supported)
        const changeStream = db.watch([], { 
            maxAwaitTimeMS: 5000,
            fullDocument: 'updateLookup'
        });
        
        console.log('   ✅ Change Streams are available!');
        console.log('   This means bidirectional sync CAN work.\n');
        
        // Close the test Change Stream
        await changeStream.close();
        
    } catch (csError) {
        console.log('   ❌ Change Streams are NOT available');
        console.log(`   Error: ${csError.message}`);
        console.log('');
        console.log('   💡 Possible reasons:');
        console.log('      - Free tier (M0) cluster (Change Streams require M10+)');
        console.log('      - Cluster is not a replica set');
        console.log('      - Insufficient permissions\n');
    }
    
    // Close connection
    await mongoose.connection.close();
    console.log('✅ Connection closed successfully');
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ TEST PASSED - Atlas connection is working!');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('📝 Next steps:');
    console.log('   1. Restart your server');
    console.log('   2. Bidirectional sync should now work');
    console.log('   3. Check sync status monitor for "Active" status\n');
    
} catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`❌ FAILED: Could not connect to Atlas (after ${duration}s)`);
    console.log(`   Error: ${error.message}`);
    console.log('');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('❌ TEST FAILED - Atlas connection is not working');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('💡 Possible solutions:\n');
    
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
        console.log('🔍 TIMEOUT ERROR - Connection is too slow or blocked\n');
        console.log('   Solutions:');
        console.log('   1. Check your internet connection');
        console.log('   2. Check if port 27017 is blocked by firewall');
        console.log('   3. Try using a VPN');
        console.log('   4. Whitelist your IP in Atlas Network Access');
        console.log('   5. Check if Atlas cluster is in a far region (high latency)\n');
        
    } else if (error.message.includes('authentication') || error.message.includes('auth')) {
        console.log('🔍 AUTHENTICATION ERROR - Wrong credentials\n');
        console.log('   Solutions:');
        console.log('   1. Check username and password in MONGODB_ATLAS_URI');
        console.log('   2. Verify database user exists in Atlas');
        console.log('   3. Check user permissions\n');
        
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        console.log('🔍 DNS ERROR - Cannot resolve Atlas hostname\n');
        console.log('   Solutions:');
        console.log('   1. Check your internet connection');
        console.log('   2. Check DNS settings');
        console.log('   3. Try using Google DNS (8.8.8.8)\n');
        
    } else {
        console.log('🔍 UNKNOWN ERROR\n');
        console.log('   Solutions:');
        console.log('   1. Check Atlas cluster status (running/paused)');
        console.log('   2. Whitelist your IP in Atlas Network Access');
        console.log('   3. Check firewall settings');
        console.log('   4. Verify MONGODB_ATLAS_URI is correct\n');
    }
    
    console.log('📚 For more help, see: FIX_BIDIRECTIONAL_SYNC.md\n');
}

process.exit(0);
