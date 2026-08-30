import Logger from "./logger.js";
import performanceMetrics from "../utils/performanceMetrics.js";

/**
 * Performance monitoring middleware
 * Tracks API response times, sizes, and compression status
 */
export const performanceMonitor = (req, res, next) => {
    const startTime = Date.now();
    const { method, originalUrl } = req;

    // Store original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    let responseSize = 0;
    let responseSent = false;

    // Helper to log performance
    const logPerformance = (body) => {
        if (responseSent) return;
        responseSent = true;

        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        const compressed = res.get("Content-Encoding") === "gzip";

        // حجم الاستجابة بلا JSON.stringify مزدوج (يعتمد على Content-Length)
        if (body) {
            const hdrLen = res.get("Content-Length") || res.getHeader("Content-Length");
            if (hdrLen) responseSize = parseInt(hdrLen, 10) || 0;
            else if (typeof body === "string") responseSize = Buffer.byteLength(body, "utf8");
            else if (Buffer.isBuffer(body)) responseSize = body.length;
            else if (typeof body === "object") responseSize = 0;
        }

        // Calculate compression ratio if compressed
        let compressionRatio = "N/A";
        if (compressed && responseSize > 0) {
            const compressedSize = parseInt(res.get("Content-Length")) || responseSize;
            compressionRatio = `${((1 - compressedSize / responseSize) * 100).toFixed(1)}%`;
        }

        // Log performance metrics for API endpoints
        if (originalUrl.startsWith("/api/")) {
            Logger.apiPerformance(
                method,
                originalUrl,
                statusCode,
                duration,
                responseSize,
                compressed,
                { compressionRatio }
            );

            // Record metrics for dashboard
            performanceMetrics.recordApiCall({
                method,
                url: originalUrl,
                statusCode,
                duration,
                responseSize,
                compressed,
                compressionRatio,
            });

            // Warn if response is slow
            if (duration > 1000) {
                Logger.warn("Slow API response detected", {
                    method,
                    url: originalUrl,
                    duration: `${duration}ms`,
                    statusCode,
                });
            }

            // Warn if response is large and not compressed
            if (responseSize > 100 * 1024 && !compressed) {
                Logger.warn("Large uncompressed response detected", {
                    method,
                    url: originalUrl,
                    responseSize: `${(responseSize / 1024).toFixed(2)} KB`,
                });
            }
        }
    };

    // Override res.send/json/end — سجل بعد الإرسال لتقرأ Content-Length بلا stringify مزدوج
    res.send = function (body) {
        const r = originalSend.call(this, body);
        logPerformance(body);
        return r;
    };
    res.json = function (body) {
        const r = originalJson.call(this, body);
        logPerformance(body);
        return r;
    };
    res.end = function (chunk, encoding) {
        const r = originalEnd.call(this, chunk, encoding);
        logPerformance(chunk);
        return r;
    };

    next();
};

/**
 * Helper function to measure database query execution time
 * Usage: const { result, executionTime } = await measureQueryTime(() => Model.find(query))
 */
export const measureQueryTime = async (queryFunction) => {
    const startTime = Date.now();
    const result = await queryFunction();
    const executionTime = Date.now() - startTime;
    return { result, executionTime };
};

export default performanceMonitor;
