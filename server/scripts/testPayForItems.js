/**
 * Script to test payForItems functionality
 * Simulates paying for specific items
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';
import User from '../models/User.js';

dotenv.config({ path: '.env' });

async function testPayForItems(billId, itemName, quantityToPay) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get the bill
    const bill = await Bill.findById(billId).populate('orders');

    if (!bill) {
      console.log('❌ Bill not found');
      return;
    }

    console.log('\n📋 Bill:', bill.billNumber);
    console.log('Status:', bill.status);
    console.log('Total:', bill.total);
    console.log('Paid:', bill.paid);

    // Find itemPayments for the specified item
    console.log(`\n🔍 Looking for "${itemName}" to pay ${quantityToPay} units...`);
    
    const matchingPayments = bill.itemPayments.filter(p => 
      p.itemName === itemName && !p.isPaid
    );

    console.log(`Found ${matchingPayments.length} unpaid itemPayments for "${itemName}"`);
    
    if (matchingPayments.length === 0) {
      console.log('❌ No unpaid items found!');
      return;
    }

    // Collect IDs to pay
    const itemPaymentIds = [];
    let remainingQty = quantityToPay;

    matchingPayments.forEach(payment => {
      if (remainingQty > 0) {
        console.log(`  - Found payment: Qty ${payment.quantity}, Price ${payment.pricePerUnit}, ID: ${payment._id}`);
        itemPaymentIds.push(payment._id);
        remainingQty -= payment.quantity;
      }
    });

    console.log(`\n💰 Paying for ${itemPaymentIds.length} itemPayments...`);

    // Get a user for testing
    const user = await User.findOne();
    if (!user) {
      console.log('❌ No user found for testing');
      return;
    }

    // Call payForItems
    try {
      const result = bill.payForItems(itemPaymentIds, 'cash', user._id);
      await bill.save();

      console.log('\n✅ Payment successful!');
      console.log('Paid items:', result.paidItems.length);
      console.log('Total amount:', result.totalAmount);
      console.log('\nBill after payment:');
      console.log('Status:', bill.status);
      console.log('Paid:', bill.paid);
      console.log('Remaining:', bill.remaining);

      // Show updated itemPayments
      console.log('\n📊 Updated itemPayments for', itemName);
      bill.itemPayments.filter(p => p.itemName === itemName).forEach((p, idx) => {
        console.log(`  ${idx + 1}. Qty: ${p.quantity}, Paid: ${p.isPaid}, Amount: ${p.paidAmount}/${p.totalPrice}`);
      });

    } catch (error) {
      console.error('❌ Payment failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Get parameters from command line
const billId = process.argv[2];
const itemName = process.argv[3];
const quantity = parseInt(process.argv[4] || '1');

if (!billId || !itemName) {
  console.log('Usage: node testPayForItems.js <billId> <itemName> [quantity]');
  console.log('Example: node testPayForItems.js 69211b72fca149529c1a7d14 "حجر سخن شناوى" 3');
  process.exit(1);
}

testPayForItems(billId, itemName, quantity);
