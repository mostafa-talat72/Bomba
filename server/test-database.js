import dotenv from "dotenv";
import mongoose from "mongoose";
import Organization from "./models/Organization.js";
import User from "./models/User.js";
import Logger from "./middleware/logger.js";

// Load environment variables
dotenv.config();

const testDatabase = async () => {
    try {
        Logger.info("Testing database connection and data...");

        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        Logger.info("Connected to database successfully");

        // Check organizations
        const organizations = await Organization.find();
        Logger.info(`Found ${organizations.length} organizations:`, {
            organizations: organizations.map((org) => ({
                id: org._id,
                name: org.name,
                type: org.type,
            })),
        });

        // Check users
        const users = await User.find();
        Logger.info(`Found ${users.length} users:`, {
            users: users.map((user) => ({
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                organization: user.organization,
            })),
        });

        // Check admin users specifically
        const adminUsers = await User.find({
            role: "admin",
            status: "active",
            email: { $exists: true, $ne: "" },
        });
        Logger.info(`Found ${adminUsers.length} admin users with emails:`, {
            adminUsers: adminUsers.map((user) => ({
                id: user._id,
                name: user.name,
                email: user.email,
                organization: user.organization,
            })),
        });

        // Check if any admin users have organizations
        const adminUsersWithOrgs = adminUsers.filter(
            (user) => user.organization
        );
        Logger.info(
            `Found ${adminUsersWithOrgs.length} admin users with organizations:`,
            {
                adminUsersWithOrgs: adminUsersWithOrgs.map((user) => ({
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    organization: user.organization,
                })),
            }
        );

        // For each organization, check if there are admin users
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
        }
    } catch (error) {
        Logger.error("Database test failed:", {
            error: error.message,
            stack: error.stack,
        });
    } finally {
        await mongoose.disconnect();
        Logger.info("Disconnected from database");
    }
};

// Run the test
testDatabase();
