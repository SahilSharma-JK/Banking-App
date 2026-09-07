import {
    Search,
    X,
    ArrowLeft,
} from "lucide-react";

import { useState } from "react";


function AccountSearch({
    onSearch,
    onClear,
    initialValue = "",
}) {

    const [value, setValue] =
        useState(initialValue);


    // ============================================================
    // SEARCH
    // ============================================================

    function handleSearch() {

        const trimmedValue =
            value.trim();

        onSearch(trimmedValue);
    }


    // ============================================================
    // ENTER KEY SEARCH
    // ============================================================

    function handleKeyDown(event) {

        if (event.key === "Enter") {

            event.preventDefault();

            handleSearch();
        }
    }


    // ============================================================
    // CLEAR SEARCH
    // ============================================================

    function handleClear() {

        setValue("");

        onClear();
    }


    // ============================================================
    // BACK TO ALL ACCOUNTS
    // ============================================================

    function handleBackToAll() {

        setValue("");

        onClear();
    }


    // ============================================================
    // RENDER
    // ============================================================

    return (

        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">


            {/* SEARCH INPUT */}

            <div className="relative flex-1 lg:w-80">

                <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />


                <input
                    type="text"
                    value={value}
                    onChange={(event) =>
                        setValue(
                            event.target.value
                        )
                    }
                    onKeyDown={
                        handleKeyDown
                    }
                    placeholder="Search account or customer..."
                    className="w-full rounded-xl border border-white/10 bg-slate-900 py-2.5 pl-10 pr-10 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
                />


                {/* CLEAR INPUT */}

                {value && (

                    <button
                        type="button"
                        title="Clear search"
                        onClick={
                            handleClear
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:bg-white/5 hover:text-white"
                    >

                        <X size={15} />

                    </button>

                )}

            </div>


            {/* SEARCH BUTTON */}

            <button
                type="button"
                onClick={
                    handleSearch
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >

                <Search size={16} />

                Search

            </button>


            {/* BACK TO ALL ACCOUNTS */}

            {value && (

                <button
                    type="button"
                    onClick={
                        handleBackToAll
                    }
                    className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                >

                    <ArrowLeft size={16} />

                    All Accounts

                </button>

            )}

        </div>
    );
}


export default AccountSearch;
