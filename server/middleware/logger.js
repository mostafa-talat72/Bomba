const Logger = {
    info: (...args) => console.log('[INFO]', new Date().toISOString(), ...args),
    warn: (...args) => console.warn('[WARN]', new Date().toISOString(), ...args),
    error: (...args) => console.error('[ERROR]', new Date().toISOString(), ...args),
    debug: (...args) => { if (process.env.NODE_ENV === 'development') console.debug('[DEBUG]', ...args); },
    audit: (...args) => console.log('[AUDIT]', new Date().toISOString(), ...args),
    apiPerformance: (method, url, statusCode, duration, responseSize, compressed, extra) => {
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
    },
    queryPerformance: (endpoint, duration, count, extra) => {
        console.log(
            '[QUERY]',
            new Date().toISOString(),
            endpoint,
            `time:${duration}ms`,
            `count:${count}`,
            extra ? JSON.stringify(extra) : '',
        );
    },
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
