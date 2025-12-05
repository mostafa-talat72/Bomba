import Cost from "../models/Cost.js";

// @desc    Get all costs
// @route   GET /api/costs
// @access  Private
export const getCosts = async (req, res) => {
    try {
        const {
            category,
            status,
            page = 1,
            limit = 10,
            startDate,
            endDate,
            vendor,
        } = req.query;

        const query = {};

        if (category) query.category = category;
        if (status) query.status = status;
        if (vendor) query.vendor = { $regex: vendor, $options: "i" };

        // Date range filter
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }
        query.organization = req.user.organization;

        const costs = await Cost.find({
            organization: req.user.organization,
            ...query,
        })
            .populate("createdBy", "name")
            .populate("approvedBy", "name")
            .sort({ date: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Cost.countDocuments(query);

        // Calculate totals
        const totalAmount = await Cost.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);

        res.json({
            success: true,
            count: costs.length,
            total,
            totalAmount: totalAmount[0]?.total || 0,
            data: costs,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب التكاليف",
            error: error.message,
        });
    }
};

// @desc    Get single cost
// @route   GET /api/costs/:id
// @access  Private
export const getCost = async (req, res) => {
    try {
        const cost = await Cost.findOne({
            _id: req.params.id,
            organization: req.user.organization,
        })
            .populate("createdBy", "name")
            .populate("approvedBy", "name");

        if (!cost) {
            return res.status(404).json({
                success: false,
                message: "التكلفة غير موجودة",
            });
        }

        res.json({
            success: true,
            data: cost,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب التكلفة",
            error: error.message,
        });
    }
};

// @desc    Create new cost
// @route   POST /api/costs
// @access  Private
export const createCost = async (req, res) => {
    try {
        const {
            category,
            subcategory,
            description,
            amount,
            currency,
            date,
            dueDate,
            status,
            paymentMethod,
            receipt,
            vendor,
            vendorContact,
            isRecurring,
            recurringPeriod,
            tags,
            notes,
        } = req.body;

        const cost = await Cost.create({
            category,
            subcategory,
            description,
            amount,
            currency: currency || "EGP",
            date: date || new Date(),
            dueDate,
            status: status || "pending",
            paymentMethod: paymentMethod || "cash",
            receipt,
            vendor,
            vendorContact,
            isRecurring: isRecurring || false,
            recurringPeriod,
            tags: tags || [],
            notes,
            createdBy: req.user._id,
            organization: req.user.organization,
        });

        // Calculate next due date for recurring costs
        if (cost.isRecurring && cost.recurringPeriod) {
            cost.calculateNextDueDate();
            await cost.save();
        }

        await cost.populate("createdBy", "name");

        res.status(201).json({
            success: true,
            message: "تم إضافة التكلفة بنجاح",
            data: cost,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في إضافة التكلفة",
            error: error.message,
        });
    }
};

// @desc    Update cost
// @route   PUT /api/costs/:id
// @access  Private
export const updateCost = async (req, res) => {
    try {
        const {
            category,
            subcategory,
            description,
            amount,
            paidAmount,
            remainingAmount,
            currency,
            date,
            dueDate,
            status,
            paymentMethod,
            receipt,
            vendor,
            vendorContact,
            isRecurring,
            recurringPeriod,
            tags,
            notes,
        } = req.body;

        const cost = await Cost.findOne({
            _id: req.params.id,
            organization: req.user.organization,
        });

        if (!cost) {
            return res.status(404).json({
                success: false,
                message: "التكلفة غير موجودة",
            });
        }

        // Update fields
        if (category) cost.category = category;
        if (subcategory !== undefined) cost.subcategory = subcategory;
        if (description) cost.description = description;
        if (amount !== undefined) cost.amount = amount;
        if (paidAmount !== undefined) {
            // التأكد من أن المبلغ المدفوع لا يتجاوز المبلغ الكلي
            if (paidAmount > cost.amount) {
                paidAmount = cost.amount;
            }
            cost.paidAmount = paidAmount;
        }
        if (remainingAmount !== undefined)
            cost.remainingAmount = remainingAmount;
        if (currency) cost.currency = currency;
        if (date) cost.date = date;
        if (dueDate !== undefined) cost.dueDate = dueDate;
        if (status !== undefined) {
            cost.status = status; // Allow manual status updates
        }
        if (paymentMethod) cost.paymentMethod = paymentMethod;
        if (receipt !== undefined) cost.receipt = receipt;
        if (vendor !== undefined) cost.vendor = vendor;
        if (vendorContact !== undefined) cost.vendorContact = vendorContact;
        if (isRecurring !== undefined) cost.isRecurring = isRecurring;
        if (recurringPeriod !== undefined)
            cost.recurringPeriod = recurringPeriod;
        if (tags) cost.tags = tags;
        if (notes !== undefined) cost.notes = notes;

        // Recalculate next due date if recurring settings changed
        if (cost.isRecurring && cost.recurringPeriod) {
            cost.calculateNextDueDate();
        }

        // حفظ التكلفة لضمان تشغيل pre-save hook
        await cost.save();

        // إعادة تحميل البيانات مع العلاقات
        await cost.populate(["createdBy", "approvedBy"], "name");

        res.json({
            success: true,
            message: "تم تحديث التكلفة بنجاح",
            data: cost,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث التكلفة",
            error: error.message,
        });
    }
};

// @desc    Approve cost
// @route   PUT /api/costs/:id/approve
// @access  Private (Admin only)
export const approveCost = async (req, res) => {
    try {
        const cost = await Cost.findOne({
            _id: req.params.id,
            organization: req.user.organization,
        });

        if (!cost) {
            return res.status(404).json({
                success: false,
                message: "التكلفة غير موجودة",
            });
        }

        cost.approvedBy = req.user._id;
        cost.approvedAt = new Date();
        cost.status = "paid";

        await cost.save();
        await cost.populate(["createdBy", "approvedBy"], "name");

        res.json({
            success: true,
            message: "تم اعتماد التكلفة بنجاح",
            data: cost,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في اعتماد التكلفة",
            error: error.message,
        });
    }
};

// @desc    Delete cost
// @route   DELETE /api/costs/:id
// @access  Private
export const deleteCost = async (req, res) => {
    try {
        const cost = await Cost.findOne({
            _id: req.params.id,
            organization: req.user.organization,
        });

        if (!cost) {
            return res.status(404).json({
                success: false,
                message: "التكلفة غير موجودة",
            });
        }

        // Only allow deletion if cost is pending
        if (cost.status === "paid") {
            return res.status(400).json({
                success: false,
                message: "لا يمكن حذف تكلفة مدفوعة",
            });
        }

        // Delete from Local and Atlas
        const costId = cost._id;
        
        // Import required modules
        const syncConfig = (await import('../config/syncConfig.js')).default;
        const dualDatabaseManager = (await import('../config/dualDatabaseManager.js')).default;
        const Logger = (await import('../middleware/logger.js')).default;
        const originalSyncEnabled = syncConfig.enabled;
        
        try {
            syncConfig.enabled = false;
            Logger.info(`🔒 Sync middleware disabled for direct delete operation`);
            
            // حذف من Local
            await cost.deleteOne();
            Logger.info(`✓ Deleted cost from Local MongoDB`);
            
            // حذف من Atlas
            const atlasConnection = dualDatabaseManager.getAtlasConnection();
            if (atlasConnection) {
                try {
                    const atlasCollection = atlasConnection.collection('costs');
                    const atlasDeleteResult = await atlasCollection.deleteOne({ _id: costId });
                    Logger.info(`✓ Deleted cost from Atlas (deletedCount: ${atlasDeleteResult.deletedCount})`);
                } catch (atlasError) {
                    Logger.warn(`⚠️ Failed to delete cost from Atlas: ${atlasError.message}`);
                }
            }
        } finally {
            syncConfig.enabled = originalSyncEnabled;
            Logger.info(`🔓 Sync middleware re-enabled`);
        }

        res.json({
            success: true,
            message: "تم حذف التكلفة بنجاح",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في حذف التكلفة",
            error: error.message,
        });
    }
};

// @desc    Add payment to cost
// @route   POST /api/costs/:id/payment
// @access  Private
export const addCostPayment = async (req, res) => {
    try {
        const { paymentAmount, paymentMethod = "cash", reference } = req.body;

        if (!paymentAmount || paymentAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "المبلغ المدفوع مطلوب ويجب أن يكون أكبر من صفر",
            });
        }

        const cost = await Cost.findOne({
            _id: req.params.id,
            organization: req.user.organization,
        });

        if (!cost) {
            return res.status(404).json({
                success: false,
                message: "التكلفة غير موجودة",
            });
        }

        // Check if payment amount exceeds remaining amount
        if (paymentAmount > cost.remainingAmount) {
            return res.status(400).json({
                success: false,
                message: "المبلغ المدفوع أكبر من المبلغ المتبقي",
            });
        }

        // Add payment using the method from the model
        await cost.addPayment(paymentAmount, paymentMethod);

        // Update notes with payment reference if provided
        if (reference) {
            cost.notes = cost.notes
                ? `${cost.notes}\nدفعة: ${reference}`
                : `دفعة: ${reference}`;
            await cost.save();
        }

        res.json({
            success: true,
            message: "تم إضافة الدفعة بنجاح",
            data: cost,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في إضافة الدفعة",
            error: error.message,
        });
    }
};

// @desc    Get costs summary
// @route   GET /api/costs/summary
// @access  Private
export const getCostsSummary = async (req, res) => {
    try {
        const { period = "month" } = req.query;

        let startDate, endDate;
        const now = new Date();

        switch (period) {
            case "today":
                startDate = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate()
                );
                endDate = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate() + 1
                );
                break;
            case "week":
                startDate = new Date(now.setDate(now.getDate() - now.getDay()));
                endDate = new Date(
                    now.setDate(now.getDate() - now.getDay() + 7)
                );
                break;
            case "month":
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                break;
            case "year":
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear() + 1, 0, 1);
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        }

        const summary = await Cost.aggregate([
            {
                $match: {
                    date: { $gte: startDate, $lt: endDate },
                    organization: req.user.organization,
                },
            },
            {
                $group: {
                    _id: "$category",
                    totalAmount: { $sum: "$amount" },
                    count: { $sum: 1 },
                    avgAmount: { $avg: "$amount" },
                },
            },
            {
                $sort: { totalAmount: -1 },
            },
        ]);

        const totalCosts = await Cost.aggregate([
            {
                $match: {
                    date: { $gte: startDate, $lt: endDate },
                    organization: req.user.organization,
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" },
                    count: { $sum: 1 },
                },
            },
        ]);

        const pendingCosts = await Cost.countDocuments({
            status: "pending",
            date: { $gte: startDate, $lt: endDate },
            organization: req.user.organization,
        });

        const overdueCosts = await Cost.countDocuments({
            status: "overdue",
            date: { $gte: startDate, $lt: endDate },
            organization: req.user.organization,
        });

        res.json({
            success: true,
            data: {
                period,
                summary,
                totals: {
                    amount: totalCosts[0]?.total || 0,
                    count: totalCosts[0]?.count || 0,
                    pending: pendingCosts,
                    overdue: overdueCosts,
                },
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب ملخص التكاليف",
            error: error.message,
        });
    }
};

// @desc    Get recurring costs
// @route   GET /api/costs/recurring
// @access  Private
export const getRecurringCosts = async (req, res) => {
    try {
        const costs = await Cost.find({
            isRecurring: true,
            organization: req.user.organization,
        })
            .populate("createdBy", "name")
            .sort({ nextDueDate: 1 });

        res.json({
            success: true,
            count: costs.length,
            data: costs,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب التكاليف المتكررة",
            error: error.message,
        });
    }
};
