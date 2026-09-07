import {
    Banknote,
    CalendarDays,
    CreditCard,
    Landmark,
    Loader2,
    Save,
    UserPlus,
    X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createCustomer, getStates, getCitiesByState, lookupPincode } from "../services/customerService";
import { showToast } from "./Toast";

const initialForm = {
    first_name: "",
    last_name: "",
    email: "",
    mobile: "",
    phone: "",
    dob: "",
    marital_status: "",
    address_line1: "",
    address_line2: "",
    state_code: "",
    city_id: "",
    pin_code: "",
    address_type: "Permanent",
    account_type_id: "1",

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
};

function CreateCustomerModal({ onClose, onCreated }) {
    const [form, setForm] = useState(initialForm);
    const [states, setStates] = useState([]);
    const [cities, setCities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);
    const [lookingUpPin, setLookingUpPin] = useState(false);
    const [error, setError] = useState("");

    const isSavings = form.account_type_id === "1";
    const isLoan = form.account_type_id === "2";

    const calculatedEmi = useMemo(() => {
        const principal = Number(form.loan_amount);
        const rate = Number(form.interest_rate);
        const months = Number(form.duration_months);

        if (!principal || principal <= 0 || !months || months <= 0 || rate < 0) {
            return "";
        }

        const monthlyRate = rate / 100 / 12;
        const emi =
            monthlyRate === 0
                ? principal / months
                : principal *
                monthlyRate *
                Math.pow(1 + monthlyRate, months) /
                (Math.pow(1 + monthlyRate, months) - 1);

        return Number.isFinite(emi) ? emi.toFixed(2) : "";
    }, [form.loan_amount, form.interest_rate, form.duration_months]);

    const installmentPreview = useMemo(() => {
        if (!isLoan || !form.repayment_start_date || !form.duration_months || !calculatedEmi) {
            return [];
        }

        const start = new Date(`${form.repayment_start_date}T00:00:00`);
        if (Number.isNaN(start.getTime())) return [];

        return Array.from(
            { length: Math.min(Number(form.duration_months), 6) },
            (_, index) => {
                const date = new Date(start);
                date.setMonth(date.getMonth() + index);
                return {
                    number: index + 1,
                    date: date.toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                    }),
                };
            }
        );
    }, [isLoan, form.repayment_start_date, form.duration_months, calculatedEmi]);

    useEffect(() => {
        async function loadStates() {
            try {
                setStates(await getStates());
            } catch (err) {
                setError(err.message || "Could not load states.");
            }
        }
        loadStates();
    }, []);

    useEffect(() => {
        if (!form.state_code) {
            setCities([]);
            return;
        }

        async function loadCities() {
            try {
                setLoadingCities(true);
                setCities(await getCitiesByState(form.state_code));
            } catch (err) {
                setError(err.message || "Could not load cities.");
            } finally {
                setLoadingCities(false);
            }
        }

        loadCities();
    }, [form.state_code]);

    function change(name, value) {
        setForm((old) => ({ ...old, [name]: value }));
        setError("");
    }

    async function fillAddressFromPincode(value = form.pin_code) {
        const pin = String(value || "").replace(/\D/g, "").slice(0, 6);
        if (!/^\d{6}$/.test(pin)) {
            setError("Enter a valid 6-digit PIN code first.");
            return;
        }

        try {
            setLookingUpPin(true);
            setError("");
            const result = await lookupPincode(pin);

            if (!result?.state_code || !result?.city_id) {
                setError(`PIN ${pin} was found, but its state/city is not seeded yet. Run the database seed once.`);
                return;
            }

            setForm((old) => ({
                ...old,
                pin_code: pin,
                state_code: result.state_code,
                city_id: String(result.city_id),
            }));
        } catch (err) {
            setError(err.message || "Could not find this PIN code.");
        } finally {
            setLookingUpPin(false);
        }
    }

    function selectAccountType(value) {
        setForm((old) => ({
            ...old,
            account_type_id: value,
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
        }));
        setError("");
    }

    async function submit(event) {
        event.preventDefault();
        setError("");

        if (!form.first_name.trim() || !form.last_name.trim()) {
            setError("First name and last name are required.");
            return;
        }
        if (!form.email.trim() || !form.mobile.trim()) {
            setError("Email and mobile number are required.");
            return;
        }
        if (!form.address_line1.trim() || !form.state_code || !form.city_id) {
            setError("Please complete the primary address.");
            return;
        }
        if (!/^\d{6}$/.test(form.pin_code)) {
            setError("PIN code must be exactly 6 digits.");
            return;
        }

        if (isSavings) {
            const balance = Number(form.initial_balance || 0);
            const minimum = Number(form.minimum_balance || 0);

            if (balance < minimum) {
                setError("Initial balance cannot be below the minimum balance.");
                return;
            }
        }

        if (isLoan) {
            if (
                Number(form.loan_amount) <= 0 ||
                Number(form.duration_months) <= 0 ||
                Number(form.interest_rate) < 0
            ) {
                setError("Enter valid loan principal, interest rate and tenure.");
                return;
            }
        }

        try {
            setLoading(true);

            const payload = {
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                email: form.email.trim(),
                mobile: form.mobile.trim(),
                phone: form.phone.trim() || null,
                dob: form.dob || null,
                marital_status: form.marital_status || null,
                city_id: Number(form.city_id),
                state_code: form.state_code,
                pin_code: form.pin_code,
                address_line1: form.address_line1.trim(),
                address_line2: form.address_line2.trim() || null,
                address_type: form.address_type,
                is_primary: 1,
                account_type_id: Number(form.account_type_id),
            };

            if (isSavings) {
                payload.initial_balance = Number(form.initial_balance || 0);
                payload.minimum_balance = Number(form.minimum_balance || 0);
                payload.withdrawal_limit =
                    form.withdrawal_limit === "" ? null : Number(form.withdrawal_limit);
                payload.transfer_limit =
                    form.transfer_limit === "" ? null : Number(form.transfer_limit);
                payload.branch_code = form.branch_code.trim() || null;
            } else {
                payload.loan_amount = Number(form.loan_amount);
                payload.interest_rate = Number(form.interest_rate);
                payload.duration_months = Number(form.duration_months);
                payload.emi_amount =
                    form.emi_amount === "" ? Number(calculatedEmi) : Number(form.emi_amount);
                payload.repayment_start_date = form.repayment_start_date || null;
            }

            const created = await createCustomer(payload);

            showToast("Customer and initial account created successfully.");
            onCreated?.(created);
        } catch (err) {
            setError(err.message || "Failed to create customer.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-120 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
            <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
                <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-7 py-5">
                    <div className="flex items-center gap-4">
                        <div className="rounded-2xl bg-cyan-100 p-3 text-cyan-700">
                            <UserPlus size={22} />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
                                Customer onboarding
                            </p>
                            <h2 className="text-2xl font-bold">Add New Customer</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Create the customer, primary address and first banking account together.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    >
                        <X size={21} />
                    </button>
                </header>

                <form onSubmit={submit} className="overflow-y-auto p-7">
                    {error && (
                        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <Section title="Personal information" icon={UserPlus}>
                        <Field label="First name *">
                            <input required value={form.first_name} onChange={(e) => change("first_name", e.target.value)} />
                        </Field>
                        <Field label="Last name *">
                            <input required value={form.last_name} onChange={(e) => change("last_name", e.target.value)} />
                        </Field>
                        <Field label="Email *">
                            <input type="email" required value={form.email} onChange={(e) => change("email", e.target.value)} />
                        </Field>
                        <Field label="Mobile *">
                            <input required inputMode="numeric" maxLength={10} value={form.mobile} onChange={(e) => change("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} />
                        </Field>
                        <Field label="Phone">
                            <input inputMode="numeric" maxLength={12} value={form.phone} onChange={(e) => change("phone", e.target.value.replace(/\D/g, "").slice(0, 12))} />
                        </Field>
                        <Field label="Date of birth">
                            <input type="date" value={form.dob} onChange={(e) => change("dob", e.target.value)} />
                        </Field>
                        <Field label="Marital status">
                            <select value={form.marital_status} onChange={(e) => change("marital_status", e.target.value)}>
                                <option value="">Select status</option>
                                <option>Single</option>
                                <option>Married</option>
                                <option>Divorced</option>
                                <option>Widowed</option>
                            </select>
                        </Field>
                    </Section>

                    <Section title="Primary address" icon={Landmark}>
                        <div className="md:col-span-2">
                            <Field label="Address line 1 *">
                                <input required value={form.address_line1} onChange={(e) => change("address_line1", e.target.value)} />
                            </Field>
                        </div>
                        <div className="md:col-span-2">
                            <Field label="Address line 2">
                                <input value={form.address_line2} onChange={(e) => change("address_line2", e.target.value)} />
                            </Field>
                        </div>
                        <Field label="State *">
                            <select required value={form.state_code} onChange={(e) => { change("state_code", e.target.value); change("city_id", ""); }}>
                                <option value="">Select state</option>
                                {states.map((state) => (
                                    <option key={state.state_code} value={state.state_code}>
                                        {state.state_name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="City *">
                            <select required disabled={!form.state_code || loadingCities} value={form.city_id} onChange={(e) => change("city_id", e.target.value)}>
                                <option value="">
                                    {loadingCities ? "Loading cities..." : "Select city"}
                                </option>
                                {cities.map((city) => (
                                    <option key={city.city_id} value={city.city_id}>
                                        {city.city_name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="PIN code *">
                            <div className="flex gap-2">
                                <input
                                    required
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={form.pin_code}
                                    placeholder="Enter 6-digit PIN"
                                    onChange={(e) => change("pin_code", e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            fillAddressFromPincode();
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => fillAddressFromPincode()}
                                    disabled={lookingUpPin || form.pin_code.length !== 6}
                                    className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {lookingUpPin ? "Finding..." : "Find"}
                                </button>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">Enter the PIN and press Enter (or Find) to fill state and city automatically.</p>
                        </Field>
                        <Field label="Address type">
                            <select value={form.address_type} onChange={(e) => change("address_type", e.target.value)}>
                                <option>Permanent</option>
                                <option>Current</option>
                                <option>Office</option>
                            </select>
                        </Field>
                    </Section>

                    <section className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-white p-2 text-cyan-700 shadow-sm">
                                    <CreditCard size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">First account</h3>
                                    <p className="text-sm text-slate-500">
                                        Choose the account product and complete its banking details.
                                    </p>
                                </div>
                            </div>

                            <div className="flex rounded-xl bg-white p-1 shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => selectAccountType("1")}
                                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${isSavings ? "bg-cyan-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                                >
                                    Savings
                                </button>
                                <button
                                    type="button"
                                    onClick={() => selectAccountType("2")}
                                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${isLoan ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                                >
                                    Loan
                                </button>
                            </div>
                        </div>

                        {isSavings && (
                            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Field label="Opening balance">
                                    <input type="number" min="0" step="0.01" value={form.initial_balance} onChange={(e) => change("initial_balance", e.target.value)} placeholder="e.g. 50000" />
                                </Field>
                                <Field label="Minimum balance">
                                    <input type="number" min="0" step="0.01" value={form.minimum_balance} onChange={(e) => change("minimum_balance", e.target.value)} placeholder="Minimum balance to maintain" />
                                </Field>
                                <Field label="Withdrawal limit">
                                    <input type="number" min="0" step="0.01" value={form.withdrawal_limit} onChange={(e) => change("withdrawal_limit", e.target.value)} placeholder="Maximum single withdrawal" />
                                </Field>
                                <Field label="Transfer limit">
                                    <input type="number" min="0" step="0.01" value={form.transfer_limit} onChange={(e) => change("transfer_limit", e.target.value)} placeholder="Transfer limit" />
                                </Field>
                                <Field label="Branch code">
                                    <input value={form.branch_code} onChange={(e) => change("branch_code", e.target.value)} placeholder="e.g. BR001" />
                                </Field>
                            </div>
                        )}

                        {isLoan && (
                            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Field label="Principal amount *">
                                    <input type="number" min="1" step="0.01" value={form.loan_amount} onChange={(e) => change("loan_amount", e.target.value)} placeholder="Loan principal" />
                                </Field>
                                <Field label="Interest rate (% p.a.) *">
                                    <input type="number" min="0" step="0.01" value={form.interest_rate} onChange={(e) => change("interest_rate", e.target.value)} placeholder="e.g. 8.5" />
                                </Field>
                                <Field label="Tenure (months) *">
                                    <input type="number" min="1" step="1" value={form.duration_months} onChange={(e) => change("duration_months", e.target.value)} placeholder="e.g. 60" />
                                </Field>
                                <Field label="Repayment start date">
                                    <input type="date" value={form.repayment_start_date} onChange={(e) => change("repayment_start_date", e.target.value)} />
                                </Field>
                                <Field label="EMI amount">
                                    <input type="number" min="0" step="0.01" value={form.emi_amount || calculatedEmi} onChange={(e) => change("emi_amount", e.target.value)} placeholder={calculatedEmi || "Calculated automatically"} />
                                </Field>

                                {calculatedEmi && (
                                    <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm">
                                        <CalendarDays size={18} className="text-indigo-600" />
                                        <div>
                                            <p className="font-semibold text-slate-800">Estimated monthly EMI</p>
                                            <p className="text-indigo-700">₹{Number(calculatedEmi).toLocaleString("en-IN")}</p>
                                        </div>
                                    </div>
                                )}

                                {installmentPreview.length > 0 && (
                                    <div className="md:col-span-2 rounded-2xl border border-indigo-200 bg-white p-4">
                                        <p className="font-semibold text-slate-800">Installment schedule preview</p>
                                        <p className="mt-1 text-xs text-slate-500">The first six monthly installments are shown below. The full schedule follows the selected tenure.</p>
                                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                            {installmentPreview.map((item) => (
                                                <div key={item.number} className="rounded-xl bg-indigo-50 px-3 py-2 text-sm">
                                                    <span className="font-bold text-indigo-700">#{item.number}</span>
                                                    <span className="ml-2 text-slate-600">{item.date}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {Number(form.duration_months) > 6 && (
                                            <p className="mt-3 text-xs font-medium text-indigo-700">
                                                + {Number(form.duration_months) - 6} more monthly installments
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    <div className="mt-7 flex justify-end gap-3 border-t border-slate-200 pt-5">
                        <button type="button" onClick={onClose} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading || loadingCities} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-50">
                            {loading ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                            Create Customer
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Section({ title, icon: Icon, children }) {
    return (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                    <Icon size={18} />
                </div>
                <h3 className="font-bold text-slate-900">{title}</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {children}
            </div>
        </section>
    );
}

function Field({ label, children }) {
    return (
        <label className="block text-sm font-medium text-slate-600">
            {label}
            <span className="mt-2 block [&_input]:h-11 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-200 [&_input]:bg-slate-50 [&_input]:px-3 [&_input]:text-slate-900 [&_input]:outline-none [&_input]:focus:border-cyan-500 [&_input]:focus:ring-2 [&_input]:focus:ring-cyan-100 [&_select]:h-11 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-slate-200 [&_select]:bg-slate-50 [&_select]:px-3 [&_select]:text-slate-900 [&_select]:outline-none [&_select]:focus:border-cyan-500">
                {children}
            </span>
        </label>
    );
}

export default CreateCustomerModal;

