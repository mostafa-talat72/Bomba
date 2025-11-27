import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const Bill = mongoose.model('Bill', billSchema);

async function checkBillingPageData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('🔍 فحص الفواتير المستعادة...\n');

    const restoredBillIds = [
      '691e9e70ab6c636406038ace', // 550 جنيه
      '69211b72fca149529c1a7d14', // 248 جنيه
      '692122c3fca149529c1a93df', // 230 جنيه
      '6922483a4611677dc2823b34'  // 33 جنيه
    ];

    for (const billId of restoredBillIds) {
      const bill = await Bill.findById(billId);
      
      if (!bill) {
        console.log(`❌ الفاتورة ${billId} غير موجودة!\n`);
        continue;
      }

      console.log('='.repeat(80));
      console.log(`📋 الفاتورة: ${bill.billNumber}`);
      console.log(`   ID: ${bill._id}`);
      console.log(`   Status: ${bill.status}`);
      console.log(`   Table: ${bill.table || 'لا توجد'}`);
      console.log(`   Total Amount: ${bill.totalAmount} جنيه`);
      console.log(`   Paid Amount: ${bill.paidAmount || 0} جنيه`);
      console.log(`   Remaining Amount: ${bill.remainingAmount} جنيه`);
      console.log(`   Items: ${bill.items?.length || 0}`);
      console.log(`   Created: ${bill.createdAt}`);
      
      if (bill.items && bill.items.length > 0) {
        console.log(`\n   العناصر:`);
        bill.items.forEach((item, index) => {
          console.log(`     ${index + 1}. ${item.name || item.productName}: ${item.quantity} x ${item.price} = ${item.total} جنيه`);
        });
      }
      
      console.log('\n');
    }

    // Check all bills
    console.log('='.repeat(80));
    console.log('📊 إحصائيات جميع الفواتير:\n');

    const allBills = await Bill.find({});
    console.log(`إجمالي الفواتير: ${allBills.length}`);

    const draftBills = allBills.filter(b => b.status === 'draft');
    console.log(`فواتير draft: ${draftBills.length}`);

    const paidBills = allBills.filter(b => b.status === 'paid');
    console.log(`فواتير مدفوعة: ${paidBills.length}`);

    const cancelledBills = allBills.filter(b => b.status === 'cancelled');
    console.log(`فواتير ملغاة: ${cancelledBills.length}`);

    const billsWithTable = allBills.filter(b => b.table);
    console.log(`\nفواتير مربوطة بطاولات: ${billsWithTable.length}`);

    const billsWithoutTable = allBills.filter(b => !b.table);
    console.log(`فواتير بدون طاولات: ${billsWithoutTable.length}`);

    // Check bills with items
    const billsWithItems = allBills.filter(b => b.items && b.items.length > 0);
    console.log(`\nفواتير لديها عناصر: ${billsWithItems.length}`);

    const billsWithoutItems = allBills.filter(b => !b.items || b.items.length === 0);
    console.log(`فواتير بدون عناصر: ${billsWithoutItems.length}`);

    // Check bills with totalAmount
    const billsWithTotal = allBills.filter(b => b.totalAmount && b.totalAmount > 0);
    console.log(`\nفواتير لديها مبلغ إجمالي: ${billsWithTotal.length}`);

    const billsWithoutTotal = allBills.filter(b => !b.totalAmount || b.totalAmount === 0);
    console.log(`فواتير بدون مبلغ إجمالي: ${billsWithoutTotal.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkBillingPageData();
