import {
    X,
    MapPin,
    Save,
    LoaderCircle,
} from "lucide-react";

import {
    useEffect,
    useState,
} from "react";

import {
    updateCustomerAddress,
    getStates,
    getCitiesByState,
    lookupPincode,
} from "../services/customerService";


function CustomerAddressEditModal({
    customer,
    onClose,
    onUpdated,
}) {

    // ============================================================
    // ADDRESS
    // ============================================================

    const address =
        customer?.address ||
        (
            Array.isArray(customer?.addresses)
                ? customer.addresses[0]
                : null
        ) ||
        customer ||
        null;


    const addressId =
        address?.address_id;


    // ============================================================
    // STATES
    // ============================================================

    const [states, setStates] =
        useState([]);

    const [statesLoading, setStatesLoading] =
        useState(true);

    const [statesError, setStatesError] =
        useState("");


    // ============================================================
    // CITIES
    // ============================================================

    const [cities, setCities] =
        useState([]);

    const [citiesLoading, setCitiesLoading] =
        useState(false);

    const [citiesError, setCitiesError] =
        useState("");


    // ============================================================
    // FORM
    // ============================================================

    const [formData, setFormData] =
        useState({

            state_code: "",

            city_id: "",

            PIN_code: "",

            address_line1: "",

            address_line2: "",

            address_type: "Permanent",

            is_primary: true,
        });


    // ============================================================
    // SAVE STATE
    // ============================================================

    const [saving, setSaving] =
        useState(false);

    const [lookingUpPin, setLookingUpPin] =
        useState(false);

    const [error, setError] =
        useState("");


    // ============================================================
    // LOAD EXISTING ADDRESS
    // ============================================================

    useEffect(() => {

        if (!address) {
            return;
        }


        setFormData({

            state_code:
                address.state_code ||
                address.state_id ||
                "",

            city_id:
                address.city_id
                    ? String(address.city_id)
                    : "",

            PIN_code:
                address.PIN_code ||
                address.pin_code ||
                "",

            address_line1:
                address.address_line1 ||
                "",

            address_line2:
                address.address_line2 ||
                "",

            address_type:
                address.address_type ||
                "Permanent",

            is_primary:
                address.is_primary ??
                true,
        });

    }, [customer]);


    // ============================================================
    // LOAD STATES
    // ============================================================

    useEffect(() => {

        async function loadStates() {

            try {

                setStatesLoading(true);
                setStatesError("");


                const data =
                    await getStates();


                setStates(
                    Array.isArray(data)
                        ? data
                        : []
                );


            } catch (error) {

                console.error(
                    "Failed to load states:",
                    error
                );


                setStatesError(
                    error.message ||
                    "Failed to load states."
                );


            } finally {

                setStatesLoading(false);

            }
        }


        loadStates();

    }, []);


    // ============================================================
    // LOAD CITIES WHEN STATE CHANGES
    // ============================================================

    useEffect(() => {

        if (!formData.state_code) {

            setCities([]);

            return;
        }


        async function loadCities() {

            try {

                setCitiesLoading(true);
                setCitiesError("");


                const data =
                    await getCitiesByState(
                        formData.state_code
                    );


                setCities(
                    Array.isArray(data)
                        ? data
                        : []
                );


            } catch (error) {

                console.error(
                    "Failed to load cities:",
                    error
                );


                setCitiesError(
                    error.message ||
                    "Failed to load cities."
                );


                setCities([]);

            } finally {

                setCitiesLoading(false);

            }
        }


        loadCities();

    }, [formData.state_code]);


    // ============================================================
    // INPUT CHANGE
    // ============================================================

    function handleChange(event) {

        const {
            name,
            value,
            type,
            checked,
        } = event.target;


        setFormData(
            (previousData) => ({

                ...previousData,

                [name]:
                    type === "checkbox"
                        ? checked
                        : value,

            })
        );

    }


    // ============================================================
    // STATE CHANGE
    // ============================================================

    function handleStateChange(event) {

        const stateCode =
            event.target.value;


        setFormData(
            (previousData) => ({

                ...previousData,

                state_code:
                    stateCode,

                city_id:
                    "",

            })
        );


        setCities([]);
        setCitiesError("");
        setError("");

    }


    async function fillAddressFromPincode(value = formData.PIN_code) {
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
            setFormData((old) => ({
                ...old,
                PIN_code: pin,
                state_code: result.state_code,
                city_id: String(result.city_id),
            }));
        } catch (err) {
            setError(err.message || "Could not find this PIN code.");
        } finally {
            setLookingUpPin(false);
        }
    }

    // ============================================================
    // SAVE ADDRESS
    // ============================================================

    async function handleSubmit(event) {

        event.preventDefault();


        setError("");


        if (!customer?.customer_id) {

            setError(
                "Customer ID is missing."
            );

            return;
        }


        if (!addressId) {

            setError(
                "Address ID is missing."
            );

            return;
        }


        if (!formData.state_code) {

            setError(
                "Please select a state."
            );

            return;
        }


        if (!formData.city_id) {

            setError(
                "Please select a city."
            );

            return;
        }


        if (!formData.PIN_code.trim()) {

            setError(
                "Please enter PIN code."
            );

            return;
        }


        if (!formData.address_line1.trim()) {

            setError(
                "Please enter address."
            );

            return;
        }


        try {

            setSaving(true);


            const updatedCustomer =
                await updateCustomerAddress(

                    customer.customer_id,

                    addressId,

                    {

                        city_id:
                            Number(
                                formData.city_id
                            ),

                        PIN_code:
                            formData.PIN_code.trim(),

                        address_line1:
                            formData.address_line1.trim(),

                        address_line2:
                            formData.address_line2.trim(),

                        address_type:
                            formData.address_type,

                        is_primary:
                            formData.is_primary,

                    }
                );


            if (onUpdated) {

                onUpdated(
                    updatedCustomer
                );

            }


            onClose();


        } catch (error) {

            console.error(
                "Failed to update customer address:",
                error
            );


            setError(
                error.message ||
                "Failed to update customer address."
            );


        } finally {

            setSaving(false);

        }

    }


    // ============================================================
    // CLOSE
    // ============================================================

    function handleClose() {

        if (saving) {
            return;
        }


        onClose();

    }


    if (!customer) {
        return null;
    }


    // ============================================================
    // UI
    // ============================================================

    return (

        <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">

            <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">


                {/* ====================================================
                    HEADER
                ==================================================== */}

                <div className="flex items-center justify-between border-b border-white/10 p-6">

                    <div className="flex items-center gap-3">

                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-400">

                            <MapPin size={19} />

                        </div>


                        <div>

                            <h2 className="text-xl font-semibold">
                                Edit Address
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Update registered customer address
                            </p>

                        </div>

                    </div>


                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={saving}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >

                        <X size={20} />

                    </button>

                </div>


                {/* ====================================================
                    FORM
                ==================================================== */}

                <form
                    onSubmit={handleSubmit}
                    className="space-y-5 p-6"
                >


                    {/* =================================================
                        ERROR
                    ================================================= */}

                    {error && (

                        <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-4">

                            <p className="text-sm text-red-400">
                                {error}
                            </p>

                        </div>

                    )}


                    {/* =================================================
                        STATE
                    ================================================= */}

                    <div>

                        <label className="mb-2 block text-sm font-medium text-slate-300">
                            State
                        </label>


                        {statesLoading ? (

                            <div className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-500">

                                <LoaderCircle
                                    size={16}
                                    className="animate-spin"
                                />

                                Loading states...

                            </div>

                        ) : (

                            <select
                                name="state_code"
                                value={
                                    formData.state_code
                                }
                                onChange={
                                    handleStateChange
                                }
                                disabled={saving}
                                className="h-11 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none transition focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                            >

                                <option value="">
                                    Select state
                                </option>


                                {states.map(
                                    (state) => (

                                        <option
                                            key={
                                                state.state_code
                                            }
                                            value={
                                                state.state_code
                                            }
                                        >
                                            {
                                                state.state_name
                                            }
                                        </option>

                                    )
                                )}

                            </select>

                        )}


                        {statesError && (

                            <p className="mt-2 text-xs text-red-400">
                                {statesError}
                            </p>

                        )}

                    </div>


                    {/* =================================================
                        CITY
                    ================================================= */}

                    <div>

                        <label className="mb-2 block text-sm font-medium text-slate-300">
                            City
                        </label>


                        {!formData.state_code ? (

                            <div className="flex h-11 items-center rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-600">
                                Select a state first
                            </div>

                        ) : citiesLoading ? (

                            <div className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-500">

                                <LoaderCircle
                                    size={16}
                                    className="animate-spin"
                                />

                                Loading cities...

                            </div>

                        ) : (

                            <select
                                name="city_id"
                                value={
                                    formData.city_id
                                }
                                onChange={
                                    handleChange
                                }
                                disabled={
                                    saving ||
                                    cities.length === 0
                                }
                                className="h-11 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none transition focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                            >

                                <option value="">
                                    Select city
                                </option>


                                {cities.map(
                                    (city) => (

                                        <option
                                            key={
                                                city.city_id
                                            }
                                            value={
                                                city.city_id
                                            }
                                        >
                                            {
                                                city.city_name
                                            }
                                        </option>

                                    )
                                )}

                            </select>

                        )}


                        {citiesError && (

                            <p className="mt-2 text-xs text-red-400">
                                {citiesError}
                            </p>

                        )}


                        {!citiesLoading &&
                            formData.state_code &&
                            cities.length === 0 &&
                            !citiesError && (

                                <p className="mt-2 text-xs text-slate-500">
                                    No cities found for this state.
                                </p>

                            )}

                    </div>


                    {/* =================================================
                        PIN CODE
                    ================================================= */}

                    <div>

                        <label className="mb-2 block text-sm font-medium text-slate-300">
                            PIN Code
                        </label>


                        <div className="flex gap-2">
                            <input
                                type="text"
                                name="PIN_code"
                                value={formData.PIN_code}
                                onChange={handleChange}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        fillAddressFromPincode();
                                    }
                                }}
                                disabled={saving}
                                placeholder="Enter 6-digit PIN"
                                maxLength={6}
                                className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-slate-600 transition focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <button
                                type="button"
                                onClick={() => fillAddressFromPincode()}
                                disabled={saving || lookingUpPin || formData.PIN_code.length !== 6}
                                className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {lookingUpPin ? "Finding..." : "Find"}
                            </button>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Enter the PIN and press Enter (or Find) to fill state and city.</p>

                    </div>


                    {/* =================================================
                        ADDRESS LINE 1
                    ================================================= */}

                    <div>

                        <label className="mb-2 block text-sm font-medium text-slate-300">
                            Address Line 1
                        </label>


                        <input
                            type="text"
                            name="address_line1"
                            value={
                                formData.address_line1
                            }
                            onChange={
                                handleChange
                            }
                            disabled={saving}
                            placeholder="Enter address"
                            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-slate-600 transition focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                        />

                    </div>


                    {/* =================================================
                        ADDRESS LINE 2
                    ================================================= */}

                    <div>

                        <label className="mb-2 block text-sm font-medium text-slate-300">
                            Address Line 2
                        </label>


                        <input
                            type="text"
                            name="address_line2"
                            value={
                                formData.address_line2
                            }
                            onChange={
                                handleChange
                            }
                            disabled={saving}
                            placeholder="Optional"
                            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-slate-600 transition focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                        />

                    </div>


                    {/* =================================================
                        ADDRESS TYPE
                    ================================================= */}

                    <div>

                        <label className="mb-2 block text-sm font-medium text-slate-300">
                            Address Type
                        </label>


                        <select
                            name="address_type"
                            value={
                                formData.address_type
                            }
                            onChange={
                                handleChange
                            }
                            disabled={saving}
                            className="h-11 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none transition focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                        >

                            <option value="Permanent">
                                Permanent
                            </option>

                            <option value="Current">
                                Current
                            </option>

                            <option value="Office">
                                Office
                            </option>

                        </select>

                    </div>


                    {/* =================================================
                        PRIMARY ADDRESS
                    ================================================= */}

                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">

                        <input
                            type="checkbox"
                            name="is_primary"
                            checked={
                                formData.is_primary
                            }
                            onChange={
                                handleChange
                            }
                            disabled={saving}
                            className="h-4 w-4 accent-cyan-400"
                        />

                        <span className="text-sm text-slate-300">
                            Set as primary address
                        </span>

                    </label>


                    {/* =================================================
                        FOOTER
                    ================================================= */}

                    <div className="flex justify-end gap-3 border-t border-white/10 pt-5">

                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={saving}
                            className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Cancel
                        </button>


                        <button
                            type="submit"
                            disabled={
                                saving ||
                                statesLoading ||
                                citiesLoading
                            }
                            className="flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >

                            {saving ? (

                                <>

                                    <LoaderCircle
                                        size={16}
                                        className="animate-spin"
                                    />

                                    Saving...

                                </>

                            ) : (

                                <>

                                    <Save size={16} />

                                    Save Address

                                </>

                            )}

                        </button>

                    </div>

                </form>

            </div>

        </div>
    );
}


export default CustomerAddressEditModal;
