import dotenv from "dotenv";
import { runTask } from "./utils/scheduler.js";
import Logger from "./middleware/logger.js";

// Load environment variables
dotenv.config();

const testScheduler = async () => {
    try {
        Logger.info("Testing scheduler daily report task...");

        Logger.info("Triggering daily report task...");
        await runTask("dailyReport");

        Logger.info("Daily report task completed successfully!");
    } catch (error) {
        Logger.error("Daily report task failed:", {
            error: error.message,
            stack: error.stack,
        });
    }
};

// Run the test
testScheduler();
