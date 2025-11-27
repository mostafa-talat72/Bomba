import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const tableSchema = new mongoose.Schema({}, { strict: false, collection: 'tables' });
const Table = mongoose.model('Table', tableSchema);

const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const Bill = mongoose.model('Bill', billSchema);

async function checkTableNames() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get unpaid bills
    const unpaidBills = await Bill.find({ status: 'unpaid' }).lean();
    console.log(`Found ${unpaidBills.length} unpaid bills\n`);

    for (const bill of unpaidBills) {
      if (bill.table) {
        const table = await Table.findById(bill.table).lean();
        if (table) {
          console.log(`Bill ${bill._id} (${bill.totalAmount || bill.total} EGP):`);
          console.log(`  Table ID: ${table._id}`);
          console.log(`  Table Number: ${table.number}`);
          console.log(`  Table Name: ${table.name || 'NO NAME'}`);
          console.log(`  Table Status: ${table.status}`);
          console.log(`  Table Section: ${table.section || 'NO SECTION'}\n`);
        } else {
          console.log(`❌ Bill ${bill._id}: Table ${bill.table} NOT FOUND\n`);
        }
      } else {
        console.log(`❌ Bill ${bill._id}: NO TABLE LINKED\n`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
  }
}

checkTableNames();
