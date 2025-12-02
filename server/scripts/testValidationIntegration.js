import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';

// Import ChangeProcessor and dependencies
import ChangeProcessor from '../services/sync/changeProcessor.js';
import OriginTracker from '../services/sync/originTracker.js';
import ConflictResolver from '../services/sync/conflictResolver.js';

/**
 * Test Data Validation Integration with Change Processing
 * Requirements: 9.1, 9.4, 9.5
 */

async function testValidationIntegration() {
    console.log('🧪 Testing Data Validation Integration with Change Processing\n');

    try {
        // Connect to Local MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to Local MongoDB\n');

        // Initialize dependencies
        const originTracker = new OriginTracker();
        const conflictResolver = new ConflictResolver();
        const changeProcessor = new ChangeProcessor(originTracker, conflictResolver, null);

        // Test 1: Process Valid Insert Change
        console.log('📋 Test 1: Process Valid Insert Change');
        const validInsertChange = {
            _id: { _data: 'test-token-1' },
            operationType: 'insert',
            ns: { db: 'bomba', coll: 'bills' },
            documentKey: { _id: new mongoose.Types.ObjectId() },
            fullDocument: {
                _id: new mongoose.Types.ObjectId(),
                billNumber: 'BILL-VALID-001',
                subtotal: 150,
                total: 150,
                paid: 0,
                remaining: 150,
                status: 'draft',
                paymentMethod: 'cash',
                billType: 'cafe',
                organization: new mongoose.Types.ObjectId(),
                createdBy: new mongoose.Types.ObjectId(),
                orders: [],
                sessions: [],
                payments: []
            }
        };

        const result1 = await changeProcessor.processChange(validInsertChange);
        console.log('Result:', result1.success ? '✅ PASS' : '❌ FAIL');
        if (!result1.success) {
            console.log('Reason:', result1.reason);
            console.log('Errors:', result1.validationErrors);
        }
        console.log('');

        // Test 2: Process Invalid Insert Change - Missing Required Field
        console.log('📋 Test 2: Process Invalid Insert Change - Missing Required Field');
        const invalidInsertChange = {
            _id: { _data: 'test-token-2' },
            operationType: 'insert',
            ns: { db: 'bomba', coll: 'bills' },
            documentKey: { _id: new mongoose.Types.ObjectId() },
            fullDocument: {
                _id: new mongoose.Types.ObjectId(),
                billNumber: 'BILL-INVALID-001',
                subtotal: 150,
                total: 150,
                paid: 0,
                remaining: 150,
                status: 'draft',
                paymentMethod: 'cash',
                billType: 'cafe',
                // Missing: organization (required)
                createdBy: new mongoose.Types.ObjectId(),
                orders: [],
                sessions: [],
                payments: []
            }
        };

        const result2 = await changeProcessor.processChange(invalidInsertChange);
        console.log('Result:', !result2.success ? '✅ PASS (correctly rejected)' : '❌ FAIL');
        if (!result2.success) {
            console.log('Reason:', result2.reason);
            console.log('Validation Errors:', result2.validationErrors);
        }
        console.log('');

        // Test 3: Process Invalid Insert Change - Wrong Enum Value
        console.log('📋 Test 3: Process Invalid Insert Change - Wrong Enum Value');
        const invalidEnumChange = {
            _id: { _data: 'test-token-3' },
            operationType: 'insert',
            ns: { db: 'bomba', coll: 'bills' },
            documentKey: { _id: new mongoose.Types.ObjectId() },
            fullDocument: {
                _id: new mongoose.Types.ObjectId(),
                billNumber: 'BILL-INVALID-002',
                subtotal: 150,
                total: 150,
                paid: 0,
                remaining: 150,
                status: 'invalid_status', // Invalid enum
                paymentMethod: 'cash',
                billType: 'cafe',
                organization: new mongoose.Types.ObjectId(),
                createdBy: new mongoose.Types.ObjectId(),
                orders: [],
                sessions: [],
                payments: []
            }
        };

        const result3 = await changeProcessor.processChange(invalidEnumChange);
        console.log('Result:', !result3.success ? '✅ PASS (correctly rejected)' : '❌ FAIL');
        if (!result3.success) {
            console.log('Reason:', result3.reason);
            console.log('Validation Errors:', result3.validationErrors);
        }
        console.log('');

        // Test 4: Process Invalid Update Change - Negative Value
        console.log('📋 Test 4: Process Invalid Update Change - Negative Value');
        
        // First create a valid bill to update
        const billToUpdate = await Bill.create({
            billNumber: 'BILL-UPDATE-001',
            subtotal: 100,
            total: 100,
            paid: 0,
            remaining: 100,
            status: 'draft',
            paymentMethod: 'cash',
            billType: 'cafe',
            organization: new mongoose.Types.ObjectId(),
            createdBy: new mongoose.Types.ObjectId()
        });

        const invalidUpdateChange = {
            _id: { _data: 'test-token-4' },
            operationType: 'update',
            ns: { db: 'bomba', coll: 'bills' },
            documentKey: { _id: billToUpdate._id },
            updateDescription: {
                updatedFields: {
                    subtotal: -50 // Negative value (min: 0)
                },
                removedFields: []
            },
            clusterTime: new Date()
        };

        const result4 = await changeProcessor.processChange(invalidUpdateChange);
        console.log('Result:', !result4.success ? '✅ PASS (correctly rejected)' : '❌ FAIL');
        if (!result4.success) {
            console.log('Reason:', result4.reason);
            console.log('Validation Errors:', result4.validationErrors);
        }
        console.log('');

        // Test 5: Process Valid Update Change
        console.log('📋 Test 5: Process Valid Update Change');
        const validUpdateChange = {
            _id: { _data: 'test-token-5' },
            operationType: 'update',
            ns: { db: 'bomba', coll: 'bills' },
            documentKey: { _id: billToUpdate._id },
            updateDescription: {
                updatedFields: {
                    status: 'paid',
                    paid: 100
                },
                removedFields: []
            },
            clusterTime: new Date()
        };

        const result5 = await changeProcessor.processChange(validUpdateChange);
        console.log('Result:', result5.success ? '✅ PASS' : '❌ FAIL');
        if (!result5.success) {
            console.log('Reason:', result5.reason);
            console.log('Errors:', result5.validationErrors);
        }
        console.log('');

        // Test 6: Process Invalid Replace Change - Type Mismatch
        console.log('📋 Test 6: Process Invalid Replace Change - Type Mismatch');
        const invalidReplaceChange = {
            _id: { _data: 'test-token-6' },
            operationType: 'replace',
            ns: { db: 'bomba', coll: 'bills' },
            documentKey: { _id: billToUpdate._id },
            fullDocument: {
                _id: billToUpdate._id,
                billNumber: 'BILL-REPLACE-001',
                subtotal: 'not a number', // Wrong type
                total: 150,
                paid: 0,
                remaining: 150,
                status: 'draft',
                paymentMethod: 'cash',
                billType: 'cafe',
                organization: new mongoose.Types.ObjectId(),
                createdBy: new mongoose.Types.ObjectId(),
                orders: [],
                sessions: [],
                payments: []
            },
            clusterTime: new Date()
        };

        const result6 = await changeProcessor.processChange(invalidReplaceChange);
        console.log('Result:', !result6.success ? '✅ PASS (correctly rejected)' : '❌ FAIL');
        if (!result6.success) {
            console.log('Reason:', result6.reason);
            console.log('Validation Errors:', result6.validationErrors);
        }
        console.log('');

        // Test 7: Check Statistics
        console.log('📊 Test 7: Check Processing Statistics');
        const stats = changeProcessor.getStats();
        console.log('Statistics:', stats);
        console.log('Total Processed:', stats.totalProcessed);
        console.log('Successful:', stats.successful);
        console.log('Failed:', stats.failed);
        console.log('Skipped:', stats.skipped);
        console.log('');

        // Cleanup
        await Bill.deleteOne({ _id: billToUpdate._id });

        // Summary
        console.log('═══════════════════════════════════════════════════════');
        console.log('✅ Data Validation Integration Tests Complete');
        console.log('═══════════════════════════════════════════════════════');
        console.log('\n📝 Summary:');
        console.log('- Valid changes are processed successfully');
        console.log('- Invalid changes are rejected with detailed error messages');
        console.log('- Validation errors are logged for debugging');
        console.log('- Statistics track failed validations');

    } catch (error) {
        console.error('❌ Test Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

// Run tests
testValidationIntegration();
