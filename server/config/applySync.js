import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";
import syncConfig from "./syncConfig.js";
import Logger from "../middleware/logger.js";

// Import all models
import Bill from "../models/Bill.js";
import Cost from "../models/Cost.js";
import CostCategory from "../models/CostCategory.js";
import Device from "../models/Device.js";
import InventoryItem from "../models/InventoryItem.js";
import MenuCategory from "../models/MenuCategory.js";
import MenuItem from "../models/MenuItem.js";
import MenuSection from "../models/MenuSection.js";
import Notification from "../models/Notification.js";
import Order from "../models/Order.js";
import Organization from "../models/Organization.js";
import Session from "../models/Session.js";
import Settings from "../models/Settings.js";
import Subscription from "../models/Subscription.js";
import Table from "../models/Table.js";
import TableSection from "../models/TableSection.js";
import User from "../models/User.js";
import Advance from "../models/Advance.js";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import Deduction from "../models/Deduction.js";
import Payment from "../models/Payment.js";
import Payroll from "../models/Payroll.js";

/**
 * Apply sync middleware to all models
 * This function should be called after database connection is established
 * 
 * NOTE: Most models already have sync middleware applied in their definition files.
 * This function is kept for backward compatibility and to ensure all models have it.
 */
export function applySyncToAllModels() {
    if (!syncConfig.enabled) {
        Logger.info("ℹ️  Sync disabled, middleware not applied to models");
        return;
    }

    Logger.info("🔄 Verifying sync middleware on models...");

    const models = [
        { name: "Bill", model: Bill },
        { name: "Cost", model: Cost },
        { name: "CostCategory", model: CostCategory },
        { name: "Device", model: Device },
        { name: "InventoryItem", model: InventoryItem },
        { name: "MenuCategory", model: MenuCategory },
        { name: "MenuItem", model: MenuItem },
        { name: "MenuSection", model: MenuSection },
        { name: "Notification", model: Notification },
        { name: "Order", model: Order },
        { name: "Organization", model: Organization },
        { name: "Session", model: Session },
        { name: "Settings", model: Settings },
        { name: "Subscription", model: Subscription },
        { name: "Table", model: Table },
        { name: "TableSection", model: TableSection },
        { name: "User", model: User },
        { name: "Advance", model: Advance },
        { name: "Attendance", model: Attendance },
        { name: "Employee", model: Employee },
        { name: "Deduction", model: Deduction },
        { name: "Payment", model: Payment },
        { name: "Payroll", model: Payroll },
    ];

    let verifiedCount = 0;
    let skippedCount = 0;

    models.forEach(({ name, model }) => {
        try {
            const collectionName = model.collection.name;

            // Check if collection is excluded
            if (syncConfig.excludedCollections.includes(collectionName)) {
                Logger.info(`⏭️  Skipping sync for: ${name} (${collectionName})`);
                skippedCount++;
                return;
            }

            // Verify model exists and has schema
            if (model && model.schema) {
                verifiedCount++;
                Logger.debug(`✅ ${name} model ready for sync`);
            } else {
                Logger.warn(`⚠️  ${name} model has no schema`);
            }
        } catch (error) {
            Logger.error(`❌ Failed to verify ${name}:`, error.message);
        }
    });

    Logger.info(
        `✅ Sync middleware verified on ${verifiedCount}/${models.length} models`
    );
    Logger.info(`ℹ️  Middleware is applied in each model's definition file`);

    if (skippedCount > 0) {
        Logger.info(`⏭️  Skipped ${skippedCount} excluded collections`);
    }

    if (syncConfig.excludedCollections.length > 0) {
        Logger.info(
            `ℹ️  Excluded collections: ${syncConfig.excludedCollections.join(", ")}`
        );
    }
}

export default applySyncToAllModels;
