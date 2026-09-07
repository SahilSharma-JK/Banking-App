import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getTransactions } from "../services/transactionService";

function money(value) {
    return Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateTime(value) {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function AccountViewModal({ account, onClose }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!account) return;
        getTransactions({ account_id: account.account_id })
            .then((rows) => setTransactions(Array.isArray(rows) ? rows : []))
            .catch((err) => setError(err.message || "Failed to load transaction history."))
            .finally(() => setLoading(false));
    }, [account]);

    if (!account) return null;

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
            <div className="my-auto flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 text-white shadow-2xl">
                <header className="flex items-center justify-between border-b border-white/10 p-6">
                    <div>
                        <p className="text-xs uppercase tracking-wider text-cyan-400">Account Details</p>
                        <h2 className="mt-1 text-xl font-semibold">{account.account_number}</h2>
                        <p className="mt-1 text-sm text-slate-500">{account.customer_name || "N/A"}</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={20} /></button>
                </header>

                <div className="overflow-y-auto p-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <Card label="Status" value={account.account_status} />
                        <Card label="Account Type" value={`${account.account_type || ""}${account.account_subtype ? ` - ${account.account_subtype}` : ""}`} />
                        {account.saving_details && <Card label="Balance" value={`₹${money(account.saving_details.balance)}`} />}
                        {account.saving_details && <Card label="Transfer Limit" value={`₹${money(account.saving_details.transfer_limit)}`} />}
                        {account.saving_details && <Card label="Branch" value={account.saving_details.branch_code || "N/A"} />}
                        {account.loan_details && <Card label="Loan Amount" value={`₹${money(account.loan_details.loan_amount)}`} />}
                        {account.loan_details && <Card label="Outstanding Balance" value={`₹${money(account.loan_details.outstanding_balance)}`} />}
                        {account.loan_details && <Card label="Interest Rate" value={`${account.loan_details.interest_rate ?? "N/A"}%`} />}
                        {account.loan_details && <Card label="Duration" value={`${account.loan_details.duration_months ?? 0} months`} />}
                        {account.loan_details && <Card label="EMI" value={`₹${money(account.loan_details.emi_amount)}`} />}
                    </div>

                    <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                        <div className="border-b border-white/10 p-5">
                            <h3 className="font-semibold">Transaction History</h3>
                            <p className="mt-1 text-sm text-slate-500">Latest activity for this account.</p>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center gap-2 p-8 text-slate-400"><Loader2 size={18} className="animate-spin" /> Loading history...</div>
                        ) : error ? (
                            <div className="p-8 text-sm text-red-300">{error}</div>
                        ) : transactions.length === 0 ? (
                            <div className="p-8 text-sm text-slate-500">No transactions recorded yet.</div>
                        ) : (
                            <div className="max-h-80 overflow-auto">
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-slate-900 text-xs uppercase tracking-wider text-slate-500">
                                        <tr>
                                            <th className="px-5 py-3">Date</th>
                                            <th className="px-5 py-3">Type</th>
                                            <th className="px-5 py-3">Amount</th>
                                            <th className="px-5 py-3">Balance after</th>
                                            <th className="px-5 py-3">Reference</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map((item) => (
                                            <tr key={item.transaction_id} className="border-t border-white/5">
                                                <td className="px-5 py-3 text-sm text-slate-300">{dateTime(item.transaction_date)}</td>
                                                <td className="px-5 py-3 text-sm">{item.transaction_type}</td>
                                                <td className="px-5 py-3 font-semibold">₹{money(item.amount)}</td>
                                                <td className="px-5 py-3 text-sm text-slate-300">₹{money(item.balance_after)}</td>
                                                <td className="px-5 py-3 font-mono text-xs text-slate-500">{item.reference_number}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}

function Card({ label, value }) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 font-semibold">{value || "N/A"}</p>
        </div>
    );
}

export default AccountViewModal;
