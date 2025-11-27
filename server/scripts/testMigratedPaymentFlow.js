import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Test Script: Payment functionality with migrated schema
 * 
 * This script tests the payment functionality to ensure it works correctly
 * with the new paidQuantity field structure.
 */

async function testPaymentFlow() {
    try {
        console.log('🧪 Testing payment functionality with migrated schema...\n');

        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba');
        console.log('✅ Connected to MongoDB\n');

        // Find or create a test user
        let testUser = await User.findOne({ email: 'test@example.com' });
        if (!testUser) {
            testUser = await User.create({
                name: 'Test User',
                email: 'test@example.com',
                password: 'test123',
                role: 'admin',
                organization: new mongoose.Types.ObjectId()
            });
            console.log('✅ Created test user\n');
        } else {
            console.log('✅ Using existing test user\n');
        }

        // Create a test order
        const testOrder = await Order.create({
            orderNumber: `TEST-ORDER-${Date.now()}`,
            items: [
                {
                    menuItem: new mongoose.Types.ObjectId(),
                    name: 'Test Item 1',
                    quantity: 5,
                    price: 10,
                    itemTotal: 50
                },
                {
                    menuItem: new mongoose.Types.ObjectId(),
                    name: 'Test Item 2',
                    quantity: 3,
                    price: 20,
                    itemTotal: 60
                }
            ],
            subtotal: 110,
            finalAmount: 110,
            status: 'delivered',
            organization: testUser.organization,
            createdBy: testUser._id
        });
        console.log('✅ Created test order\n');

        // Get the item IDs from the saved order
        const savedOrder = await Order.findById(testOrder._id);
        const item1Id = savedOrder.items[0]._id.toString();
        const item2Id = savedOrder.items[1]._id.toString();

        // Create a test bill with itemPayments
        const testBill = await Bill.create({
            billNumber: `TEST-${Date.now()}`,
            type: 'cafe',
            orders: [testOrder._id],
            itemPayments: [
                {
                    orderId: testOrder._id,
                    itemId: item1Id,
                    itemName: 'Test Item 1',
                    quantity: 5,
                    paidQuantity: 0,
                    pricePerUnit: 10,
                    totalPrice: 50,
                    isPaid: false,
                    paymentHistory: []
                },
                {
                    orderId: testOrder._id,
                    itemId: item2Id,
                    itemName: 'Test Item 2',
                    quantity: 3,
                    paidQuantity: 0,
                    pricePerUnit: 20,
                    totalPrice: 60,
                    isPaid: false,
                    paymentHistory: []
                }
            ],
            totalAmount: 110,
            paidAmount: 0,
            remainingAmount: 110,
            status: 'draft',
            organization: testUser.organization,
            createdBy: testUser._id
        });
        console.log('✅ Created test bill\n');
        console.log(`   Bill Number: ${testBill.billNumber}`);
        console.log(`   Total Amount: ${testBill.totalAmount} EGP`);
        console.log(`   Status: ${testBill.status}\n`);

        // Test 1: Pay for partial quantity of first item
        console.log('🧪 Test 1: Pay for partial quantity (2 out of 5 of Item 1)...');
        const payment1 = await testBill.payForItems(
            [{ itemId: testBill.itemPayments[0]._id.toString(), quantity: 2 }],
            'cash',
            testUser._id
        );
        console.log('✅ Payment 1 successful');
        console.log(`   Paid Amount: ${payment1.paidAmount} EGP`);
        console.log(`   Remaining Amount: ${payment1.remainingAmount} EGP`);
        console.log(`   Bill Status: ${payment1.status}\n`);

        // Verify item state after first payment
        const item1AfterPayment1 = testBill.itemPayments[0];
        console.log('   Item 1 state:');
        console.log(`     - Quantity: ${item1AfterPayment1.quantity}`);
        console.log(`     - Paid Quantity: ${item1AfterPayment1.paidQuantity}`);
        console.log(`     - Remaining Quantity: ${item1AfterPayment1.quantity - item1AfterPayment1.paidQuantity}`);
        console.log(`     - Is Paid: ${item1AfterPayment1.isPaid}`);
        console.log(`     - Payment History: ${item1AfterPayment1.paymentHistory.length} entries\n`);

        // Test 2: Pay for remaining quantity of first item
        console.log('🧪 Test 2: Pay for remaining quantity (3 out of 3 remaining of Item 1)...');
        const payment2 = await testBill.payForItems(
            [{ itemId: testBill.itemPayments[0]._id.toString(), quantity: 3 }],
            'card',
            testUser._id
        );
        console.log('✅ Payment 2 successful');
        console.log(`   Paid Amount: ${payment2.paidAmount} EGP`);
        console.log(`   Remaining Amount: ${payment2.remainingAmount} EGP`);
        console.log(`   Bill Status: ${payment2.status}\n`);

        // Verify item state after second payment
        const item1AfterPayment2 = testBill.itemPayments[0];
        console.log('   Item 1 state:');
        console.log(`     - Quantity: ${item1AfterPayment2.quantity}`);
        console.log(`     - Paid Quantity: ${item1AfterPayment2.paidQuantity}`);
        console.log(`     - Remaining Quantity: ${item1AfterPayment2.quantity - item1AfterPayment2.paidQuantity}`);
        console.log(`     - Is Paid: ${item1AfterPayment2.isPaid}`);
        console.log(`     - Payment History: ${item1AfterPayment2.paymentHistory.length} entries\n`);

        // Test 3: Pay for full quantity of second item
        console.log('🧪 Test 3: Pay for full quantity (3 out of 3 of Item 2)...');
        const payment3 = await testBill.payForItems(
            [{ itemId: testBill.itemPayments[1]._id.toString(), quantity: 3 }],
            'cash',
            testUser._id
        );
        console.log('✅ Payment 3 successful');
        console.log(`   Paid Amount: ${payment3.paidAmount} EGP`);
        console.log(`   Remaining Amount: ${payment3.remainingAmount} EGP`);
        console.log(`   Bill Status: ${payment3.status}\n`);

        // Test 4: Try to overpay (should fail)
        console.log('🧪 Test 4: Try to overpay (should fail)...');
        try {
            await testBill.payForItems(
                [{ itemId: testBill.itemPayments[0]._id.toString(), quantity: 1 }],
                'cash',
                testUser._id
            );
            console.log('❌ Test 4 failed: Should have thrown an error\n');
        } catch (error) {
            console.log('✅ Test 4 passed: Correctly rejected overpayment');
            console.log(`   Error: ${error.message}\n`);
        }

        // Final verification
        console.log('📊 Final Bill State:');
        console.log(`   Bill Number: ${testBill.billNumber}`);
        console.log(`   Total Amount: ${testBill.totalAmount} EGP`);
        console.log(`   Paid Amount: ${testBill.paidAmount} EGP`);
        console.log(`   Remaining Amount: ${testBill.remainingAmount} EGP`);
        console.log(`   Status: ${testBill.status}`);
        console.log(`   Items:`);
        testBill.itemPayments.forEach((item, index) => {
            console.log(`     ${index + 1}. ${item.itemName}`);
            console.log(`        - Quantity: ${item.quantity}`);
            console.log(`        - Paid Quantity: ${item.paidQuantity}`);
            console.log(`        - Is Paid: ${item.isPaid}`);
            console.log(`        - Payment History: ${item.paymentHistory.length} entries`);
        });
        console.log('');

        // Cleanup
        console.log('🧹 Cleaning up test data...');
        await Bill.deleteOne({ _id: testBill._id });
        await Order.deleteOne({ _id: testOrder._id });
        console.log('✅ Test data cleaned up\n');

        console.log('✅ All payment functionality tests passed!\n');

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

testPaymentFlow()
    .then(() => {
        console.log('✅ Test script finished');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test script failed:', error);
        process.exit(1);
    });
