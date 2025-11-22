import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false });
const Bill = mongoose.model('Bill', billSchema);

const orderSchema = new mongoose.Schema({}, { strict: false });
const Order = mongoose.model('Order', orderSchema);

async function checkBills() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check bills for table 1
    const tableId = '691df0413f4227256d224bb9';
    const bills = await Bill.find({ table: new mongoose.Types.ObjectId(tableId) });
    
    console.log(`\n📊 Bills for table ${tableId}:`);
    for (const bill of bills) {
      console.log(`\nBill ${bill.billNumber}:`);
      console.log('  _id:', bill._id);
      console.log('  table:', bill.table);
      console.log('  status:', bill.status);
      console.log('  total:', bill.total);
      console.log('  paid:', bill.paid);
      console.log('  remaining:', bill.remaining);
      console.log('  orders:', bill.orders);
    }

    // Check orders for table 1
    const orders = await Order.find({ table: new mongoose.Types.ObjectId(tableId) });
    console.log(`\n📦 Orders for table ${tableId}:`);
    for (const order of orders) {
      console.log(`\nOrder ${order._id}:`);
      console.log('  table:', order.table);
      console.log('  bill:', order.bill);
      console.log('  status:', order.status);
    }

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkBills();
