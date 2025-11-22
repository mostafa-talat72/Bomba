import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

/**
 * Migration script to convert tableNumber fields to table ObjectId references
 * This script handles both cases:
 * 1. Separate tableNumber field that needs to be converted to table ObjectId
 * 2. table field containing a number/string that needs to be converted to ObjectId
 */

// Define schemas with strict: false to allow reading any fields
const tableSchema = new mongoose.Schema({
  number: mongoose.Schema.Types.Mixed,
  name: String,
  section: mongoose.Schema.Types.ObjectId,
  organization: mongoose.Schema.Types.ObjectId,
  isActive: Boolean,
  status: String
}, { strict: false });

const orderSchema = new mongoose.Schema({
  table: mongoose.Schema.Types.Mixed,
  tableNumber: mongoose.Schema.Types.Mixed,
  orderNumber: String,
  organization: mongoose.Schema.Types.ObjectId
}, { strict: false });

const billSchema = new mongoose.Schema({
  table: mongoose.Schema.Types.Mixed,
  tableNumber: mongoose.Schema.Types.Mixed,
  billNumber: String,
  organization: mongoose.Schema.Types.ObjectId
}, { strict: false });

const Table = mongoose.model('Table', tableSchema);
const Order = mongoose.model('Order', orderSchema);
const Bill = mongoose.model('Bill', billSchema);

/**
 * Build a map of table numbers to table ObjectIds
 * @returns {Map<string, ObjectId>} Map of table number -> table ObjectId
 */
async function buildTableMap() {
  const tables = await Table.find({});
  const tableMap = new Map();
  
  tables.forEach(table => {
    // Handle both string and number table numbers
    const tableNum = String(table.number);
    tableMap.set(tableNum, table._id);
  });
  
  return tableMap;
}

/**
 * Check if a value is already a valid ObjectId reference
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a valid ObjectId
 */
function isValidObjectId(value) {
  if (!value) return false;
  const str = String(value);
  return mongoose.Types.ObjectId.isValid(str) && str.length === 24;
}

/**
 * Migrate orders from tableNumber to table ObjectId
 * @param {Map<string, ObjectId>} tableMap - Map of table numbers to ObjectIds
 * @returns {Object} Migration statistics
 */
async function migrateOrders(tableMap) {
  const stats = { total: 0, updated: 0, skipped: 0, errors: 0, notFound: 0 };
  const orders = await Order.find({}).lean();
  stats.total = orders.length;

  for (const order of orders) {
    try {
      let tableNumber = null;
      let needsUpdate = false;
      let updateData = {};

      // Case 1: Has separate tableNumber field
      if (order.tableNumber !== undefined && order.tableNumber !== null) {
        tableNumber = String(order.tableNumber);
        needsUpdate = true;
      }
      // Case 2: Has table field but it's not an ObjectId
      else if (order.table && !isValidObjectId(order.table)) {
        tableNumber = String(order.table);
        needsUpdate = true;
      }
      // Case 3: Already has valid ObjectId
      else if (order.table && isValidObjectId(order.table)) {
        stats.skipped++;
        continue;
      }
      // Case 4: No table reference at all
      else {
        stats.skipped++;
        continue;
      }

      if (needsUpdate && tableNumber) {
        const tableId = tableMap.get(tableNumber);
        
        if (tableId) {
          updateData.table = tableId;
          
          // Remove tableNumber field if it exists
          if (order.tableNumber !== undefined) {
            updateData.$unset = { tableNumber: "" };
          }
          
          await Order.updateOne({ _id: order._id }, updateData);
          stats.updated++;
          console.log(`  ✓ Order ${order.orderNumber}: table "${tableNumber}" -> ${tableId}`);
        } else {
          console.log(`  ⚠ Order ${order.orderNumber}: No table found for number "${tableNumber}"`);
          stats.notFound++;
        }
      }
    } catch (error) {
      console.error(`  ✗ Error updating order ${order._id}:`, error.message);
      stats.errors++;
    }
  }

  return stats;
}

/**
 * Migrate bills from tableNumber to table ObjectId
 * @param {Map<string, ObjectId>} tableMap - Map of table numbers to ObjectIds
 * @returns {Object} Migration statistics
 */
async function migrateBills(tableMap) {
  const stats = { total: 0, updated: 0, skipped: 0, errors: 0, notFound: 0 };
  const bills = await Bill.find({}).lean();
  stats.total = bills.length;

  for (const bill of bills) {
    try {
      let tableNumber = null;
      let needsUpdate = false;
      let updateData = {};

      // Case 1: Has separate tableNumber field
      if (bill.tableNumber !== undefined && bill.tableNumber !== null) {
        tableNumber = String(bill.tableNumber);
        needsUpdate = true;
      }
      // Case 2: Has table field but it's not an ObjectId
      else if (bill.table && !isValidObjectId(bill.table)) {
        tableNumber = String(bill.table);
        needsUpdate = true;
      }
      // Case 3: Already has valid ObjectId
      else if (bill.table && isValidObjectId(bill.table)) {
        stats.skipped++;
        continue;
      }
      // Case 4: No table reference at all
      else {
        stats.skipped++;
        continue;
      }

      if (needsUpdate && tableNumber) {
        const tableId = tableMap.get(tableNumber);
        
        if (tableId) {
          updateData.table = tableId;
          
          // Remove tableNumber field if it exists
          if (bill.tableNumber !== undefined) {
            updateData.$unset = { tableNumber: "" };
          }
          
          await Bill.updateOne({ _id: bill._id }, updateData);
          stats.updated++;
          console.log(`  ✓ Bill ${bill.billNumber}: table "${tableNumber}" -> ${tableId}`);
        } else {
          console.log(`  ⚠ Bill ${bill.billNumber}: No table found for number "${tableNumber}"`);
          stats.notFound++;
        }
      }
    } catch (error) {
      console.error(`  ✗ Error updating bill ${bill._id}:`, error.message);
      stats.errors++;
    }
  }

  return stats;
}

/**
 * Verify all table references are valid ObjectIds
 * @returns {Object} Verification results
 */
async function verifyMigration() {
  const results = {
    orders: { total: 0, valid: 0, invalid: 0 },
    bills: { total: 0, valid: 0, invalid: 0 }
  };

  // Verify orders
  const orders = await Order.find({ table: { $exists: true, $ne: null } }).lean();
  results.orders.total = orders.length;
  
  for (const order of orders) {
    if (isValidObjectId(order.table)) {
      results.orders.valid++;
    } else {
      results.orders.invalid++;
      console.log(`  ⚠ Order ${order.orderNumber} has invalid table reference: ${order.table}`);
    }
  }

  // Verify bills
  const bills = await Bill.find({ table: { $exists: true, $ne: null } }).lean();
  results.bills.total = bills.length;
  
  for (const bill of bills) {
    if (isValidObjectId(bill.table)) {
      results.bills.valid++;
    } else {
      results.bills.invalid++;
      console.log(`  ⚠ Bill ${bill.billNumber} has invalid table reference: ${bill.table}`);
    }
  }

  return results;
}

/**
 * Main migration function
 */
async function runMigration() {
  let session = null;
  
  try {
    console.log('🔄 Starting table reference migration...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Start a session for transaction support
    session = await mongoose.startSession();
    session.startTransaction();

    // Build table map
    console.log('📊 Building table map...');
    const tableMap = await buildTableMap();
    console.log(`✅ Found ${tableMap.size} tables\n`);

    if (tableMap.size === 0) {
      console.log('⚠️  No tables found in database. Aborting migration.');
      await session.abortTransaction();
      return;
    }

    // Migrate orders
    console.log('📦 Migrating Orders...');
    const orderStats = await migrateOrders(tableMap);
    console.log('');

    // Migrate bills
    console.log('💰 Migrating Bills...');
    const billStats = await migrateBills(tableMap);
    console.log('');

    // Verify migration
    console.log('🔍 Verifying migration...');
    const verification = await verifyMigration();
    console.log('');

    // Print summary
    console.log('📊 Migration Summary:');
    console.log('═══════════════════════════════════════');
    console.log(`Orders:   ${orderStats.updated} updated, ${orderStats.skipped} skipped, ${orderStats.notFound} not found, ${orderStats.errors} errors (${orderStats.total} total)`);
    console.log(`Bills:    ${billStats.updated} updated, ${billStats.skipped} skipped, ${billStats.notFound} not found, ${billStats.errors} errors (${billStats.total} total)`);
    console.log('═══════════════════════════════════════');
    console.log('\n📊 Verification Results:');
    console.log('═══════════════════════════════════════');
    console.log(`Orders:   ${verification.orders.valid} valid, ${verification.orders.invalid} invalid (${verification.orders.total} total)`);
    console.log(`Bills:    ${verification.bills.valid} valid, ${verification.bills.invalid} invalid (${verification.bills.total} total)`);
    console.log('═══════════════════════════════════════');
    
    const totalErrors = orderStats.errors + billStats.errors;
    const totalNotFound = orderStats.notFound + billStats.notFound;
    const totalInvalid = verification.orders.invalid + verification.bills.invalid;
    
    // Decide whether to commit or rollback
    if (totalErrors > 0 || totalInvalid > 0) {
      console.log(`\n⚠️  Migration completed with ${totalErrors} errors and ${totalInvalid} invalid references`);
      console.log('🔄 Rolling back transaction...');
      await session.abortTransaction();
      console.log('✅ Transaction rolled back');
      process.exit(1);
    } else {
      if (totalNotFound > 0) {
        console.log(`\n⚠️  ${totalNotFound} records reference non-existent tables (these were skipped)`);
      }
      console.log('\n✅ Migration completed successfully!');
      console.log('💾 Committing transaction...');
      await session.commitTransaction();
      console.log('✅ Transaction committed');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    if (session) {
      console.log('🔄 Rolling back transaction...');
      await session.abortTransaction();
      console.log('✅ Transaction rolled back');
    }
    process.exit(1);
  } finally {
    if (session) {
      session.endSession();
    }
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Export functions for testing
export {
  buildTableMap,
  isValidObjectId,
  migrateOrders,
  migrateBills,
  verifyMigration,
  runMigration
};

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}
