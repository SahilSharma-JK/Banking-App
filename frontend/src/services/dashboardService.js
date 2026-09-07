// This file contains API calls required by the Dashboard.
// Keeping API logic here makes Dashboard.jsx cleaner and modular.

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function apiGet(path) {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_URL}${path}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Failed to load dashboard.");
    }

    return result.data;
}

/**
 * Dashboard now requests only aggregate values.
 * It does not download 100k customers/accounts/transactions.
 */
export async function getDashboardSummary() {
    return apiGet("/dashboard/summary");
}

// Kept for other pages/older imports that may still use this service.
export async function getCustomers() {
    return apiGet("/customers");
}

export async function getAccounts() {
    return apiGet("/accounts?all=true");
}

export async function getTransactions() {
    return apiGet("/transactions?allowAll=true");
}
