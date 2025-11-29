import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const Bill = mongoose.model('Bill', billSchema);

async function checkBillStructure() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const billId = '691e9e70ab6c636406038ace';
    
    const bill = await Bill.findById(billId);
    
    if (!bill) {
      return;
    }

   
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkBillStructure();
