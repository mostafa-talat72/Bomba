import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const sessionSchema = new mongoose.Schema({}, { strict: false, collection: 'sessions' });

const Bill = mongoose.model('Bill', billSchema);
const Session = mongoose.model('Session', sessionSchema);

async function updateBillWithSession() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const sessionId = '691ea13fab6c63640603ae41';
    const billId = '691e9e70ab6c636406038ace';

    // Get session
    const session = await Session.findById(sessionId);
    if (!session) {
      console.log('❌ الجلسة غير موجودة!');
      return;
    }

    // Get bill
    const bill = await Bill.findById(billId);
    if (!bill) {
      console.log('❌ الفاتورة غير موجودة!');
      return;
    }

    console.log('📋 الفاتورة الحالية:');
    console.log(`   Bill Number: ${bill.billNumber}`);
    console.log(`   Total: ${bill.totalAmount} جنيه`);
    console.log(`   Items: ${bill.items?.length || 0}\n`);

    console.log('🎮 الجلسة:');
    console.log(`   Device: ${session.deviceName}`);
    console.log(`   Duration: 63 دقيقة`);
    console.log(`   Cost: ${session.finalCost} جنيه\n`);

    // Check if session already exists in bill
    const existingSessionIndex = bill.items?.findIndex(item => 
      item.type === 'session' && item.session?.toString() === sessionId
    );

    if (existingSessionIndex !== -1) {
      console.log('🔄 تحديث الجلسة الموجودة...');
      
      // Update existing session item
      const oldCost = bill.items[existingSessionIndex].total || 0;
      bill.items[existingSessionIndex].price = session.finalCost;
      bill.items[existingSessionIndex].total = session.finalCost;
      bill.items[existingSessionIndex].name = `جلسة ${session.deviceName}`;
      bill.items[existingSessionIndex].productName = `جلسة ${session.deviceName}`;
      
      // Update totals
      bill.totalAmount = bill.totalAmount - oldCost + session.finalCost;
      bill.remainingAmount = bill.totalAmount - (bill.paidAmount || 0);
      
      console.log(`   - التكلفة القديمة: ${oldCost} جنيه`);
      console.log(`   - التكلفة الجديدة: ${session.finalCost} جنيه`);
    } else {
      console.log('➕ إضافة الجلسة للفاتورة...');
      
      // Add new session item
      const sessionItem = {
        type: 'session',
        session: session._id,
        name: `جلسة ${session.deviceName}`,
        productName: `جلسة ${session.deviceName}`,
        quantity: 1,
        price: session.finalCost,
        total: session.finalCost
      };

      bill.items = bill.items || [];
      bill.items.push(sessionItem);

      // Update totals
      bill.totalAmount = bill.totalAmount + session.finalCost;
      bill.remainingAmount = bill.totalAmount - (bill.paidAmount || 0);
    }

    await bill.save();

    console.log('\n✅ تم تحديث الفاتورة بنجاح!');
    console.log(`   - الإجمالي الجديد: ${bill.totalAmount} جنيه`);
    console.log(`   - عدد العناصر: ${bill.items.length}`);
    console.log(`   - المتبقي: ${bill.remainingAmount} جنيه`);

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

updateBillWithSession();
