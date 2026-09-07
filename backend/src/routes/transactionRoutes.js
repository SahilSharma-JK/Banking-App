//GET /api/transactions-->transactionRoutes-->transactionController-->transactionService-->MySQL
const express = require("express");

const { getTransactions, getTransaction, getReport, downloadReport, } = require("../controllers/transactionController");

const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

// Get all transactions
// GET /api/transactions
router.get("/", authenticateToken, getTransactions);

// GET /api/transactions/report
router.get(
    "/report",
    authenticateToken,
    getReport
);


//GET /api/transactions/report/download
router.get("/report/download", authenticateToken, downloadReport);

// Get one transaction by ID
// GET /api/transactions/:id
router.get("/:id", authenticateToken, getTransaction);



module.exports = router;