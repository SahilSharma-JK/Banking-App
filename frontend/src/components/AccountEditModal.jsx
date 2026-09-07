import { CreditCard, Loader2, Save, X } from "lucide-react";
import { useState } from "react";
import { updateAccountDetails } from "../services/accountService";
import { showToast } from "./Toast";

function buildAccountForm(account) {
    return {
        account_status: account?.account_status || "Active",
        balance: account?.saving_details?.balance ?? "",
        minimum_balance: account?.saving_details?.minimum_balance ?? "",
        withdrawal_limit: account?.saving_details?.withdrawal_limit ?? "",
        transfer_limit: account?.saving_details?.transfer_limit ?? "",
        branch_code: account?.saving_details?.branch_code ?? "",
        loan_amount: account?.loan_details?.loan_amount ?? "",
        outstanding_balance: account?.loan_details?.outstanding_balance ?? "",
        interest_rate: account?.loan_details?.interest_rate ?? "",
        duration_months: account?.loan_details?.duration_months ?? "",
        emi_amount: account?.loan_details?.emi_amount ?? "",
        repayment_start_date: account?.loan_details?.repayment_start_date
            ? String(account.loan_details.repayment_start_date).split("T")[0]
            : "",
    };
}

function AccountEditModal({ account, onClose, onUpdated }) {
    const [form, setForm] = useState(() => buildAccountForm(account));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const isSavings =
        Number(account?.account_type_id) === 1 ||
        String(account?.account_type || "").toLowerCase().includes("saving");

    const accountLocked =
        String(account?.account_status || "Active").toLowerCase() !== "active";

    if (!account) return null;

    function change(name, value) {
        setForm((old) => ({ ...old, [name]: value }));
        setError("");
    }

    async function submit(event) {
        event.preventDefault();

        try {
            setSaving(true);
            setError("");

            const data = {
                account_status: form.account_status,
            };

            if (isSavings) {
                data.balance = Number(form.balance);
                data.minimum_balance = Number(form.minimum_balance || 0);
                data.withdrawal_limit =
                    form.withdrawal_limit === "" ? null : Number(form.withdrawal_limit);
                data.transfer_limit =
                    form.transfer_limit === "" ? null : Number(form.transfer_limit);
                data.branch_code = form.branch_code || null;
            } else {
                data.loan_amount = Number(form.loan_amount);
                data.outstanding_balance = Number(form.outstanding_balance);
                data.interest_rate = Number(form.interest_rate);
                data.duration_months = Number(form.duration_months);
                data.emi_amount = Number(form.emi_amount);
                data.repayment_start_date = form.repayment_start_date || null;
            }

            const updated = await updateAccountDetails(account.account_id, data);
            onUpdated?.(updated);
            showToast("Account details updated successfully.");
            onClose();
        } catch (err) {
            setError(err.message || "Failed to update account.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-120 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
                <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-cyan-100 p-2.5 text-cyan-700"><CreditCard size={20} /></div>
                        <div>
                            <h2 className="text-xl font-bold">Edit account</h2>
                            <p className="text-sm text-slate-500">{account.account_number} · Account ID {account.account_id}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} disabled={saving} className="rounded-xl p-2 text-slate-400 hover:bg-slate-200"><X size={19} /></button>
                </header>

                <form onSubmit={submit} className="overflow-y-auto p-6">
                    {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                    {accountLocked && (
                        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            This account is <strong>{account.account_status}</strong>. Detail fields are locked. Change the account status to <strong>Active</strong> to enable editing.
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field label="Account number"><input disabled value={account.account_number || ""} /></Field>
                        <Field label="Account type"><input disabled value={`${account.account_type || ""}${account.account_subtype ? ` · ${account.account_subtype}` : ""}`} /></Field>
                        <Field label="Account status">
                            <select value={form.account_status} onChange={(e) => change("account_status", e.target.value)}>
                                <option>Active</option>
                                <option>Frozen</option>
                                <option>Disabled</option>
                            </select>
                        </Field>
                        <Field label="Customer ID"><input disabled value={account.customer_id ?? ""} /></Field>
                    </div>

                    {isSavings ? (
                        <section className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-5">
                            <h3 className="font-bold">Savings configuration</h3>
                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Field label="Balance"><input disabled={accountLocked} type="number" min="0" step="0.01" value={form.balance} onChange={(e) => change("balance", e.target.value)} /></Field>
                                <Field label="Minimum balance"><input disabled={accountLocked} type="number" min="0" step="0.01" value={form.minimum_balance} onChange={(e) => change("minimum_balance", e.target.value)} /></Field>
                                <Field label="Withdrawal limit"><input disabled={accountLocked} type="number" min="0" step="0.01" value={form.withdrawal_limit} onChange={(e) => change("withdrawal_limit", e.target.value)} /></Field>
                                <Field label="Transfer limit"><input disabled={accountLocked} type="number" min="0" step="0.01" value={form.transfer_limit} onChange={(e) => change("transfer_limit", e.target.value)} /></Field>
                                <Field label="Branch code"><input disabled={accountLocked} value={form.branch_code} onChange={(e) => change("branch_code", e.target.value)} /></Field>
                            </div>
                        </section>
                    ) : (
                        <section className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
                            <h3 className="font-bold">Loan configuration</h3>
                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Field label="Principal amount"><input disabled={accountLocked} type="number" min="0" step="0.01" value={form.loan_amount} onChange={(e) => change("loan_amount", e.target.value)} /></Field>
                                <Field label="Outstanding balance"><input disabled={accountLocked} type="number" min="0" step="0.01" value={form.outstanding_balance} onChange={(e) => change("outstanding_balance", e.target.value)} /></Field>
                                <Field label="Interest rate (%)"><input disabled={accountLocked} type="number" min="0" step="0.01" value={form.interest_rate} onChange={(e) => change("interest_rate", e.target.value)} /></Field>
                                <Field label="Tenure (months)"><input disabled={accountLocked} type="number" min="1" step="1" value={form.duration_months} onChange={(e) => change("duration_months", e.target.value)} /></Field>
                                <Field label="EMI amount"><input disabled={accountLocked} type="number" min="0" step="0.01" value={form.emi_amount} onChange={(e) => change("emi_amount", e.target.value)} /></Field>
                                <Field label="Repayment start date"><input disabled={accountLocked} type="date" value={form.repayment_start_date} onChange={(e) => change("repayment_start_date", e.target.value)} /></Field>
                            </div>
                        </section>
                    )}

                    <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
                        <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                        <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-50">
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Save changes
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
            <span className="mt-2 block [&_input]:h-11 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-200 [&_input]:bg-slate-50 [&_input]:px-3 [&_input]:text-slate-900 [&_input]:outline-none [&_input]:focus:border-cyan-500 [&_input]:disabled:cursor-not-allowed [&_input]:disabled:bg-slate-100 [&_input]:disabled:text-slate-400 [&_select]:h-11 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-slate-200 [&_select]:bg-slate-50 [&_select]:px-3 [&_select]:text-slate-900 [&_select]:outline-none [&_select]:focus:border-cyan-500">
                {children}
            </span>
        </label>
    );
}

export default AccountEditModal;
