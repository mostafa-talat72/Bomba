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

async function checkDeletedBills() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('🔍 فحص الفواتير المحذوفة...\n');

    const deletedBillIds = [
      '691e9e70ab6c636406038ace', // BILL-251120065200943
      '69211b72fca149529c1a7d14', // BILL-251122040954024
      '692122c3fca149529c1a93df', // BILL-251122044107501
      '6922483a4611677dc2823b34'  // BILL-251123013314241
    ];

    const deletedBillNumbers = [
      'BILL-251120065200943',
      'BILL-251122040954024',
      'BILL-251122044107501',
      'BILL-251123013314241'
    ];

    console.log('📋 الفواتير التي تم حذفها:');
    deletedBillNumbers.forEach(num => console.log(`   - ${num}`));
    console.log();

    // Check if any orders reference these bills
    console.log('🍽️ فحص الطلبات المرتبطة بالفواتير المحذوفة:\n');
    
    for (const billId of deletedBillIds) {
      const orders = await Order.find({ bill: billId });
      if (orders.length > 0) {
        console.log(`⚠️ الفاتورة ${billId} لديها ${orders.length} طلب(ات):`);
        orders.forEach(order => {
          console.log(`   - Order #${order.orderNumber}`);
          console.log(`     Table: ${order.table}`);
          console.log(`     Items: ${order.items?.length || 0}`);
          console.log(`     Total: ${order.totalAmount} EGP`);
        });
        console.log();
      }
    }

    // Check if any sessions reference these bills
    console.log('🎮 فحص الجلسات المرتبطة بالفواتير المحذوفة:\n');
    
    for (const billId of deletedBillIds) {
      const sessions = await Session.find({ bill: billId });
      if (sessions.length > 0) {
        console.log(`⚠️ الفاتورة ${billId} لديها ${sessions.length} جلسة/جلسات:`);
        sessions.forEach(session => {
          console.log(`   - Device: ${session.device}`);
          console.log(`     Table: ${session.table}`);
          console.log(`     Duration: ${session.duration} min`);
          console.log(`     Cost: ${session.cost} EGP`);
        });
        console.log();
      }
    }

    console.log('\n💡 ملاحظة: إذا كانت هناك طلبات أو جلسات مرتبطة بهذه الفواتير،');
    console.log('   يمكننا إعادة إنشاء الفواتير وربطها بالطلبات/الجلسات.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkDeletedBills();
