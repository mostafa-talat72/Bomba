import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false });
const Bill = mongoose.model('Bill', billSchema);

const orderSchema = new mongoose.Schema({}, { strict: false });
const Order = mongoose.model('Order', orderSchema);

async function checkBills() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Check bills for table 1
    const tableId = '691df0413f4227256d224bb9';
    const bills = await Bill.find({ table: new mongoose.Types.ObjectId(tableId) });
    
    // Check orders for table 1
    const orders = await Order.find({ table: new mongoose.Types.ObjectId(tableId) });
   
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkBills();
