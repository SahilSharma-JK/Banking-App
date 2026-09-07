/*The customer controller acts as a bridge between the route and service layer.
 It extracts request data, calls the service and sends the HTTP response */

const {
    getAllCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    addCustomerAccount,
    addCustomerAddress,
    updateCustomerAddress,
    setCustomerStatus,
    searchCustomers,
    getCustomerCount,
    deleteCustomerAddress,
    getAllCities,
    getAllStates,
    getCitiesByState
} = require("../services/customerService");

const { lookupPincode } = require("../services/pincodeService");


// GET ALL CUSTOMERS

async function getCustomers(
    req,
    res,
    next
) {

    try {

        const customers =
            await getAllCustomers();

        res.status(200).json({
            success: true,
            data: customers
        });

    } catch (error) {

        next(error);
    }
}


// GET ONE CUSTOMER

async function getCustomer(
    req,
    res,
    next
) {

    try {

        const customer =
            await getCustomerById(
                req.params.id
            );

        res.status(200).json({
            success: true,
            data: customer
        });

    } catch (error) {

        next(error);
    }
}


// GET ALL CITIES

async function getCities(
    req,
    res,
    next
) {

    try {

        const cities =
            await getAllCities();

        res.status(200).json({
            success: true,
            data: cities
        });

    } catch (error) {

        next(error);
    }
}


// GET ALL STATES
async function getStates(
    req,
    res,
    next
) {

    try {

        const states =
            await getAllStates();

        res.status(200).json({
            success: true,
            data: states
        });

    } catch (error) {

        next(error);
    }
}


// GET CITIES BY STATE

async function getCitiesByStateController(
    req,
    res,
    next
) {

    try {

        const cities =
            await getCitiesByState(
                req.params.stateCode
            );

        res.status(200).json({
            success: true,
            data: cities
        });

    } catch (error) {

        next(error);
    }
}

// LOOK UP PIN CODE FROM LOCAL GOVERNMENT-DATA CSV
async function lookupPincodeController(req, res, next) {
    try {
        const result = await lookupPincode(req.params.pincode);

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "PIN code was not found in the local India PIN dataset.",
            });
        }

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}


// GET ACCOUNT TYPES // 
async function getAccountTypesController(req, res, next) {
    try {
        const accountTypes = ["Savings", "Current", "Loan",];
        res.status(200).json({ success: true, data: accountTypes, });
    } catch (error) {
        next(error);

    }
}


// CREATE CUSTOMER

async function createNewCustomer(
    req,
    res,
    next
) {

    try {

        const customer =
            await createCustomer(
                req.body
            );

        res.status(201).json({

            success: true,

            message:
                "Customer created successfully",

            data: customer
        });

    } catch (error) {

        next(error);
    }
}



// UPDATE CUSTOMER

async function updateExistingCustomer(
    req,
    res,
    next
) {

    try {

        const customer =
            await updateCustomer(
                req.params.id,
                req.body
            );

        res.status(200).json({

            success: true,

            message:
                "Customer updated successfully",

            data: customer
        });

    } catch (error) {

        next(error);
    }
}


// ADD ACCOUNT TO CUSTOMER

async function addAccountToCustomer(req, res, next) {
    try {
        const customer = await addCustomerAccount(
            req.params.id,
            req.body
        );

        res.status(201).json({
            success: true,
            message: "Account added successfully.",
            data: customer,
        });
    } catch (error) {
        next(error);
    }
}


// ADD CUSTOMER ADDRESS

async function addNewCustomerAddress(
    req,
    res,
    next
) {

    try {

        const customer =
            await addCustomerAddress(
                req.params.id,
                req.body
            );

        res.status(201).json({

            success: true,

            message:
                "Customer address added successfully",

            data: customer
        });

    } catch (error) {

        next(error);
    }
}


// UPDATE CUSTOMER ADDRESS

async function updateExistingCustomerAddress(
    req,
    res,
    next
) {

    try {

        const customer =
            await updateCustomerAddress(
                req.params.id,
                req.params.addressId,
                req.body
            );

        res.status(200).json({

            success: true,

            message:
                "Customer address updated successfully",

            data: customer
        });

    } catch (error) {

        next(error);
    }
}


async function getCustomerCountController(req, res, next) {
    try { res.status(200).json({ success: true, data: await getCustomerCount() }); } catch (error) { next(error); }
}

// DELETE CUSTOMER ADDRESS
async function removeCustomerAddress(req, res, next) {
    try {
        const customer = await deleteCustomerAddress(req.params.id, req.params.addressId);
        res.status(200).json({ success: true, message: "Customer address deleted successfully", data: customer });
    } catch (error) { next(error); }
}


// CLOSE / REACTIVATE CUSTOMER

async function changeCustomerStatus(
    req,
    res,
    next
) {
    try {
        const customer = await setCustomerStatus(
            req.params.id,
            req.body?.status
        );

        res.status(200).json({
            success: true,
            message:
                String(req.body?.status).toLowerCase() === "closed"
                    ? "Customer closed successfully."
                    : "Customer reactivated successfully.",
            data: customer,
        });
    } catch (error) {
        next(error);
    }
}


// SEARCH CUSTOMERS

async function searchCustomer(
    req,
    res,
    next
) {

    try {

        const customers =
            await searchCustomers(
                req.query
            );

        res.status(200).json({

            success: true,

            data: customers
        });

    } catch (error) {

        next(error);
    }
}

// EXPORTS

module.exports = {

    getCustomers,

    getCustomer,

    getCities,

    getStates,

    getCitiesByStateController,
    lookupPincodeController,
    getAccountTypesController,
    getCustomerCount: getCustomerCountController,
    removeCustomerAddress,

    createNewCustomer,

    updateExistingCustomer,

    addAccountToCustomer,

    addNewCustomerAddress,

    updateExistingCustomerAddress,
    changeCustomerStatus,
    searchCustomer
};