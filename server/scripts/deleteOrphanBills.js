import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const Bill = mongoose.model('Bill', billSchema);

async function deleteOrphanBills() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('🔍 البحث عن الفواتير اليتيمة (بدون طاولة وبدون عناصر)...\n');

    // Find bills with no table and no items
    const orphanBills = await Bill.find({
      $or: [
        { table: null },
        { table: { $exists: false } }
      ],
      $or: [
        { items: { $size: 0 } },
        { items: { $exists: false } },
        { items: null }
      ],
      status: { $nin: ['paid', 'cancelled'] }
    });

    console.log(`📊 عدد الفواتير اليتيمة: ${orphanBills.length}\n`);

    if (orphanBills.length === 0) {
      console.log('✅ لا توجد فواتير يتيمة!');
      return;
    }

    for (const bill of orphanBills) {
      console.log(`🗑️ حذف الفاتورة: ${bill.billNumber}`);
      console.log(`   ID: ${bill._id}`);
      console.log(`   Status: ${bill.status}`);
      console.log(`   Table: ${bill.table}`);
      console.log(`   Items: ${bill.items?.length || 0}`);
      console.log(`   Created: ${bill.createdAt}`);
      
      await Bill.deleteOne({ _id: bill._id });
      console.log(`   ✅ تم الحذف\n`);
    }

    console.log(`\n✅ تم حذف ${orphanBills.length} فاتورة يتيمة`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

deleteOrphanBills();
