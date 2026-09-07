/*
 * Backfills banking data for the existing bulk customer dataset.
 *
 * It does NOT recreate or delete customers/addresses.
 * For every customer it ensures:
 *   - 1 Savings account
 *   - 1 Personal Loan account
 *   - at least 30 transaction rows across the customer's accounts
 *   - a mixture of deposits, withdrawals and EMI activity
 *   - several paid EMIs and several pending EMIs
 *
 * The script is intentionally idempotent: re-running it only fills missing
 * banking data and does not create another account for the same customer.
 */

const mysql = require("mysql2/promise");
require("dotenv").config();

const BATCH_CUSTOMERS = Number(process.env.BANKING_BACKFILL_BATCH || 250);

const MIN_TRANSACTIONS_PER_CUSTOMER = 30;

const PAID_EMIS = 7;
const SCHEDULE_EMIS = 12;

const LOAN_AMOUNT = 500000;
const EMI_AMOUNT = 10250;
const INTEREST_RATE = 8.5;
const LOAN_DURATION_MONTHS = 60;

const REPAYMENT_START_DATE = "2026-01-05";

function money(value) {
    return Math.round(Number(value || 0) * 100) / 100;
}

function isoDate(date) {
    return date.toISOString().slice(0, 10);
}

function isoDateTime(date) {
    return date.toISOString().slice(0, 19).replace("T", " ");
}

function addMonths(dateValue, months) {
    let year;
    let month;
    let day;

    // MySQL DATE may come back as a JavaScript Date object
    if (dateValue instanceof Date) {
        year = dateValue.getUTCFullYear();
        month = dateValue.getUTCMonth();
        day = dateValue.getUTCDate();
    } else {
        // If it comes back as YYYY-MM-DD string
        const parts = String(dateValue)
            .slice(0, 10)
            .split("-")
            .map(Number);

        year = parts[0];
        month = parts[1] - 1;
        day = parts[2];
    }

    const d = new Date(
        Date.UTC(
            year,
            month + months,
            1
        )
    );

    // Handle months with fewer than 31 days
    const lastDay = new Date(
        Date.UTC(
            d.getUTCFullYear(),
            d.getUTCMonth() + 1,
            0
        )
    ).getUTCDate();

    d.setUTCDate(
        Math.min(day, lastDay)
    );

    return isoDate(d);
}

function makeReference(prefix, customerId, sequence) {
    return `SEED-${prefix}-${customerId}-${sequence}`;
}

function makeTransactionDate(
    sequence,
    customerId,
    forceToday = false
) {
    const now = new Date();

    if (forceToday) {
        const d = new Date(now);

        d.setHours(
            10 + (customerId % 8),
            (sequence * 7) % 60,
            (sequence * 13) % 60,
            0
        );

        return isoDateTime(d);
    }

    const base = new Date(
        Date.UTC(2026, 0, 10)
    );

    base.setUTCDate(
        base.getUTCDate() + sequence - 1
    );

    base.setUTCHours(
        10 + (customerId % 8),
        (sequence * 3) % 60,
        0,
        0
    );

    return isoDateTime(base);
}


/* =========================================================
   ACCOUNT TYPES
========================================================= */

async function getAccountTypeIds(connection) {
    const [rows] = await connection.query(`
        SELECT
            account_type_id,
            LOWER(account_type) AS account_type,
            LOWER(account_subtype) AS account_subtype
        FROM account_types
        WHERE
            (
                LOWER(account_type) = 'savings'
                AND LOWER(account_subtype) = 'regular'
            )
            OR
            (
                LOWER(account_type) = 'loan'
                AND LOWER(account_subtype) = 'personal'
            )
    `);

    const savings = rows.find(
        (r) =>
            r.account_type === "savings" &&
            r.account_subtype === "regular"
    );

    const loan = rows.find(
        (r) =>
            r.account_type === "loan" &&
            r.account_subtype === "personal"
    );

    if (!savings || !loan) {
        throw new Error(
            "Savings/Loan account types are missing. Run database/seed.js first."
        );
    }

    return {
        savingsTypeId: savings.account_type_id,
        loanTypeId: loan.account_type_id
    };
}


/* =========================================================
   CREATE MISSING ACCOUNTS
========================================================= */

async function insertMissingAccounts(
    connection,
    customers,
    existingAccounts,
    typeIds
) {
    const rows = [];

    const existingByCustomer = new Map();

    for (const account of existingAccounts) {
        const list =
            existingByCustomer.get(account.customer_id) || [];

        list.push(account);

        existingByCustomer.set(
            account.customer_id,
            list
        );
    }

    for (const customer of customers) {
        const existing =
            existingByCustomer.get(
                customer.customer_id
            ) || [];

        const hasSavings = existing.some(
            (a) =>
                a.account_type_id ===
                typeIds.savingsTypeId
        );

        const hasLoan = existing.some(
            (a) =>
                a.account_type_id ===
                typeIds.loanTypeId
        );

        if (!hasSavings) {
            rows.push([
                `ACC-S-${String(
                    customer.customer_id
                ).padStart(8, "0")}`,

                customer.customer_id,

                typeIds.savingsTypeId,

                "ACTIVE",

                isoDate(
                    new Date(
                        Date.UTC(
                            2025,
                            0,
                            1 +
                            (customer.customer_id %
                                500)
                        )
                    )
                )
            ]);
        }

        if (!hasLoan) {
            rows.push([
                `ACC-L-${String(
                    customer.customer_id
                ).padStart(8, "0")}`,

                customer.customer_id,

                typeIds.loanTypeId,

                "ACTIVE",

                isoDate(
                    new Date(
                        Date.UTC(
                            2025,
                            0,
                            1 +
                            (customer.customer_id %
                                500)
                        )
                    )
                )
            ]);
        }
    }

    if (!rows.length) {
        return;
    }

    const placeholders = rows
        .map(() => "(?, ?, ?, ?, ?)")
        .join(",");

    await connection.query(
        `
        INSERT IGNORE INTO accounts
            (
                account_number,
                customer_id,
                account_type_id,
                account_status,
                opened_at
            )
        VALUES ${placeholders}
        `,
        rows.flat()
    );
}


/* =========================================================
   CREATE SAVINGS / LOAN SUB ACCOUNTS
========================================================= */

async function ensureSubAccounts(
    connection,
    accountRows,
    typeIds
) {
    const savingRows = [];
    const loanRows = [];

    for (const account of accountRows) {
        if (
            account.account_type_id ===
            typeIds.savingsTypeId &&
            !account.saving_id
        ) {
            const openingBalance = money(
                65000 +
                ((account.customer_id * 37) %
                    85000)
            );

            savingRows.push([
                account.account_id,
                openingBalance,
                1000,
                25000,
                100000,
                `BR${String(
                    (account.customer_id % 25) + 1
                ).padStart(3, "0")}`
            ]);
        }

        if (
            account.account_type_id ===
            typeIds.loanTypeId &&
            !account.loan_id
        ) {
            loanRows.push([
                account.account_id,
                LOAN_AMOUNT,
                LOAN_AMOUNT,
                INTEREST_RATE,
                LOAN_DURATION_MONTHS,
                EMI_AMOUNT,
                REPAYMENT_START_DATE
            ]);
        }
    }

    if (savingRows.length) {
        await connection.query(
            `
            INSERT INTO saving_accounts
                (
                    account_id,
                    balance,
                    minimum_balance,
                    withdrawal_limit,
                    transfer_limit,
                    branch_code
                )
            VALUES ${savingRows
                .map(() => "(?, ?, ?, ?, ?, ?)")
                .join(",")}
            `,
            savingRows.flat()
        );
    }

    if (loanRows.length) {
        await connection.query(
            `
            INSERT INTO loan_accounts
                (
                    account_id,
                    loan_amount,
                    outstanding_balance,
                    interest_rate,
                    duration_months,
                    emi_amount,
                    repayment_start_date
                )
            VALUES ${loanRows
                .map(() => "(?, ?, ?, ?, ?, ?, ?)")
                .join(",")}
            `,
            loanRows.flat()
        );
    }
}


/* =========================================================
   EMI SCHEDULE
========================================================= */

async function ensureLoanScheduleRows(
    connection,
    loans
) {
    const rows = [];

    for (const loan of loans) {
        for (
            let n = 1;
            n <= SCHEDULE_EMIS;
            n += 1
        ) {
            const paid = n <= PAID_EMIS;

            rows.push([
                loan.loan_id,

                n,

                addMonths(
                    loan.repayment_start_date ||
                    REPAYMENT_START_DATE,
                    n - 1
                ),

                Number(
                    loan.emi_amount ||
                    EMI_AMOUNT
                ),

                paid ? "PAID" : "PENDING",

                paid
                    ? Number(
                        loan.emi_amount ||
                        EMI_AMOUNT
                    )
                    : 0,

                paid
                    ? addMonths(
                        REPAYMENT_START_DATE,
                        n - 1
                    )
                    : null,

                paid
                    ? 0
                    : Number(
                        loan.emi_amount ||
                        EMI_AMOUNT
                    )
            ]);
        }
    }

    if (!rows.length) {
        return;
    }

    await connection.query(
        `
        INSERT IGNORE INTO loan_emis
            (
                loan_id,
                emi_number,
                emi_date,
                emi_amount,
                emi_status,
                paid_amount,
                paid_at,
                remaining_balance
            )
        VALUES ${rows
            .map(
                () =>
                    "(?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .join(",")}
        `,
        rows.flat()
    );
}


/* =========================================================
   BACKFILL EACH CUSTOMER
========================================================= */

async function backfillCustomer(
    connection,
    customer,
    accounts,
    txCount
) {
    const saving = accounts.find(
        (a) => a.account_type === "savings"
    );

    const loan = accounts.find(
        (a) => a.account_type === "loan"
    );

    if (!saving || !loan) {
        throw new Error(
            `Customer ${customer.customer_id} does not have both account types after backfill.`
        );
    }

    const rowsNeeded = Math.max(
        0,
        MIN_TRANSACTIONS_PER_CUSTOMER -
        txCount
    );

    if (rowsNeeded === 0) {
        return 0;
    }

    /*
     * 7 EMI payments.
     *
     * Each EMI creates:
     *   1 savings debit
     *   1 loan EMI transaction
     *
     * Therefore:
     *
     * 7 EMI × 2 transactions = 14 transactions
     *
     * Remaining transactions are normal
     * deposits / withdrawals.
     */

    const desiredEmiPairs = Math.min(
        PAID_EMIS,
        Math.floor(rowsNeeded / 2)
    );

    const desiredSavingsTransactions =
        rowsNeeded -
        desiredEmiPairs * 2;

    const transactionRows = [];

    let savingBalance = money(
        saving.balance
    );

    let loanOutstanding = money(
        loan.outstanding_balance
    );


    /* =====================================================
       NORMAL DEPOSITS / WITHDRAWALS
    ===================================================== */

    for (
        let i = 1;
        i <= desiredSavingsTransactions;
        i += 1
    ) {
        const isDeposit = i % 2 === 1;

        const amount = money(
            isDeposit
                ? 8000 +
                ((customer.customer_id +
                    i) %
                    12000)
                : 2500 +
                ((customer.customer_id +
                    i * 3) %
                    6000)
        );

        const before = savingBalance;

        const after = isDeposit
            ? before + amount
            : Math.max(
                1000,
                before -
                Math.min(
                    amount,
                    Math.max(
                        0,
                        before - 1000
                    )
                )
            );

        const actualAmount = isDeposit
            ? amount
            : money(before - after);

        if (actualAmount <= 0) {
            continue;
        }

        savingBalance = after;

        const sequence =
            transactionRows.length + 1;

        const forceToday =
            customer.customer_id % 20 === 0 &&
            i ===
            desiredSavingsTransactions;

        /*
         * IMPORTANT:
         *
         * transactions table has 16 columns:
         *
         * 1  account_id
         * 2  saving_id
         * 3  transaction_type
         * 4  amount
         * 5  balance_before
         * 6  balance_after
         * 7  reference_number
         * 8  transaction_date
         * 9  emi_number
         * 10 emi_date
         * 11 emi_status
         * 12 paid_at
         * 13 remaining_balance
         * 14 payment_source
         * 15 source_account_id
         * 16 source_account_number
         *
         * Therefore we need 8 NULL values after
         * transaction_date for normal transactions.
         */

        transactionRows.push([
            saving.account_id,                     // 1
            saving.saving_id,                      // 2
            isDeposit
                ? "DEPOSIT"
                : "WITHDRAWAL",                    // 3
            actualAmount,                          // 4
            before,                                // 5
            after,                                 // 6
            makeReference(
                isDeposit ? "DEP" : "WDL",
                customer.customer_id,
                sequence
            ),                                     // 7
            makeTransactionDate(
                sequence,
                customer.customer_id,
                forceToday
            ),                                     // 8

            null,                                  // 9
            null,                                  // 10
            null,                                  // 11
            null,                                  // 12
            null,                                  // 13
            null,                                  // 14
            null,                                  // 15
            null                                   // 16
        ]);
    }


    /* =====================================================
       EMI PAYMENTS
    ===================================================== */

    for (
        let i = 1;
        i <= desiredEmiPairs;
        i += 1
    ) {
        const amount = Math.min(
            EMI_AMOUNT,
            loanOutstanding
        );

        if (amount <= 0) {
            break;
        }

        const emiNumber = i;

        const emiDate = addMonths(
            REPAYMENT_START_DATE,
            emiNumber - 1
        );

        const paymentDate =
            makeTransactionDate(
                100 + i,
                customer.customer_id,
                false
            );


        /* -------------------------------------------------
           SAVINGS ACCOUNT EMI DEBIT
        ------------------------------------------------- */

        const sourceBefore =
            savingBalance;

        const sourceAfter =
            sourceBefore - amount;

        if (sourceAfter < 1000) {
            break;
        }

        savingBalance =
            money(sourceAfter);

        transactionRows.push([
            saving.account_id,
            saving.saving_id,
            "EMI_PAYMENT",
            amount,
            sourceBefore,
            sourceAfter,
            makeReference(
                "EMISRC",
                customer.customer_id,
                emiNumber
            ),
            paymentDate,
            emiNumber,
            emiDate,
            "PAID",
            emiDate,
            money(
                loanOutstanding - amount
            ),
            "SAVINGS",
            saving.account_id,
            saving.account_number
        ]);


        /* -------------------------------------------------
           LOAN ACCOUNT EMI
        ------------------------------------------------- */

        const loanBefore =
            loanOutstanding;

        loanOutstanding =
            money(
                loanOutstanding - amount
            );

        transactionRows.push([
            loan.account_id,
            null,
            "EMI",
            amount,
            loanBefore,
            loanOutstanding,
            makeReference(
                "EMI",
                customer.customer_id,
                emiNumber
            ),
            paymentDate,
            emiNumber,
            emiDate,
            "PAID",
            emiDate,
            loanOutstanding,
            "SAVINGS",
            saving.account_id,
            saving.account_number
        ]);
    }


    /* =====================================================
       INSERT TRANSACTIONS
    ===================================================== */

    if (transactionRows.length) {
        await connection.query(
            `
            INSERT IGNORE INTO transactions
            (
                account_id,
                saving_id,
                transaction_type,
                amount,
                balance_before,
                balance_after,
                reference_number,
                transaction_date,
                emi_number,
                emi_date,
                emi_status,
                paid_at,
                remaining_balance,
                payment_source,
                source_account_id,
                source_account_number
            )
            VALUES ${transactionRows
                .map(
                    () =>
                        "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                )
                .join(",")}
            `,
            transactionRows.flat()
        );


        /* -------------------------------------------------
           UPDATE SAVINGS BALANCE
        ------------------------------------------------- */

        await connection.query(
            `
            UPDATE saving_accounts
            SET balance = ?
            WHERE saving_id = ?
            `,
            [
                savingBalance,
                saving.saving_id
            ]
        );


        /* -------------------------------------------------
           UPDATE LOAN OUTSTANDING BALANCE
        ------------------------------------------------- */

        await connection.query(
            `
            UPDATE loan_accounts
            SET outstanding_balance = ?
            WHERE loan_id = ?
            `,
            [
                loanOutstanding,
                loan.loan_id
            ]
        );
    }

    return transactionRows.length;
}


/* =========================================================
   MAIN BACKFILL
========================================================= */

async function runBackfill() {
    const db =
        mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT,

            waitForConnections: true,

            connectionLimit: 10,

            queueLimit: 0
        });

    let lastCustomerId = 0;

    let processed = 0;

    let insertedTransactions = 0;

    const connection =
        await db.getConnection();

    try {
        const typeIds =
            await getAccountTypeIds(
                connection
            );


        console.log(
            "=============================================="
        );

        console.log(
            " ZENbank Banking Data Backfill"
        );

        console.log(
            "=============================================="
        );

        console.log(
            `Minimum transactions/customer : ${MIN_TRANSACTIONS_PER_CUSTOMER}`
        );

        console.log(
            `Paid EMIs/customer            : ${PAID_EMIS}`
        );

        console.log(
            `Schedule rows/loan            : ${SCHEDULE_EMIS}`
        );

        console.log(
            "Existing customers are preserved."
        );

        console.log(
            "=============================================="
        );


        while (true) {
            const [customers] =
                await connection.query(
                    `
                    SELECT
                        customer_id,
                        customer_number
                    FROM customers
                    WHERE customer_id > ?
                    ORDER BY customer_id ASC
                    LIMIT ?
                    `,
                    [
                        lastCustomerId,
                        BATCH_CUSTOMERS
                    ]
                );

            if (!customers.length) {
                break;
            }

            const ids =
                customers.map(
                    (c) => c.customer_id
                );

            const placeholders =
                ids.map(() => "?")
                    .join(",");


            await connection.beginTransaction();

            try {
                /* -------------------------------------------------
                   GET EXISTING ACCOUNTS
                ------------------------------------------------- */

                const [
                    existingAccounts
                ] =
                    await connection.query(
                        `
                        SELECT
                            a.account_id,
                            a.customer_id,
                            a.account_number,
                            a.account_type_id,
                            a.account_status,
                            at.account_type,
                            sa.saving_id,
                            sa.balance,
                            la.loan_id,
                            la.outstanding_balance,
                            la.loan_amount,
                            la.emi_amount
                        FROM accounts a
                        INNER JOIN account_types at
                            ON at.account_type_id =
                               a.account_type_id
                        LEFT JOIN saving_accounts sa
                            ON sa.account_id =
                               a.account_id
                        LEFT JOIN loan_accounts la
                            ON la.account_id =
                               a.account_id
                        WHERE a.customer_id IN (${placeholders})
                        `,
                        ids
                    );


                /* -------------------------------------------------
                   CREATE MISSING ACCOUNTS
                ------------------------------------------------- */

                await insertMissingAccounts(
                    connection,
                    customers,
                    existingAccounts,
                    typeIds
                );


                /* -------------------------------------------------
                   GET ACCOUNTS AGAIN
                ------------------------------------------------- */

                const [accounts] =
                    await connection.query(
                        `
                        SELECT
                            a.account_id,
                            a.customer_id,
                            a.account_number,
                            a.account_type_id,
                            a.account_status,
                            LOWER(at.account_type)
                                AS account_type,
                            sa.saving_id,
                            sa.balance,
                            la.loan_id,
                            la.outstanding_balance,
                            la.loan_amount,
                            la.emi_amount
                        FROM accounts a
                        INNER JOIN account_types at
                            ON at.account_type_id =
                               a.account_type_id
                        LEFT JOIN saving_accounts sa
                            ON sa.account_id =
                               a.account_id
                        LEFT JOIN loan_accounts la
                            ON la.account_id =
                               a.account_id
                        WHERE a.customer_id IN (${placeholders})
                        `,
                        ids
                    );


                /* -------------------------------------------------
                   CREATE SAVINGS / LOAN SUB ACCOUNTS
                ------------------------------------------------- */

                await ensureSubAccounts(
                    connection,
                    accounts,
                    typeIds
                );


                /* -------------------------------------------------
                   GET FRESH ACCOUNT DATA
                ------------------------------------------------- */

                const [freshAccounts] =
                    await connection.query(
                        `
                        SELECT
                            a.account_id,
                            a.customer_id,
                            a.account_number,
                            LOWER(at.account_type)
                                AS account_type,
                            sa.saving_id,
                            sa.balance,
                            la.loan_id,
                            la.outstanding_balance,
                            la.loan_amount,
                            la.emi_amount
                        FROM accounts a
                        INNER JOIN account_types at
                            ON at.account_type_id =
                               a.account_type_id
                        LEFT JOIN saving_accounts sa
                            ON sa.account_id =
                               a.account_id
                        LEFT JOIN loan_accounts la
                            ON la.account_id =
                               a.account_id
                        WHERE a.customer_id IN (${placeholders})
                        `,
                        ids
                    );


                /* -------------------------------------------------
                   CURRENT TRANSACTION COUNTS
                ------------------------------------------------- */

                const [
                    transactionCounts
                ] =
                    await connection.query(
                        `
                        SELECT
                            a.customer_id,
                            COUNT(
                                t.transaction_id
                            ) AS transaction_count
                        FROM accounts a
                        LEFT JOIN transactions t
                            ON t.account_id =
                               a.account_id
                        WHERE a.customer_id IN (${placeholders})
                        GROUP BY a.customer_id
                        `,
                        ids
                    );


                const countMap =
                    new Map(
                        transactionCounts.map(
                            (r) => [
                                Number(
                                    r.customer_id
                                ),
                                Number(
                                    r.transaction_count
                                )
                            ]
                        )
                    );


                /* -------------------------------------------------
                   GROUP ACCOUNTS BY CUSTOMER
                ------------------------------------------------- */

                const customersAccounts =
                    new Map();

                for (const account of freshAccounts) {
                    const list =
                        customersAccounts.get(
                            account.customer_id
                        ) || [];

                    list.push(account);

                    customersAccounts.set(
                        account.customer_id,
                        list
                    );
                }


                /* -------------------------------------------------
                   GENERATE TRANSACTIONS
                ------------------------------------------------- */

                for (const customer of customers) {
                    const before =
                        countMap.get(
                            customer.customer_id
                        ) || 0;

                    const added =
                        await backfillCustomer(
                            connection,
                            customer,
                            customersAccounts.get(
                                customer.customer_id
                            ) || [],
                            before
                        );

                    insertedTransactions +=
                        added;
                }


                /* -------------------------------------------------
                   EMI SCHEDULE
                ------------------------------------------------- */

                const loanAccountIds =
                    accounts
                        .filter(
                            (a) =>
                                a.account_type ===
                                "loan"
                        )
                        .map(
                            (a) =>
                                a.account_id
                        );

                let finalLoans = [];

                if (loanAccountIds.length) {
                    const loanPlaceholders =
                        loanAccountIds
                            .map(() => "?")
                            .join(",");

                    [
                        finalLoans
                    ] =
                        await connection.query(
                            `
                            SELECT
                                loan_id,
                                account_id,
                                outstanding_balance,
                                loan_amount,
                                emi_amount,
                                duration_months,
                                repayment_start_date
                            FROM loan_accounts
                            WHERE account_id IN
                                (${loanPlaceholders})
                            `,
                            loanAccountIds
                        );
                }


                await ensureLoanScheduleRows(
                    connection,
                    finalLoans
                );


                await connection.commit();
            } catch (error) {
                await connection.rollback();

                throw error;
            }


            processed +=
                customers.length;

            lastCustomerId =
                customers[
                    customers.length - 1
                ].customer_id;


            if (
                processed %
                (BATCH_CUSTOMERS * 4) ===
                0 ||
                customers.length <
                BATCH_CUSTOMERS
            ) {
                console.log(
                    `Processed ${processed.toLocaleString(
                        "en-IN"
                    )} customers; added ${insertedTransactions.toLocaleString(
                        "en-IN"
                    )} transactions.`
                );
            }
        }


        /* =====================================================
           FINAL SUMMARY
        ===================================================== */

        const [[summary]] =
            await connection.query(
                `
                SELECT

                    (
                        SELECT COUNT(*)
                        FROM customers
                    ) AS customers,

                    (
                        SELECT COUNT(*)
                        FROM accounts
                    ) AS accounts,

                    (
                        SELECT COUNT(*)
                        FROM saving_accounts
                    ) AS savings,

                    (
                        SELECT COUNT(*)
                        FROM loan_accounts
                    ) AS loans,

                    (
                        SELECT COUNT(*)
                        FROM transactions
                    ) AS transactions,

                    (
                        SELECT COUNT(*)
                        FROM loan_emis
                        WHERE emi_status = 'PAID'
                    ) AS paid_emis,

                    (
                        SELECT COUNT(*)
                        FROM loan_emis
                        WHERE emi_status = 'PENDING'
                    ) AS pending_emis
                `
            );


        /* =====================================================
           VERIFICATION
        ===================================================== */

        const [[verification]] =
            await connection.query(
                `
                SELECT

                    MIN(
                        transaction_count
                    ) AS min_transactions_per_customer,

                    MAX(
                        transaction_count
                    ) AS max_transactions_per_customer,

                    SUM(
                        CASE
                            WHEN savings_count >= 1
                             AND loan_count >= 1
                            THEN 1
                            ELSE 0
                        END
                    ) AS customers_with_both_accounts,

                    COUNT(*) AS customer_rows_checked

                FROM
                (
                    SELECT

                        c.customer_id,

                        COUNT(
                            DISTINCT CASE
                                WHEN LOWER(
                                    at.account_type
                                ) = 'savings'
                                THEN a.account_id
                            END
                        ) AS savings_count,

                        COUNT(
                            DISTINCT CASE
                                WHEN LOWER(
                                    at.account_type
                                ) = 'loan'
                                THEN a.account_id
                            END
                        ) AS loan_count,

                        COUNT(
                            t.transaction_id
                        ) AS transaction_count

                    FROM customers c

                    LEFT JOIN accounts a
                        ON a.customer_id =
                           c.customer_id

                    LEFT JOIN account_types at
                        ON at.account_type_id =
                           a.account_type_id

                    LEFT JOIN transactions t
                        ON t.account_id =
                           a.account_id

                    GROUP BY
                        c.customer_id
                ) AS customer_stats
                `
            );


        console.log(
            "=============================================="
        );

        console.log(
            " Backfill completed"
        );

        console.log(
            "=============================================="
        );

        console.log(
            `Customers       : ${Number(
                summary.customers
            ).toLocaleString("en-IN")}`
        );

        console.log(
            `Accounts        : ${Number(
                summary.accounts
            ).toLocaleString("en-IN")}`
        );

        console.log(
            `Savings         : ${Number(
                summary.savings
            ).toLocaleString("en-IN")}`
        );

        console.log(
            `Loans           : ${Number(
                summary.loans
            ).toLocaleString("en-IN")}`
        );

        console.log(
            `Transactions    : ${Number(
                summary.transactions
            ).toLocaleString("en-IN")}`
        );

        console.log(
            `Paid EMIs       : ${Number(
                summary.paid_emis
            ).toLocaleString("en-IN")}`
        );

        console.log(
            `Pending EMIs    : ${Number(
                summary.pending_emis
            ).toLocaleString("en-IN")}`
        );

        console.log(
            `Min transactions/customer : ${Number(
                verification.min_transactions_per_customer ||
                0
            ).toLocaleString("en-IN")}`
        );

        console.log(
            `Customers with Savings+Loan : ${Number(
                verification.customers_with_both_accounts ||
                0
            ).toLocaleString("en-IN")}`
        );

        console.log(
            "=============================================="
        );
    } finally {
        connection.release();

        await db.end();
    }
}


/* =========================================================
   START
========================================================= */

runBackfill().catch((error) => {
    console.error(
        "Banking data backfill failed:",
        error
    );

    process.exit(1);
});
