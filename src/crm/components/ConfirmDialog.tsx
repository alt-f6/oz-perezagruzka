"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message?: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    busy?: boolean;
    /** When set, shows a required reason field and passes its value to onConfirm */
    reasonLabel?: string;
    reasonPlaceholder?: string;
    onConfirm: (reason?: string) => void;
    onClose: () => void;
}

export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = "Подтвердить",
    cancelLabel = "Отмена",
    danger = false,
    busy = false,
    reasonLabel,
    reasonPlaceholder,
    onConfirm,
    onClose,
}: ConfirmDialogProps) {
    const [reason, setReason] = useState("");

    useEffect(() => {
        if (open) setReason("");
    }, [open]);

    const needsReason = Boolean(reasonLabel);
    const confirmDisabled = busy || (needsReason && !reason.trim());

    return (
        <Modal open={open} title={title} onClose={busy ? () => {} : onClose}>
            <div className="space-y-5">
                {message && (
                    <div className="flex items-start gap-3 text-sm text-slate-600">
                        {danger && (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cancel/10 text-cancel">
                                <AlertTriangle size={18} />
                            </span>
                        )}
                        <p className="pt-1">{message}</p>
                    </div>
                )}

                {needsReason && (
                    <div>
                        <label className="label">{reasonLabel} *</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={reasonPlaceholder}
                            rows={3}
                            disabled={busy}
                            className="input resize-none"
                        />
                    </div>
                )}

                <div className="flex justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="btn-secondary"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(needsReason ? reason.trim() : undefined)}
                        disabled={confirmDisabled}
                        className={danger ? "btn-danger" : "btn-primary"}
                    >
                        {busy ? "Выполняется..." : confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
