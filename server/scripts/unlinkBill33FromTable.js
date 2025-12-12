import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function unlinkBill33FromTable() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const db = mongoose.connection.db;
    const billsCollection = db.collection('bills');

    const billId = new mongoose.Types.ObjectId('6922483a4611677dc2823b34');

    const result = await billsCollection.updateOne(
      { _id: billId },
      {
        $set: {
          table: null,
          billType: 'playstation',
          updatedAt: new Date()
        }
      }
    );

    // Verify
    const bill = await billsCollection.findOne({ _id: billId });

  } catch (error) {
    // Error handled silently
  } finally {
    await mongoose.disconnect();
  }
}

unlinkBill33FromTable();
