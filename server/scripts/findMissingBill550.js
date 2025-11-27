import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const orderSchema = new mongoose.Schema({}, { strict: false, collection: 'orders' });
const sessionSchema = new mongoose.Schema({}, { strict: false, collection: 'sessions' });

const Order = mongoose.model('Order', orderSchema);
const Session = mongoose.model('Session', sessionSchema);

async function findMissingBill550() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const deletedBillIds = [
      '691e9e70ab6c636406038ace', // BILL-251120065200943
      '69211b72fca149529c1a7d14', // BILL-251122040954024 (تم إعادة إنشائها - 248 جنيه)
      '692122c3fca149529c1a93df', // BILL-251122044107501 (تم إعادة إنشائها - 230 جنيه)
      '6922483a4611677dc2823b34'  // BILL-251123013314241
    ];

    console.log('🔍 البحث عن الفاتورة بـ 550 جنيه...\n');

    for (const billId of deletedBillIds) {
      console.log('='.repeat(80));
      console.log(`📋 فحص الفاتورة: ${billId}\n`);

      // Check orders
      const orders = await Order.find({ bill: new mongoose.Types.ObjectId(billId) });
      console.log(`📦 الطلبات: ${orders.length}`);

      let totalFromOrders = 0;
      if (orders.length > 0) {
        console.log('\nتفاصيل الطلبات:');
        orders.forEach(order => {
          const orderTotal = order.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
          totalFromOrders += orderTotal;
          console.log(`  - Order #${order.orderNumber}: ${orderTotal} EGP (${order.items?.length || 0} items)`);
          
          if (order.items && order.items.length > 0) {
            order.items.forEach(item => {
              console.log(`      ${item.name}: ${item.quantity} x ${item.price} = ${item.quantity * item.price} EGP`);
            });
          }
        });
        console.log(`\n  💰 إجمالي الطلبات: ${totalFromOrders} EGP`);
      }

      // Check sessions
      const sessions = await Session.find({ bill: new mongoose.Types.ObjectId(billId) });
      console.log(`\n🎮 الجلسات: ${sessions.length}`);

      let totalFromSessions = 0;
      if (sessions.length > 0) {
        console.log('\nتفاصيل الجلسات:');
        sessions.forEach(session => {
          const sessionCost = session.cost || 0;
          totalFromSessions += sessionCost;
          console.log(`  - Device: ${session.device}, Duration: ${session.duration} min, Cost: ${sessionCost} EGP`);
        });
        console.log(`\n  💰 إجمالي الجلسات: ${totalFromSessions} EGP`);
      }

      const grandTotal = totalFromOrders + totalFromSessions;
      console.log(`\n💵 الإجمالي الكلي: ${grandTotal} EGP`);

      if (grandTotal >= 500 && grandTotal <= 600) {
        console.log(`\n🎯 هذه قد تكون الفاتورة المطلوبة!`);
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

findMissingBill550();
