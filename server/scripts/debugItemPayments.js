/**
 * Script to debug itemPayments for a specific bill
 * Shows detailed information about paid vs unpaid items
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';
import User from '../models/User.js';

dotenv.config({ path: '.env' });

async function debugItemPayments(billId) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get the bill
    const bill = await Bill.findById(billId)
      .populate('orders')
      .populate('itemPayments.paidBy', 'name')
      .lean();

    if (!bill) {
      console.log('❌ Bill not found');
      return;
    }

    console.log('\n📋 Bill Information:');
    console.log('Bill ID:', bill._id);
    console.log('Bill Number:', bill.billNumber);
    console.log('Status:', bill.status);
    console.log('Total:', bill.total);
    console.log('Paid:', bill.paid);
    console.log('Remaining:', bill.remaining);

    console.log('\n💰 Item Payments Analysis:');
    if (!bill.itemPayments || bill.itemPayments.length === 0) {
      console.log('⚠️  No itemPayments found!');
      return;
    }

    // Group by item name and price
    const itemGroups = {};
    bill.itemPayments.forEach(payment => {
      const key = `${payment.itemName}|${payment.pricePerUnit}`;
      if (!itemGroups[key]) {
        itemGroups[key] = {
          name: payment.itemName,
          price: payment.pricePerUnit,
          totalQuantity: 0,
          paidQuantity: 0,
          unpaidQuantity: 0,
          payments: []
        };
      }
      
      itemGroups[key].totalQuantity += payment.quantity;
      if (payment.isPaid) {
        itemGroups[key].paidQuantity += payment.quantity;
      } else {
        itemGroups[key].unpaidQuantity += payment.quantity;
      }
      itemGroups[key].payments.push(payment);
    });

    console.log(`\nFound ${Object.keys(itemGroups).length} unique items:\n`);
    
    Object.values(itemGroups).forEach((group, idx) => {
      console.log(`${idx + 1}. ${group.name} @ ${group.price} EGP`);
      console.log(`   Total Quantity: ${group.totalQuantity}`);
      console.log(`   Paid Quantity: ${group.paidQuantity}`);
      console.log(`   Unpaid Quantity: ${group.unpaidQuantity}`);
      console.log(`   Payments:`);
      group.payments.forEach((payment, pIdx) => {
        console.log(`     ${pIdx + 1}. Qty: ${payment.quantity}, Paid: ${payment.isPaid}, Amount: ${payment.paidAmount}/${payment.totalPrice}`);
      });
      console.log('');
    });

    console.log('\n✅ Debug complete');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Get bill ID from command line argument
const billId = process.argv[2];

if (!billId) {
  console.log('Usage: node debugItemPayments.js <billId>');
  console.log('Example: node debugItemPayments.js 69211b72fca149529c1a7d14');
  process.exit(1);
}

debugItemPayments(billId);
