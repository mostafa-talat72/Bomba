/**
 * Script to test the complete partial payment flow
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';
import User from '../models/User.js';

dotenv.config({ path: '.env' });

async function testPartialPaymentFlow() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get a bill with unpaid items
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

    console.log('\n📋 Testing Bill:', bill.billNumber);
    console.log('Status:', bill.status);
    console.log('Total:', bill.total, 'EGP');
    console.log('Paid:', bill.paid, 'EGP');
    console.log('Remaining:', bill.remaining, 'EGP');

    console.log('\n📦 Orders:', bill.orders.length);
    bill.orders.forEach((order, idx) => {
      console.log(`\nOrder ${idx + 1}:`, order.orderNumber);
      order.items.forEach((item, itemIdx) => {
        console.log(`  ${itemIdx + 1}. ${item.name} x${item.quantity} @ ${item.price} EGP = ${item.quantity * item.price} EGP`);
      });
    });

    console.log('\n💰 Item Payments:', bill.itemPayments?.length || 0);
    if (bill.itemPayments && bill.itemPayments.length > 0) {
      bill.itemPayments.forEach((payment, idx) => {
        console.log(`\n  ${idx + 1}. ${payment.itemName} x${payment.quantity} @ ${payment.pricePerUnit} EGP`);
        console.log(`     Total: ${payment.totalPrice} EGP`);
        console.log(`     Paid: ${payment.paidAmount} EGP`);
        console.log(`     Status: ${payment.isPaid ? '✅ Paid' : '❌ Unpaid'}`);
      });
    }

    // Simulate aggregation logic
    console.log('\n🔄 Simulating aggregation...');
    const itemMap = new Map();

    bill.orders.forEach(order => {
      order.items.forEach(item => {
        const addonsKey = (item.addons || [])
          .map(a => `${a.name}:${a.price}`)
          .sort()
          .join('|');
        const key = `${item.name}|${item.price}|${addonsKey}`;

        if (!itemMap.has(key)) {
          itemMap.set(key, {
            name: item.name,
            price: item.price,
            totalQuantity: item.quantity,
            paidQuantity: 0,
            remainingQuantity: item.quantity,
            addons: item.addons
          });
        } else {
          const agg = itemMap.get(key);
          agg.totalQuantity += item.quantity;
          agg.remainingQuantity += item.quantity;
        }
      });
    });

    // Calculate paid quantities
    itemMap.forEach((agg, key) => {
      let paidQty = 0;
      
      if (bill.itemPayments) {
        bill.itemPayments.forEach(payment => {
          if (payment.itemName === agg.name && 
              payment.pricePerUnit === agg.price && 
              payment.isPaid) {
            paidQty += payment.quantity;
          }
        });
      }

      agg.paidQuantity = paidQty;
      agg.remainingQuantity = agg.totalQuantity - paidQty;
    });

    console.log('\n📊 Aggregated Items:');
    let hasUnpaidItems = false;
    itemMap.forEach((agg, key) => {
      console.log(`\n  ${agg.name} @ ${agg.price} EGP`);
      console.log(`    Total: ${agg.totalQuantity}`);
      console.log(`    Paid: ${agg.paidQuantity}`);
      console.log(`    Remaining: ${agg.remainingQuantity}`);
      
      if (agg.remainingQuantity > 0) {
        hasUnpaidItems = true;
      }
    });

    console.log('\n🎯 Result:');
    if (hasUnpaidItems) {
      console.log('✅ Has unpaid items - should show in partial payment modal');
    } else {
      console.log('❌ No unpaid items - will show "all items paid" message');
    }

    console.log('\n✅ Test complete');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

testPartialPaymentFlow();
