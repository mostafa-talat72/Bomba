import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import Order model
import Order from '../models/Order.js';

async function updateOrders() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all orders that don't have preparedCount in their items
    const orders = await Order.find({
      'items.preparedCount': { $exists: false }
    });

    console.log(`📋 Found ${orders.length} orders to update`);

    if (orders.length === 0) {
      console.log('✅ All orders already have preparedCount field');
      return;
    }

    // Update each order
    for (const order of orders) {
      let updated = false;

      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          if (item.preparedCount === undefined) {
            item.preparedCount = 0;
            updated = true;
          }
        }
      }

      if (updated) {
        await order.save();
        console.log(`✅ Updated order ${order.orderNumber}`);
      }
    }

    console.log('✅ All orders updated successfully');

  } catch (error) {
    console.error('❌ Error updating orders:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
updateOrders();
