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
    console.log('✅ Connected to MongoDB\n');

    // Count documents
    const tablesCount = await mongoose.connection.db.collection('tables').countDocuments();
    const ordersCount = await mongoose.connection.db.collection('orders').countDocuments();
    const sessionsCount = await mongoose.connection.db.collection('sessions').countDocuments();
    const billsCount = await mongoose.connection.db.collection('bills').countDocuments();

    console.log('📊 Document Counts:');
    console.log(`  Tables: ${tablesCount}`);
    console.log(`  Orders: ${ordersCount}`);
    console.log(`  Sessions: ${sessionsCount}`);
    console.log(`  Bills: ${billsCount}\n`);

    // Check if tables have any valid data
    const validTables = await mongoose.connection.db.collection('tables').find({
      tableNumber: { $exists: true, $ne: null }
    }).toArray();
    console.log(`✅ Tables with tableNumber: ${validTables.length}`);
    if (validTables.length > 0) {
      console.log('Sample:');
      validTables.slice(0, 3).forEach(t => {
        console.log(`  - ${t.tableNumber}: ${t.name}`);
      });
    }
    console.log('');

    // Check tables without tableNumber
    const invalidTables = await mongoose.connection.db.collection('tables').find({
      $or: [
        { tableNumber: { $exists: false } },
        { tableNumber: null }
      ]
    }).limit(3).toArray();
    console.log(`⚠️  Tables without tableNumber: ${tablesCount - validTables.length}`);
    if (invalidTables.length > 0) {
      console.log('Sample (showing all fields):');
      invalidTables.forEach(t => {
        console.log(`  - ID: ${t._id}`);
        console.log(`    Fields: ${Object.keys(t).join(', ')}`);
        console.log(`    Data: ${JSON.stringify(t, null, 2)}`);
      });
    }
    console.log('');

    // Check orders
    const ordersWithTable = await mongoose.connection.db.collection('orders').find({
      table: { $exists: true, $ne: null }
    }).countDocuments();
    console.log(`📦 Orders with table field: ${ordersWithTable} / ${ordersCount}`);

    // Check sessions
    const sessionsWithTable = await mongoose.connection.db.collection('sessions').find({
      table: { $exists: true, $ne: null }
    }).countDocuments();
    console.log(`🎮 Sessions with table field: ${sessionsWithTable} / ${sessionsCount}`);

    // Check bills
    const billsWithTable = await mongoose.connection.db.collection('bills').find({
      table: { $exists: true, $ne: null }
    }).countDocuments();
    console.log(`💰 Bills with table field: ${billsWithTable} / ${billsCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
  }
};

analyzeData();
