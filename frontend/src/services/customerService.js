const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function authHeaders(json = false) {
    const token = localStorage.getItem("token") || "";
    return {
        ...(json ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

async function parse(response, fallback) {
    let result = {};
    try { result = await response.json(); } catch { }
    if (!response.ok) throw new Error(result.message || fallback);
    return result.data;
}

function params(filters = {}) {
    const search = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            search.set(key, value);
        }
    });
    return search.toString();
}

export async function getCustomerCount() {
    const response = await fetch(`${API_URL}/customers/count`, {
        headers: authHeaders(),
    });
    return parse(response, "Failed to load customer count.");
}

export async function getCustomerById(customerId) {
    if (!customerId) throw new Error("Customer ID is required.");
    const response = await fetch(`${API_URL}/customers/${customerId}`, {
        headers: authHeaders(),
    });
    return parse(response, "Failed to fetch customer.");
}

export async function searchCustomers(filters = {}) {
    const query = params(filters);
    const response = await fetch(`${API_URL}/customers/search${query ? `?${query}` : ""}`, {
        headers: authHeaders(),
    });
    return parse(response, "Failed to search customers.");
}

export async function createCustomer(data) {
    const response = await fetch(`${API_URL}/customers`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify(data),
    });
    return parse(response, "Failed to create customer.");
}

export async function updateCustomer(customerId, data) {
    const response = await fetch(`${API_URL}/customers/${customerId}`, {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify(data),
    });
    return parse(response, "Failed to update customer.");
}




export async function setCustomerStatus(customerId, status) {
    const response = await fetch(`${API_URL}/customers/${customerId}/status`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ status }),
    });
    return parse(response, "Failed to update customer status.");
}

export async function addCustomerAccount(customerId, data) {
    if (!customerId) throw new Error("Customer ID is required.");

    const response = await fetch(`${API_URL}/customers/${customerId}/accounts`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify(data),
    });

    return parse(response, "Failed to add customer account.");
}


export async function addCustomerAddress(customerId, data) {
    const response = await fetch(`${API_URL}/customers/${customerId}/addresses`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify(data),
    });
    return parse(response, "Failed to add customer address.");
}

export async function updateCustomerAddress(customerId, addressId, data) {
    const response = await fetch(`${API_URL}/customers/${customerId}/addresses/${addressId}`, {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify(data),
    });
    return parse(response, "Failed to update customer address.");
}

export async function deleteCustomerAddress(customerId, addressId) {
    const response = await fetch(`${API_URL}/customers/${customerId}/addresses/${addressId}`, {
        method: "DELETE",
        headers: authHeaders(),
    });
    return parse(response, "Failed to delete customer address.");
}


export async function lookupPincode(pincode) {
    const cleanPin = String(pincode || "").replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(cleanPin)) return null;

    const response = await fetch(`${API_URL}/customers/pincode/${cleanPin}`, {
        headers: authHeaders(),
    });
    return parse(response, "PIN code was not found in the local India PIN dataset.");
}

export async function getStates() {
    const response = await fetch(`${API_URL}/customers/states`, { headers: authHeaders() });
    return parse(response, "Failed to fetch states.");
}

export async function getCitiesByState(stateCode) {
    const response = await fetch(`${API_URL}/customers/states/${encodeURIComponent(stateCode)}/cities`, {
        headers: authHeaders(),
    });
    return parse(response, "Failed to fetch cities.");
}

export default {
    getCustomerCount,
    getCustomerById,
    searchCustomers,
    createCustomer,
    updateCustomer,
    setCustomerStatus,
    addCustomerAccount,
    addCustomerAddress,
    updateCustomerAddress,
    deleteCustomerAddress,
    getStates,
    getCitiesByState,
    lookupPincode,
};



