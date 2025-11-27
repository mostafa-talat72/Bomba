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

async function addSessionToBill() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const sessionId = '691ea13fab6c63640603ae41';
    const billId = '691e9e70ab6c636406038ace';

    console.log('🔍 فحص الجلسة والفاتورة...\n');

    // Get session
    const session = await Session.findById(sessionId);
    if (!session) {
      console.log('❌ الجلسة غير موجودة!');
      return;
    }

    console.log('🎮 معلومات الجلسة:');
    console.log(`   ID: ${session._id}`);
    console.log(`   Device: ${session.device}`);
    console.log(`   Device Type: ${session.deviceType}`);
    console.log(`   Table: ${session.table}`);
    console.log(`   Duration: ${session.duration} دقيقة`);
    console.log(`   Cost: ${session.cost} جنيه`);
    console.log(`   Status: ${session.status}`);
    console.log(`   Bill: ${session.bill}`);
    console.log(`   Created: ${session.createdAt}\n`);

    // Get bill
    const bill = await Bill.findById(billId);
    if (!bill) {
      console.log('❌ الفاتورة غير موجودة!');
      return;
    }

    console.log('📋 معلومات الفاتورة:');
    console.log(`   Bill Number: ${bill.billNumber}`);
    console.log(`   Current Total: ${bill.totalAmount} جنيه`);
    console.log(`   Current Items: ${bill.items?.length || 0}`);
    console.log(`   Status: ${bill.status}\n`);

    // Check if session is already in bill
    const sessionInBill = bill.items?.find(item => 
      item.type === 'session' && item.session?.toString() === sessionId
    );

    if (sessionInBill) {
      console.log('✅ الجلسة موجودة بالفعل في الفاتورة!');
      return;
    }

    // Add session to bill
    console.log('➕ إضافة الجلسة للفاتورة...\n');

    const sessionItem = {
      type: 'session',
      session: session._id,
      name: `جلسة ${session.deviceType === 'playstation' ? 'بلايستيشن' : 'كمبيوتر'}`,
      productName: `جلسة ${session.deviceType === 'playstation' ? 'بلايستيشن' : 'كمبيوتر'}`,
      quantity: 1,
      price: session.cost || 0,
      total: session.cost || 0
    };

    bill.items = bill.items || [];
    bill.items.push(sessionItem);

    // Update totals
    const newTotal = bill.totalAmount + (session.cost || 0);
    bill.totalAmount = newTotal;
    bill.remainingAmount = newTotal - (bill.paidAmount || 0);

    await bill.save();

    console.log('✅ تم إضافة الجلسة للفاتورة بنجاح!');
    console.log(`   - الإجمالي الجديد: ${bill.totalAmount} جنيه`);
    console.log(`   - عدد العناصر: ${bill.items.length}`);
    console.log(`   - تكلفة الجلسة: ${session.cost} جنيه`);

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

addSessionToBill();
