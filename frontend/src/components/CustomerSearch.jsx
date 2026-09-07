import { Eye, Pencil, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function CustomerSearch({
    searchedCustomer,
    searchResults,
    onSearch,
    onSuggest,
    onAdvancedSearch,
    onClear,
    onView,
    onEdit,
}) {
    const [value, setValue] = useState("");
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const requestId = useRef(0);
    const [advanced, setAdvanced] = useState({
        customer_id: "",
        customer_number: "",
        name: "",
        email: "",
        mobile: "",
        phone: "",
        account_number: "",
        address: "",
    });

    useEffect(() => {
        const term = value.trim();
        if (term.length < 2 || !onSuggest) {
            setSuggestions([]);
            setSuggestLoading(false);
            return undefined;
        }

        const id = ++requestId.current;
        const timer = setTimeout(async () => {
            setSuggestLoading(true);
            const results = await onSuggest(term);
            if (id === requestId.current) {
                setSuggestions(Array.isArray(results) ? results : []);
                setSuggestLoading(false);
            }
        }, 140);

        return () => clearTimeout(timer);
    }, [value, onSuggest]);

    async function submit(event) {
        event.preventDefault();
        const term = value.trim();

        // Reuse live suggestions when they are already available. If the
        // operator presses Enter before the debounce request finishes, make
        // exactly one suggestion request and pass its result to the parent.
        if (suggestions.length > 0) {
            onSearch(term, suggestions, { selectSingle: suggestions.length === 1 });
            return;
        }

        if (term.length >= 2 && onSuggest) {
            setSuggestLoading(true);
            const results = await onSuggest(term);
            setSuggestions(Array.isArray(results) ? results : []);
            setSuggestLoading(false);
            const finalResults = Array.isArray(results) ? results : [];
            onSearch(term, finalResults, { selectSingle: finalResults.length === 1 });
            return;
        }

        onSearch(term);
    }

    function chooseSuggestion(customer) {
        setValue(customer.customer_number || String(customer.customer_id));
        setSuggestions([]);
        onSearch(customer.customer_number || String(customer.customer_id), [customer], { selectSingle: true });
    }

    function changeAdvanced(name, fieldValue) {
        setAdvanced((old) => ({ ...old, [name]: fieldValue }));
    }

    function submitAdvanced(event) {
        event.preventDefault();
        onAdvancedSearch?.(advanced);
    }

    function clear() {
        setValue("");
        setAdvanced({
            customer_id: "",
            customer_number: "",
            name: "",
            email: "",
            mobile: "",
            phone: "",
            account_number: "",
            address: "",
        });
        setSuggestions([]);
        onClear();
    }

    const advancedCount = Object.values(advanced).filter((item) => String(item).trim()).length;

    return (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">Find a customer</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">Customer Search</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Quick search by Customer ID, name, customer number or account number.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setAdvancedOpen((old) => !old)}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${advancedOpen || advancedCount ? "border-cyan-200 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                    <SlidersHorizontal size={16} />
                    {advancedOpen ? "Hide advanced search" : "Advanced search"}
                    {advancedCount > 0 && <span className="rounded-full bg-cyan-600 px-2 py-0.5 text-xs text-white">{advancedCount}</span>}
                </button>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        placeholder="e.g. 1, Your Name, CUS... or ACC..."
                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                    />
                    {value && (
                        <button type="button" onClick={() => setValue("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                            <X size={16} />
                        </button>
                    )}
                </div>
                <button type="submit" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 text-sm font-bold text-white hover:bg-cyan-700">
                    <Search size={17} />
                    Search
                </button>
                {(searchedCustomer || searchResults) && (
                    <button type="button" onClick={clear} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                        <X size={16} />
                        Clear
                    </button>
                )}
            </form>

            {value.trim().length >= 2 && (suggestLoading || suggestions.length > 0) && (
                <div className="relative z-20">
                    <div className="absolute left-0 right-0 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                        {suggestLoading ? (
                            <div className="px-4 py-3 text-sm text-slate-500">Finding matching customers...</div>
                        ) : (
                            suggestions.map((customer) => (
                                <button
                                    key={customer.customer_id}
                                    type="button"
                                    onClick={() => chooseSuggestion(customer)}
                                    className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-cyan-50"
                                >
                                    <span>
                                        <span className="block font-semibold text-slate-900">
                                            {customer.first_name} {customer.last_name}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            Customer ID {customer.customer_id} · {customer.customer_number}
                                        </span>
                                    </span>
                                    <span className="text-xs font-semibold text-cyan-700">Select</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            {advancedOpen && (
                <form onSubmit={submitAdvanced} className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-4">
                    <div className="mb-4">
                        <p className="text-sm font-bold text-slate-800">Advanced customer search</p>
                        <p className="mt-1 text-xs text-slate-500">Use one or more fields together. Matching fields are applied together.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <AdvancedField label="Customer ID"><input value={advanced.customer_id} onChange={(e) => changeAdvanced("customer_id", e.target.value.replace(/\D/g, ""))} placeholder="e.g. 1" /></AdvancedField>
                        <AdvancedField label="Customer number"><input value={advanced.customer_number} onChange={(e) => changeAdvanced("customer_number", e.target.value)} placeholder="CUS..." /></AdvancedField>
                        <AdvancedField label="Name"><input value={advanced.name} onChange={(e) => changeAdvanced("name", e.target.value)} placeholder="Name" /></AdvancedField>
                        <AdvancedField label="Email"><input value={advanced.email} onChange={(e) => changeAdvanced("email", e.target.value)} placeholder="name@email.com" /></AdvancedField>
                        <AdvancedField label="Mobile"><input value={advanced.mobile} onChange={(e) => changeAdvanced("mobile", e.target.value)} placeholder="Mobile number" /></AdvancedField>
                        <AdvancedField label="Phone"><input value={advanced.phone} onChange={(e) => changeAdvanced("phone", e.target.value)} placeholder="Phone number" /></AdvancedField>
                        <AdvancedField label="Account number"><input value={advanced.account_number} onChange={(e) => changeAdvanced("account_number", e.target.value)} placeholder="ACC..." /></AdvancedField>
                        <AdvancedField label="Address"><input value={advanced.address} onChange={(e) => changeAdvanced("address", e.target.value)} placeholder="City, state, PIN, street..." /></AdvancedField>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                        <button type="button" onClick={() => setAdvanced((old) => Object.fromEntries(Object.keys(old).map((key) => [key, ""])))} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Reset fields</button>
                        <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-700"><Search size={16} /> Search advanced</button>
                    </div>
                </form>
            )}

            {searchedCustomer && <ResultCard customer={searchedCustomer} onView={onView} onEdit={onEdit} />}

            {!searchedCustomer && Array.isArray(searchResults) && searchResults.length > 0 && (
                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">Matching customers ({searchResults.length})</div>
                    {searchResults.map((customer) => <ResultCard key={customer.customer_id} customer={customer} onView={onView} onEdit={onEdit} compact />)}
                </div>
            )}

            {!searchedCustomer && Array.isArray(searchResults) && searchResults.length === 0 && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">No customer matched your search.</div>
            )}
        </section>
    );
}

function AdvancedField({ label, children }) {
    return (
        <label className="block text-xs font-bold text-slate-600">
            {label}
            <span className="mt-1.5 block [&_input]:h-10 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-slate-200 [&_input]:bg-white [&_input]:px-3 [&_input]:text-sm [&_input]:font-normal [&_input]:text-slate-900 [&_input]:outline-none [&_input]:focus:border-cyan-500 [&_input]:focus:ring-2 [&_input]:focus:ring-cyan-100">{children}</span>
        </label>
    );
}

function ResultCard({ customer, onView, onEdit, compact }) {
    return (
        <div className={`flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between ${compact ? "border-b border-slate-100 last:border-b-0" : "mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/50"}`}>
            <div>
                <p className="font-bold text-slate-900">{customer.first_name} {customer.last_name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>Customer ID: {customer.customer_id} · {customer.customer_number}</span>
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${String(customer.customer_status || "Active") === "Closed"
                        ? "bg-red-100 text-red-700"
                        : "bg-emerald-100 text-emerald-700"
                        }`}>
                        {customer.customer_status || "Active"}
                    </span>
                </div>
                {customer.email && <p className="mt-1 text-xs text-slate-500">{customer.email}</p>}
            </div>
            <div className="flex gap-2">
                <button type="button" onClick={() => onView(customer)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:border-cyan-200 hover:text-cyan-700"><Eye size={15} /> View</button>
                <button type="button" onClick={() => onEdit(customer)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:border-amber-200 hover:text-amber-700"><Pencil size={15} /> Edit</button>
            </div>
        </div>
    );
}

export default CustomerSearch;

