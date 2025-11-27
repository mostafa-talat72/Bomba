import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const billSchema = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const Bill = mongoose.model('Bill', billSchema);

const tableSchema = new mongoose.Schema({}, { strict: false, collection: 'tables' });
const Table = mongoose.model('Table', tableSchema);

const orderSchema = new mongoose.Schema({}, { strict: false, collection: 'orders' });
const Order = mongoose.model('Order', orderSchema);

const sessionSchema = new mongoose.Schema({}, { strict: false, collection: 'sessions' });
const Session = mongoose.model('Session', sessionSchema);

async function diagnose() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // 1. Check restored bills (550, 248, 230, 33)
    console.log('=== CHECKING RESTORED BILLS ===');
    const restoredBillAmounts = [550, 248, 230, 33];
    
    for (const amount of restoredBillAmounts) {
      const bills = await Bill.find({ totalAmount: amount }).lean();
      console.log(`\n💰 Bills with amount ${amount} EGP: ${bills.length} found`);
      
      for (const bill of bills) {
        console.log(`  Bill ID: ${bill._id}`);
        console.log(`  Status: ${bill.status}`);
        console.log(`  Table: ${bill.table ? bill.table : 'NO TABLE'}`);
        console.log(`  Orders: ${bill.orders ? bill.orders.length : 0}`);
        console.log(`  Sessions: ${bill.sessions ? bill.sessions.length : 0}`);
        console.log(`  Bill Type: ${bill.billType || 'NOT SET'}`);
        console.log(`  Organization: ${bill.organization || 'NOT SET'}`);
        console.log(`  Created: ${bill.createdAt}`);
        
        // Check if table exists and its status
        if (bill.table) {
          const table = await Table.findById(bill.table).lean();
          if (table) {
            console.log(`  ✅ Table found: ${table.name}, Status: ${table.status}`);
          } else {
            console.log(`  ❌ Table NOT FOUND in database`);
          }
        }
        
        // Check orders
        if (bill.orders && bill.orders.length > 0) {
          console.log(`  📋 Checking ${bill.orders.length} orders:`);
          for (const orderId of bill.orders) {
            const order = await Order.findById(orderId).lean();
            if (order) {
              console.log(`    ✅ Order ${orderId}: ${order.items?.length || 0} items, Status: ${order.status}`);
            } else {
              console.log(`    ❌ Order ${orderId}: NOT FOUND`);
            }
          }
        }
        
        // Check sessions
        if (bill.sessions && bill.sessions.length > 0) {
          console.log(`  🎮 Checking ${bill.sessions.length} sessions:`);
          for (const sessionId of bill.sessions) {
            const session = await Session.findById(sessionId).lean();
            if (session) {
              console.log(`    ✅ Session ${sessionId}: ${session.deviceType}, Cost: ${session.cost}`);
            } else {
              console.log(`    ❌ Session ${sessionId}: NOT FOUND`);
            }
          }
        }
      }
    }

    // 2. Check all unpaid bills
    console.log('\n\n=== ALL UNPAID BILLS ===');
    const unpaidBills = await Bill.find({ status: 'unpaid' }).lean();
    console.log(`Total unpaid bills: ${unpaidBills.length}\n`);
    
    for (const bill of unpaidBills) {
      console.log(`Bill ${bill._id}: ${bill.totalAmount} EGP`);
      console.log(`  Table: ${bill.table || 'NO TABLE'}`);
      console.log(`  Orders: ${bill.orders?.length || 0}`);
      console.log(`  Sessions: ${bill.sessions?.length || 0}`);
      
      if (bill.table) {
        const table = await Table.findById(bill.table).lean();
        if (table) {
          console.log(`  Table Status: ${table.status}`);
          if (table.status !== 'occupied') {
            console.log(`  ⚠️ WARNING: Table should be occupied!`);
          }
        }
      }
    }

    // 3. Check tables with unpaid bills
    console.log('\n\n=== TABLES STATUS CHECK ===');
    const tables = await Table.find().lean();
    console.log(`Total tables: ${tables.length}\n`);
    
    for (const table of tables) {
      const billsForTable = await Bill.find({ 
        table: table._id, 
        status: 'unpaid' 
      }).lean();
      
      if (billsForTable.length > 0) {
        console.log(`Table ${table.name}:`);
        console.log(`  Status: ${table.status}`);
        console.log(`  Unpaid bills: ${billsForTable.length}`);
        console.log(`  Bill IDs: ${billsForTable.map(b => b._id).join(', ')}`);
        
        if (table.status !== 'occupied') {
          console.log(`  ❌ ERROR: Should be occupied!`);
        }
      }
    }

    // 4. Check orders without bills
    console.log('\n\n=== ORPHANED ORDERS CHECK ===');
    const allOrders = await Order.find().lean();
    console.log(`Total orders: ${allOrders.length}`);
    
    let orphanedOrders = 0;
    for (const order of allOrders) {
      const billWithOrder = await Bill.findOne({ orders: order._id }).lean();
      if (!billWithOrder) {
        orphanedOrders++;
        console.log(`❌ Orphaned order: ${order._id}, Table: ${order.table}, Items: ${order.items?.length || 0}`);
      }
    }
    console.log(`\nTotal orphaned orders: ${orphanedOrders}`);

    // 5. Check sessions without bills
    console.log('\n\n=== ORPHANED SESSIONS CHECK ===');
    const allSessions = await Session.find().lean();
    console.log(`Total sessions: ${allSessions.length}`);
    
    let orphanedSessions = 0;
    for (const session of allSessions) {
      const billWithSession = await Bill.findOne({ sessions: session._id }).lean();
      if (!billWithSession) {
        orphanedSessions++;
        console.log(`❌ Orphaned session: ${session._id}, Device: ${session.deviceType}, Cost: ${session.cost}`);
      }
    }
    console.log(`\nTotal orphaned sessions: ${orphanedSessions}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
  }
}

diagnose();
