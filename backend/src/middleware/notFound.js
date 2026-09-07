// Middleware for handling routes that do not exist.
// If no previous route matches the request,
// Express will reach this middleware.

const notFound = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
};

module.exports = notFound;