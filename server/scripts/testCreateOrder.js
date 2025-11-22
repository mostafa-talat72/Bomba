import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const testOrder = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get the most recent order with table
    const recentOrder = await mongoose.connection.db.collection('orders')
      .find({ table: { $exists: true, $ne: null } })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    if (recentOrder.length > 0) {
      console.log('📦 Most recent order with table:');
      console.log(`Order ID: ${recentOrder[0]._id}`);
      console.log(`Table ID: ${recentOrder[0].table}`);
      console.log(`Bill ID: ${recentOrder[0].bill}`);
      console.log('');

      // Get the bill
      if (recentOrder[0].bill) {
        const bill = await mongoose.connection.db.collection('bills')
          .findOne({ _id: recentOrder[0].bill });
        
        console.log('💰 Associated Bill:');
        console.log(`Bill ID: ${bill._id}`);
        console.log(`Table field: ${bill.table || 'NOT SET'}`);
        console.log(`TableNumber field: ${bill.tableNumber || 'NOT SET'}`);
        console.log(`Status: ${bill.status}`);
        console.log('');
      }

      // Get the table
      const table = await mongoose.connection.db.collection('tables')
        .findOne({ _id: new mongoose.Types.ObjectId(recentOrder[0].table) });
      
      if (table) {
        console.log('🪑 Associated Table:');
        console.log(`Table ID: ${table._id}`);
        console.log(`Table Number: ${table.number}`);
        console.log(`Table Name: ${table.name || 'N/A'}`);
      }
    } else {
      console.log('❌ No orders with table found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
  }
};

testOrder();
