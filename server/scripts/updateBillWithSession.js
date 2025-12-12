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

    // Check if session already exists in bill
    const existingSessionIndex = bill.items?.findIndex(item => 
      item.type === 'session' && item.session?.toString() === sessionId
    );

    if (existingSessionIndex !== -1) {
      // Update existing session item
      const oldCost = bill.items[existingSessionIndex].total || 0;
      bill.items[existingSessionIndex].price = session.finalCost;
      bill.items[existingSessionIndex].total = session.finalCost;
      bill.items[existingSessionIndex].name = `جلسة ${session.deviceName}`;
      bill.items[existingSessionIndex].productName = `جلسة ${session.deviceName}`;
      
      // Update totals
      bill.totalAmount = bill.totalAmount - oldCost + session.finalCost;
      bill.remainingAmount = bill.totalAmount - (bill.paidAmount || 0);
    } else {
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

  } catch (error) {
    // Error handled silently
  } finally {
    await mongoose.disconnect();
  }
}

updateBillWithSession();
