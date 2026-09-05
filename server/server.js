// ✅ CRITICAL: Load environment variables FIRST!
// This import executes dotenv.config() before any other code
import './config/env-loader.js';

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import connectDB from "./config/database.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import { requestLogger, errorLogger } from "./middleware/logger.js";
import { apiLimiter, authLimiter } from "./middleware/rateLimiter.js";
import { performanceMonitor } from "./middleware/performanceMonitor.js";
import { setupSocketIO } from "./socket/socketHandler.js";
import { startAutoOrderCompleter } from "./services/autoOrderCompleter.js";
import { initializeScheduler } from "./utils/scheduler.js";
import { fixAllTableStatuses } from "./utils/tableUtils.js";
import "./utils/organization.js";
import Logger from "./middleware/logger.js";
import jwt from "jsonwebtoken";
import Bill from "./models/Bill.js";
import { validateEnv } from "./config/envValidator.js";

// Sync system imports
import syncConfig, { validateSyncConfig, getSafeConfig } from "./config/syncConfig.js";
import applySyncToAllModels from "./config/applySync.js";
import syncWorker from "./services/sync/syncWorker.js";
import syncQueueManager from "./services/sync/syncQueueManager.js";
import syncMonitor from "./services/sync/syncMonitor.js";
import lanSyncService from "./services/sync/lanSyncService.js";
import lanDiscovery from "./services/sync/lanDiscovery.js";

// Bidirectional sync imports
import OriginTracker from "./services/sync/originTracker.js";
import ConflictResolver from "./services/sync/conflictResolver.js";
import ChangeProcessor from "./services/sync/changeProcessor.js";
import AtlasChangeListener from "./services/sync/atlasChangeListener.js";
import InitialSyncService from "./services/sync/initialSyncService.js";
import BidirectionalInitialSync from "./services/sync/bidirectionalInitialSync.js";
import bidirectionalSyncMonitor from "./services/sync/bidirectionalSyncMonitor.js";
import dualDatabaseManager from "./config/dualDatabaseManager.js";
import syncStatusMonitor from "./services/sync/syncStatusMonitor.js";

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
import upgradeRoutes from "./routes/upgradeRoutes.js";
import tableRoutes from "./routes/tableRoutes.js";
import performanceRoutes from "./routes/performanceRoutes.js";
import syncRoutes from "./routes/syncRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import payrollRoutes from "./routes/payroll.js";
import warehouseRoutes from "./routes/warehouseRoutes.js";
import inviteRoutes from "./routes/inviteRoutes.js";
import printRoutes from "./routes/printRoutes.js";
import backupRoutes from "./routes/backupRoutes.js";

// Environment variables already loaded at the top of the file

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

// Validate critical env secrets before connecting (fail fast on weak/missing JWT or Mongo URIs)
validateEnv();

// Connect to database
connectDB();

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

    // ترحيل الصلاحيات القديمة: أي مستخدم يملك cafe أو billing يحصل على tables
    // (صفحة الطاولات الموحدة حلت محل صفحتي الطلبات والفواتير)
    try {
        const { default: User } = await import('./models/User.js');
        const migRes = await User.updateMany(
            {
                $and: [
                    { permissions: { $in: ["cafe", "billing"] } },
                    { permissions: { $ne: "tables" } },
                ],
            },
            { $addToSet: { permissions: "tables" } }
        );
        if (migRes.modifiedCount > 0) {
            Logger.info(`✅ Granted 'tables' permission to ${migRes.modifiedCount} user(s) with cafe/billing`);
        }
    } catch (migError) {
        Logger.error("❌ Error migrating user permissions:", migError.message);
    }
    
    // Auto-fix paid bills on startup
    try {
        Logger.info("🔧 Running automatic bill calculations fix...");
        
        // Import and run the fix script
        const { default: Bill } = await import('./models/Bill.js');
        
        // Get all bills with status 'paid'
        const paidBills = await Bill.find({ status: 'paid' });
        
        let fixedCount = 0;
        for (const bill of paidBills) {
            const needsFix = (Math.abs(bill.paid - bill.total) > 0.01) || (bill.remaining > 0.01);
            
            if (needsFix) {
                await Bill.updateOne(
                    { _id: bill._id },
                    {
                        $set: {
                            paid: bill.total,
                            remaining: 0
                        }
                    }
                );
                fixedCount++;
            }
        }
        
        if (fixedCount > 0) {
            Logger.info(`✅ Fixed ${fixedCount} paid bills automatically`);
        } else {
            Logger.info("✅ All paid bills are correct");
        }
    } catch (error) {
        Logger.error("❌ Error in automatic bill fix:", error.message);
    }

    // Auto-fix table statuses on startup (one-time, efficient: Bill.exists + bulkWrite)
    try {
        Logger.info("🔧 Running automatic table status fix on startup...");
        const tableFixResult = await fixAllTableStatuses({ logResults: true, silentIfNoFix: false });
        Logger.info(`✅ Table status startup fix completed: fixed ${tableFixResult.fixed}/${tableFixResult.total} (occupied:${tableFixResult.occupied} empty:${tableFixResult.empty})`);
    } catch (tableFixError) {
        Logger.error("❌ Error in automatic table status fix:", tableFixError.message);
    }

    // Auto-heal BSON types on startup: converts stringified Dates/ObjectIds
    // (left by JSON-crossed sync payloads) back to proper types, local + Atlas.
    // Uses raw collection ops (bypasses sync middleware); each node heals itself.
    try {
        Logger.info("🔍 Running automatic BSON type audit on startup...");
        const { runStartupTypeAudit } = await import("./utils/startupTypeAudit.js");
        await runStartupTypeAudit({ fix: true });
    } catch (typeAuditError) {
        Logger.error("❌ Error in automatic BSON type audit:", typeAuditError.message);
    }
    
    // Initialize sync system (Atlas and/or LAN)
    const shouldInitSync = syncConfig.enabled || syncConfig.lanSync?.enabled;
    if (shouldInitSync) {
        Logger.info("🔄 Initializing sync system...");
        
        // Apply sync middleware to all models (works for Atlas, LAN, or both)
        if (!global.__syncApplied) { applySyncToAllModels(); global.__syncApplied = true; }

        // Atlas-specific queue/worker (only if Atlas sync enabled)
        if (syncConfig.enabled) {
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
        } else {
            Logger.info("✅ Sync middleware applied for LAN sync");
        }
        
        // Atlas-specific monitors and full sync (only if Atlas enabled)
        if (syncConfig.enabled) {
        // بدء مراقب المزامنة اللحظية
        // المراقب يطبع فقط عند حدوث تغييرات في المزامنة
        // checkInterval: كم مرة يفحص التغييرات (بالميلي ثانية)
        // 1000 = يفحص كل ثانية
        // 500 = يفحص كل نصف ثانية (أسرع)
        setTimeout(() => {
            syncStatusMonitor.start(1000); // يفحص كل ثانية
            
            // إضافة المراقب إلى global scope ليستطيع syncWorker استدعاءه
            global.syncStatusMonitor = syncStatusMonitor;
        }, 3000); // انتظر 3 ثواني بعد بدء السيرفر
        
        // Perform FULL bidirectional sync on startup (always enabled)
        Logger.info("🔄 Starting automatic full bidirectional sync...");
        
        // Import full sync service
        const { default: fullSyncService } = await import('./services/sync/fullSyncService.js');
        
        // Wait for Atlas to connect
        setTimeout(async () => {
            try {
                Logger.info("\n═══════════════════════════════════════════════════════════");
                Logger.info("🚀 AUTOMATIC FULL SYNC - Starting...");
                Logger.info("═══════════════════════════════════════════════════════════\n");
                
                // Check if Atlas is available
                if (!dualDatabaseManager.isAtlasAvailable()) {
                    Logger.warn("⚠️  Atlas not available yet, will retry...");
                    
                    // Retry mechanism
                    const retryInterval = setInterval(async () => {
                        if (dualDatabaseManager.isAtlasAvailable()) {
                            clearInterval(retryInterval);
                            await performFullSync();
                        }
                    }, 10000); // Retry every 10 seconds
                    
                    return;
                }
                
                await performFullSync();
                
                async function performFullSync() {
                    try {
                        // Perform full sync from Local to Atlas
                        Logger.info("📤 Step 1/2: Syncing Local → Atlas...");
                        const syncResult = await fullSyncService.startFullSync();
                        
                        Logger.info("\n✅ Full sync completed successfully!");
                        Logger.info(`   Collections synced: ${syncResult.collectionsProcessed}`);
                        Logger.info(`   Documents synced: ${syncResult.documentsSynced}`);
                        Logger.info(`   Duration: ${syncResult.durationSeconds}s`);
                        
                        // Now perform bidirectional sync for ongoing changes
                        Logger.info("\n📥 Step 2/2: Starting bidirectional sync (Atlas ⇄ Local)...");
                        const bidirectionalSync = new BidirectionalInitialSync(dualDatabaseManager);
                        const bidirResult = await bidirectionalSync.performBidirectionalSync();
                        
                        if (bidirResult.success) {
                            Logger.info("✅ Bidirectional sync initialized");
                        }
                        
                        Logger.info("\n═══════════════════════════════════════════════════════════");
                        Logger.info("✅ AUTOMATIC FULL SYNC - Completed Successfully!");
                        Logger.info("🔄 Continuous bidirectional sync is now active");
                        Logger.info("═══════════════════════════════════════════════════════════\n");
                        
                        // Start periodic full sync if configured
                        const initialSyncInterval = parseInt(process.env.INITIAL_SYNC_INTERVAL || '0', 10);
                        if (initialSyncInterval > 0) {
                            Logger.info(`⏰ Periodic full sync every ${initialSyncInterval}ms (${initialSyncInterval/1000}s)`);
                            
                            setInterval(async () => {
                                try {
                                    Logger.info("\n🔄 Periodic full sync starting...");
                                    await fullSyncService.startFullSync();
                                    Logger.info("✅ Periodic full sync completed");
                                } catch (error) {
                                    Logger.error("❌ Periodic full sync failed:", error.message);
                                }
                            }, initialSyncInterval);
                        }
                        
                    } catch (error) {
                        Logger.error("\n❌ Full sync failed:", error.message);
                        Logger.warn("⚠️  Will retry on next server restart");
                        Logger.warn("💡 One-way sync (Local → Atlas) will continue for new data");
                    }
                }
                
            } catch (error) {
                Logger.error("❌ Error in automatic sync:", error.message);
            }
        }, 5000); // Wait 5 seconds for Atlas to connect
        
        // Initialize bidirectional sync if enabled (with delay to allow Atlas to connect)
        if (syncConfig.bidirectionalSync.enabled) {
            Logger.info("🔄 Bidirectional sync is enabled");
            Logger.info("   Will initialize after Atlas connection is established...");
            
            // Wait a bit for Atlas to connect, then try to initialize
            setTimeout(async () => {
                try {
                    await initializeBidirectionalSync();
                } catch (error) {
                    Logger.warn("⚠️  Bidirectional sync not available on first attempt");
                    Logger.info("   Reason: " + (error.message || 'Atlas connection not ready'));
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
        } // end if (syncConfig.enabled) for Atlas monitors
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
        Logger.warn("⚠️  Bidirectional sync not available:", error.message);
        Logger.info("📝 Falling back to one-way sync (Local → Atlas)");
        Logger.info("💡 This is normal if you're not using MongoDB Atlas");
        
        // Update Change Stream status to disconnected
        if (bidirectionalSyncMonitor) {
            bidirectionalSyncMonitor.updateChangeStreamStatus('disconnected');
        }
        
        // Log fallback status
        Logger.info("\n📊 Sync Status:");
        Logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        Logger.info(`✅ Status: ONE-WAY SYNC MODE`);
        Logger.info(`🔄 Direction: Local → Atlas (one-way only)`);
        Logger.info(`ℹ️  Bidirectional sync: Not available (requires Atlas)`);
        Logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        
        throw error; // Re-throw to be caught by caller
    }
}

const app = express();
const server = createServer(app);
// API responses are always read from the database; do not allow browser,
// Electron, proxy, or service-worker caches to serve stale data.
app.use("/api", (req, res, next) => {
    res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
    });
    next();
});
const isLanOrigin = (origin) => {
    if (!origin) return true;
    try {
        const url = new URL(origin);
        const host = url.hostname;
        // Allow localhost, private LAN ranges, and vercel
        if (host === "localhost" || host === "127.0.0.1") return true;
        if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
        if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
        if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
    } catch {}
    return false;
};

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (isLanOrigin(origin)) return callback(null, true);
            const allowed = [
                "http://localhost:3000",
                "https://localhost:3000",
                process.env.FRONTEND_URL || "http://localhost:3000",
            ];
            if (allowed.includes(origin) || /\.vercel\.app$/.test(origin)) return callback(null, true);
            return callback(null, true); // Allow all for LAN sync namespace (device auth handles security)
        },
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true,
    },
});

// [SECURITY] Socket.IO authentication middleware
io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
        return next(new Error("Authentication required"));
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.data.userId = decoded.id;
        socket.data.role = decoded.role;
        socket.data.organization = decoded.organization;
        next();
    } catch (err) {
        next(new Error("Invalid token"));
    }
});

// إعدادات CORS مبسطة
const corsOptions = {
    origin: function (origin, callback) {
        // السماح بالـ LAN دائما (للأجهزة على نفس الشبكة)
        if (isLanOrigin(origin)) return callback(null, true);
        // السماح بجميع المنشآت في وضع التطوير
        if (process.env.NODE_ENV === "development") {
            return callback(null, true);
        }

        // قائمة بالمنشآت المسموح بها في الإنتاج
        const allowedOrigins = [
            "http://localhost:3000",
            "http://localhost:5173",
            "https://bomba-iota.vercel.app",
            /\.vercel\.app$/, // يسمح بجميع النطاقات الفرعية من vercel.app
            process.env.FRONTEND_URL, // desktop mode (127.0.0.1)
        ].filter(Boolean);

        // السماح بالطلبات بدون origin (مثل فحص الصحة من سطح المكتب)
        // في وضع سطح المكتب يرسل Electron طلبات health بدون Origin header
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

// Compression - مستوى 4 + threshold 10KB لتقليل CPU بلا قص بيانات
app.use(compression({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    },
    level: 4,
    threshold: 10240
}));

// Security middleware
const desktopMode = !!process.env.DESKTOP_DIST_PATH;
app.use(
    helmet({
        crossOriginEmbedderPolicy: false,
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                connectSrc: ["'self'", "http://127.0.0.1:9100", "http://localhost:9100"],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    ...(desktopMode ? ["https://fonts.googleapis.com", "https://fonts.gstatic.com"] : []),
                ],
                // Desktop serves a local SPA with an inline bootstrap script
                scriptSrc: ["'self'", ...(desktopMode ? ["'unsafe-inline'"] : [])],
                imgSrc: ["'self'", "data:", "https:"],
            },
        },
    })
);

// Trust proxy (for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

// Health check endpoint (before middleware for fast response)
app.get("/health", (req, res) => {
    const ready = serverReady && mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({
        status: ready ? "success" : "starting",
        message: ready ? "Server is running" : "Server starting up",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || "development",
        ready,
        dbConnected: mongoose.connection.readyState === 1,
    });
});

// LAN sync health (public, for peer discovery over LAN)
app.get("/api/lan/health", (req, res) => {
    try {
        const lanStatus = global.lanSyncService ? global.lanSyncService.getStatus() : { enabled: !!syncConfig.lanSync?.enabled, isRunning: false };
        const discStatus = global.lanDiscovery ? global.lanDiscovery.getStatus() : null;
        res.json({ success: true, lan: lanStatus, discovery: discStatus, timestamp: new Date().toISOString() });
    } catch (e) {
        res.json({ success: true, lan: { enabled: !!syncConfig.lanSync?.enabled }, error: e.message });
    }
});
app.get("/api/lan/status", (req, res) => {
    try {
        const s = global.lanSyncService ? global.lanSyncService.getStatus() : { enabled: !!syncConfig.lanSync?.enabled };
        res.json({ success: true, ...s });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Request logging
app.use(requestLogger);

// Performance monitoring
app.use(performanceMonitor);

// Rate limiting
app.use("/api/", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// Body parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files
app.use("/uploads", express.static("uploads"));
app.use("/temp", express.static("temp"));
app.use("/public", express.static("public"));
app.use("/organizations", express.static("public/organizations"));

// Socket.IO setup
setupSocketIO(io);
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Auto-complete stale kitchen orders (runs even with the kitchen screen closed)
startAutoOrderCompleter(io);

// Root route
app.get("/", (req, res) => {
    if (process.env.DESKTOP_DIST_PATH) {
        // Desktop mode: redirect to the SPA (served by the static block below)
        return res.redirect("/login");
    }
    res.status(200).json({
        message: "Bomba API is running",
        status: "success",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
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
app.use("/api/upgrades", upgradeRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/warehouse", warehouseRoutes);
app.use("/api/invites", inviteRoutes);
app.use("/api/print", printRoutes);
app.use("/api/backup", backupRoutes);
app.use("/public", publicRoutes);

// Desktop app static serving (enabled only when DESKTOP_DIST_PATH is set)
if (process.env.DESKTOP_DIST_PATH) {
    const pathModule = await import("path");
    const fsModule = await import("fs");
    const distDir = pathModule.resolve(process.env.DESKTOP_DIST_PATH);

    if (fsModule.existsSync(distDir)) {
        app.use(express.static(distDir));

        // SPA fallback - exclude API and socket paths
        app.get("*", (req, res, next) => {
            if (
                req.path.startsWith("/api") ||
                req.path.startsWith("/socket.io") ||
                req.path.startsWith("/uploads") ||
                req.path.startsWith("/temp") ||
                req.path.startsWith("/public") ||
                req.path.startsWith("/health")
            ) {
                return next();
            }
            res.sendFile(pathModule.join(distDir, "index.html"));
        });

        Logger.info(`🖥️ Desktop mode: serving frontend from ${distDir}`);
    } else {
        Logger.warn(
            `⚠️ Desktop mode enabled but dist path not found: ${distDir}`
        );
    }
}

// REMOVED: Public bill viewing route for security reasons
// Bills should only be accessible through authenticated routes

// Error handling middleware
app.use(errorLogger);
app.use(notFound);
app.use(errorHandler);

// Add request debugging for order routes
app.use("/api/orders", (req, res, next) => {
    next();
});

const PORT = process.env.PORT || 5000;

// Global readiness flag for /health endpoint
let serverReady = false;

server.listen(PORT, async () => {
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

    // Mark server as ready for health checks (lightweight)
    serverReady = true;

    // Initialize scheduled tasks
    if (process.env.NODE_ENV === "production") {
        initializeScheduler();
        Logger.info("✅ Scheduler initialized in production mode");
    } else {
        initializeScheduler();
        Logger.info("✅ Scheduler initialized in development mode");
    }

    // Initialize LAN sync (B+C) after server is listening
    if (syncConfig.lanSync?.enabled) {
        try {
            Logger.info("🔄 Initializing LAN sync (B+C)...");
            const waitForDB = async () => {
                for (let i = 0; i < 10; i++) {
                    if (mongoose.connection.readyState === 1) return true;
                    await new Promise(r => setTimeout(r, 500));
                }
                return false;
            };
            const dbReady = await waitForDB();
            if (!dbReady) Logger.warn("⚠️  LAN sync: DB not ready, starting anyway");
            await lanSyncService.start(server, io);
            global.lanSyncService = lanSyncService;
            global.lanDiscovery = lanDiscovery;
            Logger.info("✅ LAN sync initialized");
        } catch (e) {
            Logger.error("❌ LAN sync failed to start:", e.message);
        }
    } else {
        Logger.info("ℹ️  LAN sync disabled (set LAN_SYNC_ENABLED=true to enable)");
    }

    // 🔧 HEAVY TASKS IN BACKGROUND — لا تحجب أول استجابة /health
    setImmediate(async () => {
        try {
            const { default: Bill } = await import('./models/Bill.js');
            const result = await Bill.updateMany(
                { status: 'paid', $expr: { $or: [{ $ne: ['$paid', '$total'] }, { $gt: ['$remaining', 0.01] }] } },
                [{ $set: { paid: '$total', remaining: 0 } }]
            );
            if (result.modifiedCount > 0) Logger.info(`✅ Fixed ${result.modifiedCount} paid bills (background)`);
        } catch (e) { Logger.error("Background bill fix failed:", e.message); }
    });

    // 🔄 SYNC INIT IN BACKGROUND — يبدأ بعد 30ث لضمان جاهزية Atlas
    setTimeout(async () => {
        if (!syncConfig.enabled && !syncConfig.lanSync?.enabled) return;
        if (global.__syncApplied) return;
        try {
            Logger.info("🔄 Initializing sync system (background)...");
            if (!global.__syncApplied) { applySyncToAllModels(); global.__syncApplied = true; }

            if (syncConfig.enabled) {
                try {
                    const loadedCount = await syncQueueManager.loadFromDisk();
                    if (loadedCount > 0) Logger.info(`📂 Loaded ${loadedCount} ops from queue`);
                } catch (e) { Logger.error("Queue load failed:", e.message); }
                syncWorker.start();
                syncMonitor.logStatus();
            }
            Logger.info("✅ Sync system initialized (background)");
        } catch (e) { Logger.error("Background sync init failed:", e.message); }
    }, 30000); // 30 ثانية بعد الاستماع
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    Logger.info(`${signal} received, shutting down gracefully`);
    
    // إيقاف مراقب المزامنة
    if (syncStatusMonitor.isRunning) {
        syncStatusMonitor.stop();
    }
    
    // Stop LAN sync if enabled
    if (syncConfig.lanSync?.enabled) {
        try {
            Logger.info("🛑 Stopping LAN sync...");
            if (global.lanSyncService) await global.lanSyncService.stop();
            else {
                const { default: lanSvc } = await import("./services/sync/lanSyncService.js");
                await lanSvc.stop();
            }
            Logger.info("✅ LAN sync stopped");
        } catch (e) {
            Logger.error("❌ Error stopping LAN sync:", e.message);
        }
    }

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
