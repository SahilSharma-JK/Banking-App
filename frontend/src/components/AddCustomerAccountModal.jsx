import { CreditCard, Loader2, Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import { addCustomerAccount } from "../services/customerService";

function AddCustomerAccountModal({ customerId, onClose, onAdded }) {
    const [type, setType] = useState("1");
    const [form, setForm] = useState({
        initial_balance: "",
        minimum_balance: "",
        withdrawal_limit: "",
        transfer_limit: "",
        branch_code: "",
        loan_amount: "",
        interest_rate: "",
        duration_months: "",
        emi_amount: "",
        repayment_start_date: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const calculatedEmi = useMemo(() => {
        const principal = Number(form.loan_amount);
        const rate = Number(form.interest_rate);
        const months = Number(form.duration_months);
        if (!principal || principal <= 0 || !months || months <= 0 || rate < 0) return "";

        const monthly = rate / 100 / 12;
        const emi =
            monthly === 0
                ? principal / months
                : principal * monthly * Math.pow(1 + monthly, months) /
                (Math.pow(1 + monthly, months) - 1);

        return Number.isFinite(emi) ? emi.toFixed(2) : "";
    }, [form.loan_amount, form.interest_rate, form.duration_months]);

    function change(name, value) {
        setForm((old) => ({ ...old, [name]: value }));
        setError("");
    }

    async function submit(event) {
        event.preventDefault();

        try {
            setLoading(true);
            setError("");

            const payload = { account_type_id: Number(type) };

            if (type === "1") {
                const balance = Number(form.initial_balance || 0);
                const minimum = Number(form.minimum_balance || 0);

                if (balance < minimum) {
                    throw new Error("Opening balance cannot be below the minimum balance.");
                }

                payload.initial_balance = balance;
                payload.minimum_balance = minimum;
                payload.withdrawal_limit = form.withdrawal_limit === "" ? null : Number(form.withdrawal_limit);
                payload.transfer_limit = form.transfer_limit === "" ? null : Number(form.transfer_limit);
                payload.branch_code = form.branch_code || null;
            } else {
                if (Number(form.loan_amount) <= 0 || Number(form.duration_months) <= 0) {
                    throw new Error("Principal and tenure are required.");
                }

                payload.loan_amount = Number(form.loan_amount);
                payload.interest_rate = Number(form.interest_rate || 0);
                payload.duration_months = Number(form.duration_months);
                payload.emi_amount = form.emi_amount === "" ? Number(calculatedEmi) : Number(form.emi_amount);
                payload.repayment_start_date = form.repayment_start_date || null;
            }

            const updatedCustomer = await addCustomerAccount(customerId, payload);
            onAdded?.(updatedCustomer);
        } catch (err) {
            setError(err.message || "Failed to add account.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-130 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
                <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-cyan-100 p-2.5 text-cyan-700">
                            <CreditCard size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Add account</h2>
                            <p className="text-sm text-slate-500">Open another account for this customer.</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} disabled={loading} className="rounded-xl p-2 text-slate-400 hover:bg-slate-200">
                        <X size={19} />
                    </button>
                </header>

                <form onSubmit={submit} className="p-6">
                    {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                    <div className="mb-5 flex rounded-xl bg-slate-100 p-1">
                        <button type="button" onClick={() => setType("1")} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold ${type === "1" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500"}`}>Savings</button>
                        <button type="button" onClick={() => setType("2")} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold ${type === "2" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>Loan</button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {type === "1" ? (
                            <>
                                <Field label="Opening balance"><input type="number" min="0" step="0.01" value={form.initial_balance} onChange={(e) => change("initial_balance", e.target.value)} /></Field>
                                <Field label="Minimum balance"><input type="number" min="0" step="0.01" value={form.minimum_balance} onChange={(e) => change("minimum_balance", e.target.value)} /></Field>
                                <Field label="Withdrawal limit"><input type="number" min="0" step="0.01" value={form.withdrawal_limit} onChange={(e) => change("withdrawal_limit", e.target.value)} /></Field>
                                <Field label="Transfer limit"><input type="number" min="0" step="0.01" value={form.transfer_limit} onChange={(e) => change("transfer_limit", e.target.value)} /></Field>
                                <Field label="Branch code"><input value={form.branch_code} onChange={(e) => change("branch_code", e.target.value)} /></Field>
                            </>
                        ) : (
                            <>
                                <Field label="Principal amount *"><input type="number" min="1" step="0.01" value={form.loan_amount} onChange={(e) => change("loan_amount", e.target.value)} /></Field>
                                <Field label="Interest rate (%)"><input type="number" min="0" step="0.01" value={form.interest_rate} onChange={(e) => change("interest_rate", e.target.value)} /></Field>
                                <Field label="Tenure (months) *"><input type="number" min="1" step="1" value={form.duration_months} onChange={(e) => change("duration_months", e.target.value)} /></Field>
                                <Field label="Repayment start date"><input type="date" value={form.repayment_start_date} onChange={(e) => change("repayment_start_date", e.target.value)} /></Field>
                                <Field label="EMI amount"><input type="number" min="0" step="0.01" value={form.emi_amount || calculatedEmi} onChange={(e) => change("emi_amount", e.target.value)} placeholder={calculatedEmi || "Auto calculated"} /></Field>
                            </>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
                        <button type="button" onClick={onClose} disabled={loading} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                        <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-50">
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Add account
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <label className="block text-sm font-medium text-slate-600">
            {label}
            <span className="mt-2 block [&_input]:h-11 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-200 [&_input]:bg-slate-50 [&_input]:px-3 [&_input]:text-slate-900 [&_input]:outline-none [&_input]:focus:border-cyan-500">
                {children}
            </span>
        </label>
    );
}

export default AddCustomerAccountModal;
