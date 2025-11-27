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

async function verifyNoDateFiltering() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const orgId = new mongoose.Types.ObjectId('6918b5873d4fd00d17bd018f');

    // Test 1: Get all bills
    console.log('=== TEST 1: GET ALL BILLS ===\n');
    const allBills = await Bill.find({ organization: orgId })
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Total bills: ${allBills.length}`);

    // Group by date
    const billsByDate = {};
    allBills.forEach(bill => {
      const date = new Date(bill.createdAt).toLocaleDateString('ar-EG');
      if (!billsByDate[date]) {
        billsByDate[date] = [];
      }
      billsByDate[date].push(bill);
    });

    console.log('\nBills by date:');
    Object.keys(billsByDate).sort().forEach(date => {
      console.log(`  📅 ${date}: ${billsByDate[date].length} فاتورة`);
    });

    // Check for old bills
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const twoDaysAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));
    
    const billsOlderThan1Day = allBills.filter(bill => new Date(bill.createdAt) < oneDayAgo);
    const billsOlderThan2Days = allBills.filter(bill => new Date(bill.createdAt) < twoDaysAgo);

    console.log(`\n📊 Age Analysis:`);
    console.log(`  🕐 Bills older than 1 day: ${billsOlderThan1Day.length}`);
    console.log(`  🕐 Bills older than 2 days: ${billsOlderThan2Days.length}`);

    // Test 2: Get all orders
    console.log('\n\n=== TEST 2: GET ALL ORDERS ===\n');
    const allOrders = await Order.find({ organization: orgId })
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Total orders: ${allOrders.length}`);

    // Group by date
    const ordersByDate = {};
    allOrders.forEach(order => {
      const date = new Date(order.createdAt).toLocaleDateString('ar-EG');
      if (!ordersByDate[date]) {
        ordersByDate[date] = [];
      }
      ordersByDate[date].push(order);
    });

    console.log('\nOrders by date:');
    Object.keys(ordersByDate).sort().forEach(date => {
      console.log(`  📅 ${date}: ${ordersByDate[date].length} طلب`);
    });

    const ordersOlderThan1Day = allOrders.filter(order => new Date(order.createdAt) < oneDayAgo);
    const ordersOlderThan2Days = allOrders.filter(order => new Date(order.createdAt) < twoDaysAgo);

    console.log(`\n📊 Age Analysis:`);
    console.log(`  🕐 Orders older than 1 day: ${ordersOlderThan1Day.length}`);
    console.log(`  🕐 Orders older than 2 days: ${ordersOlderThan2Days.length}`);

    // Summary
    console.log('\n\n=== SUMMARY ===\n');
    if (billsOlderThan1Day.length > 0) {
      console.log('✅ OLD BILLS EXIST IN DATABASE');
    } else {
      console.log('❌ NO OLD BILLS IN DATABASE');
    }

    if (ordersOlderThan1Day.length > 0) {
      console.log('✅ OLD ORDERS EXIST IN DATABASE');
    } else {
      console.log('❌ NO OLD ORDERS IN DATABASE');
    }

    console.log('\n📌 If old data exists but doesn\'t show in frontend:');
    console.log('   1. Restart the backend server');
    console.log('   2. Clear browser cache (Ctrl+Shift+Delete)');
    console.log('   3. Try incognito mode (Ctrl+Shift+N)');
    console.log('   4. Check Network tab in DevTools for API responses');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
  }
}

verifyNoDateFiltering();
