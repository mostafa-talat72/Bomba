const isLoggingEnabled = process.env.ENABLE_LOGGING === 'true';

const noop = () => {};

const Logger = {
    info: isLoggingEnabled ? (...args) => console.log('[INFO]', new Date().toISOString(), ...args) : noop,
    warn: isLoggingEnabled ? (...args) => console.warn('[WARN]', new Date().toISOString(), ...args) : noop,
    error: isLoggingEnabled ? (...args) => console.error('[ERROR]', new Date().toISOString(), ...args) : noop,
    debug: isLoggingEnabled ? (...args) => { if (process.env.NODE_ENV === 'development') console.debug('[DEBUG]', ...args); } : noop,
    audit: isLoggingEnabled ? (...args) => console.log('[AUDIT]', new Date().toISOString(), ...args) : noop,
    apiPerformance: isLoggingEnabled ? (method, url, statusCode, duration, responseSize, compressed, extra) => {
        console.log(
            '[API]',
            new Date().toISOString(),
            method,
            url,
            `status:${statusCode}`,
            `time:${duration}ms`,
            `size:${responseSize}`,
            compressed ? `compressed:${extra?.compressionRatio}` : '',
        );
    } : noop,
    queryPerformance: isLoggingEnabled ? (endpoint, duration, count, extra) => {
        console.log(
            '[QUERY]',
            new Date().toISOString(),
            endpoint,
            `time:${duration}ms`,
            `count:${count}`,
            extra ? JSON.stringify(extra) : '',
        );
    } : noop,
};

export const requestLogger = (req, res, next) => {
    Logger.info(`${req.method} ${req.url}`);
    next();
};

export const errorLogger = (err, req, res, next) => {
    Logger.error('Unhandled error:', err.message, { stack: err.stack });
    next(err);
};

export default Logger;
