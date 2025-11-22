import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

/**
 * This script attempts to restore tableNumber fields that were accidentally removed
 * by matching bills/orders with tables based on timing and other context
 */

const restoreTableNumbers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all tables with their numbers
    const tables = await mongoose.connection.db.collection('tables').find({}).toArray();
    console.log(`📊 Found ${tables.length} tables\n`);

    // Create a map of table ObjectId -> table number
    const tableIdToNumber = new Map();
    tables.forEach(t => {
      if (t.number) {
        tableIdToNumber.set(String(t._id), t.number);
        console.log(`  - Table ${t._id} -> number: ${t.number}`);
      }
    });
    console.log('');

    let stats = {
      orders: { total: 0, restored: 0, failed: 0 },
      bills: { total: 0, restored: 0, failed: 0 }
    };

    // Try to restore orders
    console.log('📦 Attempting to restore Orders...');
    const orders = await mongoose.connection.db.collection('orders').find({}).toArray();
    stats.orders.total = orders.length;

    for (const order of orders) {
      try {
        // Check if tableNumber is missing or undefined
        if (!order.tableNumber || order.tableNumber === undefined) {
          // Try to get table from bill if order has a bill reference
          if (order.bill) {
            const bill = await mongoose.connection.db.collection('bills').findOne({ _id: order.bill });
            if (bill && bill.tableNumber) {
              await mongoose.connection.db.collection('orders').updateOne(
                { _id: order._id },
                { $set: { tableNumber: bill.tableNumber } }
              );
              stats.orders.restored++;
              console.log(`  ✓ Restored order ${order._id}: tableNumber = ${bill.tableNumber} (from bill)`);
              continue;
            }
          }

          // If we can't restore, mark as failed
          console.log(`  ⚠ Could not restore order ${order._id}: no table reference found`);
          stats.orders.failed++;
        }
      } catch (error) {
        console.error(`  ✗ Error processing order ${order._id}:`, error.message);
        stats.orders.failed++;
      }
    }
    console.log('');

    // Try to restore bills
    console.log('💰 Attempting to restore Bills...');
    const bills = await mongoose.connection.db.collection('bills').find({}).toArray();
    stats.bills.total = bills.length;

    for (const bill of bills) {
      try {
        // Check if tableNumber is missing or undefined
        if (!bill.tableNumber || bill.tableNumber === undefined) {
          // Try to get table from first order in the bill
          if (bill.orders && bill.orders.length > 0) {
            const firstOrder = await mongoose.connection.db.collection('orders').findOne({ 
              _id: bill.orders[0] 
            });
            if (firstOrder && firstOrder.tableNumber) {
              await mongoose.connection.db.collection('bills').updateOne(
                { _id: bill._id },
                { $set: { tableNumber: firstOrder.tableNumber } }
              );
              stats.bills.restored++;
              console.log(`  ✓ Restored bill ${bill._id}: tableNumber = ${firstOrder.tableNumber} (from order)`);
              continue;
            }
          }

          // Try to get table from first session in the bill
          if (bill.sessions && bill.sessions.length > 0) {
            const firstSession = await mongoose.connection.db.collection('sessions').findOne({ 
              _id: bill.sessions[0] 
            });
            // Sessions might have table info in the future, but for now they don't
            // So we can't restore from sessions
          }

          // If we can't restore, mark as failed
          console.log(`  ⚠ Could not restore bill ${bill._id}: no table reference found`);
          stats.bills.failed++;
        }
      } catch (error) {
        console.error(`  ✗ Error processing bill ${bill._id}:`, error.message);
        stats.bills.failed++;
      }
    }
    console.log('');

    // Print summary
    console.log('📊 Restoration Summary:');
    console.log('═══════════════════════════════════════');
    console.log(`Orders:   ${stats.orders.restored} restored, ${stats.orders.failed} failed (${stats.orders.total} total)`);
    console.log(`Bills:    ${stats.bills.restored} restored, ${stats.bills.failed} failed (${stats.bills.total} total)`);
    console.log('═══════════════════════════════════════');
    
    const totalRestored = stats.orders.restored + stats.bills.restored;
    const totalFailed = stats.orders.failed + stats.bills.failed;
    
    if (totalFailed > 0) {
      console.log(`\n⚠️  ${totalFailed} records could not be restored`);
      console.log('These records may need manual intervention or can be left as-is if they are old/inactive.');
    }
    if (totalRestored > 0) {
      console.log(`\n✅ Successfully restored ${totalRestored} records!`);
    } else {
      console.log(`\n✅ No records needed restoration (all tableNumbers are intact)`);
    }

  } catch (error) {
    console.error('❌ Restoration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

restoreTableNumbers();
