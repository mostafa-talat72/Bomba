import fs from "fs";
import path from "path";

// Ensure logs directory exists
const logsDir = "./logs";
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

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

// Write log to file
const writeLog = (filename, logEntry) => {
    const logPath = path.join(logsDir, filename);
    const logLine = JSON.stringify(logEntry) + "\n";

    fs.appendFile(logPath, logLine, (err) => {
        if (err) {
            console.error("Error writing to log file:", err);
        }
    });
};

// Logger class
class Logger {
    static error(message, meta = {}) {
        const logEntry = createLogEntry(LOG_LEVELS.ERROR, message, meta);
        writeLog("error.log", logEntry);
        console.error("يوجد خطأ! راجع ملف logs/error.log");
        if (meta && meta.error) {
            console.error("تفاصيل الخطأ:", meta.error);
        }
        if (meta && meta.stack) {
            console.error("Stack Trace:", meta.stack);
        }
        if (typeof message === "object") {
            console.error(JSON.stringify(message, null, 2));
        } else {
            console.error(message);
        }
    }

    static warn(message, meta = {}) {
        const logEntry = createLogEntry(LOG_LEVELS.WARN, message, meta);
        writeLog("app.log", logEntry);
    }

    static info(message, meta = {}) {
        const logEntry = createLogEntry(LOG_LEVELS.INFO, message, meta);
        writeLog("app.log", logEntry);
    }

    static debug(message, meta = {}) {
        if (process.env.NODE_ENV === "development") {
            const logEntry = createLogEntry(LOG_LEVELS.DEBUG, message, meta);
            writeLog("debug.log", logEntry);
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
        writeLog("audit.log", logEntry);
    }
}

// Express middleware for request logging
export const requestLogger = (req, res, next) => {
    const start = Date.now();

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
        const duration = Date.now() - start;

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
