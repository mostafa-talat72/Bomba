import mongoose from "mongoose";
import Tombstone from "../models/Tombstone.js";
import Logger from "../middleware/logger.js";
import dualDatabaseManager from "../config/dualDatabaseManager.js";
import syncConfig from "../config/syncConfig.js";

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

/**
 * Normalise an organization value to a storable id.
 * Accepts ObjectId / populated doc / 24-hex string / legacy string.
 * ANYTHING else (filter objects, arrays, ...) → null, with a warning that
 * reveals the offending shape. A null-org tombstone still protects the doc:
 * all resurrection checks match on (collectionName + documentId) only.
 */
function normaliseOrgId(collectionName, documentId, organization) {
  try {
    const v = organization?._id ?? organization;
    if (v == null || v === "") return null;
    if (v instanceof mongoose.Types.ObjectId) return v;
    if (typeof v === "string") {
      if (OBJECT_ID_RE.test(v)) {
        try {
          return new mongoose.Types.ObjectId(v);
        } catch {
          return v;
        }
      }
      return v; // legacy string storage — keep as-is
    }
    if (typeof v === "number") return v;
    Logger.warn(
      `⚠️ Tombstone for ${collectionName} ${documentId}: unusable organization value ` +
        `(type ${Array.isArray(v) ? "array" : typeof v}` +
        `${v && typeof v === "object" ? ` keys=[${Object.keys(v).join(",")}]` : ""}) — recording with null org`
    );
    return null;
  } catch {
    return null;
  }
}

/**
 * إنشاء Tombstone لمنع إحياء السجل المحذوف أثناء المزامنة (لمدة سنة)
 * @param {string} collectionName - اسم المجموعة (bills, orders, tables...)
 * @param {string|ObjectId} documentId - معرف المستند
 * @param {string|ObjectId} organization - معرف المؤسسة
 * @param {string|ObjectId} deletedBy - معرف المستخدم
 */
export const createTombstone = async (collectionName, documentId, organization, deletedBy = null) => {
  try {
    if (!collectionName || !documentId) {
      Logger.warn(`⚠️ Tombstone SKIPPED: missing ${!collectionName ? 'collectionName' : 'documentId'}`);
      return;
    }
    const orgId = normaliseOrgId(collectionName, documentId, organization);
    const tombstoneId = `${collectionName}:${documentId}`;
    const now = new Date();

    // 1. Local tombstone. The filter holds only scalars (string / ObjectId /
    // null) because orgId is normalised above — it can NEVER contain $expr,
    // so this upsert is immune to poisoned field values.
    try {
      await Tombstone.updateOne(
        { collectionName, documentId, organization: orgId },
        { $set: { deletedAt: now, deletedBy } },
        { upsert: true }
      );
    } catch (upsertErr) {
      // Absolute fallback: plain find + update-by-id / create (no upsert predicate).
      try {
        const existing = await Tombstone.findOne({ collectionName, documentId }).lean();
        if (existing) {
          await Tombstone.updateOne(
            { _id: existing._id },
            { $set: { collectionName, documentId, organization: orgId, deletedAt: now, deletedBy } }
          );
        } else {
          try {
            await Tombstone.create({ collectionName, documentId, organization: orgId, deletedAt: now, deletedBy });
          } catch (createErr) {
            if (createErr.code !== 11000) throw createErr; // duplicate = already recorded
          }
        }
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    }
    Logger.info(`🪦 Tombstone recorded locally: ${collectionName}:${documentId}`);

    // 2. LAN mesh push (fire-and-forget)
    try {
        const tdoc = await Tombstone.findOne({ collectionName, documentId }).lean();
        if (tdoc) {
            import("./lanPeerSync.js").then((m) => {
                try { m.pushLanOp({ collection: "tombstones", type: "update", data: tdoc }); } catch {}
            }).catch(() => {});
        }
    } catch {}

    // 3. Atlas dual-write — FIRE-AND-FORGET on purpose: the Local write above
    // is the source of truth and is already awaited. Blocking the HTTP
    // response (and socket emits) on Atlas latency would freeze the UI whenever
    // Atlas is slow. Retry queue + polling/fullSync guarantee eventual delivery.
    try {
      const atlasConnection = dualDatabaseManager.getAtlasConnection();
      if (atlasConnection && atlasConnection.readyState === 1 && atlasConnection.db) {
        atlasConnection.db.collection('tombstones').replaceOne(
          { _id: tombstoneId },
          {
            _id: tombstoneId,
            collectionName,
            documentId,
            organization: orgId,
            deletedAt: new Date(),
            deletedBy,
          },
          { upsert: true }
        ).then(
          () => {},
          (atlasErr) => {
            Logger.warn(`Atlas tombstone dual-write failed for ${collectionName} ${documentId}: ${atlasErr.message}`);
            enqueueTombstoneForRetry(collectionName, documentId, orgId, deletedBy).catch(() => {});
          }
        );
      } else {
        Logger.warn("Atlas not available for tombstone - enqueueing for retry");
        await enqueueTombstoneForRetry(collectionName, documentId, orgId, deletedBy);
      }
    } catch {}
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
