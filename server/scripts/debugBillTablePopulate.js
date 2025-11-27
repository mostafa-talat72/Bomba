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

async function debugBillTablePopulate() {
  try {
    console.log('🔍 فحص populate للطاولات في الفواتير...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ تم الاتصال بقاعدة البيانات\n');

    // Get unpaid bills
    const unpaidBills = await Bill.find({
      status: { $ne: 'paid' }
    })
      .populate('table')
      .lean();
    
    console.log(`📋 عدد الفواتير غير المدفوعة: ${unpaidBills.length}\n`);

    unpaidBills.forEach(bill => {
      console.log(`\nفاتورة ${bill.billNumber}:`);
      console.log(`  - الحالة: ${bill.status}`);
      console.log(`  - bill.table type: ${typeof bill.table}`);
      console.log(`  - bill.table value:`, bill.table);
      
      if (bill.table) {
        if (typeof bill.table === 'object') {
          console.log(`  - ✅ table is populated object`);
          console.log(`    - _id: ${bill.table._id}`);
          console.log(`    - number: ${bill.table.number}`);
          console.log(`    - name: ${bill.table.name || 'غير محدد'}`);
        } else {
          console.log(`  - ⚠️ table is ObjectId string: ${bill.table}`);
        }
      } else {
        console.log(`  - ❌ table is null/undefined`);
      }
    });

    console.log('\n✅ انتهى الفحص');

  } catch (error) {
    console.error('❌ خطأ:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 تم قطع الاتصال بقاعدة البيانات');
  }
}

debugBillTablePopulate();
