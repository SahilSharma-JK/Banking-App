import {
    Activity,
    ArrowLeftRight,
    CreditCard,
    IndianRupee,
    Landmark,
    TrendingDown,
    TrendingUp,
    Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { getDashboardSummary } from "../services/dashboardService";

function Dashboard() {
    const navigate = useNavigate();
    const [summary, setSummary] = useState({
        totalCustomers: 0,
        totalAccounts: 0,
        totalBalance: 0,
        totalTransactions: 0,
        todayDeposits: 0,
        todayWithdrawals: 0,
        todayEmi: 0,
        activeAccounts: 0,
        savingsAccounts: 0,
        loanAccounts: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                const data = await getDashboardSummary();
                setSummary(data || {});
            } catch (err) {
                setError(err.message || "Failed to load dashboard.");
            } finally {
                setLoading(false);
            }
        }

        load();
    }, []);

    const totalBalance = Number(summary.totalBalance || 0);
    const savingsCount = Number(summary.savingsAccounts || 0);
    const loansCount = Number(summary.loanAccounts || 0);
    const activeAccounts = Number(summary.activeAccounts || 0);
    const deposits = Number(summary.todayDeposits || 0);
    const withdrawals = Number(summary.todayWithdrawals || 0);
    const emiPayments = Number(summary.todayEmi || 0);

    const cards = [
        { title: "Total Customers", value: summary.totalCustomers, helper: "Open Customers", icon: Users, path: "/customers" },
        { title: "Total Accounts", value: summary.totalAccounts, helper: "Open Accounts", icon: CreditCard, path: "/accounts" },
        { title: "Total Balance", value: summary.totalBalanceFormatted || `₹${money(totalBalance)}`, helper: "Across Savings Accounts", icon: IndianRupee },
        { title: "Transactions", value: summary.totalTransactions, helper: "Open Transaction History", icon: ArrowLeftRight, path: "/transactions" },
    ];

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900">
            <Sidebar />

            <main className="ml-64 min-h-screen p-6 lg:p-8">
                <section className="mb-8">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-cyan-700">ZENbank · Overview</p>
                    <h1 className="text-4xl font-bold tracking-tight text-slate-950">Welcome, Admin 👋</h1>
                    <p className="mt-2 text-slate-500">Here&apos;s today&apos;s banking overview.</p>
                </section>

                {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {cards.map((card) => {
                        const Icon = card.icon;
                        const content = (
                            <>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-slate-500">{card.title}</p>
                                        <h2 className="mt-3 text-3xl font-bold text-slate-950">{loading ? "—" : card.value}</h2>
                                    </div>
                                    <div className="rounded-xl bg-cyan-100 p-3 text-cyan-700"><Icon size={22} /></div>
                                </div>
                                <p className={`mt-5 text-sm font-semibold ${card.path ? "text-cyan-700" : "text-slate-400"}`}>{card.helper}{card.path ? " →" : ""}</p>
                            </>
                        );

                        return card.path ? (
                            <button key={card.title} type="button" onClick={() => navigate(card.path)} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md">
                                {content}
                            </button>
                        ) : (
                            <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{content}</div>
                        );
                    })}
                </section>

                <section className="mt-8">
                    <div className="mb-4 flex items-center gap-3">
                        <div className="rounded-xl bg-cyan-100 p-2.5 text-cyan-700"><Activity size={19} /></div>
                        <div>
                            <h2 className="text-xl font-bold">Banking Pulse</h2>
                            <p className="text-sm text-slate-500">Today&apos;s banking activity</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                        <Pulse title="Total Deposits" value={summary.todayDepositsFormatted || `₹${money(deposits)}`} icon={TrendingUp} tone="green" />
                        <Pulse title="Total Withdrawals" value={summary.todayWithdrawalsFormatted || `₹${money(withdrawals)}`} icon={TrendingDown} tone="red" />
                        <Pulse title="Today's EMI Payments" value={summary.todayEmiFormatted || `₹${money(emiPayments)}`} icon={Landmark} tone="indigo" />
                        <Pulse title="Active Accounts" value={activeAccounts.toLocaleString("en-IN")} icon={CreditCard} tone="indigo" />
                    </div>
                </section>

                <section className="mt-8">
                    <div className="mb-4">
                        <h2 className="text-xl font-bold">Account overview</h2>
                        <p className="mt-1 text-sm text-slate-500">Quick access to Savings and Loan account groups.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <GroupCard title="Savings Accounts" count={savingsCount} icon={CreditCard} onClick={() => navigate("/accounts?type=savings")} />
                        <GroupCard title="Loan Accounts" count={loansCount} icon={Landmark} onClick={() => navigate("/accounts?type=loan")} />
                    </div>
                </section>
            </main>
        </div>
    );
}

function Pulse({ title, value, icon: Icon, tone }) {
    const classes = {
        green: "border-emerald-100 bg-emerald-50 text-emerald-700",
        red: "border-red-100 bg-red-50 text-red-700",
        indigo: "border-indigo-100 bg-indigo-50 text-indigo-700",
    };

    return (
        <div className={`rounded-2xl border p-5 shadow-sm ${classes[tone]}`}>
            <div className="flex items-center gap-3">
                <div className="rounded-xl bg-white p-3"><Icon size={20} /></div>
                <div>
                    <p className="text-sm opacity-70">{title}</p>
                    <h3 className="mt-1 text-2xl font-bold">{value}</h3>
                </div>
            </div>
        </div>
    );
}

function GroupCard({ title, count, icon: Icon, onClick }) {
    return (
        <button type="button" onClick={onClick} className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-cyan-100 p-3 text-cyan-700"><Icon size={21} /></div>
                    <div>
                        <p className="font-bold">{title}</p>
                        <p className="mt-1 text-sm text-slate-500">Open account operations</p>
                    </div>
                </div>
                <span className="text-3xl font-bold text-slate-900">{count}</span>
            </div>
            <p className="mt-5 text-sm font-bold text-cyan-700">Open {title.toLowerCase()} →</p>
        </button>
    );
}

function money(value) {
    return Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default Dashboard;



