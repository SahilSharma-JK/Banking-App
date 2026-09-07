const { getDashboardSummary } = require("../services/dashboardService");

async function getSummary(req, res, next) {
    try {
        const data = await getDashboardSummary();
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
}

module.exports = { getSummary };
