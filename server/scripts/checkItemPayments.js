/**
 * Script to check itemPayments data in bills
 * This helps debug the issue where items appear paid when they're not
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';
import User from '../models/User.js';

dotenv.config({ path: '.env' });

async function checkItemPayments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get a sample bill with orders
    const bill = await Bill.findOne({
      orders: { $exists: true, $ne: [] },
      status: { $in: ['draft', 'partial'] }
    })
      .populate('orders')
      .populate('itemPayments.paidBy', 'name')
      .lean();

    if (!bill) {
      console.log('❌ No bills found with orders');
      return;
    }

    console.log('\n📋 Bill Information:');
    console.log('Bill ID:', bill._id);
    console.log('Bill Number:', bill.billNumber);
    console.log('Status:', bill.status);
    console.log('Total:', bill.total);
    console.log('Paid:', bill.paid);
    console.log('Remaining:', bill.remaining);

    console.log('\n📦 Orders:');
    bill.orders.forEach((order, idx) => {
      console.log(`\nOrder ${idx + 1}:`, order.orderNumber);
      console.log('Items:', order.items.length);
      order.items.forEach((item, itemIdx) => {
        console.log(`  ${itemIdx + 1}. ${item.name} x${item.quantity} @ ${item.price} EGP`);
      });
    });

    console.log('\n💰 Item Payments:');
    if (!bill.itemPayments || bill.itemPayments.length === 0) {
      console.log('⚠️  No itemPayments found - this is the issue!');
      console.log('Items should be unpaid but system might show them as paid');
    } else {
      console.log(`Found ${bill.itemPayments.length} item payments:`);
      bill.itemPayments.forEach((payment, idx) => {
        console.log(`\n  Payment ${idx + 1}:`);
        console.log('    Item:', payment.itemName);
        console.log('    Quantity:', payment.quantity);
        console.log('    Price per unit:', payment.pricePerUnit);
        console.log('    Total price:', payment.totalPrice);
        console.log('    Paid amount:', payment.paidAmount);
        console.log('    Is paid:', payment.isPaid);
        console.log('    Paid by:', payment.paidBy?.name || 'N/A');
      });
    }

    console.log('\n📊 Old System (partialPayments):');
    if (!bill.partialPayments || bill.partialPayments.length === 0) {
      console.log('No partialPayments found');
    } else {
      console.log(`Found ${bill.partialPayments.length} partial payments (old system)`);
    }

    console.log('\n✅ Check complete');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

checkItemPayments();
