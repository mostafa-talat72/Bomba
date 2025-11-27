import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const tableSchema = new mongoose.Schema({}, { strict: false, collection: 'tables' });
const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const orderSchema = new mongoose.Schema({}, { strict: false, collection: 'orders' });

const Table = mongoose.model('Table', tableSchema);
const Bill = mongoose.model('Bill', billSchema);
const Order = mongoose.model('Order', orderSchema);

async function fixOrphanedOccupiedTables() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('🔍 البحث عن الطاولات المحجوزة بدون فواتير...\n');

    // 1. Get all occupied tables
    const occupiedTables = await Table.find({ status: 'occupied' });
    console.log(`📊 عدد الطاولات المحجوزة: ${occupiedTables.length}\n`);

    let fixedCount = 0;
    let alreadyCorrectCount = 0;

    for (const table of occupiedTables) {
      console.log('='.repeat(60));
      console.log(`🏓 فحص الطاولة: ${table.number} (${table.name || 'بدون اسم'})`);
      console.log(`   ID: ${table._id}`);

      // 2. Check if table has unpaid bills
      const unpaidBills = await Bill.find({
        table: table._id,
        status: { $nin: ['paid', 'cancelled'] }
      });

      console.log(`   💰 الفواتير غير المدفوعة: ${unpaidBills.length}`);

      // 3. Check if table has orders
      const orders = await Order.find({ table: table._id });
      console.log(`   🍽️ الطلبات: ${orders.length}`);

      // 4. Check if table has orders without bills
      const ordersWithoutBills = orders.filter(o => !o.bill);
      console.log(`   ⚠️ طلبات بدون فواتير: ${ordersWithoutBills.length}`);

      // 5. Determine if table should be occupied
      const shouldBeOccupied = unpaidBills.length > 0;

      if (!shouldBeOccupied) {
        console.log(`   ❌ المشكلة: الطاولة محجوزة لكن لا توجد فواتير غير مدفوعة!`);
        console.log(`   🔧 تغيير الحالة إلى: empty`);
        
        table.status = 'empty';
        await table.save();
        fixedCount++;
        
        console.log(`   ✅ تم الإصلاح`);
      } else {
        console.log(`   ✅ الحالة صحيحة (لديها ${unpaidBills.length} فاتورة غير مدفوعة)`);
        alreadyCorrectCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 ملخص النتائج:');
    console.log(`   ✅ طاولات تم إصلاحها: ${fixedCount}`);
    console.log(`   ✓ طاولات صحيحة بالفعل: ${alreadyCorrectCount}`);
    console.log(`   📊 إجمالي الطاولات المفحوصة: ${occupiedTables.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

fixOrphanedOccupiedTables();
