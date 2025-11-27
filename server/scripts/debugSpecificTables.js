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

async function debugSpecificTables() {
  try {
    console.log('🔍 فحص الطاولات المحددة...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ تم الاتصال بقاعدة البيانات\n');

    const tableIds = [
      '6920ef239a81111bbca208fd',
      '691e9b85de2401464b331e8b'
    ];

    for (const tableId of tableIds) {
      console.log('='.repeat(60));
      console.log(`\n🏓 فحص الطاولة: ${tableId}\n`);

      // Get table
      const table = await Table.findById(tableId).lean();
      
      if (!table) {
        console.log('❌ الطاولة غير موجودة!\n');
        continue;
      }

      console.log('معلومات الطاولة:');
      console.log(`  - _id: ${table._id}`);
      console.log(`  - _id type: ${typeof table._id}`);
      console.log(`  - _id.toString(): ${table._id.toString()}`);
      console.log(`  - number: ${table.number}`);
      console.log(`  - name: ${table.name || 'غير محدد'}`);
      console.log(`  - status: ${table.status}`);
      console.log(`  - section: ${table.section}`);

      // Get bills for this table
      console.log('\nالبحث عن الفواتير المرتبطة...');
      
      // Try different ways to find bills
      const billsByObjectId = await Bill.find({ 
        table: new mongoose.Types.ObjectId(tableId),
        status: { $ne: 'paid' }
      }).lean();
      
      const billsByString = await Bill.find({ 
        table: tableId,
        status: { $ne: 'paid' }
      }).lean();

      console.log(`  - بالبحث بـ ObjectId: ${billsByObjectId.length} فاتورة`);
      console.log(`  - بالبحث بـ String: ${billsByString.length} فاتورة`);

      // Get all unpaid bills and check manually
      const allUnpaidBills = await Bill.find({
        status: { $ne: 'paid' }
      }).lean();

      const matchingBills = allUnpaidBills.filter(bill => {
        if (!bill.table) return false;
        
        const billTableId = bill.table.toString();
        const targetTableId = tableId.toString();
        
        return billTableId === targetTableId;
      });

      console.log(`  - بالفلترة اليدوية: ${matchingBills.length} فاتورة`);

      if (matchingBills.length > 0) {
        console.log('\nالفواتير المطابقة:');
        matchingBills.forEach(bill => {
          console.log(`  - ${bill.billNumber}:`);
          console.log(`    - bill.table: ${bill.table}`);
          console.log(`    - bill.table type: ${typeof bill.table}`);
          console.log(`    - bill.table.toString(): ${bill.table.toString()}`);
          console.log(`    - الحالة: ${bill.status}`);
          console.log(`    - الإجمالي: ${bill.total} ج.م`);
          console.log(`    - المتبقي: ${bill.remaining} ج.م`);
        });
      } else {
        console.log('\n⚠️ لم يتم العثور على فواتير مطابقة!');
      }

      // Check what frontend would see
      console.log('\nما سيراه الـ Frontend:');
      const billsWithPopulate = await Bill.find({
        status: { $ne: 'paid' }
      })
        .populate('table')
        .lean();

      const frontendMatchingBills = billsWithPopulate.filter(bill => {
        if (!bill.table) return false;
        
        const billTableId = (bill.table._id || bill.table.id || bill.table).toString();
        const targetTableId = tableId.toString();
        
        console.log(`  - مقارنة: ${billTableId} === ${targetTableId} = ${billTableId === targetTableId}`);
        
        return billTableId === targetTableId;
      });

      console.log(`\nعدد الفواتير التي سيراها الـ Frontend: ${frontendMatchingBills.length}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ انتهى الفحص');

  } catch (error) {
    console.error('❌ خطأ:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 تم قطع الاتصال بقاعدة البيانات');
  }
}

debugSpecificTables();
