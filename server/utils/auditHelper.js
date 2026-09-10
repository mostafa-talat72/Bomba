import AuditLog from "../models/AuditLog.js";
import Logger from "../middleware/logger.js";

/**
 * Fire-and-forget audit entry. Never throws, never blocks the caller.
 * @param {Object} p
 * @param {string} p.action - e.g. "bill.deleted"
 * @param {string} [p.collection]
 * @param {*} [p.documentId]
 * @param {string} [p.documentNumber]
 * @param {*} [p.user] - user doc or id (req.user)
 * @param {*} [p.organization] - org doc or id
 * @param {string} [p.deviceId] - instance id header
 * @param {Object} [p.details]
 */
export const logAudit = (p = {}) => {
    try {
        if (!p || !p.action || !p.organization) return Promise.resolve(null);
        const orgId = p.organization?._id || p.organization;
        const userId = p.user?._id || p.user || null;
        const userName = p.userName || p.user?.name || null;
        let documentId = p.documentId || null;
        if (documentId && typeof documentId === "string" && !/^[a-f0-9]{24}$/i.test(documentId)) {
            documentId = null; // only real ObjectIds; never break the log write
        }
        return AuditLog.create({
            action: p.action,
            collection: p.collection || null,
            documentId,
            documentNumber: p.documentNumber || null,
            user: userId,
            userName,
            organization: orgId,
            deviceId: p.deviceId || null,
            details: p.details && typeof p.details === "object" ? p.details : {},
        }).catch((e) => {
            Logger.warn(`Audit log skipped (${p.action}): ${e.message}`);
            return null;
        });
    } catch (e) {
        Logger.warn(`Audit log skipped (${p?.action}): ${e.message}`);
        return Promise.resolve(null);
    }
};

export default { logAudit };
