import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Import models
import '../models/Bill.js';
import '../models/User.js';
import '../models/Organization.js';

const Bill = mongoose.model('Bill');
const User = mongoose.model('User');
const Organization = mongoose.model('Organization');

async function testBillStatusCalculation() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get a user and organization for testing
        const user = await User.findOne();
        const organization = await Organization.findOne();

        if (!user || !organization) {
            console.log('❌ No user or organization found. Please create them first.');
            return;
        }

        console.log('📋 Testing Bill Status Calculation Logic\n');
        console.log('=' .repeat(60));

        // Test 1: Create a bill with items, all unpaid (should be "draft")
        console.log('\n🧪 Test 1: Bill with all items unpaid');
        const bill1 = new Bill({
            createdBy: user._id,
            organization: organization._id,
            billType: 'cafe',
            subtotal: 100,
            total: 100,
            paid: 0,
            itemPayments: [
                {
                    orderId: new mongoose.Types.ObjectId(),
                    itemId: 'item1',
                    itemName: 'Coffee',
                    quantity: 2,
                    paidQuantity: 0,
                    pricePerUnit: 25,
                    totalPrice: 50,
                    paidAmount: 0,
                    isPaid: false,
                    paymentHistory: []
                },
                {
                    orderId: new mongoose.Types.ObjectId(),
                    itemId: 'item2',
                    itemName: 'Tea',
                    quantity: 2,
                    paidQuantity: 0,
                    pricePerUnit: 25,
                    totalPrice: 50,
                    paidAmount: 0,
                    isPaid: false,
                    paymentHistory: []
                }
            ]
        });
        await bill1.save();
        console.log(`   Status: ${bill1.status}`);
        console.log(`   Expected: draft`);
        console.log(`   ✅ ${bill1.status === 'draft' ? 'PASS' : 'FAIL'}`);

        // Test 2: Pay for partial quantity of one item (should be "partial")
        console.log('\n🧪 Test 2: Bill with partial payment on one item');
        bill1.itemPayments[0].paidQuantity = 1; // Pay for 1 out of 2
        bill1.itemPayments[0].paidAmount = 25;
        bill1.paid = 25;
        await bill1.save();
        console.log(`   Status: ${bill1.status}`);
        console.log(`   Expected: partial`);
        console.log(`   ✅ ${bill1.status === 'partial' ? 'PASS' : 'FAIL'}`);

        // Test 3: Pay for all quantity of first item, but not second (should be "partial")
        console.log('\n🧪 Test 3: Bill with one item fully paid, one unpaid');
        bill1.itemPayments[0].paidQuantity = 2; // Pay for all 2
        bill1.itemPayments[0].paidAmount = 50;
        bill1.paid = 50;
        await bill1.save();
        console.log(`   Status: ${bill1.status}`);
        console.log(`   Expected: partial`);
        console.log(`   ✅ ${bill1.status === 'partial' ? 'PASS' : 'FAIL'}`);

        // Test 4: Pay for all items fully (should be "paid")
        console.log('\n🧪 Test 4: Bill with all items fully paid');
        bill1.itemPayments[1].paidQuantity = 2; // Pay for all 2 of second item
        bill1.itemPayments[1].paidAmount = 50;
        bill1.paid = 100;
        await bill1.save();
        console.log(`   Status: ${bill1.status}`);
        console.log(`   Expected: paid`);
        console.log(`   ✅ ${bill1.status === 'paid' ? 'PASS' : 'FAIL'}`);

        // Test 5: Create bill with sessions
        console.log('\n🧪 Test 5: Bill with session, unpaid');
        const bill2 = new Bill({
            createdBy: user._id,
            organization: organization._id,
            billType: 'playstation',
            subtotal: 50,
            total: 50,
            paid: 0,
            sessionPayments: [
                {
                    sessionId: new mongoose.Types.ObjectId(),
                    sessionCost: 50,
                    paidAmount: 0,
                    remainingAmount: 50,
                    payments: []
                }
            ]
        });
        await bill2.save();
        console.log(`   Status: ${bill2.status}`);
        console.log(`   Expected: draft`);
        console.log(`   ✅ ${bill2.status === 'draft' ? 'PASS' : 'FAIL'}`);

        // Test 6: Partial payment on session
        console.log('\n🧪 Test 6: Bill with partial session payment');
        bill2.sessionPayments[0].paidAmount = 25;
        bill2.sessionPayments[0].remainingAmount = 25;
        bill2.paid = 25;
        await bill2.save();
        console.log(`   Status: ${bill2.status}`);
        console.log(`   Expected: partial`);
        console.log(`   ✅ ${bill2.status === 'partial' ? 'PASS' : 'FAIL'}`);

        // Test 7: Full payment on session
        console.log('\n🧪 Test 7: Bill with full session payment');
        bill2.sessionPayments[0].paidAmount = 50;
        bill2.sessionPayments[0].remainingAmount = 0;
        bill2.paid = 50;
        await bill2.save();
        console.log(`   Status: ${bill2.status}`);
        console.log(`   Expected: paid`);
        console.log(`   ✅ ${bill2.status === 'paid' ? 'PASS' : 'FAIL'}`);

        // Test 8: Mixed - items and sessions
        console.log('\n🧪 Test 8: Bill with items and sessions, partially paid');
        const bill3 = new Bill({
            createdBy: user._id,
            organization: organization._id,
            billType: 'cafe',
            subtotal: 150,
            total: 150,
            paid: 50,
            itemPayments: [
                {
                    orderId: new mongoose.Types.ObjectId(),
                    itemId: 'item1',
                    itemName: 'Coffee',
                    quantity: 2,
                    paidQuantity: 2, // Fully paid
                    pricePerUnit: 25,
                    totalPrice: 50,
                    paidAmount: 50,
                    isPaid: true,
                    paymentHistory: []
                }
            ],
            sessionPayments: [
                {
                    sessionId: new mongoose.Types.ObjectId(),
                    sessionCost: 100,
                    paidAmount: 0, // Not paid
                    remainingAmount: 100,
                    payments: []
                }
            ]
        });
        await bill3.save();
        console.log(`   Status: ${bill3.status}`);
        console.log(`   Expected: partial`);
        console.log(`   ✅ ${bill3.status === 'partial' ? 'PASS' : 'FAIL'}`);

        // Test 9: Mixed - all fully paid
        console.log('\n🧪 Test 9: Bill with items and sessions, all fully paid');
        bill3.sessionPayments[0].paidAmount = 100;
        bill3.sessionPayments[0].remainingAmount = 0;
        bill3.paid = 150;
        await bill3.save();
        console.log(`   Status: ${bill3.status}`);
        console.log(`   Expected: paid`);
        console.log(`   ✅ ${bill3.status === 'paid' ? 'PASS' : 'FAIL'}`);

        // Clean up test bills
        console.log('\n🧹 Cleaning up test bills...');
        await Bill.deleteMany({ _id: { $in: [bill1._id, bill2._id, bill3._id] } });
        console.log('✅ Test bills deleted');

        console.log('\n' + '='.repeat(60));
        console.log('✅ All tests completed!\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

testBillStatusCalculation();
