import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const Bill = mongoose.model('Bill', billSchema);

async function finalFixBill550() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const billId = '691e9e70ab6c636406038ace';
    const sessionId = '691ea13fab6c63640603ae41';
    const tableId = '691e9b85de2401464b331e8b';
    const orderId = '691e9e71ab6c636406038add';

    const bill = await Bill.findById(billId);
    
    if (!bill) {
      console.log('❌ الفاتورة غير موجودة!');
      return;
    }

    console.log('📋 الفاتورة: ' + bill.billNumber);
    console.log('   Current Total: ' + bill.totalAmount);
    console.log('   Current Items: ' + (bill.items?.length || 0) + '\n');

    // Add session item if not exists
    const hasSession = bill.items?.some(item => item.type === 'session' && item.session?.toString() === sessionId);
    
    if (!hasSession) {
      console.log('➕ إضافة الجلسة...');
      const sessionItem = {
        type: 'session',
        session: new mongoose.Types.ObjectId(sessionId),
        name: 'جلسة بلايستيشن 1',
        productName: 'جلسة بلايستيشن',
        quantity: 1,
        price: 15,
        total: 15
      };
      
      bill.items = bill.items || [];
      bill.items.push(sessionItem);
      bill.totalAmount = 550;
      bill.remainingAmount = 550;
    }

    // Set table
    bill.table = new mongoose.Types.ObjectId(tableId);

    // Set orders array
    bill.orders = [new mongoose.Types.ObjectId(orderId)];

    // Set sessions array
    bill.sessions = [new mongoose.Types.ObjectId(sessionId)];

    // Set billType
    bill.billType = 'mixed';

    await bill.save();

    console.log('\n✅ تم تحديث الفاتورة بنجاح!');
    console.log(`   - Total: ${bill.totalAmount} جنيه`);
    console.log(`   - Items: ${bill.items.length}`);
    console.log(`   - Table: ${bill.table}`);
    console.log(`   - Orders: ${bill.orders?.length || 0}`);
    console.log(`   - Sessions: ${bill.sessions?.length || 0}`);
    console.log(`   - Bill Type: ${bill.billType}`);

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

finalFixBill550();
