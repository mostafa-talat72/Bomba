import dualDbManager from '../config/dualDatabaseManager.js';
import dotenv from 'dotenv';

dotenv.config();

async function verifyConsistency() {
  try {
    await dualDbManager.connectLocal(process.env.MONGODB_LOCAL_URI);
    await dualDbManager.connectAtlas(process.env.MONGODB_ATLAS_URI);
    
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
    
    let totalMismatches = 0;
    const mismatches = [];
    
    for (const collectionName of collections) {
      try {
        const localDb = dualDbManager.getLocalConnection().db;
        const atlasDb = dualDbManager.getAtlasConnection().db;
        
        const localCount = await localDb.collection(collectionName).countDocuments();
        const atlasCount = await atlasDb.collection(collectionName).countDocuments();
        
        const match = localCount === atlasCount;
        
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
        // Error handled silently
      }
    }
    
    await dualDbManager.closeConnections();
    process.exit(totalMismatches === 0 ? 0 : 1);
  } catch (error) {
    await dualDbManager.closeConnections();
    process.exit(1);
  }
}

verifyConsistency();
