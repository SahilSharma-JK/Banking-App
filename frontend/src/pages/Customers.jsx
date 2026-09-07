import { ArrowLeft, Plus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import CustomerSearch from "../components/CustomerSearch";
import CustomerDetailsModal from "../components/CustomerDetailsModal";
import CustomerEditModal from "../components/CustomerEditModal";
import CreateCustomerModal from "../components/CreateCustomerModal";
import {
    getCustomerById,
    getCustomerCount,
    searchCustomers,
} from "../services/customerService";
import { showToast } from "../components/Toast";

function Customers() {
    const navigate = useNavigate();
    const [customerCount, setCustomerCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchedCustomer, setSearchedCustomer] = useState(null);
    const [searchResults, setSearchResults] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [creating, setCreating] = useState(false);

    async function loadCount() {
        try {
            setLoading(true);
            setCustomerCount(Number(await getCustomerCount()) || 0);
        } catch (err) {
            setError(err.message || "Failed to load customer count.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadCount();
    }, []);

    async function handleSearch(value, prefetchedResults = null, options = {}) {
        const term = String(value || "").trim();
        setError("");
        setSearchedCustomer(null);
        setSearchResults(null);

        if (!term) {
            setError("Enter a Customer ID, name, customer number or account number.");
            return;
        }

        try {
            // If the search box already fetched live suggestions, reuse those
            // rows instead of sending the same query a second time on Enter.
            if (Array.isArray(prefetchedResults)) {
                if (options.selectSingle && prefetchedResults.length === 1) {
                    setSearchedCustomer(prefetchedResults[0]);
                    setSearchResults(null);
                } else {
                    setSearchResults(prefetchedResults);
                }
                return;
            }

            // Full accounts/address/EMI data is fetched only when View is clicked.
            const results = await searchCustomers({ search: term });
            setSearchResults(Array.isArray(results) ? results : []);
        } catch (err) {
            setError(err.message || "Customer search failed.");
        }
    }

    const handleSuggest = useCallback(async (value) => {
        const term = String(value || "").trim();
        if (term.length < 2) return [];

        try {
            const results = await searchCustomers({ search: term, suggest: true });
            return Array.isArray(results) ? results : [];
        } catch {
            return [];
        }
    }, []);

    async function handleAdvancedSearch(filters) {
        const hasFilter = Object.values(filters || {}).some((value) => String(value || "").trim());
        setError("");
        setSearchedCustomer(null);
        setSearchResults(null);

        if (!hasFilter) {
            setError("Enter at least one field for advanced search.");
            return;
        }

        try {
            const results = await searchCustomers(filters);
            setSearchResults(Array.isArray(results) ? results : []);
        } catch (err) {
            setError(err.message || "Advanced customer search failed.");
        }
    }

    function clearSearch() {
        setSearchedCustomer(null);
        setSearchResults(null);
        setError("");
    }

    async function viewCustomer(customer) {
        try {
            setSelectedCustomer(await getCustomerById(customer.customer_id));
        } catch (err) {
            showToast(err.message || "Failed to load customer.", "error");
        }
    }

    function customerSaved(updated) {
        setSearchedCustomer(updated);
        setSearchResults(null);
        setEditingCustomer({ customer_id: updated.customer_id });
        loadCount();
    }

    function customerCreated(created) {
        setCreating(false);
        clearSearch();
        loadCount();
        setSelectedCustomer(created);
    }

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
                        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-cyan-700">ZENbank · Customer administration</p>
                        <h1 className="text-4xl font-bold tracking-tight text-slate-950">Customers</h1>
                        <p className="mt-2 text-slate-500">
                            Search a customer first, then view or edit the selected profile.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                            <Users size={18} className="text-cyan-700" />
                            <span className="text-sm text-slate-500">Total Customers</span>
                            <span className="font-bold text-slate-900">{loading ? "..." : customerCount}</span>
                        </div>
                        <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-cyan-700">
                            <Plus size={17} /> Add New Customer
                        </button>
                    </div>
                </section>

                {error && (
                    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                )}

                <CustomerSearch
                    searchedCustomer={searchedCustomer}
                    searchResults={searchResults}
                    onSearch={handleSearch}
                    onSuggest={handleSuggest}
                    onAdvancedSearch={handleAdvancedSearch}
                    onClear={clearSearch}
                    onView={viewCustomer}
                    onEdit={(customer) => setEditingCustomer(customer)}
                />

                {!searchedCustomer && searchResults === null && (
                    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
                        <Users size={36} className="mx-auto text-slate-300" />
                        <h2 className="mt-4 font-bold text-slate-700">Search to view customer records</h2>
                        <p className="mt-2 text-sm text-slate-500">
                            The full customer directory stays hidden until you search.
                        </p>
                    </section>
                )}

                {selectedCustomer && (
                    <CustomerDetailsModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
                )}

                {editingCustomer && (
                    <CustomerEditModal
                        customerId={editingCustomer.customer_id}
                        isOpen={true}
                        onClose={() => setEditingCustomer(null)}
                        onSaved={customerSaved}
                    />
                )}

                {creating && (
                    <CreateCustomerModal
                        onClose={() => setCreating(false)}
                        onCreated={customerCreated}
                    />
                )}
            </main>
        </div>
    );
}

export default Customers;







