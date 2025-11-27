import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const Bill = mongoose.model('Bill', billSchema);

async function fixBillStatuses() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all bills with status 'draft' that have unpaid amounts
    const draftBills = await Bill.find({ 
      status: 'draft',
      remaining: { $gt: 0 }
    }).lean();

    console.log(`Found ${draftBills.length} draft bills with remaining amounts\n`);

    for (const bill of draftBills) {
      const paid = bill.paid || 0;
      const total = bill.total || 0;
      const remaining = bill.remaining || 0;

      let newStatus = 'draft';
      
      if (paid === 0 && remaining > 0) {
        newStatus = 'unpaid';
      } else if (paid > 0 && remaining > 0) {
        newStatus = 'partial';
      } else if (remaining === 0 && paid >= total) {
        newStatus = 'paid';
      }

      if (newStatus !== 'draft') {
        await Bill.updateOne(
          { _id: bill._id },
          { $set: { status: newStatus } }
        );
        console.log(`✅ Updated bill ${bill._id} (${bill.totalAmount || bill.total} EGP)`);
        console.log(`   Old status: draft → New status: ${newStatus}`);
        console.log(`   Paid: ${paid}, Remaining: ${remaining}, Total: ${total}\n`);
      }
    }

    console.log('\n✅ All bill statuses updated successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
  }
}

fixBillStatuses();
