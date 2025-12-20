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
            search,
        } = req.query;

        const query = { organization: req.user.organization };

        // Category filter (Requirements 6.1)
        if (category) {
            query.category = category;
        }

        // Status filter (Requirements 6.2)
        // Support 'all' to return all statuses
        if (status && status !== 'all') {
            query.status = status;
        }

        // Vendor filter
        if (vendor) {
            query.vendor = { $regex: vendor, $options: "i" };
        }

        // Search functionality for description and vendor (Requirements 6.1, 6.2, 6.3, 6.4)
        if (search) {
            query.$or = [
                { description: { $regex: search, $options: "i" } },
                { vendor: { $regex: search, $options: "i" } }
            ];
        }

        // Advanced date range filter
        // Includes: cost date, payment dates, and amount increase dates
        if (startDate || endDate) {
            const dateQuery = [];
            const dateFilter = {};
            
            if (startDate) dateFilter.$gte = new Date(startDate);
            if (endDate) {
                const endOfDay = new Date(endDate);
                endOfDay.setHours(23, 59, 59, 999);
                dateFilter.$lte = endOfDay;
            }

            // Match by cost date
            dateQuery.push({ date: dateFilter });
            
            // Match by payment history dates
            dateQuery.push({ 
                "paymentHistory.paidAt": dateFilter 
            });
            
            // Match by amount history dates
            dateQuery.push({ 
                "amountHistory.addedAt": dateFilter 
            });

            query.$or = query.$or ? 
                [...query.$or, ...dateQuery] : 
                dateQuery;
        }

        const costs = await Cost.find(query)
            .populate("category", "name icon color")
            .populate("createdBy", "name")
            .populate("approvedBy", "name")
            .populate("amountHistory.addedBy", "name")
            .populate("paymentHistory.paidBy", "name")
            .sort({ date: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Cost.countDocuments(query);

        // Calculate comprehensive statistics for all matching costs (not just paginated)
        const totalStats = await Cost.aggregate([
            { $match: query },
            { 
                $group: { 
                    _id: null, 
                    total: { $sum: "$amount" },
                    paid: { $sum: "$paidAmount" },
                    remaining: { $sum: "$remainingAmount" },
                    count: { $sum: 1 }
                } 
            },
        ]);

        const stats = totalStats[0] || { total: 0, paid: 0, remaining: 0, count: 0 };
        


        res.json({
            success: true,
            count: costs.length,
            total,
            totalAmount: stats.total,
            totalStats: {
                total: stats.total,
                paid: stats.paid,
                remaining: stats.remaining
            },
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
            .populate("category", "name icon color")
            .populate("createdBy", "name")
            .populate("approvedBy", "name")
            .populate("amountHistory.addedBy", "name")
            .populate("paymentHistory.paidBy", "name");

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
            paidAmount,
            currency,
            date,
            dueDate,
            paymentMethod,
            receipt,
            vendor,
            vendorContact,
            isRecurring,
            recurringPeriod,
            tags,
            notes,
        } = req.body;

        // Validation: Required fields (Requirements 2.1)
        if (!category) {
            return res.status(400).json({
                success: false,
                message: "فئة التكلفة مطلوبة",
            });
        }

        if (!description || description.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "وصف التكلفة مطلوب",
            });
        }

        if (amount === undefined || amount === null || amount < 0) {
            return res.status(400).json({
                success: false,
                message: "المبلغ مطلوب ويجب أن يكون أكبر من أو يساوي صفر",
            });
        }

        if (!date) {
            return res.status(400).json({
                success: false,
                message: "تاريخ التكلفة مطلوب",
            });
        }

        // Validation: paidAmount should not exceed amount
        let validatedPaidAmount = paidAmount || 0;
        if (validatedPaidAmount > amount) {
            return res.status(400).json({
                success: false,
                message: "المبلغ المدفوع لا يمكن أن يتجاوز المبلغ الكلي",
            });
        }

        const cost = await Cost.create({
            category,
            subcategory,
            description,
            amount,
            paidAmount: validatedPaidAmount,
            currency: currency || "EGP",
            date: date || new Date(),
            dueDate,
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

        await cost.populate("category", "name icon color");
        await cost.populate("createdBy", "name");

        res.status(201).json({
            success: true,
            message: "تم إضافة التكلفة بنجاح",
            data: cost,
        });
    } catch (error) {
        // Handle validation errors from Mongoose
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', '),
            });
        }

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
            currency,
            date,
            dueDate,
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

        // Validation: Required fields (Requirements 2.1)
        if (description !== undefined && description.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "وصف التكلفة لا يمكن أن يكون فارغاً",
            });
        }

        if (amount !== undefined && amount < 0) {
            return res.status(400).json({
                success: false,
                message: "المبلغ يجب أن يكون أكبر من أو يساوي صفر",
            });
        }

        // Update fields
        if (category) cost.category = category;
        if (subcategory !== undefined) cost.subcategory = subcategory;
        if (description) cost.description = description;
        if (amount !== undefined) cost.amount = amount;
        
        // Validation: paidAmount should not exceed amount
        if (paidAmount !== undefined) {
            const currentAmount = amount !== undefined ? amount : cost.amount;
            if (paidAmount > currentAmount) {
                return res.status(400).json({
                    success: false,
                    message: "المبلغ المدفوع لا يمكن أن يتجاوز المبلغ الكلي",
                });
            }
            cost.paidAmount = paidAmount;
        }
        
        if (currency) cost.currency = currency;
        if (date) cost.date = date;
        if (dueDate !== undefined) cost.dueDate = dueDate;
        if (paymentMethod) cost.paymentMethod = paymentMethod;
        if (receipt !== undefined) cost.receipt = receipt;
        if (vendor !== undefined) cost.vendor = vendor;
        if (vendorContact !== undefined) cost.vendorContact = vendorContact;
        if (isRecurring !== undefined) cost.isRecurring = isRecurring;
        if (recurringPeriod !== undefined) cost.recurringPeriod = recurringPeriod;
        if (tags) cost.tags = tags;
        if (notes !== undefined) cost.notes = notes;

        // Recalculate next due date if recurring settings changed
        if (cost.isRecurring && cost.recurringPeriod) {
            cost.calculateNextDueDate();
        }

        // Save to trigger pre-save hook for automatic status calculation
        await cost.save();

        // Reload with populated fields
        await cost.populate("category", "name icon color");
        await cost.populate("createdBy", "name");
        await cost.populate("approvedBy", "name");

        res.json({
            success: true,
            message: "تم تحديث التكلفة بنجاح",
            data: cost,
        });
    } catch (error) {
        // Handle validation errors from Mongoose
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', '),
            });
        }

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
        
        // Only allow deletion if cost is not fully paid
        if (cost.status === "paid") {
            return res.status(400).json({
                success: false,
                message: "لا يمكن حذف تكلفة مدفوعة بالكامل",
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

        // Validation: Payment amount is required and must be positive (Requirements 2.5)
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

        // Validation: Payment amount should not exceed remaining amount (Requirements 2.5)
        if (paymentAmount > cost.remainingAmount) {
            return res.status(400).json({
                success: false,
                message: `المبلغ المدفوع (${paymentAmount}) أكبر من المبلغ المتبقي (${cost.remainingAmount})`,
            });
        }

        // Validation: Payment method must be valid
        const validPaymentMethods = ['cash', 'card', 'transfer', 'check'];
        if (!validPaymentMethods.includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "طريقة الدفع غير صالحة",
            });
        }

        // Add payment using the method from the model
        // This will automatically update paidAmount, remainingAmount, and status
        // Pass user ID and reference as notes
        await cost.addPayment(
            paymentAmount, 
            paymentMethod, 
            req.user._id,
            reference || null
        );

        // Reload with populated fields
        await cost.populate("category", "name icon color");
        await cost.populate("createdBy", "name");
        await cost.populate("amountHistory.addedBy", "name");
        await cost.populate("paymentHistory.paidBy", "name");

        res.json({
            success: true,
            message: "تم إضافة الدفعة بنجاح",
            data: cost,
        });
    } catch (error) {
        // Handle specific errors from addPayment method
        if (error.message.includes('Payment amount') || error.message.includes('remaining amount')) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }

        res.status(500).json({
            success: false,
            message: "خطأ في إضافة الدفعة",
            error: error.message,
        });
    }
};

// @desc    Increase cost amount
// @route   POST /api/costs/:id/increase
// @access  Private
export const increaseCostAmount = async (req, res) => {
    try {
        const { additionalAmount, reason } = req.body;

        // Validation
        if (!additionalAmount || additionalAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "المبلغ الإضافي مطلوب ويجب أن يكون أكبر من صفر",
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

        // Increase amount using the method from the model
        await cost.increaseAmount(
            additionalAmount,
            req.user._id,
            reason || null
        );

        // Reload with populated fields
        await cost.populate("category", "name icon color");
        await cost.populate("createdBy", "name");
        await cost.populate("amountHistory.addedBy", "name");
        await cost.populate("paymentHistory.paidBy", "name");

        res.json({
            success: true,
            message: "تم زيادة المبلغ بنجاح",
            data: cost,
        });
    } catch (error) {
        if (error.message.includes('Additional amount')) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }

        res.status(500).json({
            success: false,
            message: "خطأ في زيادة المبلغ",
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
