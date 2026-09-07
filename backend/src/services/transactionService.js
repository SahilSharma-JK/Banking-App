// Transaction data access and reporting service.
//
// Important database relationship:
// transactions.account_id -> accounts.account_id
// accounts.customer_id -> customers.customer_id
// accounts.account_type_id -> account_types.account_type_id
// loan_accounts.loan_id -> loan_accounts.account_id
//
// The transactions table itself does NOT contain loan_id. For loan
// transactions we derive loan_id through loan_accounts.

const db = require("../../config/db");


// ============================================================================
// NORMALIZE FILTERS
// ============================================================================

function normalizeFilters(filters = {}) {
    return {
        customerId:
            String(filters.customer_id ?? filters.customerId ?? "").trim(),

        customerName:
            String(filters.customer_name ?? filters.customerName ?? "").trim(),

        accountNumber:
            String(filters.account_number ?? filters.accountNumber ?? "").trim(),

        transactionType:
            String(filters.transaction_type ?? filters.transactionType ?? "").trim(),

        fromDate:
            String(filters.date_from ?? filters.fromDate ?? "").trim(),

        toDate:
            String(filters.date_to ?? filters.toDate ?? "").trim(),

        scope:
            String(filters.scope ?? "all").trim().toLowerCase(),

        allowAll:
            filters.allowAll === true ||
            String(filters.allowAll ?? "").toLowerCase() === "true",
    };
}


// ============================================================================
// BUILD TRANSACTION QUERY
// ============================================================================

function buildTransactionQuery(filters = {}) {
    const normalized = normalizeFilters(filters);

    let sql = `
        SELECT
            t.transaction_id,
            t.account_id,
            la.loan_id,
            t.reference_number,

            a.account_number,
            a.customer_id,
            a.account_type_id,
            a.account_status,
            a.opened_at,

            at.account_type,
            at.account_subtype,

            c.customer_number,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,
            c.mobile,

            CONCAT_WS(
                ' ',
                NULLIF(c.first_name, ''),
                NULLIF(c.last_name, '')
            ) AS customer_name,

            t.transaction_type,
            t.amount,
            t.balance_before,
            t.balance_after,
            t.transaction_date,

            t.emi_number,
            t.emi_date,
            t.emi_status,
            t.paid_at,
            t.remaining_balance,
            t.payment_source,
            t.source_account_id,
            t.source_account_number

        FROM transactions t

        INNER JOIN accounts a
            ON t.account_id = a.account_id

        INNER JOIN account_types at
            ON a.account_type_id = at.account_type_id

        INNER JOIN customers c
            ON a.customer_id = c.customer_id

        LEFT JOIN loan_accounts la
            ON a.account_id = la.account_id

        WHERE 1 = 1
    `;

    const params = [];

    // Transactions are intentionally hidden until the admin identifies a
    // customer/account. This prevents the page from showing every customer's
    // banking history by default.
    if (
        !normalized.allowAll &&
        !normalized.customerId &&
        !normalized.customerName &&
        !normalized.accountNumber
    ) {
        return {
            sql: `${sql} AND 1 = 0`,
            params,
            normalized,
            hasSearchIdentity: false,
        };
    }

    // Customer ID is the customer_id from customers, NOT account_id.
    if (normalized.customerId) {
        sql += `
            AND a.customer_id = ?
        `;
        params.push(normalized.customerId);
    }

    // Customer name supports partial matching, e.g. "Palak", "Singhal",
    // or "Palak Singhal".
    if (normalized.customerName) {
        sql += `
            AND CONCAT_WS(
                ' ',
                NULLIF(c.first_name, ''),
                NULLIF(c.last_name, '')
            ) LIKE ?
        `;
        params.push(`%${normalized.customerName}%`);
    }

    if (normalized.accountNumber) {
        sql += `
            AND a.account_number = ?
        `;
        params.push(normalized.accountNumber);
    }

    if (normalized.scope === "savings") {
        sql += `
            AND LOWER(at.account_type) = 'savings'
        `;
    } else if (normalized.scope === "loan") {
        sql += `
            AND LOWER(at.account_type) = 'loan'
        `;
    }

    if (normalized.transactionType) {
        sql += `
            AND UPPER(t.transaction_type) = UPPER(?)
        `;
        params.push(normalized.transactionType);
    } else if (normalized.scope !== "savings" && !normalized.accountNumber) {
        // EMI_PAYMENT is the internal debit-side ledger entry created when a
        // Savings Account funds an EMI. In an all-account customer statement
        // it must not appear as a second EMI. When the operator explicitly
        // opens a Savings Account statement, it remains visible there.
        sql += `
            AND UPPER(COALESCE(t.transaction_type, '')) <> 'EMI_PAYMENT'
        `;
    }

    if (normalized.fromDate) {
        sql += `
            AND DATE(t.transaction_date) >= ?
        `;
        params.push(normalized.fromDate);
    }

    if (normalized.toDate) {
        sql += `
            AND DATE(t.transaction_date) <= ?
        `;
        params.push(normalized.toDate);
    }

    sql += `
        ORDER BY
            t.transaction_date DESC,
            t.transaction_id DESC
    `;

    return {
        sql,
        params,
        normalized,
        hasSearchIdentity: true,
    };
}


// ============================================================================
// GET TRANSACTIONS
// ============================================================================

async function getTransactions(filters = {}) {
    try {
        const query = buildTransactionQuery(filters);
        const [rows] = await db.query(query.sql, query.params);
        return rows;
    } catch (error) {
        console.error("Error fetching transactions:", error);
        throw error;
    }
}


// ============================================================================
// GET TRANSACTION BY ID
// ============================================================================

async function getTransactionById(transactionId) {
    try {
        const sql = `
            SELECT
                t.transaction_id,
                t.account_id,
                la.loan_id,
                t.reference_number,

                a.account_number,
                a.customer_id,
                a.account_type_id,
                a.account_status,
                a.opened_at,

                at.account_type,
                at.account_subtype,

                c.customer_number,
                c.first_name,
                c.last_name,
                c.email,
                c.phone,
                c.mobile,

                CONCAT_WS(
                    ' ',
                    NULLIF(c.first_name, ''),
                    NULLIF(c.last_name, '')
                ) AS customer_name,

                t.transaction_type,
                t.amount,
                t.balance_before,
                t.balance_after,
                t.transaction_date,

                t.emi_number,
                t.emi_date,
                t.emi_status,
                t.paid_at,
                t.remaining_balance,
                t.payment_source,
                t.source_account_number

            FROM transactions t

            INNER JOIN accounts a
                ON t.account_id = a.account_id

            INNER JOIN account_types at
                ON a.account_type_id = at.account_type_id

            INNER JOIN customers c
                ON a.customer_id = c.customer_id

            LEFT JOIN loan_accounts la
                ON a.account_id = la.account_id

            WHERE t.transaction_id = ?
            LIMIT 1
        `;

        const [rows] = await db.query(sql, [transactionId]);

        if (rows.length === 0) {
            const error = new Error("Transaction not found.");
            error.statusCode = 404;
            throw error;
        }

        return rows[0];
    } catch (error) {
        console.error("Error fetching transaction by ID:", error);
        throw error;
    }
}


// ============================================================================
// GET TRANSACTION REPORT
// ============================================================================

async function getTransactionReport(filters = {}) {
    try {
        const query = buildTransactionQuery(filters);
        const [rows] = await db.query(query.sql, query.params);

        let totalDeposits = 0;
        let totalWithdrawals = 0;
        let totalEmi = 0;

        rows.forEach((transaction) => {
            const amount = Number(transaction.amount || 0);
            const type = String(transaction.transaction_type || "").toUpperCase();

            if (type === "DEPOSIT" || type.includes("CREDIT")) {
                totalDeposits += amount;
            }

            if (type === "WITHDRAWAL" || type.includes("WITHDRAW") || type.includes("DEBIT")) {
                totalWithdrawals += amount;
            }

            if (type === "EMI" || type.includes("EMI")) {
                totalEmi += amount;
            }
        });

        const totalTransactions = rows.length;
        const totalAmount = rows.reduce(
            (sum, transaction) => sum + Number(transaction.amount || 0),
            0
        );
        const netMovement = totalDeposits - totalWithdrawals - totalEmi;

        const normalized = query.normalized;

        return {
            filters: {
                customer_id: normalized.customerId || null,
                customer_name: normalized.customerName || null,
                account_number: normalized.accountNumber || null,
                transaction_type: normalized.transactionType || null,
                date_from: normalized.fromDate || null,
                date_to: normalized.toDate || null,
                scope: normalized.scope || "all",
            },

            // Frontend-friendly summary names.
            total_transactions: totalTransactions,
            total_deposits: totalDeposits,
            total_withdrawals: totalWithdrawals,
            total_emi: totalEmi,
            net_movement: netMovement,

            // Backward-compatible summary names.
            summary: {
                totalTransactions,
                totalAmount,
                totalCredits: totalDeposits,
                totalDebits: totalWithdrawals + totalEmi,
                totalDeposits,
                totalWithdrawals,
                totalEmi,
                netMovement,
            },

            transactions: rows,
        };
    } catch (error) {
        console.error("Error generating transaction report:", error);
        throw error;
    }
}


// ============================================================================
// GET REPORT FILE
// ============================================================================

async function getReportFile(filters = {}, format = "pdf") {
    try {
        const report = await getTransactionReport(filters);
        const rows = report.transactions || [];
        const first = rows[0] || {};

        const customerName =
            first.customer_name ||
            report.filters.customer_name ||
            "Selected Customer";

        const accountNumber =
            report.filters.account_number ||
            (rows.length === 1 ? first.account_number : "");

        const safePart = (value) =>
            String(value || "")
                .trim()
                .replace(/[^a-zA-Z0-9]+/g, "_")
                .replace(/^_+|_+$/g, "")
                .slice(0, 80);

        const filenameBase = [
            safePart(customerName),
            accountNumber ? safePart(accountNumber) : "All_Accounts",
            "Transaction_Report",
        ].filter(Boolean).join("_");

        if (format === "csv") {
            const headers = [
                "Transaction ID",
                "Date",
                "Account Number",
                "Account ID",
                "Customer ID",
                "Customer Name",
                "Account Type",
                "Transaction Type",
                "Amount",
                "Balance Before",
                "Balance After",
                "Reference Number",
                "EMI Number",
                "EMI Status",
                "Remaining Balance",
                "Payment Source",
                "Source Account",
            ];

            const csvRows = rows.map((row) => [
                row.transaction_id,
                row.transaction_date,
                row.account_number,
                row.account_id,
                row.customer_id,
                row.customer_name,
                row.account_type,
                row.transaction_type,
                row.amount,
                row.balance_before,
                row.balance_after,
                row.reference_number,
                row.emi_number,
                row.emi_status,
                row.remaining_balance,
                row.payment_source,
                row.source_account_number,
            ]);

            const escapeCsv = (value) => {
                if (value === null || value === undefined) return "";
                const stringValue = String(value);
                if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            };

            const csv = [
                `ZENbank Transaction Report`,
                `Customer,${escapeCsv(customerName)}`,
                `Account,${escapeCsv(accountNumber || "All accounts")}`,
                `Period,${escapeCsv(report.filters.date_from || "Start")} to ${escapeCsv(report.filters.date_to || "Today")}`,
                `Scope,${escapeCsv(report.filters.scope || "all")}`,
                "",
                headers.map(escapeCsv).join(","),
                ...csvRows.map((row) => row.map(escapeCsv).join(",")),
            ].join("\n");

            return {
                buffer: Buffer.from(csv, "utf8"),
                extension: "csv",
                contentType: "text/csv; charset=utf-8",
                filenameBase,
            };
        }

        if (format === "pdf") {
            let PDFDocument;

            try {
                PDFDocument = require("pdfkit");
            } catch (error) {
                const pdfError = new Error(
                    "PDF report requires the pdfkit package. Run: npm install pdfkit"
                );
                pdfError.statusCode = 500;
                throw pdfError;
            }

            const doc = new PDFDocument({
                margin: 40,
                size: "A4",
                bufferPages: true,
            });

            const chunks = [];
            doc.on("data", (chunk) => chunks.push(chunk));

            const finished = new Promise((resolve, reject) => {
                doc.on("end", resolve);
                doc.on("error", reject);
            });

            const pageWidth = 515;
            const left = 40;
            const colors = {
                navy: "#0f172a",
                cyan: "#0891b2",
                lightCyan: "#ecfeff",
                border: "#cbd5e1",
                muted: "#64748b",
                green: "#15803d",
                red: "#dc2626",
                indigo: "#4338ca",
                soft: "#f8fafc",
                white: "#ffffff",
            };

            const moneyPdf = (value) =>
                `Rs. ${Number(value || 0).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                })}`;

            const datePdf = (value) => {
                if (!value) return "N/A";
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) return String(value);
                return date.toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                });
            };

            const drawPageFooter = () => {
                const bottom = doc.page.height - 28;
                doc.save();
                doc.strokeColor(colors.border).lineWidth(0.5).moveTo(left, bottom - 8).lineTo(left + pageWidth, bottom - 8).stroke();
                doc.fillColor(colors.muted).fontSize(7.5).font("Helvetica");
                doc.text("ZENbank · Transaction History Report", left, bottom, { width: 300, align: "left" });
                doc.text(`Page ${doc.bufferedPageRange().count}`, left + pageWidth - 80, bottom, { width: 80, align: "right" });
                doc.restore();
            };

            const drawTableHeader = (y) => {
                const columns = [
                    { label: "Date", width: 72 },
                    { label: "Account", width: 90 },
                    { label: "Type", width: 65 },
                    { label: "Amount", width: 78 },
                    { label: "Balance", width: 82 },
                    { label: "Reference", width: 128 },
                ];
                let x = left;
                doc.save();
                doc.fillColor(colors.navy).rect(left, y, pageWidth, 24).fill();
                doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(8.5);
                columns.forEach((column) => {
                    doc.text(column.label, x + 5, y + 7, { width: column.width - 10, align: column.label === "Amount" || column.label === "Balance" ? "right" : "left" });
                    x += column.width;
                });
                doc.restore();
                return columns;
            };

            const drawTransactionRow = (row, y, columns, index) => {
                const rowHeight = 38;
                const fill = index % 2 === 0 ? colors.white : colors.soft;
                doc.save();
                doc.fillColor(fill).rect(left, y, pageWidth, rowHeight).fill();
                doc.strokeColor(colors.border).lineWidth(0.35).rect(left, y, pageWidth, rowHeight).stroke();
                doc.fillColor(colors.navy).font("Helvetica").fontSize(7.5);

                const cells = [
                    datePdf(row.transaction_date),
                    `${row.account_number || "N/A"}\nID: ${row.account_id ?? "N/A"}`,
                    String(row.transaction_type || "N/A"),
                    moneyPdf(row.amount),
                    moneyPdf(row.balance_after),
                    row.reference_number || "N/A",
                ];

                let x = left;
                columns.forEach((column, cellIndex) => {
                    const align = cellIndex === 3 || cellIndex === 4 ? "right" : "left";
                    doc.text(cells[cellIndex], x + 5, y + 6, { width: column.width - 10, height: rowHeight - 8, align, ellipsis: true, lineGap: 1 });
                    x += column.width;
                });
                doc.restore();
                return rowHeight;
            };

            // Header
            doc.fillColor(colors.cyan).font("Helvetica-Bold").fontSize(10).text("ZENBANK", left, 38, { characterSpacing: 2 });
            doc.fillColor(colors.navy).font("Helvetica-Bold").fontSize(24).text("Transaction Report", left, 56);
            doc.fillColor(colors.muted).font("Helvetica").fontSize(9).text("Banking transaction history and account activity", left, 86);
            doc.strokeColor(colors.cyan).lineWidth(2).moveTo(left, 105).lineTo(left + pageWidth, 105).stroke();

            // Customer/account identity block
            let y = 122;
            doc.save();
            doc.fillColor(colors.lightCyan).roundedRect(left, y, pageWidth, 86, 8).fill();
            doc.strokeColor("#bae6fd").lineWidth(0.8).roundedRect(left, y, pageWidth, 86, 8).stroke();
            doc.fillColor(colors.navy).font("Helvetica-Bold").fontSize(12).text("Report details", left + 14, y + 12);
            doc.font("Helvetica").fontSize(9);
            doc.fillColor(colors.muted).text("Customer", left + 14, y + 34);
            doc.fillColor(colors.navy).font("Helvetica-Bold").text(customerName, left + 88, y + 34);
            doc.font("Helvetica").fillColor(colors.muted).text("Customer ID", left + 14, y + 51);
            doc.fillColor(colors.navy).text(first.customer_id || report.filters.customer_id || "N/A", left + 88, y + 51);
            doc.fillColor(colors.muted).text("Account", left + 260, y + 34);
            doc.fillColor(colors.navy).font("Helvetica-Bold").text(accountNumber || "All accounts", left + 320, y + 34);
            doc.font("Helvetica").fillColor(colors.muted).text("Scope", left + 260, y + 51);
            doc.fillColor(colors.navy).text(String(report.filters.scope || "all").toUpperCase(), left + 320, y + 51);
            doc.restore();
            y += 100;

            // Period/filter block
            doc.save();
            doc.fillColor(colors.soft).roundedRect(left, y, pageWidth, 54, 8).fill();
            doc.strokeColor(colors.border).lineWidth(0.6).roundedRect(left, y, pageWidth, 54, 8).stroke();
            doc.fillColor(colors.muted).font("Helvetica-Bold").fontSize(8).text("REPORT PERIOD", left + 14, y + 10);
            doc.fillColor(colors.navy).font("Helvetica").fontSize(9).text(`${report.filters.date_from || "Start"}  to  ${report.filters.date_to || "Today"}`, left + 14, y + 24);
            doc.fillColor(colors.muted).font("Helvetica-Bold").fontSize(8).text("TRANSACTION FILTER", left + 260, y + 10);
            doc.fillColor(colors.navy).font("Helvetica").fontSize(9).text(report.filters.transaction_type || "All transactions", left + 260, y + 24);
            doc.restore();
            y += 68;

            // Summary cards
            const summaryCards = [
                ["Transactions", String(report.total_transactions), colors.cyan],
                ["Deposits", moneyPdf(report.total_deposits), colors.green],
                ["Withdrawals", moneyPdf(report.total_withdrawals), colors.red],
                ["EMI paid", moneyPdf(report.total_emi), colors.indigo],
            ];
            const cardGap = 8;
            const cardWidth = (pageWidth - cardGap * 3) / 4;
            summaryCards.forEach(([label, value, accent], index) => {
                const x = left + index * (cardWidth + cardGap);
                doc.save();
                doc.fillColor(colors.white).roundedRect(x, y, cardWidth, 58, 7).fill();
                doc.strokeColor(colors.border).lineWidth(0.6).roundedRect(x, y, cardWidth, 58, 7).stroke();
                doc.fillColor(accent).rect(x, y, 3, 58).fill();
                doc.fillColor(colors.muted).font("Helvetica-Bold").fontSize(7.5).text(label.toUpperCase(), x + 10, y + 10, { width: cardWidth - 16 });
                doc.fillColor(colors.navy).font("Helvetica-Bold").fontSize(label === "Transactions" ? 15 : 10).text(value, x + 10, y + 28, { width: cardWidth - 16, ellipsis: true });
                doc.restore();
            });
            y += 76;

            // Table
            doc.fillColor(colors.navy).font("Helvetica-Bold").fontSize(12).text("Transaction details", left, y);
            y += 20;
            let columns = drawTableHeader(y);
            y += 24;

            rows.forEach((row, index) => {
                if (y > doc.page.height - 75) {
                    doc.addPage();
                    y = 48;
                    doc.fillColor(colors.cyan).font("Helvetica-Bold").fontSize(9).text("ZENBANK · Transaction Report", left, y);
                    y += 18;
                    columns = drawTableHeader(y);
                    y += 24;
                }
                y += drawTransactionRow(row, y, columns, index);
            });

            if (!rows.length) {
                doc.fillColor(colors.muted).font("Helvetica").fontSize(9).text("No transactions matched the selected filters.", left + 10, y + 14);
                y += 45;
            }

            doc.fillColor(colors.soft).roundedRect(left, y + 12, pageWidth, 60, 8).fill();
            doc.strokeColor(colors.border).lineWidth(0.6).roundedRect(left, y + 12, pageWidth, 60, 8).stroke();
            doc.fillColor(colors.navy).font("Helvetica-Bold").fontSize(10).text("Report summary", left + 14, y + 24);
            doc.font("Helvetica").fontSize(8.5).fillColor(colors.muted);
            doc.text(`Net movement: ${moneyPdf(report.net_movement)}`, left + 14, y + 42);
            doc.text(`Generated: ${datePdf(new Date())}`, left + 280, y + 42);

            // Footer on every page.
            const range = doc.bufferedPageRange();
            for (let i = range.start; i < range.start + range.count; i += 1) {
                doc.switchToPage(i);
                drawPageFooter();
            }

            doc.end();
            await finished;

            return {
                buffer: Buffer.concat(chunks),
                extension: "pdf",
                contentType: "application/pdf",
                filenameBase,
            };
        }

        const error = new Error("Report format must be pdf or csv.");
        error.statusCode = 400;
        throw error;
    } catch (error) {
        console.error("Error generating report file:", error);
        throw error;
    }
}


module.exports = {
    getTransactions,
    getTransactionById,
    getTransactionReport,
    getReportFile,
};


