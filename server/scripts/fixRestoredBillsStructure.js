import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const Bill = mongoose.model('Bill', billSchema);

async function fixRestoredBillsStructure() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const restoredBillIds = [
      { id: '691e9e70ab6c636406038ace', table: '691e9b85de2401464b331e8b' }, // 550 جنيه - محمد مصطفى
      { id: '69211b72fca149529c1a7d14', table: '691e9b85de2401464b331e8b' }, // 248 جنيه - محمد مصطفى
      { id: '692122c3fca149529c1a93df', table: '6920ef239a81111bbca208fd' }, // 230 جنيه - الخديوى
      { id: '6922483a4611677dc2823b34', table: null }  // 33 جنيه - بدون طاولة
    ];

    for (const { id, table } of restoredBillIds) {
      console.log('='.repeat(80));
      
      const bill = await Bill.findById(id);
      if (!bill) {
        console.log(`❌ الفاتورة ${id} غير موجودة!\n`);
        continue;
      }

      console.log(`📋 الفاتورة: ${bill.billNumber}`);
      console.log(`   Current Table: ${bill.table || 'لا توجد'}`);
      console.log(`   Items: ${bill.items?.length || 0}\n`);

      let updated = false;

      // Fix table
      if (table && (!bill.table || bill.table.toString() !== table)) {
        console.log(`🔧 تحديث الطاولة إلى: ${table}`);
        bill.table = new mongoose.Types.ObjectId(table);
        updated = true;
      }

      // Add orders array if missing
      if (!bill.orders) {
        const orderItems = bill.items?.filter(item => item.type === 'order') || [];
        const uniqueOrderIds = [...new Set(orderItems.map(item => item.order?.toString()).filter(Boolean))];
        
        if (uniqueOrderIds.length > 0) {
          console.log(`🔧 إضافة orders array: ${uniqueOrderIds.length} طلب`);
          bill.orders = uniqueOrderIds.map(id => new mongoose.Types.ObjectId(id));
          updated = true;
        }
      }

      // Add sessions array if missing
      if (!bill.sessions) {
        const sessionItems = bill.items?.filter(item => item.type === 'session') || [];
        const uniqueSessionIds = [...new Set(sessionItems.map(item => item.session?.toString()).filter(Boolean))];
        
        if (uniqueSessionIds.length > 0) {
          console.log(`🔧 إضافة sessions array: ${uniqueSessionIds.length} جلسة`);
          bill.sessions = uniqueSessionIds.map(id => new mongoose.Types.ObjectId(id));
          updated = true;
        }
      }

      // Determine billType
      if (!bill.billType) {
        const hasOrders = bill.orders && bill.orders.length > 0;
        const hasSessions = bill.sessions && bill.sessions.length > 0;
        
        if (hasOrders && hasSessions) {
          bill.billType = 'mixed';
        } else if (hasSessions) {
          // Check session type from items
          const sessionItem = bill.items?.find(item => item.type === 'session');
          if (sessionItem && sessionItem.name?.includes('بلايستيشن')) {
            bill.billType = 'playstation';
          } else {
            bill.billType = 'computer';
          }
        } else if (hasOrders) {
          bill.billType = 'cafe';
        }
        
        if (bill.billType) {
          console.log(`🔧 تحديد نوع الفاتورة: ${bill.billType}`);
          updated = true;
        }
      }

      if (updated) {
        await bill.save();
        console.log(`✅ تم تحديث الفاتورة\n`);
      } else {
        console.log(`✓ الفاتورة صحيحة\n`);
      }
    }

    console.log('='.repeat(80));
    console.log('✅ اكتمل إصلاح جميع الفواتير!');

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

fixRestoredBillsStructure();
