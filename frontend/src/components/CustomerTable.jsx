import {
    Users,
    Mail,
    Phone,
    Calendar,
    UserRound,
    Eye,
    Pencil,
} from "lucide-react";

import { useEffect, useState } from "react";

import CustomerEditModal from "./CustomerEditModal";


function CustomerTable({
    customers,
    loading,
    error,
    formatDateOfBirth,
    onView,
}) {

    // Keep local copy so edited customer
    // updates immediately in the search result.
    const [localCustomers, setLocalCustomers] =
        useState(customers || []);


    const [editingCustomer, setEditingCustomer] =
        useState(null);


    // Whenever search results change,
    // update local table data.
    useEffect(() => {

        setLocalCustomers(
            customers || []
        );

    }, [customers]);


    // ============================================================
    // Customer successfully updated
    // ============================================================

    function handleCustomerUpdated(
        updatedCustomer
    ) {

        setLocalCustomers((previous) =>
            previous.map((customer) =>
                customer.customer_id ===
                    updatedCustomer.customer_id
                    ? {
                        ...customer,
                        ...updatedCustomer
                    }
                    : customer
            )
        );


        setEditingCustomer(null);
    }


    return (

        <>

            <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">


                {/* ==================================================
                    HEADER
                ================================================== */}

                <div className="border-b border-white/10 p-6">

                    <div className="flex items-center gap-3">

                        <div className="rounded-lg bg-cyan-400/10 p-2 text-cyan-400">

                            <Users size={19} />

                        </div>


                        <div>

                            <h2 className="text-xl font-semibold">
                                Customer Results
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Customers matching your search
                            </p>

                        </div>

                    </div>

                </div>


                {/* ==================================================
                    LOADING
                ================================================== */}

                {loading && (

                    <div className="p-10 text-center text-slate-400">
                        Searching customers...
                    </div>

                )}


                {/* ==================================================
                    ERROR
                ================================================== */}

                {!loading && error && (

                    <div className="p-10 text-center">

                        <p className="text-red-400">
                            {error}
                        </p>

                    </div>

                )}


                {/* ==================================================
                    EMPTY
                ================================================== */}

                {!loading &&
                    !error &&
                    localCustomers.length === 0 && (

                        <div className="p-10 text-center">

                            <Users
                                size={32}
                                className="mx-auto text-slate-600"
                            />

                            <p className="mt-3 text-slate-400">
                                No customers found.
                            </p>

                        </div>

                    )}


                {/* ==================================================
                    TABLE
                ================================================== */}

                {!loading &&
                    !error &&
                    localCustomers.length > 0 && (

                        <div className="overflow-x-auto">

                            <table className="w-full text-left">

                                <thead className="text-sm text-slate-500">

                                    <tr className="border-b border-white/10">

                                        <th className="px-6 py-4 font-medium">
                                            Customer
                                        </th>

                                        <th className="px-6 py-4 font-medium">
                                            Email
                                        </th>

                                        <th className="px-6 py-4 font-medium">
                                            Phone
                                        </th>

                                        <th className="px-6 py-4 font-medium">
                                            Date of Birth
                                        </th>

                                        <th className="px-6 py-4 font-medium">
                                            Marital Status
                                        </th>

                                        <th className="px-6 py-4 text-right font-medium">
                                            Actions
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    {localCustomers.map(
                                        (customer) => (

                                            <tr
                                                key={
                                                    customer.customer_id
                                                }
                                                className="border-b border-white/5 transition hover:bg-white/3"
                                            >


                                                {/* Customer */}

                                                <td className="px-6 py-5">

                                                    <div className="flex items-center gap-3">

                                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-400">

                                                            <UserRound size={18} />

                                                        </div>


                                                        <div>

                                                            <p className="font-medium">

                                                                {
                                                                    customer.first_name
                                                                }{" "}

                                                                {
                                                                    customer.last_name
                                                                }

                                                            </p>


                                                            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                                                <span>
                                                                    Customer ID: {customer.customer_id}
                                                                </span>
                                                                <span className={`rounded-full px-2 py-0.5 font-semibold ${String(customer.customer_status || "Active") === "Closed"
                                                                        ? "bg-red-100 text-red-700"
                                                                        : "bg-emerald-100 text-emerald-700"
                                                                    }`}>
                                                                    {customer.customer_status || "Active"}
                                                                </span>
                                                            </div>

                                                        </div>

                                                    </div>

                                                </td>


                                                {/* Email */}

                                                <td className="px-6 py-5">

                                                    <div className="flex items-center gap-2 text-slate-300">

                                                        <Mail
                                                            size={16}
                                                            className="text-slate-500"
                                                        />

                                                        <span>
                                                            {
                                                                customer.email ||
                                                                "N/A"
                                                            }
                                                        </span>

                                                    </div>

                                                </td>


                                                {/* Phone */}

                                                <td className="px-6 py-5">

                                                    <div className="flex items-center gap-2 text-slate-300">

                                                        <Phone
                                                            size={16}
                                                            className="text-slate-500"
                                                        />

                                                        <span>
                                                            {
                                                                customer.mobile ||
                                                                customer.phone ||
                                                                "N/A"
                                                            }
                                                        </span>

                                                    </div>

                                                </td>


                                                {/* DOB */}

                                                <td className="px-6 py-5">

                                                    <div className="flex items-center gap-2 text-slate-300">

                                                        <Calendar
                                                            size={16}
                                                            className="text-slate-500"
                                                        />

                                                        <span>
                                                            {
                                                                formatDateOfBirth(
                                                                    customer.dob
                                                                )
                                                            }
                                                        </span>

                                                    </div>

                                                </td>


                                                {/* Marital status */}

                                                <td className="px-6 py-5">

                                                    <span className="rounded-full bg-violet-400/10 px-3 py-1 text-xs font-medium text-violet-400">

                                                        {
                                                            customer.marital_status ||
                                                            "N/A"
                                                        }

                                                    </span>

                                                </td>


                                                {/* Actions */}

                                                <td className="px-6 py-5">

                                                    <div className="flex justify-end gap-2">


                                                        {/* VIEW */}

                                                        <button
                                                            type="button"
                                                            title="View customer"
                                                            onClick={() =>
                                                                onView(
                                                                    customer
                                                                )
                                                            }
                                                            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-400"
                                                        >

                                                            <Eye size={17} />

                                                        </button>


                                                        {/* EDIT */}

                                                        <button
                                                            type="button"
                                                            title="Edit customer"
                                                            onClick={() =>
                                                                setEditingCustomer(
                                                                    customer
                                                                )
                                                            }
                                                            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-400"
                                                        >

                                                            <Pencil size={17} />

                                                        </button>

                                                    </div>

                                                </td>

                                            </tr>

                                        )
                                    )}

                                </tbody>

                            </table>

                        </div>

                    )}

            </section>


            {/* ======================================================
                EDIT CUSTOMER MODAL
            ====================================================== */}

            <CustomerEditModal
                customer={editingCustomer}
                onClose={() =>
                    setEditingCustomer(null)
                }
                onUpdated={
                    handleCustomerUpdated
                }
            />

        </>
    );
}


export default CustomerTable;
