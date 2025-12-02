import dualDbManager from '../config/dualDatabaseManager.js';
import dotenv from 'dotenv';

dotenv.config();

async function verifyConsistency() {
  try {
    console.log('Connecting to databases...');
    await dualDbManager.connectLocal(process.env.MONGODB_LOCAL_URI);
    await dualDbManager.connectAtlas(process.env.MONGODB_ATLAS_URI);
    console.log('✓ Connected to both databases\n');
    
    const collections = [
      'bills',
      'orders',
      'sessions',
      'users',
      'menuitems',
      'menucategories',
      'menusections',
      'tables',
      'tablesections',
      'inventoryitems',
      'costs',
      'notifications',
      'settings'
    ];
    
    console.log('Verifying data consistency across collections...\n');
    console.log('Collection'.padEnd(20) + 'Local'.padEnd(12) + 'Atlas'.padEnd(12) + 'Status');
    console.log('-'.repeat(60));
    
    let totalMismatches = 0;
    const mismatches = [];
    
    for (const collectionName of collections) {
      try {
        const localDb = dualDbManager.getLocalConnection().db;
        const atlasDb = dualDbManager.getAtlasConnection().db;
        
        const localCount = await localDb.collection(collectionName).countDocuments();
        const atlasCount = await atlasDb.collection(collectionName).countDocuments();
        
        const match = localCount === atlasCount;
        const status = match ? '✓ Match' : '✗ Mismatch';
        
        console.log(
          collectionName.padEnd(20) +
          localCount.toString().padEnd(12) +
          atlasCount.toString().padEnd(12) +
          status
        );
        
        if (!match) {
          totalMismatches++;
          mismatches.push({
            collection: collectionName,
            local: localCount,
            atlas: atlasCount,
            difference: Math.abs(localCount - atlasCount)
          });
        }
      } catch (error) {
        console.log(
          collectionName.padEnd(20) +
          'Error'.padEnd(12) +
          'Error'.padEnd(12) +
          '✗ Error'
        );
        console.error(`  Error checking ${collectionName}:`, error.message);
      }
    }
    
    console.log('-'.repeat(60));
    
    if (totalMismatches === 0) {
      console.log('\n✓ All collections are consistent!');
      console.log('Local and Atlas databases are in sync.');
    } else {
      console.log(`\n✗ Found ${totalMismatches} collection(s) with mismatches:\n`);
      
      for (const mismatch of mismatches) {
        console.log(`  ${mismatch.collection}:`);
        console.log(`    Local: ${mismatch.local} documents`);
        console.log(`    Atlas: ${mismatch.atlas} documents`);
        console.log(`    Difference: ${mismatch.difference} documents`);
        console.log('');
      }
      
      console.log('Recommendation: Run a full sync to resolve inconsistencies');
      console.log('  curl -X POST http://localhost:5000/api/sync/full \\');
      console.log('    -H "Authorization: Bearer YOUR_ADMIN_TOKEN"');
    }
    
    await dualDbManager.closeConnections();
    process.exit(totalMismatches === 0 ? 0 : 1);
  } catch (error) {
    console.error('\nConsistency check failed:', error);
    await dualDbManager.closeConnections();
    process.exit(1);
  }
}

verifyConsistency();
