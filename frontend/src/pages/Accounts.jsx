import {
    ArrowLeft,
    ArrowRight,
    CreditCard,
    Landmark,
    MinusCircle,
    PlusCircle,
    RefreshCw,
    Search,
    WalletCards,
    X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import {
    getAccounts,
    payLoanEmi,
    updateSavingsTransaction,
} from "../services/accountService";
import { showToast } from "../components/Toast";

function Accounts() {
    const [searchParams] = useSearchParams();
    const [search, setSearch] = useState("");
    const [accountType, setAccountType] = useState(
        searchParams.get("type") || "all"
    );
    const [accounts, setAccounts] = useState([]);
    const [searched, setSearched] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [action, setAction] = useState(null);

    async function runSearch(event) {
        event?.preventDefault();

        if (!search.trim()) {
            setError("Enter a customer name, Customer ID, Account ID or account number.");
            return;
        }

        try {
            setLoading(true);
            setError("");
            const data = await getAccounts({
                search: search.trim(),
                type: accountType === "all" ? "" : accountType,
            });
            setAccounts(Array.isArray(data) ? data : []);
            setSearched(true);
        } catch (err) {
            setError(err.message || "Failed to search accounts.");
        } finally {
            setLoading(false);
        }
    }

    function clearSearch() {
        setSearch("");
        setAccounts([]);
        setSearched(false);
        setError("");
    }

    function updateAccount(updated) {
        setAccounts((old) =>
            old.map((account) => {
                if (Number(account.account_id) === Number(updated.account_id)) {
                    return { ...account, ...updated };
                }

                // EMI payment from a Savings Account returns the exact source
                // account and its post-payment balance. Update that row locally
                // so the operator sees the debit immediately, without refresh.
                if (
                    updated?.payment?.source_account_id &&
                    Number(account.account_id) === Number(updated.payment.source_account_id) &&
                    updated.payment.source_balance_after != null
                ) {
                    const balance = Number(updated.payment.source_balance_after);
                    return {
                        ...account,
                        balance,
                        saving_balance: balance,
                        saving_details: account.saving_details
                            ? { ...account.saving_details, balance }
                            : account.saving_details,
                    };
                }

                return account;
            })
        );
    }

    async function refreshResults() {
        if (!search.trim()) return;
        await runSearch();
    }

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900">
            <Sidebar />

            <main className="ml-64 min-h-screen p-6 lg:p-8">
                <div className="mb-5 flex items-center justify-between">
                    <button type="button" onClick={() => window.history.back()} className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-white hover:text-slate-800">
                        <ArrowLeft size={16} /> Back
                    </button>
                </div>

                <section className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-cyan-700">ZENbank · Account operations</p>
                        <h1 className="text-4xl font-bold tracking-tight text-slate-950">Accounts</h1>
                        <p className="mt-2 text-slate-500">
                            Search an account or customer to access deposit, withdrawal and EMI operations.
                        </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Search results</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">{searched ? accounts.length : "—"}</p>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 p-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                            <div className="flex items-center gap-3 lg:mr-auto">
                                <div className="rounded-xl bg-cyan-100 p-2.5 text-cyan-700"><WalletCards size={20} /></div>
                                <div>
                                    <h2 className="text-xl font-bold">Account operations</h2>
                                    <p className="text-sm text-slate-500">
                                        Nothing is listed until you search.
                                    </p>
                                </div>
                            </div>

                            <select
                                value={accountType}
                                onChange={(e) => setAccountType(e.target.value)}
                                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-500"
                            >
                                <option value="all">All account types</option>
                                <option value="savings">Savings accounts</option>
                                <option value="loan">Loan accounts</option>
                            </select>

                            <form onSubmit={runSearch} className="flex min-w-0 flex-1 gap-2 lg:max-w-2xl">
                                <div className="relative flex-1">
                                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Customer name / Customer ID / Account ID / Account number"
                                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                                    />
                                </div>
                                <button type="submit" className="flex h-12 items-center gap-2 rounded-xl bg-cyan-600 px-5 text-sm font-bold text-white hover:bg-cyan-700">
                                    <Search size={17} /> Search
                                </button>
                            </form>
                        </div>

                        {searched && (
                            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                                <p className="text-sm text-slate-600">
                                    Showing results for <strong>{search}</strong>
                                    {accountType !== "all" ? ` · ${accountType}` : ""}
                                </p>
                                <button type="button" onClick={clearSearch} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-white hover:text-slate-800">
                                    <X size={15} /> Clear / Back
                                </button>
                            </div>
                        )}
                    </div>

                    {error && <div className="border-b border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">{error}</div>}

                    {loading ? (
                        <div className="p-14 text-center text-slate-500">Searching accounts...</div>
                    ) : !searched ? (
                        <div className="p-14 text-center">
                            <CreditCard size={38} className="mx-auto text-slate-300" />
                            <h3 className="mt-4 font-bold text-slate-700">Search an account to begin</h3>
                            <p className="mt-2 text-sm text-slate-500">
                                Use a customer name, Customer ID, Account ID or account number.
                            </p>
                        </div>
                    ) : accounts.length === 0 ? (
                        <div className="p-14 text-center">
                            <CreditCard size={38} className="mx-auto text-slate-300" />
                            <h3 className="mt-4 font-bold text-slate-700">No matching accounts</h3>
                            <p className="mt-2 text-sm text-slate-500">Try another search term or account type.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-980px text-left">
                                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-400">
                                    <tr className="border-b border-slate-200">
                                        <th className="px-6 py-4">Account</th>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4">Balance / Outstanding</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Operations</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {accounts.map((account) => {
                                        const isLoan =
                                            Number(account.account_type_id) === 2 ||
                                            String(account.account_type || "").toLowerCase().includes("loan");

                                        return (
                                            <tr key={account.account_id} className="border-b border-slate-100 hover:bg-cyan-50/30">
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="rounded-xl bg-cyan-100 p-2.5 text-cyan-700">
                                                            {isLoan ? <Landmark size={19} /> : <CreditCard size={19} />}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-900">{account.account_number}</p>
                                                            <p className="mt-1 text-xs text-slate-500">Account ID: {account.account_id}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <p className="font-semibold text-slate-800">{account.customer_name}</p>
                                                    <p className="mt-1 text-xs text-slate-500">Customer ID: {account.customer_id}</p>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${isLoan ? "bg-indigo-100 text-indigo-700" : "bg-cyan-100 text-cyan-700"}`}>
                                                        {account.account_type}
                                                    </span>
                                                    <p className="mt-2 text-xs text-slate-400">{account.account_subtype || ""}</p>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <p className="text-lg font-bold text-slate-900">₹{money(account.balance)}</p>
                                                    {isLoan && account.emi_amount != null && (
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            EMI ₹{money(account.emi_amount)}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${String(account.account_status).toLowerCase() === "active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                                        {account.account_status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex justify-end gap-2">
                                                        {!isLoan ? (
                                                            <>
                                                                <button type="button" title="Deposit" onClick={() => setAction({ type: "deposit", account })} className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-700 hover:bg-emerald-100">
                                                                    <PlusCircle size={18} />
                                                                </button>
                                                                <button type="button" title="Withdraw" onClick={() => setAction({ type: "withdraw", account })} className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-red-700 hover:bg-red-100">
                                                                    <MinusCircle size={18} />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button type="button" title="Pay EMI" onClick={() => setAction({ type: "emi", account })} className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100">
                                                                Pay EMI
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </main>

            {action && (
                <AccountActionModal
                    action={action}
                    onClose={() => setAction(null)}
                    onCompleted={(updated) => {
                        updateAccount(updated);
                        setAction(null);
                        showToast(
                            action.type === "deposit"
                                ? "Deposit completed successfully."
                                : action.type === "withdraw"
                                    ? "Withdrawal completed successfully."
                                    : updated.payment?.status === "PARTIALLY_PAID"
                                        ? "Partial EMI payment recorded."
                                        : "EMI payment completed."
                        );
                    }}
                />
            )}
        </div>
    );
}

function AccountActionModal({ action, onClose, onCompleted }) {
    const [amount, setAmount] = useState(
        action.type === "emi" ? action.account.emi_amount || "" : ""
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [paymentSource, setPaymentSource] = useState("CASH");
    const [savingsAccounts, setSavingsAccounts] = useState([]);
    const [sourceAccountId, setSourceAccountId] = useState("");
    const [otherAccountNumber, setOtherAccountNumber] = useState("");
    const [sourceLoading, setSourceLoading] = useState(false);
    const [sourceMessage, setSourceMessage] = useState("");

    const isEmi = action.type === "emi";

    useEffect(() => {
        if (!isEmi || !action.account.customer_id) return;

        let cancelled = false;

        async function loadSavingsAccounts() {
            try {
                setSourceLoading(true);
                const rows = await getAccounts({
                    search: action.account.customer_id,
                    type: "savings",
                });

                if (!cancelled) {
                    setSavingsAccounts(
                        (Array.isArray(rows) ? rows : []).filter(
                            (item) =>
                                Number(item.customer_id) === Number(action.account.customer_id) &&
                                String(item.account_status).toLowerCase() === "active"
                        )
                    );
                }
            } catch (err) {
                if (!cancelled) {
                    setSourceMessage(err.message || "Unable to load Savings Accounts.");
                }
            } finally {
                if (!cancelled) setSourceLoading(false);
            }
        }

        loadSavingsAccounts();

        return () => {
            cancelled = true;
        };
    }, [isEmi, action.account.customer_id]);

    const selectedSavings = savingsAccounts.find(
        (item) => String(item.account_id) === String(sourceAccountId)
    );

    const numericAmount = Number(amount);
    const selectedBalance = Number(selectedSavings?.balance || 0);
    const selectedMinimum = Number(selectedSavings?.minimum_balance || 0);
    const usableBalance = Math.max(0, selectedBalance - selectedMinimum);
    const savingsInsufficient =
        isEmi &&
        paymentSource === "SAVINGS" &&
        Number.isFinite(numericAmount) &&
        numericAmount > 0 &&
        numericAmount > usableBalance;

    useEffect(() => {
        if (!isEmi || paymentSource !== "SAVINGS") {
            setSourceMessage("");
            return;
        }

        if (!sourceAccountId) {
            setSourceMessage("Select a Savings Account to check its available balance.");
            return;
        }

        if (savingsInsufficient) {
            setSourceMessage(
                `Insufficient balance. Only ₹${money(usableBalance)} is available after maintaining the minimum balance of ₹${money(selectedMinimum)}.`
            );
        } else {
            setSourceMessage(
                `Available for EMI: ₹${money(usableBalance)}`
            );
        }
    }, [
        isEmi,
        paymentSource,
        sourceAccountId,
        savingsInsufficient,
        usableBalance,
        selectedMinimum,
    ]);

    async function submit(event) {
        event.preventDefault();

        if (isEmi && paymentSource === "SAVINGS" && savingsInsufficient) {
            setError(sourceMessage);
            return;
        }

        if (isEmi && paymentSource === "SAVINGS" && !sourceAccountId) {
            setError("Select a Savings Account.");
            return;
        }

        if (isEmi && paymentSource === "OTHER_ACCOUNT" && !otherAccountNumber.trim()) {
            setError("Enter the other/external account number.");
            return;
        }

        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            setError("Enter a valid amount greater than zero.");
            return;
        }

        try {
            setLoading(true);
            setError("");

            const updated =
                isEmi
                    ? await payLoanEmi(
                        action.account.account_id,
                        numericAmount,
                        paymentSource,
                        sourceAccountId,
                        otherAccountNumber
                    )
                    : await updateSavingsTransaction(
                        action.account.account_id,
                        numericAmount,
                        action.type
                    );

            onCompleted(updated);
        } catch (err) {
            setError(err.message || "Payment failed.");
        } finally {
            setLoading(false);
        }
    }

    const title =
        action.type === "deposit"
            ? "Deposit money"
            : action.type === "withdraw"
                ? "Withdraw money"
                : "Pay loan EMI";

    return (
        <div className="fixed inset-0 z-120 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
                <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">
                            {isEmi ? "Loan repayment" : "Savings transaction"}
                        </p>
                        <h2 className="mt-1 text-xl font-bold">{title}</h2>
                        <p className="mt-1 text-sm text-slate-500">{action.account.account_number}</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={loading} className="rounded-xl p-2 text-slate-400 hover:bg-slate-200">
                        <X size={19} />
                    </button>
                </header>

                <form onSubmit={submit} className="flex max-h-[92vh] min-h-0 flex-col">
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-6">
                        <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs text-slate-400">{isEmi ? "Outstanding balance" : "Current balance"}</p>
                            <p className="mt-1 text-2xl font-bold">
                                ₹{money(isEmi ? action.account.outstanding_balance : action.account.balance)}
                            </p>
                            {isEmi && (
                                <p className="mt-2 text-sm text-indigo-700">
                                    Fixed EMI: ₹{money(action.account.emi_amount)}
                                </p>
                            )}
                        </div>

                        {isEmi && (
                            <div className="mt-5">
                                <label className="block text-sm font-semibold text-slate-600">
                                    Payment source
                                </label>
                                <div className="mt-2 grid grid-cols-3 gap-2">
                                    {[
                                        ["CASH", "Cash"],
                                        ["SAVINGS", "Savings Account"],
                                        ["OTHER_ACCOUNT", "Other Account"],
                                    ].map(([value, label]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => {
                                                setPaymentSource(value);
                                                setError("");
                                            }}
                                            className={`rounded-xl border px-3 py-3 text-xs font-bold transition ${paymentSource === value
                                                ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                                }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                {paymentSource === "SAVINGS" && (
                                    <div className="mt-4">
                                        <label className="block text-sm font-semibold text-slate-600">
                                            Select Savings Account
                                        </label>
                                        <select
                                            value={sourceAccountId}
                                            onChange={(e) => {
                                                setSourceAccountId(e.target.value);
                                                setError("");
                                            }}
                                            disabled={sourceLoading}
                                            className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                                        >
                                            <option value="">
                                                {sourceLoading ? "Loading accounts..." : "Select an account"}
                                            </option>
                                            {savingsAccounts.map((account) => (
                                                <option key={account.account_id} value={account.account_id}>
                                                    {account.account_number} · Balance ₹{money(account.balance)}
                                                </option>
                                            ))}
                                        </select>

                                        {sourceMessage && (
                                            <div className={`mt-2 rounded-xl border px-3 py-2 text-xs font-semibold ${savingsInsufficient
                                                ? "border-red-200 bg-red-50 text-red-700"
                                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                }`}>
                                                {sourceMessage}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {paymentSource === "OTHER_ACCOUNT" && (
                                    <div className="mt-4">
                                        <label className="block text-sm font-semibold text-slate-600">
                                            Other / external account number
                                            <input
                                                value={otherAccountNumber}
                                                onChange={(e) => {
                                                    setOtherAccountNumber(e.target.value);
                                                    setError("");
                                                }}
                                                placeholder="Enter account number"
                                                className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                                            />
                                        </label>
                                        <p className="mt-2 text-xs text-slate-500">
                                            This records the payment source without debiting a ZENbank Savings Account.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        <label className="mt-5 block text-sm font-semibold text-slate-600">
                            {isEmi ? "Amount to pay" : "Amount"}
                            <input
                                autoFocus
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                            />
                        </label>

                        {isEmi && (
                            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                                A smaller payment is recorded as <strong>PARTIALLY_PAID</strong>. A Savings Account payment is allowed only when the remaining balance stays above its minimum balance.
                            </div>
                        )}

                        {error && (
                            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                    </div>

                    <div className="sticky bottom-0 flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
                        <button type="button" onClick={onClose} disabled={loading} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || savingsInsufficient || (isEmi && paymentSource === "SAVINGS" && !sourceAccountId)}
                            className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-50"
                        >
                            {loading ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                            Confirm payment
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
function money(value) {
    return Number(value || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default Accounts;



