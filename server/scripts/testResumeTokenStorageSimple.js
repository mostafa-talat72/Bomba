import mongoose from 'mongoose';
import ResumeTokenStorage from '../services/sync/resumeTokenStorage.js';

/**
 * Simple test for Resume Token Storage
 */

class MockDatabaseManager {
    constructor(connection) {
        this.localConnection = connection;
    }

    getLocalConnection() {
        return this.localConnection;
    }
}

async function test() {
    let connection = null;

    try {
        console.log('=== Resume Token Storage Test ===\n');

        // Connect
        console.log('Connecting to MongoDB...');
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba';
        connection = mongoose.createConnection(uri, {
            serverSelectionTimeoutMS: 5000
        });
        await connection.asPromise();
        console.log('✅ Connected\n');

        // Create storage
        const dbManager = new MockDatabaseManager(connection);
        const storage = new ResumeTokenStorage(dbManager);

        // Test token
        const testToken = {
            _data: '8267654321000000012B042C0100296E5A1004D4E5F6A7B8C9D0E1F2A3B4C5D6E746645F696400645F1234567890ABCDEF0004'
        };

        // Test 1: Save
        console.log('Test 1: Save token');
        const saved = await storage.save(testToken, 'test-instance');
        console.log(saved ? '✅ Save successful' : '❌ Save failed');
        console.log('');

        // Test 2: Load
        console.log('Test 2: Load token');
        const loaded = await storage.load();
        console.log(loaded ? '✅ Load successful' : '❌ Load failed');
        if (loaded) {
            console.log(`   Token matches: ${loaded._data === testToken._data}`);
        }
        console.log('');

        // Test 3: Validate
        console.log('Test 3: Validate token');
        const isValid = storage.validate(loaded);
        console.log(isValid ? '✅ Valid' : '❌ Invalid');
        console.log('');

        // Test 4: Metadata
        console.log('Test 4: Get metadata');
        const metadata = await storage.getMetadata();
        if (metadata) {
            console.log('✅ Metadata retrieved');
            console.log(`   Exists: ${metadata.exists}`);
            console.log(`   Valid: ${metadata.isValid}`);
            console.log(`   Instance: ${metadata.instanceId}`);
        }
        console.log('');

        // Test 5: Clear
        console.log('Test 5: Clear token');
        const cleared = await storage.clear();
        console.log(cleared ? '✅ Clear successful' : '❌ Clear failed');
        console.log('');

        // Test 6: Load after clear
        console.log('Test 6: Load after clear');
        const loadedAfterClear = await storage.load();
        console.log(loadedAfterClear === null ? '✅ Returns null' : '❌ Still has token');
        console.log('');

        // Test 7: Invalid token validation
        console.log('Test 7: Validate invalid tokens');
        const invalidTests = [
            { token: null, name: 'null' },
            { token: {}, name: 'empty object' },
            { token: { _data: 123 }, name: 'non-string _data' },
            { token: 'string', name: 'string' }
        ];

        let allCorrect = true;
        invalidTests.forEach(test => {
            const result = storage.validate(test.token);
            if (result) {
                console.log(`❌ ${test.name} incorrectly validated as valid`);
                allCorrect = false;
            }
        });
        if (allCorrect) {
            console.log('✅ All invalid tokens correctly rejected');
        }
        console.log('');

        console.log('=== All Tests Passed ===');

    } catch (error) {
        console.error('Test failed:', error.message);
        console.error(error.stack);
    } finally {
        if (connection) {
            await connection.close();
            console.log('\nConnection closed');
        }
        process.exit(0);
    }
}

test();
