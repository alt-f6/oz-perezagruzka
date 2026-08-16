"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
    createContext,
    useCallback,
    useContext,
    useRef,
    useState,
    type ReactNode,
} from "react";

type ToastVariant = "success" | "error";

interface Toast {
    id: number;
    message: string;
    variant: ToastVariant;
}

const ToastContext = createContext<
    ((message: string, variant?: ToastVariant) => void) | null
>(null);

export function useToast() {
    const showToast = useContext(ToastContext);
    if (!showToast) {
        throw new Error("useToast должен вызываться внутри ToastProvider");
    }
    return showToast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const nextId = useRef(0);

    const showToast = useCallback(
        (message: string, variant: ToastVariant = "success") => {
            const id = nextId.current++;
            setToasts((current) => [...current, { id, message, variant }]);
            setTimeout(() => {
                setToasts((current) => current.filter((toast) => toast.id !== id));
            }, 4000);
        },
        []
    );

    return (
        <ToastContext.Provider value={showToast}>
            {children}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: 12, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.96 }}
                            transition={{ type: "spring", duration: 0.35, bounce: 0.2 }}
                            className={`flex items-center gap-3 rounded-xl border bg-white py-3 pl-3.5 pr-5 text-sm font-medium text-slate-900 shadow-lg ${
                                toast.variant === "success"
                                    ? "border-paid/30"
                                    : "border-cancel/30"
                            }`}
                        >
                            <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                    toast.variant === "success"
                                        ? "bg-paid/10 text-paid"
                                        : "bg-cancel/10 text-cancel"
                                }`}
                            >
                                {toast.variant === "success" ? (
                                    <CheckCircle2 size={18} />
                                ) : (
                                    <AlertCircle size={18} />
                                )}
                            </span>
                            {toast.message}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}
