/**
 * Script to initialize itemPayments for existing bills
 * This fixes bills that don't have itemPayments populated
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';
import Session from '../models/Session.js';

dotenv.config({ path: '.env' });

async function initializeItemPayments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all bills that don't have itemPayments or have empty itemPayments
    const bills = await Bill.find({
      orders: { $exists: true, $ne: [] },
      $or: [
        { itemPayments: { $exists: false } },
        { itemPayments: { $size: 0 } }
      ]
    }).populate('orders');

    console.log(`\n📋 Found ${bills.length} bills without itemPayments`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const bill of bills) {
      try {
        console.log(`\nProcessing Bill: ${bill.billNumber || bill._id}`);
        
        // Initialize itemPayments array
        bill.itemPayments = [];

        // Create itemPayments from orders
        bill.orders.forEach((order) => {
          if (order.items && order.items.length > 0) {
            order.items.forEach((item, index) => {
              const itemName = item.menuItem?.name || item.menuItem?.arabicName || item.name || 'Unknown';
              const price = item.price || 0;
              const quantity = item.quantity || 1;

              bill.itemPayments.push({
                orderId: order._id,
                itemId: `${order._id}-${index}`,
                itemName,
                quantity,
                pricePerUnit: price,
                totalPrice: price * quantity,
                paidAmount: 0,
                isPaid: false,
              });

              console.log(`  ✓ Added: ${itemName} x${quantity} @ ${price} EGP`);
            });
          }
        });

        // Save the bill
        await bill.save();
        updatedCount++;
        console.log(`  ✅ Updated bill ${bill.billNumber || bill._id}`);

      } catch (error) {
        errorCount++;
        console.error(`  ❌ Error updating bill ${bill.billNumber || bill._id}:`, error.message);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Successfully updated: ${updatedCount} bills`);
    console.log(`  ❌ Errors: ${errorCount} bills`);
    console.log(`\n✅ Initialization complete`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

initializeItemPayments();
