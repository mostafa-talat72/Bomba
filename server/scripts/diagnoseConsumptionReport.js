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
import Session from '../models/Session.js';
import Order from '../models/Order.js';

async function diagnoseConsumptionReport() {
  try {
    console.log('🔍 بدء تشخيص تقرير الاستهلاك...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ تم الاتصال بقاعدة البيانات\n');

    // Get today's date range (same as default in frontend)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    console.log('📅 نطاق التاريخ:');
    console.log(`   من: ${startOfDay.toLocaleString('ar-EG')}`);
    console.log(`   إلى: ${endOfDay.toLocaleString('ar-EG')}\n`);

    // 1. Check Bills
    console.log('📋 فحص الفواتير:');
    console.log('='.repeat(50));
    
    const allBills = await Bill.find({})
      .populate('orders')
      .populate('sessions')
      .lean();
    
    console.log(`إجمالي الفواتير في النظام: ${allBills.length}`);
    
    const billsInRange = allBills.filter(bill => {
      const billDate = new Date(bill.createdAt);
      return billDate >= startOfDay && billDate <= endOfDay;
    });
    
    console.log(`الفواتير في نطاق اليوم: ${billsInRange.length}`);
    
    // Analyze bills
    let billsWithOrders = 0;
    let billsWithSessions = 0;
    let totalFromBills = 0;
    
    billsInRange.forEach(bill => {
      if (bill.orders && bill.orders.length > 0) {
        billsWithOrders++;
      }
      if (bill.sessions && bill.sessions.length > 0) {
        billsWithSessions++;
      }
      totalFromBills += bill.total || 0;
    });
    
    console.log(`الفواتير التي تحتوي على طلبات: ${billsWithOrders}`);
    console.log(`الفواتير التي تحتوي على جلسات: ${billsWithSessions}`);
    console.log(`إجمالي المبلغ من الفواتير: ${totalFromBills.toFixed(2)} ج.م\n`);

    // 2. Check Orders
    console.log('🍽️ فحص الطلبات:');
    console.log('='.repeat(50));
    
    const allOrders = await Order.find({}).lean();
    console.log(`إجمالي الطلبات في النظام: ${allOrders.length}`);
    
    const ordersInRange = allOrders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startOfDay && orderDate <= endOfDay;
    });
    
    console.log(`الطلبات في نطاق اليوم: ${ordersInRange.length}`);
    
    // Analyze orders
    let totalItemsFromOrders = 0;
    let totalAmountFromOrders = 0;
    const itemsMap = new Map();
    
    ordersInRange.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          totalItemsFromOrders += item.quantity || 0;
          totalAmountFromOrders += (item.price || 0) * (item.quantity || 0);
          
          const itemName = item.name || 'غير معروف';
          if (!itemsMap.has(itemName)) {
            itemsMap.set(itemName, {
              quantity: 0,
              total: 0
            });
          }
          const existing = itemsMap.get(itemName);
          existing.quantity += item.quantity || 0;
          existing.total += (item.price || 0) * (item.quantity || 0);
        });
      }
    });
    
    console.log(`إجمالي الأصناف المباعة: ${totalItemsFromOrders}`);
    console.log(`إجمالي المبلغ من الطلبات: ${totalAmountFromOrders.toFixed(2)} ج.م`);
    console.log(`عدد الأصناف المختلفة: ${itemsMap.size}\n`);
    
    // Show top 5 items
    const sortedItems = Array.from(itemsMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);
    
    console.log('أعلى 5 أصناف مبيعاً:');
    sortedItems.forEach(([name, data], index) => {
      console.log(`${index + 1}. ${name}: ${data.quantity} قطعة - ${data.total.toFixed(2)} ج.م`);
    });
    console.log();

    // 3. Check Sessions
    console.log('🎮 فحص جلسات البلايستيشن:');
    console.log('='.repeat(50));
    
    const allSessions = await Session.find({}).lean();
    console.log(`إجمالي الجلسات في النظام: ${allSessions.length}`);
    
    const playstationSessions = allSessions.filter(s => s.deviceType === 'playstation');
    console.log(`جلسات البلايستيشن: ${playstationSessions.length}`);
    
    const completedSessions = playstationSessions.filter(s => s.status === 'completed');
    console.log(`الجلسات المكتملة: ${completedSessions.length}`);
    
    const sessionsInRange = completedSessions.filter(session => {
      if (!session.endTime) return false;
      const sessionDate = new Date(session.endTime);
      return sessionDate >= startOfDay && sessionDate <= endOfDay;
    });
    
    console.log(`الجلسات المكتملة في نطاق اليوم: ${sessionsInRange.length}`);
    
    // Analyze sessions
    let totalHours = 0;
    let totalCostFromSessions = 0;
    
    sessionsInRange.forEach(session => {
      if (session.startTime && session.endTime) {
        const start = new Date(session.startTime).getTime();
        const end = new Date(session.endTime).getTime();
        const hours = (end - start) / (1000 * 60 * 60);
        totalHours += hours;
      }
      totalCostFromSessions += session.totalCost || session.finalCost || 0;
    });
    
    console.log(`إجمالي الساعات: ${totalHours.toFixed(2)} ساعة`);
    console.log(`إجمالي المبلغ من الجلسات: ${totalCostFromSessions.toFixed(2)} ج.م\n`);

    // 4. Compare with what frontend should show
    console.log('📊 المقارنة مع ما يجب أن يظهر في التقرير:');
    console.log('='.repeat(50));
    
    const expectedTotal = totalAmountFromOrders + totalCostFromSessions;
    console.log(`المبلغ المتوقع في التقرير: ${expectedTotal.toFixed(2)} ج.م`);
    console.log(`  - من الطلبات: ${totalAmountFromOrders.toFixed(2)} ج.م`);
    console.log(`  - من الجلسات: ${totalCostFromSessions.toFixed(2)} ج.م`);
    console.log();
    
    console.log(`عدد الأصناف المتوقع: ${itemsMap.size + (sessionsInRange.length > 0 ? 1 : 0)}`);
    console.log(`  - أصناف الكافيه: ${itemsMap.size}`);
    console.log(`  - البلايستيشن: ${sessionsInRange.length > 0 ? '1 (مجموع الأجهزة)' : '0'}`);
    console.log();

    // 5. Check for potential issues
    console.log('⚠️ فحص المشاكل المحتملة:');
    console.log('='.repeat(50));
    
    let issuesFound = false;
    
    // Check bills with zero total but have orders
    const billsWithZeroTotal = billsInRange.filter(bill => 
      bill.total === 0 && bill.orders && bill.orders.length > 0
    );
    
    if (billsWithZeroTotal.length > 0) {
      console.log(`❌ فواتير بمبلغ صفر رغم وجود طلبات: ${billsWithZeroTotal.length}`);
      billsWithZeroTotal.forEach(bill => {
        console.log(`   - فاتورة ${bill.billNumber}: ${bill.orders.length} طلب`);
      });
      issuesFound = true;
    }
    
    // Check orders without bills
    const ordersWithoutBills = ordersInRange.filter(order => !order.bill);
    if (ordersWithoutBills.length > 0) {
      console.log(`❌ طلبات بدون فواتير: ${ordersWithoutBills.length}`);
      issuesFound = true;
    }
    
    // Check sessions without bills
    const sessionsWithoutBills = sessionsInRange.filter(session => !session.bill);
    if (sessionsWithoutBills.length > 0) {
      console.log(`❌ جلسات بدون فواتير: ${sessionsWithoutBills.length}`);
      issuesFound = true;
    }
    
    // Check sessions with zero cost
    const sessionsWithZeroCost = sessionsInRange.filter(session => 
      (session.totalCost || 0) === 0 && (session.finalCost || 0) === 0
    );
    if (sessionsWithZeroCost.length > 0) {
      console.log(`❌ جلسات بتكلفة صفر: ${sessionsWithZeroCost.length}`);
      sessionsWithZeroCost.forEach(session => {
        console.log(`   - جلسة ${session.deviceName || session.deviceNumber}: ${session.status}`);
      });
      issuesFound = true;
    }
    
    if (!issuesFound) {
      console.log('✅ لم يتم العثور على مشاكل واضحة');
    }
    
    console.log('\n✅ انتهى التشخيص');

  } catch (error) {
    console.error('❌ خطأ:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 تم قطع الاتصال بقاعدة البيانات');
  }
}

diagnoseConsumptionReport();
