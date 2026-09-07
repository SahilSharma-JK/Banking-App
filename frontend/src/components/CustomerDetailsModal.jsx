import {
    CalendarDays,
    CreditCard,
    Mail,
    MapPin,
    Phone,
    UserRound,
    WalletCards,
    X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getCustomerById } from "../services/customerService";

function CustomerDetailsModal({ customer, onClose }) {
    const [data, setData] = useState(customer);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!customer?.customer_id) return;

        async function load() {
            try {
                setLoading(true);
                const fresh = await getCustomerById(customer.customer_id);
                setData(fresh);
            } catch (err) {
                setError(err.message || "Failed to load customer details.");
            } finally {
                setLoading(false);
            }
        }

        load();
    }, [customer]);

    if (!customer) return null;

    const addresses = Array.isArray(data?.addresses) ? data.addresses : [];
    const accounts = Array.isArray(data?.accounts) ? data.accounts : [];

    return (
        <div className="fixed inset-0 z-110 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
            <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
                <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-7 py-5">
                    <div className="flex items-center gap-4">
                        <div className="rounded-2xl bg-cyan-100 p-3 text-cyan-700">
                            <UserRound size={22} />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
                                Customer profile
                            </p>
                            <h2 className="text-2xl font-bold">
                                {data?.first_name} {data?.last_name}
                            </h2>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                                <span>Customer ID: {data?.customer_id} · {data?.customer_number}</span>
                                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${String(data?.customer_status || "Active") === "Closed"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-emerald-100 text-emerald-700"
                                    }`}>
                                    {data?.customer_status || "Active"}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                        <X size={21} />
                    </button>
                </header>

                <div className="overflow-y-auto p-7">
                    {error && (
                        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="py-14 text-center text-slate-500">Loading customer details...</div>
                    ) : (
                        <>
                            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 font-bold">Personal information</h3>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    <Info label="Full name" value={`${data.first_name || ""} ${data.last_name || ""}`.trim()} />
                                    <Info label="Email" value={data.email} icon={Mail} />
                                    <Info label="Mobile" value={data.mobile || data.phone} icon={Phone} />
                                    <Info label="Date of birth" value={formatDate(data.dob)} icon={CalendarDays} />
                                    <Info label="Marital status" value={data.marital_status || "Not specified"} />
                                    <Info label="Customer number" value={data.customer_number} />
                                </div>
                            </section>

                            <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="mb-4 flex items-center gap-2">
                                    <MapPin size={18} className="text-cyan-700" />
                                    <h3 className="font-bold">Addresses</h3>
                                </div>

                                {addresses.length === 0 ? (
                                    <p className="text-sm text-slate-500">No address records.</p>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        {addresses.map((address) => (
                                            <div key={address.address_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-semibold text-slate-800">
                                                        {address.address_type || "Address"}
                                                    </p>
                                                    {Number(address.is_primary) === 1 && (
                                                        <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-700">
                                                            Primary
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-3 text-sm leading-6 text-slate-600">
                                                    {address.address_line1}
                                                    {address.address_line2 ? `, ${address.address_line2}` : ""}
                                                    <br />
                                                    {address.city_name || "City"}, {address.state_name || address.state_code || "State"}
                                                    <br />
                                                    PIN {address.pin_code}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="mb-4 flex items-center gap-2">
                                    <CreditCard size={18} className="text-cyan-700" />
                                    <h3 className="font-bold">Accounts</h3>
                                </div>

                                {accounts.length === 0 ? (
                                    <p className="text-sm text-slate-500">No accounts found.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {accounts.map((account) => (
                                            <div key={account.account_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="rounded-xl bg-white p-2.5 text-cyan-700 shadow-sm">
                                                            <WalletCards size={19} />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-slate-900">{account.account_number}</p>
                                                            <p className="text-xs text-slate-500">
                                                                Account ID: {account.account_id} · {account.account_type} {account.account_subtype ? `· ${account.account_subtype}` : ""}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-left lg:text-right">
                                                        <p className="font-bold text-slate-900">₹{money(account.balance)}</p>
                                                        <p className="text-xs text-slate-500">{account.account_status}</p>
                                                    </div>
                                                </div>

                                                {account.saving_details && (
                                                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                                                        <Mini label="Minimum balance" value={`₹${money(account.saving_details.minimum_balance)}`} />
                                                        <Mini label="Withdrawal limit" value={account.saving_details.withdrawal_limit == null ? "No limit" : `₹${money(account.saving_details.withdrawal_limit)}`} />
                                                        <Mini label="Transfer limit" value={account.saving_details.transfer_limit == null ? "No limit" : `₹${money(account.saving_details.transfer_limit)}`} />
                                                        <Mini label="Branch" value={account.saving_details.branch_code || "N/A"} />
                                                    </div>
                                                )}

                                                {account.loan_details && (
                                                    <>
                                                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                                                            <Mini label="Principal" value={`₹${money(account.loan_details.loan_amount)}`} />
                                                            <Mini label="Interest" value={`${account.loan_details.interest_rate ?? "N/A"}%`} />
                                                            <Mini label="EMI" value={`₹${money(account.loan_details.emi_amount)}`} />
                                                            <Mini label="Outstanding" value={`₹${money(account.loan_details.outstanding_balance)}`} />
                                                            <Mini label="Tenure" value={`${account.loan_details.duration_months ?? "N/A"} months`} />
                                                            <Mini label="Repayment starts" value={formatDate(account.loan_details.repayment_start_date)} />
                                                        </div>

                                                        <LoanSchedule schedule={account.loan_details.emi_schedule || []} />
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                View mode is read-only. Use <strong>Edit Customer</strong> from the search result when changes are required.
                            </div>
                        </>
                    )}
                </div>

                <footer className="flex justify-end border-t border-slate-200 bg-slate-50 px-7 py-4">
                    <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                        Close
                    </button>
                </footer>
            </div>
        </div>
    );
}


function LoanSchedule({ schedule }) {
    const rows = Array.isArray(schedule) ? schedule : [];
    const PAGE_SIZE = 10;
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [schedule]);

    if (!rows.length) {
        return (
            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
                No EMI schedule is available for this loan. The schedule will appear once the loan has valid repayment details.
            </div>
        );
    }

    const paid = rows.filter((row) => String(row.emi_status).toUpperCase() === "PAID").length;
    const partial = rows.filter((row) => String(row.emi_status).toUpperCase() === "PARTIALLY_PAID").length;
    const paidAmount = rows.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0);
    const totalScheduled = rows.reduce((sum, row) => sum + Number(row.emi_amount || 0), 0);
    const next = rows.find((row) => String(row.emi_status).toUpperCase() !== "PAID");
    const visibleRows = rows.slice(0, visibleCount);
    const hasMore = visibleCount < rows.length;
    const showingAll = visibleCount >= rows.length;

    return (
        <div className="mt-5 overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50/50">
            <div className="border-b border-indigo-100 bg-white px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="font-bold text-slate-800">EMI / Repayment Schedule</p>
                        <p className="mt-1 text-xs text-slate-500">
                            Installment-wise due dates and payment status. Showing {visibleRows.length} of {rows.length}.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <ScheduleStat label="Paid" value={`${paid}/${rows.length}`} />
                        <ScheduleStat label="Partial" value={String(partial)} />
                        <ScheduleStat label="Paid amount" value={`₹${money(paidAmount)}`} />
                        <ScheduleStat label="Next due" value={next ? formatDate(next.emi_date) : "Completed"} />
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-720px text-left text-sm">
                    <thead className="bg-indigo-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-4 py-3">Installment</th>
                            <th className="px-4 py-3">Due date</th>
                            <th className="px-4 py-3 text-right">EMI amount</th>
                            <th className="px-4 py-3 text-right">Paid</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Remaining</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-100 bg-white">
                        {visibleRows.map((row) => {
                            const status = String(row.emi_status || "PENDING").toUpperCase();
                            const statusClass = status === "PAID"
                                ? "bg-emerald-100 text-emerald-700"
                                : status === "PARTIALLY_PAID"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-600";

                            return (
                                <tr key={row.emi_id || row.emi_number}>
                                    <td className="px-4 py-3 font-semibold text-slate-800">#{row.emi_number}</td>
                                    <td className="px-4 py-3 text-slate-600">{formatDate(row.emi_date)}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-800">₹{money(row.emi_amount)}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-700">₹{money(row.paid_amount)}</td>
                                    <td className="px-4 py-3">
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}`}>
                                            {status === "PARTIALLY_PAID" ? "Partially paid" : status === "PAID" ? "Paid" : "Pending"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-600">₹{money(row.remaining_balance)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-indigo-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-500">
                    <span>Total scheduled: ₹{money(totalScheduled)}</span>
                    <span className="mx-2">·</span>
                    <span>{next ? `Next installment: #${next.emi_number} · ${formatDate(next.emi_date)}` : "All installments completed"}</span>
                </div>

                {rows.length > PAGE_SIZE && (
                    <div className="flex gap-2">
                        {hasMore && (
                            <button
                                type="button"
                                onClick={() => setVisibleCount((count) => Math.min(count + PAGE_SIZE, rows.length))}
                                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                            >
                                Show 10 more
                            </button>
                        )}
                        {!showingAll && (
                            <button
                                type="button"
                                onClick={() => setVisibleCount(rows.length)}
                                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                            >
                                Show all
                            </button>
                        )}
                        {showingAll && (
                            <button
                                type="button"
                                onClick={() => setVisibleCount(PAGE_SIZE)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                            >
                                Show less
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function ScheduleStat({ label, value }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 font-bold text-slate-800">{value}</p>
        </div>
    );
}

function Info({ label, value, icon: Icon }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {Icon && <Icon size={14} />}
                {label}
            </div>
            <p className="mt-2 font-medium text-slate-800">{value || "N/A"}</p>
        </div>
    );
}

function Mini({ label, value }) {
    return (
        <div className="rounded-lg bg-white p-3">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-1 font-semibold text-slate-700">{value}</p>
        </div>
    );
}

function formatDate(value) {
    if (!value) return "N/A";
    const raw = String(value).split("T")[0];
    const parts = raw.split("-");
    if (parts.length !== 3) return "N/A";
    const [year, month, day] = parts;
    return `${day} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1] || ""} ${year}`;
}

function money(value) {
    const number = Number(value || 0);
    return number.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default CustomerDetailsModal;

