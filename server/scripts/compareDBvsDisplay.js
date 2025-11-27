import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function compareDBvsDisplay() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const Bill = mongoose.model('Bill', new mongoose.Schema({}, { strict: false, collection: 'bills' }));
    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false, collection: 'orders' }));
    
    const orgId = new mongoose.Types.ObjectId('6918b5873d4fd00d17bd018f');
    
    // Get ALL bills
    const allBills = await Bill.find({ organization: orgId })
      .sort({ createdAt: -1 })
      .lean();
    
    console.log('=== DATABASE ANALYSIS ===\n');
    console.log(`Total bills in database: ${allBills.length}\n`);
    
    // Group by date
    const billsByDate = {};
    allBills.forEach(bill => {
      const date = new Date(bill.createdAt).toLocaleDateString('ar-EG');
      if (!billsByDate[date]) {
        billsByDate[date] = [];
      }
      billsByDate[date].push(bill);
    });
    
    console.log('Bills by date (ALL):');
    Object.keys(billsByDate).sort().forEach(date => {
      console.log(`  📅 ${date}: ${billsByDate[date].length} فاتورة`);
    });
    
    // Show oldest and newest
    if (allBills.length > 0) {
      const oldest = allBills[allBills.length - 1];
      const newest = allBills[0];
      
      console.log(`\n📅 Oldest bill: #${oldest.billNumber} - ${new Date(oldest.createdAt).toLocaleString('ar-EG')}`);
      console.log(`📅 Newest bill: #${newest.billNumber} - ${new Date(newest.createdAt).toLocaleString('ar-EG')}`);
    }
    
    // Check age distribution
    const now = new Date();
    const ranges = [
      { name: 'آخر ساعة', hours: 1 },
      { name: 'آخر 6 ساعات', hours: 6 },
      { name: 'آخر 12 ساعة', hours: 12 },
      { name: 'آخر 24 ساعة', hours: 24 },
      { name: 'آخر 48 ساعة', hours: 48 },
      { name: 'آخر 72 ساعة', hours: 72 },
      { name: 'أقدم من 72 ساعة', hours: Infinity }
    ];
    
    console.log('\n=== AGE DISTRIBUTION ===\n');
    
    let previousCutoff = now;
    ranges.forEach(range => {
      const cutoff = range.hours === Infinity 
        ? new Date(0) 
        : new Date(now.getTime() - (range.hours * 60 * 60 * 1000));
      
      const count = allBills.filter(bill => {
        const billDate = new Date(bill.createdAt);
        return billDate < previousCutoff && billDate >= cutoff;
      }).length;
      
      console.log(`${range.name}: ${count} فاتورة`);
      previousCutoff = cutoff;
    });
    
    // Same for orders
    const allOrders = await Order.find({ organization: orgId })
      .sort({ createdAt: -1 })
      .lean();
    
    console.log('\n\n=== ORDERS ANALYSIS ===\n');
    console.log(`Total orders in database: ${allOrders.length}\n`);
    
    const ordersByDate = {};
    allOrders.forEach(order => {
      const date = new Date(order.createdAt).toLocaleDateString('ar-EG');
      if (!ordersByDate[date]) {
        ordersByDate[date] = [];
      }
      ordersByDate[date].push(order);
    });
    
    console.log('Orders by date (ALL):');
    Object.keys(ordersByDate).sort().forEach(date => {
      console.log(`  📅 ${date}: ${ordersByDate[date].length} طلب`);
    });
    
    if (allOrders.length > 0) {
      const oldest = allOrders[allOrders.length - 1];
      const newest = allOrders[0];
      
      console.log(`\n📅 Oldest order: #${oldest.orderNumber} - ${new Date(oldest.createdAt).toLocaleString('ar-EG')}`);
      console.log(`📅 Newest order: #${newest.orderNumber} - ${new Date(newest.createdAt).toLocaleString('ar-EG')}`);
    }
    
    console.log('\n\n=== WHAT YOU SHOULD SEE ===\n');
    console.log('في صفحة الفواتير، يجب أن ترى:');
    console.log(`- إجمالي: ${allBills.length} فاتورة`);
    console.log(`- أقدم فاتورة: ${allBills.length > 0 ? new Date(allBills[allBills.length - 1].createdAt).toLocaleDateString('ar-EG') : 'N/A'}`);
    console.log(`- أحدث فاتورة: ${allBills.length > 0 ? new Date(allBills[0].createdAt).toLocaleDateString('ar-EG') : 'N/A'}`);
    
    console.log('\nفي صفحة الطلبات، يجب أن ترى:');
    console.log(`- إجمالي: ${allOrders.length} طلب`);
    console.log(`- أقدم طلب: ${allOrders.length > 0 ? new Date(allOrders[allOrders.length - 1].createdAt).toLocaleDateString('ar-EG') : 'N/A'}`);
    console.log(`- أحدث طلب: ${allOrders.length > 0 ? new Date(allOrders[0].createdAt).toLocaleDateString('ar-EG') : 'N/A'}`);
    
    console.log('\n\n=== INSTRUCTIONS ===\n');
    console.log('الآن افتح التطبيق وأخبرني:');
    console.log('1. كم عدد الفواتير التي تراها؟');
    console.log('2. ما هو تاريخ أقدم فاتورة تظهر؟');
    console.log('3. ما هو تاريخ أحدث فاتورة تظهر؟');
    console.log('4. هل ترى فواتير من تواريخ مختلفة؟');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
  }
}

compareDBvsDisplay();
