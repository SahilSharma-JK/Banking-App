//registers middleware and mounts all API route modules

const express = require("express");

const cors = require("cors"); //Cross-Origin Resource Sharing, connectes backend n frontend

const db = require("../config/db");

const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");

const customerRoutes = require("./routes/customerRoutes");

const accountRoutes = require("./routes/accountRoutes");

const transactionRoutes = require("./routes/transactionRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();

// MIDDLEWARE

app.use(cors({ origin: "http://localhost:5173" }));

app.use(express.json());


// Used to check whether our backend server is running.
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Banking API is running",
    });
});


// Checks whether the Node.js application can communicate
// with the MySQL database.
app.get("/api/health/db", async (req, res, next) => {
    try {

        // SELECT 1 does not change any data.
        await db.query("SELECT 1");

        res.status(200).json({
            success: true,
            message: "Database connection is working",
        });
    } catch (error) {
        // Pass the error to our error-handling middleware.
        next(error);
    }
});

// Temporary route used only to verify that our
// global errorHandler middleware is working.
app.get("/api/test-error", (req, res, next) => {
    const error = new Error("This is a test error");

    next(error);
});

// Authentication routes.
app.use("/api/auth", authRoutes);

// Customer APIs.
app.use("/api/customers", customerRoutes);

// Account APIs.
app.use("/api/accounts", accountRoutes);

// Transaction APIs.
app.use("/api/transactions", transactionRoutes);

// Lightweight dashboard aggregate API. It returns counts/totals only.
app.use("/api/dashboard", dashboardRoutes);

// If no route matches, the request reaches notFound.
app.use(notFound);

// Handles errors passed through next(error).
app.use(errorHandler);


// Export the configured Express application.
module.exports = app;