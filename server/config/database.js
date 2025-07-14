import mongoose from "mongoose";
import Logger from "../middleware/logger.js";

const connectDB = async () => {
    try {
        // Use local MongoDB if MONGODB_URI is not provided
        const mongoURI =
            process.env.MONGODB_URI || "mongodb://localhost:27017/bomba";

        if (!process.env.MONGODB_URI) {
            Logger.info("⚠️ MONGODB_URI not set, using local MongoDB");
        }

        Logger.info("🔄 Connecting to MongoDB...");

        // Connection options
        const options = {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            family: 4,
            retryWrites: true,
            w: "majority",
        };

        const conn = await mongoose.connect(mongoURI, options);

        Logger.info(`✅ MongoDB Connected Successfully!`);
        Logger.info(`📊 Database: ${conn.connection.name}`);
        Logger.info(`🌐 Host: ${conn.connection.host}`);
        Logger.info(`🔌 Port: ${conn.connection.port}`);
        Logger.info(`📈 Ready State: ${conn.connection.readyState}`);

        // Test database operations
        try {
            await mongoose.connection.db.admin().ping();
            Logger.info("✅ Database ping successful");
        } catch (pingError) {
            Logger.warn("⚠️ Database ping failed, but connection established");
        }

        // Handle connection events
        mongoose.connection.on("error", (err) => {
            Logger.error("❌ MongoDB connection error:", err.message);
        });

        mongoose.connection.on("disconnected", () => {
            Logger.warn("⚠️ MongoDB disconnected");
        });

        mongoose.connection.on("reconnected", () => {
            Logger.info("✅ MongoDB reconnected");
        });

        // Graceful shutdown
        process.on("SIGINT", async () => {
            try {
                await mongoose.connection.close();
                Logger.info(
                    "🔒 MongoDB connection closed through app termination"
                );
            } catch (error) {
                Logger.error("Error closing MongoDB connection:", error);
            }
            process.exit(0);
        });

        process.on("SIGTERM", async () => {
            try {
                await mongoose.connection.close();
                Logger.info("🔒 MongoDB connection closed through SIGTERM");
            } catch (error) {
                Logger.error("Error closing MongoDB connection:", error);
            }
            process.exit(0);
        });
    } catch (error) {
        Logger.error("\n❌ MongoDB connection failed!");
        Logger.error("📝 Error details:", error.message);

        // Provide specific error guidance
        if (error.message.includes("authentication failed")) {
            Logger.error("\n🔐 Authentication Error:");
            Logger.error(
                "- Check your username and password in the connection string"
            );
            Logger.error(
                "- Make sure the database user has proper permissions"
            );
        } else if (
            error.message.includes("ENOTFOUND") ||
            error.message.includes("getaddrinfo")
        ) {
            Logger.error("\n🌐 Network Error:");
            Logger.error("- Check your internet connection");
            Logger.error(
                "- Verify the cluster hostname in your connection string"
            );
            Logger.error(
                "- Make sure MongoDB is running locally if using local connection"
            );
        } else if (
            error.message.includes("timeout") ||
            error.message.includes("Could not connect to any servers")
        ) {
            Logger.error("\n⏰ Connection Timeout:");
            Logger.error("- This is likely an IP whitelisting issue for Atlas");
            Logger.error(
                "- Add your current IP to MongoDB Atlas Network Access"
            );
            Logger.error(
                "- Or add 0.0.0.0/0 for development (not recommended for production)"
            );
            Logger.error(
                "- For local MongoDB, make sure the service is running"
            );
        } else if (error.message.includes("ECONNREFUSED")) {
            Logger.error("\n🔌 Connection Refused:");
            Logger.error("- Make sure MongoDB is running locally");
            Logger.error("- Start MongoDB service: mongod");
            Logger.error("- Or install MongoDB if not installed");
        }

        if (!process.env.MONGODB_URI) {
            Logger.error("\n🔧 Local MongoDB Setup:");
            Logger.error("1. Install MongoDB Community Server");
            Logger.error("2. Start MongoDB service: mongod");
            Logger.error(
                "3. Or use Docker: docker run -d -p 27017:27017 --name mongodb mongo"
            );
        } else {
            Logger.error("\n🔧 Atlas Setup Instructions:");
            Logger.error("1. Go to https://cloud.mongodb.com/");
            Logger.error("2. Create a cluster or use existing one");
            Logger.error("3. Go to Database Access and create a user");
            Logger.error(
                "4. Go to Network Access and add your IP (or 0.0.0.0/0 for development)"
            );
            Logger.error(
                "5. Get connection string from Connect > Connect your application"
            );
            Logger.error(
                "6. Replace <username>, <password>, and <cluster-name> in your .env file"
            );
            Logger.error(
                '7. Make sure to replace <database-name> with your actual database name (e.g., "bomba")'
            );
        }

        process.exit(1);
    }
};

export default connectDB;
