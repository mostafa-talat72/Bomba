import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const checkData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check tables
    const tables = await mongoose.connection.db.collection('tables').find({}).limit(5).toArray();
    console.log('📊 Tables (first 5):');
    tables.forEach(t => {
      console.log(`  - ID: ${t._id}, tableNumber: ${t.tableNumber}, name: ${t.name}`);
    });
    console.log('');

    // Check orders
    const orders = await mongoose.connection.db.collection('orders').find({}).limit(5).toArray();
    console.log('📦 Orders (first 5):');
    orders.forEach(o => {
      console.log(`  - ID: ${o._id}, table: ${o.table}, orderNumber: ${o.orderNumber}`);
    });
    console.log('');

    // Check sessions
    const sessions = await mongoose.connection.db.collection('sessions').find({}).limit(5).toArray();
    console.log('🎮 Sessions (first 5):');
    sessions.forEach(s => {
      console.log(`  - ID: ${s._id}, table: ${s.table}, type: ${s.type}`);
    });
    console.log('');

    // Check bills
    const bills = await mongoose.connection.db.collection('bills').find({}).limit(5).toArray();
    console.log('💰 Bills (first 5):');
    bills.forEach(b => {
      console.log(`  - ID: ${b._id}, table: ${b.table}, billNumber: ${b.billNumber}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
  }
};

checkData();
