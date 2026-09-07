// This file contains account-related database queries/business logic.

const db = require("../../config/db");
const { ensureLoanSchedule, getLoanSchedule } = require("./loanScheduleService");


// ============================================================
// GET ALL ACCOUNTS
// ============================================================

async function getAllAccounts(filters = {}) {
    const search = String(filters.search ?? "").trim();
    const type = String(filters.type ?? "").trim().toLowerCase();
    const allowAll =
        filters.all === true ||
        String(filters.all ?? "").toLowerCase() === "true";

    // The Accounts page is intentionally empty until an operator searches.
    // Dashboard requests use all=true.
    if (!search && !allowAll) {
        return [];
    }

    const where = [];
    const params = [];

    if (search) {
        if (/^\d+$/.test(search)) {
            // Numeric account/customer IDs are exact identifiers. Avoid a
            // wildcard scan across the 100k+ customer dataset.
            where.push(`(a.account_id = ? OR a.customer_id = ?)`);
            params.push(Number(search), Number(search));
        } else if (/^ACC/i.test(search)) {
            // Account numbers are indexed identifiers.
            where.push(`a.account_number = ?`);
            params.push(search);
        } else {
            where.push(`
                (
                    a.account_number LIKE ?
                    OR CONCAT_WS(' ', c.first_name, c.last_name) LIKE ?
                    OR c.first_name LIKE ?
                    OR c.last_name LIKE ?
                )
            `);

            const like = `%${search}%`;
            const prefix = `${search}%`;
            params.push(like, like, prefix, prefix);
        }
    }

    if (type === "savings" || type === "saving") {
        where.push("LOWER(at.account_type) = 'savings'");
    } else if (type === "loan") {
        where.push("LOWER(at.account_type) = 'loan'");
    }

    const [accounts] = await db.query(`
        SELECT
            a.account_id,
            a.account_number,
            a.customer_id,
            CONCAT_WS(' ', c.first_name, c.last_name) AS customer_name,
            a.account_type_id,
            at.account_type,
            at.account_subtype,
            a.account_status,
            a.opened_at,

            CASE
                WHEN LOWER(at.account_type) = 'savings' THEN sa.balance
                WHEN LOWER(at.account_type) = 'loan' THEN la.outstanding_balance
                ELSE NULL
            END AS balance,

            sa.balance AS saving_balance,
            sa.minimum_balance,
            sa.withdrawal_limit,
            sa.transfer_limit,
            sa.branch_code,

            la.loan_id,
            la.loan_amount,
            la.outstanding_balance,
            la.interest_rate,
            la.duration_months,
            la.emi_amount,
            la.repayment_start_date

        FROM accounts a
        INNER JOIN customers c ON a.customer_id = c.customer_id
        INNER JOIN account_types at ON a.account_type_id = at.account_type_id
        LEFT JOIN saving_accounts sa ON a.account_id = sa.account_id
        LEFT JOIN loan_accounts la ON a.account_id = la.account_id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY a.account_id DESC
    `, params);

    return accounts;
}


// ============================================================
// GET ONE ACCOUNT
// ============================================================

async function getAccountById(accountId) {

    const [accounts] = await db.query(`
        SELECT
            a.account_id,
            a.account_number,
            a.customer_id,

            CONCAT(
                c.first_name,
                ' ',
                c.last_name
            ) AS customer_name,

            a.account_type_id,
            at.account_type,
            at.account_subtype,
            a.account_status,
            a.opened_at,
            CASE
                WHEN LOWER(at.account_type) = 'savings' THEN sa.balance
                WHEN LOWER(at.account_type) = 'loan' THEN la.outstanding_balance
                ELSE NULL
            END AS balance

        FROM accounts a

        INNER JOIN customers c
            ON a.customer_id = c.customer_id

        INNER JOIN account_types at
            ON a.account_type_id = at.account_type_id

        LEFT JOIN saving_accounts sa
            ON a.account_id = sa.account_id

        LEFT JOIN loan_accounts la
            ON a.account_id = la.account_id

        WHERE a.account_id = ?
    `, [accountId]);


    if (accounts.length === 0) {

        const error = new Error("Account not found");

        error.statusCode = 404;

        throw error;
    }


    const account = accounts[0];


    // ============================================================
    // GET SAVINGS DETAILS
    // ============================================================

    const [savingAccounts] = await db.query(`
        SELECT
            saving_id,
            balance,
            minimum_balance,
            withdrawal_limit,
            transfer_limit,
            branch_code
        FROM saving_accounts
        WHERE account_id = ?
    `, [accountId]);


    // ============================================================
    // GET LOAN DETAILS
    // ============================================================

    const [loanAccounts] = await db.query(`
        SELECT
            loan_id,
            loan_amount,
            outstanding_balance,
            interest_rate,
            duration_months,
            emi_amount,
            repayment_start_date
        FROM loan_accounts
        WHERE account_id = ?
    `, [accountId]);


    const loanDetails = loanAccounts[0] || null;
    const emiSchedule = loanDetails
        ? await getLoanSchedule(accountId)
        : [];

    return {
        ...account,

        saving_details:
            savingAccounts[0] || null,

        loan_details:
            loanDetails
                ? { ...loanDetails, emi_schedule: emiSchedule }
                : null
    };
}


// ============================================================
// UPDATE ACCOUNT STATUS
// ============================================================

async function updateAccountStatus(
    accountId,
    accountStatus
) {

    const allowedStatuses = [
        "Active",
        "Frozen",
        "Disabled"
    ];


    if (!allowedStatuses.includes(accountStatus)) {

        const error = new Error("Invalid account status. Use Active, Frozen or Disabled.");

        error.statusCode = 400;

        throw error;
    }


    const [result] = await db.query(`
        UPDATE accounts
        SET account_status = ?
        WHERE account_id = ?
    `, [
        accountStatus,
        accountId
    ]);


    if (result.affectedRows === 0) {

        const error = new Error("Account not found");

        error.statusCode = 404;

        throw error;
    }


    return await getAccountById(
        accountId
    );
}


/* DEPOSIT / WITHDRAW FROM SAVINGS ACCOUNT
//
// This function performs TWO database operations:
//
// 1. Updates saving_accounts.balance
//
// 2. Inserts a transaction into transactions
//
// Both operations happen inside ONE MySQL transaction.
//
// If anything fails:
// → balance update is rolled back
// → transaction INSERT is rolled back
//
// This keeps the account balance and transaction history
// synchronized.
*/

async function updateSavingsBalance(
    accountId,
    amount,
    operation
) {

    const numericAmount =
        Number(amount);


    // ============================================================
    // VALIDATE AMOUNT
    // ============================================================

    if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
    ) {

        const error = new Error("Amount must be greater than zero.");

        error.statusCode = 400;

        throw error;
    }


    // ============================================================
    // VALIDATE OPERATION
    // ============================================================

    const normalizedOperation =
        String(operation || "")
            .trim()
            .toLowerCase();


    if (
        ![
            "deposit",
            "withdraw"
        ].includes(normalizedOperation)
    ) {

        const error = new Error("Operation must be deposit or withdraw.");

        error.statusCode = 400;

        throw error;
    }


    // ============================================================
    // GET DEDICATED MYSQL CONNECTION
    //
    // We need a dedicated connection because BEGIN,
    // UPDATE, INSERT and COMMIT must all use the same
    // database connection.
    // ============================================================

    const connection =
        await db.getConnection();


    try {

        // ========================================================
        // START MYSQL TRANSACTION
        // ========================================================

        await connection.beginTransaction();


        // ========================================================
        // CHECK ACCOUNT
        //
        // FOR UPDATE locks this account row until COMMIT/ROLLBACK.
        //
        // This prevents two admins from simultaneously modifying
        // the same account balance incorrectly.
        // ========================================================

        const [accounts] =
            await connection.query(`
                SELECT
                    account_id,
                    account_status
                FROM accounts
                WHERE account_id = ?
                FOR UPDATE
            `, [
                accountId
            ]);


        if (accounts.length === 0) {

            const error = new Error("Account not found");

            error.statusCode = 404;

            throw error;
        }


        // ========================================================
        // ONLY ACTIVE ACCOUNTS CAN TRANSACT
        // ========================================================

        if (
            String(accounts[0].account_status || "").toLowerCase() !== "active"
        ) {

            const error = new Error("Transactions are allowed only on Active accounts.");

            error.statusCode = 400;

            throw error;
        }


        // ========================================================
        // GET SAVINGS ACCOUNT
        //
        // FOR UPDATE locks the savings balance row.
        // ========================================================

        const [savingAccounts] =
            await connection.query(`
                SELECT
                    saving_id,
                    balance,
                    minimum_balance,
                    withdrawal_limit
                FROM saving_accounts
                WHERE account_id = ?
                FOR UPDATE
            `, [
                accountId
            ]);


        if (savingAccounts.length === 0) {

            const error = new Error("This account is not a Savings account.");

            error.statusCode = 400;

            throw error;
        }


        // ========================================================
        // GET CURRENT BALANCE
        // ========================================================

        const balanceBefore =
            Number(
                savingAccounts[0].balance || 0
            );

        const minimumBalance = Number(
            savingAccounts[0].minimum_balance || 0
        );

        const withdrawalLimit =
            savingAccounts[0].withdrawal_limit === null ||
                savingAccounts[0].withdrawal_limit === undefined
                ? null
                : Number(savingAccounts[0].withdrawal_limit);

        if (
            normalizedOperation === "withdraw" &&
            withdrawalLimit !== null &&
            numericAmount > withdrawalLimit
        ) {
            const error = new Error(
                `Withdrawal limit is ₹${withdrawalLimit.toLocaleString("en-IN")}.`
            );
            error.statusCode = 400;
            throw error;
        }


        // ========================================================
        // CALCULATE NEW BALANCE
        // ========================================================

        let balanceAfter;


        if (
            normalizedOperation === "deposit"
        ) {

            // ----------------------------------------------------
            // DEPOSIT
            // ----------------------------------------------------

            balanceAfter =
                balanceBefore +
                numericAmount;

        } else {

            // ----------------------------------------------------
            // WITHDRAWAL
            // ----------------------------------------------------

            if (
                numericAmount >
                balanceBefore
            ) {

                const error = new Error("Insufficient balance.");

                error.statusCode = 400;

                throw error;
            }


            balanceAfter =
                balanceBefore -
                numericAmount;

            if (balanceAfter < minimumBalance) {
                const error = new Error(
                    `Minimum balance of ₹${minimumBalance.toLocaleString("en-IN")} must be maintained.`
                );
                error.statusCode = 400;
                throw error;
            }
        }


        // ========================================================
        // DETERMINE TRANSACTION TYPE
        // ========================================================

        const transactionType =
            normalizedOperation === "deposit"
                ? "DEPOSIT"
                : "WITHDRAWAL";


        // ========================================================
        // GENERATE UNIQUE TRANSACTION REFERENCE
        //
        // Example:
        //
        // DEP-1755600000000-A1B2C3
        // WDR-1755600000000-X7Y8Z9
        //
        // transactions.reference_number is UNIQUE,
        // therefore we generate it automatically here.
        // ========================================================

        const prefix =
            normalizedOperation === "deposit"
                ? "DEP"
                : "WDR";


        const timestamp =
            Date.now();


        const randomPart =
            Math.random()
                .toString(36)
                .substring(2, 8)
                .toUpperCase();


        const referenceNumber =
            `${prefix}-${timestamp}-${randomPart}`;


        // ========================================================
        // UPDATE SAVINGS BALANCE
        // ========================================================

        await connection.query(`
            UPDATE saving_accounts
            SET balance = ?
            WHERE account_id = ?
        `, [
            balanceAfter,
            accountId
        ]);


        // ========================================================
        // INSERT TRANSACTION RECORD
        //
        // These values directly preserve the balance movement:
        //
        // balance_before
        // balance_after
        // amount
        // transaction_type
        // reference_number
        // ========================================================

        await connection.query(`
            INSERT INTO transactions (
                account_id,
                transaction_type,
                amount,
                balance_before,
                balance_after,
                reference_number
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            accountId,
            transactionType,
            numericAmount,
            balanceBefore,
            balanceAfter,
            referenceNumber
        ]);


        // ========================================================
        // COMMIT EVERYTHING
        // ========================================================

        await connection.commit();


        // ========================================================
        // RETURN FRESH ACCOUNT DATA
        // ========================================================

        return await getAccountById(
            accountId
        );


    } catch (error) {

        // ========================================================
        // ROLLBACK EVERYTHING
        //
        // If UPDATE or INSERT fails:
        // → balance change is undone
        // → transaction record is not saved
        // ========================================================

        await connection.rollback();

        throw error;

    } finally {

        // ========================================================
        // RELEASE MYSQL CONNECTION
        // ========================================================

        connection.release();
    }
}


// ============================================================
// UPDATE LOAN DETAILS
// ============================================================

async function updateLoanDetails(
    accountId,
    loanData
) {

    const {
        loan_amount,
        outstanding_balance,
        interest_rate,
        duration_months,
        emi_amount
    } = loanData;


    // ============================================================
    // CHECK LOAN ACCOUNT
    // ============================================================

    const [loanAccounts] = await db.query(`
        SELECT
            loan_id
        FROM loan_accounts
        WHERE account_id = ?
    `, [
        accountId
    ]);


    if (loanAccounts.length === 0) {

        const error = new Error("This account is not a Loan account.");

        error.statusCode = 400;

        throw error;
    }


    // ============================================================
    // VALIDATE REQUIRED LOAN DATA
    // ============================================================

    if (
        loan_amount === undefined ||
        outstanding_balance === undefined ||
        interest_rate === undefined ||
        duration_months === undefined ||
        emi_amount === undefined
    ) {

        const error = new Error("All loan details are required.");

        error.statusCode = 400;

        throw error;
    }


    // ============================================================
    // CONVERT VALUES TO NUMBERS
    // ============================================================

    const values = [
        Number(loan_amount),
        Number(outstanding_balance),
        Number(interest_rate),
        Number(duration_months),
        Number(emi_amount),
        accountId
    ];


    // ============================================================
    // VALIDATE VALUES
    // ============================================================

    if (
        values
            .slice(0, 5)
            .some(
                (value) =>
                    !Number.isFinite(value) ||
                    value < 0
            )
    ) {

        const error = new Error(
            "Loan values must be valid non-negative numbers."
        );

        error.statusCode = 400;

        throw error;
    }


    // ============================================================
    // UPDATE LOAN
    // ============================================================

    await db.query(`
        UPDATE loan_accounts
        SET
            loan_amount = ?,
            outstanding_balance = ?,
            interest_rate = ?,
            duration_months = ?,
            emi_amount = ?
        WHERE account_id = ?
    `, values);


    // ============================================================
    // RETURN UPDATED ACCOUNT
    // ============================================================

    return await getAccountById(
        accountId
    );
}


/*UPDATE COMPLETE ACCOUNT DETAILS
//
// Savings:
// - account_status
// - balance
// - transfer_limit
// - branch_code
//
// Loan:
// - account_status
// - loan_amount
// - outstanding_balance
// - interest_rate
// - duration_months
// - emi_amount
//
// IMPORTANT:
//
// Manual balance editing here does NOT create a transaction.
//
// Deposit/Withdraw MUST use updateSavingsBalance()
// because those are actual banking transactions.
//
// This keeps:
// Edit Account:
// → administrative configuration/details
//
// Deposit / Withdraw:
// → financial transaction + transaction history
*/
async function updateAccountDetails(
    accountId,
    accountData
) {

    const {
        account_status,
        balance,
        minimum_balance,
        withdrawal_limit,
        transfer_limit,
        branch_code,
        loan_amount,
        outstanding_balance,
        interest_rate,
        duration_months,
        emi_amount,
        repayment_start_date
    } = accountData;


    // ============================================================
    // CHECK ACCOUNT
    // ============================================================

    const [accounts] = await db.query(`
        SELECT
            account_id,
            account_type_id,
            account_status
        FROM accounts
        WHERE account_id = ?
    `, [
        accountId
    ]);


    if (accounts.length === 0) {

        const error = new Error("Account not found");

        error.statusCode = 404;

        throw error;
    }


    const accountTypeId =
        Number(
            accounts[0].account_type_id
        );

    const currentAccountStatus =
        String(accounts[0].account_status || "Active");

    const requestedAccountStatus =
        account_status !== undefined
            ? String(account_status)
            : currentAccountStatus;

    // Frozen/Disabled accounts are locked for detail editing. The only
    // permitted change while locked is reactivating the account.
    if (
        currentAccountStatus !== "Active" &&
        requestedAccountStatus !== "Active"
    ) {
        throw Object.assign(
            new Error("This account is locked. Set the account status to Active before editing its details."),
            { statusCode: 400 }
        );
    }

    // UPDATE ACCOUNT STATUS

    if (
        account_status !== undefined
    ) {

        const allowedStatuses = [
            "Active",
            "Frozen",
            "Disabled"
        ];


        if (
            !allowedStatuses.includes(
                account_status
            )
        ) {

            const error = new Error("Invalid account status. Use Active, Frozen or Disabled.");

            error.statusCode = 400;

            throw error;
        }


        await db.query(`
            UPDATE accounts
            SET account_status = ?
            WHERE account_id = ?
        `, [
            account_status,
            accountId
        ]);
    }


    /*UPDATE SAVINGS ACCOUNT
    //
    // NOTE:
    // This is for administrative editing of savings details.
    //
    // Deposit/Withdraw should use updateSavingsBalance()
    // so that a transaction record is also created.
    */

    if (
        accountTypeId === 1
    ) {

        const [savingAccounts] =
            await db.query(`
                SELECT
                    saving_id,
                    balance,
                    minimum_balance,
                    withdrawal_limit,
                    transfer_limit,
                    branch_code
                FROM saving_accounts
                WHERE account_id = ?
            `, [
                accountId
            ]);


        if (
            savingAccounts.length === 0
        ) {

            const error = new Error("Savings details not found for this account.");

            error.statusCode = 400;

            throw error;
        }


        const currentSavings = savingAccounts[0];


        const newBalance =
            balance !== undefined
                ? Number(balance)
                : currentSavings.balance;


        const newMinimumBalance =
            minimum_balance !== undefined
                ? Number(minimum_balance)
                : Number(currentSavings.minimum_balance || 0);


        const newWithdrawalLimit =
            withdrawal_limit !== undefined
                ? (withdrawal_limit === null || withdrawal_limit === "" ? null : Number(withdrawal_limit))
                : (currentSavings.withdrawal_limit ?? null);


        const newTransferLimit =
            transfer_limit !== undefined
                ? (transfer_limit === null || transfer_limit === "" ? null : Number(transfer_limit))
                : (currentSavings.transfer_limit ?? null);


        const newBranchCode =
            branch_code !== undefined
                ? branch_code
                : currentSavings.branch_code;


        // VALIDATE BALANCE

        if (
            !Number.isFinite(
                Number(newBalance)
            ) ||
            Number(newBalance) < 0
        ) {

            const error = new Error(
                "Balance must be a valid non-negative number."
            );

            error.statusCode = 400;

            throw error;
        }

        // VALIDATE TRANSFER LIMIT
        // ========================================================

        if (
            !Number.isFinite(Number(newMinimumBalance)) ||
            Number(newMinimumBalance) < 0
        ) {
            const error = new Error("Minimum balance must be a valid non-negative number.");
            error.statusCode = 400;
            throw error;
        }

        if (
            newWithdrawalLimit !== null &&
            newWithdrawalLimit !== undefined &&
            (
                !Number.isFinite(Number(newWithdrawalLimit)) ||
                Number(newWithdrawalLimit) < 0
            )
        ) {
            const error = new Error("Withdrawal limit must be a valid non-negative number.");
            error.statusCode = 400;
            throw error;
        }

        if (
            newTransferLimit !== null &&
            newTransferLimit !== undefined &&
            (
                !Number.isFinite(Number(newTransferLimit)) ||
                Number(newTransferLimit) < 0
            )
        ) {

            const error = new Error("Transfer limit must be a valid non-negative number.");

            error.statusCode = 400;

            throw error;
        }

        // UPDATE SAVINGS DETAILS

        await db.query(`
            UPDATE saving_accounts
            SET
                balance = ?,
                minimum_balance = ?,
                withdrawal_limit = ?,
                transfer_limit = ?,
                branch_code = ?
            WHERE account_id = ?
        `, [
            newBalance,
            newMinimumBalance,
            newWithdrawalLimit,
            newTransferLimit,
            newBranchCode,
            accountId
        ]);
    }

    // UPDATE LOAN ACCOUNT


    if (
        accountTypeId === 2
    ) {

        const [loanAccounts] =
            await db.query(`
                SELECT
                    loan_id,
                    loan_amount,
                    outstanding_balance,
                    interest_rate,
                    duration_months,
                    emi_amount,
                    repayment_start_date
                FROM loan_accounts
                WHERE account_id = ?
            `, [accountId]);


        if (
            loanAccounts.length === 0
        ) {

            const error = new Error("Loan details not found for this account.");

            error.statusCode = 400;

            throw error;
        }


        const currentLoan = loanAccounts[0];

        const newLoanAmount =
            loan_amount !== undefined
                ? Number(loan_amount)
                : currentLoan.loan_amount;


        const newOutstandingBalance =
            outstanding_balance !== undefined
                ? Number(outstanding_balance)
                : currentLoan.outstanding_balance;


        const newInterestRate =
            interest_rate !== undefined
                ? Number(interest_rate)
                : currentLoan.interest_rate;


        const newDurationMonths =
            duration_months !== undefined
                ? Number(duration_months)
                : currentLoan.duration_months;


        const newEmiAmount =
            emi_amount !== undefined
                ? Number(emi_amount)
                : currentLoan.emi_amount;


        const newRepaymentStartDate =
            repayment_start_date !== undefined
                ? repayment_start_date
                : currentLoan.repayment_start_date;


        const loanValues = [
            newLoanAmount,
            newOutstandingBalance,
            newInterestRate,
            newDurationMonths,
            newEmiAmount
        ];


        // ========================================================
        // VALIDATE LOAN VALUES
        // ========================================================

        if (
            loanValues.some(
                (value) =>
                    !Number.isFinite(
                        Number(value)
                    ) ||
                    Number(value) < 0
            )
        ) {

            const error = new Error(
                "Loan values must be valid non-negative numbers."
            );

            error.statusCode = 400;

            throw error;
        }


        // ========================================================
        // UPDATE LOAN
        // ========================================================

        await db.query(`
            UPDATE loan_accounts
            SET
                loan_amount = ?,
                outstanding_balance = ?,
                interest_rate = ?,
                duration_months = ?,
                emi_amount = ?,
                repayment_start_date = ?
            WHERE account_id = ?
        `, [
            newLoanAmount,
            newOutstandingBalance,
            newInterestRate,
            newDurationMonths,
            newEmiAmount,
            newRepaymentStartDate || null,
            accountId
        ]);

        // Keep the customer-facing EMI schedule aligned with edited loan
        // details. Paid installments are preserved; pending installments are
        // refreshed using the new date/tenure/EMI values.
        await getLoanSchedule(accountId);
    }


    // ============================================================
    // RETURN UPDATED ACCOUNT
    // ============================================================

    return await getAccountById(
        accountId
    );
}


// ============================================================
// PAY LOAN EMI
// ============================================================

async function payLoanEmi(
    accountId,
    amount,
    paymentSource = "CASH",
    sourceAccountId = null,
    otherAccountNumber = ""
) {
    const numericAmount = Number(amount);
    const normalizedSource = String(paymentSource || "CASH").trim().toUpperCase();

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        const error = new Error("EMI payment amount must be greater than zero.");
        error.statusCode = 400;
        throw error;
    }

    if (!["CASH", "SAVINGS", "OTHER_ACCOUNT"].includes(normalizedSource)) {
        const error = new Error("Invalid EMI payment source.");
        error.statusCode = 400;
        throw error;
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.query(`
            SELECT
                a.account_id,
                a.account_status,
                a.customer_id,
                la.loan_id,
                la.loan_amount,
                la.outstanding_balance,
                la.interest_rate,
                la.duration_months,
                la.emi_amount,
                la.repayment_start_date
            FROM accounts a
            INNER JOIN loan_accounts la ON a.account_id = la.account_id
            WHERE a.account_id = ?
            FOR UPDATE
        `, [accountId]);

        if (!rows.length) {
            const error = new Error("Loan account not found.");
            error.statusCode = 404;
            throw error;
        }

        const loan = rows[0];

        if (String(loan.account_status).toLowerCase() !== "active") {
            const error = new Error("EMI payment is allowed only on Active accounts.");
            error.statusCode = 400;
            throw error;
        }

        const outstandingBefore = Number(loan.outstanding_balance || 0);

        if (outstandingBefore <= 0) {
            const error = new Error("This loan is already fully paid.");
            error.statusCode = 400;
            throw error;
        }

        if (numericAmount > outstandingBefore) {
            const error = new Error("Payment cannot exceed the outstanding balance.");
            error.statusCode = 400;
            throw error;
        }

        let sourceAccount = null;
        let sourceBalanceBefore = null;
        let sourceBalanceAfter = null;

        // Savings payment: validate ownership, active status, balance and
        // minimum-balance requirement before changing anything.
        if (normalizedSource === "SAVINGS") {
            const numericSourceAccountId = Number(sourceAccountId);

            if (!Number.isInteger(numericSourceAccountId)) {
                const error = new Error("Select a Savings Account for this payment.");
                error.statusCode = 400;
                throw error;
            }

            const [sourceRows] = await connection.query(`
                SELECT
                    a.account_id,
                    a.account_number,
                    a.customer_id,
                    a.account_status,
                    sa.saving_id,
                    sa.balance,
                    sa.minimum_balance
                FROM accounts a
                INNER JOIN saving_accounts sa
                    ON sa.account_id = a.account_id
                WHERE a.account_id = ?
                  AND a.customer_id = ?
                FOR UPDATE
            `, [numericSourceAccountId, loan.customer_id]);

            if (!sourceRows.length) {
                const error = new Error("Selected Savings Account does not belong to this customer.");
                error.statusCode = 400;
                throw error;
            }

            sourceAccount = sourceRows[0];

            if (String(sourceAccount.account_status).toLowerCase() !== "active") {
                const error = new Error("Selected Savings Account is not active.");
                error.statusCode = 400;
                throw error;
            }

            sourceBalanceBefore = Number(sourceAccount.balance || 0);
            const minimumBalance = Number(sourceAccount.minimum_balance || 0);
            sourceBalanceAfter = sourceBalanceBefore - numericAmount;

            if (sourceBalanceAfter < 0) {
                const error = new Error(
                    `Insufficient balance. Available balance is ₹${sourceBalanceBefore.toLocaleString("en-IN")}.`
                );
                error.statusCode = 400;
                throw error;
            }

            if (sourceBalanceAfter < minimumBalance) {
                const usableBalance = Math.max(0, sourceBalanceBefore - minimumBalance);
                const error = new Error(
                    `Insufficient balance. Only ₹${usableBalance.toLocaleString("en-IN")} is available after maintaining the minimum balance of ₹${minimumBalance.toLocaleString("en-IN")}.`
                );
                error.statusCode = 400;
                throw error;
            }

            await connection.query(`
                UPDATE saving_accounts
                SET balance = ?
                WHERE account_id = ?
            `, [sourceBalanceAfter, sourceAccount.account_id]);

            const sourceReference =
                `EMI-SRC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

            await connection.query(`
                INSERT INTO transactions (
                    account_id,
                    saving_id,
                    transaction_type,
                    amount,
                    balance_before,
                    balance_after,
                    reference_number
                )
                VALUES (?, ?, 'EMI_PAYMENT', ?, ?, ?, ?)
            `, [
                sourceAccount.account_id,
                sourceAccount.saving_id,
                numericAmount,
                sourceBalanceBefore,
                sourceBalanceAfter,
                sourceReference
            ]);
        }

        if (normalizedSource === "OTHER_ACCOUNT") {
            if (!String(otherAccountNumber || "").trim()) {
                const error = new Error("Enter the external/other account number.");
                error.statusCode = 400;
                throw error;
            }
        }

        // Build/update the repayment schedule only after source validation.
        const schedule = await ensureLoanSchedule(connection, loan);
        const currentInstallment = schedule.find(
            (item) => String(item.emi_status).toUpperCase() !== "PAID"
        );

        if (!currentInstallment) {
            const error = new Error("No pending installment is available for this loan.");
            error.statusCode = 400;
            throw error;
        }

        const scheduledEmi = Number(currentInstallment.emi_amount || loan.emi_amount || 0);
        const previousPaid = Number(currentInstallment.paid_amount || 0);
        const newPaidAmount = previousPaid + numericAmount;
        const paymentStatus = newPaidAmount >= scheduledEmi ? "PAID" : "PARTIALLY_PAID";
        const outstandingAfter = Math.max(0, outstandingBefore - numericAmount);

        const referenceNumber =
            `EMI-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

        await connection.query(`
            UPDATE loan_accounts
            SET outstanding_balance = ?
            WHERE account_id = ?
        `, [outstandingAfter, accountId]);

        await connection.query(`
            UPDATE loan_emis
            SET
                emi_status = ?,
                paid_amount = ?,
                paid_at = CASE WHEN ? = 'PAID' THEN CURDATE() ELSE paid_at END,
                remaining_balance = ?
            WHERE emi_id = ?
        `, [
            paymentStatus,
            newPaidAmount,
            paymentStatus,
            outstandingAfter,
            currentInstallment.emi_id
        ]);

        await connection.query(`
            INSERT INTO transactions (
                account_id,
                transaction_type,
                amount,
                balance_before,
                balance_after,
                reference_number,
                emi_number,
                emi_date,
                emi_status,
                paid_at,
                remaining_balance,
                payment_source,
                source_account_id,
                source_account_number
            )
            VALUES (?, 'EMI', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            accountId,
            numericAmount,
            outstandingBefore,
            outstandingAfter,
            referenceNumber,
            currentInstallment.emi_number,
            currentInstallment.emi_date,
            paymentStatus,
            paymentStatus === "PAID" ? new Date().toISOString().slice(0, 10) : null,
            outstandingAfter,
            normalizedSource,
            sourceAccount?.account_id || null,
            normalizedSource === "SAVINGS"
                ? sourceAccount.account_number
                : normalizedSource === "OTHER_ACCOUNT"
                    ? String(otherAccountNumber).trim()
                    : null
        ]);

        await connection.commit();

        const updated = await getAccountById(accountId);
        const refreshedSchedule = updated.loan_details?.emi_schedule || [];
        const nextInstallment = refreshedSchedule.find(
            (item) => String(item.emi_status).toUpperCase() !== "PAID"
        );

        return {
            ...updated,
            payment: {
                emi_number: currentInstallment.emi_number,
                amount_paid: numericAmount,
                installment_paid_amount: newPaidAmount,
                scheduled_emi: scheduledEmi,
                status: outstandingAfter === 0 ? "LOAN_PAID" : paymentStatus,
                paid_at: paymentStatus === "PAID"
                    ? new Date().toISOString().slice(0, 10)
                    : null,
                remaining_balance: outstandingAfter,
                next_due_date: nextInstallment?.emi_date || null,
                reference_number: referenceNumber,
                payment_source: normalizedSource,
                source_account_number:
                    normalizedSource === "SAVINGS"
                        ? sourceAccount.account_number
                        : normalizedSource === "OTHER_ACCOUNT"
                            ? String(otherAccountNumber).trim()
                            : null,
                source_account_id: sourceAccount?.account_id || null,
                source_balance_after: sourceBalanceAfter,
            }
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}


// EXPORTS

module.exports = {

    getAllAccounts,
    getAccountById,
    updateAccountStatus,
    updateSavingsBalance,
    updateLoanDetails,
    updateAccountDetails,
    payLoanEmi

};

