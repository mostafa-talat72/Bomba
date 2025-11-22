import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const checkFields = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check one table document with all fields
    const table = await mongoose.connection.db.collection('tables').findOne({});
    console.log('📊 Table document (all fields):');
    console.log(JSON.stringify(table, null, 2));
    console.log('');

    // Check one order with table
    const orderWithTable = await mongoose.connection.db.collection('orders').findOne({
      table: { $exists: true, $ne: null }
    });
    console.log('📦 Order with table:');
    console.log(JSON.stringify(orderWithTable, null, 2));
    console.log('');

    // Check one bill
    const bill = await mongoose.connection.db.collection('bills').findOne({});
    console.log('💰 Bill document:');
    console.log(JSON.stringify(bill, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
  }
};

checkFields();
