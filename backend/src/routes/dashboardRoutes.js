const express = require("express");
const { getSummary } = require("../controllers/dashboardController");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();
router.get("/summary", authenticateToken, getSummary);

module.exports = router;