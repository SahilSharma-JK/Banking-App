import {
    ArrowLeft,
    CalendarDays,
    Download,
    FileText,
    RefreshCw,
    Search,
    X,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import {
    downloadTransactionReport,
    getTransactionReport,
} from "../services/transactionService";
import { showToast } from "../components/Toast";

const initialFilters = {
    customer_id: "",
    customer_name: "",
    account_number: "",
    scope: "all",
    transaction_type: "",
    date_from: "",
    date_to: "",
};

function Transactions() {
    const navigate = useNavigate();
    const [filters, setFilters] = useState(initialFilters);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [downloadLoading, setDownloadLoading] = useState("");
    const [error, setError] = useState("");
    const [searched, setSearched] = useState(false);

    function change(name, value) {
        setFilters((old) => ({ ...old, [name]: value }));
    }

    function applyPeriod(value) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");

        if (value === "this_month") {
            change("date_from", `${yyyy}-${mm}-01`);
            change("date_to", `${yyyy}-${mm}-${dd}`);
        } else if (value === "last_month") {
            const first = new Date(yyyy, today.getMonth() - 1, 1);
            const last = new Date(yyyy, today.getMonth(), 0);
            change("date_from", toDate(first));
            change("date_to", toDate(last));
        } else {
            change("date_from", "");
            change("date_to", "");
        }
    }

    async function searchHistory(event) {
        event.preventDefault();

        const hasIdentity =
            filters.customer_id.trim() ||
            filters.customer_name.trim() ||
            filters.account_number.trim();

        if (!hasIdentity) {
            setError("Enter Customer ID, customer name or account number before searching.");
            return;
        }

        try {
            setLoading(true);
            setError("");
            const data = await getTransactionReport(filters);
            setReport(data);
            setSearched(true);
        } catch (err) {
            setError(err.message || "Could not load transaction history.");
            setReport(null);
        } finally {
            setLoading(false);
        }
    }

    function clear() {
        setFilters(initialFilters);
        setReport(null);
        setSearched(false);
        setError("");
    }

    async function download(format) {
        if (!searched) {
            setError("Search a customer/account first, then download the report.");
            return;
        }

        try {
            setDownloadLoading(format);
            const filename = await downloadTransactionReport(filters, format);
            showToast(`${filename} downloaded successfully.`);
        } catch (err) {
            setError(err.message || `Failed to download ${format.toUpperCase()} report.`);
        } finally {
            setDownloadLoading("");
        }
    }

    const rows = report?.transactions || [];
    const first = rows[0] || {};
    const customerName = first.customer_name || filters.customer_name || "Selected customer";
    const customerId = first.customer_id || filters.customer_id || "N/A";
    const accountNumber = filters.account_number || (rows.length === 1 ? first.account_number : "All accounts");

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900">
            <Sidebar />

            <main className="ml-64 min-h-screen p-6 lg:p-8">
                <div className="mb-5">
                    <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-white hover:text-slate-800">
                        <ArrowLeft size={16} /> Back
                    </button>
                </div>

                <section className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-cyan-700">ZENbank · Reports</p>
                        <h1 className="text-4xl font-bold tracking-tight text-slate-950">Transaction History</h1>
                        <p className="mt-2 text-slate-500">
                            Search a customer or account, review a clean statement-style history and download the same formatted report.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => download("pdf")} disabled={!searched || !!downloadLoading} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-50">
                            <FileText size={17} />
                            {downloadLoading === "pdf" ? "Preparing..." : "Download PDF"}
                        </button>
                        <button type="button" onClick={() => download("csv")} disabled={!searched || !!downloadLoading} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">
                            <Download size={17} />
                            {downloadLoading === "csv" ? "Preparing..." : "Download CSV"}
                        </button>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <form onSubmit={searchHistory} className="p-6">
                        <div className="mb-5 flex items-center gap-3">
                            <div className="rounded-xl bg-cyan-100 p-2.5 text-cyan-700"><Search size={19} /></div>
                            <div>
                                <h2 className="text-xl font-bold">Find transaction history</h2>
                                <p className="text-sm text-slate-500">Search first. No customer transaction history is loaded by default.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <Field label="Customer ID">
                                <input value={filters.customer_id} onChange={(e) => change("customer_id", e.target.value.replace(/\D/g, ""))} placeholder="e.g. 1" />
                            </Field>
                            <Field label="Customer name">
                                <input value={filters.customer_name} onChange={(e) => change("customer_name", e.target.value)} placeholder="e.g. Name of Customer" />
                            </Field>
                            <Field label="Account number">
                                <input value={filters.account_number} onChange={(e) => change("account_number", e.target.value)} placeholder="e.g. ACCMT..." />
                            </Field>
                            <Field label="Account history">
                                <select value={filters.scope} onChange={(e) => change("scope", e.target.value)}>
                                    <option value="all">All accounts for customer</option>
                                    <option value="savings">Savings accounts only</option>
                                    <option value="loan">Loan accounts only</option>
                                </select>
                            </Field>
                            <Field label="Transaction type">
                                <select value={filters.transaction_type} onChange={(e) => change("transaction_type", e.target.value)}>
                                    <option value="">All transaction types</option>
                                    <option value="DEPOSIT">Deposits</option>
                                    <option value="WITHDRAWAL">Withdrawals</option>
                                    <option value="EMI">EMI payments</option>
                                </select>
                            </Field>
                            <div>
                                <label className="block text-sm font-medium text-slate-600">Quick period</label>
                                <select onChange={(e) => applyPeriod(e.target.value)} defaultValue="" className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-700 outline-none focus:border-cyan-500">
                                    <option value="">Choose period</option>
                                    <option value="this_month">This month</option>
                                    <option value="last_month">Last month</option>
                                    <option value="custom">Custom / all dates</option>
                                </select>
                            </div>
                            <Field label="From date">
                                <input type="date" value={filters.date_from} onChange={(e) => change("date_from", e.target.value)} />
                            </Field>
                            <Field label="To date">
                                <input type="date" value={filters.date_to} onChange={(e) => change("date_to", e.target.value)} />
                            </Field>
                        </div>

                        {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
                            <button type="button" onClick={clear} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                                <X size={16} /> Clear
                            </button>
                            <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-50">
                                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                                Search history
                            </button>
                        </div>
                    </form>
                </section>

                {!searched && (
                    <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
                        <CalendarDays size={38} className="mx-auto text-slate-300" />
                        <h2 className="mt-4 font-bold text-slate-700">No transaction history loaded</h2>
                        <p className="mt-2 text-sm text-slate-500">Search a customer or account first. The full banking history remains hidden until you identify the customer.</p>
                    </section>
                )}

                {searched && report && (
                    <section className="mt-6 overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-lg">
                        <div className="border-b-4 border-cyan-600 px-7 py-6 sm:px-9">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="text-xs font-extrabold tracking-[0.28em] text-cyan-700">ZENBANK</p>
                                    <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950">Transaction Report</h2>
                                    <p className="mt-1 text-sm text-slate-500">Banking transaction history and account activity</p>
                                </div>
                                <div className="text-left text-sm sm:text-right">
                                    <p className="font-bold text-slate-800">Report generated</p>
                                    <p className="mt-1 text-slate-500">{formatDateTime(new Date())}</p>
                                </div>
                            </div>
                        </div>

                        <div className="px-7 py-6 sm:px-9">
                            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-cyan-100 bg-cyan-50 p-5 md:grid-cols-2">
                                <ReportMeta label="Customer" value={customerName} />
                                <ReportMeta label="Customer ID" value={customerId} />
                                <ReportMeta label="Account" value={accountNumber} />
                                <ReportMeta label="Account scope" value={scopeLabel(filters.scope)} />
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2">
                                <ReportMeta label="Report period" value={`${formatFilterDate(filters.date_from) || "Start"}  →  ${formatFilterDate(filters.date_to) || "Today"}`} />
                                <ReportMeta label="Transaction filter" value={filters.transaction_type || "All transactions"} />
                            </div>

                            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                                <Summary label="Transactions" value={report.total_transactions} />
                                <Summary label="Deposits" value={`₹${money(report.total_deposits)}`} tone="green" />
                                <Summary label="Withdrawals" value={`₹${money(report.total_withdrawals)}`} tone="red" />
                                <Summary label="EMI paid" value={`₹${money(report.total_emi)}`} tone="indigo" />
                            </div>

                            <div className="mt-7">
                                <div className="mb-3 flex items-end justify-between">
                                    <div>
                                        <h3 className="text-lg font-extrabold text-slate-950">Transaction details</h3>
                                        <p className="mt-1 text-xs text-slate-500">{rows.length} record{rows.length === 1 ? "" : "s"} included in this report</p>
                                    </div>
                                    <p className="hidden text-xs font-semibold text-slate-400 sm:block">Statement view</p>
                                </div>

                                {rows.length === 0 ? (
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center text-sm text-amber-800">No transactions matched the selected filters.</div>
                                ) : (
                                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                                        <table className="w-full min-w-1050px text-left">
                                            <thead className="bg-slate-900 text-xs font-bold uppercase tracking-wide text-white">
                                                <tr>
                                                    <th className="px-5 py-3">Date</th>
                                                    <th className="px-5 py-3">Account</th>
                                                    <th className="px-5 py-3">Type</th>
                                                    <th className="px-5 py-3 text-right">Amount</th>
                                                    <th className="px-5 py-3 text-right">Balance</th>
                                                    <th className="px-5 py-3">Reference</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.map((row, index) => (
                                                    <tr key={row.transaction_id} className={index % 2 ? "bg-slate-50" : "bg-white"}>
                                                        <td className="border-t border-slate-200 px-5 py-4 text-sm text-slate-700">{formatDateTime(row.transaction_date)}</td>
                                                        <td className="border-t border-slate-200 px-5 py-4">
                                                            <p className="font-bold text-slate-900">{row.account_number}</p>
                                                            <p className="mt-1 text-xs text-slate-400">Account ID: {row.account_id}</p>
                                                        </td>
                                                        <td className="border-t border-slate-200 px-5 py-4">
                                                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${typeClass(row.transaction_type)}`}>{row.transaction_type}</span>
                                                            {row.emi_number && (
                                                                <p className="mt-2 text-xs text-slate-400">
                                                                    Installment #{row.emi_number} · {row.emi_status || "Recorded"}
                                                                    {row.payment_source ? ` · Paid via ${paymentSourceLabel(row.payment_source)}${row.source_account_number ? ` (${row.source_account_number})` : ""}` : ""}
                                                                </p>
                                                            )}
                                                        </td>
                                                        <td className="border-t border-slate-200 px-5 py-4 text-right font-extrabold text-slate-950">₹{money(row.amount)}</td>
                                                        <td className="border-t border-slate-200 px-5 py-4 text-right font-semibold text-slate-700">₹{money(row.balance_after)}</td>
                                                        <td className="border-t border-slate-200 px-5 py-4 text-xs font-semibold text-slate-500">{row.reference_number}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="mt-5 grid grid-cols-1 gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:grid-cols-2">
                                <ReportMeta label="Net movement" value={`₹${money(report.net_movement)}`} />
                                <ReportMeta label="Report status" value="Complete" />
                            </div>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <label className="block text-sm font-medium text-slate-600">
            {label}
            <span className="mt-2 block [&_input]:h-11 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-200 [&_input]:bg-slate-50 [&_input]:px-3 [&_input]:text-slate-900 [&_input]:outline-none [&_input]:focus:border-cyan-500 [&_select]:h-11 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-slate-200 [&_select]:bg-slate-50 [&_select]:px-3 [&_select]:text-slate-900 [&_select]:outline-none [&_select]:focus:border-cyan-500">
                {children}
            </span>
        </label>
    );
}

function ReportMeta({ label, value }) {
    return (
        <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{label}</p>
            <p className="mt-1 font-semibold text-slate-900">{value || "N/A"}</p>
        </div>
    );
}

function Summary({ label, value, tone = "cyan" }) {
    const classes = {
        cyan: "border-cyan-100 bg-cyan-50 text-cyan-800",
        green: "border-emerald-100 bg-emerald-50 text-emerald-800",
        red: "border-red-100 bg-red-50 text-red-800",
        indigo: "border-indigo-100 bg-indigo-50 text-indigo-800",
    };
    return <div className={`rounded-2xl border p-4 ${classes[tone]}`}><p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p><p className="mt-2 text-xl font-extrabold">{value}</p></div>;
}

function paymentSourceLabel(source) {
    const value = String(source || "").toUpperCase();
    if (value === "SAVINGS") return "Savings Account";
    if (value === "OTHER_ACCOUNT") return "Other Account";
    if (value === "CASH") return "Cash";
    return source || "Unknown";
}

function typeClass(type) {
    const value = String(type || "").toUpperCase();
    if (value === "DEPOSIT") return "bg-emerald-100 text-emerald-700";
    if (value === "WITHDRAWAL") return "bg-red-100 text-red-700";
    if (value.includes("EMI")) return "bg-indigo-100 text-indigo-700";
    return "bg-slate-100 text-slate-700";
}

function scopeLabel(scope) {
    if (scope === "savings") return "Savings accounts only";
    if (scope === "loan") return "Loan accounts only";
    return "All accounts for customer";
}

function formatFilterDate(value) {
    if (!value) return "";
    const parts = String(value).split("-");
    if (parts.length !== 3) return value;
    return `${parts[2]} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(parts[1]) - 1] || parts[1]} ${parts[0]}`;
}

function formatDateTime(value) {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function toDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function money(value) {
    return Number(value || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default Transactions;
