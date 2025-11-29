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
    const restoredBillIds = [
      '691e9e70ab6c636406038ace', // 550 جنيه
      '69211b72fca149529c1a7d14', // 248 جنيه
      '692122c3fca149529c1a93df', // 230 جنيه
      '6922483a4611677dc2823b34'  // 33 جنيه
    ];

    for (const billId of restoredBillIds) {
      const bill = await Bill.findById(billId);
      
      if (!bill) {
        continue;
      }

      if (bill.items && bill.items.length > 0) {
        bill.items.forEach((item, index) => {
        });
      }
      
    }

    // Check all bills
  
    const allBills = await Bill.find({});

    const draftBills = allBills.filter(b => b.status === 'draft');

    const paidBills = allBills.filter(b => b.status === 'paid');

    const cancelledBills = allBills.filter(b => b.status === 'cancelled');

    const billsWithTable = allBills.filter(b => b.table);

    const billsWithoutTable = allBills.filter(b => !b.table);

    // Check bills with items
    const billsWithItems = allBills.filter(b => b.items && b.items.length > 0);

    const billsWithoutItems = allBills.filter(b => !b.items || b.items.length === 0);

    // Check bills with totalAmount
    const billsWithTotal = allBills.filter(b => b.totalAmount && b.totalAmount > 0);

    const billsWithoutTotal = allBills.filter(b => !b.totalAmount || b.totalAmount === 0);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkBillingPageData();
