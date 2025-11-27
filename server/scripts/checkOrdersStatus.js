import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Import models
import Bill from '../models/Bill.js';
import Order from '../models/Order.js';
import Table from '../models/Table.js';

async function checkOrdersStatus() {
  try {
    console.log('🔍 فحص حالة الطلبات والفواتير...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ تم الاتصال بقاعدة البيانات\n');

    const targetTableIds = [
      '6920ef239a81111bbca208fd',
      '691e9b85de2401464b331e8b'
    ];

    for (const tableId of targetTableIds) {
      console.log('='.repeat(60));
      const table = await Table.findById(tableId).lean();
      
      if (!table) {
        console.log(`❌ الطاولة ${tableId} غير موجودة\n`);
        continue;
      }

      console.log(`\n🏓 طاولة: ${table.number}`);
      console.log(`   - الحالة: ${table.status}\n`);

      // Find bills for this table
      const bills = await Bill.find({
        table: tableId,
        status: { $ne: 'paid' }
      })
        .populate('orders')
        .lean();

      console.log(`📋 الفواتير غير المدفوعة: ${bills.length}`);
      
      for (const bill of bills) {
        console.log(`\n   فاتورة ${bill.billNumber}:`);
        console.log(`   - الحالة: ${bill.status}`);
        console.log(`   - الإجمالي: ${bill.total} ج.م`);
        console.log(`   - المتبقي: ${bill.remaining} ج.م`);
        console.log(`   - عدد الطلبات: ${bill.orders?.length || 0}`);

        if (bill.orders && bill.orders.length > 0) {
          console.log(`\n   الطلبات:`);
          for (const order of bill.orders) {
            console.log(`     - ${order.orderNumber}:`);
            console.log(`       - الحالة: ${order.status}`);
            console.log(`       - عدد الأصناف: ${order.items?.length || 0}`);
            
            if (order.status === 'pending' || order.status === 'delivered') {
              console.log(`       - ⚠️ حالة غير صحيحة: ${order.status}`);
            }
          }
        }
      }

      // Find orders directly for this table
      console.log(`\n📦 الطلبات المرتبطة بالطاولة مباشرة:`);
      const orders = await Order.find({
        table: tableId
      }).lean();

      console.log(`   - إجمالي الطلبات: ${orders.length}`);
      
      const ordersByStatus = {};
      orders.forEach(order => {
        if (!ordersByStatus[order.status]) {
          ordersByStatus[order.status] = 0;
        }
        ordersByStatus[order.status]++;
      });

      console.log(`   - حسب الحالة:`);
      Object.entries(ordersByStatus).forEach(([status, count]) => {
        console.log(`     - ${status}: ${count}`);
      });

      // Check if orders have bill reference
      const ordersWithoutBill = orders.filter(o => !o.bill);
      const ordersWithBill = orders.filter(o => o.bill);

      console.log(`\n   - طلبات بدون فاتورة: ${ordersWithoutBill.length}`);
      console.log(`   - طلبات مع فاتورة: ${ordersWithBill.length}`);

      if (ordersWithoutBill.length > 0) {
        console.log(`\n   ⚠️ طلبات بدون فاتورة:`);
        ordersWithoutBill.forEach(order => {
          console.log(`     - ${order.orderNumber} (${order.status})`);
        });
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n💡 التوصيات:');
    console.log('1. إلغاء حالات pending و delivered من الطلبات');
    console.log('2. التأكد من أن جميع الطلبات مربوطة بفاتورة');
    console.log('3. التأكد من أن الطاولات محجوزة للفواتير غير المدفوعة');

    console.log('\n✅ انتهى الفحص');

  } catch (error) {
    console.error('❌ خطأ:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 تم قطع الاتصال بقاعدة البيانات');
  }
}

checkOrdersStatus();
