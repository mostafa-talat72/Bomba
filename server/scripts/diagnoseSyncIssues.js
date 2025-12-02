import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

/**
 * Comprehensive sync diagnosis script
 * Checks all aspects of the sync system
 */

const diagnoseSyncIssues = async () => {
    console.log('\n🔍 Diagnosing Sync System...\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const issues = [];
    const warnings = [];
    const successes = [];

    // Check 1: Environment variables
    console.log('1️⃣  Checking environment variables...\n');
    
    const syncEnabled = process.env.SYNC_ENABLED === 'true';
    const atlasUri = process.env.MONGODB_ATLAS_URI;
    const localUri = process.env.MONGODB_LOCAL_URI;
    const workerInterval = parseInt(process.env.SYNC_WORKER_INTERVAL || '100');
    
    if (!syncEnabled) {
        issues.push('SYNC_ENABLED is false - sync is disabled');
    } else {
        successes.push('SYNC_ENABLED is true');
    }
    
    if (!atlasUri) {
        issues.push('MONGODB_ATLAS_URI is not set');
    } else {
        successes.push('MONGODB_ATLAS_URI is configured');
    }
    
    if (!localUri) {
        warnings.push('MONGODB_LOCAL_URI not set, using default');
    } else {
        successes.push('MONGODB_LOCAL_URI is configured');
    }
    
    if (workerInterval < 50) {
        warnings.push(`SYNC_WORKER_INTERVAL is ${workerInterval}ms - very fast, may impact performance`);
    } else if (workerInterval > 500) {
        warnings.push(`SYNC_WORKER_INTERVAL is ${workerInterval}ms - slow, sync may be delayed`);
    } else {
        successes.push(`SYNC_WORKER_INTERVAL is ${workerInterval}ms - good`);
    }
    
    console.log('');

    // Check 2: Local MongoDB connection
    console.log('2️⃣  Checking Local MongoDB connection...\n');
    
    let localConnection = null;
    try {
        const localUriToUse = localUri || 'mongodb://localhost:27017/bomba?replicaSet=rs0';
        localConnection = mongoose.createConnection(localUriToUse);
        await new Promise((resolve, reject) => {
            localConnection.once('open', resolve);
            localConnection.once('error', reject);
            setTimeout(() => reject(new Error('Timeout')), 10000);
        });
        successes.push('Local MongoDB connection successful');
        console.log('   ✅ Connected to Local MongoDB\n');
    } catch (error) {
        issues.push(`Local MongoDB connection failed: ${error.message}`);
        console.log('   ❌ Failed to connect to Local MongoDB\n');
    }

    // Check 3: Atlas MongoDB connection
    console.log('3️⃣  Checking Atlas MongoDB connection...\n');
    
    let atlasConnection = null;
    if (atlasUri) {
        try {
            atlasConnection = mongoose.createConnection(atlasUri);
            await new Promise((resolve, reject) => {
                atlasConnection.once('open', resolve);
                atlasConnection.once('error', reject);
                setTimeout(() => reject(new Error('Timeout')), 15000);
            });
            successes.push('Atlas MongoDB connection successful');
            console.log('   ✅ Connected to Atlas MongoDB\n');
        } catch (error) {
            issues.push(`Atlas MongoDB connection failed: ${error.message}`);
            console.log('   ❌ Failed to connect to Atlas MongoDB\n');
        }
    } else {
        issues.push('Atlas URI not configured');
    }

    // Check 4: Test sync operation
    if (localConnection && atlasConnection && syncEnabled) {
        console.log('4️⃣  Testing sync operation...\n');
        
        try {
            const testId = new mongoose.Types.ObjectId();
            const testDoc = {
                _id: testId,
                tableNumber: 'DIAG-TEST-' + Date.now(),
                status: 'open',
                items: [],
                totalAmount: 0,
                createdAt: new Date(),
                __diagnostic: true
            };
            
            // Insert in Local
            const localCollection = localConnection.db.collection('bills');
            await localCollection.insertOne(testDoc);
            console.log('   ✅ Test document created in Local\n');
            
            // Wait for sync
            console.log('   ⏳ Waiting 3 seconds for sync...\n');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Check in Atlas
            const atlasCollection = atlasConnection.db.collection('bills');
            const foundInAtlas = await atlasCollection.findOne({ _id: testId });
            
            if (foundInAtlas) {
                successes.push('Sync test successful - document found in Atlas');
                console.log('   ✅ Test document found in Atlas\n');
            } else {
                issues.push('Sync test failed - document NOT found in Atlas after 3 seconds');
                console.log('   ❌ Test document NOT found in Atlas\n');
            }
            
            // Cleanup
            await localCollection.deleteOne({ _id: testId });
            if (foundInAtlas) {
                await atlasCollection.deleteOne({ _id: testId });
            }
            
        } catch (error) {
            issues.push(`Sync test error: ${error.message}`);
            console.log('   ❌ Sync test failed:', error.message, '\n');
        }
    } else {
        console.log('4️⃣  Skipping sync test (connections not available)\n');
    }

    // Print summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Diagnosis Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (successes.length > 0) {
        console.log('✅ Successes:');
        successes.forEach(s => console.log('   - ' + s));
        console.log('');
    }
    
    if (warnings.length > 0) {
        console.log('⚠️  Warnings:');
        warnings.forEach(w => console.log('   - ' + w));
        console.log('');
    }
    
    if (issues.length > 0) {
        console.log('❌ Issues:');
        issues.forEach(i => console.log('   - ' + i));
        console.log('');
    }
    
    if (issues.length === 0) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 All checks passed! Sync system is healthy.');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } else {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('⚠️  Issues found! Please fix the issues above.');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        console.log('💡 Troubleshooting steps:');
        console.log('   1. Make sure server is running: npm run server:dev');
        console.log('   2. Check .env file for correct configuration');
        console.log('   3. Verify Atlas connection: npm run test:atlas');
        console.log('   4. Check server logs for sync errors');
        console.log('   5. Restart server after fixing issues\n');
    }

    // Cleanup
    if (localConnection) await localConnection.close();
    if (atlasConnection) await atlasConnection.close();
    
    process.exit(issues.length > 0 ? 1 : 0);
};

// Run diagnosis
diagnoseSyncIssues();
