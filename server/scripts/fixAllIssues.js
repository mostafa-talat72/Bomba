import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function fixAllIssues() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const billsCollection = db.collection('bills');
    const ordersCollection = db.collection('orders');

    console.log('🔧 إصلاح جميع المشاكل...\n');

    // Fix Bill 1: BILL-251122040954024 (248 جنيه)
    console.log('1️⃣ إصلاح فاتورة 248 جنيه...');
    await billsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId('69211b72fca149529c1a7d14') },
      {
        $set: {
          billType: 'cafe',
          orders: [
            new mongoose.Types.ObjectId('69211b72fca149529c1a7d18'),
            new mongoose.Types.ObjectId('69221a8ca70c4f08b190f663'),
            new mongoose.Types.ObjectId('692244c64611677dc28228fa'),
            new mongoose.Types.ObjectId('69224ace4611677dc2824b8b'),
            new mongoose.Types.ObjectId('6922515f4611677dc28278c7')
          ],
          sessions: [],
          updatedAt: new Date()
        }
      }
    );
    console.log('   ✅ تم\n');

    // Fix Bill 2: BILL-251122044107501 (230 جنيه)
    console.log('2️⃣ إصلاح فاتورة 230 جنيه...');
    await billsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId('692122c3fca149529c1a93df') },
      {
        $set: {
          billType: 'cafe',
          orders: [
            new mongoose.Types.ObjectId('692122c4fca149529c1a93e3'),
            new mongoose.Types.ObjectId('692245d34611677dc2822e17')
          ],
          sessions: [],
          updatedAt: new Date()
        }
      }
    );
    console.log('   ✅ تم\n');

    // Fix Bill 3: BILL-251123013314241 (33 جنيه)
    console.log('3️⃣ إصلاح فاتورة 33 جنيه...');
    await billsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId('6922483a4611677dc2823b34') },
      {
        $set: {
          orders: [],
          sessions: [new mongoose.Types.ObjectId('6922483a4611677dc2823b33')],
          updatedAt: new Date()
        }
      }
    );
    console.log('   ✅ تم\n');

    // Fix Order: ORD-251120065201466
    console.log('4️⃣ إصلاح الطلب ORD-251120065201466...');
    await ordersCollection.updateOne(
      { _id: new mongoose.Types.ObjectId('691e9e71ab6c636406038add') },
      {
        $set: {
          table: new mongoose.Types.ObjectId('691e9b85de2401464b331e8b'), // محمد مصطفى
          updatedAt: new Date()
        }
      }
    );
    console.log('   ✅ تم\n');

    console.log('='  .repeat(80));
    console.log('✅ تم إصلاح جميع المشاكل بنجاح!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

fixAllIssues();
