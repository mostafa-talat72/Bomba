import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const analyzeData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Count documents
    const tablesCount = await mongoose.connection.db.collection('tables').countDocuments();
    const ordersCount = await mongoose.connection.db.collection('orders').countDocuments();
    const sessionsCount = await mongoose.connection.db.collection('sessions').countDocuments();
    const billsCount = await mongoose.connection.db.collection('bills').countDocuments();

    // Check if tables have any valid data
    const validTables = await mongoose.connection.db.collection('tables').find({
      tableNumber: { $exists: true, $ne: null }
    }).toArray();
    if (validTables.length > 0) {
      validTables.slice(0, 3).forEach(t => {
      });
    }

    // Check tables without tableNumber
    const invalidTables = await mongoose.connection.db.collection('tables').find({
      $or: [
        { tableNumber: { $exists: false } },
        { tableNumber: null }
      ]
    }).limit(3).toArray();
    if (invalidTables.length > 0) {
      invalidTables.forEach(t => {
      });
    }

    // Check orders
    const ordersWithTable = await mongoose.connection.db.collection('orders').find({
      table: { $exists: true, $ne: null }
    }).countDocuments();

    // Check sessions
    const sessionsWithTable = await mongoose.connection.db.collection('sessions').find({
      table: { $exists: true, $ne: null }
    }).countDocuments();

    // Check bills
    const billsWithTable = await mongoose.connection.db.collection('bills').find({
      table: { $exists: true, $ne: null }
    }).countDocuments();

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
  }
};

analyzeData();
