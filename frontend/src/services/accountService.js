// ============================================================
// ACCOUNT SERVICE
// ============================================================
// Frontend → accountService → backend accountRoutes
// → accountController → accountService → MySQL
// ============================================================


// ============================================================
// GET API BASE URL
// ============================================================

const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api";


// ============================================================
// HELPER: GET AUTH TOKEN
// ============================================================

function getToken() {

    return (
        localStorage.getItem("token") ||
        localStorage.getItem("accessToken") ||
        ""
    );
}


// ============================================================
// HELPER: AUTH HEADERS
// ============================================================

function getHeaders() {

    const token = getToken();

    return {

        "Content-Type": "application/json",

        ...(token && {
            Authorization: `Bearer ${token}`
        })

    };
}


// ============================================================
// HELPER: HANDLE API RESPONSE
// ============================================================

async function handleResponse(
    response,
    defaultMessage
) {

    let result = {};

    try {

        result = await response.json();

    } catch (error) {

        result = {};

    }


    if (!response.ok) {

        throw new Error(
            result.message ||
            defaultMessage
        );

    }


    return result.data;
}


// ============================================================
// GET ALL ACCOUNTS
// GET /api/accounts
// ============================================================

export async function getAccounts(filters = {}) {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            params.set(key, value);
        }
    });

    const query = params.toString();

    const response =
        await fetch(
            `${API_BASE_URL}/accounts${query ? `?${query}` : ""}`,
            {
                method: "GET",
                headers: getHeaders()
            }
        );


    return await handleResponse(
        response,
        "Failed to load accounts."
    );
}


// ============================================================
// GET ONE ACCOUNT
// GET /api/accounts/:id
// ============================================================

export async function getAccountById(accountId) {

    if (!accountId) {

        throw new Error(
            "Account ID is required."
        );

    }


    const response =
        await fetch(
            `${API_BASE_URL}/accounts/${accountId}`,
            {
                method: "GET",
                headers: getHeaders()
            }
        );


    return await handleResponse(
        response,
        "Failed to load account."
    );
}


export async function payLoanEmi(accountId, amount, paymentSource, sourceAccountId, otherAccountNumber) {
    if (!accountId) throw new Error("Account ID is required.");

    const response = await fetch(
        `${API_BASE_URL}/accounts/${accountId}/loan/emi`,
        {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({
                amount: Number(amount),
                payment_source: paymentSource,
                source_account_id: sourceAccountId || null,
                other_account_number: otherAccountNumber || "",
            }),
        }
    );

    return await handleResponse(
        response,
        "Failed to process EMI payment."
    );
}


// ============================================================
// UPDATE ACCOUNT STATUS
// PUT /api/accounts/:id/status
// ============================================================

export async function updateAccountStatus(
    accountId,
    accountStatus
) {

    if (!accountId) {

        throw new Error(
            "Account ID is required."
        );

    }


    const response =
        await fetch(
            `${API_BASE_URL}/accounts/${accountId}/status`,
            {
                method: "PUT",

                headers: getHeaders(),

                body: JSON.stringify({
                    account_status:
                        accountStatus
                })

            }
        );


    return await handleResponse(
        response,
        "Failed to update account status."
    );
}


// ============================================================
// SAVINGS DEPOSIT / WITHDRAW
//
// PUT /api/accounts/:id/savings/transaction
// ============================================================

export async function updateSavingsTransaction(
    accountId,
    amount,
    operation
) {

    if (!accountId) {

        throw new Error(
            "Account ID is required."
        );

    }


    const response =
        await fetch(
            `${API_BASE_URL}/accounts/${accountId}/savings/transaction`,
            {
                method: "PUT",

                headers: getHeaders(),

                body: JSON.stringify({

                    amount: Number(amount),

                    operation

                })

            }
        );


    return await handleResponse(
        response,
        "Failed to update savings account."
    );
}


// ============================================================
// UPDATE COMPLETE ACCOUNT DETAILS
//
// PUT /api/accounts/:id/details
//
// This is the endpoint used by AccountEditModal.
//
// Savings:
//
// - account_status
// - balance
// - transfer_limit
// - branch_code
//
// Loan:
//
// - account_status
// - loan_amount
// - outstanding_balance
// - interest_rate
// - duration_months
// - emi_amount
//
// Backend:
// accountRoutes.js
//      ↓
// updateAccount()
//      ↓
// updateAccountDetails()
//      ↓
// MySQL
// ============================================================

export async function updateAccountDetails(
    accountId,
    accountData
) {

    if (!accountId) {

        throw new Error(
            "Account ID is required."
        );

    }


    const response =
        await fetch(
            `${API_BASE_URL}/accounts/${accountId}/details`,
            {
                method: "PUT",

                headers: getHeaders(),

                body: JSON.stringify(
                    accountData
                )

            }
        );


    return await handleResponse(
        response,
        "Failed to update account details."
    );
}


// ============================================================
// DEFAULT EXPORT
// ============================================================

export default {

    getAccounts,

    getAccountById,

    updateAccountStatus,

    updateSavingsTransaction,

    payLoanEmi,

    updateAccountDetails

};





