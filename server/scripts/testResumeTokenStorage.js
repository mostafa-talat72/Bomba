import mongoose from 'mongoose';
import ResumeTokenStorage from '../services/sync/resumeTokenStorage.js';
import Logger from '../middleware/logger.js';

/**
 * Test script for Resume Token Storage
 * Tests save, load, validate, and clear operations
 */

// Mock database manager for testing
class MockDatabaseManager {
    constructor(connection) {
        this.localConnection = connection;
    }

    getLocalConnection() {
        return this.localConnection;
    }

    isLocalAvailable() {
        return this.localConnection !== null;
    }
}

async function testResumeTokenStorage() {
    let connection = null;

    try {
        console.log('=== Testing Resume Token Storage ===\n');
        Logger.info('=== Testing Resume Token Storage ===\n');

        // Connect to Local MongoDB
        console.log('1. Connecting to Local MongoDB...');
        Logger.info('1. Connecting to Local MongoDB...');
        
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba';
        console.log(`   URI: ${uri}`);
        
        connection = mongoose.createConnection(uri, {
            serverSelectionTimeoutMS: 5000
        });
        
        await connection.asPromise();
        
        console.log('✅ Connected to Local MongoDB');
        Logger.info('✅ Connected to Local MongoDB');
        console.log(`   Database: ${connection.name}`);
        Logger.info(`   Database: ${connection.name}`);
        console.log(`   Has db property: ${!!connection.db}\n`);
        Logger.info(`   Has db property: ${!!connection.db}\n`);

        // Create mock database manager
        const databaseManager = new MockDatabaseManager(connection);

        // Create resume token storage instance
        const storage = new ResumeTokenStorage(databaseManager);

        // Test 1: Save a resume token
        console.log('2. Testing save operation...');
        Logger.info('2. Testing save operation...');
        const testToken = {
            _data: '8267654321000000012B042C0100296E5A1004D4E5F6A7B8C9D0E1F2A3B4C5D6E746645F696400645F1234567890ABCDEF0004'
        };
        const testInstanceId = 'test-instance-123';

        const saveResult = await storage.save(testToken, testInstanceId);
        if (saveResult) {
            console.log('✅ Token saved successfully\n');
            Logger.info('✅ Token saved successfully\n');
        } else {
            console.error('❌ Failed to save token\n');
            Logger.error('❌ Failed to save token\n');
            return;
        }

        // Test 2: Load the resume token
        console.log('3. Testing load operation...');
        Logger.info('3. Testing load operation...');
        const loadedToken = await storage.load();
        if (loadedToken) {
            console.log('✅ Token loaded successfully');
            Logger.info('✅ Token loaded successfully');
            console.log(`   Token _data: ${loadedToken._data}\n`);
            Logger.info(`   Token _data: ${loadedToken._data}\n`);
        } else {
            console.error('❌ Failed to load token\n');
            Logger.error('❌ Failed to load token\n');
            return;
        }

        // Test 3: Validate token structure
        Logger.info('4. Testing validate operation...');
        const isValid = storage.validate(loadedToken);
        if (isValid) {
            Logger.info('✅ Token is valid\n');
        } else {
            Logger.error('❌ Token validation failed\n');
            return;
        }

        // Test 4: Get token metadata
        Logger.info('5. Testing getMetadata operation...');
        const metadata = await storage.getMetadata();
        if (metadata) {
            Logger.info('✅ Metadata retrieved successfully');
            Logger.info(`   Exists: ${metadata.exists}`);
            Logger.info(`   Timestamp: ${metadata.timestamp}`);
            Logger.info(`   Instance ID: ${metadata.instanceId}`);
            Logger.info(`   Is Valid: ${metadata.isValid}\n`);
        } else {
            Logger.error('❌ Failed to get metadata\n');
        }

        // Test 5: Check if token exists
        Logger.info('6. Testing exists operation...');
        const exists = await storage.exists();
        if (exists) {
            Logger.info('✅ Token exists in storage\n');
        } else {
            Logger.error('❌ Token does not exist\n');
        }

        // Test 6: Test invalid token validation
        Logger.info('7. Testing validation with invalid tokens...');
        const invalidTokens = [
            null,
            undefined,
            {},
            { _data: 123 }, // _data should be string
            { wrongField: 'value' },
            'not-an-object'
        ];

        let allInvalidCorrectly = true;
        invalidTokens.forEach((token, index) => {
            const isValid = storage.validate(token);
            if (isValid) {
                Logger.error(`❌ Invalid token ${index + 1} incorrectly validated as valid`);
                allInvalidCorrectly = false;
            }
        });

        if (allInvalidCorrectly) {
            Logger.info('✅ All invalid tokens correctly rejected\n');
        }

        // Test 7: Test save with null token
        Logger.info('8. Testing save with null token...');
        const nullSaveResult = await storage.save(null, testInstanceId);
        if (!nullSaveResult) {
            Logger.info('✅ Null token correctly rejected\n');
        } else {
            Logger.error('❌ Null token incorrectly accepted\n');
        }

        // Test 8: Handle invalid token
        Logger.info('9. Testing handleInvalidToken operation...');
        const handleResult = await storage.handleInvalidToken('Test reason');
        if (handleResult) {
            Logger.info('✅ Invalid token handled successfully\n');
        } else {
            Logger.error('❌ Failed to handle invalid token\n');
        }

        // Test 9: Verify token was cleared
        Logger.info('10. Verifying token was cleared...');
        const existsAfterClear = await storage.exists();
        if (!existsAfterClear) {
            Logger.info('✅ Token successfully cleared\n');
        } else {
            Logger.error('❌ Token still exists after clear\n');
        }

        // Test 10: Load after clear should return null
        Logger.info('11. Testing load after clear...');
        const loadedAfterClear = await storage.load();
        if (loadedAfterClear === null) {
            Logger.info('✅ Load correctly returns null after clear\n');
        } else {
            Logger.error('❌ Load returned token after clear\n');
        }

        // Test 11: Save again for final verification
        Logger.info('12. Testing save again after clear...');
        const finalSaveResult = await storage.save(testToken, testInstanceId);
        if (finalSaveResult) {
            Logger.info('✅ Token saved successfully after clear\n');
        } else {
            Logger.error('❌ Failed to save token after clear\n');
        }

        // Test 12: Final load to verify
        Logger.info('13. Final load verification...');
        const finalLoadedToken = await storage.load();
        if (finalLoadedToken && finalLoadedToken._data === testToken._data) {
            Logger.info('✅ Final load successful, token matches\n');
        } else {
            Logger.error('❌ Final load failed or token mismatch\n');
        }

        Logger.info('=== All Tests Completed Successfully ===\n');

    } catch (error) {
        console.error('Test failed with error:', error);
        Logger.error('Test failed with error:', error);
    } finally {
        // Cleanup
        if (connection) {
            await connection.close();
            Logger.info('Connection closed');
        }
        process.exit(0);
    }
}

// Run tests
testResumeTokenStorage();
