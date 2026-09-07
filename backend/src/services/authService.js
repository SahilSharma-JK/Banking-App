/*authentication logic-
Password verification is implemented in authService.js using bcrypt. 
After successful verification, we generate a JWT using jsonwebtoken
*/
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../../config/db");

async function loginAdmin(username, password) {

    // Find the admin using the username provided during login.
    const [admins] = await db.query(
        `SELECT admin_id, username, email, password_hash, is_active
         FROM admins
         WHERE username = ?`,
        [username]
    );

    // If no admin exists with this username, authentication fails.
    if (admins.length === 0) {
        const error = new Error("Invalid username or password");
        error.statusCode = 401;
        throw error;
    }

    const admin = admins[0];

    // Do not allow inactive admin accounts to log in.
    if (!admin.is_active) {
        const error = new Error("Admin account is inactive");
        error.statusCode = 403;
        throw error;
    }


    const passwordMatch = await bcrypt.compare(
        password,
        admin.password_hash
    );

    if (!passwordMatch) {
        const error = new Error("Invalid username or password");
        error.statusCode = 401;
        throw error;
    }

    // Create a JWT after successful authentication.
    const token = jwt.sign(
        {
            adminId: admin.admin_id,
            username: admin.username
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "1h"
        }
    );

    // Return only the information required by the controller.
    return {
        admin: {
            admin_id: admin.admin_id,
            username: admin.username,
            email: admin.email
        },
        token
    };
}

module.exports = {
    loginAdmin
};