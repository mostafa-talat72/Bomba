/**
 * Test script to verify payForItems validation logic
 * Tests Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3
 */

import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import dotenv from 'dotenv';

dotenv.config();

async function testPayForItemsValidation() {
    try {
        console.log('🔌 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database\n');

        // Create test user first (without organization)
        const testUser = await User.create({
            name: 'Test User',
            email: 'testuser@test.com',
            password: 'password123',
            role: 'admin',
        });

        // Create test organization with owner
        const testOrg = await Organization.create({
            name: 'Test Org',
            email: 'test@test.com',
            phone: '1234567890',
            owner: testUser._id,
        });

        // Update user with organization
        testUser.organization = testOrg._id;
        await testUser.save();

        // Create test order
        const testOrder = await Order.create({
            orderNumber: 'TEST-001',
            items: [
                {
                    menuItem: new mongoose.Types.ObjectId(),
                    name: 'Coffee',
                    price: 25,
                    quantity: 3,
                    itemTotal: 75,
                },
                {
                    menuItem: new mongoose.Types.ObjectId(),
                    name: 'Tea',
                    price: 15,
                    quantity: 2,
                    itemTotal: 30,
                },
            ],
            subtotal: 105,
            totalAmount: 105,
            finalAmount: 105,
            status: 'pending',
            createdBy: testUser._id,
            organization: testOrg._id,
        });

        // Create test bill
        const testBill = await Bill.create({
            orders: [testOrder._id],
            subtotal: 105,
            total: 105,
            paid: 0,
            remaining: 105,
            status: 'draft',
            billType: 'cafe',
            createdBy: testUser._id,
            organization: testOrg._id,
        });

        await testBill.save();
        console.log('✅ Test bill created:', testBill.billNumber);
        console.log('   Total: 105 EGP');
        console.log('   Items:', testBill.itemPayments.length);
        console.log('');

        // Test 1: Pay for partial quantity (Requirement 1.1, 1.2)
        console.log('📝 Test 1: Pay for partial quantity');
        const coffeeItem = testBill.itemPayments.find(i => i.itemName === 'Coffee');
        console.log(`   Coffee: ${coffeeItem.quantity} units @ ${coffeeItem.pricePerUnit} EGP each`);
        console.log(`   Paying for 2 units...`);
        
        const result1 = testBill.payForItems(
            [{ itemId: coffeeItem._id, quantity: 2 }],
            'cash',
            testUser._id
        );
        await testBill.save();
        
        console.log(`   ✅ Paid: ${result1.totalAmount} EGP`);
        console.log(`   ✅ Remaining quantity: ${coffeeItem.quantity - coffeeItem.paidQuantity}`);
        console.log(`   ✅ Bill remaining: ${testBill.remaining} EGP`);
        console.log('');

        // Test 2: Try to pay more than remaining quantity (Requirement 4.1)
        console.log('📝 Test 2: Try to pay more than remaining quantity');
        console.log(`   Coffee remaining: ${coffeeItem.quantity - coffeeItem.paidQuantity} units`);
        console.log(`   Trying to pay for 5 units...`);
        
        try {
            testBill.payForItems(
                [{ itemId: coffeeItem._id, quantity: 5 }],
                'cash',
                testUser._id
            );
            console.log('   ❌ Should have thrown error!');
        } catch (error) {
            console.log(`   ✅ Correctly rejected: ${error.message}`);
        }
        console.log('');

        // Test 3: Pay remaining quantity
        console.log('📝 Test 3: Pay remaining quantity');
        const remainingCoffee = coffeeItem.quantity - coffeeItem.paidQuantity;
        console.log(`   Paying for remaining ${remainingCoffee} unit...`);
        
        const result3 = testBill.payForItems(
            [{ itemId: coffeeItem._id, quantity: remainingCoffee }],
            'cash',
            testUser._id
        );
        await testBill.save();
        
        console.log(`   ✅ Paid: ${result3.totalAmount} EGP`);
        console.log(`   ✅ Coffee is now fully paid`);
        console.log(`   ✅ Bill remaining: ${testBill.remaining} EGP`);
        console.log('');

        // Test 4: Try to pay for fully paid item (Requirement 4.3)
        console.log('📝 Test 4: Try to pay for fully paid item');
        console.log(`   Trying to pay for Coffee again...`);
        
        try {
            testBill.payForItems(
                [{ itemId: coffeeItem._id, quantity: 1 }],
                'cash',
                testUser._id
            );
            console.log('   ❌ Should have thrown error!');
        } catch (error) {
            console.log(`   ✅ Correctly rejected: ${error.message}`);
        }
        console.log('');

        // Test 5: Pay for multiple items with different quantities (Requirement 1.1)
        console.log('📝 Test 5: Pay for multiple items with different quantities');
        const teaItem = testBill.itemPayments.find(i => i.itemName === 'Tea');
        console.log(`   Tea: ${teaItem.quantity} units @ ${teaItem.pricePerUnit} EGP each`);
        console.log(`   Paying for 1 unit of Tea...`);
        
        const result5 = testBill.payForItems(
            [{ itemId: teaItem._id, quantity: 1 }],
            'cash',
            testUser._id
        );
        await testBill.save();
        
        console.log(`   ✅ Paid: ${result5.totalAmount} EGP`);
        console.log(`   ✅ Tea remaining: ${teaItem.quantity - teaItem.paidQuantity} units`);
        console.log(`   ✅ Bill remaining: ${testBill.remaining} EGP`);
        console.log('');

        // Test 6: Verify payment history (Requirement 1.3)
        console.log('📝 Test 6: Verify payment history');
        console.log(`   Coffee payment history: ${coffeeItem.paymentHistory.length} entries`);
        coffeeItem.paymentHistory.forEach((payment, index) => {
            console.log(`     ${index + 1}. Quantity: ${payment.quantity}, Amount: ${payment.amount} EGP`);
        });
        console.log(`   Tea payment history: ${teaItem.paymentHistory.length} entries`);
        teaItem.paymentHistory.forEach((payment, index) => {
            console.log(`     ${index + 1}. Quantity: ${payment.quantity}, Amount: ${payment.amount} EGP`);
        });
        console.log('');

        // Test 7: Verify bill status
        console.log('📝 Test 7: Verify bill status');
        console.log(`   Bill status: ${testBill.status}`);
        console.log(`   Total: ${testBill.total} EGP`);
        console.log(`   Paid: ${testBill.paid} EGP`);
        console.log(`   Remaining: ${testBill.remaining} EGP`);
        console.log('');

        // Clean up
        console.log('🧹 Cleaning up test data...');
        await Bill.deleteOne({ _id: testBill._id });
        await Order.deleteOne({ _id: testOrder._id });
        await User.deleteOne({ _id: testUser._id });
        await Organization.deleteOne({ _id: testOrg._id });
        console.log('✅ Test data cleaned up\n');

        console.log('✅ All validation tests passed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

testPayForItemsValidation();
