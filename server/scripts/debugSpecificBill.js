import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const orderSchema = new mongoose.Schema({}, { strict: false, collection: 'orders' });
const sessionSchema = new mongoose.Schema({}, { strict: false, collection: 'sessions' });

const Bill = mongoose.model('Bill', billSchema);
const Order = mongoose.model('Order', orderSchema);
const Session = mongoose.model('Session', sessionSchema);

async function debugSpecificBill() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const billNumber = 'BILL-251123013314241';
    
    console.log(`🔍 البحث عن الفاتورة: ${billNumber}\n`);

    const bill = await Bill.findOne({ billNumber });
    
    if (!bill) {
      console.log('❌ الفاتورة غير موجودة!');
      return;
    }

    console.log('📋 معلومات الفاتورة:');
    console.log(`   ID: ${bill._id}`);
    console.log(`   Bill Number: ${bill.billNumber}`);
    console.log(`   Status: ${bill.status}`);
    console.log(`   Total Amount: ${bill.totalAmount}`);
    console.log(`   Paid Amount: ${bill.paidAmount}`);
    console.log(`   Remaining Amount: ${bill.remainingAmount}`);
    console.log(`   Table: ${bill.table}`);
    console.log(`   Created: ${bill.createdAt}`);
    console.log(`   Items count: ${bill.items?.length || 0}\n`);

    if (bill.items && bill.items.length > 0) {
      console.log('📦 العناصر:');
      bill.items.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.name || item.productName || 'Unknown'}`);
        console.log(`      - Type: ${item.type}`);
        console.log(`      - Quantity: ${item.quantity}`);
        console.log(`      - Price: ${item.price} EGP`);
        console.log(`      - Total: ${item.total} EGP`);
        if (item.order) console.log(`      - Order: ${item.order}`);
        if (item.session) console.log(`      - Session: ${item.session}`);
      });
      console.log();
    }

    // Check if bill has orders
    console.log('🍽️ الطلبات المربوطة بهذه الفاتورة:');
    const orders = await Order.find({ bill: bill._id });
    console.log(`   عدد الطلبات: ${orders.length}`);
    
    if (orders.length > 0) {
      orders.forEach(order => {
        console.log(`   - Order #${order.orderNumber}: Table = ${order.table}`);
      });
    }
    console.log();

    // Check if bill has sessions
    console.log('🎮 الجلسات المربوطة بهذه الفاتورة:');
    const sessions = await Session.find({ bill: bill._id });
    console.log(`   عدد الجلسات: ${sessions.length}`);
    
    if (sessions.length > 0) {
      sessions.forEach(session => {
        console.log(`   - Session: Device = ${session.device}, Table = ${session.table}`);
      });
    }
    console.log();

    // Determine what table should be linked
    console.log('🔍 تحديد الطاولة المناسبة:');
    
    if (orders.length > 0 && orders[0].table) {
      console.log(`   ✅ يجب ربط الفاتورة بالطاولة: ${orders[0].table}`);
      console.log(`   🔧 الحل: تحديث bill.table = ${orders[0].table}`);
    } else if (sessions.length > 0 && sessions[0].table) {
      console.log(`   ✅ يجب ربط الفاتورة بالطاولة: ${sessions[0].table}`);
      console.log(`   🔧 الحل: تحديث bill.table = ${sessions[0].table}`);
    } else {
      console.log(`   ⚠️ لا توجد طلبات أو جلسات مربوطة بهذه الفاتورة!`);
      console.log(`   🔧 الحل: حذف الفاتورة أو ربطها بطاولة يدوياً`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

debugSpecificBill();
