/*seed.js is only used to populate the database with initial or test data*/

const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
require("dotenv").config();

const fs = require("fs");
const path = require("path");

const PINCODE_CSV = path.resolve(__dirname, "data/pincode.csv");

function parseCsvLine(line) {
    const values = [];
    let value = "";
    let quoted = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') {
            if (quoted && line[i + 1] === '"') {
                value += '"';
                i += 1;
            } else {
                quoted = !quoted;
            }
            continue;
        }
        if (char === "," && !quoted) {
            values.push(value.trim());
            value = "";
            continue;
        }
        value += char;
    }
    values.push(value.trim());
    return values;
}

function cleanLocationName(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeLocationName(value) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function makeGeneratedStateCode(stateName, usedCodes) {
    const letters = normalizeLocationName(stateName);
    const base = (letters.slice(0, 2) || "ST").padEnd(2, "X");
    let code = base;
    let suffix = 1;
    while (usedCodes.has(code)) {
        code = `${base}${String(suffix).padStart(2, "0")}`.slice(0, 10);
        suffix += 1;
    }
    usedCodes.add(code);
    return code;
}

async function seedIndiaPincodeData() {
    if (!fs.existsSync(PINCODE_CSV)) {
        console.warn(`PIN code CSV not found at ${PINCODE_CSV}. Skipping India location import.`);
        return;
    }

    const csv = fs.readFileSync(PINCODE_CSV, "utf8").replace(/^\uFEFF/, "");
    const lines = csv.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return;

    const headers = parseCsvLine(lines[0]).map((value) => value.trim().toLowerCase());
    const pinIndex = headers.indexOf("pincode");
    const districtIndex = headers.indexOf("districtname");
    const stateIndex = headers.indexOf("statename");

    if (pinIndex === -1 || districtIndex === -1 || stateIndex === -1) {
        throw new Error("pincode.csv must contain pincode, Districtname and statename columns.");
    }

    await db.query(`INSERT IGNORE INTO countries (country_code, country_name) VALUES ('IN', 'India')`);

    const [existingStates] = await db.query(`SELECT state_code, state_name FROM states`);
    const stateByNormalizedName = new Map(
        existingStates.map((row) => [normalizeLocationName(row.state_name), row.state_code])
    );
    const usedCodes = new Set(existingStates.map((row) => String(row.state_code)));

    const stateNames = new Map();
    const cityPairs = new Map();

    for (let i = 1; i < lines.length; i += 1) {
        const row = parseCsvLine(lines[i]);
        const stateName = cleanLocationName(row[stateIndex]);
        const districtName = cleanLocationName(row[districtIndex]);
        const pin = String(row[pinIndex] || "").replace(/\D/g, "");
        if (!stateName || !districtName || !/^\d{6}$/.test(pin)) continue;

        const normalizedState = normalizeLocationName(stateName);
        stateNames.set(normalizedState, stateName);
        if (!cityPairs.has(normalizedState)) cityPairs.set(normalizedState, new Set());
        cityPairs.get(normalizedState).add(districtName);
    }

    for (const [normalizedState, stateName] of stateNames) {
        let stateCode = stateByNormalizedName.get(normalizedState);
        if (!stateCode) {
            stateCode = makeGeneratedStateCode(stateName, usedCodes);
            await db.query(
                `INSERT INTO states (state_code, country_code, state_name) VALUES (?, 'IN', ?)`,
                [stateCode, stateName]
            );
            stateByNormalizedName.set(normalizedState, stateCode);
        }
    }

    const [existingCities] = await db.query(`SELECT state_id, city_name FROM cities`);
    const existingCityKeys = new Set(
        existingCities.map((row) => `${row.state_id}|${normalizeLocationName(row.city_name)}`)
    );

    const pendingCities = [];
    for (const [normalizedState, cityNames] of cityPairs) {
        const stateCode = stateByNormalizedName.get(normalizedState);
        for (const cityName of cityNames) {
            const key = `${stateCode}|${normalizeLocationName(cityName)}`;
            if (existingCityKeys.has(key)) continue;
            pendingCities.push([stateCode, cityName]);
            existingCityKeys.add(key);
        }
    }

    for (let i = 0; i < pendingCities.length; i += 500) {
        const batch = pendingCities.slice(i, i + 500);
        const placeholders = batch.map(() => "(?, ?)").join(", ");
        await db.query(
            `INSERT INTO cities (state_id, city_name) VALUES ${placeholders}`,
            batch.flat()
        );
    }

    console.log(
        `India PIN data imported from CSV: ${stateNames.size} states, ${existingCityKeys.size} unique state/city mappings.`
    );
}

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
});


// SEED DATABASE
async function seedDatabase() {
    try {
        console.log("Starting database seeding:-");
        // COUNTRIES table

        await db.query(`INSERT IGNORE INTO countries (country_code, country_name) VALUES ('IN', 'India')`);

        console.log("Countries seeded.");

        await seedIndiaPincodeData();

        // STATES table
        await db.query(`INSERT IGNORE INTO states (state_code, country_code, state_name) VALUES
        ('MH', 'IN', 'Maharashtra'),
        ('DL', 'IN', 'Delhi')
        `);

        console.log("States seeded.");

        // CITIES table
        await db.query(`INSERT INTO cities (state_id, city_name)
        SELECT 'MH', 'Mumbai'
        WHERE NOT EXISTS (
            SELECT 1
            FROM cities
            WHERE state_id = 'MH'
            AND city_name = 'Mumbai'
            )
        `);

        await db.query(`
        INSERT INTO cities (state_id, city_name)
        SELECT 'DL', 'New Delhi'
        WHERE NOT EXISTS (
            SELECT 1
            FROM cities
            WHERE state_id = 'DL'
            AND city_name = 'New Delhi'
            )
        `);

        console.log("Cities seeded.");

        // 5. CUSTOMERS tables

        await db.query(`
        INSERT IGNORE INTO customers
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
        VALUES
            (
            'CUS001',
            'Rahul',
            'Sharma',
            'rahul@example.com',
            '01140000001',
            '9876543210',
            '1995-05-15',
            'Single'
            ),
            (
            'CUS002',
            'Priya',
            'Verma',
            'priya@example.com',
            '02240000002',
            '9876543211',
            '1993-08-20',
            'Married'
            )
        `);

        console.log("Customers seeded.");

        // 6. CUSTOMER_ADDRESSES table

        const [customers] = await db.query(`
        SELECT customer_id, customer_number
        FROM customers
        WHERE customer_number IN ('CUS001', 'CUS002')
        `);

        const customer1 = customers.find(
            customer => customer.customer_number === "CUS001"
        );

        const customer2 = customers.find(
            customer => customer.customer_number === "CUS002"
        );

        // Get the city IDs for the addresses.
        const [cities] = await db.query(`
            SELECT city_id, state_id, city_name
            FROM cities
            WHERE (state_id = 'MH' AND city_name = 'Mumbai')
            OR (state_id = 'DL' AND city_name = 'New Delhi')
        `);

        const mumbaiCity = cities.find(
            city => city.state_id === "MH" && city.city_name === "Mumbai"
        );

        const delhiCity = cities.find(
            city => city.state_id === "DL" && city.city_name === "New Delhi"
        );


        await db.query(`
        INSERT INTO customer_addresses
            (
            customer_id,
            city_id,
            PIN_code,
            address_line1,
            address_line2,
            address_type,
            is_primary
            )
        SELECT ?, ?, '400001', '101 Main Street', 'Mumbai', 'Home', TRUE
        WHERE NOT EXISTS (
            SELECT 1
            FROM customer_addresses
            WHERE customer_id = ?
            AND city_id = ?
        )`, [customer1.customer_id, mumbaiCity.city_id, customer1.customer_id, mumbaiCity.city_id]);

        await db.query(`
        INSERT INTO customer_addresses
            (
            customer_id,
            city_id,
            PIN_code,
            address_line1,
            address_line2,
            address_type,
            is_primary
            )
        SELECT ?, ?, '110001', '202 Bank Road', 'New Delhi', 'Home', TRUE
        WHERE NOT EXISTS (
            SELECT 1
            FROM customer_addresses
            WHERE customer_id = ?
            AND city_id = ?
        )`, [customer2.customer_id, delhiCity.city_id, customer2.customer_id, delhiCity.city_id,]);

        console.log("Customer addresses seeded.");

        // 7. ACCOUNT_TYPES

        await db.query(`
         INSERT INTO account_types
            (account_type, account_subtype)
        SELECT 'Savings', 'Regular'
        WHERE NOT EXISTS (
            SELECT 1
            FROM account_types
            WHERE account_type = 'Savings'
            AND account_subtype = 'Regular'
            )
        `);

        await db.query(`
        INSERT INTO account_types
            (account_type, account_subtype)
        SELECT 'Loan', 'Personal'
        WHERE NOT EXISTS (
            SELECT 1
            FROM account_types
            WHERE account_type = 'Loan'
            AND account_subtype = 'Personal'
            )
        `);

        console.log("Account types seeded.");

        // 8. ACCOUNTS

        const [savingsType] = await db.query(`
        SELECT account_type_id
        FROM account_types
        WHERE account_type = 'Savings'
        AND account_subtype = 'Regular'
        `);

        const [loanType] = await db.query(`
        SELECT account_type_id
        FROM account_types
        WHERE account_type = 'Loan'
        AND account_subtype = 'Personal'
        `);

        await db.query(`
        INSERT IGNORE INTO accounts
            (
            account_number,
            customer_id,
            account_type_id,
            account_status,
            opened_at
            )
        VALUES
            ('ACC10001', ?, ?, 'ACTIVE', '2026-08-01'),
            ('ACC10002', ?, ?, 'ACTIVE', '2026-08-02'),
            ('ACC20001', ?, ?, 'ACTIVE', '2026-08-03')`,
            [
                customer1.customer_id,
                savingsType[0].account_type_id,

                customer2.customer_id,
                savingsType[0].account_type_id,

                customer1.customer_id,
                loanType[0].account_type_id
            ]);

        console.log("Accounts seeded.");

        // 9. SAVING_ACCOUNTS

        const [savingAccounts] = await db.query(`
        SELECT account_id, account_number
        FROM accounts
        WHERE account_number IN ('ACC10001', 'ACC10002')
        `);

        const saving1 = savingAccounts.find(
            account => account.account_number === "ACC10001");

        const saving2 = savingAccounts.find(
            account => account.account_number === "ACC10002");

        await db.query(`
         INSERT INTO saving_accounts
            (account_id, balance, minimum_balance, withdrawal_limit, transfer_limit, branch_code)
        SELECT ?, 50000.00, 1000.00, 25000.00, 100000.00, 'BR001'
        WHERE NOT EXISTS (
            SELECT 1
            FROM saving_accounts
            WHERE account_id = ?
        )`, [saving1.account_id, saving1.account_id]);

        await db.query(`
        INSERT INTO saving_accounts
            (account_id, balance, minimum_balance, withdrawal_limit, transfer_limit, branch_code)
        SELECT ?, 1000.00, 1000.00, 25000.00, 100000.00, 'BR002'
        WHERE NOT EXISTS (
            SELECT 1
            FROM saving_accounts
            WHERE account_id = ?
        )`, [saving2.account_id, saving2.account_id]);

        console.log("Saving accounts seeded.");

        // 10. LOAN_ACCOUNTS

        const [loanAccounts] = await db.query(`
        SELECT account_id
        FROM accounts
        WHERE account_number = 'ACC20001'
        `);

        const loanAccountId = loanAccounts[0].account_id;

        await db.query(`
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
        SELECT ?, 500000.00, 500000.00, 8.50, 60, 10250.00, '2026-09-05'
        WHERE NOT EXISTS (
            SELECT 1
            FROM loan_accounts
            WHERE account_id = ?
        )`, [loanAccountId, loanAccountId]);

        console.log("Loan accounts seeded.");

        // 11. LOAN_EMIS

        const [loanRows] = await db.query(`
        SELECT loan_id
        FROM loan_accounts
        WHERE account_id = ?`, [loanAccountId]);

        const loanId = loanRows[0].loan_id;

        await db.query(`
        INSERT INTO loan_emis
            (
            loan_id,
            emi_number,
            emi_date,
            emi_amount,
            emi_status,
            paid_at,
            remaining_balance
            )
        SELECT ?, 1, '2026-09-05', 10250.00, 'PENDING', NULL, 489750.00
        WHERE NOT EXISTS (
            SELECT 1
            FROM loan_emis
            WHERE loan_id = ?
            AND emi_number = 1
        )`, [loanId, loanId]);

        console.log("Loan EMI seeded.");

        // 12. TRANSACTIONS

        // Transactions are linked to the saving account.
        // We create one deposit and one withdrawal example.

        const [savingRows] = await db.query(`
        SELECT saving_id, account_id
        FROM saving_accounts
        WHERE account_id = ?`, [saving1.account_id]);

        const savingId = savingRows[0].saving_id;

        await db.query(`
        INSERT IGNORE INTO transactions
            (
            account_id,
            saving_id,
            transaction_type,
            amount,
            balance_before,
            balance_after,
            reference_number
            )
        VALUES
            (
            ?,
            ?,
            'DEPOSIT',
            10000.00,
            40000.00,
            50000.00,
            'TXN10001'
            ),
            (
            ?,
            ?,
            'WITHDRAWAL',
            5000.00,
            55000.00,
            50000.00,
            'TXN10002'
            )`,
            [
                saving1.account_id,
                savingId,

                saving1.account_id,
                savingId
            ]);

        console.log("Transactions seeded.");

        // 13. ADMINS
        // Login credentials for testing:
        // username: admin
        // password: Admin@123

        const passwordHash = await bcrypt.hash("Admin@123", 10);

        await db.query(`
        INSERT IGNORE INTO admins
            (
            username,
            email,
            password_hash,
            first_name,
            last_name,
            is_active
            )
        VALUES
            (
            'admin',
            'admin@banking.com',
            ?,
            'Bank',
            'Admin',
            TRUE
            )`, [passwordHash]);

        console.log("Admin seeded.");

        // 14. SESSIONS
        // Sessions will be created when an admin logs in.
        console.log("Database seeding completed successfully.");

    } catch (error) {
        console.error("Database seeding failed:", error);
    } finally {
        // Close the connection pool after seeding.
        await db.end();
    }
}


// Starts seeding.
seedDatabase();