import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

let toastId = 0;

export function showToast(message, type = "success") {
    window.dispatchEvent(new CustomEvent("zenbank:toast", {
        detail: { id: ++toastId, message, type }
    }));
}

export default function ToastHost() {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        const handler = (event) => {
            const toast = event.detail;
            setToasts((items) => [...items, toast]);
            window.setTimeout(() => {
                setToasts((items) => items.filter((item) => item.id !== toast.id));
            }, 3500);
        };

        window.addEventListener("zenbank:toast", handler);
        return () => window.removeEventListener("zenbank:toast", handler);
    }, []);

    return (
        <div className="pointer-events-none fixed right-6 top-6 z-999 flex w-[min(92vw,420px)] flex-col gap-3">
            {toasts.map((toast) => {
                const Icon = toast.type === "error"
                    ? XCircle
                    : toast.type === "info"
                        ? Info
                        : CheckCircle2;

                const tone = toast.type === "error"
                    ? "border-red-200 bg-white text-red-700"
                    : toast.type === "info"
                        ? "border-cyan-200 bg-white text-cyan-700"
                        : "border-emerald-200 bg-white text-emerald-700";

                return (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${tone}`}
                    >
                        <Icon size={19} className="mt-0.5 shrink-0" />
                        <p className="flex-1 text-sm">{toast.message}</p>
                        <button
                            type="button"
                            onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))}
                            className="shrink-0 opacity-70 hover:opacity-100"
                        >
                            <X size={16} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
