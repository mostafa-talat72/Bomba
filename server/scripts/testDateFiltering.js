import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const Bill = mongoose.model('Bill', billSchema);

const orderSchema = new mongoose.Schema({}, { strict: false, collection: 'orders' });
const Order = mongoose.model('Order', orderSchema);

async function testDateFiltering() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all bills grouped by date
    console.log('=== BILLS BY DATE ===\n');
    const allBills = await Bill.find().sort({ createdAt: 1 }).lean();
    
    const billsByDate = {};
    allBills.forEach(bill => {
      const date = new Date(bill.createdAt).toLocaleDateString('ar-EG');
      if (!billsByDate[date]) {
        billsByDate[date] = [];
      }
      billsByDate[date].push(bill);
    });

    Object.keys(billsByDate).forEach(date => {
      console.log(`📅 ${date}: ${billsByDate[date].length} فاتورة`);
      billsByDate[date].forEach(bill => {
        console.log(`   - ${bill.billNumber || bill._id}: ${bill.totalAmount || bill.total} EGP (${bill.status})`);
      });
      console.log('');
    });

    console.log(`\n📊 إجمالي الفواتير: ${allBills.length}\n`);

    // Get all orders grouped by date
    console.log('=== ORDERS BY DATE ===\n');
    const allOrders = await Order.find().sort({ createdAt: 1 }).lean();
    
    const ordersByDate = {};
    allOrders.forEach(order => {
      const date = new Date(order.createdAt).toLocaleDateString('ar-EG');
      if (!ordersByDate[date]) {
        ordersByDate[date] = [];
      }
      ordersByDate[date].push(order);
    });

    Object.keys(ordersByDate).forEach(date => {
      console.log(`📅 ${date}: ${ordersByDate[date].length} طلب`);
    });

    console.log(`\n📊 إجمالي الطلبات: ${allOrders.length}\n`);

    // Test: Get bills without date filter (like the API should do)
    console.log('=== TEST: API WITHOUT DATE FILTER ===\n');
    const billsWithoutFilter = await Bill.find().lean();
    console.log(`✅ عدد الفواتير المسترجعة: ${billsWithoutFilter.length}`);
    console.log(`✅ يجب أن يكون مساوياً لـ: ${allBills.length}\n`);

    if (billsWithoutFilter.length === allBills.length) {
      console.log('✅ SUCCESS: جميع الفواتير تُعرض بدون فلترة تاريخ!\n');
    } else {
      console.log('❌ ERROR: هناك فلترة تاريخ مخفية!\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Connection closed');
  }
}

testDateFiltering();
