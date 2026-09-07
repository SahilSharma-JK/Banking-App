import {
    CheckCircle2,
    CreditCard,
    Loader2,
    MapPin,
    Plus,
    Save,
    Trash2,
    UserRound,
    X,
    Pencil,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
    addCustomerAddress,
    deleteCustomerAddress,
    getCustomerById,
    getStates,
    getCitiesByState,
    updateCustomer,
    setCustomerStatus,
    updateCustomerAddress,
    lookupPincode,
} from "../services/customerService";
import { showToast } from "./Toast";
import AccountEditModal from "./AccountEditModal";
import AddCustomerAccountModal from "./AddCustomerAccountModal";

const emptyAddress = {
    address_id: null,
    address_line1: "",
    address_line2: "",
    address_type: "Permanent",
    state_code: "",
    city_id: "",
    pin_code: "",
    is_primary: false,
};

function CustomerEditModal({ customerId, isOpen, onClose, onSaved }) {
    const [customer, setCustomer] = useState(null);
    const [form, setForm] = useState({});
    const [addresses, setAddresses] = useState([]);
    const [states, setStates] = useState([]);
    const [cities, setCities] = useState([]);
    const [addressForm, setAddressForm] = useState(emptyAddress);
    const [addressMode, setAddressMode] = useState(null);
    const [accountToEdit, setAccountToEdit] = useState(null);
    const [addAccountOpen, setAddAccountOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingAddress, setSavingAddress] = useState(false);
    const [lookingUpPin, setLookingUpPin] = useState(false);
    const [error, setError] = useState("");

    const customerClosed = String(customer?.customer_status || "Active") === "Closed";

    useEffect(() => {
        if (!isOpen || !customerId) return;

        async function load() {
            try {
                setLoading(true);
                setError("");
                const [data, stateData] = await Promise.all([
                    getCustomerById(customerId),
                    getStates(),
                ]);

                setCustomer(data);
                setForm({
                    first_name: data.first_name || "",
                    last_name: data.last_name || "",
                    email: data.email || "",
                    phone: data.phone || "",
                    mobile: data.mobile || "",
                    dob: data.dob ? String(data.dob).split("T")[0] : "",
                    marital_status: data.marital_status || "",
                });
                setAddresses(Array.isArray(data.addresses) ? data.addresses : []);
                setStates(stateData || []);
            } catch (err) {
                setError(err.message || "Failed to load customer.");
            } finally {
                setLoading(false);
            }
        }

        load();
    }, [customerId, isOpen]);

    useEffect(() => {
        if (!addressForm.state_code) {
            setCities([]);
            return;
        }

        async function loadCities() {
            try {
                setCities(await getCitiesByState(addressForm.state_code));
            } catch (err) {
                setError(err.message || "Failed to load cities.");
            }
        }

        loadCities();
    }, [addressForm.state_code]);

    if (!isOpen) return null;

    function change(name, value) {
        setForm((old) => ({ ...old, [name]: value }));
        setError("");
    }

    async function saveCustomer(event) {
        event.preventDefault();

        try {
            setSaving(true);
            setError("");
            const updated = await updateCustomer(customerId, form);
            setCustomer(updated);
            setAddresses(updated.addresses || []);
            onSaved?.(updated);
            showToast("Customer information updated.");
        } catch (err) {
            setError(err.message || "Failed to update customer.");
        } finally {
            setSaving(false);
        }
    }

    async function changeCustomerStatus() {
        const nextStatus = customerClosed ? "Active" : "Closed";
        const action = customerClosed ? "reactivate" : "close";
        const confirmed = window.confirm(
            customerClosed
                ? `Reactivate ${customer?.first_name || "this customer"}?`
                : `Close ${customer?.first_name || "this customer"} ${customer?.last_name || ""}? Their banking and transaction history will be retained, but normal banking operations will be disabled.`
        );

        if (!confirmed) return;

        try {
            setSaving(true);
            setError("");
            const updated = await setCustomerStatus(customerId, nextStatus);
            setCustomer(updated);
            setAddresses(updated.addresses || []);
            onSaved?.(updated);
            showToast(
                action === "close"
                    ? "Customer closed. Historical records were retained."
                    : "Customer reactivated."
            );
        } catch (err) {
            setError(err.message || `Failed to ${action} customer.`);
        } finally {
            setSaving(false);
        }
    }

    function openAddAddress() {
        setAddressForm({ ...emptyAddress, is_primary: addresses.length === 0 });
        setAddressMode("add");
        setError("");
    }

    function openEditAddress(address) {
        setAddressForm({
            ...emptyAddress,
            ...address,
            state_code: address.state_code || "",
            city_id: address.city_id || "",
            pin_code: address.pin_code || "",
            is_primary: Number(address.is_primary) === 1 || address.is_primary === true,
        });
        setAddressMode("edit");
        setError("");
    }

    async function fillAddressFromPincode(value = addressForm.pin_code) {
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
            setAddressForm((old) => ({
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

    async function saveAddress(event) {
        event.preventDefault();

        if (!addressForm.city_id || !addressForm.address_line1.trim() || !/^\d{6}$/.test(addressForm.pin_code)) {
            setError("Complete address line, city and a valid 6-digit PIN.");
            return;
        }

        try {
            setSavingAddress(true);
            let updated;

            const payload = {
                city_id: Number(addressForm.city_id),
                state_code: addressForm.state_code,
                pin_code: addressForm.pin_code,
                address_line1: addressForm.address_line1.trim(),
                address_line2: addressForm.address_line2.trim() || null,
                address_type: addressForm.address_type,
                is_primary: addressForm.is_primary ? 1 : 0,
            };

            if (addressMode === "edit") {
                updated = await updateCustomerAddress(customerId, addressForm.address_id, payload);
            } else {
                updated = await addCustomerAddress(customerId, payload);
            }

            setCustomer(updated);
            setAddresses(updated.addresses || []);
            setAddressMode(null);
            setAddressForm(emptyAddress);
            onSaved?.(updated);
            showToast(addressMode === "edit" ? "Address updated." : "Address added.");
        } catch (err) {
            setError(err.message || "Failed to save address.");
        } finally {
            setSavingAddress(false);
        }
    }

    async function removeAddress(address) {
        if (!window.confirm("Delete this address?")) return;

        try {
            const updated = await deleteCustomerAddress(customerId, address.address_id);
            setCustomer(updated);
            setAddresses(updated.addresses || []);
            onSaved?.(updated);
            showToast("Address deleted.");
        } catch (err) {
            setError(err.message || "Failed to delete address.");
        }
    }

    function accountUpdated(updated) {
        setCustomer(updated);
        onSaved?.(updated);
        setAccountToEdit(null);
    }

    function accountAdded(updated) {
        setCustomer(updated);
        onSaved?.(updated);
        setAddAccountOpen(false);
        showToast("New account added to customer.");
    }

    return (
        <>
            <div className="fixed inset-0 z-110 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
                <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
                    <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-7 py-5">
                        <div className="flex items-center gap-4">
                            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><Pencil size={21} /></div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Edit mode</p>
                                <h2 className="text-2xl font-bold">Edit Customer</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Customer ID: {customerId}. All customer, address and account changes are editable here.
                                </p>
                            </div>
                        </div>
                        <button type="button" onClick={onClose} disabled={saving || savingAddress} className="rounded-xl p-2 text-slate-400 hover:bg-slate-200"><X size={21} /></button>
                    </header>

                    <div className="overflow-y-auto p-7">
                        {error && (
                            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                        )}

                        {loading ? (
                            <div className="py-16 text-center text-slate-500">Loading customer...</div>
                        ) : (
                            <>
                                <form onSubmit={saveCustomer} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-xl bg-slate-100 p-2 text-slate-700"><UserRound size={18} /></div>
                                            <div>
                                                <h3 className="font-bold">Customer information</h3>
                                                <p className="text-xs text-slate-500">
                                                    Status: <span className={customerClosed ? "font-bold text-red-600" : "font-bold text-emerald-600"}>
                                                        {customerClosed ? "Closed" : "Active"}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={changeCustomerStatus}
                                            disabled={saving}
                                            className={customerClosed
                                                ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
                                                : "rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"}
                                        >
                                            {customerClosed ? "Reactivate customer" : "Close customer"}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        <Field label="First name"><input disabled={customerClosed} value={form.first_name || ""} onChange={(e) => change("first_name", e.target.value)} /></Field>
                                        <Field label="Last name"><input disabled={customerClosed} value={form.last_name || ""} onChange={(e) => change("last_name", e.target.value)} /></Field>
                                        <Field label="Email"><input disabled={customerClosed} type="email" value={form.email || ""} onChange={(e) => change("email", e.target.value)} /></Field>
                                        <Field label="Mobile"><input disabled={customerClosed} value={form.mobile || ""} onChange={(e) => change("mobile", e.target.value)} /></Field>
                                        <Field label="Phone"><input disabled={customerClosed} value={form.phone || ""} onChange={(e) => change("phone", e.target.value)} /></Field>
                                        <Field label="Date of birth"><input disabled={customerClosed} type="date" value={form.dob || ""} onChange={(e) => change("dob", e.target.value)} /></Field>
                                        <Field label="Marital status">
                                            <select disabled={customerClosed} value={form.marital_status || ""} onChange={(e) => change("marital_status", e.target.value)}>
                                                <option value="">Select status</option>
                                                <option>Single</option>
                                                <option>Married</option>
                                                <option>Divorced</option>
                                                <option>Widowed</option>
                                            </select>
                                        </Field>
                                    </div>

                                    <div className="mt-5 flex justify-end">
                                        <button type="submit" disabled={saving || customerClosed} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-50">
                                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                            Save customer
                                        </button>
                                    </div>
                                </form>

                                <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="mb-4 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-xl bg-slate-100 p-2 text-slate-700"><MapPin size={18} /></div>
                                            <div>
                                                <h3 className="font-bold">Addresses</h3>
                                                <p className="text-sm text-slate-500">Add, edit or delete customer addresses.</p>
                                            </div>
                                        </div>
                                        <button type="button" onClick={openAddAddress} disabled={customerClosed} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                                            <Plus size={16} /> Add address
                                        </button>
                                    </div>

                                    {addressMode && (
                                        <form onSubmit={saveAddress} className="mb-5 rounded-2xl border border-cyan-200 bg-cyan-50/50 p-5">
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <Field label="Address line 1"><input required value={addressForm.address_line1} onChange={(e) => setAddressForm((o) => ({ ...o, address_line1: e.target.value }))} /></Field>
                                                <Field label="Address line 2"><input value={addressForm.address_line2} onChange={(e) => setAddressForm((o) => ({ ...o, address_line2: e.target.value }))} /></Field>
                                                <Field label="State">
                                                    <select value={addressForm.state_code} onChange={(e) => setAddressForm((o) => ({ ...o, state_code: e.target.value, city_id: "" }))}>
                                                        <option value="">Select state</option>
                                                        {states.map((state) => <option key={state.state_code} value={state.state_code}>{state.state_name}</option>)}
                                                    </select>
                                                </Field>
                                                <Field label="City">
                                                    <select value={addressForm.city_id} disabled={!addressForm.state_code} onChange={(e) => setAddressForm((o) => ({ ...o, city_id: e.target.value }))}>
                                                        <option value="">Select city</option>
                                                        {cities.map((city) => <option key={city.city_id} value={city.city_id}>{city.city_name}</option>)}
                                                    </select>
                                                </Field>
                                                <Field label="PIN code">
                                                    <div className="flex gap-2">
                                                        <input
                                                            inputMode="numeric"
                                                            maxLength={6}
                                                            value={addressForm.pin_code}
                                                            placeholder="Enter 6-digit PIN"
                                                            onChange={(e) => setAddressForm((o) => ({ ...o, pin_code: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
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
                                                            disabled={lookingUpPin || addressForm.pin_code.length !== 6}
                                                            className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {lookingUpPin ? "Finding..." : "Find"}
                                                        </button>
                                                    </div>
                                                </Field>
                                                <Field label="Address type">
                                                    <select value={addressForm.address_type} onChange={(e) => setAddressForm((o) => ({ ...o, address_type: e.target.value }))}>
                                                        <option>Permanent</option>
                                                        <option>Current</option>
                                                        <option>Office</option>
                                                    </select>
                                                </Field>
                                            </div>
                                            <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                                                <input type="checkbox" checked={addressForm.is_primary} onChange={(e) => setAddressForm((o) => ({ ...o, is_primary: e.target.checked }))} />
                                                Make primary address
                                            </label>
                                            <div className="mt-4 flex justify-end gap-2">
                                                <button type="button" onClick={() => setAddressMode(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
                                                <button type="submit" disabled={savingAddress} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white">
                                                    {savingAddress ? "Saving..." : "Save address"}
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    <div className="space-y-3">
                                        {addresses.length === 0 ? (
                                            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No addresses.</p>
                                        ) : addresses.map((address) => (
                                            <div key={address.address_id} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold">{address.address_type || "Address"}</p>
                                                        {Number(address.is_primary) === 1 && <span className="rounded-full bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-700">Primary</span>}
                                                    </div>
                                                    <p className="mt-2 text-sm leading-6 text-slate-600">
                                                        {address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ""}
                                                        <br />{address.city_name}, {address.state_name || address.state_code} · PIN {address.pin_code}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button type="button" onClick={() => openEditAddress(address)} disabled={customerClosed} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-cyan-700"><Pencil size={16} /></button>
                                                    <button type="button" onClick={() => removeAddress(address)} disabled={customerClosed} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-red-600"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-xl bg-cyan-100 p-2 text-cyan-700"><CreditCard size={18} /></div>
                                            <div>
                                                <h3 className="font-bold">Accounts</h3>
                                                <p className="text-sm text-slate-500">Edit existing accounts or open another Savings/Loan account.</p>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setAddAccountOpen(true)} disabled={customerClosed} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-700">
                                            <Plus size={16} /> Add account
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {(customer?.accounts || []).map((account) => (
                                            <div key={account.account_id} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                    <p className="font-semibold">{account.account_number}</p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        Account ID: {account.account_id} · Customer ID: {account.customer_id} · {account.account_type}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <p className="font-bold">₹{money(account.balance)}</p>
                                                        <p className="text-xs text-slate-500">{account.account_status}</p>
                                                    </div>
                                                    <button type="button" onClick={() => setAccountToEdit(account)} disabled={customerClosed} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-amber-600">
                                                        <Pencil size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                    <CheckCircle2 size={17} />
                                    Edit mode allows changes to customer details, addresses and account configurations.
                                </div>
                            </>
                        )}
                    </div>

                    <footer className="flex justify-end border-t border-slate-200 bg-slate-50 px-7 py-4">
                        <button type="button" onClick={onClose} disabled={saving || savingAddress} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                            Close
                        </button>
                    </footer>
                </div>
            </div>

            {accountToEdit && (
                <AccountEditModal
                    account={accountToEdit}
                    onClose={() => setAccountToEdit(null)}
                    onUpdated={accountUpdated}
                />
            )}

            {addAccountOpen && (
                <AddCustomerAccountModal
                    customerId={customerId}
                    onClose={() => setAddAccountOpen(false)}
                    onAdded={accountAdded}
                />
            )}
        </>
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

function money(value) {
    return Number(value || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default CustomerEditModal;


