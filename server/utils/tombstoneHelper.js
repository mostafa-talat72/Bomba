import Tombstone from "../models/Tombstone.js";
import Logger from "../middleware/logger.js";
import dualDatabaseManager from "../config/dualDatabaseManager.js";
import syncConfig from "../config/syncConfig.js";

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

    // 1. Local tombstone (always succeeds)
    await Tombstone.updateOne(
      { collectionName, documentId, organization: orgId },
      { $set: { deletedAt: new Date(), deletedBy } },
      { upsert: true }
    );

    // 2. LAN mesh push (fire-and-forget)
    try {
        const tdoc = await Tombstone.findOne({ collectionName, documentId, organization: orgId }).lean();
        if (tdoc) {
            import("./lanPeerSync.js").then((m) => {
                try { m.pushLanOp({ collection: "tombstones", type: "update", data: tdoc }); } catch {}
            }).catch(() => {});
        }
    } catch {}

    // 3. Atlas dual-write with retry queue fallback
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
        // Enqueue for retry when Atlas comes back
        await enqueueTombstoneForRetry(collectionName, documentId, orgId, deletedBy);
      }
    } else {
      Logger.warn("Atlas not available for tombstone - enqueueing for retry");
      await enqueueTombstoneForRetry(collectionName, documentId, orgId, deletedBy);
    }
  } catch (e) {
    // تجاهل خطأ duplicate أو غيره — لا نريد فشل الحذف الأصلي
    if (e.code !== 11000) Logger.warn(`Tombstone create failed for ${collectionName} ${documentId}: ${e.message}`);
  }
};

/**
 *.enqueue tombstone to sync queue for retry when Atlas comes back
 */
async function enqueueTombstoneForRetry(collectionName, documentId, orgId, deletedBy) {
  try {
    // Dynamic import to avoid circular dependency
    const { default: syncQueueManager } = await import("../services/sync/syncQueueManager.js");
    syncQueueManager.enqueue({
      type: "insert",
      collection: "tombstones",
      data: {
        _id: `${collectionName}:${documentId}`,
        collectionName,
        documentId,
        organization: orgId,
        deletedAt: new Date(),
        deletedBy,
      },
      filter: { collectionName, documentId, organization: orgId },
      origin: "local",
      instanceId: "tombstone-retry",
      timestamp: new Date(),
    });
    Logger.info(`📋 Tombstone enqueued for retry: ${collectionName}:${documentId}`);
  } catch (err) {
    Logger.error(`❌ Failed to enqueue tombstone for retry: ${err.message}`);
  }
}

export const createTombstones = async (collectionName, documentIds, organization, deletedBy = null) => {
  if (!Array.isArray(documentIds) || documentIds.length === 0) return;
  for (const id of documentIds) {
    await createTombstone(collectionName, id, organization, deletedBy);
  }
};

export default createTombstone;
