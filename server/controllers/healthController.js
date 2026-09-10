import { checkSystemHealth } from "../utils/healthCheck.js";

// NOTE (deliberate decision): no server-side Notification creation here.
// Notifications are org-scoped (Notification.statics.* always require an
// `organization` field — see server/models/Notification.js), so a node-level
// health check has no single org to notify without spamming every org.
// The frontend SystemHealth card polls this endpoint and surfaces alerts.
// This keeps it on-demand and spam-free.

// @desc    Get system health (mongo / disk / backup / memory)
// @route   GET /api/health
// @access  Private (settings:all)
export const getHealth = async (req, res) => {
    try {
        const result = await checkSystemHealth();
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "فشل في فحص صحة النظام",
            error: error.message,
        });
    }
};

export default { getHealth };
