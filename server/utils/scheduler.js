import cron from "node-cron";
import Logger from "../middleware/logger.js";
import { createDatabaseBackup } from "./backup.js";
import {
    sendDailyReport,
    sendLowStockAlert,
    sendMonthlyReport,
} from "./email.js";
import InventoryItem from "../models/InventoryItem.js";
import User from "../models/User.js";
import Bill from "../models/Bill.js";
import Order from "../models/Order.js";
import Session from "../models/Session.js";
import Cost from "../models/Cost.js";
import NotificationService from "../services/notificationService.js";
import Subscription from "../models/Subscription.js";
import { sendSubscriptionNotification } from "../controllers/notificationController.js";
import Organization from "../models/Organization.js";
import { runCleanup } from "./notificationCleanup.js";

/**
 * إعداد الجدولة التلقائية لحذف الإشعارات القديمة
 */
const setupNotificationCleanupScheduler = () => {
    // تشغيل كل يوم في الساعة 2:00 صباحاً
    cron.schedule(
        "0 2 * * *",
        async () => {
            try {
                Logger.info("⏰ تشغيل جدولة تنظيف الإشعارات...");
                await runCleanup();
                Logger.info("✅ تم الانتهاء من جدولة تنظيف الإشعارات");
            } catch (error) {
                Logger.error("❌ خطأ في جدولة تنظيف الإشعارات:", error);
            }
        },
        {
            scheduled: true,
            timezone: "Africa/Cairo", // توقيت القاهرة
        }
    );

    Logger.info("✅ تم إعداد جدولة تنظيف الإشعارات (كل يوم في 2:00 صباحاً)");
};

/**
 * تشغيل تنظيف فوري (للتجربة)
 */
const runImmediateCleanup = async () => {
    try {
        Logger.info("🔄 تشغيل تنظيف فوري للإشعارات...");
        const deletedCount = await runCleanup();
        Logger.info(
            `✅ تم الانتهاء من التنظيف الفوري. المحذوف: ${deletedCount}`
        );
        return deletedCount;
    } catch (error) {
        Logger.error("❌ خطأ في التنظيف الفوري:", error);
        throw error;
    }
};

/**
 * إيقاف جميع الجداول
 */
const stopAllSchedulers = () => {
    cron.getTasks().forEach((task) => {
        task.stop();
    });
    Logger.info("⏹️ تم إيقاف جميع الجداول");
};

// Check for low stock items and send alerts
const checkLowStock = async () => {
    const startTime = new Date();
    Logger.info("🔄 Starting low stock check...", { startTime: startTime.toISOString() });
    
    try {
        // Get all active organizations
        const organizations = await Organization.find({ isActive: true });
        Logger.info(`Found ${organizations.length} active organizations to check`);

        let totalLowStockItems = 0;
        let totalAlertsSent = 0;

        for (const organization of organizations) {
            const orgStartTime = new Date();
            try {
                Logger.info(`Checking low stock for organization: ${organization.name}`, {
                    organizationId: organization._id,
                    startTime: orgStartTime.toISOString()
                });

                // Get low stock items for this organization
                const lowStockItems = await InventoryItem.find({
                    isActive: true,
                    organization: organization._id,
                    $expr: { 
                        $and: [
                            { $lte: ["$currentStock", "$minStock"] },
                            { $gt: ["$minStock", 0] } // Only include items with minStock > 0
                        ]
                    },
                }).lean();

                totalLowStockItems += lowStockItems.length;

                if (lowStockItems.length > 0) {
                    Logger.info(`Found ${lowStockItems.length} low stock items for ${organization.name}`, {
                        organizationId: organization._id,
                        itemNames: lowStockItems.map(item => item.name)
                    });

                    // Get admin emails for this organization
                    const admins = await User.find({
                        role: { $in: ["admin", "owner"] },
                        status: "active",
                        organization: organization._id,
                        email: { $exists: true, $ne: "" },
                        notifications: { $ne: false } // Only users who haven't disabled notifications
                    }).select("email name");

                    const adminEmails = admins.map(admin => admin.email);

                    if (adminEmails.length > 0) {
                        try {
                            await sendLowStockAlert({
                                items: lowStockItems,
                                organizationName: organization.name,
                                recipientEmails: adminEmails,
                                adminNames: admins.map(a => a.name)
                            });
                            
                            totalAlertsSent++;
                            Logger.info(`✅ Low stock alert sent successfully for ${organization.name}`, {
                                organizationId: organization._id,
                                recipientCount: adminEmails.length,
                                recipients: adminEmails
                            });
                        } catch (emailError) {
                            Logger.error(`Failed to send low stock alert for ${organization.name}`, {
                                organizationId: organization._id,
                                error: emailError.message,
                                stack: emailError.stack
                            });
                        }
                    } else {
                        Logger.warn(`No active admin emails found for organization: ${organization.name}`, {
                            organizationId: organization._id,
                            itemCount: lowStockItems.length
                        });
                    }
                }
            } catch (orgError) {
                Logger.error(`❌ Error processing organization ${organization?.name || 'Unknown'}`, {
                    organizationId: organization?._id,
                    error: orgError.message,
                    stack: orgError.stack,
                    duration: new Date() - orgStartTime
                });
            }
        }

        const endTime = new Date();
        const duration = endTime - startTime;
        
        Logger.info("✅ Low stock check completed", {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration: `${duration}ms`,
            organizationsChecked: organizations.length,
            totalLowStockItems,
            totalAlertsSent,
            success: true
        });

    } catch (error) {
        const endTime = new Date();
        const duration = endTime - startTime;
        
        Logger.error("❌ Critical error in low stock check", {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
            success: false
        });
    }
};

// Generate and send daily report
const generateDailyReport = async () => {
    try {
        Logger.info("Starting daily report generation...");

        const now = new Date();

        // Calculate the report period: from 5 AM yesterday to 5 AM today
        const endOfReport = new Date(now);
        endOfReport.setHours(5, 0, 0, 0); // Today at 5 AM
        
        // If it's before 5 AM today, adjust to yesterday's 5 AM
        if (now < endOfReport) {
            endOfReport.setDate(endOfReport.getDate() - 1);
        }
        
        const startOfReport = new Date(endOfReport);
        startOfReport.setDate(startOfReport.getDate() - 1); // Yesterday at 5 AM

        // Format dates for logging
        const formatForLog = (date) => {
            return {
                iso: date.toISOString(),
                local: date.toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }),
                date: date.toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo' }),
                time: date.toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo' })
            };
        };

        Logger.info("📅 Daily report period:", {
            currentTime: formatForLog(now),
            reportStart: formatForLog(startOfReport),
            reportEnd: formatForLog(endOfReport),
            timezone: 'Africa/Cairo (GMT+2)'
        });

        // Get all organizations
        const organizations = await Organization.find();

        Logger.info(
            `Found ${organizations.length} organizations for daily report`
        );

        for (const organization of organizations) {
            try {
                // Get daily statistics for this organization
                Logger.info(`Fetching data for organization: ${organization.name}`, {
                    startOfReport: startOfReport.toISOString(),
                    endOfReport: endOfReport.toISOString(),
                    organizationId: organization._id
                });

                const [bills, orders, sessions, costs] = await Promise.all([
                    Bill.find({
                        createdAt: { $gte: startOfReport, $lt: endOfReport },
                        status: { $in: ["partial", "paid"] },
                        organization: organization._id,
                    }),
                    Order.find({
                        createdAt: { $gte: startOfReport, $lt: endOfReport },
                        organization: organization._id,
                    }),
                    Session.find({
                        startTime: { $gte: startOfReport, $lt: endOfReport },
                        organization: organization._id,
                    }),
                    Cost.find({
                        date: { $gte: startOfReport, $lt: endOfReport },
                        organization: organization._id,
                    }),
                ]);

                // Calculate totals for this organization
                const totalRevenue = bills.reduce(
                    (sum, bill) => sum + bill.paid,
                    0
                );
                const totalCosts = costs.reduce(
                    (sum, cost) => sum + cost.amount,
                    0
                );

                // Get top products for this organization
                const topProducts = await Order.aggregate([
                    {
                        $match: {
                            createdAt: {
                                $gte: startOfReport,
                                $lt: endOfReport,
                            },
                            status: "delivered",
                            organization: organization._id,
                        },
                    },
                    { $unwind: "$items" },
                    {
                        $group: {
                            _id: "$items.name",
                            quantity: { $sum: "$items.quantity" },
                            revenue: {
                                $sum: {
                                    $multiply: [
                                        "$items.price",
                                        "$items.quantity",
                                    ],
                                },
                            },
                        },
                    },
                    { $sort: { quantity: -1 } },
                    { $limit: 5 },
                ]);

                // Log the data being used for the report
                Logger.info(`Data for organization ${organization.name}:`, {
                    billsCount: bills.length,
                    ordersCount: orders.length,
                    sessionsCount: sessions.length,
                    costsCount: costs.length,
                    totalRevenue,
                    totalCosts,
                    topProducts: topProducts.length
                });

                const reportData = {
                    date: startOfReport.toLocaleDateString("ar-EG"),
                    organizationName: organization.name,
                    totalRevenue: totalRevenue || 0,
                    totalCosts: totalCosts || 0,
                    netProfit: (totalRevenue || 0) - (totalCosts || 0),
                    totalBills: bills.length || 0,
                    totalOrders: orders.length || 0,
                    totalSessions: sessions.length || 0,
                    topProducts: topProducts.map((p) => ({
                        name: p._id,
                        quantity: p.quantity || 0,
                    })),
                    startOfReport: startOfReport,
                    endOfReport: endOfReport,
                    reportPeriod: `من 5:00 صباحاً يوم ${startOfReport.toLocaleDateString('ar-EG', {weekday: 'long', day: 'numeric', month: 'long'})} 
                                 إلى 5:00 صباحاً يوم ${endOfReport.toLocaleDateString('ar-EG', {weekday: 'long', day: 'numeric', month: 'long'})}`,
                };

                // Get admin emails for this organization
                const admins = await User.find({
                    role: "admin",
                    status: "active",
                    organization: organization._id,
                    email: { $exists: true, $ne: "" },
                }).select("email");

                const adminEmails = admins.map((admin) => admin.email);

                Logger.info(
                    `Organization "${organization.name}" has ${adminEmails.length} admin emails:`,
                    {
                        organizationId: organization._id,
                        adminEmails: adminEmails,
                    }
                );

                if (adminEmails.length > 0) {
                    await sendDailyReport(reportData, adminEmails);
                    Logger.info(
                        `Daily report sent for organization: ${organization.name}`,
                        {
                            organizationId: organization._id,
                            adminCount: adminEmails.length,
                            emails: adminEmails,
                        }
                    );
                } else {
                    Logger.warn(
                        `No admin emails found for organization: ${organization.name}`,
                        {
                            organizationId: organization._id,
                        }
                    );
                }
            } catch (orgError) {
                Logger.error(
                    `Failed to generate daily report for organization: ${organization.name}`,
                    {
                        organizationId: organization._id,
                        error: orgError.message,
                    }
                );
            }
        }

        Logger.info("Daily report generation completed for all organizations");
    } catch (error) {
        Logger.error("Failed to generate daily report", {
            error: error.message,
        });
    }
};

// Generate and send monthly report
const generateMonthlyReport = async () => {
    try {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0
        );

        // Get all organizations
        const organizations = await Organization.find();

        for (const organization of organizations) {
            try {
                // Get monthly statistics for this organization
                const [bills, orders, sessions, costs] = await Promise.all([
                    Bill.find({
                        createdAt: {
                            $gte: firstDayOfMonth,
                            $lte: lastDayOfMonth,
                        },
                        status: { $in: ["partial", "paid"] },
                        organization: organization._id,
                    }),
                    Order.find({
                        createdAt: {
                            $gte: firstDayOfMonth,
                            $lte: lastDayOfMonth,
                        },
                        organization: organization._id,
                    }),
                    Session.find({
                        startTime: {
                            $gte: firstDayOfMonth,
                            $lte: lastDayOfMonth,
                        },
                        organization: organization._id,
                    }),
                    Cost.find({
                        date: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
                        organization: organization._id,
                    }),
                ]);

                // Calculate totals for this organization
                const totalRevenue = bills.reduce(
                    (sum, bill) => sum + bill.paid,
                    0
                );
                const totalCosts = costs.reduce(
                    (sum, cost) => sum + cost.amount,
                    0
                );

                // Get top products for this month
                const topProducts = await Order.aggregate([
                    {
                        $match: {
                            createdAt: {
                                $gte: firstDayOfMonth,
                                $lte: lastDayOfMonth,
                            },
                            status: "delivered",
                            organization: organization._id,
                        },
                    },
                    { $unwind: "$items" },
                    {
                        $group: {
                            _id: "$items.name",
                            quantity: { $sum: "$items.quantity" },
                            revenue: {
                                $sum: {
                                    $multiply: [
                                        "$items.price",
                                        "$items.quantity",
                                    ],
                                },
                            },
                        },
                    },
                    { $sort: { quantity: -1 } },
                    { $limit: 10 },
                ]);

                // Get daily revenue breakdown
                const dailyRevenue = await Bill.aggregate([
                    {
                        $match: {
                            createdAt: {
                                $gte: firstDayOfMonth,
                                $lte: lastDayOfMonth,
                            },
                            status: { $in: ["partial", "paid"] },
                            organization: organization._id,
                        },
                    },
                    {
                        $group: {
                            _id: {
                                $dateToString: {
                                    format: "%Y-%m-%d",
                                    date: "$createdAt",
                                },
                            },
                            revenue: { $sum: "$paid" },
                            bills: { $sum: 1 },
                        },
                    },
                    { $sort: { _id: 1 } },
                ]);

                // Get device usage statistics
                const deviceStats = await Session.aggregate([
                    {
                        $match: {
                            startTime: {
                                $gte: firstDayOfMonth,
                                $lte: lastDayOfMonth,
                            },
                            organization: organization._id,
                        },
                    },
                    {
                        $group: {
                            _id: "$deviceType",
                            totalSessions: { $sum: 1 },
                            totalRevenue: { $sum: "$finalCost" },
                            avgDuration: {
                                $avg: { $subtract: ["$endTime", "$startTime"] },
                            },
                        },
                    },
                ]);

                const reportData = {
                    month: now.toLocaleDateString("ar-EG", {
                        month: "long",
                        year: "numeric",
                    }),
                    organizationName: organization.name,
                    totalRevenue,
                    totalCosts,
                    netProfit: totalRevenue - totalCosts,
                    profitMargin:
                        totalRevenue > 0
                            ? ((totalRevenue - totalCosts) / totalRevenue) * 100
                            : 0,
                    totalBills: bills.length,
                    totalOrders: orders.length,
                    totalSessions: sessions.length,
                    topProducts: topProducts.map((p) => ({
                        name: p._id,
                        quantity: p.quantity,
                        revenue: p.revenue,
                    })),
                    dailyRevenue,
                    deviceStats,
                    avgDailyRevenue:
                        dailyRevenue.length > 0
                            ? totalRevenue / dailyRevenue.length
                            : 0,
                    bestDay:
                        dailyRevenue.length > 0
                            ? dailyRevenue.reduce((best, current) =>
                                  current.revenue > best.revenue
                                      ? current
                                      : best
                              )
                            : null,
                };

                // Get admin emails for this organization
                const admins = await User.find({
                    role: "admin",
                    status: "active",
                    organization: organization._id,
                    email: { $exists: true, $ne: "" },
                }).select("email");

                const adminEmails = admins.map((admin) => admin.email);

                if (adminEmails.length > 0) {
                    await sendMonthlyReport(reportData, adminEmails);
                    Logger.info(
                        `Monthly report sent for organization: ${organization.name}`,
                        {
                            organizationId: organization._id,
                            adminCount: adminEmails.length,
                            emails: adminEmails,
                            month: reportData.month,
                        }
                    );
                } else {
                    Logger.warn(
                        `No admin emails found for organization: ${organization.name}`,
                        {
                            organizationId: organization._id,
                            month: reportData.month,
                        }
                    );
                }
            } catch (orgError) {
                Logger.error(
                    `Failed to generate monthly report for organization: ${organization.name}`,
                    {
                        organizationId: organization._id,
                        error: orgError.message,
                    }
                );
            }
        }
    } catch (error) {
        Logger.error("Failed to generate monthly report", {
            error: error.message,
        });
    }
};

// Update overdue bills and costs
const updateOverdueItems = async () => {
    try {
        const now = new Date();

        // Get all organizations
        const organizations = await Organization.find();

        for (const organization of organizations) {
            try {
                // Update overdue bills for this organization
                const overdueBills = await Bill.updateMany(
                    {
                        dueDate: { $lt: now },
                        status: { $in: ["draft", "partial"] },
                        organization: organization._id,
                    },
                    { status: "overdue" }
                );

                // Update overdue costs for this organization
                const overdueCosts = await Cost.updateMany(
                    {
                        dueDate: { $lt: now },
                        status: "pending",
                        organization: organization._id,
                    },
                    { status: "overdue" }
                );

                if (
                    overdueBills.modifiedCount > 0 ||
                    overdueCosts.modifiedCount > 0
                ) {
                    Logger.info(
                        `Updated overdue items for organization: ${organization.name}`,
                        {
                            organizationId: organization._id,
                            overdueBills: overdueBills.modifiedCount,
                            overdueCosts: overdueCosts.modifiedCount,
                        }
                    );
                }
            } catch (orgError) {
                Logger.error(
                    `Failed to update overdue items for organization: ${organization.name}`,
                    {
                        organizationId: organization._id,
                        error: orgError.message,
                    }
                );
            }
        }
    } catch (error) {
        Logger.error("Failed to update overdue items", {
            error: error.message,
        });
    }
};

// Create recurring costs
const createRecurringCosts = async () => {
    try {
        const now = new Date();

        // Get all organizations
        const organizations = await Organization.find();

        for (const organization of organizations) {
            try {
                const recurringCosts = await Cost.find({
                    isRecurring: true,
                    nextDueDate: { $lte: now },
                    organization: organization._id,
                });

                for (const cost of recurringCosts) {
                    // Create new cost entry
                    const newCost = new Cost({
                        category: cost.category,
                        subcategory: cost.subcategory,
                        description: cost.description,
                        amount: cost.amount,
                        currency: cost.currency,
                        date: now,
                        dueDate: cost.nextDueDate,
                        status: "pending",
                        paymentMethod: cost.paymentMethod,
                        vendor: cost.vendor,
                        vendorContact: cost.vendorContact,
                        isRecurring: false, // New entry is not recurring
                        tags: cost.tags,
                        notes: `تكلفة متكررة من: ${cost._id}`,
                        createdBy: cost.createdBy,
                        organization: organization._id,
                    });

                    await newCost.save();

                    // Update next due date for original recurring cost
                    cost.calculateNextDueDate();
                    await cost.save();
                }

                if (recurringCosts.length > 0) {
                    Logger.info(
                        `Created ${recurringCosts.length} recurring costs for organization: ${organization.name}`,
                        {
                            organizationId: organization._id,
                            costCount: recurringCosts.length,
                        }
                    );
                }
            } catch (orgError) {
                Logger.error(
                    `Failed to create recurring costs for organization: ${organization.name}`,
                    {
                        organizationId: organization._id,
                        error: orgError.message,
                    }
                );
            }
        }
    } catch (error) {
        Logger.error("Failed to create recurring costs", {
            error: error.message,
        });
    }
};

export const scheduleSubscriptionExpiryNotifications = () => {
    setInterval(async () => {
        const now = new Date();
        const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // بعد 3 أيام
        // جلب الاشتراكات التي ستنتهي خلال 3 أيام ولم يتم إرسال إشعار لها
        const expiring = await Subscription.find({
            status: "active",
            endDate: { $gte: now, $lte: soon },
        });
        for (const sub of expiring) {
            const orgOwner = await User.findOne({
                organization: sub.organization,
                role: "owner",
            });
            if (orgOwner) {
                await sendSubscriptionNotification(
                    orgOwner._id,
                    "تنبيه: اشتراك منشأتك سينتهي خلال 3 أيام. يرجى التجديد لتجنب توقف الخدمة."
                );
            }
        }
    }, 24 * 60 * 60 * 1000); // كل 24 ساعة
};

// Initialize all scheduled tasks
export const initializeScheduler = () => {
    Logger.info("Initializing scheduled tasks...");

    // Check low stock every 6 hours at minute 0
    cron.schedule("0 */6 * * *", checkLowStock);
    Logger.info("✅ Low stock check scheduled: every 6 hours at minute 0");

    // Generate daily report at 5:00 AM (Egypt time)
    cron.schedule("0 5 * * *", () => {
        const now = new Date();
        Logger.info(
            "🕐 Daily report scheduled task triggered at 5:00 AM (Egypt time)",
            {
                currentTime: now.toLocaleString("ar-EG"),
                egyptTime: now.toLocaleString("ar-EG", {
                    timeZone: "Africa/Cairo",
                }),
            }
        );
        generateDailyReport();
    });
    Logger.info("✅ Daily report scheduled: every day at 5:00 AM (Egypt time)");

    // For testing: also run daily report every hour (only in development)
    // if (process.env.NODE_ENV === "development") {
    //     cron.schedule("0 * * * *", () => {
    //         Logger.info(
    //             "🧪 Development mode: Running daily report every hour for testing"
    //         );
    //         generateDailyReport();
    //     });
    //     Logger.info(
    //         "✅ Development mode: Daily report also scheduled every hour for testing"
    //     );
    // }

    // Generate monthly report at 11:59 PM on the last day of the month
    cron.schedule("59 23 28-31 * *", () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (tomorrow.getDate() === 1) {
            Logger.info("📅 Monthly report scheduled task triggered");
            generateMonthlyReport();
        }
    });
    Logger.info("✅ Monthly report scheduled: last day of month at 11:59 PM");

    // Update overdue items every 6 hours
    cron.schedule("0 */6 * * *", updateOverdueItems);
    Logger.info("✅ Overdue items update scheduled: every 6 hours");

    // Create recurring costs daily at midnight
    cron.schedule("0 0 * * *", createRecurringCosts);
    Logger.info("✅ Recurring costs creation scheduled: daily at midnight");

    // Create database backup weekly on Sunday at 2 AM
    cron.schedule("0 2 * * 0", async () => {
        try {
            Logger.info("💾 Database backup scheduled task triggered");
            await createDatabaseBackup();
        } catch (error) {
            Logger.error("Scheduled backup failed", { error: error.message });
        }
    });
    Logger.info("✅ Database backup scheduled: weekly on Sunday at 2 AM");

    // Clean expired notifications daily at 3 AM
    cron.schedule("0 3 * * *", async () => {
        try {
            Logger.info(
                "🧹 Expired notifications cleanup scheduled task triggered"
            );
            await NotificationService.cleanExpiredNotifications();
        } catch (error) {
            Logger.error("❌ Failed to clean expired notifications:", error);
        }
    });
    Logger.info("✅ Expired notifications cleanup scheduled: daily at 3 AM");

    // Schedule subscription expiry notifications
    scheduleSubscriptionExpiryNotifications();
    Logger.info(
        "✅ Subscription expiry notifications scheduled: every 24 hours"
    );

    // إضافة جدولة تنظيف الإشعارات القديمة
    setupNotificationCleanupScheduler();
    Logger.info("✅ Notification cleanup scheduler initialized");

    Logger.info("🎯 All scheduled tasks initialized successfully!");
};
