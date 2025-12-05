import Logger from '../middleware/logger.js';
import syncConfig from '../config/syncConfig.js';
import dualDatabaseManager from '../config/dualDatabaseManager.js';

/**
 * Helper function to delete a document from both Local and Atlas MongoDB
 * @param {Object} document - Mongoose document to delete
 * @param {String} collectionName - Name of the collection in Atlas
 * @param {String} itemName - Name of the item for logging (e.g., "order", "bill", "cost")
 * @returns {Promise<void>}
 */
export const deleteFromBothDatabases = async (document, collectionName, itemName = 'item') => {
    const documentId = document._id;
    const originalSyncEnabled = syncConfig.enabled;
    
    try {
        // تعطيل المزامنة التلقائية
        syncConfig.enabled = false;
        Logger.info(`🔒 Sync middleware disabled for direct delete operation`);
        
        // حذف من Local
        await document.deleteOne();
        Logger.info(`✓ Deleted ${itemName} from Local MongoDB`);
        
        // حذف من Atlas
        const atlasConnection = dualDatabaseManager.getAtlasConnection();
        if (atlasConnection) {
            try {
                const atlasCollection = atlasConnection.collection(collectionName);
                const atlasDeleteResult = await atlasCollection.deleteOne({ _id: documentId });
                Logger.info(`✓ Deleted ${itemName} from Atlas (deletedCount: ${atlasDeleteResult.deletedCount})`);
            } catch (atlasError) {
                Logger.warn(`⚠️ Failed to delete ${itemName} from Atlas: ${atlasError.message}`);
            }
        } else {
            Logger.warn(`⚠️ Atlas connection not available - ${itemName} will be synced later`);
        }
    } finally {
        // إعادة تفعيل المزامنة
        syncConfig.enabled = originalSyncEnabled;
        Logger.info(`🔓 Sync middleware re-enabled`);
    }
};

/**
 * Helper function to delete multiple documents from both Local and Atlas MongoDB
 * @param {Array} documentIds - Array of document IDs to delete
 * @param {Object} Model - Mongoose model
 * @param {String} collectionName - Name of the collection in Atlas
 * @param {String} itemName - Name of the items for logging (e.g., "orders", "sessions")
 * @returns {Promise<void>}
 */
export const deleteManyFromBothDatabases = async (documentIds, Model, collectionName, itemName = 'items') => {
    if (!documentIds || documentIds.length === 0) {
        Logger.info(`ℹ️ No ${itemName} to delete`);
        return;
    }

    const originalSyncEnabled = syncConfig.enabled;
    
    try {
        // تعطيل المزامنة التلقائية
        syncConfig.enabled = false;
        Logger.info(`🔒 Sync middleware disabled for direct delete operation`);
        
        Logger.info(`🗑️ Deleting ${documentIds.length} ${itemName}`);
        
        // حذف من Local
        const deleteResult = await Model.deleteMany({ _id: { $in: documentIds } });
        Logger.info(`✓ Deleted ${deleteResult.deletedCount} ${itemName} from Local MongoDB`);
        
        // حذف من Atlas
        const atlasConnection = dualDatabaseManager.getAtlasConnection();
        if (atlasConnection) {
            try {
                const atlasCollection = atlasConnection.collection(collectionName);
                const atlasDeleteResult = await atlasCollection.deleteMany({ 
                    _id: { $in: documentIds } 
                });
                Logger.info(`✓ Deleted ${atlasDeleteResult.deletedCount} ${itemName} from Atlas MongoDB`);
            } catch (atlasError) {
                Logger.error(`❌ Failed to delete ${itemName} from Atlas: ${atlasError.message}`);
            }
        } else {
            Logger.warn(`⚠️ Atlas connection not available - ${itemName} will be synced for deletion later`);
        }
    } finally {
        // إعادة تفعيل المزامنة
        syncConfig.enabled = originalSyncEnabled;
        Logger.info(`🔓 Sync middleware re-enabled`);
    }
};

export default {
    deleteFromBothDatabases,
    deleteManyFromBothDatabases
};
