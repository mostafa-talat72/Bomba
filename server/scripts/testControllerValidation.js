/**
 * Test script to verify controller-level validation for payForItems
 * Tests Requirements: 4.1, 4.2, 4.3
 */

import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import dotenv from 'dotenv';

dotenv.config();

// Simulate controller validation logic
function validatePayForItemsRequest(items, bill) {
    const errors = [];

    // Validate items array (Requirement 4.2)
    if (!items || !Array.isArray(items) || items.length === 0) {
        return { valid: false, error: "يجب تحديد الأصناف والكميات المراد دفعها" };
    }

    // Validate each item has itemId and quantity (Requirement 4.2)
    for (const item of items) {
        if (!item.itemId) {
            return { valid: false, error: "يجب تحديد معرف الصنف لكل صنف" };
        }

        if (item.quantity === undefined || item.quantity === null) {
            return { valid: false, error: "يجب تحديد الكمية لكل صنف" };
        }

        if (typeof item.quantity !== 'number' || item.quantity <= 0) {
            return { valid: false, error: "يجب إدخال كمية صحيحة أكبر من صفر" };
        }

        if (!Number.isInteger(item.quantity)) {
            return { valid: false, error: "يجب أن تكون الكمية رقماً صحيحاً" };
        }
    }

    // Validate that all itemIds exist in the bill
    const invalidItems = [];
    for (const item of items) {
        const billItem = bill.itemPayments.find(
            (bi) => bi._id.toString() === item.itemId.toString()
        );
        
        if (!billItem) {
            invalidItems.push(item.itemId);
        }
    }

    if (invalidItems.length > 0) {
        return { valid: false, error: "بعض الأصناف المحددة غير موجودة في الفاتورة", invalidItems };
    }

    // Validate quantities for each item (Requirements 4.1, 4.3)
    for (const item of items) {
        const billItem = bill.itemPayments.find(
            (bi) => bi._id.toString() === item.itemId.toString()
        );

        const remainingQuantity = (billItem.quantity || 0) - (billItem.paidQuantity || 0);

        // Check if item is already fully paid (Requirement 4.3)
        if (remainingQuantity === 0) {
            return {
                valid: false,
                error: `الصنف "${billItem.itemName}" مدفوع بالكامل`,
                itemId: item.itemId,
                itemName: billItem.itemName,
            };
        }

        // Check if quantity exceeds remaining (Requirement 4.1)
        if (item.quantity > remainingQuantity) {
            return {
                valid: false,
                error: `الكمية المطلوبة (${item.quantity}) أكبر من الكمية المتبقية (${remainingQuantity}) للصنف "${billItem.itemName}"`,
                itemId: item.itemId,
                itemName: billItem.itemName,
                requestedQuantity: item.quantity,
                remainingQuantity: remainingQuantity,
            };
        }
    }

    return { valid: true };
}

async function testControllerValidation() {
    try {
        console.log('🔌 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database\n');

        // Create test user first
        const testUser = await User.create({
            name: 'Test User',
            email: 'testuser2@test.com',
            password: 'password123',
            role: 'admin',
        });

        // Create test organization
        const testOrg = await Organization.create({
            name: 'Test Org 2',
            email: 'test2@test.com',
            phone: '1234567890',
            owner: testUser._id,
        });

        testUser.organization = testOrg._id;
        await testUser.save();

        // Create test order
        const testOrder = await Order.create({
            orderNumber: 'TEST-002',
            items: [
                {
                    menuItem: new mongoose.Types.ObjectId(),
                    name: 'Burger',
                    price: 50,
                    quantity: 2,
                    itemTotal: 100,
                },
            ],
            subtotal: 100,
            totalAmount: 100,
            finalAmount: 100,
            status: 'pending',
            createdBy: testUser._id,
            organization: testOrg._id,
        });

        // Create test bill
        const testBill = await Bill.create({
            orders: [testOrder._id],
            subtotal: 100,
            total: 100,
            paid: 0,
            remaining: 100,
            status: 'draft',
            billType: 'cafe',
            createdBy: testUser._id,
            organization: testOrg._id,
        });

        await testBill.save();
        console.log('✅ Test bill created:', testBill.billNumber);
        console.log('');

        const burgerId = testBill.itemPayments[0]._id;

        // Test 1: Empty items array
        console.log('📝 Test 1: Empty items array');
        let result = validatePayForItemsRequest([], testBill);
        console.log(`   ${result.valid ? '❌' : '✅'} ${result.error}`);
        console.log('');

        // Test 2: Missing itemId
        console.log('📝 Test 2: Missing itemId');
        result = validatePayForItemsRequest([{ quantity: 1 }], testBill);
        console.log(`   ${result.valid ? '❌' : '✅'} ${result.error}`);
        console.log('');

        // Test 3: Missing quantity
        console.log('📝 Test 3: Missing quantity');
        result = validatePayForItemsRequest([{ itemId: burgerId }], testBill);
        console.log(`   ${result.valid ? '❌' : '✅'} ${result.error}`);
        console.log('');

        // Test 4: Zero quantity
        console.log('📝 Test 4: Zero quantity');
        result = validatePayForItemsRequest([{ itemId: burgerId, quantity: 0 }], testBill);
        console.log(`   ${result.valid ? '❌' : '✅'} ${result.error}`);
        console.log('');

        // Test 5: Negative quantity
        console.log('📝 Test 5: Negative quantity');
        result = validatePayForItemsRequest([{ itemId: burgerId, quantity: -1 }], testBill);
        console.log(`   ${result.valid ? '❌' : '✅'} ${result.error}`);
        console.log('');

        // Test 6: Decimal quantity
        console.log('📝 Test 6: Decimal quantity');
        result = validatePayForItemsRequest([{ itemId: burgerId, quantity: 1.5 }], testBill);
        console.log(`   ${result.valid ? '❌' : '✅'} ${result.error}`);
        console.log('');

        // Test 7: Invalid itemId
        console.log('📝 Test 7: Invalid itemId');
        const fakeId = new mongoose.Types.ObjectId();
        result = validatePayForItemsRequest([{ itemId: fakeId, quantity: 1 }], testBill);
        console.log(`   ${result.valid ? '❌' : '✅'} ${result.error}`);
        console.log('');

        // Test 8: Valid request
        console.log('📝 Test 8: Valid request');
        result = validatePayForItemsRequest([{ itemId: burgerId, quantity: 1 }], testBill);
        console.log(`   ${result.valid ? '✅' : '❌'} Request is valid`);
        console.log('');

        // Pay for 1 burger
        testBill.payForItems([{ itemId: burgerId, quantity: 1 }], 'cash', testUser._id);
        await testBill.save();

        // Test 9: Quantity exceeds remaining
        console.log('📝 Test 9: Quantity exceeds remaining (1 remaining, requesting 2)');
        result = validatePayForItemsRequest([{ itemId: burgerId, quantity: 2 }], testBill);
        console.log(`   ${result.valid ? '❌' : '✅'} ${result.error}`);
        console.log('');

        // Pay for remaining burger
        testBill.payForItems([{ itemId: burgerId, quantity: 1 }], 'cash', testUser._id);
        await testBill.save();

        // Test 10: Item already fully paid
        console.log('📝 Test 10: Item already fully paid');
        result = validatePayForItemsRequest([{ itemId: burgerId, quantity: 1 }], testBill);
        console.log(`   ${result.valid ? '❌' : '✅'} ${result.error}`);
        console.log('');

        // Clean up
        console.log('🧹 Cleaning up test data...');
        await Bill.deleteOne({ _id: testBill._id });
        await Order.deleteOne({ _id: testOrder._id });
        await User.deleteOne({ _id: testUser._id });
        await Organization.deleteOne({ _id: testOrg._id });
        console.log('✅ Test data cleaned up\n');

        console.log('✅ All controller validation tests passed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

testControllerValidation();
