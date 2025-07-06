import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
import Order from '../models/Order.js';
import Bill from '../models/Bill.js';

async function checkOrders() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all orders
    const orders = await Order.find({}).populate('bill');

    console.log(`📋 Found ${orders.length} orders`);

    for (const order of orders) {
      console.log(`📋 Order ${order.orderNumber}:`, {
        _id: order._id,
        customerName: order.customerName,
        subtotal: order.subtotal,
        finalAmount: order.finalAmount,
        totalAmount: order.totalAmount,
        itemsCount: order.items?.length || 0,
        bill: order.bill ? order.bill.billNumber : 'No bill'
      });

      if (order.items && order.items.length > 0) {
        console.log('📦 Items:');
        order.items.forEach((item, index) => {
          console.log(`  ${index + 1}. ${item.name}: ${item.price} x ${item.quantity} = ${item.price * item.quantity}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error checking orders:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
checkOrders();
