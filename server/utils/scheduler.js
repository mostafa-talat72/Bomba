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

        // Get all organizations with daily reports enabled
        const organizations = await Organization.find({
            'reportSettings.dailyReportEnabled': { $ne: false }
        });

        Logger.info(
            `Found ${organizations.length} organizations for daily report`
        );

        for (const organization of organizations) {
            await generateDailyReportForOrganization(organization);
        }

        Logger.info("Daily report generation completed for all organizations");
    } catch (error) {
        Logger.error("Failed to generate daily report", {
            error: error.message,
        });
    }
};

// Generate and send daily report for a specific organization
const generateDailyReportForOrganization = async (organization) => {
    try {
        // Check if daily report is enabled for this organization
        if (organization.reportSettings?.dailyReportEnabled === false) {
            Logger.info(`Daily report disabled for organization: ${organization.name}`);
            return;
        }

        const now = new Date();

        // Get the configured start time for this organization (default: 08:00)
        const startTimeStr = organization.reportSettings?.dailyReportStartTime || "08:00";
        const [startHour, startMinute] = startTimeStr.split(':').map(Number);

        // Calculate the report period based on organization's configured time
        const endOfReport = new Date(now);
        endOfReport.setHours(startHour, startMinute || 0, 0, 0);
        
        // If current time is before the configured time today, use yesterday's time
        if (now < endOfReport) {
            endOfReport.setDate(endOfReport.getDate() - 1);
        }
        
        const startOfReport = new Date(endOfReport);
        startOfReport.setDate(startOfReport.getDate() - 1); // 24 hours before

        // Format dates for logging
        const formatForLog = (date) => {
            return {
                iso: date.toISOString(),
                local: date.toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }),
                date: date.toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo' }),
                time: date.toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo' })
            };
        };

        Logger.info(`📅 Daily report period for ${organization.name}:`, {
            configuredStartTime: startTimeStr,
            currentTime: formatForLog(now),
            reportStart: formatForLog(startOfReport),
            reportEnd: formatForLog(endOfReport),
            timezone: 'Africa/Cairo (GMT+2)'
        });

        // Get emails from organization settings
        const reportEmails = organization.reportSettings?.dailyReportEmails || [];
        
        if (reportEmails.length === 0) {
            Logger.warn(
                `No report emails configured for organization: ${organization.name}`,
                {
                    organizationId: organization._id,
                }
            );
            return;
        }

        Logger.info(`Fetching data for organization: ${organization.name}`, {
            startOfReport: startOfReport.toISOString(),
            endOfReport: endOfReport.toISOString(),
            organizationId: organization._id,
            reportEmails: reportEmails
        });

        // Import required modules
        const { default: MenuItem } = await import('../models/MenuItem.js');
        const { generateDailyReportPDF } = await import('./pdfGenerator.js');

        const [orders, sessions, costs] = await Promise.all([
            Order.find({
                createdAt: { $gte: startOfReport, $lt: endOfReport },
                organization: organization._id,
            }).lean(),
            Session.find({
                createdAt: { $gte: startOfReport, $lt: endOfReport },
                status: "completed",
                organization: organization._id,
            }).lean(),
            Cost.find({
                date: { $gte: startOfReport, $lt: endOfReport },
                organization: organization._id,
            }).lean(),
        ]);

        // Calculate revenues
        const cafeRevenue = orders.reduce((sum, order) => sum + (Number(order.finalAmount) || 0), 0);
        
        const playstationSessions = sessions.filter(s => s.deviceType === "playstation");
        const computerSessions = sessions.filter(s => s.deviceType === "computer");
        
        const playstationRevenue = playstationSessions.reduce((sum, s) => sum + (Number(s.finalCost) || 0), 0);
        const computerRevenue = computerSessions.reduce((sum, s) => sum + (Number(s.finalCost) || 0), 0);
        
        const totalRevenue = cafeRevenue + playstationRevenue + computerRevenue;
        const totalCosts = costs.reduce((sum, cost) => sum + (Number(cost.paidAmount) || Number(cost.amount) || 0), 0);
        const netProfit = totalRevenue - totalCosts;

        // Get top products
        const productSales = {};
        orders.forEach((order) => {
            if (!order.items || !Array.isArray(order.items)) return;
            
            order.items.forEach((item) => {
                if (!item.name) return;
                
                if (!productSales[item.name]) {
                    productSales[item.name] = { quantity: 0, revenue: 0 };
                }
                
                const itemQuantity = Number(item.quantity) || 0;
                const itemPrice = Number(item.price) || 0;
                const itemTotal = item.itemTotal || (itemPrice * itemQuantity);
                
                productSales[item.name].quantity += itemQuantity;
                productSales[item.name].revenue += itemTotal;
            });
        });

        const topProducts = Object.entries(productSales)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        // Get top products by section
        const menuItems = await MenuItem.find({ organization: organization._id }).populate({
            path: 'category',
            populate: {
                path: 'section'
            }
        }).lean();

        const menuItemMap = {};
        menuItems.forEach(item => {
            menuItemMap[item.name] = item;
        });

        const sectionData = {};
        orders.forEach(order => {
            if (!order.items || !Array.isArray(order.items)) return;

            order.items.forEach(item => {
                if (!item.name) return;

                const menuItem = menuItemMap[item.name];
                let sectionId = 'other';
                let sectionName = 'أخرى';

                if (menuItem && menuItem.category && menuItem.category.section) {
                    const section = menuItem.category.section;
                    sectionId = section._id ? section._id.toString() : 'other';
                    sectionName = section.name || 'أخرى';
                }

                if (!sectionData[sectionId]) {
                    sectionData[sectionId] = {
                        sectionId,
                        sectionName,
                        products: {},
                        totalRevenue: 0,
                        totalQuantity: 0
                    };
                }

                const itemPrice = Number(item.price) || 0;
                const itemQuantity = Number(item.quantity) || 0;
                const itemTotal = item.itemTotal || (itemPrice * itemQuantity);

                if (!sectionData[sectionId].products[item.name]) {
                    sectionData[sectionId].products[item.name] = {
                        name: item.name,
                        quantity: 0,
                        revenue: 0
                    };
                }

                sectionData[sectionId].products[item.name].quantity += itemQuantity;
                sectionData[sectionId].products[item.name].revenue += itemTotal;
                sectionData[sectionId].totalRevenue += itemTotal;
                sectionData[sectionId].totalQuantity += itemQuantity;
            });
        });

        const topProductsBySection = Object.values(sectionData).map(section => ({
            sectionId: section.sectionId,
            sectionName: section.sectionName,
            totalRevenue: section.totalRevenue,
            totalQuantity: section.totalQuantity,
            products: Object.values(section.products)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10)
        })).sort((a, b) => b.totalRevenue - a.totalRevenue);

        const reportData = {
            date: startOfReport.toLocaleDateString("ar-EG"),
            organizationName: organization.name,
            totalRevenue: totalRevenue || 0,
            totalCosts: totalCosts || 0,
            netProfit: netProfit || 0,
            totalBills: orders.length + sessions.length,
            totalOrders: orders.length || 0,
            totalSessions: sessions.length || 0,
            topProducts: topProducts,
            topProductsBySection: topProductsBySection,
            revenueByType: {
                playstation: playstationRevenue || 0,
                computer: computerRevenue || 0,
                cafe: cafeRevenue || 0
            },
            startOfReport: startOfReport,
            endOfReport: endOfReport,
            reportPeriod: `من ${startTimeStr} يوم ${startOfReport.toLocaleDateString('ar-EG', {weekday: 'long', day: 'numeric', month: 'long'})} 
                         إلى ${startTimeStr} يوم ${endOfReport.toLocaleDateString('ar-EG', {weekday: 'long', day: 'numeric', month: 'long'})}`,
        };

        Logger.info(`Organization "${organization.name}" - Report data summary:`, {
            organizationId: organization._id,
            totalRevenue: reportData.totalRevenue,
            totalOrders: reportData.totalOrders,
            totalSessions: reportData.totalSessions,
            netProfit: reportData.netProfit,
            topProductsCount: reportData.topProducts.length,
            sectionsCount: reportData.topProductsBySection.length
        });

        // Generate PDF
        const pdfBuffer = await generateDailyReportPDF(reportData);

        // Send report via email with PDF attachment
        await sendDailyReport(reportData, reportEmails, pdfBuffer);
        
        // Update lastReportSentAt timestamp
        organization.reportSettings.lastReportSentAt = new Date();
        await organization.save();
        
        Logger.info(
            `Daily report sent for organization: ${organization.name}`,
            {
                organizationId: organization._id,
                emailCount: reportEmails.length,
                emails: reportEmails,
                sentAt: organization.reportSettings.lastReportSentAt
            }
        );
    } catch (error) {
        Logger.error(
            `Failed to generate daily report for organization: ${organization.name}`,
            {
                organizationId: organization._id,
                error: error.message,
                stack: error.stack
            }
        );
    }
};

// Generate and send monthly report
const generateMonthlyReport = async () => {
    try {
        Logger.info("Starting monthly report generation...");

        // Get all organizations with daily reports enabled (monthly uses same settings)
        const organizations = await Organization.find({
            'reportSettings.dailyReportEnabled': { $ne: false }
        });

        Logger.info(
            `Found ${organizations.length} organizations for monthly report`
        );

        for (const organization of organizations) {
            await generateMonthlyReportForOrganization(organization);
        }

        Logger.info("Monthly report generation completed for all organizations");
    } catch (error) {
        Logger.error("Failed to generate monthly report", {
            error: error.message,
        });
    }
};

// Generate and send monthly report for a specific organization
const generateMonthlyReportForOrganization = async (organization) => {
    try {
        // Check if daily report is enabled for this organization
        if (organization.reportSettings?.dailyReportEnabled === false) {
            Logger.info(`Reports disabled for organization: ${organization.name}`);
            return;
        }

        const now = new Date();

        // Get the configured start time for this organization (default: 08:00)
        const startTimeStr = organization.reportSettings?.dailyReportStartTime || "08:00";
        const [startHour, startMinute] = startTimeStr.split(':').map(Number);

        // Calculate the monthly report period based on organization's configured time
        // End: First day of current month at configured time
        const endOfReport = new Date(now.getFullYear(), now.getMonth(), 1);
        endOfReport.setHours(startHour, startMinute || 0, 0, 0);
        
        // If we haven't reached the configured time on the 1st yet, use last month
        if (now < endOfReport) {
            endOfReport.setMonth(endOfReport.getMonth() - 1);
        }
        
        // Start: First day of previous month at configured time
        const startOfReport = new Date(endOfReport);
        startOfReport.setMonth(startOfReport.getMonth() - 1);

        // Format dates for logging
        const formatForLog = (date) => {
            return {
                iso: date.toISOString(),
                local: date.toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }),
                date: date.toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo' }),
                time: date.toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo' })
            };
        };

        Logger.info(`📅 Monthly report period for ${organization.name}:`, {
            configuredStartTime: startTimeStr,
            currentTime: formatForLog(now),
            reportStart: formatForLog(startOfReport),
            reportEnd: formatForLog(endOfReport),
            timezone: 'Africa/Cairo (GMT+2)'
        });

        // Get emails from organization settings (same as daily report)
        const reportEmails = organization.reportSettings?.dailyReportEmails || [];
        
        if (reportEmails.length === 0) {
            Logger.warn(
                `No report emails configured for organization: ${organization.name}`,
                {
                    organizationId: organization._id,
                }
            );
            return;
        }

        Logger.info(`Fetching monthly data for organization: ${organization.name}`, {
            startOfReport: startOfReport.toISOString(),
            endOfReport: endOfReport.toISOString(),
            organizationId: organization._id,
            reportEmails: reportEmails
        });

        // Import required modules
        const { default: MenuItem } = await import('../models/MenuItem.js');

        const [orders, sessions, costs] = await Promise.all([
            Order.find({
                createdAt: { $gte: startOfReport, $lt: endOfReport },
                organization: organization._id,
            }).lean(),
            Session.find({
                createdAt: { $gte: startOfReport, $lt: endOfReport },
                status: "completed",
                organization: organization._id,
            }).lean(),
            Cost.find({
                date: { $gte: startOfReport, $lt: endOfReport },
                organization: organization._id,
            }).lean(),
        ]);

        // Calculate revenues
        const cafeRevenue = orders.reduce((sum, order) => sum + (Number(order.finalAmount) || 0), 0);
        
        const playstationSessions = sessions.filter(s => s.deviceType === "playstation");
        const computerSessions = sessions.filter(s => s.deviceType === "computer");
        
        const playstationRevenue = playstationSessions.reduce((sum, s) => sum + (Number(s.finalCost) || 0), 0);
        const computerRevenue = computerSessions.reduce((sum, s) => sum + (Number(s.finalCost) || 0), 0);
        
        const totalRevenue = cafeRevenue + playstationRevenue + computerRevenue;
        const totalCosts = costs.reduce((sum, cost) => sum + (Number(cost.paidAmount) || Number(cost.amount) || 0), 0);
        const netProfit = totalRevenue - totalCosts;

        // Get top products
        const productSales = {};
        orders.forEach((order) => {
            if (!order.items || !Array.isArray(order.items)) return;
            
            order.items.forEach((item) => {
                if (!item.name) return;
                
                if (!productSales[item.name]) {
                    productSales[item.name] = { quantity: 0, revenue: 0 };
                }
                
                const itemQuantity = Number(item.quantity) || 0;
                const itemPrice = Number(item.price) || 0;
                const itemTotal = item.itemTotal || (itemPrice * itemQuantity);
                
                productSales[item.name].quantity += itemQuantity;
                productSales[item.name].revenue += itemTotal;
            });
        });

        const topProducts = Object.entries(productSales)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        // Get top products by section
        const menuItems = await MenuItem.find({ organization: organization._id }).populate({
            path: 'category',
            populate: {
                path: 'section'
            }
        }).lean();

        const menuItemMap = {};
        menuItems.forEach(item => {
            menuItemMap[item.name] = item;
        });

        const sectionData = {};
        orders.forEach(order => {
            if (!order.items || !Array.isArray(order.items)) return;

            order.items.forEach(item => {
                if (!item.name) return;

                const menuItem = menuItemMap[item.name];
                let sectionId = 'other';
                let sectionName = 'أخرى';

                if (menuItem && menuItem.category && menuItem.category.section) {
                    const section = menuItem.category.section;
                    sectionId = section._id ? section._id.toString() : 'other';
                    sectionName = section.name || 'أخرى';
                }

                if (!sectionData[sectionId]) {
                    sectionData[sectionId] = {
                        sectionId,
                        sectionName,
                        products: {},
                        totalRevenue: 0,
                        totalQuantity: 0
                    };
                }

                const itemPrice = Number(item.price) || 0;
                const itemQuantity = Number(item.quantity) || 0;
                const itemTotal = item.itemTotal || (itemPrice * itemQuantity);

                if (!sectionData[sectionId].products[item.name]) {
                    sectionData[sectionId].products[item.name] = {
                        name: item.name,
                        quantity: 0,
                        revenue: 0
                    };
                }

                sectionData[sectionId].products[item.name].quantity += itemQuantity;
                sectionData[sectionId].products[item.name].revenue += itemTotal;
                sectionData[sectionId].totalRevenue += itemTotal;
                sectionData[sectionId].totalQuantity += itemQuantity;
            });
        });

        const topProductsBySection = Object.values(sectionData).map(section => ({
            sectionId: section.sectionId,
            sectionName: section.sectionName,
            totalRevenue: section.totalRevenue,
            totalQuantity: section.totalQuantity,
            products: Object.values(section.products)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10)
        })).sort((a, b) => b.totalRevenue - a.totalRevenue);

        // Calculate daily averages
        const daysInPeriod = Math.ceil((endOfReport - startOfReport) / (1000 * 60 * 60 * 24));
        const avgDailyRevenue = daysInPeriod > 0 ? totalRevenue / daysInPeriod : 0;

        const reportData = {
            month: startOfReport.toLocaleDateString("ar-EG", { month: "long", year: "numeric" }),
            organizationName: organization.name,
            totalRevenue: totalRevenue || 0,
            totalCosts: totalCosts || 0,
            netProfit: netProfit || 0,
            profitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0,
            totalBills: orders.length + sessions.length,
            totalOrders: orders.length || 0,
            totalSessions: sessions.length || 0,
            topProducts: topProducts,
            topProductsBySection: topProductsBySection,
            revenueByType: {
                playstation: playstationRevenue || 0,
                computer: computerRevenue || 0,
                cafe: cafeRevenue || 0
            },
            avgDailyRevenue: avgDailyRevenue || 0,
            daysInPeriod: daysInPeriod,
            startOfReport: startOfReport,
            endOfReport: endOfReport,
            reportPeriod: `من ${startTimeStr} يوم ${startOfReport.toLocaleDateString('ar-EG', {day: 'numeric', month: 'long', year: 'numeric'})} 
                         إلى ${startTimeStr} يوم ${endOfReport.toLocaleDateString('ar-EG', {day: 'numeric', month: 'long', year: 'numeric'})}`,
        };

        Logger.info(`Organization "${organization.name}" - Monthly report data summary:`, {
            organizationId: organization._id,
            totalRevenue: reportData.totalRevenue,
            totalOrders: reportData.totalOrders,
            totalSessions: reportData.totalSessions,
            netProfit: reportData.netProfit,
            daysInPeriod: reportData.daysInPeriod,
            avgDailyRevenue: reportData.avgDailyRevenue
        });

        // Send report via email (reuse sendMonthlyReport function)
        await sendMonthlyReport(reportData, reportEmails);
        
        Logger.info(
            `Monthly report sent for organization: ${organization.name}`,
            {
                organizationId: organization._id,
                emailCount: reportEmails.length,
                emails: reportEmails,
                month: reportData.month
            }
        );
    } catch (error) {
        Logger.error(
            `Failed to generate monthly report for organization: ${organization.name}`,
            {
                organizationId: organization._id,
                error: error.message,
                stack: error.stack
            }
        );
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
                    sub.organization,
                    orgOwner._id,
                    "تنبيه: اشتراك منشأتك سينتهي خلال 3 أيام. يرجى التجديد لتجنب توقف الخدمة."
                );
            }
        }
    }, 24 * 60 * 60 * 1000); // كل 24 ساعة
};

// Store scheduled tasks for each organization
const scheduledReportTasks = new Map();
const scheduledMonthlyReportTasks = new Map();

// Schedule daily report for a specific organization
const scheduleDailyReportForOrganization = (organization) => {
    try {
        const sendTimeStr = organization.reportSettings?.dailyReportSendTime || "09:00";
        const [hour, minute] = sendTimeStr.split(':').map(Number);
        
        // Create cron pattern for this specific time
        // Format: "minute hour * * *" (every day at specified time)
        const cronPattern = `${minute} ${hour} * * *`;
        
        // Cancel existing task if any
        const existingTask = scheduledReportTasks.get(organization._id.toString());
        if (existingTask) {
            existingTask.stop();
        }
        
        // Schedule new task
        const task = cron.schedule(cronPattern, async () => {
            Logger.info(
                `⏰ Scheduled time reached for organization: ${organization.name}`,
                {
                    organizationId: organization._id,
                    scheduledTime: sendTimeStr,
                    currentTime: new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })
                }
            );
            
            await generateDailyReportForOrganization(organization);
        }, {
            scheduled: true,
            timezone: "Africa/Cairo"
        });
        
        scheduledReportTasks.set(organization._id.toString(), task);
        
        Logger.info(
            `✅ Scheduled daily report for organization: ${organization.name} at ${sendTimeStr}`,
            {
                organizationId: organization._id,
                cronPattern: cronPattern
            }
        );
    } catch (error) {
        Logger.error(
            `Failed to schedule report for organization: ${organization.name}`,
            {
                organizationId: organization._id,
                error: error.message
            }
        );
    }
};

// Initialize all organization report schedules
const initializeOrganizationReportSchedules = async () => {
    try {
        Logger.info("📅 Initializing organization report schedules...");
        
        // Get all organizations with daily reports enabled
        const organizations = await Organization.find({
            'reportSettings.dailyReportEnabled': { $ne: false }
        });
        
        Logger.info(`Found ${organizations.length} organizations with reports enabled`);
        
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour * 60 + currentMinute; // Convert to minutes since midnight
        
        let missedCount = 0;
        
        // Schedule report for each organization
        for (const organization of organizations) {
            if (organization.reportSettings?.dailyReportEnabled !== false) {
                // Schedule for future
                scheduleDailyReportForOrganization(organization);
                
                // Check if we missed today's report
                const sendTimeStr = organization.reportSettings?.dailyReportSendTime || "09:00";
                const [sendHour, sendMinute] = sendTimeStr.split(':').map(Number);
                const sendTime = sendHour * 60 + sendMinute; // Convert to minutes since midnight
                
                // Check if report was already sent today
                const lastSent = organization.reportSettings?.lastReportSentAt;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const alreadySentToday = lastSent && new Date(lastSent) >= today;
                
                // If scheduled time has passed today AND report wasn't sent yet, send it now
                if (currentTime > sendTime && !alreadySentToday) {
                    Logger.info(
                        `⚠️ Missed report time for organization: ${organization.name}. Sending now...`,
                        {
                            organizationId: organization._id,
                            scheduledTime: sendTimeStr,
                            currentTime: `${currentHour}:${String(currentMinute).padStart(2, '0')}`,
                            missedBy: `${Math.floor((currentTime - sendTime) / 60)}h ${(currentTime - sendTime) % 60}m`,
                            lastSentAt: lastSent ? lastSent.toLocaleString('ar-EG') : 'never'
                        }
                    );
                    
                    // Send the report immediately (don't await to avoid blocking)
                    generateDailyReportForOrganization(organization).catch(error => {
                        Logger.error(
                            `Failed to send missed report for organization: ${organization.name}`,
                            {
                                organizationId: organization._id,
                                error: error.message
                            }
                        );
                    });
                    
                    missedCount++;
                } else if (alreadySentToday) {
                    Logger.info(
                        `✅ Report already sent today for organization: ${organization.name}`,
                        {
                            organizationId: organization._id,
                            sentAt: lastSent.toLocaleString('ar-EG')
                        }
                    );
                }
            }
        }
        
        Logger.info(
            `✅ Initialized ${scheduledReportTasks.size} report schedules`,
            {
                totalOrganizations: organizations.length,
                scheduledTasks: scheduledReportTasks.size,
                missedReports: missedCount
            }
        );
        
        if (missedCount > 0) {
            Logger.info(`📧 Sending ${missedCount} missed reports...`);
        }
    } catch (error) {
        Logger.error("Failed to initialize organization report schedules", {
            error: error.message
        });
    }
};

// Re-schedule report for an organization (call this when settings change)
export const rescheduleOrganizationReport = async (organizationId) => {
    try {
        const organization = await Organization.findById(organizationId);
        
        if (!organization) {
            Logger.warn(`Organization not found for rescheduling: ${organizationId}`);
            return;
        }
        
        if (organization.reportSettings?.dailyReportEnabled === false) {
            // Cancel existing task if report is disabled
            const existingTask = scheduledReportTasks.get(organizationId.toString());
            if (existingTask) {
                existingTask.stop();
                scheduledReportTasks.delete(organizationId.toString());
                Logger.info(`Cancelled report schedule for organization: ${organization.name}`);
            }
            
            // Also cancel monthly report
            const existingMonthlyTask = scheduledMonthlyReportTasks.get(organizationId.toString());
            if (existingMonthlyTask) {
                existingMonthlyTask.stop();
                scheduledMonthlyReportTasks.delete(organizationId.toString());
                Logger.info(`Cancelled monthly report schedule for organization: ${organization.name}`);
            }
        } else {
            // Reschedule with new time
            scheduleDailyReportForOrganization(organization);
            scheduleMonthlyReportForOrganization(organization);
        }
    } catch (error) {
        Logger.error("Failed to reschedule organization report", {
            organizationId,
            error: error.message
        });
    }
};

// Schedule monthly report for a specific organization
const scheduleMonthlyReportForOrganization = (organization) => {
    try {
        const orgId = organization._id.toString();
        const sendTimeStr = organization.reportSettings?.dailyReportSendTime || "09:00";
        const [sendHour, sendMinute] = sendTimeStr.split(':').map(Number);
        
        // Cancel existing task if any
        const existingTask = scheduledMonthlyReportTasks.get(orgId);
        if (existingTask) {
            existingTask.stop();
        }
        
        // Create cron expression: run on 1st of every month at specified time
        const cronExpression = `${sendMinute || 0} ${sendHour} 1 * *`;
        
        const task = cron.schedule(cronExpression, () => {
            Logger.info(
                `📅 Monthly report scheduled task triggered for organization: ${organization.name}`,
                {
                    organizationId: orgId,
                    scheduledTime: sendTimeStr,
                    cronExpression
                }
            );
            
            generateMonthlyReportForOrganization(organization).catch(error => {
                Logger.error(
                    `Failed to generate scheduled monthly report for organization: ${organization.name}`,
                    {
                        organizationId: orgId,
                        error: error.message
                    }
                );
            });
        });
        
        scheduledMonthlyReportTasks.set(orgId, task);
        
        Logger.info(
            `✅ Monthly report scheduled for organization: ${organization.name}`,
            {
                organizationId: orgId,
                sendTime: sendTimeStr,
                cronExpression,
                nextRun: '1st of next month at ' + sendTimeStr
            }
        );
    } catch (error) {
        Logger.error(
            `Failed to schedule monthly report for organization: ${organization.name}`,
            {
                organizationId: organization._id,
                error: error.message
            }
        );
    }
};

// Initialize monthly report schedules for all organizations
const initializeOrganizationMonthlyReportSchedules = async () => {
    try {
        const organizations = await Organization.find({
            'reportSettings.dailyReportEnabled': { $ne: false }
        });
        
        Logger.info(
            `Initializing monthly report schedules for ${organizations.length} organizations...`
        );
        
        for (const organization of organizations) {
            scheduleMonthlyReportForOrganization(organization);
        }
        
        Logger.info(
            `✅ Initialized ${scheduledMonthlyReportTasks.size} monthly report schedules`
        );
    } catch (error) {
        Logger.error("Failed to initialize organization monthly report schedules", {
            error: error.message
        });
    }
};

// Initialize all scheduled tasks
export const initializeScheduler = () => {
    Logger.info("Initializing scheduled tasks...");

    // Check low stock every 6 hours at minute 0
    cron.schedule("0 */6 * * *", checkLowStock);
    Logger.info("✅ Low stock check scheduled: every 6 hours at minute 0");

    // Initialize organization-specific report schedules
    initializeOrganizationReportSchedules();
    Logger.info("✅ Organization report schedules initialized");

    // Initialize organization-specific monthly report schedules
    initializeOrganizationMonthlyReportSchedules();
    Logger.info("✅ Organization monthly report schedules initialized");

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

    // Setup automatic session cleanup (every 30 seconds)
    setupSessionCleanupScheduler();
    Logger.info("✅ Session cleanup scheduled: every 30 seconds");

    // إضافة جدولة تنظيف الإشعارات القديمة
    setupNotificationCleanupScheduler();
    Logger.info("✅ Notification cleanup scheduler initialized");

    Logger.info("🎯 All scheduled tasks initialized successfully!");
};


/**
 * تنظيف تلقائي لمراجع الجلسات المكررة
 * يعمل كل 30 ثانية في الخلفية
 */
const setupSessionCleanupScheduler = async () => {
    // استيراد الوظيفة من sessionController
    const { default: sessionController } = await import('../controllers/sessionController.js');
    
    // Get all organizations
    const organizations = await Organization.find({ isActive: true });
    
    // تشغيل كل 30 ثانية
    cron.schedule('*/30 * * * * *', async () => {
        try {
            Logger.info("🧹 Running automatic session cleanup (every 30 seconds)...");
            
            let totalCleaned = 0;
            let totalDeleted = 0;
            
            for (const organization of organizations) {
                try {
                    const result = await sessionController.performCleanup(organization._id);
                    totalCleaned += result.cleanedCount || 0;
                    totalDeleted += result.deletedBillsCount || 0;
                } catch (orgError) {
                    Logger.error(`Failed to cleanup for organization ${organization.name}:`, orgError.message);
                }
            }
            
            if (totalCleaned > 0 || totalDeleted > 0) {
                Logger.info(`✅ Session cleanup completed: ${totalCleaned} references cleaned, ${totalDeleted} bills deleted`);
            }
        } catch (error) {
            Logger.error("❌ Session cleanup error:", error.message);
        }
    }, {
        scheduled: true,
        timezone: "Africa/Cairo"
    });

    Logger.info("✅ Session cleanup scheduler initialized (every 30 seconds)");
};

// تصدير الوظيفة الجديدة
export { setupSessionCleanupScheduler };
