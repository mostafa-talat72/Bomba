import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const tableSchema = new mongoose.Schema({}, { strict: false, collection: 'tables' });
const orderSchema = new mongoose.Schema({}, { strict: false, collection: 'orders' });
const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });

const Table = mongoose.model('Table', tableSchema);
const Order = mongoose.model('Order', orderSchema);
const Bill = mongoose.model('Bill', billSchema);

async function deepCheckTables() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const tableIds = [
      '6920ef239a81111bbca208fd', // الخديوى
      '691e9b85de2401464b331e8b'  // محمد مصطفى
    ];

    for (const tableId of tableIds) {
      console.log('='.repeat(80));
      
      const table = await Table.findById(tableId);
      console.log(`🏓 الطاولة: ${table.number} (${table.name || 'بدون اسم'})`);
      console.log(`   ID: ${tableId}`);
      console.log(`   Status: ${table.status}\n`);

      // Try different ways to find orders
      console.log('🔍 البحث عن الطلبات بطرق مختلفة:\n');

      // Method 1: Direct ID match
      const orders1 = await Order.find({ table: tableId });
      console.log(`   Method 1 (table: "${tableId}"): ${orders1.length} orders`);

      // Method 2: ObjectId match
      const orders2 = await Order.find({ table: new mongoose.Types.ObjectId(tableId) });
      console.log(`   Method 2 (ObjectId): ${orders2.length} orders`);

      // Method 3: String match
      const orders3 = await Order.find({ table: tableId.toString() });
      console.log(`   Method 3 (toString): ${orders3.length} orders`);

      // Get all orders and filter manually
      const allOrders = await Order.find({});
      const matchingOrders = allOrders.filter(order => {
        const orderTableId = order.table?._id || order.table?.id || order.table;
        return orderTableId && orderTableId.toString() === tableId;
      });
      console.log(`   Method 4 (manual filter): ${matchingOrders.length} orders\n`);

      if (matchingOrders.length > 0) {
        console.log('📋 تفاصيل الطلبات:');
        matchingOrders.forEach(order => {
          console.log(`\n   Order #${order.orderNumber}:`);
          console.log(`     ID: ${order._id}`);
          console.log(`     Table field type: ${typeof order.table}`);
          console.log(`     Table field value: ${JSON.stringify(order.table)}`);
          console.log(`     Bill: ${order.bill || 'No bill'}`);
          console.log(`     Status: ${order.status}`);
          console.log(`     Items: ${order.items?.length || 0}`);
          console.log(`     Created: ${order.createdAt}`);
        });
      }

      console.log('\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

deepCheckTables();
