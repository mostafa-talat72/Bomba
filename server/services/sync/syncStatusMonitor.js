import Logger from '../../middleware/logger.js';
import syncConfig from '../../config/syncConfig.js';
import syncQueueManager from './syncQueueManager.js';
import syncWorker from './syncWorker.js';
import dualDatabaseManager from '../../config/dualDatabaseManager.js';
import bidirectionalSyncMonitor from './bidirectionalSyncMonitor.js';

/**
 * Sync Status Monitor
 * يراقب ويطبع حالة المزامنة عند حدوث تغييرات فقط
 */
class SyncStatusMonitor {
    constructor() {
        this.monitorInterval = null;
        this.updateInterval = 1000; // فحص كل ثانية
        this.isRunning = false;
        this.lastStats = null;
        this.lastPrintTime = null;
        this.minPrintInterval = 2000; // الحد الأدنى بين الطباعات (2 ثانية)
    }

    /**
     * بدء المراقبة
     * @param {number} checkInterval - فترة الفحص (بالميلي ثانية) - افتراضي 1000ms
     */
    start(checkInterval = 1000) {
        if (this.isRunning) {
            Logger.warn('⚠️  المراقب يعمل بالفعل');
            return;
        }

        this.updateInterval = checkInterval;
        this.isRunning = true;

        Logger.info('\n╔════════════════════════════════════════════════════════════╗');
        Logger.info('║      🔍 Real-time Sync Monitor Active (On Change)        ║');
        Logger.info('╚════════════════════════════════════════════════════════════╝\n');

        // Print initial status immediately
        this.printStatus();
        this.lastPrintTime = Date.now();

        // Schedule periodic checking
        this.monitorInterval = setInterval(() => {
            this.checkForChanges();
        }, this.updateInterval);

        Logger.info(`✅ Monitor active - will print when sync changes occur\n`);
    }

    /**
     * فحص التغييرات وطباعة الحالة إذا حدث تغيير
     */
    checkForChanges() {
        if (!this.isRunning) {
            return;
        }

        const currentStats = this.getCurrentStats();
        
        // إذا لم يكن هناك إحصائيات سابقة، احفظها فقط
        if (!this.lastStats) {
            this.lastStats = currentStats;
            return;
        }

        // فحص إذا حدث تغيير
        const hasChanged = this.detectChanges(this.lastStats, currentStats);
        
        if (hasChanged) {
            // تحقق من الحد الأدنى للوقت بين الطباعات
            const now = Date.now();
            if (!this.lastPrintTime || (now - this.lastPrintTime) >= this.minPrintInterval) {
                this.printStatus();
                this.lastPrintTime = now;
            }
        }

        // تحديث الإحصائيات السابقة
        this.lastStats = currentStats;
    }

    /**
     * الحصول على الإحصائيات الحالية
     */
    getCurrentStats() {
        const queueStats = syncQueueManager.getStats();
        const workerStats = syncWorker.getStats();
        
        return {
            queueSize: queueStats.size,
            totalProcessed: workerStats.totalProcessed,
            successCount: workerStats.successCount,
            failureCount: workerStats.failureCount,
            isRunning: workerStats.isRunning,
            isPaused: workerStats.isPaused,
            atlasAvailable: dualDatabaseManager.isAtlasAvailable(),
            localAvailable: dualDatabaseManager.isLocalAvailable()
        };
    }

    /**
     * كشف التغييرات بين الإحصائيات
     */
    detectChanges(oldStats, newStats) {
        // تغيير في حجم القائمة
        if (oldStats.queueSize !== newStats.queueSize) {
            return true;
        }

        // تغيير في عدد العمليات المعالجة
        if (oldStats.totalProcessed !== newStats.totalProcessed) {
            return true;
        }

        // تغيير في عدد العمليات الناجحة
        if (oldStats.successCount !== newStats.successCount) {
            return true;
        }

        // تغيير في عدد العمليات الفاشلة
        if (oldStats.failureCount !== newStats.failureCount) {
            return true;
        }

        // تغيير في حالة Worker
        if (oldStats.isRunning !== newStats.isRunning || 
            oldStats.isPaused !== newStats.isPaused) {
            return true;
        }

        // تغيير في حالة الاتصالات
        if (oldStats.atlasAvailable !== newStats.atlasAvailable || 
            oldStats.localAvailable !== newStats.localAvailable) {
            return true;
        }

        return false;
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (!this.isRunning) {
            Logger.warn('⚠️  Monitor is not running');
            return;
        }

        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }

        this.isRunning = false;
        Logger.info('\n🛑 Sync monitor stopped\n');
    }

    /**
     * Print sync status
     */
    printStatus() {
        const now = new Date();
        const timestamp = now.toLocaleString('en-US', { 
            timeZone: 'Africa/Cairo',
            hour12: true 
        });

        // Collect data
        const queueStats = syncQueueManager.getStats();
        const workerStats = syncWorker.getStats();
        const syncLag = syncQueueManager.getSyncLag();
        const atlasAvailable = dualDatabaseManager.isAtlasAvailable();
        const localAvailable = dualDatabaseManager.isLocalAvailable();

        // Calculate sync rate
        const syncRate = this.calculateSyncRate(workerStats);

        console.log('\n┌─────────────────────────────────────────────────────────────┐');
        console.log(`│ 🕐 Time: ${timestamp.padEnd(48)} │`);
        console.log('├─────────────────────────────────────────────────────────────┤');
        
        // Connection status
        console.log('│ 📡 Connection Status:                                       │');
        console.log(`│    Local MongoDB:  ${this.getStatusIcon(localAvailable)} ${localAvailable ? 'Connected' : 'Disconnected'}`.padEnd(62) + '│');
        console.log(`│    Atlas MongoDB:  ${this.getStatusIcon(atlasAvailable)} ${atlasAvailable ? 'Connected' : 'Disconnected'}`.padEnd(62) + '│');
        console.log('├─────────────────────────────────────────────────────────────┤');

        // Sync status
        console.log('│ 🔄 Sync Status:                                             │');
        console.log(`│    Direction: Local ⇄ Atlas (bidirectional)`.padEnd(62) + '│');
        console.log(`│    Status: ${this.getSyncStatusIcon(workerStats, atlasAvailable)} ${this.getSyncStatus(workerStats, atlasAvailable)}`.padEnd(62) + '│');
        console.log(`│    Speed: ${syncConfig.workerInterval === 0 ? '⚡ Instant (0ms)' : `${syncConfig.workerInterval}ms`}`.padEnd(62) + '│');
        console.log('├─────────────────────────────────────────────────────────────┤');

        // Queue statistics
        console.log('│ 📦 Queue:                                                    │');
        console.log(`│    Current Size: ${queueStats.size} / ${queueStats.maxSize}`.padEnd(62) + '│');
        console.log(`│    Usage: ${this.getProgressBar(queueStats.size, queueStats.maxSize)} ${queueStats.utilizationPercent}%`.padEnd(62) + '│');
        
        if (syncLag !== null) {
            const lagSeconds = (syncLag / 1000).toFixed(1);
            const lagStatus = syncLag > 5000 ? '⚠️' : '✅';
            console.log(`│    Lag: ${lagStatus} ${lagSeconds}s`.padEnd(62) + '│');
        }
        console.log('├─────────────────────────────────────────────────────────────┤');

        // Operations statistics
        console.log('│ 📊 Operations Stats:                                        │');
        console.log(`│    Total Processed: ${workerStats.totalProcessed}`.padEnd(62) + '│');
        console.log(`│    Successful: ✅ ${workerStats.successCount} (${workerStats.successRate}%)`.padEnd(62) + '│');
        console.log(`│    Failed: ❌ ${workerStats.failureCount} (${workerStats.failureRate}%)`.padEnd(62) + '│');
        console.log(`│    Avg Time: ${workerStats.avgProcessTime.toFixed(2)}ms`.padEnd(62) + '│');
        
        if (syncRate !== null) {
            console.log(`│    Sync Rate: ${syncRate} ops/sec`.padEnd(62) + '│');
        }
        console.log('├─────────────────────────────────────────────────────────────┤');

        // Operations by type
        if (Object.keys(queueStats.byType).length > 0) {
            console.log('│ 📝 Pending Operations:                                      │');
            if (queueStats.byType.insert) {
                console.log(`│    ➕ Insert: ${queueStats.byType.insert}`.padEnd(62) + '│');
            }
            if (queueStats.byType.update) {
                console.log(`│    🔄 Update: ${queueStats.byType.update}`.padEnd(62) + '│');
            }
            if (queueStats.byType.delete) {
                console.log(`│    🗑️  Delete: ${queueStats.byType.delete}`.padEnd(62) + '│');
            }
            console.log('├─────────────────────────────────────────────────────────────┤');
        }

        // Bidirectional sync
        if (syncConfig.bidirectionalSync.enabled) {
            const bidirStats = this.getBidirectionalStats();
            console.log('│ 🔄 Bidirectional Sync (Atlas → Local):                     │');
            console.log(`│    Status: ${bidirStats.status}`.padEnd(62) + '│');
            console.log(`│    Changes Received: ${bidirStats.totalChanges}`.padEnd(62) + '│');
            console.log(`│    Processed: ✅ ${bidirStats.processedChanges} | ❌ ${bidirStats.failedChanges}`.padEnd(62) + '│');
            console.log('├─────────────────────────────────────────────────────────────┤');
        }

        // Warnings
        const warnings = this.getWarnings(queueStats, workerStats, syncLag, atlasAvailable);
        if (warnings.length > 0) {
            console.log('│ ⚠️  Warnings:                                                │');
            warnings.forEach(warning => {
                console.log(`│    ${warning}`.padEnd(62) + '│');
            });
            console.log('├─────────────────────────────────────────────────────────────┤');
        }

        // Overall status
        const overallStatus = this.getOverallStatus(workerStats, queueStats, atlasAvailable);
        console.log(`│ ${overallStatus.icon} Overall Status: ${overallStatus.text}`.padEnd(62) + '│');
        console.log('└─────────────────────────────────────────────────────────────┘\n');

        // Save stats for comparison
        this.lastStats = workerStats;
    }

    /**
     * حساب معدل المزامنة
     */
    calculateSyncRate(currentStats) {
        if (!this.lastStats) {
            return null;
        }

        const processed = currentStats.totalProcessed - this.lastStats.totalProcessed;
        const timeSeconds = this.updateInterval / 1000;
        
        if (processed === 0) {
            return null;
        }
        
        return (processed / timeSeconds).toFixed(2);
    }

    /**
     * الحصول على أيقونة الحالة
     */
    getStatusIcon(isAvailable) {
        return isAvailable ? '🟢' : '🔴';
    }

    /**
     * الحصول على أيقونة حالة المزامنة
     */
    getSyncStatusIcon(workerStats, atlasAvailable) {
        if (!workerStats.isRunning) return '🔴';
        if (workerStats.isPaused) return '⏸️';
        if (!atlasAvailable) return '⚠️';
        return '🟢';
    }

    /**
     * Get sync status text
     */
    getSyncStatus(workerStats, atlasAvailable) {
        if (!workerStats.isRunning) return 'Stopped';
        if (workerStats.isPaused) return 'Paused';
        if (!atlasAvailable) return 'Waiting for Atlas';
        return 'Active ⚡';
    }

    /**
     * رسم شريط التقدم
     */
    getProgressBar(current, max, length = 20) {
        const percentage = (current / max) * 100;
        const filled = Math.round((current / max) * length);
        const empty = length - filled;
        
        let bar = '[';
        bar += '█'.repeat(filled);
        bar += '░'.repeat(empty);
        bar += ']';
        
        return bar;
    }

    /**
     * Get bidirectional sync stats
     */
    getBidirectionalStats() {
        if (!global.atlasChangeListener) {
            return {
                status: '🔴 Inactive',
                totalChanges: 0,
                processedChanges: 0,
                failedChanges: 0
            };
        }

        const stats = global.atlasChangeListener.getStats();
        const statusIcon = stats.isRunning ? '🟢' : '🔴';
        const statusText = stats.isRunning ? 'Active' : 'Stopped';

        return {
            status: `${statusIcon} ${statusText}`,
            totalChanges: stats.totalChanges || 0,
            processedChanges: stats.processedChanges || 0,
            failedChanges: stats.failedChanges || 0
        };
    }

    /**
     * Get warnings
     */
    getWarnings(queueStats, workerStats, syncLag, atlasAvailable) {
        const warnings = [];

        if (!atlasAvailable) {
            warnings.push('⚠️  Atlas disconnected - operations queued');
        }

        if (queueStats.size > syncConfig.queueWarningThreshold) {
            warnings.push(`⚠️  Large queue size: ${queueStats.size}`);
        }

        if (syncLag && syncLag > syncConfig.lagWarningThreshold) {
            warnings.push(`⚠️  High lag: ${(syncLag / 1000).toFixed(1)}s`);
        }

        if (workerStats.failureRate > 10) {
            warnings.push(`⚠️  High failure rate: ${workerStats.failureRate}%`);
        }

        if (workerStats.isPaused) {
            warnings.push('⏸️  Sync paused');
        }

        return warnings;
    }

    /**
     * Get overall status
     */
    getOverallStatus(workerStats, queueStats, atlasAvailable) {
        // Excellent health
        if (workerStats.isRunning && 
            atlasAvailable && 
            queueStats.size < 100 && 
            workerStats.failureRate < 5) {
            return { icon: '✅', text: 'Excellent - Everything working perfectly' };
        }

        // Good health
        if (workerStats.isRunning && 
            atlasAvailable && 
            queueStats.size < syncConfig.queueWarningThreshold) {
            return { icon: '🟢', text: 'Good - Sync working normally' };
        }

        // Fair health
        if (workerStats.isRunning && 
            (queueStats.size > syncConfig.queueWarningThreshold || !atlasAvailable)) {
            return { icon: '⚠️', text: 'Fair - Some delay detected' };
        }

        // Poor health
        if (!workerStats.isRunning || workerStats.failureRate > 20) {
            return { icon: '🔴', text: 'Needs attention - Issues detected' };
        }

        return { icon: '🟡', text: 'Unknown' };
    }

    /**
     * Change check interval
     */
    setUpdateInterval(interval) {
        this.updateInterval = interval;
        
        if (this.isRunning) {
            this.stop();
            this.start(interval);
        }
    }

    /**
     * Change minimum print interval
     */
    setMinPrintInterval(interval) {
        this.minPrintInterval = interval;
        Logger.info(`✅ Minimum print interval set to ${interval}ms`);
    }

    /**
     * Print quick summary
     */
    printQuickSummary() {
        const queueStats = syncQueueManager.getStats();
        const workerStats = syncWorker.getStats();
        const atlasAvailable = dualDatabaseManager.isAtlasAvailable();

        console.log(`\n⚡ Quick Summary: Queue: ${queueStats.size} | Processed: ${workerStats.totalProcessed} | Success: ${workerStats.successRate}% | Atlas: ${atlasAvailable ? '✅' : '❌'}\n`);
    }

    /**
     * Print on specific change
     */
    printOnChange(changeType, details) {
        const now = Date.now();
        
        // Check minimum time
        if (this.lastPrintTime && (now - this.lastPrintTime) < this.minPrintInterval) {
            return;
        }

        Logger.info(`\n🔔 Sync Change: ${changeType}`);
        if (details) {
            Logger.info(`   Details: ${details}`);
        }
        
        this.printStatus();
        this.lastPrintTime = now;
    }
}

// تصدير instance واحد
const syncStatusMonitor = new SyncStatusMonitor();
export default syncStatusMonitor;
