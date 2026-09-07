// This file defines account API routes.

const express = require("express");

const {
    getAccounts,
    getAccount,
    updateStatus,
    updateSavings,
    updateLoan,
    payEmi,
    updateAccount
} = require("../controllers/accountController");

const authenticateToken =
    require("../middleware/authMiddleware");

const router = express.Router();

/* GET ALL ACCOUNTS
// GET /api/accounts
*/

router.get(
    "/",
    authenticateToken,
    getAccounts
);

/* GET ONE ACCOUNT
// GET /api/accounts/:id
*/

router.get(
    "/:id",
    authenticateToken,
    getAccount
);

/* UPDATE ACCOUNT STATUS
// PUT /api/accounts/:id/status
//
// Body:
// {
//     "account_status": "Frozen"
// }
*/

router.put(
    "/:id/status",
    authenticateToken,
    updateStatus
);

/* SAVINGS DEPOSIT / WITHDRAW
// PUT /api/accounts/:id/savings/transaction
//
// Deposit:
// {
//     "amount": 5000,
//     "operation": "deposit"
// }
//
// Withdraw:
// {
//     "amount": 1000,
//     "operation": "withdraw"
// }
*/

router.put(
    "/:id/savings/transaction",
    authenticateToken,
    updateSavings
);

/*UPDATE LOAN DETAILS
// PUT /api/accounts/:id/loan
*/

router.put(
    "/:id/loan",
    authenticateToken,
    updateLoan
);

router.post(
    "/:id/loan/emi",
    authenticateToken,
    payEmi
);

/* UPDATE COMPLETE ACCOUNT DETAILS
// PUT /api/accounts/:id/details
//
// Savings body example:
//
// {
//     "account_status": "Active",
//     "balance": 50000,
//     "transfer_limit": 100000,
//     "branch_code": "BR001"
// }
//
// Loan body example:
//
// {
//     "account_status": "Active",
//     "loan_amount": 500000,
//     "outstanding_balance": 350000,
//     "interest_rate": 8.5,
//     "duration_months": 60,
//     "emi_amount": 10250
// }
*/

router.put(
    "/:id/details",
    authenticateToken,
    updateAccount
);


module.exports = router;
