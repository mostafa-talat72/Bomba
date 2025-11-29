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

    const sessionId = '691ea13fab6c63640603ae41';
    const billId = '691e9e70ab6c636406038ace';


    // Get session
    const session = await Session.findById(sessionId);
    if (!session) {
      return;
    }
    // Get bill
    const bill = await Bill.findById(billId);
    if (!bill) {
      return;
    }

    // Check if session is already in bill
    const sessionInBill = bill.items?.find(item => 
      item.type === 'session' && item.session?.toString() === sessionId
    );

    if (sessionInBill) {
      return;
    }

    // Add session to bill

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


  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

addSessionToBill();
