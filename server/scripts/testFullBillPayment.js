import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';
import Organization from '../models/Organization.js';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

async function testFullBillPayment() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find or create test user first
        let testUser = await User.findOne({ email: 'test@test.com' });
        if (!testUser) {
            testUser = await User.create({
                name: 'Test User',
                email: 'test@test.com',
                password: 'password123',
                role: 'admin'
            });
        }

        // Find or create test organization
        let testOrg = await Organization.findOne({ name: 'Test Org' });
        if (!testOrg) {
            testOrg = await Organization.create({
                name: 'Test Org',
                email: 'test@test.com',
                phone: '1234567890',
                owner: testUser._id
            });
            // Update user with organization
            testUser.organization = testOrg._id;
            await testUser.save();
        }

        console.log('\n📝 Creating test bill with items...');

        // Create a test order
        const order = await Order.create({
            orderNumber: `TEST-${Date.now()}`,
            items: [
                {
                    itemId: new mongoose.Types.ObjectId(),
                    name: 'قهوة',
                    quantity: 3,
                    price: 20,
                    itemTotal: 60
                },
                {
                    itemId: new mongoose.Types.ObjectId(),
                    name: 'شاي',
                    quantity: 2,
                    price: 15,
                    itemTotal: 30
                }
            ],
            subtotal: 90,
            finalAmount: 90,
            status: 'delivered',
            organization: testOrg._id,
            createdBy: testUser._id
        });

        // Create a bill with the order
        const bill = await Bill.create({
            billNumber: `BILL-${Date.now()}`,
            billType: 'cafe',
            orders: [order._id],
            organization: testOrg._id,
            createdBy: testUser._id,
            status: 'draft'
        });

        // Verify order was created correctly
        const createdOrder = await Order.findById(order._id);
        console.log('\n📦 Order details:');
        console.log(`   Order Number: ${createdOrder.orderNumber}`);
        console.log(`   Subtotal: ${createdOrder.subtotal}`);
        console.log(`   Final Amount: ${createdOrder.finalAmount}`);
        console.log(`   Items: ${createdOrder.items.length}`);

        // Populate orders before calculating
        await bill.populate('orders');
        
        console.log('\n🔄 Calculating subtotal...');
        console.log(`   Orders populated: ${bill.orders.length}`);
        console.log(`   First order finalAmount: ${bill.orders[0]?.finalAmount}`);
        
        // Calculate subtotal to initialize itemPayments
        const result = await bill.calculateSubtotal();
        console.log(`   calculateSubtotal result:`, result);
        console.log(`   Bill subtotal after calc: ${bill.subtotal}`);
        console.log(`   Bill total after calc: ${bill.total}`);
        
        // Reload bill to get updated values
        const reloadedBill = await Bill.findById(bill._id).populate('orders');

        console.log('\n📊 Bill created:');
        console.log(`   Bill Number: ${reloadedBill.billNumber}`);
        console.log(`   Subtotal: ${reloadedBill.subtotal} EGP`);
        console.log(`   Total: ${reloadedBill.total} EGP`);
        console.log(`   Status: ${reloadedBill.status}`);
        console.log(`   Items in itemPayments: ${reloadedBill.itemPayments.length}`);

        // Display itemPayments before payment
        console.log('\n📦 Item Payments BEFORE full payment:');
        reloadedBill.itemPayments.forEach(item => {
            console.log(`   - ${item.itemName}: ${item.paidQuantity}/${item.quantity} paid (isPaid: ${item.isPaid})`);
        });

        // Simulate full bill payment (like clicking "دفع الفاتورة بالكامل")
        console.log('\n💰 Paying full bill amount...');
        console.log(`   Amount to pay: ${reloadedBill.total} EGP`);
        reloadedBill.addPayment(reloadedBill.total, 'cash', testUser._id);
        await reloadedBill.save();

        // Reload bill to see updated status
        const updatedBill = await Bill.findById(bill._id);

        console.log('\n📊 Bill after payment:');
        console.log(`   Paid: ${updatedBill.paid} EGP`);
        console.log(`   Remaining: ${updatedBill.remaining} EGP`);
        console.log(`   Status: ${updatedBill.status}`);

        // Display itemPayments after payment
        console.log('\n📦 Item Payments AFTER full payment:');
        updatedBill.itemPayments.forEach(item => {
            console.log(`   - ${item.itemName}: ${item.paidQuantity}/${item.quantity} paid (isPaid: ${item.isPaid})`);
        });

        // Check if status is "paid"
        if (updatedBill.status === 'paid') {
            console.log('\n✅ SUCCESS: Bill status is "paid"');
        } else {
            console.log(`\n❌ FAILED: Bill status is "${updatedBill.status}" instead of "paid"`);
        }

        // Check if all items are marked as paid
        const allItemsPaid = updatedBill.itemPayments.every(item => item.isPaid);
        if (allItemsPaid) {
            console.log('✅ SUCCESS: All items are marked as paid');
        } else {
            console.log('❌ FAILED: Not all items are marked as paid');
        }

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await Bill.findByIdAndDelete(bill._id);
        await Order.findByIdAndDelete(order._id);

        console.log('✅ Test completed successfully!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

testFullBillPayment();
