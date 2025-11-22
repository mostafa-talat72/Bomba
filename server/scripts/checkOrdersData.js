import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const orderSchema = new mongoose.Schema({}, { strict: false });
const Order = mongoose.model('Order', orderSchema);

async function checkOrders() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const orders = await Order.find({}).limit(5);
    console.log('\n📊 Sample Orders:');
    orders.forEach((order, i) => {
      console.log(`\nOrder ${i + 1}:`);
      console.log('  _id:', order._id);
      console.log('  table:', order.table);
      console.log('  tableNumber:', order.tableNumber);
      console.log('  status:', order.status);
    });

    const ordersWithTableNumber = await Order.countDocuments({ tableNumber: { $exists: true } });
    const ordersWithTableObjectId = await Order.countDocuments({ table: { $exists: true, $type: 'objectId' } });
    
    console.log('\n📈 Statistics:');
    console.log('  Orders with tableNumber:', ordersWithTableNumber);
    console.log('  Orders with table ObjectId:', ordersWithTableObjectId);
    console.log('  Total orders:', await Order.countDocuments());

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkOrders();
