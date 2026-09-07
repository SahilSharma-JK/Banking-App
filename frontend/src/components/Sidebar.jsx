import {
    Check,
    CreditCard,
    LayoutDashboard,
    LogOut,
    Settings,
    UserRound,
    Users,
    ArrowLeftRight,
    X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { showToast } from "./Toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const navigationItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Customers", icon: Users, path: "/customers" },
    { label: "Accounts", icon: CreditCard, path: "/accounts" },
    { label: "Transaction History", icon: ArrowLeftRight, path: "/transactions" },
];

function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();

    const [settingsOpen, setSettingsOpen] = useState(false);
    const [adminOpen, setAdminOpen] = useState(false);
    const [admin, setAdmin] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("admin") || "null");
        } catch {
            return null;
        }
    });
    const [defaultPage, setDefaultPage] = useState(
        () => localStorage.getItem("zenbank_default_page") || "/dashboard"
    );
    const [confirmLogout, setConfirmLogout] = useState(
        () => localStorage.getItem("zenbank_confirm_logout") !== "false"
    );

    useEffect(() => {
        if (!adminOpen) return;

        async function loadAdmin() {
            const token = localStorage.getItem("token");
            if (!token) return;

            try {
                const response = await fetch(`${API_URL}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const result = await response.json();

                if (response.ok && (result.user || result.data?.user)) {
                    setAdmin((old) => ({
                        ...(old || {}),
                        ...(result.user || result.data.user),
                    }));
                }
            } catch {
                // Local admin information is still displayed if the refresh fails.
            }
        }

        loadAdmin();
    }, [adminOpen]);

    function logout() {
        if (
            confirmLogout &&
            !window.confirm("Are you sure you want to log out of ZENbank?")
        ) {
            return;
        }

        localStorage.removeItem("token");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("admin");
        navigate("/login", { replace: true });
    }

    function saveSettings() {
        localStorage.setItem("zenbank_default_page", defaultPage);
        localStorage.setItem("zenbank_confirm_logout", String(confirmLogout));
        setSettingsOpen(false);
        showToast("Settings saved successfully.");
    }

    function resetSettings() {
        setDefaultPage("/dashboard");
        setConfirmLogout(true);
        localStorage.setItem("zenbank_default_page", "/dashboard");
        localStorage.setItem("zenbank_confirm_logout", "true");
        showToast("Settings reset to defaults.");
    }

    return (
        <>
            <aside className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col bg-[#0b1830] px-4 py-6 text-white shadow-xl">
                <div className="mb-10 px-3">
                    <div className="text-2xl tracking-tight">
                        <span className="font-extrabold">ZEN</span>
                        <span className="font-light italic text-cyan-300">bank</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Banking administration</p>
                </div>

                <nav className="flex-1 space-y-1.5">
                    {navigationItems.map((item) => {
                        const Icon = item.icon;
                        const active = location.pathname === item.path;

                        return (
                            <button
                                key={item.path}
                                type="button"
                                onClick={() => navigate(item.path)}
                                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${active
                                        ? "bg-cyan-400 text-slate-950 shadow-sm"
                                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                                    }`}
                            >
                                <Icon size={19} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="border-t border-white/10 pt-5">
                    <button
                        type="button"
                        onClick={() => { setSettingsOpen(true); setAdminOpen(false); }}
                        className="mb-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
                    >
                        <Settings size={19} /> Settings
                    </button>

                    <button
                        type="button"
                        onClick={() => { setAdminOpen(true); setSettingsOpen(false); }}
                        className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-white/10 p-3 text-left hover:bg-white/15"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 font-bold text-cyan-300">
                            {(admin?.username || "A").slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">{admin?.username || "Admin"}</p>
                            <p className="truncate text-xs text-slate-400">Administrator</p>
                        </div>
                        <span
                            title="Logout"
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                                event.stopPropagation();
                                logout();
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    logout();
                                }
                            }}
                            className="rounded-lg p-2 text-slate-400 hover:bg-red-400/10 hover:text-red-300"
                        >
                            <LogOut size={17} />
                        </span>
                    </button>
                </div>
            </aside>

            {settingsOpen && (
                <Modal title="Settings" subtitle="Basic ZENbank administrator preferences." onClose={() => setSettingsOpen(false)}>
                    <div className="space-y-5">
                        <Field label="Default page after login">
                            <select value={defaultPage} onChange={(e) => setDefaultPage(e.target.value)}>
                                <option value="/dashboard">Dashboard</option>
                                <option value="/customers">Customers</option>
                                <option value="/accounts">Accounts</option>
                                <option value="/transactions">Transaction History</option>
                            </select>
                        </Field>

                        <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div>
                                <p className="font-semibold text-slate-800">Confirm before logout</p>
                                <p className="mt-1 text-xs text-slate-500">Ask before ending the admin session.</p>
                            </div>
                            <input type="checkbox" checked={confirmLogout} onChange={(e) => setConfirmLogout(e.target.checked)} className="h-4 w-4 accent-cyan-600" />
                        </label>

                        <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4 text-sm text-cyan-800">
                            ZENbank administration preferences are stored locally for this browser.
                        </div>
                    </div>

                    <footer className="mt-6 flex justify-between border-t border-slate-200 pt-5">
                        <button type="button" onClick={resetSettings} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Reset</button>
                        <button type="button" onClick={saveSettings} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-700"><Check size={16} /> Save settings</button>
                    </footer>
                </Modal>
            )}

            {adminOpen && (
                <Modal title="Admin profile" subtitle="Current authenticated administrator." onClose={() => setAdminOpen(false)}>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-100 text-lg font-bold text-cyan-700">
                                {(admin?.username || "A").slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-lg font-bold">{admin?.username || "Admin"}</p>
                                <p className="text-sm text-slate-500">Administrator</p>
                            </div>
                        </div>

                        <div className="mt-5 space-y-3">
                            <Info label="Admin ID" value={admin?.adminId ?? admin?.admin_id ?? "N/A"} />
                            <Info label="Username" value={admin?.username || "N/A"} />
                            <Info label="Email" value={admin?.email || "N/A"} />
                        </div>
                    </div>

                    <footer className="mt-6 flex justify-end border-t border-slate-200 pt-5">
                        <button type="button" onClick={logout} className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700">
                            <LogOut size={16} /> Logout
                        </button>
                    </footer>
                </Modal>
            )}
        </>
    );
}

function Modal({ title, subtitle, onClose, children }) {
    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
                <header className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <UserRound size={18} className="text-cyan-700" />
                            <h2 className="text-xl font-bold">{title}</h2>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
                </header>
                <div className="mt-6">{children}</div>
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <label className="block text-sm font-semibold text-slate-600">
            {label}
            <span className="mt-2 block [&_select]:h-11 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-slate-200 [&_select]:bg-slate-50 [&_select]:px-3 [&_select]:text-slate-900 [&_select]:outline-none [&_select]:focus:border-cyan-500">
                {children}
            </span>
        </label>
    );
}

function Info({ label, value }) {
    return (
        <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm">
            <span className="text-slate-400">{label}</span>
            <span className="font-semibold text-slate-800">{value}</span>
        </div>
    );
}

export default Sidebar;

