# Table References Migration Script

## Overview
This script migrates the database from using `tableNumber` (string/number) to proper `table` (ObjectId) references.

## Problem
The current system uses `tableNumber` as a direct value in Bills and Orders, which causes:
- No referential integrity
- Difficulty tracking table changes
- Performance issues in queries
- Data inconsistency risks

## Solution
Convert all `tableNumber` fields to `table` ObjectId references pointing to the Table collection.

## Usage

### Quick Start
```bash
npm run migrate:tables
```

### Direct Execution
```bash
cd server
node scripts/migrateTableReferences.js
```

## What It Does

### For Bills Collection:
1. Finds all bills with `tableNumber` field
2. For each bill:
   - Searches for matching Table document by number and organization
   - If found: adds `table` field with ObjectId, removes `tableNumber`
   - If not found: logs warning in report

### For Orders Collection:
Same process as Bills.

## Migration Logic

```javascript
// Before
{
  _id: ObjectId("..."),
  tableNumber: "A1",  // string or number
  // ... other fields
}

// After
{
  _id: ObjectId("..."),
  table: ObjectId("table_id"),  // reference to Table
  // ... other fields
}
```

## Matching Algorithm
1. Query Table collection for: `{ number: tableNumber, organization: billOrganization, isActive: true }`
2. If match found: use Table._id
3. If no match: log in report for manual handling

## Report Format

```
============================================================
📊 MIGRATION REPORT
============================================================

📋 Bills:
   Total: 150
   ✅ Matched & Updated: 145
   ⚠️  Not Matched: 5
   ❌ Errors: 0

📦 Orders:
   Total: 320
   ✅ Matched & Updated: 315
   ⚠️  Not Matched: 5
   ❌ Errors: 0

📈 Summary:
   Total Documents: 470
   Successfully Migrated: 460
   Not Matched: 10
   Errors: 0

⚠️  Bills with no matching table:
   - Bill: BILL-2411201234567890, tableNumber: "A1", org: 507f...
   
⚠️  Orders with no matching table:
   - Order: ORD-2411201234567892, tableNumber: "A1", org: 507f...
============================================================
```

## Handling Unmatched Records

### Option 1: Create Missing Tables
If tables should exist but don't:
```javascript
db.tables.insertOne({
  number: "A1",
  section: ObjectId("section_id"),
  organization: ObjectId("org_id"),
  isActive: true,
  createdBy: ObjectId("user_id"),
  createdAt: new Date(),
  updatedAt: new Date()
});
```

### Option 2: Assign Default Table
```javascript
db.bills.updateMany(
  { tableNumber: "A1", table: { $exists: false } },
  { $set: { table: ObjectId("default_table_id") }, $unset: { tableNumber: 1 } }
);
```

### Option 3: Remove Field for Old Data
```javascript
db.bills.updateMany(
  { tableNumber: { $exists: true } },
  { $unset: { tableNumber: 1 } }
);
```

## Safety Features

### Idempotent
- Can be run multiple times safely
- Only processes documents with `tableNumber` field
- Skips already migrated documents

### Non-Destructive
- Doesn't delete any data
- Only adds new field and removes old one
- Original data preserved in backup

### Organization-Aware
- Matches tables within same organization
- Prevents cross-organization data mixing

### Active Tables Only
- Only matches with `isActive: true` tables
- Prevents linking to deleted/inactive tables

## Verification

### Check Migration Success
```javascript
// Count migrated bills
db.bills.countDocuments({ table: { $exists: true } })

// Should be 0 after migration
db.bills.countDocuments({ tableNumber: { $exists: true } })

// Same for orders
db.orders.countDocuments({ table: { $exists: true } })
db.orders.countDocuments({ tableNumber: { $exists: true } })
```

### Verify References
```javascript
// Check if all table references are valid
db.bills.aggregate([
  { $lookup: {
      from: "tables",
      localField: "table",
      foreignField: "_id",
      as: "tableDoc"
  }},
  { $match: { "tableDoc": { $size: 0 } } }
])
```

## Backup & Restore

### Before Migration
```bash
mongodump --uri="mongodb://localhost:27017/bomba" --out=./backup-$(date +%Y%m%d)
```

### Restore if Needed
```bash
mongorestore --uri="mongodb://localhost:27017/bomba" --drop ./backup-20241120/bomba
```

## Environment Variables
```env
MONGODB_URI=mongodb://localhost:27017/bomba
```

## Dependencies
- mongoose
- dotenv
- Table, Bill, Order models

## Error Handling
- Connection errors: exits with code 1
- Document processing errors: logged but continues
- All errors tracked in report

## Performance
- Processes documents sequentially for safety
- Uses lean() queries for better performance
- Minimal memory footprint

## Next Steps After Migration
1. Update Model schemas to use `table` field
2. Update Controllers to populate table references
3. Update Frontend to use table ObjectId
4. Remove all `tableNumber` related code
5. Add indexes on `table` field for performance

## Troubleshooting

### Script Fails to Connect
- Check MongoDB is running
- Verify MONGODB_URI in .env
- Check network connectivity

### Many Unmatched Records
- Verify Table collection has correct data
- Check organization IDs match
- Ensure tables are active (`isActive: true`)

### Script Hangs
- Check MongoDB connection
- Verify no long-running operations
- Check system resources

## Support
For issues or questions, check:
1. Migration report output
2. MongoDB logs
3. Table collection data integrity
