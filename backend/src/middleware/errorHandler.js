// Global error-handling middleware.
// Any error passed using next(error)
// will come here.

const errorHandler = (err, req, res, next) => {
    console.error(err);

    const statusCode = err.statusCode || 500;

    res.status(500).json({
        success: false,
        message: statusCode === 500 ? "Internal server error" : err.message,
    });
};

module.exports = errorHandler;