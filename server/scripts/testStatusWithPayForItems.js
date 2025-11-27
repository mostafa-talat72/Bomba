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
import '../models/Order.js';

const Bill = mongoose.model('Bill');
const User = mongoose.model('User');
const Organization = mongoose.model('Organization');
const Order = mongoose.model('Order');

async function testStatusWithPayForItems() {
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

        console.log('📋 Testing Bill Status with payForItems Method\n');
        console.log('=' .repeat(60));

        // Create a bill with itemPayments (without actual orders for simplicity)
        const testOrderId = new mongoose.Types.ObjectId();
        
        const bill = new Bill({
            createdBy: user._id,
            organization: organization._id,
            billType: 'cafe',
            subtotal: 115,
            total: 115,
            paid: 0,
            itemPayments: [
                {
                    orderId: testOrderId,
                    itemId: `${testOrderId}-0`,
                    itemName: 'Coffee',
                    quantity: 3,
                    paidQuantity: 0,
                    pricePerUnit: 25,
                    totalPrice: 75,
                    paidAmount: 0,
                    isPaid: false,
                    paymentHistory: []
                },
                {
                    orderId: testOrderId,
                    itemId: `${testOrderId}-1`,
                    itemName: 'Tea',
                    quantity: 2,
                    paidQuantity: 0,
                    pricePerUnit: 20,
                    totalPrice: 40,
                    paidAmount: 0,
                    isPaid: false,
                    paymentHistory: []
                }
            ]
        });

        await bill.save();
        console.log('✅ Test bill created');
        console.log(`   Bill ID: ${bill._id}`);
        console.log(`   Initial Status: ${bill.status}\n`);

        // Test 1: Pay for partial quantity of first item
        console.log('🧪 Test 1: Pay for 1 Coffee (out of 3)');
        const result1 = bill.payForItems(
            [{ itemId: bill.itemPayments[0]._id, quantity: 1 }],
            'cash',
            user._id
        );
        await bill.save();
        console.log(`   Paid: ${result1.totalAmount} EGP`);
        console.log(`   Status: ${bill.status}`);
        console.log(`   Expected: partial`);
        console.log(`   ✅ ${bill.status === 'partial' ? 'PASS' : 'FAIL'}\n`);

        // Test 2: Pay for remaining Coffee
        console.log('🧪 Test 2: Pay for remaining 2 Coffee');
        const result2 = bill.payForItems(
            [{ itemId: bill.itemPayments[0]._id, quantity: 2 }],
            'cash',
            user._id
        );
        await bill.save();
        console.log(`   Paid: ${result2.totalAmount} EGP`);
        console.log(`   Total Paid: ${bill.paid} EGP`);
        console.log(`   Status: ${bill.status}`);
        console.log(`   Expected: partial (Tea still unpaid)`);
        console.log(`   ✅ ${bill.status === 'partial' ? 'PASS' : 'FAIL'}\n`);

        // Test 3: Pay for all Tea
        console.log('🧪 Test 3: Pay for all 2 Tea');
        const result3 = bill.payForItems(
            [{ itemId: bill.itemPayments[1]._id, quantity: 2 }],
            'cash',
            user._id
        );
        await bill.save();
        console.log(`   Paid: ${result3.totalAmount} EGP`);
        console.log(`   Total Paid: ${bill.paid} EGP`);
        console.log(`   Status: ${bill.status}`);
        console.log(`   Expected: paid (all items fully paid)`);
        console.log(`   ✅ ${bill.status === 'paid' ? 'PASS' : 'FAIL'}\n`);

        // Verify item payment details
        console.log('📊 Final Item Payment Details:');
        bill.itemPayments.forEach((item, index) => {
            console.log(`   Item ${index + 1}: ${item.itemName}`);
            console.log(`      Quantity: ${item.quantity}`);
            console.log(`      Paid Quantity: ${item.paidQuantity}`);
            console.log(`      Remaining: ${item.quantity - item.paidQuantity}`);
            console.log(`      Is Paid: ${item.isPaid}`);
            console.log(`      Payment History: ${item.paymentHistory.length} payments`);
        });

        // Clean up
        console.log('\n🧹 Cleaning up test data...');
        await Bill.deleteOne({ _id: bill._id });
        console.log('✅ Test data deleted');

        console.log('\n' + '='.repeat(60));
        console.log('✅ All tests completed!\n');

    } catch (error) {
        console.error('❌ Error:', error);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

testStatusWithPayForItems();
