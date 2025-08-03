import dotenv from "dotenv";
import { sendDailyReport } from "./utils/email.js";
import Logger from "./middleware/logger.js";

// Load environment variables
dotenv.config();

const testDailyReport = async () => {
    try {
        Logger.info("Testing daily report email functionality...");

        // Test data
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

        Logger.info("Sending test daily report...", {
            reportData: testReportData,
            emails: testEmails,
        });

        await sendDailyReport(testReportData, testEmails);

        Logger.info("Test daily report sent successfully!");
    } catch (error) {
        Logger.error("Test daily report failed:", {
            error: error.message,
            stack: error.stack,
        });
    }
};

// Run the test
testDailyReport();
