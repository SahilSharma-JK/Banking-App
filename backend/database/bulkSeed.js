
const mysql = require("mysql2/promise");
const { faker } = require("@faker-js/faker");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const BATCH_SIZE = Number(process.env.FAKE_BATCH_SIZE || 1000);
const TARGET_CUSTOMERS = Number(
    process.env.FAKE_CUSTOMER_COUNT || 100000
);

const PINCODE_CSV = path.join(
    __dirname,
    "data",
    "pincode.csv"
);


/*
 * ---------------------------------------------------------
 * Utility helpers
 * ---------------------------------------------------------
 */

function randomChoice(items) {
    return items[Math.floor(Math.random() * items.length)];
}


function randomDateBetween(start, end) {
    const startTime = start.getTime();
    const endTime = end.getTime();

    return new Date(
        startTime + Math.random() * (endTime - startTime)
    );
}


function formatDate(date) {
    return date.toISOString().slice(0, 10);
}


function normalize(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .toUpperCase();
}


/*
 * Simple CSV parser.
 *
 * This handles quoted CSV values and commas inside quotes.
 */
function parseCsvLine(line) {

    const result = [];
    let current = "";
    let insideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {

        const char = line[index];
        const nextChar = line[index + 1];

        if (char === '"' && insideQuotes && nextChar === '"') {
            current += '"';
            index += 1;
            continue;
        }

        if (char === '"') {
            insideQuotes = !insideQuotes;
            continue;
        }

        if (char === "," && !insideQuotes) {
            result.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    result.push(current.trim());

    return result;
}


/*
 * ---------------------------------------------------------
 * Load PIN / city information from local CSV
 * ---------------------------------------------------------
 *
 * IMPORTANT:
 *
 * No indiapins package is used here.
 *
 * The project already imports India PIN data from:
 *
 * backend/database/data/pincode.csv
 *
 * We only use that local data for fake customer addresses.
 */
function loadPincodeCsv() {

    if (!fs.existsSync(PINCODE_CSV)) {
        throw new Error(
            `PIN code CSV not found at: ${PINCODE_CSV}`
        );
    }

    const csv = fs
        .readFileSync(PINCODE_CSV, "utf8")
        .replace(/^\uFEFF/, "");

    const lines = csv
        .split(/\r?\n/)
        .filter((line) => line.trim());

    if (lines.length < 2) {
        throw new Error(
            "pincode.csv does not contain enough data."
        );
    }

    const headers = parseCsvLine(lines[0]).map((header) =>
        normalize(header).toLowerCase()
    );

    const pincodeIndex = headers.indexOf("pincode");
    const districtIndex = headers.indexOf("districtname");
    const stateIndex = headers.indexOf("statename");

    if (
        pincodeIndex === -1 ||
        districtIndex === -1 ||
        stateIndex === -1
    ) {
        throw new Error(
            "pincode.csv must contain Pincode, Districtname and Statename columns."
        );
    }

    const locations = [];
    const unique = new Set();

    for (let index = 1; index < lines.length; index += 1) {

        const row = parseCsvLine(lines[index]);

        const pincode = String(
            row[pincodeIndex] || ""
        )
            .replace(/\D/g, "")
            .slice(0, 6);

        const district = String(
            row[districtIndex] || ""
        ).trim();

        const state = String(
            row[stateIndex] || ""
        ).trim();

        if (
            !/^\d{6}$/.test(pincode) ||
            !district ||
            !state
        ) {
            continue;
        }

        const key =
            `${normalize(state)}|${normalize(district)}|${pincode}`;

        if (unique.has(key)) {
            continue;
        }

        unique.add(key);

        locations.push({
            stateName: state,
            districtName: district,
            pincode,
        });
    }

    if (!locations.length) {
        throw new Error(
            "No valid PIN locations found in pincode.csv."
        );
    }

    return locations;
}


/*
 * ---------------------------------------------------------
 * Match CSV locations with existing MySQL cities
 * ---------------------------------------------------------
 */
async function loadLocations(connection) {

    const csvLocations = loadPincodeCsv();

    const [cityRows] = await connection.query(`
        SELECT
            c.city_id,
            c.city_name,
            s.state_name
        FROM cities c
        INNER JOIN states s
            ON s.state_code = c.state_id
    `);

    const cityMap = new Map();

    for (const row of cityRows) {

        const key =
            `${normalize(row.state_name)}|${normalize(row.city_name)}`;

        cityMap.set(key, row.city_id);
    }

    const locations = [];

    for (const location of csvLocations) {

        const key =
            `${normalize(location.stateName)}|${normalize(location.districtName)}`;

        const cityId = cityMap.get(key);

        if (!cityId) {
            continue;
        }

        locations.push({
            city_id: cityId,
            pincode: location.pincode,
            stateName: location.stateName,
            districtName: location.districtName,
        });
    }

    if (!locations.length) {
        throw new Error(
            "No PIN locations could be matched with the existing cities table. Run the normal database seed first."
        );
    }

    console.log(
        `Loaded ${locations.length.toLocaleString("en-IN")} valid PIN/city locations from local CSV.`
    );

    return locations;
}


/*
 * ---------------------------------------------------------
 * Main bulk customer seed
 * ---------------------------------------------------------
 */
async function seedBulkCustomers() {

    const db = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,

        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
    });

    try {

        /*
         * Current customer count.
         */
        const [[countRow]] = await db.query(`
            SELECT COUNT(*) AS total
            FROM customers
        `);

        const existingCount =
            Number(countRow.total || 0);


        /*
         * Find the highest existing CUS number.
         *
         * Example:
         *
         * CUS00000001
         * CUS00000002
         *
         * Next generated customer:
         *
         * CUS00000003
         */
        const [[maxNumberRow]] = await db.query(`
            SELECT MAX(
                CAST(
                    SUBSTRING(customer_number, 4)
                    AS UNSIGNED
                )
            ) AS max_number
            FROM customers
            WHERE customer_number LIKE 'CUS%'
        `);

        const maxCustomerNumber =
            Number(maxNumberRow.max_number || 0);


        /*
         * Do not generate again if target already exists.
         */
        if (existingCount >= TARGET_CUSTOMERS) {

            console.log(
                `Bulk seed skipped. Database already contains ${existingCount.toLocaleString("en-IN")} customers.`
            );

            return;
        }


        /*
         * Load local PIN/city data.
         */
        const locations = await loadLocations(db);


        /*
         * Determine how many new customers are required.
         */
        const required =
            TARGET_CUSTOMERS - existingCount;


        const startNumber =
            Math.max(existingCount, maxCustomerNumber) + 1;


        console.log("");
        console.log("==============================================");
        console.log(" ZENbank Bulk Customer Seed");
        console.log("==============================================");
        console.log(
            `Existing customers : ${existingCount.toLocaleString("en-IN")}`
        );
        console.log(
            `Target customers   : ${TARGET_CUSTOMERS.toLocaleString("en-IN")}`
        );
        console.log(
            `New customers      : ${required.toLocaleString("en-IN")}`
        );
        console.log(
            `Batch size         : ${BATCH_SIZE.toLocaleString("en-IN")}`
        );
        console.log("==============================================");
        console.log("");


        let generated = 0;
        let nextNumber = startNumber;


        /*
         * -----------------------------------------------------
         * Generate customers in batches.
         * -----------------------------------------------------
         */
        while (generated < required) {

            const batchCount =
                Math.min(
                    BATCH_SIZE,
                    required - generated
                );


            const customerRows = [];
            const addressRows = [];


            /*
             * Generate one batch.
             */
            for (
                let index = 0;
                index < batchCount;
                index += 1
            ) {

                const sequence = nextNumber++;

                const firstName =
                    faker.person.firstName();

                const lastName =
                    faker.person.lastName();


                const location =
                    randomChoice(locations);


                /*
                 * Unique customer number.
                 */
                const customerNumber =
                    `CUS${String(sequence).padStart(8, "0")}`;


                /*
                 * Deterministic unique email.
                 *
                 * This avoids accidental Faker email collisions.
                 */
                const email =
                    `customer${sequence}@demo.zenbank.local`;


                /*
                 * DOB between 1960 and 2005.
                 */
                const dob =
                    randomDateBetween(
                        new Date("1960-01-01T00:00:00Z"),
                        new Date("2005-12-31T00:00:00Z")
                    );


                /*
                 * Indian-looking mobile number.
                 */
                const mobile =
                    `9${faker.string.numeric(9)}`;


                /*
                 * Phone number.
                 */
                const phone =
                    `0${faker.string.numeric(10)}`;


                const maritalStatus =
                    randomChoice([
                        "Single",
                        "Married",
                        "Divorced",
                        "Widowed",
                    ]);


                /*
                 * IMPORTANT:
                 *
                 * Only columns that actually exist
                 * in the current customers table are used.
                 *
                 * customer_status is NOT inserted.
                 */
                customerRows.push([
                    customerNumber,
                    firstName,
                    lastName,
                    email,
                    phone,
                    mobile,
                    formatDate(dob),
                    maritalStatus,
                ]);


                /*
                 * Address connected to the same generated
                 * customer.
                 */
                addressRows.push({
                    city_id: location.city_id,
                    pincode: location.pincode,

                    address_line1:
                        `${faker.number.int({
                            min: 1,
                            max: 9999,
                        })}, ${faker.location.street()}`,

                    address_line2:
                        faker.location.streetAddress(),

                    address_type: "Permanent",
                });
            }


            /*
             * One DB connection per batch.
             */
            const connection =
                await db.getConnection();


            try {

                await connection.beginTransaction();


                /*
                 * ---------------------------------------------
                 * Insert customers
                 * ---------------------------------------------
                 */
                const customerPlaceholders =
                    customerRows
                        .map(() =>
                            "(?, ?, ?, ?, ?, ?, ?, ?)"
                        )
                        .join(", ");


                const customerValues =
                    customerRows.flat();


                const [result] =
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
                        VALUES ${customerPlaceholders}
                        `,
                        customerValues
                    );


                /*
                 * MySQL returns the first AUTO_INCREMENT ID
                 * for the multi-row insert.
                 *
                 * Because this insert happens in one transaction
                 * and one connection, the generated IDs form
                 * the inserted range.
                 */
                const firstCustomerId =
                    result.insertId;


                /*
                 * ---------------------------------------------
                 * Insert addresses
                 * ---------------------------------------------
                 */
                const addressValues = [];


                addressRows.forEach(
                    (address, index) => {

                        addressValues.push(
                            firstCustomerId + index,
                            address.city_id,
                            address.pincode,
                            address.address_line1,
                            address.address_line2,
                            address.address_type,
                            1
                        );
                    }
                );


                const addressPlaceholders =
                    addressRows
                        .map(() =>
                            "(?, ?, ?, ?, ?, ?, ?)"
                        )
                        .join(", ");


                await connection.query(
                    `
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
                    VALUES ${addressPlaceholders}
                    `,
                    addressValues
                );


                await connection.commit();

            } catch (error) {

                await connection.rollback();

                throw error;

            } finally {

                connection.release();
            }


            /*
             * Update progress.
             */
            generated += batchCount;

            const totalNow =
                existingCount + generated;


            const percentage =
                (
                    totalNow /
                    TARGET_CUSTOMERS
                ) *
                100;


            console.log(
                `Progress: ${totalNow.toLocaleString("en-IN")} / ${TARGET_CUSTOMERS.toLocaleString("en-IN")} (${percentage.toFixed(1)}%)`
            );
        }


        console.log("");
        console.log("==============================================");
        console.log(" Bulk customer seed completed successfully");
        console.log("==============================================");
        console.log(
            `Total customers: ${TARGET_CUSTOMERS.toLocaleString("en-IN")}`
        );
        console.log(
            `Generated: ${generated.toLocaleString("en-IN")}`
        );
        console.log("Addresses generated: 1 per customer");
        console.log("PIN data source: local pincode.csv");
        console.log("==============================================");


    } finally {

        await db.end();
    }
}


/*
 * ---------------------------------------------------------
 * Run only when this file is executed directly.
 * ---------------------------------------------------------
 */
if (require.main === module) {

    seedBulkCustomers()
        .catch((error) => {

            console.error("");
            console.error(
                "Bulk customer seed failed:"
            );

            console.error(error);

            process.exitCode = 1;
        });
}


module.exports = {
    seedBulkCustomers,
};
