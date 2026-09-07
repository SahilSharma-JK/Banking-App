//password verification here

const { loginAdmin } = require("../services/authService");

async function login(req, res, next) {
    try {

        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required"
            });
        }

        const result = await loginAdmin(username, password);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: result
        });

    } catch (error) {

        next(error);
    }
}

module.exports = { login };