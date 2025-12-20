export const notFound = (req, res, next) => {
    const error = new Error(`المسار غير موجود - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

export const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error with more details
    // // Mongoose bad ObjectId
    if (err.name === "CastError") {
        const message = "المورد غير موجود";
        error = { message, statusCode: 404 };
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const message = "البيانات مكررة";
        error = { message, statusCode: 400 };
    }

    // Mongoose validation error
    if (err.name === "ValidationError") {
        const message = Object.values(err.errors)
            .map((val) => val.message)
            .join(", ");
        error = { message, statusCode: 400 };
    }

    // JWT errors
    if (err.name === "JsonWebTokenError") {
        const message = "رمز الوصول غير صحيح";
        error = { message, statusCode: 401 };
    }

    if (err.name === "TokenExpiredError") {
        const message = "انتهت صلاحية رمز الوصول";
        error = { message, statusCode: 401 };
    }

    // Handle specific order creation errors
    if (req.originalUrl.includes("/orders") && req.method === "POST") {
        // Additional error handling for orders can be added here
    }

    res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "خطأ في الخادم",
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
};
