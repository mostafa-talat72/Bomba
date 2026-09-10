import AuditLog from "../models/AuditLog.js";

const orgIdOf = (req) => req.user?.organization?._id || req.user?.organization;

// @desc    List audit log entries (paginated, filterable)
// @route   GET /api/audit?action=&user=&collection=&from=&to=&page=&limit=
// @access  Private (settings/users admin)
export const listAuditLogs = async (req, res) => {
    try {
        const {
            action, user, collection, from, to,
            page = 1, limit = 50,
        } = req.query;

        const query = { organization: orgIdOf(req) };
        if (action) query.action = action;
        if (collection) query.collection = collection;
        if (user) {
            query.$or = [{ user }, { userName: { $regex: String(user), $options: "i" } }];
        }
        if (from || to) {
            query.createdAt = {};
            if (from) query.createdAt.$gte = new Date(from);
            if (to) query.createdAt.$lte = new Date(to);
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

        const [total, logs] = await Promise.all([
            AuditLog.countDocuments(query),
            AuditLog.find(query)
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .populate("user", "name")
                .lean(),
        ]);

        res.json({
            success: true,
            data: logs,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "فشل جلب سجل التدقيق",
            error: error.message,
        });
    }
};

// @desc    Distinct audit actions for filter dropdown
// @route   GET /api/audit/actions
// @access  Private (settings/users admin)
export const listAuditActions = async (req, res) => {
    try {
        const actions = await AuditLog.distinct("action", { organization: orgIdOf(req) });
        res.json({ success: true, data: actions.sort() });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "فشل جلب أنواع الأحداث",
            error: error.message,
        });
    }
};
