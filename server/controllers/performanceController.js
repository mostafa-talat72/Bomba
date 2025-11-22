import performanceMetrics from "../utils/performanceMetrics.js";
import Logger from "../middleware/logger.js";

/**
 * @desc    Get performance statistics
 * @route   GET /api/performance/stats
 * @access  Private (Admin only)
 */
export const getPerformanceStats = async (req, res) => {
    try {
        const { timeRange = 3600000 } = req.query; // Default: last hour

        const stats = performanceMetrics.getStats(parseInt(timeRange));

        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        Logger.error("خطأ في جلب إحصائيات الأداء", {
            error: error.message,
        });
        res.status(500).json({
            success: false,
            message: "خطأ في جلب إحصائيات الأداء",
            error: error.message,
        });
    }
};

/**
 * @desc    Get recent performance metrics
 * @route   GET /api/performance/metrics
 * @access  Private (Admin only)
 */
export const getRecentMetrics = async (req, res) => {
    try {
        const { limit = 100 } = req.query;

        const metrics = performanceMetrics.getRecentMetrics(parseInt(limit));

        res.json({
            success: true,
            data: metrics,
        });
    } catch (error) {
        Logger.error("خطأ في جلب مقاييس الأداء", {
            error: error.message,
        });
        res.status(500).json({
            success: false,
            message: "خطأ في جلب مقاييس الأداء",
            error: error.message,
        });
    }
};

/**
 * @desc    Clear performance metrics
 * @route   DELETE /api/performance/metrics
 * @access  Private (Admin only)
 */
export const clearMetrics = async (req, res) => {
    try {
        performanceMetrics.clear();

        Logger.info("تم مسح مقاييس الأداء", {
            userId: req.user._id,
            userName: req.user.name,
        });

        res.json({
            success: true,
            message: "تم مسح مقاييس الأداء بنجاح",
        });
    } catch (error) {
        Logger.error("خطأ في مسح مقاييس الأداء", {
            error: error.message,
        });
        res.status(500).json({
            success: false,
            message: "خطأ في مسح مقاييس الأداء",
            error: error.message,
        });
    }
};

/**
 * @desc    Get performance dashboard data
 * @route   GET /api/performance/dashboard
 * @access  Private (Admin only)
 */
export const getPerformanceDashboard = async (req, res) => {
    try {
        const { timeRange = 3600000 } = req.query; // Default: last hour

        const stats = performanceMetrics.getStats(parseInt(timeRange));
        const recentMetrics = performanceMetrics.getRecentMetrics(50);

        // Calculate additional insights
        const insights = {
            healthStatus: _calculateHealthStatus(stats),
            recommendations: _generateRecommendations(stats),
            trends: _calculateTrends(recentMetrics),
        };

        res.json({
            success: true,
            data: {
                stats,
                insights,
                recentSlowRequests: recentMetrics.slowRequests.slice(-10),
                recentLargeResponses: recentMetrics.largeResponses.slice(-10),
            },
        });
    } catch (error) {
        Logger.error("خطأ في جلب لوحة معلومات الأداء", {
            error: error.message,
        });
        res.status(500).json({
            success: false,
            message: "خطأ في جلب لوحة معلومات الأداء",
            error: error.message,
        });
    }
};

/**
 * Calculate overall health status
 */
function _calculateHealthStatus(stats) {
    const avgApiTime = stats.apiPerformance.average;
    const avgQueryTime = stats.queryPerformance.average;
    const compressionRate = stats.compressionStats.compressionRate;

    let status = "excellent";
    let score = 100;

    // Deduct points for slow API responses
    if (avgApiTime > 500) score -= 20;
    if (avgApiTime > 1000) score -= 30;

    // Deduct points for slow queries
    if (avgQueryTime > 200) score -= 15;
    if (avgQueryTime > 500) score -= 25;

    // Deduct points for low compression rate
    if (compressionRate < 50) score -= 10;
    if (compressionRate < 30) score -= 20;

    if (score >= 80) status = "excellent";
    else if (score >= 60) status = "good";
    else if (score >= 40) status = "fair";
    else status = "poor";

    return {
        status,
        score,
        avgApiTime,
        avgQueryTime,
        compressionRate,
    };
}

/**
 * Generate performance recommendations
 */
function _generateRecommendations(stats) {
    const recommendations = [];

    // API performance recommendations
    if (stats.apiPerformance.average > 1000) {
        recommendations.push({
            type: "warning",
            category: "API Performance",
            message: "متوسط وقت استجابة API بطيء (> 1000ms)",
            suggestion: "راجع الاستعلامات البطيئة وأضف فهارس قاعدة البيانات",
        });
    }

    // Query performance recommendations
    if (stats.queryPerformance.average > 500) {
        recommendations.push({
            type: "warning",
            category: "Database Performance",
            message: "متوسط وقت تنفيذ الاستعلامات بطيء (> 500ms)",
            suggestion: "تحقق من الفهارس واستخدم .lean() للاستعلامات للقراءة فقط",
        });
    }

    // Compression recommendations
    if (stats.compressionStats.compressionRate < 50) {
        recommendations.push({
            type: "info",
            category: "Compression",
            message: "معدل الضغط منخفض (< 50%)",
            suggestion: "تأكد من تفعيل ضغط gzip لجميع الاستجابات",
        });
    }

    // Slow requests
    if (stats.slowRequests && stats.slowRequests.length > 10) {
        recommendations.push({
            type: "warning",
            category: "Slow Requests",
            message: `تم اكتشاف ${stats.slowRequests.length} طلب بطيء`,
            suggestion: "راجع الطلبات البطيئة وحسّن الأداء",
        });
    }

    // Large responses
    if (stats.largeResponses && stats.largeResponses.length > 5) {
        recommendations.push({
            type: "info",
            category: "Large Responses",
            message: `تم اكتشاف ${stats.largeResponses.length} استجابة كبيرة`,
            suggestion: "استخدم التصفية والترقيم لتقليل حجم الاستجابات",
        });
    }

    if (recommendations.length === 0) {
        recommendations.push({
            type: "success",
            category: "Overall",
            message: "الأداء ممتاز!",
            suggestion: "استمر في مراقبة الأداء بانتظام",
        });
    }

    return recommendations;
}

/**
 * Calculate performance trends
 */
function _calculateTrends(recentMetrics) {
    const apiCalls = recentMetrics.apiCalls || [];

    if (apiCalls.length < 10) {
        return {
            trend: "insufficient_data",
            message: "بيانات غير كافية لحساب الاتجاهات",
        };
    }

    // Split into two halves to compare
    const midpoint = Math.floor(apiCalls.length / 2);
    const firstHalf = apiCalls.slice(0, midpoint);
    const secondHalf = apiCalls.slice(midpoint);

    const avgFirst =
        firstHalf.reduce((sum, call) => sum + call.duration, 0) /
        firstHalf.length;
    const avgSecond =
        secondHalf.reduce((sum, call) => sum + call.duration, 0) /
        secondHalf.length;

    const change = ((avgSecond - avgFirst) / avgFirst) * 100;

    let trend = "stable";
    let message = "الأداء مستقر";

    if (change > 20) {
        trend = "degrading";
        message = `الأداء يتدهور (${change.toFixed(1)}% أبطأ)`;
    } else if (change < -20) {
        trend = "improving";
        message = `الأداء يتحسن (${Math.abs(change).toFixed(1)}% أسرع)`;
    }

    return {
        trend,
        message,
        change: change.toFixed(1),
        avgFirst: Math.round(avgFirst),
        avgSecond: Math.round(avgSecond),
    };
}

export default {
    getPerformanceStats,
    getRecentMetrics,
    clearMetrics,
    getPerformanceDashboard,
};
