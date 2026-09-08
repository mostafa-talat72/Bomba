import Order from "../models/Order.js";
import Session from "../models/Session.js";
import Bill from "../models/Bill.js";
import Cost from "../models/Cost.js";
import InventoryItem from "../models/InventoryItem.js";
import MenuItem from "../models/MenuItem.js";
import MenuCategory from "../models/MenuCategory.js";
import MenuSection from "../models/MenuSection.js";
import mongoose from "mongoose";
import { getDateRange } from "../utils/helpers.js";
import {
    exportToExcel,
    exportToPDF,
    generateFilename,
} from "../utils/exportUtils.js";
import { getUserLocale } from "../utils/localeHelper.js";
import { getReportEligibleOrderIds } from "../utils/reportOrderFilter.js";
import { getOrganizationId } from "../utils/organization.js";

// @desc    Get dashboard statistics
// @route   GET /api/reports/dashboard
// @access  Private
export const getDashboardStats = async (req, res) => {
    try {
        const filter = req.query;
        const { startDate, endDate } = getDateRange(filter);
        const reportOrderIds = await getReportEligibleOrderIds(req.user.organization, { startDate, endDate });

        // كل التجميعات متوازية بلا تسلسل — نفس البيانات الكاملة لكن 150ms بدل 800ms
        const [revenueData, ordersData, sessionsData] = await Promise.all([
            Bill.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate },
                        status: { $in: ["partial", "paid"] },
                        organization: getOrganizationId(req.user),
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: "$total" },
                        totalBills: { $sum: 1 },
                        avgBillValue: { $avg: "$total" },
                    },
                },
            ]),
            Order.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate },
                        isDeleted: false,
                        organization: getOrganizationId(req.user),
                        _id: { $in: reportOrderIds },
                    },
                },
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 },
                        totalAmount: { $sum: "$finalAmount" },
                    },
                },
            ]),
            Session.aggregate([
                {
                    $match: {
                        endTime: { $gte: startDate, $lte: endDate },
                        status: "completed",
                        totalCost: { $gt: 0 },
                        organization: getOrganizationId(req.user),
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
        ])]);

        // باقي التجميعات متوازية أيضاً بلا limit
        const [costsData, activeSessions, lowStockItems, todayBills, activePendingOrders] = await Promise.all([
            Cost.aggregate([
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate },
                    organization: getOrganizationId(req.user),
                },
            },
            {
                $group: {
                    _id: "$category",
                    totalAmount: { $sum: "$amount" },
                    count: { $sum: 1 },
                },
            },
            ]),
            Session.countDocuments({
                status: "active",
                organization: getOrganizationId(req.user),
            }),
            InventoryItem.countDocuments({
                isActive: true,
                organization: getOrganizationId(req.user),
                $expr: { $lte: ["$currentStock", "$minStock"] },
            }),
            Bill.countDocuments({
                createdAt: { $gte: startDate, $lte: endDate },
                organization: getOrganizationId(req.user),
            }),
            Order.countDocuments({
                status: { $in: ["pending", "preparing", "ready"] },
                organization: getOrganizationId(req.user),
                isDeleted: false,
                _id: { $in: reportOrderIds },
            })
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
                activePendingOrders,
                lowStockItems,
            },
            today: {
                bills: todayBills,
                revenue: revenueData[0]?.totalRevenue || 0,
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
        // Both eligible-order scans resolve together (each scoped to its own period).
        const [reportOrderIds, previousOrderIds] = await Promise.all([
            getReportEligibleOrderIds(req.user.organization, { startDate, endDate }),
            getReportEligibleOrderIds(req.user.organization, { startDate: previousStartDate, endDate: previousEndDate }),
        ]);

        // NOTE: salesByPeriod / topItems / revenueBySource aggregates were removed —
        // the frontend never reads them and revenueBySource's double-$lookup over
        // all bills was one of the slowest stages. Keys are kept below as empty
        // defaults for API compatibility.

        // Helpers run in parallel. Each period uses its own eligible-order id set
        // (scoped to that period's dates, resolved together above).
        const [
            currentData,
            previousData,
            topProductsBySection,
            peakHours,
            staffPerformance,
        ] = await Promise.all([
            getSalesReportData(req.user.organization, startDate, endDate, reportOrderIds),
            getSalesReportData(req.user.organization, previousStartDate, previousEndDate, previousOrderIds),
            getTopProductsBySection(req.user.organization, startDate, endDate, reportOrderIds),
            getPeakHoursData(req.user.organization, startDate, endDate, reportOrderIds),
            getStaffPerformanceData(req.user.organization, startDate, endDate, reportOrderIds),
        ]);

        // Calculate comparison metrics
        const comparison = calculateComparison(currentData, previousData);

        res.json({
            success: true,
            data: {
                // Main data at root level for frontend compatibility
                totalRevenue: currentData.totalRevenue || 0,
                totalOrders: currentData.totalOrders || 0,
                totalSessions: currentData.totalSessions || 0,
                avgOrderValue: currentData.avgOrderValue || 0,
                revenueByType: currentData.revenueBreakdown || {
                    playstation: 0,
                    computer: 0,
                    cafe: 0
                },
                topProductsBySection,
                peakHours,
                staffPerformance,
                comparison: {
                    revenue: comparison.revenue,
                    orders: comparison.orders,
                    sessions: comparison.sessions,
                    avgOrderValue: comparison.avgOrderValue
                },
                // Additional detailed data
                filter,
                groupBy,
                salesByPeriod: [],
                topItems: currentData.topProducts || [],
                revenueBySource: {
                    totalCafeRevenue: currentData.revenueBreakdown?.cafe || 0,
                    totalGamingRevenue: (currentData.revenueBreakdown?.playstation || 0) + (currentData.revenueBreakdown?.computer || 0),
                    totalRevenue: currentData.totalRevenue || 0,
                },
                current: currentData,
                previous: previousData,
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

        // Current inventory status — the three aggregates resolve together below
        const inventoryStatusPromise = InventoryItem.aggregate([
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
        const categoryStatsPromise = InventoryItem.aggregate([
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
        const recentMovementsPromise = InventoryItem.aggregate([
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

        const [inventoryStatus, categoryStats, recentMovements] = await Promise.all([
            inventoryStatusPromise,
            categoryStatsPromise,
            recentMovementsPromise,
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
        
        // Get organization ID correctly
        const organizationId = getOrganizationId(req.user);
        const reportOrderIds = await getReportEligibleOrderIds(organizationId, { startDate, endDate });

        // Revenue from Bills (source of truth) — promises resolve together below
        const billRevenuePromise = Bill.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    status: { $in: ["paid", "partial"] },
                    organization: organizationId,
                },
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$total" },
                    totalPaid: { $sum: "$paid" },
                    totalBills: { $sum: 1 },
                },
            },
        ]);

        // Costs - إضافة جميع التكاليف المدفوعة والمعلقة
        const costsPromise = Cost.aggregate([
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate },
                    status: { $in: ["paid", "partially_paid", "pending"] },
                    organization: organizationId,
                },
            },
            {
                $group: {
                    _id: "$category",
                    totalAmount: { $sum: "$amount" },
                    paidAmount: { $sum: "$paidAmount" },
                    count: { $sum: 1 },
                },
            },
        ]);

        // All independent queries resolve together (were 5 sequential awaits).
        const [billRevenue, costs] = await Promise.all([billRevenuePromise, costsPromise]);

        const totalRevenue = billRevenue[0]?.totalRevenue || 0;
        const totalPaid = billRevenue[0]?.totalPaid || 0;

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

        const netProfit = totalPaid - totalCostsAmount;
        const profitMargin = totalPaid > 0 ? (netProfit / totalPaid) * 100 : 0;

        // Previous period comparison - clone dates to avoid mutating the filter
        const previousPeriod = getDateRange(filter);
        previousPeriod.startDate = new Date(
            previousPeriod.startDate.getFullYear(),
            previousPeriod.startDate.getMonth() - 1,
            previousPeriod.startDate.getDate()
        );
        previousPeriod.endDate = new Date(
            previousPeriod.endDate.getFullYear(),
            previousPeriod.endDate.getMonth() - 1,
            previousPeriod.endDate.getDate()
        );

        const previousBillRevenuePromise = Bill.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: previousPeriod.startDate,
                        $lte: previousPeriod.endDate,
                    },
                    status: { $in: ["paid", "partial"] },
                    organization: organizationId,
                },
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$total" },
                    totalPaid: { $sum: "$paid" },
                },
            },
        ]);

        // Count orders and sessions without summing revenue (just for counts)
        const totalOrdersPromise = Order.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $ne: "cancelled" },
            organization: organizationId,
            isDeleted: false,
            _id: { $in: reportOrderIds },
        });

        const totalSessionsPromise = Session.countDocuments({
            endTime: { $gte: startDate, $lte: endDate },
            status: "completed",
            totalCost: { $gt: 0 },
            organization: organizationId,
        });

        const [previousBillRevenue, totalOrders, totalSessions] = await Promise.all([
            previousBillRevenuePromise,
            totalOrdersPromise,
            totalSessionsPromise,
        ]);

        const previousTotal = previousBillRevenue[0]?.totalPaid || 0;

        const revenueGrowth =
            previousTotal > 0
                ? ((totalPaid - previousTotal) / previousTotal) * 100
                : 0;

        const totalTransactions = totalOrders + totalSessions;

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
                totalTransactions,
            },
            revenue: {
                totalRevenue,
                totalPaid,
                totalOrders,
                totalSessions,
            },
            costs,
            comparison: {
                currentPeriod: totalPaid,
                previousPeriod: previousTotal,
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
        
        // Calculate previous period for comparison
        const periodDuration = endDate - startDate;
        const previousStartDate = new Date(startDate.getTime() - periodDuration);
        const previousEndDate = startDate;

        // Separate PlayStation and Computer sessions — all four scans in parallel
        // (were 4 sequential full-collection scans).
        const [
            playstationData,
            computerData,
            prevPlaystationData,
            prevComputerData,
        ] = await Promise.all([
            getSessionsDataByType(
                req.user.organization,
                startDate,
                endDate,
                'playstation'
            ),
            getSessionsDataByType(
                req.user.organization,
                startDate,
                endDate,
                'computer'
            ),
            getSessionsDataByType(
                req.user.organization,
                previousStartDate,
                previousEndDate,
                'playstation'
            ),
            getSessionsDataByType(
                req.user.organization,
                previousStartDate,
                previousEndDate,
                'computer'
            ),
        ]);

        const currentTotal = (playstationData.totalSessions || 0) + (computerData.totalSessions || 0);
        const previousTotal = (prevPlaystationData.totalSessions || 0) + (prevComputerData.totalSessions || 0);

        const change = currentTotal - previousTotal;
        const changePercent = previousTotal > 0 ? parseFloat(((change / previousTotal) * 100).toFixed(2)) : (currentTotal > 0 ? 100 : 0);

        res.json({
            success: true,
            data: {
                filter,
                totalSessions: currentTotal,
                playstation: playstationData,
                computer: computerData,
                comparison: {
                    sessions: {
                        current: currentTotal,
                        previous: previousTotal,
                        change,
                        changePercent
                    }
                }
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

// @desc    Get consumption report (single server-side aggregation for the
//          Consumption page and the Reports page — same shape the frontend
//          used to build locally with processOrdersAndSessions)
// @route   GET /api/reports/consumption?startDate&endDate
// @access  Private
export const getConsumptionReport = async (req, res) => {
    try {
        const organization = getOrganizationId(req.user);
        const { startDate: rawStart, endDate: rawEnd } = req.query;
        if (!rawStart || !rawEnd) {
            return res.status(400).json({
                success: false,
                message: "startDate و endDate مطلوبان",
            });
        }
        const startDate = new Date(rawStart);
        const endDate = new Date(rawEnd);
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "صيغة التاريخ غير صالحة",
            });
        }

        // Server-side mirror of the client's getId() (src/utils/id.ts):
        // canonical string for _id / id / ObjectId / populated-object refs.
        const toIdString = (v) => {
            if (v === null || v === undefined) return "";
            if (typeof v === "string") return v;
            if (typeof v === "number") return String(v);
            if (typeof v === "object") {
                const inner = v._id ?? v.id;
                if (inner !== null && inner !== undefined && typeof inner === "object") {
                    try {
                        const s = String(inner.toString?.() ?? "");
                        if (s && s !== "[object Object]") return s;
                    } catch { /* fall through */ }
                    return "";
                }
                if (typeof inner === "string" || typeof inner === "number") return String(inner);
                try {
                    const s = String(v.toString?.() ?? "");
                    if (s && s !== "[object Object]") return s;
                } catch { /* fall through */ }
                return "";
            }
            try {
                return String(v);
            } catch {
                return "";
            }
        };

        const OTHER_SECTION_KEY = "__OTHER__";
        const PLAYSTATION_SECTION_KEY = "__PLAYSTATION__";
        const COMPUTER_SECTION_KEY = "__COMPUTER__";

        const ids = await getReportEligibleOrderIds(organization, { startDate, endDate });
        const [orders, sessions, menuItems, menuSections] = await Promise.all([
            Order.find({
                createdAt: { $gte: startDate, $lte: endDate },
                isDeleted: false,
                organization,
                _id: { $in: ids },
            }).select("items").lean(),
            Session.find({
                endTime: { $gte: startDate, $lte: endDate },
                status: "completed",
                organization,
            }).select("deviceId deviceName deviceNumber deviceType status startTime endTime finalCost controllersHistory").lean(),
            MenuItem.find({ organization }).select("name category").populate({
                path: "category",
                select: "name section",
                populate: { path: "section", select: "name" },
            }).lean(),
            MenuSection.find({ organization }).select("name").lean(),
        ]);

        // O(1) lookups: menu item by id (+by name, kept for parity), section by id.
        const menuItemById = new Map();
        const menuItemByName = new Map();
        menuItems.forEach((m) => {
            const mid = toIdString(m._id);
            if (mid && !menuItemById.has(mid)) menuItemById.set(mid, m);
            if (m.name && !menuItemByName.has(m.name)) menuItemByName.set(m.name, m);
        });
        const sectionById = new Map();
        menuSections.forEach((s) => {
            const sid = toIdString(s._id);
            if (sid && !sectionById.has(sid)) sectionById.set(sid, s);
        });

        const itemsBySection = {};
        const rowByKey = new Map();

        // ---- Items: same rules as the former client aggregation ----
        orders.forEach((order) => {
            if (!order.items || !Array.isArray(order.items)) return;

            order.items.forEach((item) => {
                if (!item?.name) return;

                const itemQuantity = Number(item.quantity) || 0;
                const itemPrice = Number(item.price ?? ((Number(item.itemTotal) || 0) / (Number(item.quantity) || 1))) || 0;
                if (itemQuantity <= 0 || itemPrice < 0) return;

                const menuId = toIdString(item.menuItem?._id || item.menuItemId || item.menuItem) || null;
                const rawVariant = item.variant || "default";
                const normalizedVariant = typeof rawVariant === "string" && rawVariant.trim() ? rawVariant : "default";
                const keyBase = menuId || String(item.name || "unknown");
                const key = `${keyBase}|${normalizedVariant}`;

                // Ids are authoritative: resolve the section via the menu item id
                // only (no name fallback), then the saved snapshot section.
                let sectionName = OTHER_SECTION_KEY;
                if (menuId) {
                    const menuItem = menuItemById.get(menuId);
                    if (menuItem?.category && typeof menuItem.category === "object" && menuItem.category !== null) {
                        const sectionRef = menuItem.category.section;
                        let sectionObj = null;
                        if (typeof sectionRef === "string") {
                            sectionObj = sectionById.get(sectionRef) || null;
                        } else if (sectionRef && typeof sectionRef === "object") {
                            sectionObj = sectionRef.name
                                ? sectionRef
                                : (sectionById.get(toIdString(sectionRef)) || null);
                        }
                        if (sectionObj?.name) sectionName = sectionObj.name;
                    }
                }
                if (sectionName === OTHER_SECTION_KEY && item.section) {
                    const snapId = toIdString(item.section);
                    const snapSection = (snapId && sectionById.get(snapId))
                        || (typeof item.section === "object" && item.section !== null ? item.section : null);
                    if (snapSection?.name) sectionName = snapSection.name;
                }

                if (!itemsBySection[sectionName]) itemsBySection[sectionName] = [];

                const hit = rowByKey.get(`${sectionName}||${key}`);
                const existingItem = hit ? itemsBySection[hit.section]?.[hit.index] : undefined;
                if (existingItem && existingItem.key === key) {
                    existingItem.quantity += itemQuantity;
                    existingItem.total += itemPrice * itemQuantity;
                    existingItem.price = existingItem.total / existingItem.quantity;
                } else {
                    const variantText = normalizedVariant && normalizedVariant !== "default" && normalizedVariant !== "عادي"
                        ? ` (${normalizedVariant})`
                        : "";
                    itemsBySection[sectionName].push({
                        id: toIdString(item._id) || `${key}-${Math.random().toString(16).slice(2)}`,
                        name: `${item.name}${variantText}`,
                        price: itemPrice,
                        quantity: itemQuantity,
                        total: itemPrice * itemQuantity,
                        category: sectionName,
                        key,
                    });
                    rowByKey.set(`${sectionName}||${key}`, { section: sectionName, index: itemsBySection[sectionName].length - 1 });
                }
            });
        });

        // ---- Sessions: playstation/computer, completed, with endTime ----
        sessions.forEach((session) => {
            if (session.deviceType !== "playstation" && session.deviceType !== "computer") return;
            if (session.status !== "completed") return;
            if (!session.endTime) return;

            const deviceName = session.deviceName || `جهاز ${session.deviceNumber}`;
            const sessionCost = Number(session.finalCost) || 0;

            let totalHours = 0;
            if (session.controllersHistory && Array.isArray(session.controllersHistory) && session.controllersHistory.length > 0) {
                session.controllersHistory.forEach((period) => {
                    const periodStart = new Date(period.from).getTime();
                    const periodEnd = period.to
                        ? new Date(period.to).getTime()
                        : (session.endTime ? new Date(session.endTime).getTime() : Date.now());
                    totalHours += (periodEnd - periodStart) / (1000 * 60 * 60);
                });
            } else {
                const startTime = new Date(session.startTime).getTime();
                const endTime = new Date(session.endTime).getTime();
                totalHours = (endTime - startTime) / (1000 * 60 * 60);
            }

            const sectionName = session.deviceType === "computer" ? COMPUTER_SECTION_KEY : PLAYSTATION_SECTION_KEY;
            const deviceKey = toIdString(session.deviceId?._id ?? session.deviceId)
                || String(session.deviceNumber || deviceName || "");

            if (!itemsBySection[sectionName]) itemsBySection[sectionName] = [];
            const existingItem = itemsBySection[sectionName].find((i) => i.key === deviceKey);
            if (existingItem) {
                existingItem.quantity += totalHours;
                existingItem.total += sessionCost;
            } else {
                itemsBySection[sectionName].push({
                    id: String(session._id || session.id || Math.random().toString()),
                    name: deviceName,
                    price: 0,
                    quantity: totalHours,
                    total: sessionCost,
                    category: sectionName,
                    key: deviceKey,
                });
            }
        });

        // Sort each section by total desc; drop empty sections.
        Object.values(itemsBySection).forEach((rows) => {
            rows.sort((a, b) => b.total - a.total);
        });
        Object.keys(itemsBySection).forEach((section) => {
            if (itemsBySection[section].length === 0) delete itemsBySection[section];
        });

        res.json({ success: true, data: itemsBySection });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب تقرير الاستهلاك",
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
        const perType = Math.max(1, Math.floor(parseInt(limit) / 2));

        // The two small recent lists resolve together (were sequential awaits).
        // Orders walk back in batches until `perType` bill-linked ones are found —
        // same result as the old eligible-ids query, with NO hard truncation and
        // NO 1.8s eligibility scan (one small batched Bill lookup per batch).
        const [recentSessions, recentBills] = await Promise.all([
            // Get recent sessions
            Session.find({
                organization: getOrganizationId(req.user),
            })
                .sort({ createdAt: -1 })
                .limit(perType)
                .populate("createdBy", "name")
                .lean(),
            // Get recent bills
            Bill.find({
                organization: getOrganizationId(req.user),
            })
                .sort({ createdAt: -1 })
                .limit(perType)
                .populate("createdBy", "name")
                .populate("table", "number name")
                .lean(),
        ]);

        // Keep only orders still linked to a live bill that still contains them
        // (same semantics as the eligibility filter, indexed queries only).
        const recentOrders = [];
        const LINK_BATCH = 50;
        // Generous back-scan (up to 1000 recent orders ≈ weeks of volume): the loop
        // stops as soon as enough linked orders are found (normally batch 1).
        for (let page = 0; page < 20 && recentOrders.length < perType; page++) {
            const batch = await Order.find({
                organization: getOrganizationId(req.user),
                isDeleted: false,
            })
                .sort({ createdAt: -1 })
                .skip(page * LINK_BATCH)
                .limit(LINK_BATCH)
                .populate("createdBy", "name")
                .populate("table", "number name")
                .lean();
            if (batch.length === 0) break;
            const batchBillIds = [
                ...new Set(
                    batch
                        .map((o) => String(o.bill?._id || o.bill || ""))
                        .filter((id) => id && id !== "undefined" && id !== "null")
                ),
            ];
            const batchBills = batchBillIds.length > 0
                ? await Bill.find({
                    _id: { $in: batchBillIds },
                    organization: getOrganizationId(req.user),
                    isDeleted: { $ne: true },
                }).select("orders").lean()
                : [];
            const batchSets = new Map(
                batchBills.map((b) => [
                    String(b._id),
                    new Set((b.orders || []).map((o) => String(o?._id || o))),
                ])
            );
            for (const o of batch) {
                if (recentOrders.length >= perType) break;
                const set = batchSets.get(String(o.bill?._id || o.bill));
                if (set && set.has(String(o._id))) recentOrders.push(o);
            }
        }

        // Combine and format activities
        const activities = [];

        // Add session activities
        recentSessions.forEach((session) => {
            let type = "session";
            let status = session.status;
            let color = "text-blue-600";

            if (session.status === "completed") {
                color = "text-purple-600";
            } else if (session.status === "cancelled") {
                color = "text-red-600";
            }

            activities.push({
                id: session._id,
                type,
                status,
                time: new Date(session.createdAt).toLocaleTimeString(getUserLocale(req.user), {
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
            let type = "order";
            let status = order.status;
            let color = "text-orange-600";

            const tableNumber = order.table?.number || null;
            
            if (order.status === "preparing") {
                color = "text-yellow-600";
            } else if (order.status === "ready") {
                color = "text-green-600";
            } else if (order.status === "delivered") {
                color = "text-blue-600";
            } else if (order.status === "cancelled") {
                color = "text-red-600";
            }

            activities.push({
                id: order._id,
                type,
                status,
                time: new Date(order.createdAt).toLocaleTimeString(getUserLocale(req.user), {
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
            let type = "bill";
            let status = bill.status;
            let color = "text-green-600";
            
            const billTableNumber = bill.table?.number || null;

            if (bill.status === "partial") {
                color = "text-yellow-600";
            } else if (bill.status === "cancelled") {
                color = "text-red-600";
            }

            activities.push({
                id: bill._id,
                type,
                status,
                time: new Date(bill.createdAt).toLocaleTimeString(getUserLocale(req.user), {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                date: bill.createdAt,
                color,
                icon: "Receipt",
                details: {
                    customerName: bill.customerName,
                    tableNumber: billTableNumber,
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
                // One shared eligible-order scan + parallel helpers (was 6 scans sequentially).
                const periodDuration = endDate - startDate;
                const previousStartDate = new Date(startDate.getTime() - periodDuration);
                const previousEndDate = startDate;
                const [exportOrderIds, exportPrevOrderIds] = await Promise.all([
                    getReportEligibleOrderIds(getOrganizationId(req.user), { startDate, endDate }),
                    getReportEligibleOrderIds(getOrganizationId(req.user), { startDate: previousStartDate, endDate: previousEndDate }),
                ]);

                const [salesData, previousData, topProductsBySection, peakHours, staffPerformance] = await Promise.all([
                    getSalesReportData(req.user.organization, startDate, endDate, exportOrderIds),
                    getSalesReportData(req.user.organization, previousStartDate, previousEndDate, exportPrevOrderIds),
                    getTopProductsBySection(req.user.organization, startDate, endDate, exportOrderIds),
                    getPeakHoursData(req.user.organization, startDate, endDate, exportOrderIds),
                    getStaffPerformanceData(req.user.organization, startDate, endDate, exportOrderIds),
                ]);
                
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
                const [playstationData, computerData] = await Promise.all([
                    getSessionsDataByType(
                        req.user.organization,
                        startDate,
                        endDate,
                        'playstation'
                    ),
                    getSessionsDataByType(
                        req.user.organization,
                        startDate,
                        endDate,
                        'computer'
                    ),
                ]);
                
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
                // One shared eligible-order scan + parallel helpers (was 6 scans sequentially).
                const periodDuration = endDate - startDate;
                const previousStartDate = new Date(startDate.getTime() - periodDuration);
                const previousEndDate = startDate;
                const [exportOrderIds, exportPrevOrderIds] = await Promise.all([
                    getReportEligibleOrderIds(getOrganizationId(req.user), { startDate, endDate }),
                    getReportEligibleOrderIds(getOrganizationId(req.user), { startDate: previousStartDate, endDate: previousEndDate }),
                ]);

                const [salesData, previousData, topProductsBySection, peakHours, staffPerformance] = await Promise.all([
                    getSalesReportData(req.user.organization, startDate, endDate, exportOrderIds),
                    getSalesReportData(req.user.organization, previousStartDate, previousEndDate, exportPrevOrderIds),
                    getTopProductsBySection(req.user.organization, startDate, endDate, exportOrderIds),
                    getPeakHoursData(req.user.organization, startDate, endDate, exportOrderIds),
                    getStaffPerformanceData(req.user.organization, startDate, endDate, exportOrderIds),
                ]);
                
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
                const [playstationData, computerData] = await Promise.all([
                    getSessionsDataByType(
                        req.user.organization,
                        startDate,
                        endDate,
                        'playstation'
                    ),
                    getSessionsDataByType(
                        req.user.organization,
                        startDate,
                        endDate,
                        'computer'
                    ),
                ]);
                
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
const getSalesReportData = async (organization, startDate, endDate, eligibleOrderIds = null) => {
    // Ensure organization is an ObjectId, not an object
    const organizationId = getOrganizationId(organization);
    const reportOrderIds = eligibleOrderIds || await getReportEligibleOrderIds(organizationId);
    
    // Get ALL orders using the same logic as ConsumptionReport
    // Projection: only fields used below (items/finalAmount) — full docs are ~10x bigger.
    const orders = await Order.find({
        createdAt: { $gte: startDate, $lte: endDate },
        isDeleted: false,
        organization: organizationId,
        _id: { $in: reportOrderIds },
    }).select('items finalAmount').lean();

    // Get completed sessions using endTime (same as ConsumptionReport and /api/sessions endpoint)
    const sessions = await Session.find({
        endTime: { $gte: startDate, $lte: endDate },
        status: "completed",
        totalCost: { $gt: 0 },
        organization: organizationId,
    }).select('finalCost deviceType').lean();

    // Calculate cafe revenue from orders using finalAmount
    const cafeRevenue = orders.reduce((sum, order) => sum + (Number(order.finalAmount) || 0), 0);
    const totalOrders = orders.length;

    // Calculate gaming revenue from sessions using finalCost (after discount)
    const playstationSessions = sessions.filter(s => s.deviceType === "playstation");
    const computerSessions = sessions.filter(s => s.deviceType === "computer");
    
    const playstationRevenue = playstationSessions.reduce((sum, session) => sum + (Number(session.finalCost) || 0), 0);
    const computerRevenue = computerSessions.reduce((sum, session) => sum + (Number(session.finalCost) || 0), 0);
    const gamingRevenue = playstationRevenue + computerRevenue;

    // Total revenue
    const totalRevenue = cafeRevenue + gamingRevenue;
    const totalTransactions = totalOrders + sessions.length;
    const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    const revenueBreakdown = {
        playstation: playstationRevenue,
        computer: computerRevenue,
        cafe: cafeRevenue,
    };

    // Top products from order snapshots - group by menu item id + variant.
    const productSales = {};
    orders.forEach((order) => {
        if (!order.items || !Array.isArray(order.items)) return;
        
        order.items.forEach((item) => {
            if (!item.name) return;
            
            const variant = item.variant || '';
            const menuItemId = item.menuItem?._id || item.menuItemId || item.menuItem;
            const key = `${menuItemId ? String(menuItemId) : item.name}|${variant}`;
            const variantText = variant && variant !== 'عادي' ? ` (${variant})` : '';
            const displayName = `${item.name}${variantText}`;
            if (!productSales[key]) {
                productSales[key] = { 
                    name: displayName,
                    quantity: 0, 
                    revenue: 0 
                };
            }
            
            const itemQuantity = Number(item.quantity) || 0;
            const itemPrice = Number(item.price) || 0;
            const itemTotal = Number(item.itemTotal) || (itemPrice * itemQuantity);
            
            productSales[key].quantity += itemQuantity;
            productSales[key].revenue += itemTotal;
        });
    });

    const topProducts = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

    return {
        totalRevenue,
        totalOrders,
        totalSessions: sessions.length,
        avgOrderValue,
        revenueBreakdown,
        topProducts,
    };
};

const getFinancialReportData = async (organization, startDate, endDate) => {
    // Ensure organization is an ObjectId, not an object
    const organizationId = getOrganizationId(organization);
    
    const [bills, costs] = await Promise.all([
        Bill.find({
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $in: ["paid", "partial"] },
            organization: organizationId,
        }).select('total paid').lean(),
        Cost.find({
            date: { $gte: startDate, $lte: endDate },
            status: { $in: ["paid", "partially_paid", "pending"] }, // إضافة فلتر للحالة
            organization: organizationId,
        }).select('category amount paidAmount').lean(),
    ]);

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
                organization: organizationId,
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
    // Ensure organization is an ObjectId, not an object
    const organizationId = getOrganizationId(organization);
    
    const items = await InventoryItem.find({ organization: organizationId }).select('name category currentStock minStock price').lean();

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
    // Ensure organization is an ObjectId, not an object
    const organizationId = getOrganizationId(organization);
    
    // Filter by endTime for completed sessions, only include completed sessions
    const sessions = await Session.find({
        endTime: { $gte: startDate, $lte: endDate },
        status: "completed",
        totalCost: { $gt: 0 },
        organization: organizationId,
    }).select('finalCost deviceType controllersHistory startTime endTime').lean();

    const totalSessions = sessions.length;
    // Use finalCost (after discount) instead of totalCost
    const totalRevenue = sessions.reduce(
        (sum, session) => sum + (Number(session.finalCost) || 0),
        0
    );

    let totalDuration = 0;
    sessions.forEach((session) => {
        // Calculate duration from controllersHistory if available for more accuracy
        if (session.controllersHistory && Array.isArray(session.controllersHistory) && session.controllersHistory.length > 0) {
            session.controllersHistory.forEach((period) => {
                const periodStart = new Date(period.from).getTime();
                const periodEnd = period.to ? new Date(period.to).getTime() : (session.endTime ? new Date(session.endTime).getTime() : Date.now());
                const periodDurationMs = periodEnd - periodStart;
                totalDuration += periodDurationMs / (1000 * 60 * 60); // Convert to hours
            });
        } else if (session.startTime && session.endTime) {
            // Fallback to simple calculation
            const duration = new Date(session.endTime) - new Date(session.startTime);
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
        deviceStats[deviceType].revenue += (Number(session.finalCost) || 0);
        
        // Calculate duration from controllersHistory if available
        if (session.controllersHistory && Array.isArray(session.controllersHistory) && session.controllersHistory.length > 0) {
            session.controllersHistory.forEach((period) => {
                const periodStart = new Date(period.from).getTime();
                const periodEnd = period.to ? new Date(period.to).getTime() : (session.endTime ? new Date(session.endTime).getTime() : Date.now());
                const periodDurationMs = periodEnd - periodStart;
                deviceStats[deviceType].totalDuration += periodDurationMs / (1000 * 60 * 60);
            });
        } else if (session.startTime && session.endTime) {
            const duration = new Date(session.endTime) - new Date(session.startTime);
            deviceStats[deviceType].totalDuration += duration / (1000 * 60 * 60);
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
const getTopProductsBySection = async (organization, startDate, endDate, eligibleOrderIds = null) => {
    try {
        // Ensure organization is an ObjectId, not an object
        const organizationId = getOrganizationId(organization);
        const reportOrderIds = eligibleOrderIds || await getReportEligibleOrderIds(organizationId);
        
        // Get ALL orders in the date range (not just delivered)
        // Projection: only items are consumed below.
        const orders = await Order.find({
            createdAt: { $gte: startDate, $lte: endDate },
            isDeleted: false,
            organization: organizationId,
            _id: { $in: reportOrderIds }
        }).select('items').lean();


        // Get all menu items with their categories and sections
        const menuItems = await MenuItem.find({ organization: organizationId }).select('name category').populate({
            path: 'category',
            select: 'name section sortOrder',
            populate: {
                path: 'section',
                select: 'name sortOrder'
            }
        }).lean();

        // Create maps for legacy section lookup. Order item identity remains
        // based on the saved menu item id whenever it is available.
        const menuItemMap = {};
        const menuItemIdMap = {};
        menuItems.forEach(item => {
            menuItemMap[item.name] = item;
            menuItemIdMap[String(item._id)] = item;
        });

        const sectionData = {};

        // Process each order
        orders.forEach(order => {
            if (!order.items || !Array.isArray(order.items)) return;

            order.items.forEach(item => {
                if (!item.name) return;

                const menuItemId = item.menuItem?._id || item.menuItemId || item.menuItem;
                const menuItem = (menuItemId && menuItemIdMap[String(menuItemId)]) || menuItemMap[item.name];
                
                // Get section info
                let sectionId = 'other';
                let sectionName = 'أخرى';

                if (menuItem && menuItem.category) {
                    const category = menuItem.category;
                    if (category.section) {
                        const section = category.section;
                        sectionId = section._id ? section._id.toString() : 'other';
                        sectionName = section.name || 'أخرى';
                    }
                } else if (item.section) {
                    sectionId = String(item.section?._id || item.section);
                }

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

                // Calculate item total (variant-aware)
                const variant = item.variant || '';
                const key = `${menuItemId ? String(menuItemId) : item.name}|${variant}`;
                const variantText = variant && variant !== 'عادي' ? ` (${variant})` : '';
                const displayName = `${item.name}${variantText}`;
                const itemPrice = Number(item.price) || 0;
                const itemQuantity = Number(item.quantity) || 0;
                const itemTotal = Number(item.itemTotal) || (itemPrice * itemQuantity);

                // Initialize product if not exists (variant-aware key)
                if (!sectionData[sectionId].products[key]) {
                    sectionData[sectionId].products[key] = {
                        name: displayName,
                        quantity: 0,
                        revenue: 0
                    };
                }

                // Accumulate product data
                sectionData[sectionId].products[key].quantity += itemQuantity;
                sectionData[sectionId].products[key].revenue += itemTotal;
                sectionData[sectionId].totalRevenue += itemTotal;
                sectionData[sectionId].totalQuantity += itemQuantity;
            });
        });

        // Convert to array and sort products within each section
        const result = Object.values(sectionData).map(section => ({
            sectionId: section.sectionId,
            sectionName: section.sectionName,
            totalRevenue: section.totalRevenue,
            totalQuantity: section.totalQuantity,
            products: Object.values(section.products)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10)  // Top 10 products per section
        })).sort((a, b) => b.totalRevenue - a.totalRevenue);

     
        return result;
    } catch (error) {
        console.error('❌ Error in getTopProductsBySection:', error);
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
        // Ensure organization is an ObjectId, not an object
        const organizationId = getOrganizationId(organization);
        // Filter by endTime for completed sessions — only consumed fields.
        const sessions = await Session.find({
            endTime: { $gte: startDate, $lte: endDate },
            deviceType,
            status: 'completed',
            totalCost: { $gt: 0 },
                organization: organizationId
            }).select('finalCost deviceType deviceName deviceNumber controllers controllersHistory startTime endTime').lean();

        const totalSessions = sessions.length;
        const totalRevenue = sessions.reduce((sum, s) => sum + (Number(s.finalCost) || 0), 0);
        
        // Calculate total duration using controllersHistory if available
        const totalDuration = sessions.reduce((sum, s) => {
            if (s.controllersHistory && Array.isArray(s.controllersHistory) && s.controllersHistory.length > 0) {
                let sessionDuration = 0;
                s.controllersHistory.forEach((period) => {
                    const periodStart = new Date(period.from).getTime();
                    const periodEnd = period.to ? new Date(period.to).getTime() : (s.endTime ? new Date(s.endTime).getTime() : Date.now());
                    sessionDuration += (periodEnd - periodStart);
                });
                return sum + sessionDuration;
            } else if (s.startTime && s.endTime) {
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
            deviceStats[deviceName].revenue += Number(session.finalCost) || 0;
            
            // Calculate duration using controllersHistory if available
            if (session.controllersHistory && Array.isArray(session.controllersHistory) && session.controllersHistory.length > 0) {
                session.controllersHistory.forEach((period) => {
                    const periodStart = new Date(period.from).getTime();
                    const periodEnd = period.to ? new Date(period.to).getTime() : (session.endTime ? new Date(session.endTime).getTime() : Date.now());
                    deviceStats[deviceName].totalDuration += (periodEnd - periodStart);
                });
            } else if (session.startTime && session.endTime) {
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
                single: sessions.filter(s => s.controllers === 1).length,
                dual: sessions.filter(s => s.controllers === 2).length,
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
const getPeakHoursData = async (organization, startDate, endDate, eligibleOrderIds = null) => {
    try {
        // Ensure organization is an ObjectId, not an object
        const organizationId = getOrganizationId(organization);
        const reportOrderIds = eligibleOrderIds || await getReportEligibleOrderIds(organizationId);
        
        // Get ALL orders (not just specific statuses) — only consumed fields.
        const orders = await Order.find({
            createdAt: { $gte: startDate, $lte: endDate },
            isDeleted: false,
            organization: organizationId,
            _id: { $in: reportOrderIds }
        }).select('finalAmount createdAt').lean();

        // Get completed sessions - filter by endTime
        const sessions = await Session.find({
            endTime: { $gte: startDate, $lte: endDate },
            status: 'completed',
            totalCost: { $gt: 0 },
            organization: organizationId
        }).select('finalCost createdAt').lean();


        // Initialize hourly data (24 hours)
        const hourlyData = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            sales: 0,
            sessions: 0,
            revenue: 0
        }));

        // Process orders
        orders.forEach(order => {
            const hour = new Date(order.createdAt).getHours();
            hourlyData[hour].sales++;
            hourlyData[hour].revenue += Number(order.finalAmount) || 0;
        });

        // Process sessions
        sessions.forEach(session => {
            const hour = new Date(session.createdAt).getHours();
            hourlyData[hour].sessions++;
            hourlyData[hour].revenue += Number(session.finalCost) || 0;
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
        console.error('❌ Error in getPeakHoursData:', error);
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
const getStaffPerformanceData = async (organization, startDate, endDate, eligibleOrderIds = null) => {
    try {
        // Ensure organization is an ObjectId, not an object
        const organizationId = getOrganizationId(organization);
        const reportOrderIds = eligibleOrderIds || await getReportEligibleOrderIds(organizationId);
        
        // Get ALL orders (not just delivered) — only consumed fields.
        const orders = await Order.find({
            createdAt: { $gte: startDate, $lte: endDate },
            isDeleted: false,
            organization: organizationId,
            _id: { $in: reportOrderIds }
        }).select('finalAmount createdBy').populate('createdBy', 'name').lean();

        // Get completed sessions - filter by endTime
        const sessions = await Session.find({
            endTime: { $gte: startDate, $lte: endDate },
            status: 'completed',
            totalCost: { $gt: 0 },
            organization: organizationId
        }).select('finalCost createdBy').populate('createdBy', 'name').lean();


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
            staffStats[staffId].totalRevenue += Number(order.finalAmount) || 0;
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
            staffStats[staffId].totalRevenue += Number(session.finalCost) || 0;
        });

        // Calculate average order value and sort by total revenue
        const result = Object.values(staffStats)
            .map(staff => ({
                ...staff,
                avgOrderValue: staff.ordersCount > 0 ? (staff.totalRevenue / staff.ordersCount).toFixed(2) : 0
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue);


        return result;
    } catch (error) {
        console.error('❌ Error in getStaffPerformanceData:', error);
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

        // Compare average order value
        if (currentData.avgOrderValue !== undefined && previousData.avgOrderValue !== undefined) {
            comparison.avgOrderValue = {
                current: currentData.avgOrderValue,
                previous: previousData.avgOrderValue,
                ...calculateChange(currentData.avgOrderValue, previousData.avgOrderValue)
            };
        }

        return comparison;
    } catch (error) {
        throw error;
    }
};
