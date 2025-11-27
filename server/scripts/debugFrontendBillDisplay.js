import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const tableSchema = new mongoose.Schema({}, { strict: false, collection: 'tables' });
const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });

const Table = mongoose.model('Table', tableSchema);
const Bill = mongoose.model('Bill', billSchema);

async function debugFrontendBillDisplay() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const tableIds = [
      '6920ef239a81111bbca208fd', // الخديوى
      '691e9b85de2401464b331e8b'  // محمد مصطفى
    ];

    for (const tableId of tableIds) {
      console.log('='.repeat(80));
      
      const table = await Table.findById(tableId);
      console.log(`🏓 الطاولة: ${table.number} (${table.name || 'بدون اسم'})`);
      console.log(`   ID: ${tableId}\n`);

      // Simulate what the frontend does
      console.log('🖥️ محاكاة منطق الـ Frontend:\n');

      // 1. Get all bills
      const allBills = await Bill.find({});
      console.log(`📋 إجمالي الفواتير في النظام: ${allBills.length}`);

      // 2. Filter unpaid bills (like frontend does)
      const unpaidBills = allBills.filter(bill => 
        bill.status !== 'paid' && bill.status !== 'cancelled'
      );
      console.log(`💳 الفواتير غير المدفوعة: ${unpaidBills.length}\n`);

      // 3. Create table bills map (like frontend does)
      const tableBillsMap = new Map();
      unpaidBills.forEach(bill => {
        if (bill.table) {
          const billTableId = (bill.table._id || bill.table.id || bill.table).toString();
          if (!tableBillsMap.has(billTableId)) {
            tableBillsMap.set(billTableId, []);
          }
          tableBillsMap.get(billTableId).push(bill);
        }
      });

      console.log(`📊 عدد الطاولات في الـ Map: ${tableBillsMap.size}\n`);

      // 4. Check if this table is in the map
      const tableBills = tableBillsMap.get(tableId) || [];
      console.log(`🔍 فواتير هذه الطاولة في الـ Map: ${tableBills.length}`);

      if (tableBills.length > 0) {
        console.log(`✅ الطاولة موجودة في الـ Map - يجب أن تظهر محجوزة\n`);
        tableBills.forEach(bill => {
          console.log(`   💰 فاتورة #${bill.billNumber}:`);
          console.log(`      - ID: ${bill._id}`);
          console.log(`      - Status: ${bill.status}`);
          console.log(`      - Total: ${bill.totalAmount} EGP`);
          console.log(`      - Remaining: ${bill.remainingAmount} EGP`);
        });
      } else {
        console.log(`❌ الطاولة غير موجودة في الـ Map - ستظهر فارغة!\n`);
        
        // Debug: Find bills for this table directly
        const directBills = await Bill.find({ 
          table: tableId,
          status: { $nin: ['paid', 'cancelled'] }
        });
        
        console.log(`🔍 فحص مباشر: فواتير غير مدفوعة لهذه الطاولة: ${directBills.length}`);
        
        if (directBills.length > 0) {
          console.log(`⚠️ المشكلة: الفواتير موجودة لكن لا تظهر في الـ Map!\n`);
          
          directBills.forEach(bill => {
            console.log(`   💰 فاتورة #${bill.billNumber}:`);
            console.log(`      - Bill ID: ${bill._id}`);
            console.log(`      - Bill.table type: ${typeof bill.table}`);
            console.log(`      - Bill.table value: ${JSON.stringify(bill.table, null, 2)}`);
            
            if (bill.table) {
              const billTableId = (bill.table._id || bill.table.id || bill.table).toString();
              console.log(`      - Extracted table ID: ${billTableId}`);
              console.log(`      - Matches target? ${billTableId === tableId}`);
            } else {
              console.log(`      - ❌ bill.table is null/undefined!`);
            }
          });
        }
      }

      console.log('\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

debugFrontendBillDisplay();
