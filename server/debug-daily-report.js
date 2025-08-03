import dotenv from "dotenv";
import mongoose from "mongoose";
import Organization from "./models/Organization.js";
import User from "./models/User.js";
import { runTask } from "./utils/scheduler.js";
import { sendDailyReport } from "./utils/email.js";
import Logger from "./middleware/logger.js";

// Load environment variables
dotenv.config();

const debugDailyReport = async () => {
    try {
        Logger.info("=== DEBUGGING DAILY REPORT ===");

        // 1. Check environment variables
        Logger.info("1. Checking environment variables...");
        Logger.info("EMAIL_HOST:", process.env.EMAIL_HOST);
        Logger.info("EMAIL_USER:", process.env.EMAIL_USER);
        Logger.info("EMAIL_PASS:", process.env.EMAIL_PASS ? "SET" : "NOT SET");
        Logger.info("NODE_ENV:", process.env.NODE_ENV);

        // 2. Connect to database
        Logger.info("2. Connecting to database...");
        await mongoose.connect(process.env.MONGODB_URI);
        Logger.info("✅ Connected to database successfully");

        // 3. Check organizations
        Logger.info("3. Checking organizations...");
        const organizations = await Organization.find();
        Logger.info(`Found ${organizations.length} organizations:`, {
            organizations: organizations.map((org) => ({
                id: org._id,
                name: org.name,
                type: org.type,
            })),
        });

        if (organizations.length === 0) {
            Logger.error(
                "❌ No organizations found! This is why daily reports are not being sent."
            );
            return;
        }

        // 4. Check admin users for each organization
        Logger.info("4. Checking admin users for each organization...");
        for (const org of organizations) {
            const orgAdmins = await User.find({
                role: "admin",
                status: "active",
                organization: org._id,
                email: { $exists: true, $ne: "" },
            });

            Logger.info(
                `Organization "${org.name}" has ${orgAdmins.length} admin users with emails:`,
                {
                    organizationId: org._id,
                    organizationName: org.name,
                    adminEmails: orgAdmins.map((admin) => admin.email),
                }
            );

            if (orgAdmins.length === 0) {
                Logger.warn(
                    `⚠️ No admin users with emails found for organization "${org.name}"`
                );
            }
        }

        // 5. Test email functionality
        Logger.info("5. Testing email functionality...");
        const testReportData = {
            date: new Date().toLocaleDateString("ar-EG"),
            organizationName: "Test Organization",
            totalRevenue: 1500,
            totalCosts: 800,
            netProfit: 700,
            totalBills: 25,
            totalOrders: 30,
            totalSessions: 15,
            topProducts: [
                { name: "قهوة تركية", quantity: 50 },
                { name: "شاي", quantity: 30 },
                { name: "عصير برتقال", quantity: 20 },
            ],
        };

        const testEmails = ["mr.robot192002@gmail.com"];

        try {
            await sendDailyReport(testReportData, testEmails);
            Logger.info("✅ Test email sent successfully!");
        } catch (emailError) {
            Logger.error("❌ Test email failed:", {
                error: emailError.message,
                stack: emailError.stack,
            });
        }

        // 6. Test scheduler task
        Logger.info("6. Testing scheduler daily report task...");
        try {
            await runTask("dailyReport");
            Logger.info("✅ Daily report task completed successfully!");
        } catch (schedulerError) {
            Logger.error("❌ Daily report task failed:", {
                error: schedulerError.message,
                stack: schedulerError.stack,
            });
        }

        Logger.info("=== DEBUG COMPLETE ===");
    } catch (error) {
        Logger.error("❌ Debug failed:", {
            error: error.message,
            stack: error.stack,
        });
    } finally {
        await mongoose.disconnect();
        Logger.info("Disconnected from database");
    }
};

// Run the debug
debugDailyReport();
