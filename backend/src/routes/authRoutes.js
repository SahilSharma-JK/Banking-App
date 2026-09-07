const express = require("express");
const { login } = require("../controllers/authController");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

// Admin login endpoint.
// POST /api/auth/login
router.post("/login", login);

// Protected route.
// GET /api/auth/me
router.get("/me", authenticateToken, (req, res) => {
    res.status(200).json({
        success: true,
        message: "Authenticated admin",
        user: req.user
    });
});

module.exports = router;