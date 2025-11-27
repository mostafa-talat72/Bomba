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

async function comprehensiveSystemCheck() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('='  .repeat(80));
    console.log('📊 فحص شامل للنظام');
    console.log('='.repeat(80) + '\n');

    // 1. Check unpaid bills
    console.log('1️⃣ الفواتير غير المدفوعة:\n');
    const unpaidBills = await Bill.find({
      status: { $nin: ['paid', 'cancelled'] }
    });

    console.log(`   إجمالي الفواتير غير المدفوعة: ${unpaidBills.length}\n`);

    for (const bill of unpaidBills) {
      console.log(`   📋 ${bill.billNumber}:`);
      console.log(`      - Total: ${bill.totalAmount} جنيه`);
      console.log(`      - Table: ${bill.table || 'لا توجد'}`);
      console.log(`      - Status: ${bill.status}`);
      console.log(`      - Bill Type: ${bill.billType || 'غير محدد'}`);
      console.log(`      - Orders: ${bill.orders?.length || 0}`);
      console.log(`      - Sessions: ${bill.sessions?.length || 0}`);
      console.log(`      - Items: ${bill.items?.length || 0}`);
      console.log();
    }

    // 2. Check tables with unpaid bills
    console.log('\n2️⃣ الطاولات المرتبطة بفواتير غير مدفوعة:\n');
    
    const tablesWithUnpaidBills = new Set();
    unpaidBills.forEach(bill => {
      if (bill.table) {
        tablesWithUnpaidBills.add(bill.table.toString());
      }
    });

    console.log(`   عدد الطاولات: ${tablesWithUnpaidBills.size}\n`);

    for (const tableId of tablesWithUnpaidBills) {
      const table = await Table.findById(tableId);
      if (table) {
        const tableBills = unpaidBills.filter(b => b.table?.toString() === tableId);
        const totalAmount = tableBills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        
        console.log(`   🏓 ${table.number}:`);
        console.log(`      - Status في DB: ${table.status}`);
        console.log(`      - يجب أن يكون: occupied`);
        console.log(`      - عدد الفواتير: ${tableBills.length}`);
        console.log(`      - الإجمالي: ${totalAmount} جنيه`);
        
        if (table.status !== 'occupied') {
          console.log(`      ⚠️ المشكلة: الطاولة ليست محجوزة!`);
        }
        console.log();
      }
    }

    // 3. Check orders from unpaid bills
    console.log('\n3️⃣ الطلبات من الفواتير غير المدفوعة:\n');
    
    const orderIds = new Set();
    unpaidBills.forEach(bill => {
      if (bill.orders && bill.orders.length > 0) {
        bill.orders.forEach(orderId => orderIds.add(orderId.toString()));
      }
    });

    console.log(`   عدد الطلبات: ${orderIds.size}\n`);

    for (const orderId of orderIds) {
      const order = await Order.findById(orderId);
      if (order) {
        console.log(`   📦 ${order.orderNumber}:`);
        console.log(`      - Table: ${order.table || 'لا توجد'}`);
        console.log(`      - Status: ${order.status}`);
        console.log(`      - Bill: ${order.bill || 'لا توجد'}`);
        console.log(`      - Items: ${order.items?.length || 0}`);
        console.log();
      }
    }

    // 4. Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 الملخص:');
    console.log('='.repeat(80) + '\n');
    console.log(`   ✓ فواتير غير مدفوعة: ${unpaidBills.length}`);
    console.log(`   ✓ طاولات مرتبطة: ${tablesWithUnpaidBills.size}`);
    console.log(`   ✓ طلبات مرتبطة: ${orderIds.size}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

comprehensiveSystemCheck();
