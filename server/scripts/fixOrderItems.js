import mongoose from 'mongoose';
import Order from '../models/Order.js';
import '../config/database.js';

const fixOrderItems = async () => {
  try {
    console.log('🔄 Starting to fix order items...');

    // Get all orders
    const orders = await Order.find({});
    console.log(`📋 Found ${orders.length} orders to process`);

    let updatedCount = 0;

    for (const order of orders) {
      let orderUpdated = false;

      for (const item of order.items) {
        // If wasEverReady is not set, set it based on isReady
        if (item.wasEverReady === undefined) {
          item.wasEverReady = item.isReady || false;
          orderUpdated = true;
        }
      }

      if (orderUpdated) {
        await order.save();
        updatedCount++;
        console.log(`✅ Updated order ${order.orderNumber}`);
      }
    }

    console.log(`🎉 Successfully updated ${updatedCount} orders`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing order items:', error);
    process.exit(1);
  }
};

fixOrderItems();
