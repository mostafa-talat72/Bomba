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
import Table from '../models/Table.js';

async function simulateFrontendLogic() {
  try {
    console.log('🔍 محاكاة منطق الـ Frontend...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ تم الاتصال بقاعدة البيانات\n');

    // Simulate what frontend does
    console.log('📋 الخطوة 1: جلب الفواتير (كما يفعل الـ Frontend)');
    console.log('='.repeat(60));
    
    const bills = await Bill.find({})
      .populate('table')
      .lean();
    
    console.log(`إجمالي الفواتير: ${bills.length}\n`);

    // Filter unpaid bills
    const unpaidBills = bills.filter(bill => 
      bill.status !== 'paid' && bill.status !== 'cancelled'
    );
    
    console.log(`الفواتير غير المدفوعة: ${unpaidBills.length}\n`);

    // Show unpaid bills with tables
    console.log('الفواتير غير المدفوعة المربوطة بطاولة:');
    unpaidBills.forEach(bill => {
      if (bill.table) {
        console.log(`  - ${bill.billNumber}:`);
        console.log(`    - bill.table type: ${typeof bill.table}`);
        console.log(`    - bill.table:`, bill.table);
        if (typeof bill.table === 'object' && bill.table !== null) {
          console.log(`    - bill.table._id: ${bill.table._id}`);
          console.log(`    - bill.table.number: ${bill.table.number}`);
        }
      }
    });

    console.log('\n📋 الخطوة 2: إنشاء Map للطاولات والفواتير');
    console.log('='.repeat(60));
    
    // Create a map of table ID to bills (EXACTLY as frontend does)
    const tableBillsMap = new Map();
    unpaidBills.forEach(bill => {
      if (bill.table) {
        const tableId = (bill.table._id || bill.table.id || bill.table).toString();
        console.log(`  - إضافة فاتورة ${bill.billNumber} للطاولة ${tableId}`);
        
        if (!tableBillsMap.has(tableId)) {
          tableBillsMap.set(tableId, []);
        }
        tableBillsMap.get(tableId).push(bill);
      }
    });

    console.log(`\nعدد الطاولات في الـ Map: ${tableBillsMap.size}`);
    console.log('محتويات الـ Map:');
    for (const [tableId, bills] of tableBillsMap.entries()) {
      console.log(`  - ${tableId}: ${bills.length} فاتورة`);
    }

    console.log('\n📋 الخطوة 3: جلب الطاولات ومعالجتها');
    console.log('='.repeat(60));
    
    const tables = await Table.find({ isActive: true }).lean();
    console.log(`إجمالي الطاولات النشطة: ${tables.length}\n`);

    // Process each table (EXACTLY as frontend does)
    const statuses = {};
    const targetTableIds = [
      '6920ef239a81111bbca208fd',
      '691e9b85de2401464b331e8b'
    ];

    for (const table of tables) {
      const tableId = (table._id || table.id).toString();
      const tableBills = tableBillsMap.get(tableId) || [];
      const hasUnpaid = tableBills.length > 0;
      
      // Only show target tables
      if (targetTableIds.includes(tableId)) {
        console.log(`\nطاولة ${table.number}:`);
        console.log(`  - table._id: ${table._id}`);
        console.log(`  - table._id type: ${typeof table._id}`);
        console.log(`  - tableId (converted): ${tableId}`);
        console.log(`  - tableBills.length: ${tableBills.length}`);
        console.log(`  - hasUnpaid: ${hasUnpaid}`);
        console.log(`  - الحالة في DB: ${table.status}`);
        
        if (tableBills.length > 0) {
          console.log(`  - الفواتير:`);
          tableBills.forEach(bill => {
            console.log(`    - ${bill.billNumber} (${bill.remaining} ج.م متبقي)`);
          });
        }
      }
      
      statuses[table.number] = {
        hasUnpaid,
        orders: []
      };
    }

    console.log('\n📊 النتيجة النهائية:');
    console.log('='.repeat(60));
    
    for (const tableId of targetTableIds) {
      const table = tables.find(t => t._id.toString() === tableId);
      if (table) {
        const status = statuses[table.number];
        console.log(`\nطاولة ${table.number}:`);
        console.log(`  - hasUnpaid: ${status.hasUnpaid}`);
        console.log(`  - سيظهر كـ: ${status.hasUnpaid ? '🔴 محجوزة (حمراء)' : '🟢 فارغة (خضراء)'}`);
        console.log(`  - الحالة الصحيحة: ${table.status === 'occupied' ? '🔴 محجوزة' : '🟢 فارغة'}`);
        console.log(`  - ${status.hasUnpaid === (table.status === 'occupied') ? '✅ صحيح' : '❌ خطأ'}`);
      }
    }

    console.log('\n✅ انتهت المحاكاة');

  } catch (error) {
    console.error('❌ خطأ:', error);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 تم قطع الاتصال بقاعدة البيانات');
  }
}

simulateFrontendLogic();
