/**
 * Performance Metrics Collection Utility
 * Stores and aggregates performance data for monitoring
 */

class PerformanceMetrics {
    constructor() {
        this.metrics = {
            apiCalls: [],
            queries: [],
            slowRequests: [],
            largeResponses: [],
        };
        this.maxStoredMetrics = 1000; // Keep last 1000 metrics
    }

    /**
     * Record an API call metric
     */
    recordApiCall(data) {
        const metric = {
            timestamp: new Date(),
            ...data,
        };

        this.metrics.apiCalls.push(metric);

        // Track slow requests (> 1000ms)
        if (data.duration > 1000) {
            this.metrics.slowRequests.push(metric);
        }

        // Track large responses (> 100KB)
        if (data.responseSize && data.responseSize > 100 * 1024) {
            this.metrics.largeResponses.push(metric);
        }

        // Cleanup old metrics
        this._cleanup();
    }

    /**
     * Record a database query metric
     */
    recordQuery(data) {
        const metric = {
            timestamp: new Date(),
            ...data,
        };

        this.metrics.queries.push(metric);
        this._cleanup();
    }

    /**
     * Get performance statistics
     */
    getStats(timeRange = 3600000) {
        // Default: last hour (3600000ms)
        const now = Date.now();
        const cutoff = now - timeRange;

        const recentApiCalls = this.metrics.apiCalls.filter(
            (m) => m.timestamp.getTime() > cutoff
        );
        const recentQueries = this.metrics.queries.filter(
            (m) => m.timestamp.getTime() > cutoff
        );

        // Calculate API statistics
        const apiStats = this._calculateStats(
            recentApiCalls.map((m) => m.duration)
        );
        const queryStats = this._calculateStats(
            recentQueries.map((m) => m.executionTime)
        );

        // Group by endpoint
        const endpointStats = this._groupByEndpoint(recentApiCalls);

        // Compression statistics
        const compressionStats = this._calculateCompressionStats(recentApiCalls);

        return {
            timeRange: `${timeRange / 1000}s`,
            totalApiCalls: recentApiCalls.length,
            totalQueries: recentQueries.length,
            apiPerformance: {
                average: apiStats.average,
                median: apiStats.median,
                min: apiStats.min,
                max: apiStats.max,
                p95: apiStats.p95,
                p99: apiStats.p99,
            },
            queryPerformance: {
                average: queryStats.average,
                median: queryStats.median,
                min: queryStats.min,
                max: queryStats.max,
                p95: queryStats.p95,
                p99: queryStats.p99,
            },
            endpointStats,
            compressionStats,
            slowRequests: this.metrics.slowRequests.slice(-50), // Last 50 slow requests
            largeResponses: this.metrics.largeResponses.slice(-50), // Last 50 large responses
        };
    }

    /**
     * Get recent metrics
     */
    getRecentMetrics(limit = 100) {
        return {
            apiCalls: this.metrics.apiCalls.slice(-limit),
            queries: this.metrics.queries.slice(-limit),
            slowRequests: this.metrics.slowRequests.slice(-limit),
            largeResponses: this.metrics.largeResponses.slice(-limit),
        };
    }

    /**
     * Clear all metrics
     */
    clear() {
        this.metrics = {
            apiCalls: [],
            queries: [],
            slowRequests: [],
            largeResponses: [],
        };
    }

    /**
     * Calculate statistics from an array of numbers
     */
    _calculateStats(values) {
        if (values.length === 0) {
            return {
                average: 0,
                median: 0,
                min: 0,
                max: 0,
                p95: 0,
                p99: 0,
            };
        }

        const sorted = values.sort((a, b) => a - b);
        const sum = sorted.reduce((acc, val) => acc + val, 0);

        return {
            average: Math.round(sum / sorted.length),
            median: this._percentile(sorted, 50),
            min: sorted[0],
            max: sorted[sorted.length - 1],
            p95: this._percentile(sorted, 95),
            p99: this._percentile(sorted, 99),
        };
    }

    /**
     * Calculate percentile
     */
    _percentile(sortedArray, percentile) {
        const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
        return sortedArray[index] || 0;
    }

    /**
     * Group metrics by endpoint
     */
    _groupByEndpoint(apiCalls) {
        const grouped = {};

        apiCalls.forEach((call) => {
            const endpoint = call.url || "unknown";
            if (!grouped[endpoint]) {
                grouped[endpoint] = {
                    count: 0,
                    totalDuration: 0,
                    durations: [],
                };
            }

            grouped[endpoint].count++;
            grouped[endpoint].totalDuration += call.duration;
            grouped[endpoint].durations.push(call.duration);
        });

        // Calculate stats for each endpoint
        const stats = {};
        Object.keys(grouped).forEach((endpoint) => {
            const data = grouped[endpoint];
            stats[endpoint] = {
                count: data.count,
                averageDuration: Math.round(data.totalDuration / data.count),
                ...this._calculateStats(data.durations),
            };
        });

        return stats;
    }

    /**
     * Calculate compression statistics
     */
    _calculateCompressionStats(apiCalls) {
        const compressed = apiCalls.filter((call) => call.compressed);
        const uncompressed = apiCalls.filter((call) => !call.compressed);

        const totalSize = apiCalls.reduce(
            (sum, call) => sum + (call.responseSize || 0),
            0
        );
        const compressedSize = compressed.reduce(
            (sum, call) => sum + (call.responseSize || 0),
            0
        );

        return {
            totalRequests: apiCalls.length,
            compressedRequests: compressed.length,
            uncompressedRequests: uncompressed.length,
            compressionRate: apiCalls.length > 0
                ? Math.round((compressed.length / apiCalls.length) * 100)
                : 0,
            totalDataSize: `${(totalSize / 1024).toFixed(2)} KB`,
            compressedDataSize: `${(compressedSize / 1024).toFixed(2)} KB`,
        };
    }

    /**
     * Cleanup old metrics to prevent memory issues
     */
    _cleanup() {
        if (this.metrics.apiCalls.length > this.maxStoredMetrics) {
            this.metrics.apiCalls = this.metrics.apiCalls.slice(
                -this.maxStoredMetrics
            );
        }
        if (this.metrics.queries.length > this.maxStoredMetrics) {
            this.metrics.queries = this.metrics.queries.slice(
                -this.maxStoredMetrics
            );
        }
        if (this.metrics.slowRequests.length > 100) {
            this.metrics.slowRequests = this.metrics.slowRequests.slice(-100);
        }
        if (this.metrics.largeResponses.length > 100) {
            this.metrics.largeResponses = this.metrics.largeResponses.slice(-100);
        }
    }
}

// Singleton instance
const performanceMetrics = new PerformanceMetrics();

export default performanceMetrics;
