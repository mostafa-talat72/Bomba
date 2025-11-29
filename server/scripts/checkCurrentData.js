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

    // Check tables
    const tables = await mongoose.connection.db.collection('tables').find({}).limit(5).toArray();
   

    // Check orders
    const orders = await mongoose.connection.db.collection('orders').find({}).limit(5).toArray();
    orders.forEach(o => {
    });

    // Check sessions
    const sessions = await mongoose.connection.db.collection('sessions').find({}).limit(5).toArray();
    sessions.forEach(s => {
    });

    // Check bills
    const bills = await mongoose.connection.db.collection('bills').find({}).limit(5).toArray();
   

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
  }
};

checkData();
