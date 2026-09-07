const express = require("express");

const {
    getCustomers,
    getCustomer,
    createNewCustomer,
    updateExistingCustomer,
    addAccountToCustomer,
    addNewCustomerAddress,
    updateExistingCustomerAddress,
    removeCustomerAddress,
    changeCustomerStatus,
    searchCustomer,
    getCities,
    getStates,
    getCitiesByStateController,
    lookupPincodeController,
    getAccountTypesController,
    getCustomerCount: getCustomerCountController,
} = require("../controllers/customerController");

const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, getCustomers);

router.get("/search", authenticateToken, searchCustomer);

router.get("/cities", authenticateToken, getCities);

router.get("/pincode/:pincode", authenticateToken, lookupPincodeController);

router.get("/states", authenticateToken, getStates);

router.get(
    "/states/:stateCode/cities",
    authenticateToken,
    getCitiesByStateController
);

router.get(
    "/account-types",
    authenticateToken,
    getAccountTypesController
);

router.get(
    "/count",
    authenticateToken,
    getCustomerCountController
);

router.post("/", authenticateToken, createNewCustomer);

router.get("/:id", authenticateToken, getCustomer);

router.put("/:id", authenticateToken, updateExistingCustomer);

router.post(
    "/:id/accounts",
    authenticateToken,
    addAccountToCustomer
);

router.post(
    "/:id/addresses",
    authenticateToken,
    addNewCustomerAddress
);

router.put(
    "/:id/addresses/:addressId",
    authenticateToken,
    updateExistingCustomerAddress
);

router.delete(
    "/:id/addresses/:addressId",
    authenticateToken,
    removeCustomerAddress
);

router.patch(
    "/:id/status",
    authenticateToken,
    changeCustomerStatus
);

module.exports = router;