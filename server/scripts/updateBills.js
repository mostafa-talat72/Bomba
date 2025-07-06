import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';

async function updateBills() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all bills with orders but zero total
    const bills = await Bill.find({
      $and: [
        { orders: { $exists: true, $ne: [] } },
        { $or: [{ total: 0 }, { total: { $exists: false } }] }
      ]
    }).populate('orders');

    console.log(`📄 Found ${bills.length} bills to update`);

    if (bills.length === 0) {
      console.log('✅ All bills already have correct totals');
      return;
    }

    // Update each bill
    for (const bill of bills) {
      console.log(`🔄 Updating bill ${bill.billNumber}...`);

      try {
        await bill.calculateSubtotal();
        console.log(`✅ Updated bill ${bill.billNumber}: Total = ${bill.total}`);
      } catch (error) {
        console.error(`❌ Error updating bill ${bill.billNumber}:`, error.message);
      }
    }

    console.log('✅ All bills updated successfully');

  } catch (error) {
    console.error('❌ Error updating bills:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
updateBills();
