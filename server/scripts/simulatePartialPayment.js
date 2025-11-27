/**
 * Script to simulate partial payment and check bill status
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';
import User from '../models/User.js';

dotenv.config({ path: '.env' });

async function simulatePartialPayment() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get a bill with unpaid items
    const bill = await Bill.findOne({
      orders: { $exists: true, $ne: [] },
      status: { $in: ['draft', 'partial'] },
      itemPayments: { $exists: true, $ne: [] }
    })
      .populate('orders')
      .populate('itemPayments.paidBy', 'name');

    if (!bill) {
      console.log('❌ No bills found with itemPayments');
      return;
    }

    console.log('\n📋 Bill Before Payment:', bill.billNumber);
    console.log('Status:', bill.status);
    console.log('Total:', bill.total, 'EGP');
    console.log('Paid:', bill.paid, 'EGP');
    console.log('Remaining:', bill.remaining, 'EGP');
    console.log('Item Payments:', bill.itemPayments.length);

    const unpaidItems = bill.itemPayments.filter(item => !item.isPaid);
    console.log('Unpaid Items:', unpaidItems.length);

    if (unpaidItems.length === 0) {
      console.log('❌ No unpaid items to test with');
      return;
    }

    // Get first user for testing
    const user = await User.findOne();
    if (!user) {
      console.log('❌ No users found');
      return;
    }

    // Pay for first 3 items (or less if there aren't 3)
    const itemsToPay = unpaidItems.slice(0, Math.min(3, unpaidItems.length));
    const itemIds = itemsToPay.map(item => item._id);

    console.log('\n💰 Paying for', itemIds.length, 'items:');
    itemsToPay.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.itemName} x${item.quantity} @ ${item.pricePerUnit} EGP = ${item.totalPrice} EGP`);
    });

    // Simulate payForItems
    console.log('\n🔄 Calling payForItems...');
    const result = bill.payForItems(itemIds, 'cash', user._id);
    console.log('Payment Result:', result);

    // Save the bill
    await bill.save();

    // Reload the bill to see the updated status
    const updatedBill = await Bill.findById(bill._id)
      .populate('orders')
      .populate('itemPayments.paidBy', 'name');

    console.log('\n📋 Bill After Payment:', updatedBill.billNumber);
    console.log('Status:', updatedBill.status);
    console.log('Total:', updatedBill.total, 'EGP');
    console.log('Paid:', updatedBill.paid, 'EGP');
    console.log('Remaining:', updatedBill.remaining, 'EGP');

    const paidItemsAfter = updatedBill.itemPayments.filter(item => item.isPaid);
    const unpaidItemsAfter = updatedBill.itemPayments.filter(item => !item.isPaid);
    
    console.log('Paid Items:', paidItemsAfter.length);
    console.log('Unpaid Items:', unpaidItemsAfter.length);

    // Check status logic
    console.log('\n🧪 Status Check:');
    const allItemsPaid = updatedBill.itemPayments.every(item => item.isPaid);
    const allSessionsPaid = updatedBill.sessionPayments && updatedBill.sessionPayments.length > 0
      ? updatedBill.sessionPayments.every(session => session.remainingAmount === 0)
      : true;
    
    console.log('  All items paid:', allItemsPaid);
    console.log('  All sessions paid:', allSessionsPaid);
    console.log('  Paid >= Total:', updatedBill.paid >= updatedBill.total);

    let expectedStatus;
    if (updatedBill.paid >= updatedBill.total && allItemsPaid && allSessionsPaid) {
      expectedStatus = 'paid';
    } else if (updatedBill.paid > 0) {
      expectedStatus = 'partial';
    } else {
      expectedStatus = 'draft';
    }

    console.log('\n🎯 Expected Status:', expectedStatus);
    console.log('   Actual Status:', updatedBill.status);

    if (expectedStatus === updatedBill.status) {
      console.log('   ✅ Status is CORRECT');
    } else {
      console.log('   ❌ Status is INCORRECT');
      console.log('   🐛 BUG CONFIRMED: Bill status should be', expectedStatus, 'but is', updatedBill.status);
    }

    console.log('\n✅ Test complete');

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

simulatePartialPayment();
