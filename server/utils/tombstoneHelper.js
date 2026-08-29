import Tombstone from "../models/Tombstone.js";
import Logger from "../middleware/logger.js";
import dualDatabaseManager from "../config/dualDatabaseManager.js";

/**
 * إنشاء Tombstone لمنع إحياء السجل المحذوف أثناء المزامنة (لمدة سنة)
 * @param {string} collectionName - اسم المجموعة (bills, orders, tables...)
 * @param {string|ObjectId} documentId - معرف المستند
 * @param {string|ObjectId} organization - معرف المؤسسة
 * @param {string|ObjectId} deletedBy - معرف المستخدم
 */
export const createTombstone = async (collectionName, documentId, organization, deletedBy = null) => {
  try {
    if (!collectionName || !documentId || !organization) return;
    const orgId = organization?._id ? organization._id : organization;
    await Tombstone.updateOne(
      { collectionName, documentId, organization: orgId },
      { $set: { deletedAt: new Date(), deletedBy } },
      { upsert: true }
    );
    // Immediate dual-write to Atlas
    const atlasConnection = dualDatabaseManager.getAtlasConnection();
    if (atlasConnection) {
      try {
        await atlasConnection.collection('tombstones').updateOne(
          { collectionName, documentId, organization: orgId },
          { $set: { deletedAt: new Date(), deletedBy } },
          { upsert: true }
        );
      } catch (atlasErr) {
        Logger.warn(`Atlas tombstone dual-write failed for ${collectionName} ${documentId}: ${atlasErr.message}`);
      }
    } else {
      Logger.warn("Atlas not available for tombstone - will sync later");
    }
  } catch (e) {
    // تجاهل خطأ duplicate أو غيره — لا نريد فشل الحذف الأصلي
    if (e.code !== 11000) Logger.warn(`Tombstone create failed for ${collectionName} ${documentId}: ${e.message}`);
  }
};

export const createTombstones = async (collectionName, documentIds, organization, deletedBy = null) => {
  if (!Array.isArray(documentIds) || documentIds.length === 0) return;
  for (const id of documentIds) {
    await createTombstone(collectionName, id, organization, deletedBy);
  }
};

export default createTombstone;
