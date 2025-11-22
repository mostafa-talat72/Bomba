# Table Reference Migration Guide

## Overview

This migration script converts legacy `tableNumber` fields to proper `table` ObjectId references in the Orders and Bills collections. This ensures data integrity and proper relationships between tables, orders, and bills.

## What This Migration Does

1. **Finds all orders and bills** with either:
   - A separate `tableNumber` field (legacy format)
   - A `table` field containing a number/string instead of an ObjectId

2. **Converts table references** to proper MongoDB ObjectId references by:
   - Looking up the table by its number
   - Replacing the number with the table's ObjectId
   - Removing the legacy `tableNumber` field if it exists

3. **Verifies all references** are valid ObjectIds after migration

4. **Uses transactions** to ensure data integrity with automatic rollback on errors

## Prerequisites

- Node.js 18+ installed
- MongoDB connection configured in `server/.env`
- Backup of your database (recommended)

## Running the Migration

### Option 1: Direct Execution

```bash
cd server
node scripts/migrateTableNumberToObjectId.js
```

### Option 2: Using npm script (if configured)

```bash
cd server
npm run migrate:tables
```

## What to Expect

The script will output:

```
🔄 Starting table reference migration...

✅ Connected to MongoDB

📊 Building table map...
✅ Found 25 tables

📦 Migrating Orders...
  ✓ Order ORD-001: table "5" -> 507f1f77bcf86cd799439011
  ✓ Order ORD-002: table "3" -> 507f1f77bcf86cd799439012
  ...

💰 Migrating Bills...
  ✓ Bill BILL-001: table "8" -> 507f1f77bcf86cd799439013
  ✓ Bill BILL-002: table "12" -> 507f1f77bcf86cd799439014
  ...

🔍 Verifying migration...

📊 Migration Summary:
═══════════════════════════════════════
Orders:   15 updated, 5 skipped, 0 not found, 0 errors (20 total)
Bills:    12 updated, 3 skipped, 0 not found, 0 errors (15 total)
═══════════════════════════════════════

📊 Verification Results:
═══════════════════════════════════════
Orders:   20 valid, 0 invalid (20 total)
Bills:    15 valid, 0 invalid (15 total)
═══════════════════════════════════════

✅ Migration completed successfully!
💾 Committing transaction...
✅ Transaction committed

🔌 Database connection closed
```

## Migration Statistics Explained

- **Updated**: Records that were successfully migrated from tableNumber to ObjectId
- **Skipped**: Records that already have valid ObjectId references (no migration needed)
- **Not Found**: Records referencing table numbers that don't exist in the database
- **Errors**: Records that failed to migrate due to errors

## Rollback Behavior

The migration uses MongoDB transactions. If any errors occur or invalid references are detected:

1. The transaction is automatically rolled back
2. No changes are committed to the database
3. An error message is displayed
4. The script exits with code 1

## Testing the Migration

Unit tests are available to verify the migration logic:

```bash
cd server
npm test -- __tests__/scripts/migrateTableNumberToObjectId.test.js
```

## Post-Migration Verification

After running the migration, verify the results:

1. **Check Orders**:
   ```javascript
   db.orders.find({ table: { $exists: true } }).forEach(order => {
     print(`Order ${order.orderNumber}: table = ${order.table}`);
   });
   ```

2. **Check Bills**:
   ```javascript
   db.bills.find({ table: { $exists: true } }).forEach(bill => {
     print(`Bill ${bill.billNumber}: table = ${bill.table}`);
   });
   ```

3. **Verify no legacy fields remain**:
   ```javascript
   db.orders.find({ tableNumber: { $exists: true } }).count(); // Should be 0
   db.bills.find({ tableNumber: { $exists: true } }).count();  // Should be 0
   ```

## Troubleshooting

### "No tables found in database"

The migration aborts if no tables exist. Ensure your Tables collection is populated before running the migration.

### "X records reference non-existent tables"

Some orders/bills reference table numbers that don't exist in the Tables collection. These records are skipped but logged. You may need to:
- Create the missing tables
- Manually fix these records
- Delete invalid records

### "Migration completed with X errors"

The transaction was rolled back. Check the error messages in the output to identify the issue. Common causes:
- Database connection issues
- Permission problems
- Schema validation errors

### Transaction Support

If your MongoDB deployment doesn't support transactions (e.g., standalone MongoDB < 4.0), you may need to:
1. Upgrade MongoDB to 4.0+
2. Use a replica set
3. Modify the script to remove transaction support (not recommended)

## Safety Features

1. **Read-only checks**: The script first reads all data before making changes
2. **Validation**: Verifies ObjectId format before and after migration
3. **Transactions**: All changes are atomic - either all succeed or all fail
4. **Idempotent**: Safe to run multiple times - already migrated records are skipped
5. **Detailed logging**: Every change is logged for audit purposes

## Related Files

- Migration script: `server/scripts/migrateTableNumberToObjectId.js`
- Unit tests: `server/__tests__/scripts/migrateTableNumberToObjectId.test.js`
- Order model: `server/models/Order.js`
- Bill model: `server/models/Bill.js`
- Table model: `server/models/Table.js`

## Support

If you encounter issues:
1. Check the error messages in the console output
2. Review the MongoDB logs
3. Verify your database connection
4. Ensure you have a recent backup
5. Run the unit tests to verify the migration logic

## Notes

- This migration is part of the cafe-table-order-linking-fix feature
- It addresses Requirements 6.1 from the specification
- The migration is designed to be safe and reversible (via backup restoration)
- Always test on a staging environment before running in production
