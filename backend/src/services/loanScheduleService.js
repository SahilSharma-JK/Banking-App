const db = require("../../config/db");

function toDateOnly(value) {
    if (!value) return null;

    // mysql2 can return DATE columns as either a string or a JavaScript Date.
    // String(Date) looks like "Sun Aug 23 2026 ..." and therefore cannot be
    // parsed by the old YYYY-MM-DD-only logic. Normalize both forms here.
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;

        const year = value.getUTCFullYear();
        const month = String(value.getUTCMonth() + 1).padStart(2, "0");
        const day = String(value.getUTCDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    const raw = String(value).trim();

    // ISO datetime / normal YYYY-MM-DD returned by mysql2.
    const isoDate = raw.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        return isoDate;
    }

    // Be defensive if a Date-like value was serialized as text.
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        const year = parsed.getUTCFullYear();
        const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
        const day = String(parsed.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    return null;
}

function addMonths(dateString, monthsToAdd) {
    const [year, month, day] = dateString.split("-").map(Number);
    const target = new Date(Date.UTC(year, month - 1 + monthsToAdd, 1));
    const lastDay = new Date(
        Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
    ).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    return target.toISOString().slice(0, 10);
}

function money(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
}

/**
 * Builds a complete repayment schedule from the loan's existing fields.
 *
 * Important: older loans may have only loan_accounts data and no rows (or
 * only one seed row) in loan_emis. We therefore do NOT depend on loan_emis
 * being pre-populated. The schedule is calculated from repayment_start_date,
 * duration_months and emi_amount, while transactions are used as the source
 * of truth for payments already made.
 */
async function ensureLoanSchedule(connection, loan) {
    if (!loan?.loan_id || !loan?.account_id) return [];

    const startDate = toDateOnly(loan.repayment_start_date);
    const duration = Number(loan.duration_months || 0);
    const emi = money(loan.emi_amount);
    const principal = money(loan.loan_amount);

    if (!startDate || !Number.isInteger(duration) || duration <= 0 || emi <= 0) {
        return [];
    }

    // Payment history is authoritative. This also makes schedules work for
    // loans created before loan_emis was introduced.
    let payments = [];

    try {
        const [paymentRows] = await connection.query(`
            SELECT
                emi_number,
                COALESCE(SUM(amount), 0) AS paid_amount,
                MAX(COALESCE(paid_at, DATE(transaction_date))) AS paid_at
            FROM transactions
            WHERE account_id = ?
              AND UPPER(transaction_type) IN ('EMI', 'EMI_PAYMENT')
              AND emi_number IS NOT NULL
            GROUP BY emi_number
        `, [loan.account_id]);

        payments = paymentRows;
    } catch (error) {
        // The migration adds the EMI columns to older installations. If an
        // old database has not been migrated yet, still show the full
        // calculated schedule rather than returning an empty schedule.
        payments = [];
    }

    const paymentByNumber = new Map(
        payments.map((row) => [Number(row.emi_number), row])
    );

    // Read any existing rows only to preserve manually recorded paid amounts
    // when there is no matching transaction history.
    let existing = [];
    try {
        const [rows] = await connection.query(`
            SELECT
                emi_id,
                emi_number,
                paid_amount,
                emi_status,
                paid_at
            FROM loan_emis
            WHERE loan_id = ?
            ORDER BY emi_number ASC
        `, [loan.loan_id]);
        existing = rows;
    } catch (error) {
        // The migration normally guarantees this table. If an older database
        // has not run it yet, the calculated schedule can still be returned.
        existing = [];
    }

    const existingByNumber = new Map(
        existing.map((row) => [Number(row.emi_number), row])
    );

    const schedule = [];

    for (let number = 1; number <= duration; number += 1) {
        const emiDate = addMonths(startDate, number - 1);
        // Keep the contractual EMI amount for every scheduled installment.
        // The EMI already includes interest, so the final installment must
        // NOT be calculated from principal - (EMI * previous installments).
        // That old calculation could incorrectly make the final installment
        // zero/negative for a normal amortizing loan.
        const scheduledAmount = emi;

        const payment = paymentByNumber.get(number);
        const old = existingByNumber.get(number);

        const paidAmount = payment
            ? money(payment.paid_amount)
            : money(old?.paid_amount);

        const status = paidAmount >= scheduledAmount
            ? "PAID"
            : paidAmount > 0
                ? "PARTIALLY_PAID"
                : "PENDING";

        const paidAt = payment?.paid_at || old?.paid_at || null;
        const remaining = Math.max(0, scheduledAmount - paidAmount);

        let emiId = old?.emi_id || null;

        // Keep loan_emis synchronized when the table is available.
        try {
            if (emiId) {
                await connection.query(`
                    UPDATE loan_emis
                    SET
                        emi_date = ?,
                        emi_amount = ?,
                        emi_status = ?,
                        paid_amount = ?,
                        paid_at = ?,
                        remaining_balance = ?
                    WHERE emi_id = ?
                `, [
                    emiDate,
                    scheduledAmount,
                    status,
                    paidAmount,
                    paidAt,
                    remaining,
                    emiId,
                ]);
            } else {
                const [result] = await connection.query(`
                    INSERT INTO loan_emis
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
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    loan.loan_id,
                    number,
                    emiDate,
                    scheduledAmount,
                    status,
                    paidAmount,
                    paidAt,
                    remaining,
                ]);
                emiId = result.insertId;
            }
        } catch (error) {
            // Do not block the customer profile just because an older database
            // has not yet applied the optional schedule table migration.
            emiId = emiId || null;
        }

        schedule.push({
            emi_id: emiId,
            loan_id: loan.loan_id,
            emi_number: number,
            emi_date: emiDate,
            emi_amount: scheduledAmount,
            emi_status: status,
            paid_at: paidAt,
            paid_amount: paidAmount,
            remaining_balance: remaining,
        });
    }

    return schedule;
}

async function getLoanSchedule(accountId) {
    const connection = await db.getConnection();
    try {
        const [rows] = await connection.query(`
            SELECT
                la.loan_id,
                la.account_id,
                la.loan_amount,
                la.outstanding_balance,
                la.interest_rate,
                la.duration_months,
                la.emi_amount,
                la.repayment_start_date
            FROM loan_accounts la
            WHERE la.account_id = ?
            LIMIT 1
        `, [accountId]);

        if (!rows.length) return [];
        return await ensureLoanSchedule(connection, rows[0]);
    } finally {
        connection.release();
    }
}

module.exports = {
    ensureLoanSchedule,
    getLoanSchedule,
};


