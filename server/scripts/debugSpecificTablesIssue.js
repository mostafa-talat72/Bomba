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

const Table = mongoose.model('Table', tableSchema);
const Bill = mongoose.model('Bill', billSchema);
const Order = mongoose.model('Order', orderSchema);

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
      console.log(`  Name: ${table.name}`);
      console.log(`  Status: ${table.status}`);
      console.log(`  Is Reserved: ${table.isReserved}`);
      console.log(`  Created: ${table.createdAt}`);

      // 2. Find all bills for this table
      console.log('\n💰 Bills for this table:');
      const bills = await Bill.find({ table: tableId }).sort({ createdAt: -1 });
      console.log(`  Total bills: ${bills.length}`);

      for (const bill of bills) {
        console.log(`\n  Bill #${bill.billNumber}:`);
        console.log(`    ID: ${bill._id}`);
        console.log(`    Status: ${bill.status}`);
        console.log(`    Total: ${bill.totalAmount} EGP`);
        console.log(`    Paid: ${bill.paidAmount} EGP`);
        console.log(`    Remaining: ${bill.remainingAmount} EGP`);
        console.log(`    Created: ${bill.createdAt}`);
        console.log(`    Items count: ${bill.items?.length || 0}`);
        
        if (bill.items && bill.items.length > 0) {
          console.log(`    Items:`);
          bill.items.forEach(item => {
            console.log(`      - ${item.name || item.productName || 'Unknown'}: ${item.quantity} x ${item.price} EGP`);
          });
        }
      }

      // 3. Find unpaid bills
      const unpaidBills = bills.filter(b => 
        b.status !== 'paid' && 
        b.status !== 'cancelled' && 
        b.remainingAmount > 0
      );
      
      console.log(`\n💳 Unpaid Bills: ${unpaidBills.length}`);
      unpaidBills.forEach(bill => {
        console.log(`  - Bill #${bill.billNumber}: ${bill.remainingAmount} EGP remaining`);
      });

      // 4. Find orders for this table
      console.log('\n🍽️ Orders for this table:');
      const orders = await Order.find({ table: tableId }).sort({ createdAt: -1 });
      console.log(`  Total orders: ${orders.length}`);

      for (const order of orders) {
        console.log(`\n  Order #${order.orderNumber}:`);
        console.log(`    ID: ${order._id}`);
        console.log(`    Status: ${order.status}`);
        console.log(`    Bill: ${order.bill || 'No bill linked'}`);
        console.log(`    Created: ${order.createdAt}`);
        console.log(`    Items count: ${order.items?.length || 0}`);
      }

      // 5. Find orders without bills
      const ordersWithoutBills = orders.filter(o => !o.bill);
      console.log(`\n⚠️ Orders without bills: ${ordersWithoutBills.length}`);
      ordersWithoutBills.forEach(order => {
        console.log(`  - Order #${order.orderNumber} (${order.status})`);
      });

      // 6. Check what the frontend logic would show
      console.log('\n🖥️ Frontend Logic Analysis:');
      console.log(`  Should table be reserved? ${unpaidBills.length > 0 ? 'YES' : 'NO'}`);
      console.log(`  Reason: ${unpaidBills.length > 0 ? `Has ${unpaidBills.length} unpaid bill(s)` : 'No unpaid bills'}`);
      
      if (table.isReserved && unpaidBills.length === 0) {
        console.log('  ⚠️ MISMATCH: Table marked as reserved but no unpaid bills!');
      } else if (!table.isReserved && unpaidBills.length > 0) {
        console.log('  ⚠️ MISMATCH: Table not marked as reserved but has unpaid bills!');
      } else {
        console.log('  ✅ Status matches logic');
      }

      console.log('\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

debugSpecificTables();
