import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "./config/database.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import { requestLogger, errorLogger } from "./middleware/logger.js";
import { apiLimiter, authLimiter } from "./middleware/rateLimiter.js";
import { setupSocketIO } from "./socket/socketHandler.js";
import { initializeScheduler } from "./utils/scheduler.js";
import Logger from "./middleware/logger.js";
import Bill from "./models/Bill.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";
import billsRoutes from "./routes/billsRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import costRoutes from "./routes/costRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import deviceRoutes from "./routes/deviceRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Fix username index issue on startup
const fixUsernameIndex = async () => {
    try {
        const db = mongoose.connection.db;

        try {
            // Try to drop the username index if it exists
            await db.collection("users").dropIndex("username_1");
            Logger.info("✅ Username index removed successfully");
        } catch (indexError) {
            if (indexError.code === 26) {
                Logger.info("ℹ️ Username index does not exist");
            } else {
                Logger.warn(
                    "⚠️ Error removing username index:",
                    indexError.message
                );
            }
        }
    } catch (error) {
        Logger.error("❌ Error fixing username index:", error);
    }
};

// Run the fix after database connection
mongoose.connection.once("open", () => {
    fixUsernameIndex();
});

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:3000",
            "https://localhost:3000",
            process.env.FRONTEND_URL || "http://localhost:3000",
        ],
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true,
    },
});

// إعدادات CORS مرنة حسب البيئة
const allowedOrigins =
    process.env.NODE_ENV === "production"
        ? [process.env.FRONTEND_URL]
        : [
              "http://localhost:3000",
              "https://localhost:3000",
              process.env.FRONTEND_URL || "http://localhost:3000",
          ];

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// معالجة تلقائية لطلبات preflight OPTIONS
app.options("*", cors());

// Security middleware
app.use(
    helmet({
        crossOriginEmbedderPolicy: false,
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
            },
        },
    })
);

// Trust proxy (for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

// Request logging
app.use(requestLogger);

// Rate limiting
app.use("/api/", apiLimiter);
// app.use('/api/auth/login', authLimiter);
// app.use('/api/auth/register', authLimiter);

// Body parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files
app.use("/uploads", express.static("uploads"));

// Socket.IO setup
setupSocketIO(io);
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Root route
app.get("/", (req, res) => {
    res.status(200).json({
        message: "Bomba API is running",
        status: "success",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
    });
});

// Health check
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "Server is running",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
    });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/bills", billsRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/costs", costRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/notifications", notificationRoutes);

// Public bill viewing route - متاح للجميع بدون تسجيل دخول
app.get("/bill/:billId", async (req, res) => {
    try {
        const { billId } = req.params;

        // Validate bill ID format
        if (!billId || billId.length !== 24) {
            return res.status(400).json({
                success: false,
                message: "معرف الفاتورة غير صحيح",
            });
        }

        const bill = await Bill.findById(billId)
            .populate({
                path: "orders",
                populate: [
                    {
                        path: "items.menuItem",
                        select: "name arabicName preparationTime price",
                    },
                    {
                        path: "createdBy",
                        select: "name",
                    },
                ],
            })
            .populate({
                path: "sessions",
                populate: {
                    path: "createdBy",
                    select: "name",
                },
            })
            .populate("createdBy", "name")
            .populate("updatedBy", "name")
            .populate({
                path: "payments.user",
                select: "name",
            });

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "الفاتورة غير موجودة",
            });
        }

        // Return bill data as JSON
        res.json({
            success: true,
            data: {
                _id: bill._id,
                billNumber: bill.billNumber,
                customerName: bill.customerName,
                customerPhone: bill.customerPhone,
                tableNumber: bill.tableNumber,
                orders: bill.orders || [],
                sessions: bill.sessions || [],
                subtotal: bill.subtotal || 0,
                discount: bill.discount || 0,
                tax: bill.tax || 0,
                total: bill.total || 0,
                paid: bill.paid || 0,
                remaining: bill.remaining || 0,
                status: bill.status,
                billType: bill.billType,
                payments: bill.payments || [],
                notes: bill.notes,
                dueDate: bill.dueDate,
                createdBy: bill.createdBy,
                createdAt: bill.createdAt,
                updatedAt: bill.updatedAt,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الفاتورة",
            error: error.message,
        });
    }
});

// Error handling middleware
app.use(errorLogger);
app.use(notFound);
app.use(errorHandler);

// Add request debugging for order routes
app.use("/api/orders", (req, res, next) => {
    next();
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    Logger.info(`Server started on port ${PORT}`, {
        environment: process.env.NODE_ENV,
        port: PORT,
    });

    Logger.info(
        `🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`
    );
    Logger.info(`📊 Health check: http://localhost:${PORT}/health`);
    Logger.info(
        `🌐 CORS enabled for: ${
            process.env.FRONTEND_URL || "http://localhost:3000"
        }`
    );

    // Initialize scheduled tasks
    if (process.env.NODE_ENV === "production") {
        initializeScheduler();
    }
});

// Graceful shutdown
process.on("SIGTERM", () => {
    Logger.info("SIGTERM received, shutting down gracefully");
    server.close(() => {
        Logger.info("Process terminated");
        process.exit(0);
    });
});

process.on("SIGINT", () => {
    Logger.info("SIGINT received, shutting down gracefully");
    server.close(() => {
        Logger.info("Process terminated");
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
    Logger.error("Uncaught Exception", {
        error: err.message,
        stack: err.stack,
    });
    console.error("🚨 Uncaught Exception:", err);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
    Logger.error("Unhandled Rejection", {
        error: err.message,
        stack: err.stack,
    });
    console.error("🚨 Unhandled Rejection:", err);
    server.close(() => {
        process.exit(1);
    });
});

export default app;
