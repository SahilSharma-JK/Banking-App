const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function headers() {
    const token = localStorage.getItem("token") || "";
    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
}

async function parse(response, fallback) {
    let result = {};
    try { result = await response.json(); } catch { }
    if (!response.ok) {
        throw new Error(result.message || fallback);
    }
    return result.data;
}

function queryString(filters = {}) {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            params.set(key, value);
        }
    });

    const query = params.toString();
    return query ? `?${query}` : "";
}

export async function getTransactions(filters = {}) {
    const response = await fetch(
        `${API_URL}/transactions${queryString(filters)}`,
        { headers: headers() }
    );
    return parse(response, "Failed to load transactions.");
}

export async function getTransactionById(transactionId) {
    const response = await fetch(
        `${API_URL}/transactions/${transactionId}`,
        { headers: headers() }
    );
    return parse(response, "Failed to load transaction.");
}

export async function getTransactionReport(filters = {}) {
    const response = await fetch(
        `${API_URL}/transactions/report${queryString(filters)}`,
        { headers: headers() }
    );
    return parse(response, "Failed to generate transaction report.");
}

export async function downloadTransactionReport(filters = {}, format = "pdf") {
    const response = await fetch(
        `${API_URL}/transactions/report/download${queryString({ ...filters, format })}`,
        { headers: headers() }
    );

    if (!response.ok) {
        let result = {};
        try { result = await response.json(); } catch { }
        throw new Error(result.message || "Failed to download transaction report.");
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const filename = match?.[1] || `zenbank-transaction-report.${format === "pdf" ? "pdf" : "csv"}`;

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    return filename;
}

export default {
    getTransactions,
    getTransactionById,
    getTransactionReport,
    downloadTransactionReport
};
