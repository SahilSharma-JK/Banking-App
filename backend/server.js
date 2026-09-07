
// Load environment variables from .env
require("dotenv").config();

// Import the Express application
const app = require("./src/app");

const { ensureBankingSchema } = require("./database/migrate");
// Port on which our backend server will run
const PORT = process.env.PORT || 5000;


// Start the server
async function startServer() {
    try {
        await ensureBankingSchema();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Database compatibility check failed:", error);
        process.exit(1);
    }
}

startServer();