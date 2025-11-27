import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const tableSchema = new mongoose.Schema({}, { strict: false, collection: 'tables' });
const orderSchema = new mongoose.Schema({}, { strict: false, collection: 'orders' });

const Bill = mongoose.model('Bill', billSchema);
const Table = mongoose.model('Table', tableSchema);
const Order = mongoose.model('Order', orderSchema);

async function linkBillToTable() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const billId = '691e9e70ab6c636406038ace';
    const tableId = '691e9b85de2401464b331e8b'; // محمد مصطفى

    // Get bill
    const bill = await Bill.findById(billId);
    if (!bill) {
      console.log('❌ الفاتورة غير موجودة!');
      return;
    }

    // Get table
    const table = await Table.findById(tableId);
    if (!table) {
      console.log('❌ الطاولة غير موجودة!');
      return;
    }

    console.log('📋 الفاتورة:');
    console.log(`   Bill Number: ${bill.billNumber}`);
    console.log(`   Current Table: ${bill.table || 'لا توجد'}`);
    console.log(`   Total: ${bill.totalAmount} جنيه\n`);

    console.log('🏓 الطاولة:');
    console.log(`   Number: ${table.number}`);
    console.log(`   Name: ${table.name || 'بدون اسم'}`);
    console.log(`   Status: ${table.status}\n`);

    // Check if there's an order linked to this bill
    const order = await Order.findOne({ bill: new mongoose.Types.ObjectId(billId) });
    if (order) {
      console.log('📦 الطلب المرتبط:');
      console.log(`   Order Number: ${order.orderNumber}`);
      console.log(`   Order Table: ${order.table || 'لا توجد'}\n`);
      
      // Update order table if needed
      if (!order.table || order.table.toString() !== tableId) {
        console.log('🔄 تحديث طاولة الطلب...');
        order.table = new mongoose.Types.ObjectId(tableId);
        await order.save();
        console.log('✅ تم تحديث طاولة الطلب\n');
      }
    }

    // Update bill table
    console.log('🔄 ربط الفاتورة بالطاولة...');
    bill.table = new mongoose.Types.ObjectId(tableId);
    await bill.save();
    console.log('✅ تم ربط الفاتورة بالطاولة بنجاح!\n');

    // Update table status
    console.log('🔄 تحديث حالة الطاولة...');
    table.status = 'occupied';
    await table.save();
    console.log('✅ تم تحديث حالة الطاولة إلى محجوزة\n');

    console.log('✅ اكتمل الربط بنجاح!');
    console.log(`   - الفاتورة ${bill.billNumber} مربوطة بالطاولة ${table.number}`);
    console.log(`   - الطاولة محجوزة`);

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

linkBillToTable();
