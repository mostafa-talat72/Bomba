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

async function fixTableStatusForUnpaidBills() {
  try {
    console.log('🔧 بدء إصلاح حالة الطاولات للفواتير غير المدفوعة...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ تم الاتصال بقاعدة البيانات\n');

    // 1. Find all unpaid bills with tables
    const unpaidBills = await Bill.find({
      status: { $ne: 'paid' },
      table: { $exists: true, $ne: null }
    }).lean();
    
    console.log(`📋 عدد الفواتير غير المدفوعة المربوطة بطاولة: ${unpaidBills.length}\n`);

    if (unpaidBills.length === 0) {
      console.log('✅ لا توجد فواتير غير مدفوعة تحتاج إلى إصلاح');
      return;
    }

    // 2. Get unique table IDs
    const tableIds = [...new Set(unpaidBills.map(bill => bill.table.toString()))];
    console.log(`🏓 عدد الطاولات المتأثرة: ${tableIds.length}\n`);

    // 3. Update table status to 'occupied' for these tables
    let updatedCount = 0;
    let alreadyOccupiedCount = 0;

    for (const tableId of tableIds) {
      const table = await Table.findById(tableId);
      
      if (!table) {
        console.log(`⚠️ الطاولة ${tableId} غير موجودة`);
        continue;
      }

      if (table.status === 'occupied') {
        alreadyOccupiedCount++;
        console.log(`✓ الطاولة ${table.number} (${table.name || 'بدون اسم'}) - الحالة صحيحة بالفعل (occupied)`);
      } else {
        table.status = 'occupied';
        await table.save();
        updatedCount++;
        console.log(`✅ تم تحديث الطاولة ${table.number} (${table.name || 'بدون اسم'}) من ${table.status} إلى occupied`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 ملخص الإصلاح:');
    console.log(`  - الطاولات المحدثة: ${updatedCount}`);
    console.log(`  - الطاولات الصحيحة بالفعل: ${alreadyOccupiedCount}`);
    console.log(`  - الإجمالي: ${tableIds.length}`);
    console.log('='.repeat(60));

    console.log('\n✅ انتهى الإصلاح بنجاح!');

  } catch (error) {
    console.error('❌ خطأ:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 تم قطع الاتصال بقاعدة البيانات');
  }
}

fixTableStatusForUnpaidBills();
