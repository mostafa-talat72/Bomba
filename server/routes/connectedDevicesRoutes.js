import express from 'express';
import ConnectedDevice from '../models/ConnectedDevice.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { createTombstone } from '../utils/tombstoneHelper.js';
import { writeToAtlas } from '../utils/atlasWrite.js';
import { ONLINE_WINDOW_MS } from '../middleware/deviceTracker.js';

const router = express.Router();

// All device-management endpoints are admin/owner only.
router.use(authenticateToken, authorizeRoles(['admin', 'owner']));

function shape(doc) {
    const o = doc.toObject ? doc.toObject() : doc;
    return {
        instanceId: o.instanceId,
        label: o.label || '',
        deviceType: o.deviceType,
        platform: o.platform || '',
        browser: o.browser || '',
        ip: o.ip || '',
        user: o.user && o.user.username ? { username: o.user.username } : null,
        canPrint: !!o.canPrint,
        lastSeen: o.lastSeen,
        online: Date.now() - new Date(o.lastSeen).getTime() < ONLINE_WINDOW_MS,
    };
}

// GET /api/connected-devices — newest activity first
router.get('/', async (req, res) => {
    try {
        const docs = await ConnectedDevice.find({})
            .populate('user', 'username')
            .sort({ lastSeen: -1 })
            .limit(100)
            .lean();
        res.json({ success: true, data: docs.map(shape) });
    } catch (e) {
        res.status(500).json({ success: false, message: 'فشل تحميل الأجهزة' });
    }
});

// PATCH /api/connected-devices/:instanceId — { canPrint?, label? }
router.patch('/:instanceId', async (req, res) => {
    try {
        const { canPrint, label } = req.body || {};
        const update = {};
        if (typeof canPrint === 'boolean') update.canPrint = canPrint;
        if (typeof label === 'string') update.label = label.trim().slice(0, 60);
        const doc = await ConnectedDevice.findOneAndUpdate(
            { instanceId: req.params.instanceId },
            { $set: update },
            { new: true }
        ).populate('user', 'username');
        if (!doc) return res.status(404).json({ success: false, message: 'الجهاز غير موجود' });
        res.json({ success: true, data: shape(doc) });
    } catch (e) {
        res.status(500).json({ success: false, message: 'فشل حفظ الإعداد' });
    }
});

// DELETE /api/connected-devices/:instanceId — forget (reappears blocked on next contact)
router.delete('/:instanceId', async (req, res) => {
    try {
        // This model has no sync middleware: tombstone + Atlas write are manual.
        // (A re-registering device creates a NEW _id, so the tombstone below
        // never blocks its intended reappearance.)
        let existing = null;
        try { existing = await ConnectedDevice.findOne({ instanceId: req.params.instanceId }); } catch {}
        if (existing?.organization) {
            try { await createTombstone('connecteddevices', existing._id, existing.organization, req.user?._id || null); } catch {}
        }
        if (existing?._id) {
            try { writeToAtlas('connecteddevices', 'delete', null, { _id: existing._id }); } catch {}
        }
        await ConnectedDevice.deleteOne({ instanceId: req.params.instanceId });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: 'فشل حذف الجهاز' });
    }
});

export default router;
