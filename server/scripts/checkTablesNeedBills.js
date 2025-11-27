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

async function checkTablesNeedBills() {
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
      console.log(`   Status: ${table.status}\n`);

      // Get all orders for this table
      const orders = await Order.find({ table: tableId });
      console.log(`📦 إجمالي الطلبات: ${orders.length}`);

      // Get orders without bills
      const ordersWithoutBills = orders.filter(o => !o.bill);
      console.log(`⚠️ طلبات بدون فواتير: ${ordersWithoutBills.length}\n`);

      if (ordersWithoutBills.length > 0) {
        console.log('📋 تفاصيل الطلبات بدون فواتير:');
        let totalAmount = 0;
        
        ordersWithoutBills.forEach(order => {
          const orderTotal = order.totalAmount || order.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
          totalAmount += orderTotal;
          
          console.log(`\n   Order #${order.orderNumber}:`);
          console.log(`     Created: ${order.createdAt}`);
          console.log(`     Status: ${order.status}`);
          console.log(`     Items: ${order.items?.length || 0}`);
          console.log(`     Total: ${orderTotal} EGP`);
          
          if (order.items && order.items.length > 0) {
            order.items.forEach(item => {
              console.log(`       - ${item.name}: ${item.quantity} x ${item.price} EGP`);
            });
          }
        });

        console.log(`\n   💰 إجمالي المبلغ المطلوب: ${totalAmount} EGP`);
        console.log(`   🔧 يجب إنشاء فاتورة لهذه الطاولة!`);
      } else {
        console.log('✅ جميع الطلبات لديها فواتير');
      }

      // Check existing bills
      const bills = await Bill.find({ table: tableId });
      console.log(`\n💳 الفواتير الموجودة: ${bills.length}`);
      
      if (bills.length > 0) {
        bills.forEach(bill => {
          console.log(`   - Bill #${bill.billNumber}: ${bill.status}, ${bill.totalAmount || 0} EGP`);
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

checkTablesNeedBills();
