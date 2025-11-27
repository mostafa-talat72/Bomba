import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function fixBill33Type() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const billsCollection = db.collection('bills');

    const billId = new mongoose.Types.ObjectId('6922483a4611677dc2823b34');

    const result = await billsCollection.updateOne(
      { _id: billId },
      {
        $set: {
          billType: 'playstation',
          updatedAt: new Date()
        }
      }
    );

    console.log('✅ تم تحديث نوع الفاتورة إلى playstation');
    console.log(`   Modified: ${result.modifiedCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

fixBill33Type();
