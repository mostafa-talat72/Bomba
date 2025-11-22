import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Define schemas directly to avoid model issues
const tableSchema = new mongoose.Schema({
  tableNumber: mongoose.Schema.Types.Mixed,
  name: String,
  type: String,
  isActive: Boolean
});

const orderSchema = new mongoose.Schema({
  table: mongoose.Schema.Types.Mixed,
  orderNumber: String
}, { strict: false });

const sessionSchema = new mongoose.Schema({
  table: mongoose.Schema.Types.Mixed,
  sessionNumber: String
}, { strict: false });

const billSchema = new mongoose.Schema({
  table: mongoose.Schema.Types.Mixed,
  billNumber: String
}, { strict: false });

const Table = mongoose.model('Table', tableSchema);
const Order = mongoose.model('Order', orderSchema);
const Session = mongoose.model('Session', sessionSchema);
const Bill = mongoose.model('Bill', billSchema);

const migrateTableReferences = async () => {
  try {
    console.log('🔄 Starting table reference migration...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all tables
    const tables = await Table.find({});
    console.log(`📊 Found ${tables.length} tables\n`);

    // Create a map of tableNumber -> table ObjectId
    const tableMap = new Map();
    tables.forEach(table => {
      // Handle both string and number table numbers
      const tableNum = String(table.tableNumber);
      tableMap.set(tableNum, table._id);
      console.log(`  - Table ${table.tableNumber} (${table.name}) -> ${table._id}`);
    });
    console.log('');

    let stats = {
      orders: { total: 0, updated: 0, skipped: 0, errors: 0, notFound: 0 },
      sessions: { total: 0, updated: 0, skipped: 0, errors: 0, notFound: 0 },
      bills: { total: 0, updated: 0, skipped: 0, errors: 0, notFound: 0 }
    };

    // Migrate Orders
    console.log('📦 Migrating Orders...');
    const orders = await Order.find({}).lean();
    stats.orders.total = orders.length;

    for (const order of orders) {
      try {
        // Check if table field exists
        if (!order.table) {
          console.log(`  ⚠ Order ${order._id}: No table field`);
          stats.orders.skipped++;
          continue;
        }

        // Check if already using ObjectId reference (24 char hex string)
        const tableStr = String(order.table);
        if (mongoose.Types.ObjectId.isValid(tableStr) && tableStr.length === 24) {
          stats.orders.skipped++;
          continue;
        }

        // Get the table ObjectId from the map
        const tableNum = tableStr;
        const tableId = tableMap.get(tableNum);

        if (tableId) {
          await Order.updateOne(
            { _id: order._id },
            { $set: { table: tableId } }
          );
          stats.orders.updated++;
          console.log(`  ✓ Updated order ${order._id}: table "${tableNum}" -> ${tableId}`);
        } else {
          console.log(`  ⚠ Order ${order._id}: No table found for "${tableNum}"`);
          stats.orders.notFound++;
        }
      } catch (error) {
        console.error(`  ✗ Error updating order ${order._id}:`, error.message);
        stats.orders.errors++;
      }
    }
    console.log('');

    // Migrate Sessions
    console.log('🎮 Migrating Sessions...');
    const sessions = await Session.find({}).lean();
    stats.sessions.total = sessions.length;

    for (const session of sessions) {
      try {
        // Check if table field exists
        if (!session.table) {
          console.log(`  ⚠ Session ${session._id}: No table field`);
          stats.sessions.skipped++;
          continue;
        }

        // Check if already using ObjectId reference
        const tableStr = String(session.table);
        if (mongoose.Types.ObjectId.isValid(tableStr) && tableStr.length === 24) {
          stats.sessions.skipped++;
          continue;
        }

        // Get the table ObjectId from the map
        const tableNum = tableStr;
        const tableId = tableMap.get(tableNum);

        if (tableId) {
          await Session.updateOne(
            { _id: session._id },
            { $set: { table: tableId } }
          );
          stats.sessions.updated++;
          console.log(`  ✓ Updated session ${session._id}: table "${tableNum}" -> ${tableId}`);
        } else {
          console.log(`  ⚠ Session ${session._id}: No table found for "${tableNum}"`);
          stats.sessions.notFound++;
        }
      } catch (error) {
        console.error(`  ✗ Error updating session ${session._id}:`, error.message);
        stats.sessions.errors++;
      }
    }
    console.log('');

    // Migrate Bills
    console.log('💰 Migrating Bills...');
    const bills = await Bill.find({}).lean();
    stats.bills.total = bills.length;

    for (const bill of bills) {
      try {
        // Check if table field exists
        if (!bill.table) {
          console.log(`  ⚠ Bill ${bill._id}: No table field`);
          stats.bills.skipped++;
          continue;
        }

        // Check if already using ObjectId reference
        const tableStr = String(bill.table);
        if (mongoose.Types.ObjectId.isValid(tableStr) && tableStr.length === 24) {
          stats.bills.skipped++;
          continue;
        }

        // Get the table ObjectId from the map
        const tableNum = tableStr;
        const tableId = tableMap.get(tableNum);

        if (tableId) {
          await Bill.updateOne(
            { _id: bill._id },
            { $set: { table: tableId } }
          );
          stats.bills.updated++;
          console.log(`  ✓ Updated bill ${bill._id}: table "${tableNum}" -> ${tableId}`);
        } else {
          console.log(`  ⚠ Bill ${bill._id}: No table found for "${tableNum}"`);
          stats.bills.notFound++;
        }
      } catch (error) {
        console.error(`  ✗ Error updating bill ${bill._id}:`, error.message);
        stats.bills.errors++;
      }
    }
    console.log('');

    // Print summary
    console.log('📊 Migration Summary:');
    console.log('═══════════════════════════════════════');
    console.log(`Orders:   ${stats.orders.updated} updated, ${stats.orders.skipped} skipped, ${stats.orders.notFound} not found, ${stats.orders.errors} errors (${stats.orders.total} total)`);
    console.log(`Sessions: ${stats.sessions.updated} updated, ${stats.sessions.skipped} skipped, ${stats.sessions.notFound} not found, ${stats.sessions.errors} errors (${stats.sessions.total} total)`);
    console.log(`Bills:    ${stats.bills.updated} updated, ${stats.bills.skipped} skipped, ${stats.bills.notFound} not found, ${stats.bills.errors} errors (${stats.bills.total} total)`);
    console.log('═══════════════════════════════════════');
    
    const totalUpdated = stats.orders.updated + stats.sessions.updated + stats.bills.updated;
    const totalErrors = stats.orders.errors + stats.sessions.errors + stats.bills.errors;
    const totalNotFound = stats.orders.notFound + stats.sessions.notFound + stats.bills.notFound;
    
    if (totalErrors > 0) {
      console.log(`\n⚠️  Migration completed with ${totalErrors} errors`);
    }
    if (totalNotFound > 0) {
      console.log(`\n⚠️  ${totalNotFound} records reference non-existent tables`);
    }
    if (totalErrors === 0 && totalNotFound === 0) {
      console.log(`\n✅ Migration completed successfully! ${totalUpdated} records updated.`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

// Run migration
migrateTableReferences();
