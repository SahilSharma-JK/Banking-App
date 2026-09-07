// This file handles HTTP requests,
// calls account services,
// and returns HTTP responses.

const {
    getAllAccounts,
    getAccountById,
    updateAccountStatus,
    updateSavingsBalance,
    updateLoanDetails,
    updateAccountDetails,
    payLoanEmi
} = require("../services/accountService");

// GET ALL ACCOUNTS

async function getAccounts(req, res, next) {

    try {

        const accounts =
            await getAllAccounts(req.query || {});

        res.status(200).json({

            success: true,

            data: accounts

        });

    } catch (error) {

        next(error);
    }
}


// GET ONE ACCOUNT

async function getAccount(req, res, next) {

    try {

        const accountId =
            req.params.id;


        const account =
            await getAccountById(
                accountId
            );


        res.status(200).json({

            success: true,

            data: account

        });

    } catch (error) {

        next(error);
    }
}


// UPDATE ACCOUNT STATUS

async function updateStatus(req, res, next) {

    try {

        const accountId =
            req.params.id;


        const {
            account_status
        } = req.body;


        const account =
            await updateAccountStatus(
                accountId,
                account_status
            );


        res.status(200).json({

            success: true,

            message:
                "Account status updated successfully",

            data: account

        });

    } catch (error) {

        next(error);
    }
}


// SAVINGS DEPOSIT / WITHDRAW

async function updateSavings(req, res, next) {

    try {

        const accountId =
            req.params.id;


        const {
            amount,
            operation
        } = req.body;


        const account =
            await updateSavingsBalance(
                accountId,
                amount,
                operation
            );


        res.status(200).json({

            success: true,

            message:
                operation === "deposit"
                    ? "Amount deposited successfully"
                    : "Amount withdrawn successfully",

            data: account

        });

    } catch (error) {

        next(error);
    }
}

// PAY LOAN EMI

async function payEmi(req, res, next) {
    try {
        const account = await payLoanEmi(
            req.params.id,
            req.body.amount,
            req.body.payment_source,
            req.body.source_account_id,
            req.body.other_account_number
        );

        res.status(200).json({
            success: true,
            message: "EMI payment processed successfully.",
            data: account
        });
    } catch (error) {
        next(error);
    }
}


// UPDATE LOAN

async function updateLoan(req, res, next) {

    try {

        const accountId =
            req.params.id;


        const account =
            await updateLoanDetails(
                accountId,
                req.body
            );


        res.status(200).json({

            success: true,

            message:
                "Loan details updated successfully",

            data: account

        });

    } catch (error) {

        next(error);
    }
}


/* UPDATE COMPLETE ACCOUNT DETAILS
// ============================================================
// This endpoint is used by AccountEditModal.
//
// It can update:
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
*/

async function updateAccount(req, res, next) {

    try {

        const accountId =
            req.params.id;


        const account =
            await updateAccountDetails(
                accountId,
                req.body
            );


        res.status(200).json({

            success: true,

            message:
                "Account details updated successfully",

            data: account

        });

    } catch (error) {

        next(error);
    }
}


// EXPORTS

module.exports = {

    getAccounts,
    getAccount,
    updateStatus,
    updateSavings,
    updateLoan,
    payEmi,
    updateAccount
};
