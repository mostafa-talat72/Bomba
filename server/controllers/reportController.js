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
        const { period = "today" } = req.query;
        const { startDate, endDate } = getDateRange(period);

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
                    totalRevenue: { $sum: "$paid" },
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
            period,
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
        console.error("❌ Error getting dashboard stats:", error);
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
        const { period = "month", groupBy = "day" } = req.query;
        const { startDate, endDate } = getDateRange(period);

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
                    totalSales: { $sum: "$paid" },
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

        res.json({
            success: true,
            data: {
                period,
                groupBy,
                salesByPeriod,
                topItems,
                revenueBySource: revenueBySource[0] || {
                    totalCafeRevenue: 0,
                    totalGamingRevenue: 0,
                    totalRevenue: 0,
                },
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
        const { period = "month" } = req.query;
        const { startDate, endDate } = getDateRange(period);

        // Revenue
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
                    totalRevenue: { $sum: "$paid" },
                    totalBills: { $sum: 1 },
                },
            },
        ]);

        // Costs
        const costs = await Cost.aggregate([
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate },
                    status: "paid",
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

        const totalCosts = costs.reduce(
            (sum, cost) => sum + cost.totalAmount,
            0
        );
        const totalRevenue = revenue[0]?.totalRevenue || 0;
        const netProfit = totalRevenue - totalCosts;
        const profitMargin =
            totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        // Monthly comparison
        const previousPeriod = getDateRange(period);
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
                    totalRevenue: { $sum: "$paid" },
                },
            },
        ]);

        const revenueGrowth =
            previousRevenue[0]?.totalRevenue > 0
                ? ((totalRevenue - previousRevenue[0].totalRevenue) /
                      previousRevenue[0].totalRevenue) *
                  100
                : 0;

        res.json({
            success: true,
            data: {
                period,
                summary: {
                    totalRevenue,
                    totalCosts,
                    netProfit,
                    profitMargin,
                    revenueGrowth,
                },
                revenue: revenue[0] || { totalRevenue: 0, totalBills: 0 },
                costs,
                comparison: {
                    currentPeriod: totalRevenue,
                    previousPeriod: previousRevenue[0]?.totalRevenue || 0,
                    growth: revenueGrowth,
                },
            },
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
        const { period = "month", device } = req.query;
        const { startDate, endDate } = getDateRange(period);

        const query = {
            startTime: { $gte: startDate, $lte: endDate },
            organization: req.user.organization,
        };

        if (device) query.device = device;

        // Sessions statistics
        const sessionsStats = await Session.aggregate([
            { $match: query },
            {
                $group: {
                    _id: "$device",
                    totalSessions: { $sum: 1 },
                    totalRevenue: { $sum: "$finalCost" },
                    avgDuration: {
                        $avg: {
                            $divide: [
                                { $subtract: ["$endTime", "$startTime"] },
                                1000 * 60, // Convert to minutes
                            ],
                        },
                    },
                    avgRevenue: { $avg: "$finalCost" },
                },
            },
        ]);

        // Peak hours analysis
        const peakHours = await Session.aggregate([
            { $match: query },
            {
                $group: {
                    _id: { $hour: "$startTime" },
                    sessionCount: { $sum: 1 },
                    totalRevenue: { $sum: "$finalCost" },
                },
            },
            {
                $sort: { sessionCount: -1 },
            },
        ]);

        // Device utilization
        const deviceUtilization = await Session.aggregate([
            { $match: query },
            {
                $group: {
                    _id: {
                        device: "$device",
                        deviceNumber: "$deviceNumber",
                    },
                    sessionCount: { $sum: 1 },
                    totalHours: {
                        $sum: {
                            $divide: [
                                { $subtract: ["$endTime", "$startTime"] },
                                1000 * 60 * 60, // Convert to hours
                            ],
                        },
                    },
                    totalRevenue: { $sum: "$finalCost" },
                },
            },
            {
                $sort: { sessionCount: -1 },
            },
        ]);

        res.json({
            success: true,
            data: {
                period,
                device,
                sessionsStats,
                peakHours,
                deviceUtilization,
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
            .lean();

        // Get recent bills
        const recentBills = await Bill.find({
            organization: req.user.organization,
        })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit) / 2)
            .populate("createdBy", "name")
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

            if (order.status === "pending") {
                message = `طلب جديد - ${
                    order.customerName || `طاولة ${order.tableNumber}`
                }`;
            } else if (order.status === "preparing") {
                message = `جاري تحضير طلب - ${
                    order.customerName || `طاولة ${order.tableNumber}`
                }`;
                color = "text-yellow-600";
            } else if (order.status === "ready") {
                message = `طلب جاهز - ${
                    order.customerName || `طاولة ${order.tableNumber}`
                }`;
                color = "text-green-600";
            } else if (order.status === "delivered") {
                message = `تم تسليم طلب - ${
                    order.customerName || `طاولة ${order.tableNumber}`
                }`;
                color = "text-blue-600";
            } else if (order.status === "cancelled") {
                message = `إلغاء طلب - ${
                    order.customerName || `طاولة ${order.tableNumber}`
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
                    tableNumber: order.tableNumber,
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

            if (bill.status === "paid") {
                message = `دفع فاتورة - ${
                    bill.customerName || `طاولة ${bill.tableNumber}`
                }`;
            } else if (bill.status === "partial") {
                message = `دفع جزئي - ${
                    bill.customerName || `طاولة ${bill.tableNumber}`
                }`;
                color = "text-yellow-600";
            } else if (bill.status === "cancelled") {
                message = `إلغاء فاتورة - ${
                    bill.customerName || `طاولة ${bill.tableNumber}`
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
        const { reportType, period = "today" } = req.query;
        const { startDate, endDate } = getDateRange(period);

        let reportData;

        switch (reportType) {
            case "sales":
                reportData = await getSalesReportData(
                    req.user.organization,
                    startDate,
                    endDate
                );
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
                reportData = await getSessionsReportData(
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

        const buffer = await exportToExcel(reportData, reportType, period);
        const filename = generateFilename(reportType, period, "xlsx");

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
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

// @desc    Export report to PDF
// @route   GET /api/reports/export/pdf
// @access  Private
export const exportReportToPDF = async (req, res) => {
    try {
        const { reportType, period = "today" } = req.query;
        const { startDate, endDate } = getDateRange(period);

        let reportData;

        switch (reportType) {
            case "sales":
                reportData = await getSalesReportData(
                    req.user.organization,
                    startDate,
                    endDate
                );
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
                reportData = await getSessionsReportData(
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

        const blob = await exportToPDF(reportData, reportType, period);
        const filename = generateFilename(reportType, period, "pdf");

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
        );
        res.send(blob);
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
            if (!productSales[order.itemName]) {
                productSales[order.itemName] = { quantity: 0, revenue: 0 };
            }
            productSales[order.itemName].quantity += order.quantity;
            productSales[order.itemName].revenue += order.totalPrice;
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
        organization,
    });

    const totalRevenue = bills.reduce((sum, bill) => sum + bill.total, 0);
    const totalCosts = costs.reduce((sum, cost) => sum + cost.amount, 0);
    const netProfit = totalRevenue - totalCosts;
    const profitMargin =
        totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Costs by category
    const costsByCategory = {};
    costs.forEach((cost) => {
        if (!costsByCategory[cost.category]) {
            costsByCategory[cost.category] = { amount: 0, count: 0 };
        }
        costsByCategory[cost.category].amount += cost.amount;
        costsByCategory[cost.category].count += 1;
    });

    const costsBreakdown = Object.entries(costsByCategory).map(
        ([category, data]) => ({
            category,
            amount: data.amount,
            percentage: totalCosts > 0 ? (data.amount / totalCosts) * 100 : 0,
        })
    );

    return {
        totalRevenue,
        totalCosts,
        netProfit,
        profitMargin,
        costsByCategory: costsBreakdown,
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
