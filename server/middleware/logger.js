// Log levels
const LOG_LEVELS = {
    ERROR: "ERROR",
    WARN: "WARN",
    INFO: "INFO",
    DEBUG: "DEBUG",
};

// Create log entry
const createLogEntry = (level, message, meta = {}) => {
    return {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta,
    };
};

// Logger class
class Logger {
    static error(message, meta = {}) {
        // Only ERROR logging is enabled
        const logEntry = createLogEntry(LOG_LEVELS.ERROR, message, meta);
        console.error(JSON.stringify(logEntry));

        if (meta && meta.error) {
            console.error("Error details:", meta.error);
        }
        if (meta && meta.stack) {
            console.error("Stack Trace:", meta.stack);
        }
    }

    static warn(message, meta = {}) {
        // WARNING logging disabled
    }

    static info(message, meta = {}) {
        // INFO logging disabled
    }

    static debug(message, meta = {}) {
        // DEBUG logging disabled
    }

    static audit(action, user, details = {}) {
        // AUDIT logging disabled
    }

    // Performance monitoring methods
    static performance(message, metrics = {}) {
        // Performance logging disabled
    }

    static queryPerformance(endpoint, executionTime, recordCount, meta = {}) {
        this.performance("Database Query Performance", {
            endpoint,
            executionTime: `${executionTime}ms`,
            recordCount,
            ...meta,
        });
    }

    static apiPerformance(method, url, statusCode, duration, responseSize, compressed, meta = {}) {
        this.performance("API Performance", {
            method,
            url,
            statusCode,
            duration: `${duration}ms`,
            responseSize: responseSize ? `${(responseSize / 1024).toFixed(2)} KB` : "N/A",
            compressed: compressed ? "yes" : "no",
            compressionRatio: meta.compressionRatio || "N/A",
            ...meta,
        });
    }
}

// Express middleware for request logging
export const requestLogger = (req, res, next) => {
    // Request logging disabled - no console output
    next();
};

// Error logging middleware
export const errorLogger = (err, req, res, next) => {
    // Error logging disabled - no console output
    next(err);
};

export default Logger;
