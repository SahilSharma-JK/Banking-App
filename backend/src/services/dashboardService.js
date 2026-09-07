/*const db = require("../../config/db");

function formatIndianAmount(value) {
    const amount = Number(value || 0);

    if (!Number.isFinite(amount)) return "₹0";

    if (Math.abs(amount) >= 10000000) {
        return `₹${(amount / 10000000).toFixed(2)} Cr`;
    }

    if (Math.abs(amount) >= 100000) {
        return `₹${(amount / 100000).toFixed(2)} L`;
    }

    return `₹${amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

async function getDashboardSummary() {
    const [rows] = await db.query(`
        SELECT
            (SELECT COUNT(*) FROM customers) AS total_customers,
            (SELECT COUNT(*) FROM accounts) AS total_accounts,
            (SELECT COALESCE(SUM(balance), 0) FROM saving_accounts) AS total_balance,
            (SELECT COALESCE(SUM(outstanding_balance), 0) FROM loan_accounts) AS total_loan_outstanding,
            (SELECT COUNT(*) FROM transactions) AS total_transactions,

            (SELECT COALESCE(SUM(
                CASE
                    WHEN UPPER(transaction_type) = 'DEPOSIT'
                     AND transaction_date >= CURDATE()
                    THEN amount ELSE 0
                END
            ), 0) FROM transactions) AS today_deposits,

            (SELECT COALESCE(SUM(
                CASE
                    WHEN UPPER(transaction_type) = 'WITHDRAWAL'
                     AND transaction_date >= CURDATE()
                    THEN amount ELSE 0
                END
            ), 0) FROM transactions) AS today_withdrawals,

            (SELECT COALESCE(SUM(
                CASE
                    WHEN UPPER(transaction_type) = 'EMI'
                     AND transaction_date >= CURDATE()
                    THEN amount ELSE 0
                END
            ), 0) FROM transactions) AS today_emi,

            (SELECT COUNT(*) FROM accounts WHERE LOWER(account_status) = 'active') AS active_accounts,
            (SELECT COUNT(*) FROM accounts a
                INNER JOIN account_types at ON at.account_type_id = a.account_type_id
                WHERE LOWER(at.account_type) = 'savings') AS savings_accounts,
            (SELECT COUNT(*) FROM accounts a
                INNER JOIN account_types at ON at.account_type_id = a.account_type_id
                WHERE LOWER(at.account_type) = 'loan') AS loan_accounts,
            (SELECT COUNT(*) FROM loan_emis WHERE UPPER(emi_status) = 'PAID') AS paid_emis,
            (SELECT COUNT(*) FROM loan_emis WHERE UPPER(emi_status) = 'PENDING') AS pending_emis
    `);

    const row = rows[0] || {};

    const totalBalance = Number(row.total_balance || 0);
    const totalLoanOutstanding = Number(row.total_loan_outstanding || 0);
    const todayDeposits = Number(row.today_deposits || 0);
    const todayWithdrawals = Number(row.today_withdrawals || 0);
    const todayEmi = Number(row.today_emi || 0);
    const todayNetMovement = todayDeposits - todayWithdrawals - todayEmi;

    return {
        // Numeric values remain available for charts/calculations.
        totalCustomers: Number(row.total_customers || 0),
        totalAccounts: Number(row.total_accounts || 0),
        totalBalance,
        totalLoanOutstanding,
        totalTransactions: Number(row.total_transactions || 0),
        todayDeposits,
        todayWithdrawals,
        todayEmi,
        todayNetMovement,
        activeAccounts: Number(row.active_accounts || 0),
        savingsAccounts: Number(row.savings_accounts || 0),
        loanAccounts: Number(row.loan_accounts || 0),
        paidEmis: Number(row.paid_emis || 0),
        pendingEmis: Number(row.pending_emis || 0),

        // Bank-style compact display values, e.g. ₹5.33 Cr.
        totalBalanceFormatted: formatIndianAmount(totalBalance),
        totalLoanOutstandingFormatted: formatIndianAmount(totalLoanOutstanding),
        todayDepositsFormatted: formatIndianAmount(todayDeposits),
        todayWithdrawalsFormatted: formatIndianAmount(todayWithdrawals),
        todayEmiFormatted: formatIndianAmount(todayEmi),
        todayNetMovementFormatted: formatIndianAmount(todayNetMovement),

        todayBankingActivity: {
            deposits: todayDeposits,
            withdrawals: todayWithdrawals,
            emiPayments: todayEmi,
            netMovement: todayNetMovement,
            depositsFormatted: formatIndianAmount(todayDeposits),
            withdrawalsFormatted: formatIndianAmount(todayWithdrawals),
            emiPaymentsFormatted: formatIndianAmount(todayEmi),
            netMovementFormatted: formatIndianAmount(todayNetMovement),
        },
    };
}

module.exports = { getDashboardSummary, formatIndianAmount };
*/

const db = require("../../config/db");

function formatIndianAmount(value) {
    const amount = Number(value || 0);

    if (!Number.isFinite(amount)) return "₹0";

    if (Math.abs(amount) >= 10000000) {
        return `₹${(amount / 10000000).toFixed(2)} Cr`;
    }

    if (Math.abs(amount) >= 100000) {
        return `₹${(amount / 100000).toFixed(2)} L`;
    }

    return `₹${amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

async function getDashboardSummary() {
    try {
        /*
         * Dashboard data is separated into small queries instead of one
         * large query containing many independent subqueries.
         *
         * IMPORTANT:
         * - No existing data is deleted.
         * - No existing data is modified.
         * - Only SELECT queries are used here.
         */

        const [
            [customerRows],
            [accountRows],
            [balanceRows],
            [loanRows],
            [transactionRows],
            [todayTransactionRows],
            [activeAccountRows],
            [savingsRows],
            [loanAccountRows],
            [paidEmiRows],
            [pendingEmiRows],
        ] = await Promise.all([
            // ------------------------------------------------------------
            // TOTAL CUSTOMERS
            // ------------------------------------------------------------
            db.query(`
                SELECT COUNT(*) AS total_customers
                FROM customers
            `),

            // ------------------------------------------------------------
            // TOTAL ACCOUNTS
            // ------------------------------------------------------------
            db.query(`
                SELECT COUNT(*) AS total_accounts
                FROM accounts
            `),

            // ------------------------------------------------------------
            // TOTAL SAVINGS BALANCE
            // ------------------------------------------------------------
            db.query(`
                SELECT COALESCE(SUM(balance), 0) AS total_balance
                FROM saving_accounts
            `),

            // ------------------------------------------------------------
            // TOTAL LOAN OUTSTANDING
            // ------------------------------------------------------------
            db.query(`
                SELECT COALESCE(SUM(outstanding_balance), 0)
                    AS total_loan_outstanding
                FROM loan_accounts
            `),

            // ------------------------------------------------------------
            // TOTAL TRANSACTIONS
            // ------------------------------------------------------------
            db.query(`
                SELECT COUNT(*) AS total_transactions
                FROM transactions
            `),

            // ------------------------------------------------------------
            // TODAY'S TRANSACTIONS
            //
            // Date condition is applied directly on transaction_date.
            // This avoids applying a function such as DATE() on the
            // database column and allows MySQL to use an index.
            // ------------------------------------------------------------
            db.query(`
                SELECT
                    COALESCE(SUM(
                        CASE
                            WHEN transaction_type = 'DEPOSIT'
                            THEN amount
                            ELSE 0
                        END
                    ), 0) AS today_deposits,

                    COALESCE(SUM(
                        CASE
                            WHEN transaction_type = 'WITHDRAWAL'
                            THEN amount
                            ELSE 0
                        END
                    ), 0) AS today_withdrawals,

                    COALESCE(SUM(
                        CASE
                            WHEN transaction_type = 'EMI'
                            THEN amount
                            ELSE 0
                        END
                    ), 0) AS today_emi

                FROM transactions

                WHERE transaction_date >= CURDATE()
                  AND transaction_date < CURDATE() + INTERVAL 1 DAY
            `),

            // ------------------------------------------------------------
            // ACTIVE ACCOUNTS
            // ------------------------------------------------------------
            db.query(`
                SELECT COUNT(*) AS active_accounts
                FROM accounts
                WHERE account_status IN ('Active', 'ACTIVE', 'active')
            `),

            // ------------------------------------------------------------
            // SAVINGS ACCOUNTS
            // ------------------------------------------------------------
            db.query(`
                SELECT COUNT(*) AS savings_accounts
                FROM accounts a
                INNER JOIN account_types at
                    ON at.account_type_id = a.account_type_id
                WHERE at.account_type IN ('Savings', 'SAVINGS', 'savings')
            `),

            // ------------------------------------------------------------
            // LOAN ACCOUNTS
            // ------------------------------------------------------------
            db.query(`
                SELECT COUNT(*) AS loan_accounts
                FROM accounts a
                INNER JOIN account_types at
                    ON at.account_type_id = a.account_type_id
                WHERE at.account_type IN ('Loan', 'LOAN', 'loan')
            `),

            // ------------------------------------------------------------
            // PAID EMIs
            // ------------------------------------------------------------
            db.query(`
                SELECT COUNT(*) AS paid_emis
                FROM loan_emis
                WHERE emi_status IN ('PAID', 'Paid', 'paid')
            `),

            // ------------------------------------------------------------
            // PENDING EMIs
            // ------------------------------------------------------------
            db.query(`
                SELECT COUNT(*) AS pending_emis
                FROM loan_emis
                WHERE emi_status IN ('PENDING', 'Pending', 'pending')
            `),
        ]);

        // ------------------------------------------------------------
        // READ QUERY RESULTS
        // ------------------------------------------------------------

        const row = {
            ...customerRows[0],
            ...accountRows[0],
            ...balanceRows[0],
            ...loanRows[0],
            ...transactionRows[0],
            ...todayTransactionRows[0],
            ...activeAccountRows[0],
            ...savingsRows[0],
            ...loanAccountRows[0],
            ...paidEmiRows[0],
            ...pendingEmiRows[0],
        };

        // ------------------------------------------------------------
        // CONVERT DATABASE VALUES TO NUMBERS
        // ------------------------------------------------------------

        const totalBalance = Number(row.total_balance || 0);
        const totalLoanOutstanding = Number(
            row.total_loan_outstanding || 0
        );

        const todayDeposits = Number(row.today_deposits || 0);
        const todayWithdrawals = Number(row.today_withdrawals || 0);
        const todayEmi = Number(row.today_emi || 0);

        const todayNetMovement =
            todayDeposits -
            todayWithdrawals -
            todayEmi;

        // ------------------------------------------------------------
        // RETURN DASHBOARD DATA
        // ------------------------------------------------------------

        return {
            totalCustomers: Number(row.total_customers || 0),

            totalAccounts: Number(row.total_accounts || 0),

            totalBalance,

            totalLoanOutstanding,

            totalTransactions: Number(
                row.total_transactions || 0
            ),

            todayDeposits,

            todayWithdrawals,

            todayEmi,

            todayNetMovement,

            activeAccounts: Number(
                row.active_accounts || 0
            ),

            savingsAccounts: Number(
                row.savings_accounts || 0
            ),

            loanAccounts: Number(
                row.loan_accounts || 0
            ),

            paidEmis: Number(
                row.paid_emis || 0
            ),

            pendingEmis: Number(
                row.pending_emis || 0
            ),

            // --------------------------------------------------------
            // FORMATTED VALUES FOR DASHBOARD
            // --------------------------------------------------------

            totalBalanceFormatted:
                formatIndianAmount(totalBalance),

            totalLoanOutstandingFormatted:
                formatIndianAmount(totalLoanOutstanding),

            todayDepositsFormatted:
                formatIndianAmount(todayDeposits),

            todayWithdrawalsFormatted:
                formatIndianAmount(todayWithdrawals),

            todayEmiFormatted:
                formatIndianAmount(todayEmi),

            todayNetMovementFormatted:
                formatIndianAmount(todayNetMovement),

            // --------------------------------------------------------
            // TODAY'S BANKING ACTIVITY
            // --------------------------------------------------------

            todayBankingActivity: {
                deposits: todayDeposits,

                withdrawals: todayWithdrawals,

                emiPayments: todayEmi,

                netMovement: todayNetMovement,

                depositsFormatted:
                    formatIndianAmount(todayDeposits),

                withdrawalsFormatted:
                    formatIndianAmount(todayWithdrawals),

                emiPaymentsFormatted:
                    formatIndianAmount(todayEmi),

                netMovementFormatted:
                    formatIndianAmount(todayNetMovement),
            },
        };
    } catch (error) {
        console.error(
            "Error fetching dashboard summary:",
            error
        );

        throw error;
    }
}

module.exports = {
    getDashboardSummary,
    formatIndianAmount,
};