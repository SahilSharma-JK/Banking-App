//Request-->transactionController-->transactionService-->response MySQL

const {
    getTransactions,
    getTransactionById,
    getTransactionReport,
    getReportFile,
} = require("../services/transactionService");

/*GET /api/transactions

*/
async function getTransactionsController(req, res, next) {
    try {
        const transactions = await getTransactions(req.query || {});

        res.status(200).json({
            success: true,
            data: transactions,
        });
    } catch (error) {
        next(error);
    }
}

/*GET /api/transactions/:id
*/
async function getTransaction(req, res, next) {
    try {
        const transaction = await getTransactionById(req.params.id);

        res.status(200).json({
            success: true,
            data: transaction,
        });
    } catch (error) {
        next(error);
    }
}

/*GET /api/transactions/report
*/
async function getReport(req, res, next) {
    try {
        const report = await getTransactionReport(req.query || {});

        res.status(200).json({
            success: true,
            data: report,
        });
    } catch (error) {
        next(error);
    }
}

/*GET /api/transactions/report/download
*/
async function downloadReport(req, res, next) {
    try {
        const format = String(
            req.query.format || "pdf"
        ).toLowerCase();

        if (!["pdf", "csv"].includes(format)) {
            const error = new Error("Report format must be pdf or csv.");

            error.statusCode = 400;

            throw error;
        }

        const file = await getReportFile(
            req.query || {},
            format
        );

        const filename =
            `${file.filenameBase || "ZENbank_Transaction_Report"}.${file.extension}`;

        res.setHeader(
            "Content-Type",
            file.contentType
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
        );

        res.status(200).send(file.buffer);

    } catch (error) {
        next(error);
    }
}

module.exports = {
    getTransactions: getTransactionsController,
    getTransaction,
    getReport,
    downloadReport,
};
