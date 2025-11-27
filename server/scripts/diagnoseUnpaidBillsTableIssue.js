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

async function diagnoseUnpaidBillsTableIssue() {
  try {
    console.log('🔍 بدء تشخيص مشكلة الطاولات الفارغة للفواتير غير المدفوعة...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ تم الاتصال بقاعدة البيانات\n');

    // 1. Find unpaid bills (status != 'paid')
    console.log('📋 البحث عن الفواتير غير المدفوعة بالكامل:');
    console.log('='.repeat(60));
    
    const unpaidBills = await Bill.find({
      status: { $ne: 'paid' }
    })
      .populate('table')
      .populate('orders')
      .lean();
    
    console.log(`إجمالي الفواتير غير المدفوعة: ${unpaidBills.length}\n`);

    // 2. Check which bills have table references
    const billsWithTable = unpaidBills.filter(bill => bill.table);
    const billsWithoutTable = unpaidBills.filter(bill => !bill.table);
    
    console.log(`الفواتير المربوطة بطاولة: ${billsWithTable.length}`);
    console.log(`الفواتير بدون طاولة: ${billsWithoutTable.length}\n`);

    // 3. Analyze bills with tables
    if (billsWithTable.length > 0) {
      console.log('📊 تحليل الفواتير المربوطة بطاولة:');
      console.log('='.repeat(60));
      
      for (const bill of billsWithTable) {
        console.log(`\nفاتورة ${bill.billNumber}:`);
        console.log(`  - الحالة: ${bill.status}`);
        console.log(`  - الإجمالي: ${bill.total} ج.م`);
        console.log(`  - المدفوع: ${bill.paid} ج.م`);
        console.log(`  - المتبقي: ${bill.remaining} ج.م`);
        
        if (bill.table) {
          console.log(`  - الطاولة في الفاتورة:`);
          console.log(`    - ID: ${bill.table._id || bill.table}`);
          if (bill.table.number !== undefined) {
            console.log(`    - الرقم: ${bill.table.number}`);
            console.log(`    - الاسم: ${bill.table.name || 'غير محدد'}`);
          } else {
            console.log(`    - ⚠️ الطاولة غير محملة بشكل صحيح (ObjectId فقط)`);
          }
        }
        
        // Check if orders have table reference
        if (bill.orders && bill.orders.length > 0) {
          console.log(`  - عدد الطلبات: ${bill.orders.length}`);
          bill.orders.forEach((order, index) => {
            if (order.table) {
              console.log(`    - الطلب ${index + 1}: مربوط بطاولة ${order.table._id || order.table}`);
            } else {
              console.log(`    - الطلب ${index + 1}: ⚠️ غير مربوط بطاولة`);
            }
          });
        }
      }
    }

    // 4. Check table status in database
    console.log('\n\n🏓 فحص حالة الطاولات في قاعدة البيانات:');
    console.log('='.repeat(60));
    
    const allTables = await Table.find({}).lean();
    console.log(`إجمالي الطاولات: ${allTables.length}\n`);
    
    // Get table IDs from unpaid bills
    const tableIdsFromBills = billsWithTable
      .map(bill => bill.table?._id || bill.table)
      .filter(Boolean)
      .map(id => id.toString());
    
    console.log('الطاولات المرتبطة بفواتير غير مدفوعة:');
    for (const tableId of tableIdsFromBills) {
      const table = allTables.find(t => t._id.toString() === tableId);
      if (table) {
        console.log(`\nطاولة ${table.number} (${table.name || 'بدون اسم'}):`);
        console.log(`  - ID: ${table._id}`);
        console.log(`  - الحالة: ${table.status}`);
        console.log(`  - القسم: ${table.section || 'غير محدد'}`);
        
        // Find bills for this table
        const tableBills = billsWithTable.filter(b => 
          (b.table?._id || b.table)?.toString() === tableId
        );
        
        if (tableBills.length > 0) {
          console.log(`  - الفواتير المرتبطة:`);
          tableBills.forEach(bill => {
            console.log(`    - ${bill.billNumber}: ${bill.status} (${bill.remaining} ج.م متبقي)`);
          });
        }
        
        // Check if table status should be 'occupied'
        if (table.status === 'empty' && tableBills.length > 0) {
          console.log(`  - ⚠️ المشكلة: الطاولة فارغة لكن لديها فواتير غير مدفوعة!`);
        }
      } else {
        console.log(`\n⚠️ الطاولة ${tableId} غير موجودة في قاعدة البيانات!`);
      }
    }

    // 5. Check frontend logic
    console.log('\n\n🖥️ فحص منطق Frontend:');
    console.log('='.repeat(60));
    console.log('المشكلة المحتملة:');
    console.log('1. Frontend يعتمد على populate("table") في getBills()');
    console.log('2. إذا كان populate فاشل، الطاولة لن تظهر');
    console.log('3. تحقق من أن Bill.table يحتوي على ObjectId صحيح');
    console.log('4. تحقق من أن populate يعمل بشكل صحيح في billingController.js\n');

    // 6. Recommendations
    console.log('💡 التوصيات:');
    console.log('='.repeat(60));
    console.log('1. تحديث حالة الطاولات للفواتير غير المدفوعة إلى "occupied"');
    console.log('2. التأكد من أن populate("table") يعمل في جميع endpoints');
    console.log('3. إضافة validation للتأكد من أن table هو ObjectId صحيح');
    console.log('4. تحديث frontend ليتعامل مع حالة table === null\n');

    console.log('✅ انتهى التشخيص');

  } catch (error) {
    console.error('❌ خطأ:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 تم قطع الاتصال بقاعدة البيانات');
  }
}

diagnoseUnpaidBillsTableIssue();
