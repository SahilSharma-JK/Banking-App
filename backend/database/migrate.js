/*migrate.js keeps older database versions compatible by checking for missing tables or columns and adding them when required*/

const db = require("../config/db");

async function columnExists(connection, tableName, columnName) {
    const [rows] = await connection.query(
        `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
        LIMIT 1
        `,
        [tableName, columnName]
    );
    return rows.length > 0;
}

async function addColumnIfMissing(connection, tableName, columnName, definition) {
    if (!(await columnExists(connection, tableName, columnName))) {
        await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
        console.log(`Database migration: added ${tableName}.${columnName}`);
    }
}


async function indexExists(connection, tableName, indexName) {
    const [rows] = await connection.query(
        `SELECT 1 FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
         LIMIT 1`,
        [tableName, indexName]
    );
    return rows.length > 0;
}

async function addUniqueIndexIfMissing(
    connection,
    tableName,
    indexName,
    columns
) {
    try {
        // Check if the index already exists
        const [indexes] = await connection.query(
            `
            SELECT 1
            FROM information_schema.statistics
            WHERE table_schema = DATABASE()
              AND table_name = ?
              AND index_name = ?
            LIMIT 1
            `,
            [tableName, indexName]
        );

        // Index already exists
        if (indexes.length > 0) {
            console.log(
                `Database migration: index ${indexName} already exists`
            );
            return;
        }

        // Try to create the unique index
        await connection.query(
            `CREATE UNIQUE INDEX \`${indexName}\`
             ON \`${tableName}\` (${columns})`
        );

        console.log(
            `Database migration: added unique index ${indexName}`
        );

    } catch (error) {

        // IMPORTANT:
        // If existing data contains duplicate loan_id + emi_number,
        // do NOT delete or modify ANY existing data.
        //
        // Simply skip creation of this unique index.
        if (error.code === "ER_DUP_ENTRY") {
            console.warn(
                `Database migration warning: Could not create unique index ${indexName} ` +
                `because existing data contains duplicates. Existing data was NOT changed.`
            );

            return;
        }

        // Other errors should still be reported
        throw error;
    }
}

async function addIndexIfMissing(connection, tableName, indexName, columns) {
    if (!(await indexExists(connection, tableName, indexName))) {
        await connection.query(
            `CREATE INDEX \`${indexName}\` ON \`${tableName}\` (${columns})`
        );
        console.log(`Database migration: added index ${indexName}`);
    }
}



async function ensureBankingSchema() {
    const connection = await db.getConnection();

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS loan_emis (
                emi_id INT AUTO_INCREMENT PRIMARY KEY,
                loan_id INT NOT NULL,
                emi_number INT NOT NULL,
                emi_date DATE NOT NULL,
                emi_amount DECIMAL(15,2) NOT NULL,
                emi_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
                paid_at DATE NULL,
                remaining_balance DECIMAL(15,2) NULL,
                CONSTRAINT fk_loan_emi_loan
                    FOREIGN KEY (loan_id) REFERENCES loan_accounts(loan_id)
                    ON DELETE CASCADE
            )
        `);

        await addColumnIfMissing(
            connection,
            "saving_accounts",
            "minimum_balance",
            "DECIMAL(15,2) NOT NULL DEFAULT 0.00"
        );

        await addColumnIfMissing(
            connection,
            "saving_accounts",
            "withdrawal_limit",
            "DECIMAL(15,2) NULL"
        );

        await addColumnIfMissing(
            connection,
            "loan_accounts",
            "repayment_start_date",
            "DATE NULL"
        );

        // Older project versions/seed files used this optional column.
        await addColumnIfMissing(
            connection,
            "transactions",
            "saving_id",
            "INT NULL"
        );

        await addColumnIfMissing(connection, "transactions", "payment_source", "VARCHAR(30) NULL");
        await addColumnIfMissing(connection, "transactions", "source_account_id", "INT NULL");
        await addColumnIfMissing(connection, "transactions", "source_account_number", "VARCHAR(50) NULL");

        // Search/report indexes for the larger customer dataset.
        await addIndexIfMissing(connection, "customers", "idx_customers_customer_number", "customer_number");
        await addIndexIfMissing(connection, "customers", "idx_customers_first_name", "first_name");
        await addIndexIfMissing(connection, "customers", "idx_customers_last_name", "last_name");
        await addIndexIfMissing(connection, "customers", "idx_customers_email", "email");
        await addIndexIfMissing(connection, "customers", "idx_customers_mobile", "mobile");
        await addIndexIfMissing(connection, "customers", "idx_customers_phone", "phone");
        await addIndexIfMissing(connection, "accounts", "idx_accounts_customer_id", "customer_id");
        await addIndexIfMissing(connection, "accounts", "idx_accounts_account_number", "account_number");
        await addIndexIfMissing(connection, "transactions", "idx_transactions_account_date", "account_id, transaction_date");
        await addIndexIfMissing(connection, "transactions", "idx_transactions_type_date", "transaction_type, transaction_date");
        await addIndexIfMissing(connection, "loan_emis", "idx_loan_emis_loan_status_date", "loan_id, emi_status, emi_date");
        await addUniqueIndexIfMissing(connection, "loan_emis", "uq_loan_emi_number", "loan_id, emi_number");

        /* new one*/

        await addIndexIfMissing(
            connection,
            "transactions",
            "idx_transactions_date_type",
            "transaction_date, transaction_type"
        );

        await addIndexIfMissing(
            connection,
            "accounts",
            "idx_accounts_status",
            "account_status"
        );

        await addIndexIfMissing(
            connection,
            "loan_emis",
            "idx_loan_emis_status",
            "emi_status"
        );

        await addColumnIfMissing(
            connection,
            "loan_emis",
            "paid_amount",
            "DECIMAL(15,2) NOT NULL DEFAULT 0.00"
        );

        // Customer lifecycle status is intentionally separate from account status.
        // We retain the customer and all banking history instead of hard-deleting
        // the customer record.
        await addColumnIfMissing(
            connection,
            "customers",
            "customer_status",
            "VARCHAR(20) NOT NULL DEFAULT 'Active'"
        );

        console.log("Database compatibility check completed.");
    } finally {
        connection.release();
    }
}

module.exports = { ensureBankingSchema };



