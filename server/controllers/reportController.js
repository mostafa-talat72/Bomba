import Order from "../models/Order.js";
import Session from "../models/Session.js";
import Bill from "../models/Bill.js";
import Cost from "../models/Cost.js";
import InventoryItem from "../models/InventoryItem.js";
import { getDateRange } from "../utils/helpers.js";
import {
    exportToExcel,
    exportToPDF,
    generateFilename,
} from "../utils/exportUtils.js";

// @desc    Get dashboard statistics
// @route   GET /api/reports/dashboard
// @access  Private
export const getDashboardStats = async (req, res) => {
    try {
        const filter = req.query;
        const { startDate, endDate } = getDateRange(filter);

        // Revenue from bills
        const revenueData = await Bill.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    status: { $in: ["partial", "paid"] },
                    organization: req.user.organization,
                },
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$total" }, // تغيير من paid إلى total
                    totalBills: { $sum: 1 },
                    avgBillValue: { $avg: "$total" },
                },
            },
        ]);

        // Orders statistics
        const ordersData = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    organization: req.user.organization,
                },
            },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$finalAmount" },
                },
            },
        ]);

        // Sessions statistics
        const sessionsData = await Session.aggregate([
            {
                $match: {
                    startTime: { $gte: startDate, $lte: endDate },
                    organization: req.user.organization,
                },
            },
            {
                $group: {
                    _id: "$deviceType",
                    count: { $sum: 1 },
                    totalRevenue: { $sum: "$finalCost" },
                    avgDuration: {
                        $avg: { $subtract: ["$endTime", "$startTime"] },
                    },
                },
            },
        ]);

        // Costs for the period
        const costsData = await Cost.aggregate([
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate },
                    organization: req.user.organization,
                },
            },
            {
                $group: {
                    _id: "$category",
                    totalAmount: { $sum: "$amount" },
                    count: { $sum: 1 },
                },
            },
        ]);

        // Active sessions (real-time)
        const activeSessions = await Session.countDocuments({
            status: "active",
            organization: req.user.organization,
        });

        // تنظيف الطلبات القديمة (أكثر من 24 ساعة) وتحديث حالتها
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const oldPendingOrders = await Order.find({
            status: { $in: ["pending", "preparing", "ready"] },
            createdAt: { $lt: oneDayAgo },
            organization: req.user.organization,
        });

        if (oldPendingOrders.length > 0) {
            // تحديث الطلبات القديمة إلى delivered
            await Order.updateMany(
                {
                    status: { $in: ["pending", "preparing", "ready"] },
                    createdAt: { $lt: oneDayAgo },
                    organization: req.user.organization,
                },
                {
                    $set: {
                        status: "delivered",
                        deliveredTime: new Date(),
                    },
                }
            );
        }

        // إعادة حساب الطلبات المعلقة بعد التنظيف
        const cleanPendingOrders = await Order.countDocuments({
            status: { $in: ["pending", "preparing", "ready"] },
            organization: req.user.organization,
        });

        // فحص تفصيلي للطلبات
        const allOrders = await Order.find({}).select(
            "_id orderNumber status customerName createdAt"
        );
        const ordersByStatus = allOrders.reduce((acc, order) => {
            acc[order.status] = (acc[order.status] || 0) + 1;
            return acc;
        }, {});

        // Low stock items (real-time)
        const lowStockItems = await InventoryItem.countDocuments({
            isActive: true,
            organization: req.user.organization,
            $expr: { $lte: ["$currentStock", "$minStock"] },
        });

        // Today's bills count
        const todayBills = await Bill.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate },
            organization: req.user.organization,
        });

        // Today's total revenue (including all bills)
        const todayRevenue = await Bill.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    organization: req.user.organization,
                },
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$paid" },
                },
            },
        ]);

        // تحليل مفصل للطلبات
        const ordersByStatusAggregate = await Order.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                },
            },
        ]);

        const result = {
            filter,
            revenue: revenueData[0] || {
                totalRevenue: 0,
                totalBills: 0,
                avgBillValue: 0,
            },
            orders: ordersData,
            sessions: sessionsData,
            costs: costsData,
            realTime: {
                activeSessions,
                cleanPendingOrders,
                lowStockItems,
            },
            today: {
                bills: todayBills,
                revenue: todayRevenue[0]?.totalRevenue || 0,
            },
        };

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب إحصائيات لوحة التحكم",
            error: error.message,
        });
    }
};

// @desc    Get sales report
// @route   GET /api/reports/sales
// @access  Private
export const getSalesReport = async (req, res) => {
    try {
        const { groupBy = "day", ...filter } = req.query;
        const { startDate, endDate } = getDateRange(filter);

        // Calculate previous period for comparison
        const periodDuration = endDate - startDate;
        const previousStartDate = new Date(startDate.getTime() - periodDuration);
        const previousEndDate = startDate;

        let groupFormat;
        switch (groupBy) {
            case "hour":
                groupFormat = {
                    $dateToString: {
                        format: "%Y-%m-%d %H:00",
                        date: "$createdAt",
                    },
                };
                break;
            case "day":
                groupFormat = {
                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                };
                break;
            case "week":
                groupFormat = { $week: "$createdAt" };
                break;
            case "month":
                groupFormat = {
                    $dateToString: { format: "%Y-%m", date: "$createdAt" },
                };
                break;
            default:
                groupFormat = {
                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                };
        }

        // Sales by time period
        const salesByPeriod = await Bill.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    status: { $in: ["partial", "paid"] },
                    organization: req.user.organization,
                },
            },
            {
                $group: {
                    _id: groupFormat,
                    totalSales: { $sum: "$total" },
                    billCount: { $sum: 1 },
                    avgBillValue: { $avg: "$total" },
                },
            },
            {
                $sort: { _id: 1 },
            },
        ]);

        // Top selling items
        const topItems = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    status: "delivered",
                    organization: req.user.organization,
                },
            },
            {
                $unwind: "$items",
            },
            {
                $group: {
                    _id: "$items.name",
                    totalQuantity: { $sum: "$items.quantity" },
                    totalRevenue: {
                        $sum: {
                            $multiply: ["$items.price", "$items.quantity"],
                        },
                    },
                    orderCount: { $sum: 1 },
                },
            },
            {
                $sort: { totalQuantity: -1 },
            },
            {
                $limit: 10,
            },
        ]);

        // Revenue by source
        const revenueBySource = await Bill.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    status: { $in: ["partial", "paid"] },
                    organization: req.user.organization,
                },
            },
            {
                $lookup: {
                    from: "orders",
                    localField: "orders",
                    foreignField: "_id",
                    as: "orderDetails",
                },
            },
            {
                $lookup: {
                    from: "sessions",
                    localField: "sessions",
                    foreignField: "_id",
                    as: "sessionDetails",
                },
            },
            {
                $project: {
                    cafeRevenue: {
                        $sum: "$orderDetails.finalAmount",
                    },
                    gamingRevenue: {
                        $sum: "$sessionDetails.finalCost",
                    },
                    totalPaid: "$paid",
                },
            },
            {
                $group: {
                    _id: null,
                    totalCafeRevenue: { $sum: "$cafeRevenue" },
                    totalGamingRevenue: { $sum: "$gamingRevenue" },
                    totalRevenue: { $sum: "$totalPaid" },
                },
            },
        ]);

        // Get current period data for comparison
        const currentData = await getSalesReportData(
            req.user.organization,
            startDate,
            endDate
        );

        // Get previous period data for comparison
        const previousData = await getSalesReportData(
            req.user.organization,
            previousStartDate,
            previousEndDate
        );

        // Top products by menu section
        const topProductsBySection = await getTopProductsBySection(
            req.user.organization,
            startDate,
            endDate
        );

        // Peak hours analysis
        const peakHours = await getPeakHoursData(
            req.user.organization,
            startDate,
            endDate
        );

        // Staff performance
        const staffPerformance = await getStaffPerformanceData(
            req.user.organization,
            startDate,
            endDate
        );

        // Calculate comparison metrics
        const comparison = calculateComparison(currentData, previousData);

        res.json({
            success: true,
            data: {
                filter,
                groupBy,
                salesByPeriod,
                topItems,
                revenueBySource: revenueBySource[0] || {
                    totalCafeRevenue: 0,
                    totalGamingRevenue: 0,
                    totalRevenue: 0,
                },
                current: currentData,
                previous: previousData,
                comparison,
                topProductsBySection,
                peakHours,
                staffPerformance,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب تقرير المبيعات",
            error: error.message,
        });
    }
};

// @desc    Get inventory report
// @route   GET /api/reports/inventory
// @access  Private
export const getInventoryReport = async (req, res) => {
    try {
        const { category } = req.query;

        const query = { isActive: true, organization: req.user.organization };
        if (category) query.category = category;

        // Current inventory status
        const inventoryStatus = await InventoryItem.aggregate([
            { $match: query },
            {
                $project: {
                    name: 1,
                    category: 1,
                    currentStock: 1,
                    minStock: 1,
                    unit: 1,
                    price: 1,
                    cost: 1,
                    totalValue: { $multiply: ["$currentStock", "$price"] },
                    totalCost: { $multiply: ["$currentStock", "$cost"] },
                    isLowStock: { $lte: ["$currentStock", "$minStock"] },
                    isOutOfStock: { $eq: ["$currentStock", 0] },
                },
            },
        ]);

        // Inventory summary by category
        const categoryStats = await InventoryItem.aggregate([
            { $match: query },
            {
                $group: {
                    _id: "$category",
                    itemCount: { $sum: 1 },
                    totalValue: {
                        $sum: { $multiply: ["$currentStock", "$price"] },
                    },
                    totalCost: {
                        $sum: { $multiply: ["$currentStock", "$cost"] },
                    },
                    lowStockCount: {
                        $sum: {
                            $cond: [
                                { $lte: ["$currentStock", "$minStock"] },
                                1,
                                0,
                            ],
                        },
                    },
                    outOfStockCount: {
                        $sum: {
                            $cond: [{ $eq: ["$currentStock", 0] }, 1, 0],
                        },
                    },
                },
            },
            {
                $sort: { totalValue: -1 },
            },
        ]);

        // Recent stock movements
        const recentMovements = await InventoryItem.aggregate([
            { $match: query },
            { $unwind: "$stockMovements" },
            {
                $lookup: {
                    from: "users",
                    localField: "stockMovements.user",
                    foreignField: "_id",
                    as: "user",
                },
            },
            {
                $project: {
                    itemName: "$name",
                    movement: "$stockMovements",
                    userName: { $arrayElemAt: ["$user.name", 0] },
                },
            },
            {
                $sort: { "movement.timestamp": -1 },
            },
            {
                $limit: 50,
            },
        ]);

        res.json({
            success: true,
            data: {
                inventoryStatus,
                categoryStats,
                recentMovements,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب تقرير المخزون",
            error: error.message,
        });
    }
};

// @desc    Get financial report
// @route   GET /api/reports/financial
// @access  Private
export const getFinancialReport = async (req, res) => {
    try {
        const filter = req.query;
        const { startDate, endDate } = getDateRange(filter);

        // Revenue - استخدام total بدلاً من paid للحصول على الإيرادات الفعلية
        const revenue = await Bill.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    status: { $in: ["partial", "paid"] },
                    organization: req.user.organization,
                },
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$total" }, // تغيير من paid إلى total
                    totalBills: { $sum: 1 },
                    totalPaid: { $sum: "$paid" }, // إضافة المدفوع فعلياً
                },
            },
        ]);

        // Costs - إضافة جميع التكاليف المدفوعة والمعلقة
        const costs = await Cost.aggregate([
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate },
                    status: { $in: ["paid", "partially_paid", "pending"] }, // إضافة فلتر للحالة
                    organization: req.user.organization,
                },
            },
            {
                $group: {
                    _id: "$category",
                    totalAmount: { $sum: "$amount" },
                    paidAmount: { $sum: "$paidAmount" }, // إضافة المدفوع فعلياً
                    count: { $sum: 1 },
                },
            },
        ]);

        // حساب التكاليف الإجمالية (المدفوعة فقط)
        const totalCostsAmount = costs.reduce(
            (sum, cost) => sum + cost.paidAmount,
            0
        );

        // حساب التكاليف المعلقة
        const pendingCosts = costs.reduce(
            (sum, cost) => sum + (cost.totalAmount - cost.paidAmount),
            0
        );

        const totalRevenue = revenue[0]?.totalRevenue || 0;
        const totalPaid = revenue[0]?.totalPaid || 0;
        const netProfit = totalPaid - totalCostsAmount; // استخدام المدفوع فعلياً

        // حساب هامش الربح بناءً على الإيرادات الفعلية
        const actualRevenue = totalPaid > 0 ? totalPaid : totalRevenue;
        const profitMargin =
            actualRevenue > 0 ? (netProfit / actualRevenue) * 100 : 0;

        // Monthly comparison
        const previousPeriod = getDateRange(filter);
        previousPeriod.startDate.setMonth(
            previousPeriod.startDate.getMonth() - 1
        );
        previousPeriod.endDate.setMonth(previousPeriod.endDate.getMonth() - 1);

        const previousRevenue = await Bill.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: previousPeriod.startDate,
                        $lte: previousPeriod.endDate,
                    },
                    status: { $in: ["partial", "paid"] },
                    organization: req.user.organization,
                },
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$total" }, // تغيير من paid إلى total
                    totalPaid: { $sum: "$paid" },
                },
            },
        ]);

        const revenueGrowth =
            previousRevenue[0]?.totalPaid > 0
                ? ((totalPaid - previousRevenue[0].totalPaid) /
                      previousRevenue[0].totalPaid) *
                  100
                : 0;

        // حساب عدد المعاملات من مصادر متعددة
        const totalBills = revenue[0]?.totalBills || 0;

        // حساب عدد الطلبات المكتملة (المرتبطة بالفواتير أو المكتملة)
        const totalOrders = await Order.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate },
            organization: req.user.organization,
            $or: [
                { bill: { $exists: true, $ne: null } }, // الطلبات المرتبطة بالفواتير
                { status: { $in: ["delivered", "ready"] } }, // الطلبات المكتملة
            ],
        });

        // إجمالي المعاملات = الفواتير + الطلبات المكتملة
        const totalTransactions = totalBills + totalOrders;

        const responseData = {
            filter,
            summary: {
                totalRevenue,
                totalPaid,
                totalCosts: totalCostsAmount,
                pendingCosts,
                netProfit,
                profitMargin,
                revenueGrowth,
                totalTransactions, // إضافة عدد المعاملات
            },
            revenue: revenue[0] || {
                totalRevenue: 0,
                totalPaid: 0,
                totalBills: 0,
            },
            costs,
            comparison: {
                currentPeriod: totalPaid,
                previousPeriod: previousRevenue[0]?.totalPaid || 0,
                growth: revenueGrowth,
            },
        };

        res.json({
            success: true,
            data: responseData,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب التقرير المالي",
            error: error.message,
        });
    }
};

// @desc    Get sessions report
// @route   GET /api/reports/sessions
// @access  Private
export const getSessionsReport = async (req, res) => {
    try {
        const { ...filter } = req.query;
        const { startDate, endDate } = getDateRange(filter);

        // Separate PlayStation and Computer sessions
        const playstationData = await getSessionsDataByType(
            req.user.organization,
            startDate,
            endDate,
            'playstation'
        );

        const computerData = await getSessionsDataByType(
            req.user.organization,
            startDate,
            endDate,
            'computer'
        );

        res.json({
            success: true,
            data: {
                filter,
                playstation: playstationData,
                computer: computerData
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب تقرير الجلسات",
            error: error.message,
        });
    }
};

// @desc    Get recent activity
// @route   GET /api/reports/recent-activity
// @access  Private
export const getRecentActivity = async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        // Get recent sessions
        const recentSessions = await Session.find({
            organization: req.user.organization,
        })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit) / 2)
            .populate("createdBy", "name")
            .lean();

        // Get recent orders
        const recentOrders = await Order.find({
            organization: req.user.organization,
        })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit) / 2)
            .populate("createdBy", "name")
            .populate("table", "number name")
            .lean();

        // Get recent bills
        const recentBills = await Bill.find({
            organization: req.user.organization,
        })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit) / 2)
            .populate("createdBy", "name")
            .populate("table", "number name")
            .lean();

        // Combine and format activities
        const activities = [];

        // Add session activities
        recentSessions.forEach((session) => {
            let message = "";
            let type = "session";
            let color = "text-blue-600";

            if (session.status === "active") {
                message = `بدء جلسة جديدة - ${session.deviceName}`;
            } else if (session.status === "completed") {
                message = `انتهاء جلسة - ${session.deviceName}`;
                color = "text-purple-600";
            } else if (session.status === "cancelled") {
                message = `إلغاء جلسة - ${session.deviceName}`;
                color = "text-red-600";
            }

            activities.push({
                id: session._id,
                type,
                message,
                time: new Date(session.createdAt).toLocaleTimeString("ar-EG", {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                date: session.createdAt,
                color,
                icon: "Gamepad2",
                details: {
                    deviceName: session.deviceName,
                    deviceType: session.deviceType,
                    status: session.status,
                    totalCost: session.totalCost,
                },
            });
        });

        // Add order activities
        recentOrders.forEach((order) => {
            let message = "";
            let type = "order";
            let color = "text-orange-600";

            const tableNumber = order.table?.number || null;
            
            if (order.status === "pending") {
                message = `طلب جديد - ${
                    order.customerName || (tableNumber ? `طاولة ${tableNumber}` : "عميل")
                }`;
            } else if (order.status === "preparing") {
                message = `جاري تحضير طلب - ${
                    order.customerName || (tableNumber ? `طاولة ${tableNumber}` : "عميل")
                }`;
                color = "text-yellow-600";
            } else if (order.status === "ready") {
                message = `طلب جاهز - ${
                    order.customerName || (tableNumber ? `طاولة ${tableNumber}` : "عميل")
                }`;
                color = "text-green-600";
            } else if (order.status === "delivered") {
                message = `تم تسليم طلب - ${
                    order.customerName || (tableNumber ? `طاولة ${tableNumber}` : "عميل")
                }`;
                color = "text-blue-600";
            } else if (order.status === "cancelled") {
                message = `إلغاء طلب - ${
                    order.customerName || (tableNumber ? `طاولة ${tableNumber}` : "عميل")
                }`;
                color = "text-red-600";
            }

            activities.push({
                id: order._id,
                type,
                message,
                time: new Date(order.createdAt).toLocaleTimeString("ar-EG", {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                date: order.createdAt,
                color,
                icon: "Coffee",
                details: {
                    customerName: order.customerName,
                    tableNumber: tableNumber,
                    status: order.status,
                    totalAmount: order.finalAmount,
                },
            });
        });

        // Add bill activities
        recentBills.forEach((bill) => {
            let message = "";
            let type = "payment";
            let color = "text-green-600";
            
            const billTableNumber = bill.table?.number || null;

            if (bill.status === "paid") {
                message = `دفع فاتورة - ${
                    bill.customerName || (billTableNumber ? `طاولة ${billTableNumber}` : "عميل")
                }`;
            } else if (bill.status === "partial") {
                message = `دفع جزئي - ${
                    bill.customerName || (billTableNumber ? `طاولة ${billTableNumber}` : "عميل")
                }`;
                color = "text-yellow-600";
            } else if (bill.status === "cancelled") {
                message = `إلغاء فاتورة - ${
                    bill.customerName || (billTableNumber ? `طاولة ${billTableNumber}` : "عميل")
                }`;
                color = "text-red-600";
            }

            activities.push({
                id: bill._id,
                type,
                message,
                time: new Date(bill.createdAt).toLocaleTimeString("ar-EG", {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                date: bill.createdAt,
                color,
                icon: "Receipt",
                details: {
                    customerName: bill.customerName,
                    tableNumber: bill.tableNumber,
                    status: bill.status,
                    total: bill.total,
                    paid: bill.paid,
                },
            });
        });

        // Sort by date and limit
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        const limitedActivities = activities.slice(0, parseInt(limit));

        res.json({
            success: true,
            data: limitedActivities,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب النشاط الأخير",
            error: error.message,
        });
    }
};

// @desc    Export report to Excel
// @route   GET /api/reports/export/excel
// @access  Private
export const exportReportToExcel = async (req, res) => {
    try {
        const { reportType, ...filter } = req.query;
        const { startDate, endDate } = getDateRange(filter);

        let reportData;

        switch (reportType) {
            case "sales":
            case "all":
                // Get enhanced sales data with new features
                const salesData = await getSalesReportData(
                    req.user.organization,
                    startDate,
                    endDate
                );
                
                // Get previous period for comparison
                const periodDuration = endDate - startDate;
                const previousStartDate = new Date(startDate.getTime() - periodDuration);
                const previousEndDate = startDate;
                
                const previousData = await getSalesReportData(
                    req.user.organization,
                    previousStartDate,
                    previousEndDate
                );
                
                // Get additional data
                const topProductsBySection = await getTopProductsBySection(
                    req.user.organization,
                    startDate,
                    endDate
                );
                
                const peakHours = await getPeakHoursData(
                    req.user.organization,
                    startDate,
                    endDate
                );
                
                const staffPerformance = await getStaffPerformanceData(
                    req.user.organization,
                    startDate,
                    endDate
                );
                
                reportData = {
                    ...salesData,
                    topProductsBySection,
                    peakHours,
                    staffPerformance,
                    comparison: calculateComparison(salesData, previousData)
                };
                break;
            case "financial":
                reportData = await getFinancialReportData(
                    req.user.organization,
                    startDate,
                    endDate
                );
                break;
            case "inventory":
                reportData = await getInventoryReportData(
                    req.user.organization
                );
                break;
            case "sessions":
                // Get enhanced sessions data
                const playstationData = await getSessionsDataByType(
                    req.user.organization,
                    startDate,
                    endDate,
                    'playstation'
                );
                
                const computerData = await getSessionsDataByType(
                    req.user.organization,
                    startDate,
                    endDate,
                    'computer'
                );
                
                reportData = {
                    playstation: playstationData,
                    computer: computerData
                };
                break;
            case "peakHours":
                reportData = await getPeakHoursData(
                    req.user.organization,
                    startDate,
                    endDate
                );
                break;
            case "staffPerformance":
                reportData = await getStaffPerformanceData(
                    req.user.organization,
                    startDate,
                    endDate
                );
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: "نوع التقرير غير صحيح",
                });
        }

        // Add date range info to report data
        reportData.dateRange = {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            exportDate: new Date().toISOString()
        };

        const buffer = await exportToExcel(reportData, reportType, { startDate, endDate });
        const filename = generateFilename(reportType, { startDate, endDate }, "xlsx");

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
                filename
            )}`
        );
        res.send(buffer);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تصدير التقرير",
            error: error.message,
            stack:
                process.env.NODE_ENV === "development"
                    ? error.stack
                    : undefined,
        });
    }
};

// @desc    Export report to PDF
// @route   GET /api/reports/export/pdf
// @access  Private
export const exportReportToPDF = async (req, res) => {
    try {
        const { reportType, ...filter } = req.query;
        const { startDate, endDate } = getDateRange(filter);

        let reportData;

        switch (reportType) {
            case "sales":
            case "all":
                // Get enhanced sales data with new features
                const salesData = await getSalesReportData(
                    req.user.organization,
                    startDate,
                    endDate
                );
                
                // Get previous period for comparison
                const periodDuration = endDate - startDate;
                const previousStartDate = new Date(startDate.getTime() - periodDuration);
                const previousEndDate = startDate;
                
                const previousData = await getSalesReportData(
                    req.user.organization,
                    previousStartDate,
                    previousEndDate
                );
                
                // Get additional data
                const topProductsBySection = await getTopProductsBySection(
                    req.user.organization,
                    startDate,
                    endDate
                );
                
                const peakHours = await getPeakHoursData(
                    req.user.organization,
                    startDate,
                    endDate
                );
                
                const staffPerformance = await getStaffPerformanceData(
                    req.user.organization,
                    startDate,
                    endDate
                );
                
                reportData = {
                    ...salesData,
                    topProductsBySection,
                    peakHours,
                    staffPerformance,
                    comparison: calculateComparison(salesData, previousData)
                };
                break;
            case "financial":
                reportData = await getFinancialReportData(
                    req.user.organization,
                    startDate,
                    endDate
                );
                break;
            case "inventory":
                reportData = await getInventoryReportData(
                    req.user.organization
                );
                break;
            case "sessions":
                // Get enhanced sessions data
                const playstationData = await getSessionsDataByType(
                    req.user.organization,
                    startDate,
                    endDate,
                    'playstation'
                );
                
                const computerData = await getSessionsDataByType(
                    req.user.organization,
                    startDate,
                    endDate,
                    'computer'
                );
                
                reportData = {
                    playstation: playstationData,
                    computer: computerData
                };
                break;
            case "peakHours":
                reportData = await getPeakHoursData(
                    req.user.organization,
                    startDate,
                    endDate
                );
                break;
            case "staffPerformance":
                reportData = await getStaffPerformanceData(
                    req.user.organization,
                    startDate,
                    endDate
                );
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: "نوع التقرير غير صحيح",
                });
        }

        // Add date range info to report data
        reportData.dateRange = {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            exportDate: new Date().toISOString()
        };

        const arrayBuffer = await exportToPDF(reportData, reportType, { startDate, endDate });
        const buffer = Buffer.from(arrayBuffer);
        const filename = generateFilename(reportType, { startDate, endDate }, "pdf");

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
                filename
            )}`
        );
        res.send(buffer);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تصدير التقرير",
            error: error.message,
        });
    }
};

// Helper functions to get report data
const getSalesReportData = async (organization, startDate, endDate) => {
    const bills = await Bill.find({
        createdAt: { $gte: startDate, $lte: endDate },
        organization,
    }).populate("orders");

    const paidBills = bills.filter((bill) =>
        ["paid", "partial"].includes(bill.status)
    );

    const totalRevenue = paidBills.reduce((sum, bill) => sum + bill.total, 0);
    const totalOrders = bills.reduce(
        (sum, bill) => sum + bill.orders.length,
        0
    );
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const revenueBreakdown = {
        playstation: 0,
        computer: 0,
        cafe: 0,
    };

    paidBills.forEach((bill) => {
        if (bill.billType === "playstation") {
            revenueBreakdown.playstation += bill.total;
        } else if (bill.billType === "computer") {
            revenueBreakdown.computer += bill.total;
        } else if (bill.billType === "cafe") {
            revenueBreakdown.cafe += bill.total;
        }
    });

    // Top products
    const productSales = {};
    bills.forEach((bill) => {
        bill.orders.forEach((order) => {
            order.items.forEach((item) => {
                if (!productSales[item.name]) {
                    productSales[item.name] = { quantity: 0, revenue: 0 };
                }
                productSales[item.name].quantity += item.quantity;
                productSales[item.name].revenue += item.itemTotal;
            });
        });
    });

    const topProducts = Object.entries(productSales)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

    return {
        totalRevenue,
        totalOrders,
        avgOrderValue,
        revenueBreakdown,
        topProducts,
    };
};

const getFinancialReportData = async (organization, startDate, endDate) => {
    const bills = await Bill.find({
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $in: ["paid", "partial"] },
        organization,
    });

    const costs = await Cost.find({
        date: { $gte: startDate, $lte: endDate },
        status: { $in: ["paid", "partially_paid", "pending"] }, // إضافة فلتر للحالة
        organization,
    });

    const totalRevenue = bills.reduce((sum, bill) => sum + bill.total, 0);
    const totalPaid = bills.reduce((sum, bill) => sum + bill.paid, 0);
    const totalCosts = costs.reduce((sum, cost) => sum + cost.paidAmount, 0);
    const pendingCosts = costs.reduce(
        (sum, cost) => sum + (cost.amount - cost.paidAmount),
        0
    );
    const netProfit = totalPaid - totalCosts; // استخدام المدفوع فعلياً
    const profitMargin = totalPaid > 0 ? (netProfit / totalPaid) * 100 : 0;

    // Costs by category
    const costsByCategory = {};
    costs.forEach((cost) => {
        if (!costsByCategory[cost.category]) {
            costsByCategory[cost.category] = {
                amount: 0,
                paidAmount: 0,
                count: 0,
            };
        }
        costsByCategory[cost.category].amount += cost.amount;
        costsByCategory[cost.category].paidAmount += cost.paidAmount;
        costsByCategory[cost.category].count += 1;
    });

    const costsBreakdown = Object.entries(costsByCategory).map(
        ([category, data]) => ({
            category,
            amount: data.amount,
            paidAmount: data.paidAmount,
            percentage:
                totalCosts > 0 ? (data.paidAmount / totalCosts) * 100 : 0,
        })
    );

    // Monthly comparison (re-adding this logic)
    const previousPeriod = getDateRange(
        getPreviousPeriodString(startDate, endDate)
    ); // Helper to get previous period dates
    const previousRevenueData = await Bill.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: previousPeriod.startDate,
                    $lte: previousPeriod.endDate,
                },
                status: { $in: ["partial", "paid"] },
                organization,
            },
        },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: "$total" }, // تغيير من paid إلى total
                totalPaid: { $sum: "$paid" },
            },
        },
    ]);
    const previousRevenue = previousRevenueData[0]?.totalPaid || 0;

    const revenueGrowth =
        previousRevenue > 0
            ? ((totalPaid - previousRevenue) / previousRevenue) * 100
            : 0;

    return {
        totalRevenue,
        totalPaid,
        totalCosts,
        pendingCosts,
        netProfit,
        profitMargin,
        costsByCategory: costsBreakdown,
        comparison: {
            currentPeriodRevenue: totalPaid,
            previousPeriodRevenue: previousRevenue,
            revenueGrowth: revenueGrowth,
        },
    };
};

const getInventoryReportData = async (organization) => {
    const items = await InventoryItem.find({ organization });

    const totalItems = items.length;
    const totalValue = items.reduce(
        (sum, item) => sum + item.currentStock * item.price,
        0
    );
    const lowStockItems = items.filter(
        (item) => item.currentStock <= item.minStock
    ).length;

    return {
        totalItems,
        totalValue,
        lowStockItems,
        items: items.map((item) => ({
            name: item.name,
            category: item.category,
            currentStock: item.currentStock,
            minStock: item.minStock,
            price: item.price,
        })),
    };
};

const getSessionsReportData = async (organization, startDate, endDate) => {
    const sessions = await Session.find({
        startTime: { $gte: startDate, $lte: endDate },
        organization,
    });

    const totalSessions = sessions.length;
    const totalRevenue = sessions.reduce(
        (sum, session) => sum + session.finalCost,
        0
    );

    let totalDuration = 0;
    sessions.forEach((session) => {
        if (session.startTime && session.endTime) {
            const duration =
                new Date(session.endTime) - new Date(session.startTime);
            totalDuration += duration / (1000 * 60 * 60); // Convert to hours
        }
    });

    const avgSessionDuration =
        totalSessions > 0 ? totalDuration / totalSessions : 0;

    // Device statistics
    const deviceStats = {};
    sessions.forEach((session) => {
        const deviceType = session.deviceType || "unknown";
        if (!deviceStats[deviceType]) {
            deviceStats[deviceType] = {
                sessions: 0,
                revenue: 0,
                totalDuration: 0,
            };
        }
        deviceStats[deviceType].sessions += 1;
        deviceStats[deviceType].revenue += session.finalCost;
        if (session.startTime && session.endTime) {
            const duration =
                new Date(session.endTime) - new Date(session.startTime);
            deviceStats[deviceType].totalDuration +=
                duration / (1000 * 60 * 60);
        }
    });

    // Calculate average duration for each device
    Object.keys(deviceStats).forEach((device) => {
        const stats = deviceStats[device];
        stats.avgDuration =
            stats.sessions > 0 ? stats.totalDuration / stats.sessions : 0;
    });

    return {
        totalSessions,
        totalRevenue,
        avgSessionDuration,
        deviceStats,
    };
};

// Helper to determine previous period string for getDateRange
const getPreviousPeriodString = (startDate, endDate) => {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) return "today"; // If period is today
    if (diffDays <= 7) return "week"; // If period is week
    if (diffDays <= 30) return "month"; // If period is month
    if (diffDays <= 90) return "quarter"; // If period is quarter
    if (diffDays <= 365) return "year"; // If period is year
    return "month"; // Default to month if unknown
};

// ==================== NEW HELPER FUNCTIONS ====================

/**
 * Get top products by menu section
 * @param {ObjectId} organization - Organization ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Top products grouped by menu section
 */
const getTopProductsBySection = async (organization, startDate, endDate) => {
    try {
        const orders = await Order.find({
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'delivered',
            organization
        }).populate({
            path: 'items.menuItem',
            populate: {
                path: 'category',
                populate: {
                    path: 'section',
                    select: 'name'
                }
            }
        }).lean();

        const sectionData = {};

        orders.forEach(order => {
            order.items.forEach(item => {
                // Skip items without menu section data
                if (!item.menuItem || !item.menuItem.category || !item.menuItem.category.section) {
                    return;
                }

                const section = item.menuItem.category.section;
                const sectionId = section._id.toString();
                const sectionName = section.name;

                // Initialize section if not exists
                if (!sectionData[sectionId]) {
                    sectionData[sectionId] = {
                        sectionId,
                        sectionName,
                        products: {},
                        totalRevenue: 0,
                        totalQuantity: 0
                    };
                }

                // Initialize product if not exists
                if (!sectionData[sectionId].products[item.name]) {
                    sectionData[sectionId].products[item.name] = {
                        name: item.name,
                        quantity: 0,
                        revenue: 0
                    };
                }

                // Accumulate product data
                sectionData[sectionId].products[item.name].quantity += item.quantity;
                sectionData[sectionId].products[item.name].revenue += item.itemTotal;
                sectionData[sectionId].totalRevenue += item.itemTotal;
                sectionData[sectionId].totalQuantity += item.quantity;
            });
        });

        // Convert to array and sort products within each section
        return Object.values(sectionData).map(section => ({
            ...section,
            products: Object.values(section.products)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5)  // Top 5 products per section
        })).sort((a, b) => b.totalRevenue - a.totalRevenue);
    } catch (error) {
        throw error;
    }
};

/**
 * Get sessions data by device type (PlayStation or Computer)
 * @param {ObjectId} organization - Organization ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {String} deviceType - Device type ('playstation' or 'computer')
 * @returns {Object} Sessions statistics for the device type
 */
const getSessionsDataByType = async (organization, startDate, endDate, deviceType) => {
    try {
        const sessions = await Session.find({
            startTime: { $gte: startDate, $lte: endDate },
            deviceType,
            status: { $in: ['completed', 'active'] },
            organization
        }).lean();

        const totalSessions = sessions.length;
        const totalRevenue = sessions.reduce((sum, s) => sum + (s.finalCost || 0), 0);
        const totalDuration = sessions.reduce((sum, s) => {
            if (s.startTime && s.endTime) {
                return sum + (new Date(s.endTime) - new Date(s.startTime));
            }
            return sum;
        }, 0);
        
        const avgDuration = totalSessions > 0 ? (totalDuration / totalSessions / (1000 * 60 * 60)) : 0; // in hours
        const avgRevenue = totalSessions > 0 ? totalRevenue / totalSessions : 0;

        // Device usage statistics
        const deviceStats = {};
        sessions.forEach(session => {
            const deviceName = session.deviceName || session.deviceNumber;
            if (!deviceStats[deviceName]) {
                deviceStats[deviceName] = {
                    deviceName,
                    sessionsCount: 0,
                    revenue: 0,
                    totalDuration: 0
                };
            }
            deviceStats[deviceName].sessionsCount++;
            deviceStats[deviceName].revenue += session.finalCost || 0;
            
            if (session.startTime && session.endTime) {
                deviceStats[deviceName].totalDuration += (new Date(session.endTime) - new Date(session.startTime));
            }
        });

        // Calculate usage rate for each device
        const periodDuration = endDate - startDate; // in milliseconds
        const deviceUsage = Object.values(deviceStats)
            .map(device => ({
                ...device,
                usageRate: periodDuration > 0 ? ((device.totalDuration / periodDuration) * 100).toFixed(2) : 0
            }))
            .sort((a, b) => b.sessionsCount - a.sessionsCount);

        const result = {
            totalSessions,
            totalRevenue,
            avgDuration: avgDuration.toFixed(2),
            avgRevenue: avgRevenue.toFixed(2),
            deviceUsage
        };

        // Add controller distribution for PlayStation
        if (deviceType === 'playstation') {
            const controllerDistribution = {
                single: sessions.filter(s => s.controllers <= 2).length,
                triple: sessions.filter(s => s.controllers === 3).length,
                quad: sessions.filter(s => s.controllers === 4).length
            };
            result.controllerDistribution = controllerDistribution;
        }

        return result;
    } catch (error) {
        throw error;
    }
};

/**
 * Get peak hours data
 * @param {ObjectId} organization - Organization ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} Peak hours analysis
 */
const getPeakHoursData = async (organization, startDate, endDate) => {
    try {
        const bills = await Bill.find({
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $in: ['paid', 'partial'] },
            organization
        }).populate('orders sessions').lean();

        // Initialize hourly data (24 hours)
        const hourlyData = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            sales: 0,
            sessions: 0,
            revenue: 0
        }));

        bills.forEach(bill => {
            const hour = new Date(bill.createdAt).getHours();
            hourlyData[hour].revenue += bill.total || 0;
            hourlyData[hour].sales += (bill.orders || []).length;
            hourlyData[hour].sessions += (bill.sessions || []).length;
        });

        // Find top 3 peak hours based on revenue
        const peakHours = [...hourlyData]
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 3)
            .map(h => h.hour);

        return {
            hourlyData,
            peakHours
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Get staff performance data
 * @param {ObjectId} organization - Organization ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Staff performance statistics
 */
const getStaffPerformanceData = async (organization, startDate, endDate) => {
    try {
        const orders = await Order.find({
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'delivered',
            organization
        }).populate('createdBy', 'name').lean();

        const sessions = await Session.find({
            startTime: { $gte: startDate, $lte: endDate },
            status: { $in: ['completed', 'active'] },
            organization
        }).populate('createdBy', 'name').lean();

        const staffStats = {};

        // Process orders
        orders.forEach(order => {
            if (!order.createdBy) return;

            const staffId = order.createdBy._id.toString();
            if (!staffStats[staffId]) {
                staffStats[staffId] = {
                    staffId,
                    staffName: order.createdBy.name,
                    ordersCount: 0,
                    sessionsCount: 0,
                    totalRevenue: 0
                };
            }

            staffStats[staffId].ordersCount++;
            staffStats[staffId].totalRevenue += order.finalAmount || 0;
        });

        // Process sessions
        sessions.forEach(session => {
            if (!session.createdBy) return;

            const staffId = session.createdBy._id.toString();
            if (!staffStats[staffId]) {
                staffStats[staffId] = {
                    staffId,
                    staffName: session.createdBy.name,
                    ordersCount: 0,
                    sessionsCount: 0,
                    totalRevenue: 0
                };
            }

            staffStats[staffId].sessionsCount++;
            staffStats[staffId].totalRevenue += session.finalCost || 0;
        });

        // Calculate average order value and sort by total revenue
        return Object.values(staffStats)
            .map(staff => ({
                ...staff,
                avgOrderValue: staff.ordersCount > 0 ? (staff.totalRevenue / staff.ordersCount).toFixed(2) : 0
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue);
    } catch (error) {
        throw error;
    }
};

/**
 * Calculate comparison between current and previous period
 * @param {Object} currentData - Current period data
 * @param {Object} previousData - Previous period data
 * @returns {Object} Comparison metrics
 */
const calculateComparison = (currentData, previousData) => {
    try {
        const comparison = {};

        // Helper function to calculate change
        const calculateChange = (current, previous) => {
            if (!previous || previous === 0) {
                return {
                    change: current,
                    changePercent: current > 0 ? 100 : 0
                };
            }
            const change = current - previous;
            const changePercent = ((change / previous) * 100).toFixed(2);
            return {
                change: change.toFixed(2),
                changePercent: parseFloat(changePercent)
            };
        };

        // Compare revenue
        if (currentData.totalRevenue !== undefined && previousData.totalRevenue !== undefined) {
            comparison.revenue = {
                current: currentData.totalRevenue,
                previous: previousData.totalRevenue,
                ...calculateChange(currentData.totalRevenue, previousData.totalRevenue)
            };
        }

        // Compare orders
        if (currentData.totalOrders !== undefined && previousData.totalOrders !== undefined) {
            comparison.orders = {
                current: currentData.totalOrders,
                previous: previousData.totalOrders,
                ...calculateChange(currentData.totalOrders, previousData.totalOrders)
            };
        }

        // Compare sessions
        if (currentData.totalSessions !== undefined && previousData.totalSessions !== undefined) {
            comparison.sessions = {
                current: currentData.totalSessions,
                previous: previousData.totalSessions,
                ...calculateChange(currentData.totalSessions, previousData.totalSessions)
            };
        }

        return comparison;
    } catch (error) {
        throw error;
    }
};
