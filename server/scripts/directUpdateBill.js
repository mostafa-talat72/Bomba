import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function directUpdateBill() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const billsCollection = db.collection('bills');

    const billId = new mongoose.Types.ObjectId('691e9e70ab6c636406038ace');
    const sessionId = new mongoose.Types.ObjectId('691ea13fab6c63640603ae41');
    const tableId = new mongoose.Types.ObjectId('691e9b85de2401464b331e8b');
    const orderId = new mongoose.Types.ObjectId('691e9e71ab6c636406038add');

    console.log('🔄 تحديث الفاتورة مباشرة...\n');

    const result = await billsCollection.updateOne(
      { _id: billId },
      {
        $set: {
          table: tableId,
          totalAmount: 550,
          remainingAmount: 550,
          orders: [orderId],
          sessions: [sessionId],
          billType: 'mixed',
          updatedAt: new Date()
        },
        $push: {
          items: {
            type: 'session',
            session: sessionId,
            name: 'جلسة بلايستيشن 1',
            productName: 'جلسة بلايستيشن',
            quantity: 1,
            price: 15,
            total: 15
          }
        }
      }
    );

    console.log('✅ نتيجة التحديث:');
    console.log(`   Matched: ${result.matchedCount}`);
    console.log(`   Modified: ${result.modifiedCount}\n`);

    // Verify
    const bill = await billsCollection.findOne({ _id: billId });
    console.log('📋 التحقق من الفاتورة:');
    console.log(`   Total: ${bill.totalAmount} جنيه`);
    console.log(`   Items: ${bill.items?.length || 0}`);
    console.log(`   Table: ${bill.table}`);
    console.log(`   Orders: ${bill.orders?.length || 0}`);
    console.log(`   Sessions: ${bill.sessions?.length || 0}`);
    console.log(`   Bill Type: ${bill.billType}`);

    if (bill.items && bill.items.length > 0) {
      console.log('\n   آخر عنصر:');
      const lastItem = bill.items[bill.items.length - 1];
      console.log(`   - ${lastItem.name}: ${lastItem.price} جنيه (type: ${lastItem.type})`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

directUpdateBill();
