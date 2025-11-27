import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const Bill = mongoose.model('Bill', billSchema);

async function revertBillStatusesToDraft() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all bills with status 'unpaid' that were changed from 'draft'
    const unpaidBills = await Bill.find({ 
      status: 'unpaid'
    }).lean();

    console.log(`Found ${unpaidBills.length} unpaid bills\n`);

    for (const bill of unpaidBills) {
      await Bill.updateOne(
        { _id: bill._id },
        { $set: { status: 'draft' } }
      );
      console.log(`✅ Reverted bill ${bill._id} (${bill.totalAmount || bill.total} EGP)`);
      console.log(`   Status: unpaid → draft\n`);
    }

    console.log('\n✅ All bill statuses reverted to draft successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
  }
}

revertBillStatusesToDraft();
