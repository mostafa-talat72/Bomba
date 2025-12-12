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
    try {
        // Connect to Local MongoDB
        await mongoose.connect(process.env.MONGODB_URI);

        // Initialize dependencies
        const originTracker = new OriginTracker();
        const conflictResolver = new ConflictResolver();
        const changeProcessor = new ChangeProcessor(originTracker, conflictResolver, null);

        // Test 1: Process Valid Insert Change
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

        // Test 2: Process Invalid Insert Change - Missing Required Field
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

        // Test 3: Process Invalid Insert Change - Wrong Enum Value
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

        // Test 4: Process Invalid Update Change - Negative Value
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

        // Test 5: Process Valid Update Change
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

        // Test 6: Process Invalid Replace Change - Type Mismatch
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

        // Test 7: Check Statistics
        const stats = changeProcessor.getStats();

        // Cleanup
        await Bill.deleteOne({ _id: billToUpdate._id });

        // Validation completed silently
        const allTestsPassed = result1.success && !result2.success && !result3.success && 
                              !result4.success && result5.success && !result6.success;

        process.exit(allTestsPassed ? 0 : 1);

    } catch (error) {
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

// Run tests
testValidationIntegration();