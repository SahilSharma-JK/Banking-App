const db = require("../../config/db");
const { ensureLoanSchedule, getLoanSchedule } = require("./loanScheduleService");

function badRequest(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function notFound(message) {
    const error = new Error(message);
    error.statusCode = 404;
    return error;
}

function makeReference(prefix) {
    const time = Date.now().toString(36).toUpperCase();
    const random = Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(6, "0");

    return `${prefix}${time}${random}`;
}

async function assertCustomerActive(connectionOrDb, customerId) {
    const [rows] = await connectionOrDb.query(
        `SELECT customer_status FROM customers WHERE customer_id = ? LIMIT 1`,
        [customerId]
    );

    if (!rows.length) {
        throw notFound("Customer not found.");
    }

    if (String(rows[0].customer_status || "Active") !== "Active") {
        throw badRequest("Customer is closed. Reactivate the customer before making changes.");
    }
}


// ============================================================
// GET ALL CUSTOMERS
// ============================================================

async function getAllCustomers() {
    const [customers] = await db.query(`
        SELECT
            c.customer_id,
            c.customer_number,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,
            c.mobile,
            c.dob,
            c.marital_status,
            c.customer_status
        FROM customers c
        ORDER BY c.customer_id DESC
    `);

    return customers;
}


// ============================================================
// GET CUSTOMER BY ID
// ============================================================

async function getCustomerById(customerId) {
    const [customers] = await db.query(`
        SELECT
            customer_id,
            customer_number,
            first_name,
            last_name,
            email,
            phone,
            mobile,
            dob,
            marital_status,
            customer_status
        FROM customers
        WHERE customer_id = ?
    `, [customerId]);

    if (!customers.length) {
        throw notFound("Customer not found");
    }

    const customer = customers[0];


    // --------------------------------------------------------
    // Customer addresses
    // --------------------------------------------------------

    const [addresses] = await db.query(`
        SELECT
            ca.address_id,
            ca.customer_id,
            ca.address_line1,
            ca.address_line2,
            ca.address_type,
            ca.is_primary,
            ca.city_id,
            ca.pin_code,
            ci.city_name,
            s.state_code,
            s.state_name,
            co.country_code,
            co.country_name
        FROM customer_addresses ca
        LEFT JOIN cities ci
            ON ca.city_id = ci.city_id
        LEFT JOIN states s
            ON ci.state_id = s.state_code
        LEFT JOIN countries co
            ON s.country_code = co.country_code
        WHERE ca.customer_id = ?
        ORDER BY ca.is_primary DESC, ca.address_id ASC
    `, [customerId]);


    // --------------------------------------------------------
    // Customer accounts
    // --------------------------------------------------------

    const [accounts] = await db.query(`
        SELECT
            a.account_id,
            a.account_number,
            a.customer_id,
            a.account_type_id,
            at.account_type,
            at.account_subtype,
            a.account_status,
            a.opened_at,

            COALESCE(
                sa.balance,
                la.outstanding_balance
            ) AS balance,

            sa.saving_id,
            sa.balance AS saving_balance,
            sa.minimum_balance,
            sa.withdrawal_limit,
            sa.transfer_limit,
            sa.branch_code,

            la.loan_id,
            la.loan_amount,
            la.outstanding_balance AS loan_outstanding_balance,
            la.interest_rate,
            la.duration_months,
            la.emi_amount,
            la.repayment_start_date

        FROM accounts a

        INNER JOIN account_types at
            ON a.account_type_id = at.account_type_id

        LEFT JOIN saving_accounts sa
            ON a.account_id = sa.account_id

        LEFT JOIN loan_accounts la
            ON a.account_id = la.account_id

        WHERE a.customer_id = ?

        ORDER BY a.account_id ASC
    `, [customerId]);


    const loanSchedules = await Promise.all(
        accounts
            .filter((a) => Number(a.account_type_id) === 2 && a.loan_id)
            .map(async (a) => [a.account_id, await getLoanSchedule(a.account_id)])
    );

    const scheduleByAccountId = new Map(loanSchedules);

    return {
        ...customer,

        addresses,

        address:
            addresses.find(
                (a) => Number(a.is_primary) === 1
            ) ||
            addresses[0] ||
            null,

        accounts: accounts.map((a) => ({
            account_id: a.account_id,
            account_number: a.account_number,
            customer_id: a.customer_id,
            account_type_id: a.account_type_id,
            account_type: a.account_type,
            account_subtype: a.account_subtype,
            account_status: a.account_status,
            opened_at: a.opened_at,
            balance: a.balance,

            saving_details:
                Number(a.account_type_id) === 1
                    ? {
                        saving_id: a.saving_id,
                        balance: a.saving_balance,
                        minimum_balance: a.minimum_balance,
                        withdrawal_limit: a.withdrawal_limit,
                        transfer_limit: a.transfer_limit,
                        branch_code: a.branch_code,
                    }
                    : null,

            loan_details:
                Number(a.account_type_id) === 2
                    ? {
                        loan_id: a.loan_id,
                        loan_amount: a.loan_amount,
                        outstanding_balance:
                            a.loan_outstanding_balance,
                        interest_rate: a.interest_rate,
                        duration_months: a.duration_months,
                        emi_amount: a.emi_amount,
                        repayment_start_date: a.repayment_start_date,
                        emi_schedule: scheduleByAccountId.get(a.account_id) || [],
                    }
                    : null,
        })),
    };
}


// ============================================================
// VALIDATE ADDRESS
// ============================================================

async function validateAddress(connection, cityId, stateCode) {
    const [cities] = await connection.query(`
        SELECT
            ci.city_id,
            ci.state_id
        FROM cities ci
        WHERE ci.city_id = ?
    `, [cityId]);

    if (!cities.length) {
        throw badRequest("Selected city does not exist.");
    }

    if (
        stateCode &&
        String(cities[0].state_id) !== String(stateCode)
    ) {
        throw badRequest(
            "Selected city does not belong to the selected state."
        );
    }
}


// ============================================================
// CREATE CUSTOMER
// ============================================================

async function createCustomer(customerData) {
    const {
        customer_number,
        first_name,
        last_name,
        email,
        phone,
        mobile,
        dob,
        marital_status,

        city_id,
        state_code,

        PIN_code,
        pin_code,

        address_line1,
        address_line2,
        address_type,
        is_primary,

        account_number,
        account_type_id,
        initial_balance,
        minimum_balance,
        withdrawal_limit,
        transfer_limit,
        branch_code,
        loan_amount,
        interest_rate,
        duration_months,
        emi_amount,
        repayment_start_date,
    } = customerData;


    if (!first_name?.trim()) {
        throw badRequest("First name is required.");
    }

    if (!last_name?.trim()) {
        throw badRequest("Last name is required.");
    }

    if (!email?.trim()) {
        throw badRequest("Email is required.");
    }

    if (!mobile?.trim()) {
        throw badRequest("Mobile number is required.");
    }

    if (!city_id) {
        throw badRequest("City is required.");
    }

    if (!address_line1?.trim()) {
        throw badRequest("Address Line 1 is required.");
    }


    const finalPin = String(
        PIN_code ?? pin_code ?? ""
    ).trim();

    if (!/^\d{6}$/.test(finalPin)) {
        throw badRequest(
            "PIN code must be exactly 6 digits."
        );
    }


    const typeId = Number(account_type_id || 1);

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();


        // Validate city/state
        await validateAddress(
            connection,
            Number(city_id),
            state_code
        );


        // Generate references if not supplied
        const finalCustomerNumber =
            customer_number?.trim() ||
            makeReference("CUST");

        const finalAccountNumber =
            account_number?.trim() ||
            makeReference("ACC");


        // ----------------------------------------------------
        // Check duplicate email
        // ----------------------------------------------------

        const [emailRows] = await connection.query(
            `
            SELECT customer_id
            FROM customers
            WHERE email = ?
            LIMIT 1
            `,
            [email.trim()]
        );

        if (emailRows.length) {
            throw badRequest(
                "Email is already registered."
            );
        }


        // ----------------------------------------------------
        // Check duplicate customer number
        // ----------------------------------------------------

        const [customerRows] = await connection.query(
            `
            SELECT customer_id
            FROM customers
            WHERE customer_number = ?
            LIMIT 1
            `,
            [finalCustomerNumber]
        );

        if (customerRows.length) {
            throw badRequest(
                "Customer number already exists."
            );
        }


        // ----------------------------------------------------
        // Check duplicate account number
        // ----------------------------------------------------

        const [accountRows] = await connection.query(
            `
            SELECT account_id
            FROM accounts
            WHERE account_number = ?
            LIMIT 1
            `,
            [finalAccountNumber]
        );

        if (accountRows.length) {
            throw badRequest(
                "Account number already exists."
            );
        }


        // ----------------------------------------------------
        // Validate account type
        // ----------------------------------------------------

        const [typeRows] = await connection.query(
            `
            SELECT account_type_id
            FROM account_types
            WHERE account_type_id = ?
            LIMIT 1
            `,
            [typeId]
        );

        if (!typeRows.length) {
            throw badRequest(
                "Invalid account type."
            );
        }


        // ----------------------------------------------------
        // Insert customer
        // ----------------------------------------------------

        const [customerResult] =
            await connection.query(
                `
                INSERT INTO customers
                (
                    customer_number,
                    first_name,
                    last_name,
                    email,
                    phone,
                    mobile,
                    dob,
                    marital_status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    finalCustomerNumber,
                    first_name.trim(),
                    last_name.trim(),
                    email.trim(),
                    phone?.trim() || null,
                    mobile.trim(),
                    dob || null,
                    marital_status || null,
                ]
            );


        const customerId =
            customerResult.insertId;


        // ----------------------------------------------------
        // Insert address
        // ----------------------------------------------------

        await connection.query(
            `
            INSERT INTO customer_addresses
            (
                customer_id,
                city_id,
                pin_code,
                address_line1,
                address_line2,
                address_type,
                is_primary
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                customerId,
                Number(city_id),
                finalPin,
                address_line1.trim(),
                address_line2?.trim() || null,
                address_type || "Permanent",
                1,
            ]
        );


        // ----------------------------------------------------
        // Insert account
        // ----------------------------------------------------

        const [accountResult] =
            await connection.query(
                `
                INSERT INTO accounts
                (
                    account_number,
                    customer_id,
                    account_type_id,
                    account_status,
                    opened_at
                )
                VALUES (?, ?, ?, 'Active', CURDATE())
                `,
                [
                    finalAccountNumber,
                    customerId,
                    typeId,
                ]
            );


        // ----------------------------------------------------
        // Create savings account
        // ----------------------------------------------------

        if (typeId === 1) {
            const balance = Number(initial_balance || 0);
            const minBalance = Number(minimum_balance || 0);
            const withdrawalLimit =
                withdrawal_limit === undefined || withdrawal_limit === ""
                    ? null
                    : Number(withdrawal_limit);
            const transferLimit =
                transfer_limit === undefined || transfer_limit === ""
                    ? null
                    : Number(transfer_limit);

            if (
                !Number.isFinite(balance) ||
                balance < 0 ||
                !Number.isFinite(minBalance) ||
                minBalance < 0 ||
                (withdrawalLimit !== null &&
                    (!Number.isFinite(withdrawalLimit) || withdrawalLimit < 0))
            ) {
                throw badRequest("Savings account values must be valid non-negative numbers.");
            }

            if (balance < minBalance) {
                throw badRequest("Initial balance cannot be below the minimum balance.");
            }

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
                VALUES (?, ?, ?, ?, ?, ?)
                `,
                [
                    accountResult.insertId,
                    balance,
                    minBalance,
                    withdrawalLimit,
                    transferLimit,
                    branch_code?.trim() || null
                ]
            );
        }

        // ----------------------------------------------------
        // Create loan account
        // ----------------------------------------------------

        else if (typeId === 2) {
            const principal = Number(loan_amount || 0);
            const rate = Number(interest_rate || 0);
            const months = Number(duration_months || 0);

            if (
                !Number.isFinite(principal) ||
                principal <= 0 ||
                !Number.isFinite(rate) ||
                rate < 0 ||
                !Number.isInteger(months) ||
                months <= 0
            ) {
                throw badRequest(
                    "Loan principal, interest rate and tenure are required."
                );
            }

            const monthlyRate = rate / 100 / 12;
            const calculatedEmi =
                emi_amount !== undefined && emi_amount !== ""
                    ? Number(emi_amount)
                    : monthlyRate === 0
                        ? principal / months
                        : principal *
                        monthlyRate *
                        Math.pow(1 + monthlyRate, months) /
                        (Math.pow(1 + monthlyRate, months) - 1);

            if (!Number.isFinite(calculatedEmi) || calculatedEmi <= 0) {
                throw badRequest("EMI amount could not be calculated.");
            }

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
                VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    accountResult.insertId,
                    principal,
                    principal,
                    rate,
                    months,
                    calculatedEmi,
                    repayment_start_date || null
                ]
            );

            const [loanRows] = await connection.query(
                `SELECT loan_id, loan_amount, outstanding_balance, interest_rate, duration_months, emi_amount, repayment_start_date
                 FROM loan_accounts WHERE account_id = ? LIMIT 1`,
                [accountResult.insertId]
            );
            if (loanRows.length) {
                await ensureLoanSchedule(connection, loanRows[0]);
            }
        }


        await connection.commit();

        return await getCustomerById(
            customerId
        );

    } catch (error) {
        await connection.rollback();
        throw error;

    } finally {
        connection.release();
    }
}


// ============================================================
// ADD ACCOUNT TO EXISTING CUSTOMER
// ============================================================

async function addCustomerAccount(customerId, accountData) {
    const {
        account_type_id,
        account_number,
        initial_balance,
        minimum_balance,
        withdrawal_limit,
        transfer_limit,
        branch_code,
        loan_amount,
        interest_rate,
        duration_months,
        emi_amount,
        repayment_start_date,
    } = accountData || {};

    const typeId = Number(account_type_id);

    if (![1, 2].includes(typeId)) {
        throw badRequest("Only Savings and Loan accounts can be added.");
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        await assertCustomerActive(connection, customerId);

        const [customerRows] = await connection.query(
            `SELECT customer_id FROM customers WHERE customer_id = ? LIMIT 1`,
            [customerId]
        );

        if (!customerRows.length) {
            throw notFound("Customer not found.");
        }

        const finalAccountNumber =
            account_number?.trim() || makeReference("ACC");

        const [duplicate] = await connection.query(
            `SELECT account_id FROM accounts WHERE account_number = ? LIMIT 1`,
            [finalAccountNumber]
        );

        if (duplicate.length) {
            throw badRequest("Account number already exists.");
        }

        const [accountResult] = await connection.query(
            `
            INSERT INTO accounts
            (
                account_number,
                customer_id,
                account_type_id,
                account_status,
                opened_at
            )
            VALUES (?, ?, ?, 'Active', CURDATE())
            `,
            [finalAccountNumber, customerId, typeId]
        );

        if (typeId === 1) {
            const balance = Number(initial_balance || 0);
            const minBalance = Number(minimum_balance || 0);
            const withdrawalLimit =
                withdrawal_limit === undefined || withdrawal_limit === ""
                    ? null
                    : Number(withdrawal_limit);
            const transferLimit =
                transfer_limit === undefined || transfer_limit === ""
                    ? null
                    : Number(transfer_limit);

            if (
                !Number.isFinite(balance) ||
                balance < 0 ||
                !Number.isFinite(minBalance) ||
                minBalance < 0 ||
                balance < minBalance ||
                (withdrawalLimit !== null &&
                    (!Number.isFinite(withdrawalLimit) || withdrawalLimit < 0))
            ) {
                throw badRequest("Savings account values are invalid.");
            }

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
                VALUES (?, ?, ?, ?, ?, ?)
                `,
                [
                    accountResult.insertId,
                    balance,
                    minBalance,
                    withdrawalLimit,
                    transferLimit,
                    branch_code?.trim() || null
                ]
            );
        } else {
            const principal = Number(loan_amount || 0);
            const rate = Number(interest_rate || 0);
            const months = Number(duration_months || 0);

            if (
                !Number.isFinite(principal) ||
                principal <= 0 ||
                !Number.isFinite(rate) ||
                rate < 0 ||
                !Number.isInteger(months) ||
                months <= 0
            ) {
                throw badRequest("Loan principal, rate and tenure are required.");
            }

            const monthlyRate = rate / 100 / 12;
            const calculatedEmi =
                emi_amount !== undefined && emi_amount !== ""
                    ? Number(emi_amount)
                    : monthlyRate === 0
                        ? principal / months
                        : principal *
                        monthlyRate *
                        Math.pow(1 + monthlyRate, months) /
                        (Math.pow(1 + monthlyRate, months) - 1);

            if (!Number.isFinite(calculatedEmi) || calculatedEmi <= 0) {
                throw badRequest("EMI amount could not be calculated.");
            }

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
                VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    accountResult.insertId,
                    principal,
                    principal,
                    rate,
                    months,
                    calculatedEmi,
                    repayment_start_date || null
                ]
            );

            const [loanRows] = await connection.query(
                `SELECT loan_id, loan_amount, outstanding_balance, interest_rate, duration_months, emi_amount, repayment_start_date
                 FROM loan_accounts WHERE account_id = ? LIMIT 1`,
                [accountResult.insertId]
            );
            if (loanRows.length) {
                await ensureLoanSchedule(connection, loanRows[0]);
            }
        }

        await connection.commit();
        return await getCustomerById(customerId);
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}


// ============================================================
// UPDATE CUSTOMER
// ============================================================

async function updateCustomer(
    customerId,
    customerData
) {
    const {
        first_name,
        last_name,
        email,
        phone,
        mobile,
        dob,
        marital_status,
    } = customerData;


    await assertCustomerActive(db, customerId);

    if (!first_name?.trim()) {
        throw badRequest("First name is required.");
    }

    if (!last_name?.trim()) {
        throw badRequest("Last name is required.");
    }

    if (!email?.trim()) {
        throw badRequest("Email is required.");
    }

    if (!mobile?.trim()) {
        throw badRequest("Mobile number is required.");
    }


    // Check duplicate email
    const [duplicate] = await db.query(
        `
        SELECT customer_id
        FROM customers
        WHERE email = ?
          AND customer_id <> ?
        LIMIT 1
        `,
        [
            email.trim(),
            customerId,
        ]
    );

    if (duplicate.length) {
        throw badRequest(
            "Email is already registered to another customer."
        );
    }


    const [result] = await db.query(
        `
        UPDATE customers
        SET
            first_name = ?,
            last_name = ?,
            email = ?,
            phone = ?,
            mobile = ?,
            dob = ?,
            marital_status = ?
        WHERE customer_id = ?
        `,
        [
            first_name.trim(),
            last_name.trim(),
            email.trim(),
            phone?.trim() || null,
            mobile.trim(),
            dob || null,
            marital_status || null,
            customerId,
        ]
    );


    if (!result.affectedRows) {
        throw notFound(
            "Customer not found."
        );
    }


    return await getCustomerById(
        customerId
    );
}


// ============================================================
// ADD CUSTOMER ADDRESS
// ============================================================

async function addCustomerAddress(
    customerId,
    addressData
) {
    const {
        city_id,
        state_code,
        PIN_code,
        pin_code,
        address_line1,
        address_line2,
        address_type,
        is_primary,
    } = addressData;


    if (!city_id) {
        throw badRequest("City is required.");
    }

    if (!address_line1?.trim()) {
        throw badRequest(
            "Address Line 1 is required."
        );
    }


    const finalPin = String(
        PIN_code ?? pin_code ?? ""
    ).trim();

    if (!/^\d{6}$/.test(finalPin)) {
        throw badRequest(
            "PIN code must be exactly 6 digits."
        );
    }


    const connection =
        await db.getConnection();

    try {
        await connection.beginTransaction();


        // Check customer
        const [customerRows] =
            await connection.query(
                `
                SELECT customer_id
                FROM customers
                WHERE customer_id = ?
                `,
                [customerId]
            );

        if (!customerRows.length) {
            throw notFound(
                "Customer not found."
            );
        }


        await validateAddress(
            connection,
            Number(city_id),
            state_code
        );


        // Make this address primary
        if (is_primary) {
            await connection.query(
                `
                UPDATE customer_addresses
                SET is_primary = 0
                WHERE customer_id = ?
                `,
                [customerId]
            );
        }


        await connection.query(
            `
            INSERT INTO customer_addresses
            (
                customer_id,
                city_id,
                pin_code,
                address_line1,
                address_line2,
                address_type,
                is_primary
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                customerId,
                Number(city_id),
                finalPin,
                address_line1.trim(),
                address_line2?.trim() || null,
                address_type || "Permanent",
                is_primary ? 1 : 0,
            ]
        );


        await connection.commit();

        return await getCustomerById(
            customerId
        );

    } catch (error) {
        await connection.rollback();
        throw error;

    } finally {
        connection.release();
    }
}


// ============================================================
// UPDATE CUSTOMER ADDRESS
// ============================================================

async function updateCustomerAddress(
    customerId,
    addressId,
    addressData
) {
    const {
        city_id,
        state_code,
        PIN_code,
        pin_code,
        address_line1,
        address_line2,
        address_type,
        is_primary,
    } = addressData;


    if (!city_id) {
        throw badRequest("City is required.");
    }

    if (!address_line1?.trim()) {
        throw badRequest(
            "Address Line 1 is required."
        );
    }


    const finalPin = String(
        PIN_code ?? pin_code ?? ""
    ).trim();

    if (!/^\d{6}$/.test(finalPin)) {
        throw badRequest(
            "PIN code must be exactly 6 digits."
        );
    }


    const connection =
        await db.getConnection();

    try {
        await connection.beginTransaction();


        // Check address belongs to customer
        const [rows] =
            await connection.query(
                `
                SELECT
                    address_id,
                    is_primary
                FROM customer_addresses
                WHERE address_id = ?
                  AND customer_id = ?
                `,
                [
                    addressId,
                    customerId,
                ]
            );


        if (!rows.length) {
            throw notFound(
                "Customer address not found."
            );
        }


        await validateAddress(
            connection,
            Number(city_id),
            state_code
        );


        // Remove primary flag from other addresses
        if (is_primary) {
            await connection.query(
                `
                UPDATE customer_addresses
                SET is_primary = 0
                WHERE customer_id = ?
                `,
                [customerId]
            );
        }


        await connection.query(
            `
            UPDATE customer_addresses
            SET
                city_id = ?,
                pin_code = ?,
                address_line1 = ?,
                address_line2 = ?,
                address_type = ?,
                is_primary = ?
            WHERE address_id = ?
              AND customer_id = ?
            `,
            [
                Number(city_id),
                finalPin,
                address_line1.trim(),
                address_line2?.trim() || null,
                address_type || "Permanent",
                is_primary ? 1 : 0,
                addressId,
                customerId,
            ]
        );


        await connection.commit();

        return await getCustomerById(
            customerId
        );

    } catch (error) {
        await connection.rollback();
        throw error;

    } finally {
        connection.release();
    }
}


// ============================================================
// SEARCH CUSTOMERS
// ============================================================

async function searchCustomers(filters = {}) {
    const { search, customer_id, customer_number, name, first_name, last_name, email, mobile, phone, state_code, city_id, account_number, account_status, address, suggest } = filters;
    const term = String(search || "").trim();
    const isSuggestion = String(suggest || "").toLowerCase() === "true" || suggest === true;
    const hasOtherFilter = Object.keys(filters).some((key) => key !== "search" && key !== "suggest" && String(filters[key] || "").trim());

    if (term && /^\d+$/.test(term) && !hasOtherFilter) {
        const [rows] = await db.query(`SELECT customer_id, customer_number, first_name, last_name, email, phone, mobile, dob, marital_status, customer_status FROM customers WHERE customer_id = ? LIMIT 1`, [Number(term)]);
        return rows;
    }
    if (term && /^CUS\d+$/i.test(term) && !hasOtherFilter) {
        const [rows] = await db.query(`SELECT customer_id, customer_number, first_name, last_name, email, phone, mobile, dob, marital_status, customer_status FROM customers WHERE customer_number = ? LIMIT 1`, [term]);
        return rows;
    }

    if (isSuggestion && term.length >= 2) {
        const words = term.split(/\s+/).filter(Boolean);
        const firstWord = words[0] || term;
        const secondWord = words[1] || "";
        const prefix = `${term}%`;
        const firstPrefix = `${firstWord}%`;
        const secondPrefix = secondWord ? `${secondWord}%` : firstPrefix;
        const [rows] = await db.query(`
            SELECT c.customer_id, c.customer_number, c.first_name, c.last_name, c.email, c.phone, c.mobile, c.customer_status
            FROM customers c
            WHERE c.customer_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR c.mobile LIKE ? OR c.phone LIKE ?
               OR (c.first_name LIKE ? AND c.last_name LIKE ?)
               OR EXISTS (SELECT 1 FROM accounts a WHERE a.customer_id = c.customer_id AND a.account_number LIKE ?)
            ORDER BY CASE WHEN c.customer_number = ? THEN 0 WHEN c.customer_number LIKE ? THEN 1 WHEN c.first_name LIKE ? THEN 2 WHEN c.last_name LIKE ? THEN 3 ELSE 4 END, c.customer_id DESC
            LIMIT 8
        `, [prefix, firstPrefix, firstPrefix, prefix, prefix, prefix, firstPrefix, secondPrefix, prefix, term, prefix, firstPrefix, firstPrefix]);
        return rows;
    }

    const where = [], values = [];
    if (term) {
        const like = `%${term}%`;
        where.push(`(CAST(c.customer_id AS CHAR) LIKE ? OR c.customer_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR CONCAT_WS(' ', c.first_name, c.last_name) LIKE ? OR c.email LIKE ? OR c.mobile LIKE ? OR c.phone LIKE ? OR EXISTS (SELECT 1 FROM accounts ax WHERE ax.customer_id = c.customer_id AND ax.account_number LIKE ?))`);
        values.push(like, like, like, like, like, like, like, like, like);
    }
    if (customer_id) { where.push('c.customer_id = ?'); values.push(customer_id); }
    if (customer_number) { where.push('c.customer_number LIKE ?'); values.push(`%${customer_number}%`); }
    if (name) { where.push(`CONCAT_WS(' ', c.first_name, c.last_name) LIKE ?`); values.push(`%${String(name).trim()}%`); }
    if (first_name) { where.push('c.first_name LIKE ?'); values.push(`%${first_name}%`); }
    if (last_name) { where.push('c.last_name LIKE ?'); values.push(`%${last_name}%`); }
    if (email) { where.push('c.email LIKE ?'); values.push(`%${email}%`); }
    if (mobile) { where.push('c.mobile LIKE ?'); values.push(`%${mobile}%`); }
    if (phone) { where.push('c.phone LIKE ?'); values.push(`%${phone}%`); }
    if (account_number) { where.push(`EXISTS (SELECT 1 FROM accounts ax WHERE ax.customer_id = c.customer_id AND ax.account_number LIKE ?)`); values.push(`%${account_number}%`); }
    if (account_status) { where.push(`EXISTS (SELECT 1 FROM accounts ax WHERE ax.customer_id = c.customer_id AND ax.account_status = ?)`); values.push(account_status); }
    if (state_code || city_id || address) {
        where.push(`EXISTS (SELECT 1 FROM customer_addresses ca LEFT JOIN cities ci ON ci.city_id = ca.city_id LEFT JOIN states s ON s.state_code = ci.state_id WHERE ca.customer_id = c.customer_id ${state_code ? 'AND s.state_code = ?' : ''} ${city_id ? 'AND ci.city_id = ?' : ''} ${address ? 'AND (ca.address_line1 LIKE ? OR ca.address_line2 LIKE ? OR ca.pin_code LIKE ? OR ci.city_name LIKE ? OR s.state_name LIKE ? OR s.state_code LIKE ?)' : ''})`);
        if (state_code) values.push(state_code); if (city_id) values.push(city_id);
        if (address) { const like = `%${String(address).trim()}%`; values.push(like, like, like, like, like, like); }
    }
    const [customers] = await db.query(`SELECT c.customer_id, c.customer_number, c.first_name, c.last_name, c.email, c.phone, c.mobile, c.dob, c.marital_status, c.customer_status FROM customers c ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY c.customer_id DESC LIMIT 25`, values);
    return customers;
}


// ============================================================
// GET CUSTOMER COUNT
// ============================================================

async function getCustomerCount() {
    const [rows] = await db.query(`
        SELECT COUNT(*) AS total
        FROM customers
    `);

    return Number(
        rows[0]?.total || 0
    );
}


// ============================================================
// GET ALL CITIES
// ============================================================

async function getAllCities() {
    const [cities] = await db.query(`
        SELECT
            city_id,
            state_id,
            city_name
        FROM cities
        ORDER BY city_name ASC
    `);

    return cities;
}


// ============================================================
// GET ALL STATES
// ============================================================

async function getAllStates() {
    const [states] = await db.query(`
        SELECT
            state_code,
            state_name
        FROM states
        ORDER BY state_name ASC
    `);

    return states;
}



// ============================================================
// DELETE CUSTOMER ADDRESS
// ============================================================

async function deleteCustomerAddress(
    customerId,
    addressId
) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.query(
            `
            SELECT
                address_id,
                is_primary
            FROM customer_addresses
            WHERE address_id = ?
              AND customer_id = ?
            FOR UPDATE
            `,
            [addressId, customerId]
        );

        if (!rows.length) {
            throw notFound("Customer address not found.");
        }

        const wasPrimary = Number(rows[0].is_primary) === 1;

        await connection.query(
            `
            DELETE FROM customer_addresses
            WHERE address_id = ?
              AND customer_id = ?
            `,
            [addressId, customerId]
        );

        // If the deleted address was primary, promote another remaining
        // address so the customer does not end up without a primary address.
        if (wasPrimary) {
            const [remaining] = await connection.query(
                `
                SELECT address_id
                FROM customer_addresses
                WHERE customer_id = ?
                ORDER BY address_id ASC
                LIMIT 1
                `,
                [customerId]
            );

            if (remaining.length) {
                await connection.query(
                    `
                    UPDATE customer_addresses
                    SET is_primary = 1
                    WHERE address_id = ?
                      AND customer_id = ?
                    `,
                    [remaining[0].address_id, customerId]
                );
            }
        }

        await connection.commit();

        return await getCustomerById(customerId);
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// ============================================================
// GET CITIES BY STATE
// ============================================================

async function getCitiesByState(
    stateCode
) {
    const [cities] = await db.query(
        `
        SELECT
            city_id,
            state_id,
            city_name
        FROM cities
        WHERE state_id = ?
        ORDER BY city_name ASC
        `,
        [stateCode]
    );

    return cities;
}


// ============================================================
// GET ACCOUNT TYPES
// ============================================================

async function getAccountTypes() {
    const [types] = await db.query(`
        SELECT
            account_type_id,
            account_type,
            account_subtype
        FROM account_types
        ORDER BY account_type_id ASC
    `);

    return types;
}


// ============================================================
// CLOSE / REACTIVATE CUSTOMER (SOFT STATUS)
// ============================================================

async function setCustomerStatus(customerId, status) {
    const normalizedStatus = String(status || "").trim().toLowerCase();

    if (!["active", "closed"].includes(normalizedStatus)) {
        throw badRequest("Customer status must be Active or Closed.");
    }

    const [existing] = await db.query(
        `SELECT customer_id, customer_status
         FROM customers
         WHERE customer_id = ?
         LIMIT 1`,
        [customerId]
    );

    if (!existing.length) {
        throw notFound("Customer not found.");
    }

    const nextStatus = normalizedStatus === "closed" ? "Closed" : "Active";

    await db.query(
        `UPDATE customers
         SET customer_status = ?
         WHERE customer_id = ?`,
        [nextStatus, customerId]
    );

    const [rows] = await db.query(
        `SELECT
            customer_id,
            customer_number,
            first_name,
            last_name,
            email,
            phone,
            mobile,
            dob,
            marital_status,
            customer_status
         FROM customers
         WHERE customer_id = ?
         LIMIT 1`,
        [customerId]
    );

    return rows[0];
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    getAllCustomers,
    getCustomerById,

    createCustomer,
    updateCustomer,
    addCustomerAccount,

    addCustomerAddress,
    updateCustomerAddress,
    deleteCustomerAddress,

    setCustomerStatus,

    searchCustomers,

    getCustomerCount,

    getAllCities,
    getAllStates,
    getCitiesByState,

    getAccountTypes,
};

