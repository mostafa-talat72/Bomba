import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "./config/database.js";
import electronDB from "./config/electronDatabase.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import { requestLogger, errorLogger } from "./middleware/logger.js";
import { apiLimiter, authLimiter } from "./middleware/rateLimiter.js";
import { performanceMonitor } from "./middleware/performanceMonitor.js";
import { setupSocketIO } from "./socket/socketHandler.js";
import { initializeScheduler } from "./utils/scheduler.js";
import Logger from "./middleware/logger.js";
import Bill from "./models/Bill.js";

// Sync system imports
import syncConfig, { validateSyncConfig, getSafeConfig } from "./config/syncConfig.js";
import applySyncToAllModels from "./config/applySync.js";
import syncWorker from "./services/sync/syncWorker.js";
import syncQueueManager from "./services/sync/syncQueueManager.js";
import syncMonitor from "./services/sync/syncMonitor.js";

// Bidirectional sync imports
import OriginTracker from "./services/sync/originTracker.js";
import ConflictResolver from "./services/sync/conflictResolver.js";
import ChangeProcessor from "./services/sync/changeProcessor.js";
import AtlasChangeListener from "./services/sync/atlasChangeListener.js";
import InitialSyncService from "./services/sync/initialSyncService.js";
import BidirectionalInitialSync from "./services/sync/bidirectionalInitialSync.js";
import bidirectionalSyncMonitor from "./services/sync/bidirectionalSyncMonitor.js";
import dualDatabaseManager from "./config/dualDatabaseManager.js";

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
import costCategoryRoutes from "./routes/costCategoryRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import deviceRoutes from "./routes/deviceRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import tableRoutes from "./routes/tableRoutes.js";
import performanceRoutes from "./routes/performanceRoutes.js";
import syncRoutes from "./routes/syncRoutes.js";

// Load environment variables
dotenv.config();

// Initialize database connection
async function initializeDatabase() {
    if (process.env.ELECTRON_MODE === 'true') {
        console.log('🖥️ Running in Electron mode - using embedded database');
        await electronDB.initialize();
    } else {
        console.log('🌐 Running in web mode - using standard database connection');
        await connectDB();
    }
}

// Validate sync configuration on startup
const configValidation = validateSyncConfig();
if (!configValidation.isValid) {
    Logger.warn("⚠️ Sync configuration validation failed:");
    configValidation.errors.forEach((error) => Logger.warn(`  - ${error}`));
    Logger.warn("⚠️ Sync system will be disabled due to invalid configuration");
} else {
    Logger.info("✅ Sync configuration validated successfully");
    
    // Log warnings if any
    if (configValidation.warnings && configValidation.warnings.length > 0) {
        Logger.warn("⚠️ Sync configuration warnings:");
        configValidation.warnings.forEach((warning) => Logger.warn(`  - ${warning}`));
    }
    
    // Log bidirectional sync status
    if (syncConfig.bidirectionalSync.enabled) {
        Logger.info("🔄 Bidirectional sync is ENABLED");
        Logger.info(`  - Conflict resolution: ${syncConfig.bidirectionalSync.conflictResolution.strategy}`);
        Logger.info(`  - Change Stream batch size: ${syncConfig.bidirectionalSync.changeStream.batchSize}`);
        if (syncConfig.bidirectionalSync.excludedCollections.length > 0) {
            Logger.info(`  - Excluded collections: ${syncConfig.bidirectionalSync.excludedCollections.join(', ')}`);
        }
    } else {
        Logger.info("ℹ️  Bidirectional sync is DISABLED (one-way sync only: Local → Atlas)");
    }
}

// Fix username index issue on startup
const fixUsernameIndex = async () => {
    try {
        const db = mongoose.connection.db;

        try {
            // Try to drop the username index if it exists
            await db.collection("users").dropIndex("username_1");
        } catch (indexError) {
            if (indexError.code === 26) {
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

// Bidirectional sync components (initialized after database connection)
let originTracker = null;
let conflictResolver = null;
let changeProcessor = null;
let atlasChangeListener = null;

// Run the fix after database connection
mongoose.connection.once("open", async () => {
    fixUsernameIndex();
    
    // Initialize sync system
    if (syncConfig.enabled) {
        Logger.info("🔄 Initializing sync system...");
        
        // Apply sync middleware to all models
        applySyncToAllModels();
        
        // Load persisted queue if exists
        try {
            const loadedCount = await syncQueueManager.loadFromDisk();
            if (loadedCount > 0) {
                Logger.info(`📂 Loaded ${loadedCount} operations from persisted queue`);
            }
        } catch (error) {
            Logger.error("❌ Failed to load persisted queue:", error.message);
        }
        
        // Start sync worker
        syncWorker.start();
        
        // Log initial status
        syncMonitor.logStatus();
        
        Logger.info("✅ Sync system initialized successfully");
        
        // Perform bidirectional initial sync if enabled
        const initialSyncEnabled = process.env.INITIAL_SYNC_ENABLED === 'true';
        const initialSyncInterval = parseInt(process.env.INITIAL_SYNC_INTERVAL || '0', 10);
        
        if (initialSyncEnabled) {
            Logger.info("🔄 Bidirectional initial sync is enabled");
            
            // Wait a bit for Atlas to connect
            setTimeout(async () => {
                const bidirectionalSync = new BidirectionalInitialSync(dualDatabaseManager);
                
                // Perform bidirectional sync (both directions)
                const result = await bidirectionalSync.performBidirectionalSync();
                
                if (result.success) {
                    Logger.info("✅ Bidirectional initial sync completed");
                    
                    // Start periodic sync if configured
                    if (initialSyncInterval > 0) {
                        bidirectionalSync.startPeriodicSync(initialSyncInterval);
                        Logger.info(`⏰ Periodic sync every ${initialSyncInterval}ms (${initialSyncInterval/1000}s)`);
                    }
                } else if (result.skipped) {
                    Logger.info("ℹ️  Bidirectional sync skipped:", result.reason || 'Already running or not needed');
                } else {
                    Logger.warn("⚠️  Bidirectional sync failed, will retry automatically");
                }
            }, 5000); // Wait 5 seconds for Atlas to connect
        } else {
            Logger.info("ℹ️  Bidirectional initial sync is disabled");
        }
        
        // Initialize bidirectional sync if enabled (with delay to allow Atlas to connect)
        if (syncConfig.bidirectionalSync.enabled) {
            Logger.info("🔄 Bidirectional sync is enabled");
            Logger.info("   Will initialize after Atlas connection is established...");
            
            // Wait a bit for Atlas to connect, then try to initialize
            setTimeout(async () => {
                try {
                    await initializeBidirectionalSync();
                } catch (error) {
                    Logger.error("❌ Failed to initialize bidirectional sync on first attempt");
                    Logger.info("   Will retry when Atlas connection is available");
                    
                    // Set up retry mechanism
                    const retryInterval = setInterval(async () => {
                        if (dualDatabaseManager.isAtlasAvailable()) {
                            clearInterval(retryInterval);
                            try {
                                await initializeBidirectionalSync();
                            } catch (retryError) {
                                Logger.error("❌ Bidirectional sync initialization failed:", retryError.message);
                            }
                        }
                    }, 10000); // Retry every 10 seconds
                }
            }, 3000); // Wait 3 seconds for Atlas to connect
        }
    } else {
        Logger.info("ℹ️  Sync system is disabled");
    }
}); // End of mongoose.connection.once callback

// Function to initialize bidirectional sync
async function initializeBidirectionalSync() {
    Logger.info("🔄 Initializing bidirectional sync...");
    
    try {
        // Verify bidirectional sync configuration
        Logger.info("🔍 Verifying bidirectional sync configuration...");
        
        const bidirectionalConfig = syncConfig.bidirectionalSync;
        
        // Check required configuration
        if (!bidirectionalConfig.conflictResolution || !bidirectionalConfig.conflictResolution.strategy) {
            throw new Error("Conflict resolution strategy not configured");
        }
        
        if (!bidirectionalConfig.changeStream) {
            throw new Error("Change Stream configuration missing");
        }
        
        Logger.info("✅ Bidirectional sync configuration verified");
        Logger.info(`   - Conflict resolution: ${bidirectionalConfig.conflictResolution.strategy}`);
        Logger.info(`   - Change Stream batch size: ${bidirectionalConfig.changeStream.batchSize}`);
        Logger.info(`   - Max reconnect attempts: ${bidirectionalConfig.changeStream.maxReconnectAttempts}`);
        
        if (bidirectionalConfig.excludedCollections && bidirectionalConfig.excludedCollections.length > 0) {
            Logger.info(`   - Excluded collections: ${bidirectionalConfig.excludedCollections.join(', ')}`);
        }
        
        // Check Atlas Change Stream availability
        Logger.info("🔍 Checking Atlas Change Stream availability...");
        
        if (!dualDatabaseManager.isAtlasAvailable()) {
            Logger.warn("⚠️  Atlas connection not available yet");
            Logger.warn("   Bidirectional sync will start when Atlas connection is established");
            Logger.warn("   One-way sync (Local → Atlas) will continue working");
            throw new Error("Atlas connection not available - Change Streams require Atlas connection");
        }
        
        const atlasConnection = dualDatabaseManager.getAtlasConnection();
        if (!atlasConnection) {
            Logger.warn("⚠️  Atlas connection is null");
            throw new Error("Atlas connection is null");
        }
        
        // Verify Atlas connection is ready
        if (atlasConnection.readyState !== 1) {
            Logger.warn(`⚠️  Atlas connection not ready (readyState: ${atlasConnection.readyState})`);
            throw new Error(`Atlas connection not ready (readyState: ${atlasConnection.readyState})`);
        }
        
        Logger.info("✅ Atlas Change Stream is available");
        Logger.info(`   - Atlas host: ${atlasConnection.host}`);
        Logger.info(`   - Atlas database: ${atlasConnection.name}`);
        
        // Initialize Origin Tracker
        originTracker = new OriginTracker();
        Logger.info(`✅ Origin Tracker initialized (Instance ID: ${originTracker.instanceId})`);
        
        // Initialize Conflict Resolver
        conflictResolver = new ConflictResolver();
        Logger.info(`✅ Conflict Resolver initialized (Strategy: ${conflictResolver.getStrategy()})`);
        
        // Initialize Change Processor
        changeProcessor = new ChangeProcessor(originTracker, conflictResolver, dualDatabaseManager);
        Logger.info("✅ Change Processor initialized");
        
        // Initialize Atlas Change Listener
        atlasChangeListener = new AtlasChangeListener(dualDatabaseManager, changeProcessor, originTracker);
        Logger.info("✅ Atlas Change Listener initialized");
        
        // Expose to global scope for dynamic configuration updates
        global.atlasChangeListener = atlasChangeListener;
        global.changeProcessor = changeProcessor;
        
        // Load resume token if exists
        Logger.info("🔍 Checking for resume token...");
        const hasResumeToken = atlasChangeListener.resumeToken !== null;
        if (hasResumeToken) {
            Logger.info("✅ Resume token loaded - will resume from last position");
        } else {
            Logger.info("ℹ️  No resume token found - starting fresh");
        }
        
        // Start Atlas Change Listener
        await atlasChangeListener.start();
        
        // Update bidirectional sync monitor with Change Stream status
        bidirectionalSyncMonitor.updateChangeStreamStatus('connected');
        
        // Log bidirectional sync status
        Logger.info("\n📊 Bidirectional Sync Status:");
        Logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        Logger.info(`✅ Status: ACTIVE`);
        Logger.info(`🔄 Direction: Local ⇄ Atlas (bidirectional)`);
        Logger.info(`🆔 Instance ID: ${originTracker.instanceId}`);
        Logger.info(`⚙️  Conflict Resolution: ${conflictResolver.getStrategy()}`);
        Logger.info(`📡 Change Stream: Connected`);
        Logger.info(`🔄 Resume Token: ${hasResumeToken ? 'Available' : 'Not available'}`);
        Logger.info(`📦 Batch Size: ${bidirectionalConfig.changeStream.batchSize}`);
        Logger.info(`🔁 Max Reconnect Attempts: ${bidirectionalConfig.changeStream.maxReconnectAttempts}`);
        
        if (bidirectionalConfig.excludedCollections && bidirectionalConfig.excludedCollections.length > 0) {
            Logger.info(`🚫 Excluded Collections: ${bidirectionalConfig.excludedCollections.join(', ')}`);
        }
        
        Logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        
        bidirectionalSyncMonitor.logBidirectionalStatus();
        
        Logger.info("✅ Bidirectional sync initialized successfully");
        
    } catch (error) {
        Logger.error("❌ Failed to initialize bidirectional sync:", error.message);
        Logger.warn("⚠️ Falling back to one-way sync (Local → Atlas)");
        
        // Update Change Stream status to disconnected
        if (bidirectionalSyncMonitor) {
            bidirectionalSyncMonitor.updateChangeStreamStatus('disconnected');
        }
        
        // Log fallback status
        Logger.info("\n📊 Sync Status:");
        Logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        Logger.info(`⚠️  Status: FALLBACK MODE`);
        Logger.info(`🔄 Direction: Local → Atlas (one-way only)`);
        Logger.info(`❌ Bidirectional sync: Disabled due to error`);
        Logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        
        throw error; // Re-throw to be caught by caller
    }
}

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
        ? [
              process.env.FRONTEND_URL,
              "https://bomba-iota.vercel.app",
              "https://bomba-backend.vercel.app",
              "https://*.vercel.app",
              /^https?:\/\/([a-z0-9-]+\.)*vercel\.app$/, // السماح بجميع النطاقات الفرعية من zeabur.app
          ]
        : [
              "http://localhost:3000",
              "https://localhost:3000",
              "http://localhost:5173",
              "https://localhost:5173",
              process.env.FRONTEND_URL || "http://localhost:3000",
          ];

// إزالة القيم الفارغة من المصفوفة
const filteredOrigins = allowedOrigins.filter(Boolean);

// إعدادات CORS مبسطة للتطوير
const corsOptions = {
    origin: function (origin, callback) {
        // السماح بجميع المنشآت في وضع التطوير
        if (process.env.NODE_ENV === "development") {
            return callback(null, true);
        }

        // قائمة بالمنشآت المسموح بها في الإنتاج
        const allowedOrigins = [
            "http://localhost:3000",
            "http://localhost:5173",
            "https://bomba-iota.vercel.app",
            /^\.*\.vercel\.app$/, // يسمح بجميع النطاقات الفرعية من vercel.app
        ];

        // السماح بطلبات بدون origin (مثل الطلبات من تطبيقات الجوال)
        if (!origin) return callback(null, true);

        // التحقق مما إذا كان origin مسموحاً به
        if (
            allowedOrigins.some((allowedOrigin) => {
                if (typeof allowedOrigin === "string") {
                    return origin === allowedOrigin;
                } else if (allowedOrigin instanceof RegExp) {
                    return allowedOrigin.test(origin);
                }
                return false;
            })
        ) {
            return callback(null, true);
        }

        // إذا لم يتم العثور على origin مسموح به
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Range", "X-Total-Count"],
};

// تطبيق إعدادات CORS
app.use(cors(corsOptions));

// معالجة تلقائية لطلبات preflight OPTIONS
app.options("*", cors(corsOptions));

// Compression middleware - يضغط الاستجابات لتقليل حجم البيانات
app.use(compression({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    },
    level: 6 // مستوى الضغط (0-9)
}));

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

// Performance monitoring
app.use(performanceMonitor);

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
app.use("/api/cost-categories", costCategoryRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/sync", syncRoutes);

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

const PORT = process.env.PORT || 5000;

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
        Logger.info("✅ Scheduler initialized in production mode");
    } else {
        // Initialize scheduler in development mode as well
        initializeScheduler();
        Logger.info("✅ Scheduler initialized in development mode");
    }
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    Logger.info(`${signal} received, shutting down gracefully`);
    
    // Stop bidirectional sync components if enabled
    if (syncConfig.enabled && syncConfig.bidirectionalSync.enabled) {
        Logger.info("🛑 Stopping bidirectional sync...");
        
        try {
            // Stop Atlas Change Listener
            if (atlasChangeListener) {
                Logger.info("🛑 Stopping Atlas Change Listener...");
                await atlasChangeListener.stop();
                Logger.info("✅ Atlas Change Listener stopped");
            }
            
            // Stop Origin Tracker cleanup
            if (originTracker) {
                originTracker.stopCleanup();
                Logger.info("✅ Origin Tracker cleanup stopped");
            }
            
            // Log final bidirectional sync stats
            if (bidirectionalSyncMonitor) {
                bidirectionalSyncMonitor.logBidirectionalStatus();
            }
            
            Logger.info("✅ Bidirectional sync stopped successfully");
        } catch (error) {
            Logger.error("❌ Error stopping bidirectional sync:", error.message);
        }
    }
    
    // Stop sync worker
    if (syncConfig.enabled) {
        Logger.info("🛑 Stopping sync worker...");
        syncWorker.stop();
        
        // Cleanup sync queue manager (stop auto-save timer)
        syncQueueManager.cleanup();
        
        // Persist queue if enabled
        if (syncConfig.persistQueue && !syncQueueManager.isEmpty()) {
            try {
                Logger.info(`💾 Persisting ${syncQueueManager.size()} operations to disk...`);
                await syncQueueManager.persistToDisk();
                Logger.info("✅ Queue persisted to disk successfully");
            } catch (error) {
                Logger.error("❌ Failed to persist queue:", error.message);
            }
        } else if (syncQueueManager.isEmpty()) {
            Logger.info("ℹ️  Queue is empty, no persistence needed");
        }
        
        // Log final stats
        syncMonitor.logStatus();
    }
    
    // Close database connections
    try {
        Logger.info("🔒 Closing database connections...");
        await dualDatabaseManager.closeConnections();
        Logger.info("✅ Database connections closed");
    } catch (error) {
        Logger.error("❌ Error closing database connections:", error.message);
    }
    
    // Close server
    server.close(() => {
        Logger.info("✅ Server closed");
        process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
        Logger.error("⚠️ Forced shutdown after timeout");
        process.exit(1);
    }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
    Logger.error("Uncaught Exception", {
        error: err.message,
        stack: err.stack,
    });
    process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
    Logger.error("Unhandled Rejection", {
        error: err.message,
        stack: err.stack,
    });
    server.close(() => {
        process.exit(1);
    });
});

export default app;
