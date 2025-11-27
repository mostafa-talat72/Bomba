import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function linkBill33ToTable() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const billsCollection = db.collection('bills');

    const billId = new mongoose.Types.ObjectId('6922483a4611677dc2823b34'); // فاتورة 33 جنيه
    const tableId = new mongoose.Types.ObjectId('691e9b85de2401464b331e8b'); // محمد مصطفى

    console.log('🔄 ربط فاتورة 33 جنيه بطاولة محمد مصطفى...\n');

    const result = await billsCollection.updateOne(
      { _id: billId },
      {
        $set: {
          table: tableId,
          updatedAt: new Date()
        }
      }
    );

    console.log('✅ نتيجة التحديث:');
    console.log(`   Matched: ${result.matchedCount}`);
    console.log(`   Modified: ${result.modifiedCount}\n`);

    // Verify
    const bill = await billsCollection.findOne({ _id: billId });
    console.log('📋 التحقق من الفاتورة:');
    console.log(`   Bill Number: ${bill.billNumber}`);
    console.log(`   Total: ${bill.totalAmount} جنيه`);
    console.log(`   Table: ${bill.table}`);
    console.log(`   Bill Type: ${bill.billType}`);

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

linkBill33ToTable();
