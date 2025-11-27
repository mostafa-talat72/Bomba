/**
 * Script to test partial payment status logic
 * Tests that bill status is correctly set based on itemPayments
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';
import User from '../models/User.js';

dotenv.config({ path: '.env' });

async function testPartialPaymentStatus() {
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

    console.log('\n📋 Testing Bill:', bill.billNumber);
    console.log('Current Status:', bill.status);
    console.log('Total:', bill.total, 'EGP');
    console.log('Paid:', bill.paid, 'EGP');
    console.log('Remaining:', bill.remaining, 'EGP');

    console.log('\n💰 Item Payments:', bill.itemPayments.length);
    const paidItems = bill.itemPayments.filter(item => item.isPaid);
    const unpaidItems = bill.itemPayments.filter(item => !item.isPaid);
    
    console.log('  Paid:', paidItems.length);
    console.log('  Unpaid:', unpaidItems.length);

    // Test status logic
    console.log('\n🧪 Testing Status Logic:');
    
    const allItemsPaid = bill.itemPayments.every(item => item.isPaid);
    const allSessionsPaid = bill.sessionPayments && bill.sessionPayments.length > 0
      ? bill.sessionPayments.every(session => session.remainingAmount === 0)
      : true;
    
    console.log('  All items paid:', allItemsPaid);
    console.log('  All sessions paid:', allSessionsPaid);
    console.log('  Paid >= Total:', bill.paid >= bill.total);

    let expectedStatus;
    if (bill.paid >= bill.total && allItemsPaid && allSessionsPaid) {
      expectedStatus = 'paid';
    } else if (bill.paid > 0) {
      expectedStatus = 'partial';
    } else {
      expectedStatus = 'draft';
    }

    console.log('\n🎯 Expected Status:', expectedStatus);
    console.log('   Actual Status:', bill.status);

    if (expectedStatus === bill.status) {
      console.log('   ✅ Status is CORRECT');
    } else {
      console.log('   ❌ Status is INCORRECT');
      console.log('   This might be fixed after recalculating...');
    }

    // Test recalculation
    console.log('\n🔄 Recalculating bill...');
    await bill.calculateSubtotal();
    
    console.log('   New Status:', bill.status);
    console.log('   New Paid:', bill.paid, 'EGP');
    console.log('   New Remaining:', bill.remaining, 'EGP');

    if (expectedStatus === bill.status) {
      console.log('   ✅ Status is NOW CORRECT after recalculation');
    } else {
      console.log('   ❌ Status is STILL INCORRECT');
    }

    // Detailed breakdown
    console.log('\n📊 Detailed Breakdown:');
    console.log('\nPaid Items:');
    paidItems.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.itemName} x${item.quantity} @ ${item.pricePerUnit} EGP = ${item.totalPrice} EGP`);
    });

    console.log('\nUnpaid Items:');
    unpaidItems.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.itemName} x${item.quantity} @ ${item.pricePerUnit} EGP = ${item.totalPrice} EGP`);
    });

    console.log('\n✅ Test complete');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

testPartialPaymentStatus();
