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
        const logEntry = createLogEntry(LOG_LEVELS.WARN, message, meta);
        console.warn(JSON.stringify(logEntry));
    }

    static info(message, meta = {}) {
        const logEntry = createLogEntry(LOG_LEVELS.INFO, message, meta);
        console.log(JSON.stringify(logEntry));
    }

    static debug(message, meta = {}) {
        if (process.env.NODE_ENV === "development") {
            const logEntry = createLogEntry(LOG_LEVELS.DEBUG, message, meta);
            console.debug(JSON.stringify(logEntry));
        }
    }

    static audit(action, user, details = {}) {
        const logEntry = createLogEntry(LOG_LEVELS.INFO, `Audit: ${action}`, {
            userId: user?._id,
            userName: user?.name,
            userEmail: user?.email,
            action,
            ...details,
        });
        console.log(JSON.stringify(logEntry));
    }
}

// Express middleware for request logging
export const requestLogger = (req, res, next) => {
    const start = Date.now();
    const { method, originalUrl, ip } = req;

    // Log request
    Logger.info('Request received', {
        method,
        url: originalUrl,
        ip,
        headers: req.headers,
        body: req.body
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
        const duration = Date.now() - start;
        
        // Log response
        Logger.info('Response sent', {
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            url: originalUrl,
            method
        });

        originalEnd.call(this, chunk, encoding);
    };

    next();
};

// Error logging middleware
export const errorLogger = (err, req, res, next) => {
    Logger.error("Request error", {
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userId: req.user?._id,
    });

    next(err);
};

export default Logger;
