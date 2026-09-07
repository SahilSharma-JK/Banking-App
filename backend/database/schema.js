const mysql = require("mysql2/promise");
require("dotenv").config();

//creates our database and tables.
async function createDatabase() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    });

    console.log("MySQL connected successfully.");

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`
    );

    console.log(`Database '${process.env.DB_NAME}' created successfully.`);

    // Select our database
    await connection.query(`USE ${process.env.DB_NAME}`);

    // 1. COUNTRIES
    await connection.query(`
      CREATE TABLE IF NOT EXISTS countries (
        country_code VARCHAR(10) PRIMARY KEY,
        country_name VARCHAR(100) NOT NULL
      )
    `);

    console.log("countries table created.");

    // 2. STATES
    await connection.query(`
      CREATE TABLE IF NOT EXISTS states (
        state_code VARCHAR(10) PRIMARY KEY,
        country_code VARCHAR(10) NOT NULL,
        state_name VARCHAR(100) NOT NULL,

        CONSTRAINT fk_states_country
          FOREIGN KEY (country_code)
          REFERENCES countries(country_code)
      )
    `);

    console.log("states table created.");

    // 3. CITIES
    await connection.query(`
      CREATE TABLE IF NOT EXISTS cities (
        city_id INT AUTO_INCREMENT PRIMARY KEY,
        state_id VARCHAR(10) NOT NULL,
        city_name VARCHAR(100) NOT NULL,

        CONSTRAINT fk_cities_state
          FOREIGN KEY (state_id)
          REFERENCES states(state_code)
      )
    `);

    console.log("cities table created.");

    // 4. CUSTOMERS
    // Stores the basic information of each bank customer.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS customers (
        customer_id INT AUTO_INCREMENT PRIMARY KEY,
        customer_number VARCHAR(30) NOT NULL UNIQUE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        phone VARCHAR(20),
        mobile VARCHAR(20),
        dob DATE,
        marital_status VARCHAR(30)
      )
    `);

    console.log("customers table created.");

    // 5. CUSTOMER_ADDRESSES
    // Stores addresses belonging to customers.
    // One customer can have multiple addresses.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS customer_addresses (
        address_id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        city_id INT NOT NULL,
        PIN_code VARCHAR(20) NOT NULL,
        address_line1 VARCHAR(255) NOT NULL,
        address_line2 VARCHAR(255),
        address_type VARCHAR(30),
        is_primary BOOLEAN DEFAULT FALSE,

        CONSTRAINT fk_address_customer
          FOREIGN KEY (customer_id)
          REFERENCES customers(customer_id),

        CONSTRAINT fk_address_city 
          FOREIGN KEY (city_id) 
          REFERENCES cities(city_id)
      )
    `);

    console.log("customer_addresses table created.");

    // 6. ACCOUNT_TYPES
    // Defines the different types/subtypes of accounts
    // that the bank provides.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS account_types (
        account_type_id INT AUTO_INCREMENT PRIMARY KEY,
        account_type VARCHAR(50) NOT NULL,
        account_subtype VARCHAR(50)
        
      )
    `);

    console.log("account_types table created.");

    // 7. ACCOUNTS
    // Main account table.
    // Each account belongs to one customer and one account type.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        account_id INT AUTO_INCREMENT PRIMARY KEY,
        account_number VARCHAR(30) NOT NULL UNIQUE,
        customer_id INT NOT NULL,
        account_type_id INT NOT NULL,
        account_status VARCHAR(30) NOT NULL,
        opened_at DATE,

        CONSTRAINT fk_accounts_customer
          FOREIGN KEY (customer_id)
          REFERENCES customers(customer_id),

        CONSTRAINT fk_accounts_type
          FOREIGN KEY (account_type_id)
          REFERENCES account_types(account_type_id)
      )
    `);

    console.log("accounts table created.");

    // 8. SAVING_ACCOUNTS
    // Stores the details specific to a saving account.
    // Each saving account belongs to one main account.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS saving_accounts (
        saving_id INT AUTO_INCREMENT PRIMARY KEY,
        account_id INT NOT NULL,
        balance DECIMAL(15,2) DEFAULT 0.00,
        minimum_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        withdrawal_limit DECIMAL(15,2),
        transfer_limit DECIMAL(15,2),
        branch_code VARCHAR(20),

        CONSTRAINT fk_saving_account
          FOREIGN KEY (account_id)
          REFERENCES accounts(account_id)
      )
    `);

    console.log("saving_accounts table created.");

    // 9. LOAN_ACCOUNTS
    // Stores details specific to a loan account.
    // Each loan account is connected to one main account.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS loan_accounts (
        loan_id INT AUTO_INCREMENT PRIMARY KEY,
        account_id INT NOT NULL,
        loan_amount DECIMAL(15,2) NOT NULL,
        outstanding_balance DECIMAL(15,2) NOT NULL,
        interest_rate DECIMAL(5,2) NOT NULL,
        duration_months INT NOT NULL,
        emi_amount DECIMAL(15,2),
        repayment_start_date DATE NULL,

        CONSTRAINT fk_loan_account
          FOREIGN KEY (account_id)
          REFERENCES accounts(account_id)
      )
    `);

    console.log("loan_accounts table created.");

    // 10. LOAN_EMIS
    await connection.query(`
      CREATE TABLE IF NOT EXISTS loan_emis (
        emi_id INT AUTO_INCREMENT PRIMARY KEY,
        loan_id INT NOT NULL,
        emi_number INT NOT NULL,
        emi_date DATE NOT NULL,
        emi_amount DECIMAL(15,2) NOT NULL,
        emi_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        paid_at DATE NULL,
        paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        remaining_balance DECIMAL(15,2) NULL,
        UNIQUE KEY uq_loan_emi_number (loan_id, emi_number),

        CONSTRAINT fk_loan_emi_loan
          FOREIGN KEY (loan_id)
          REFERENCES loan_accounts(loan_id)
          ON DELETE CASCADE
      )
    `);

    console.log("loan_emis table created.");

    // 11. TRANSACTIONS
    // Stores all financial transactions transactions related to
    // Examples: DEPOSIT, WITHDRAWAL, EMI, etc.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        transaction_id INT AUTO_INCREMENT PRIMARY KEY,
        account_id INT NOT NULL,
        saving_id INT NULL,
        transaction_type VARCHAR(30) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        balance_before DECIMAL(15,2) NOT NULL,
        balance_after DECIMAL(15,2) NOT NULL,
        reference_number VARCHAR(50) NOT NULL UNIQUE,
        transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        emi_number INT NULL,
        emi_date DATE NULL,
        emi_status VARCHAR(30) NULL,
        paid_at DATE NULL,
        remaining_balance DECIMAL(15,2) NULL,
        payment_source VARCHAR(30) NULL,
        source_account_id INT NULL,
        source_account_number VARCHAR(50) NULL,

        CONSTRAINT fk_transaction_account
          FOREIGN KEY (account_id)
          REFERENCES accounts(account_id)
      )
    `);

    console.log("transactions table created.");

    // 11. ADMINS
    // Stores the admin/login user information.
    // The password is stored as a hash, not plain text.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admins (
        admin_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    console.log("admins table created.");

    // 12. SESSIONS
    // Stores active login sessions associated with an admin.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME,

        CONSTRAINT fk_sessions_admin
          FOREIGN KEY (admin_id)
          REFERENCES admins(admin_id)
      )
    `);

    console.log("sessions table created.");

  } catch (error) {
    console.error("Database setup failed:", error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createDatabase();