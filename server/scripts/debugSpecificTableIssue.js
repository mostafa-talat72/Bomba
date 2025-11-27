import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const tableSchema = new mongoose.Schema({}, { strict: false, collection: 'tables' });
const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const orderSchema = new mongoose.Schema({}, { strict: false, collection: 'orders' });
const sessionSchema = new mongoose.Schema({}, { strict: false, collection: 'sessions' });

const Table = mongoose.model('Table', tableSchema);
const Bill = mongoose.model('Bill', billSchema);
const Order = mongoose.model('Order', orderSchema);
const Session = mongoose.model('Session', sessionSchema);

async function debugSpecificTables() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const tableIds = [
      '6920ef239a81111bbca208fd',
      '691e9b85de2401464b331e8b'
    ];

    for (const tableId of tableIds) {
      console.log('='.repeat(80));
      console.log(`🔍 Analyzing Table: ${tableId}`);
      console.log('='.repeat(80));

      // 1. Get table info
      const table = await Table.findById(tableId);
      if (!table) {
        console.log('❌ Table not found!');
        continue;
      }

      console.log('\n📋 Table Info:');
      console.log(JSON.stringify(table, null, 2));

      // 2. Find bills for this table
      console.log('\n💰 Bills for this table:');
      const bills = await Bill.find({ table: tableId }).sort({ createdAt: -1 });
      console.log(`Found ${bills.length} bills`);
      
      for (const bill of bills) {
        console.log('\n  Bill:', {
          _id: bill._id,
          billNumber: bill.billNumber,
          status: bill.status,
          totalAmount: bill.totalAmount,
          paidAmount: bill.paidAmount,
          remainingAmount: bill.remainingAmount,
          table: bill.table,
          createdAt: bill.createdAt
        });

        // Check orders in this bill
        const orders = await Order.find({ bill: bill._id });
        console.log(`  📦 Orders in bill: ${orders.length}`);
        orders.forEach(order => {
          console.log(`    - Order ${order._id}: ${order.status || 'no status'}`);
        });

        // Check sessions in this bill
        const sessions = await Session.find({ bill: bill._id });
        console.log(`  🎮 Sessions in bill: ${sessions.length}`);
        sessions.forEach(session => {
          console.log(`    - Session ${session._id}: ${session.status || 'no status'}, Device: ${session.device}`);
        });
      }

      // 3. Find unpaid bills specifically
      console.log('\n💸 Unpaid Bills Check:');
      const unpaidBills = await Bill.find({
        table: tableId,
        status: { $in: ['unpaid', 'partially_paid'] }
      });
      console.log(`Found ${unpaidBills.length} unpaid/partially paid bills`);

      // 4. Check if table should be reserved
      const hasUnpaidBills = unpaidBills.length > 0;
      const tableIsReserved = table.isReserved || false;
      
      console.log('\n🔍 Status Analysis:');
      console.log(`  Table isReserved in DB: ${tableIsReserved}`);
      console.log(`  Has unpaid bills: ${hasUnpaidBills}`);
      console.log(`  Expected isReserved: ${hasUnpaidBills}`);
      
      if (tableIsReserved !== hasUnpaidBills) {
        console.log('  ⚠️ MISMATCH DETECTED!');
        console.log(`  Should fix: Set isReserved to ${hasUnpaidBills}`);
      } else {
        console.log('  ✅ Status is correct');
      }

      // 5. Check active sessions
      console.log('\n🎮 Active Sessions Check:');
      const activeSessions = await Session.find({
        table: tableId,
        status: 'active'
      });
      console.log(`Found ${activeSessions.length} active sessions`);
      activeSessions.forEach(session => {
        console.log(`  - Session ${session._id}: Device ${session.device}, Bill: ${session.bill}`);
      });

      console.log('\n');
    }

    console.log('='.repeat(80));
    console.log('✅ Analysis Complete');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

debugSpecificTables();
