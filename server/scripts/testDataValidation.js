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
import Session from '../models/Session.js';

// Import ChangeProcessor and dependencies
import ChangeProcessor from '../services/sync/changeProcessor.js';
import OriginTracker from '../services/sync/originTracker.js';
import ConflictResolver from '../services/sync/conflictResolver.js';

/**
 * Test Data Validation in Change Processor
 * Requirements: 9.1, 9.4, 9.5
 */

async function testDataValidation() {
    console.log('🧪 Testing Data Validation in Change Processor\n');

    try {
        // Connect to Local MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to Local MongoDB\n');

        // Initialize dependencies
        const originTracker = new OriginTracker();
        const conflictResolver = new ConflictResolver();
        const changeProcessor = new ChangeProcessor(originTracker, conflictResolver, null);

        // Test 1: Valid Bill Document
        console.log('📋 Test 1: Valid Bill Document');
        const validBill = {
            _id: new mongoose.Types.ObjectId(),
            billNumber: 'BILL-TEST-001',
            subtotal: 100,
            total: 100,
            paid: 0,
            remaining: 100,
            status: 'draft',
            paymentMethod: 'cash',
            billType: 'cafe',
            organization: new mongoose.Types.ObjectId(),
            createdBy: new mongoose.Types.ObjectId(),
            orders: [],
            sessions: [],
            payments: []
        };

        const validResult = changeProcessor.validateDocumentData(validBill, 'bills', 'insert');
        console.log('Result:', validResult.success ? '✅ PASS' : '❌ FAIL');
        if (!validResult.success) {
            console.log('Errors:', validResult.errors);
        }
        console.log('');

        // Test 2: Invalid Bill - Missing Required Field
        console.log('📋 Test 2: Invalid Bill - Missing Required Field (organization)');
        const invalidBillMissingField = {
            _id: new mongoose.Types.ObjectId(),
            billNumber: 'BILL-TEST-002',
            subtotal: 100,
            total: 100,
            paid: 0,
            remaining: 100,
            status: 'draft',
            paymentMethod: 'cash',
            billType: 'cafe',
            createdBy: new mongoose.Types.ObjectId(),
            orders: [],
            sessions: [],
            payments: []
            // Missing: organization (required)
        };

        const missingFieldResult = changeProcessor.validateDocumentData(
            invalidBillMissingField, 
            'bills', 
            'insert'
        );
        console.log('Result:', !missingFieldResult.success ? '✅ PASS (correctly rejected)' : '❌ FAIL');
        if (!missingFieldResult.success) {
            console.log('Errors:', missingFieldResult.errors);
        }
        console.log('');

        // Test 3: Invalid Bill - Wrong Enum Value
        console.log('📋 Test 3: Invalid Bill - Wrong Enum Value (status)');
        const invalidBillEnum = {
            _id: new mongoose.Types.ObjectId(),
            billNumber: 'BILL-TEST-003',
            subtotal: 100,
            total: 100,
            paid: 0,
            remaining: 100,
            status: 'invalid_status', // Invalid enum value
            paymentMethod: 'cash',
            billType: 'cafe',
            organization: new mongoose.Types.ObjectId(),
            createdBy: new mongoose.Types.ObjectId(),
            orders: [],
            sessions: [],
            payments: []
        };

        const enumResult = changeProcessor.validateDocumentData(invalidBillEnum, 'bills', 'insert');
        console.log('Result:', !enumResult.success ? '✅ PASS (correctly rejected)' : '❌ FAIL');
        if (!enumResult.success) {
            console.log('Errors:', enumResult.errors);
        }
        console.log('');

        // Test 4: Invalid Bill - Negative Number
        console.log('📋 Test 4: Invalid Bill - Negative Number (subtotal)');
        const invalidBillNegative = {
            _id: new mongoose.Types.ObjectId(),
            billNumber: 'BILL-TEST-004',
            subtotal: -50, // Negative value (min: 0)
            total: 100,
            paid: 0,
            remaining: 100,
            status: 'draft',
            paymentMethod: 'cash',
            billType: 'cafe',
            organization: new mongoose.Types.ObjectId(),
            createdBy: new mongoose.Types.ObjectId(),
            orders: [],
            sessions: [],
            payments: []
        };

        const negativeResult = changeProcessor.validateDocumentData(
            invalidBillNegative, 
            'bills', 
            'insert'
        );
        console.log('Result:', !negativeResult.success ? '✅ PASS (correctly rejected)' : '❌ FAIL');
        if (!negativeResult.success) {
            console.log('Errors:', negativeResult.errors);
        }
        console.log('');

        // Test 5: Invalid Bill - Wrong Type
        console.log('📋 Test 5: Invalid Bill - Wrong Type (total should be Number)');
        const invalidBillType = {
            _id: new mongoose.Types.ObjectId(),
            billNumber: 'BILL-TEST-005',
            subtotal: 100,
            total: 'not a number', // Wrong type
            paid: 0,
            remaining: 100,
            status: 'draft',
            paymentMethod: 'cash',
            billType: 'cafe',
            organization: new mongoose.Types.ObjectId(),
            createdBy: new mongoose.Types.ObjectId(),
            orders: [],
            sessions: [],
            payments: []
        };

        const typeResult = changeProcessor.validateDocumentData(invalidBillType, 'bills', 'insert');
        console.log('Result:', !typeResult.success ? '✅ PASS (correctly rejected)' : '❌ FAIL');
        if (!typeResult.success) {
            console.log('Errors:', typeResult.errors);
        }
        console.log('');

        // Test 6: Valid Order Document
        console.log('📦 Test 6: Valid Order Document');
        const validOrder = {
            _id: new mongoose.Types.ObjectId(),
            orderNumber: 'ORD-TEST-001',
            subtotal: 50,
            finalAmount: 50,
            status: 'pending',
            items: [],
            organization: new mongoose.Types.ObjectId(),
            createdBy: new mongoose.Types.ObjectId()
        };

        const validOrderResult = changeProcessor.validateDocumentData(validOrder, 'orders', 'insert');
        console.log('Result:', validOrderResult.success ? '✅ PASS' : '❌ FAIL');
        if (!validOrderResult.success) {
            console.log('Errors:', validOrderResult.errors);
        }
        console.log('');

        // Test 7: Invalid Order - Wrong Status Enum
        console.log('📦 Test 7: Invalid Order - Wrong Status Enum');
        const invalidOrder = {
            _id: new mongoose.Types.ObjectId(),
            orderNumber: 'ORD-TEST-002',
            subtotal: 50,
            finalAmount: 50,
            status: 'invalid_status', // Invalid enum
            items: [],
            organization: new mongoose.Types.ObjectId(),
            createdBy: new mongoose.Types.ObjectId()
        };

        const invalidOrderResult = changeProcessor.validateDocumentData(invalidOrder, 'orders', 'insert');
        console.log('Result:', !invalidOrderResult.success ? '✅ PASS (correctly rejected)' : '❌ FAIL');
        if (!invalidOrderResult.success) {
            console.log('Errors:', invalidOrderResult.errors);
        }
        console.log('');

        // Test 8: Valid Session Document
        console.log('🎮 Test 8: Valid Session Document');
        const validSession = {
            _id: new mongoose.Types.ObjectId(),
            deviceNumber: 'PS-001',
            deviceName: 'PlayStation 1',
            deviceId: new mongoose.Types.ObjectId(),
            deviceType: 'playstation',
            startTime: new Date(),
            status: 'active',
            controllers: 2,
            totalCost: 0,
            finalCost: 0,
            organization: new mongoose.Types.ObjectId(),
            createdBy: new mongoose.Types.ObjectId(),
            controllersHistory: []
        };

        const validSessionResult = changeProcessor.validateDocumentData(validSession, 'sessions', 'insert');
        console.log('Result:', validSessionResult.success ? '✅ PASS' : '❌ FAIL');
        if (!validSessionResult.success) {
            console.log('Errors:', validSessionResult.errors);
        }
        console.log('');

        // Test 9: Invalid Session - Controllers Out of Range
        console.log('🎮 Test 9: Invalid Session - Controllers Out of Range');
        const invalidSession = {
            _id: new mongoose.Types.ObjectId(),
            deviceNumber: 'PS-002',
            deviceName: 'PlayStation 2',
            deviceId: new mongoose.Types.ObjectId(),
            deviceType: 'playstation',
            startTime: new Date(),
            status: 'active',
            controllers: 5, // Max is 4
            totalCost: 0,
            finalCost: 0,
            organization: new mongoose.Types.ObjectId(),
            createdBy: new mongoose.Types.ObjectId(),
            controllersHistory: []
        };

        const invalidSessionResult = changeProcessor.validateDocumentData(
            invalidSession, 
            'sessions', 
            'insert'
        );
        console.log('Result:', !invalidSessionResult.success ? '✅ PASS (correctly rejected)' : '❌ FAIL');
        if (!invalidSessionResult.success) {
            console.log('Errors:', invalidSessionResult.errors);
        }
        console.log('');

        // Test 10: Update Operation - Partial Document
        console.log('🔄 Test 10: Update Operation - Partial Document (should not check required fields)');
        const partialUpdate = {
            status: 'paid',
            paid: 100
        };

        const updateResult = changeProcessor.validateDocumentData(partialUpdate, 'bills', 'update');
        console.log('Result:', updateResult.success ? '✅ PASS' : '❌ FAIL');
        if (!updateResult.success) {
            console.log('Errors:', updateResult.errors);
        }
        console.log('');

        // Summary
        console.log('═══════════════════════════════════════════════════════');
        console.log('✅ Data Validation Tests Complete');
        console.log('═══════════════════════════════════════════════════════');

    } catch (error) {
        console.error('❌ Test Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

// Run tests
testDataValidation();
