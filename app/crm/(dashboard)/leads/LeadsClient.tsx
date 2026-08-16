"use client";

import React, { useState, useTransition } from "react";
import { Check, GraduationCap, Target, X } from "lucide-react";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TERMINAL,
  type Lead,
  type LeadStatus,
} from "@/crm/lib/types";
import { ConfirmDialog } from "@/crm/components/ConfirmDialog";
import { useToast } from "@/crm/components/ToastProvider";
import {
  advanceLeadStatus,
  deleteLead,
  markLeadLost,
  convertLeadToStudent,
} from "./actions";
import { LeadModal } from "./LeadModal";

interface LeadsClientProps {
  groupedLeads: Record<LeadStatus, Lead[]>;
}

type DialogState =
  | { kind: "delete"; leadId: string }
  | { kind: "lost"; leadId: string }
  | { kind: "convert"; leadId: string }
  | null;

export function LeadsClient({ groupedLeads }: LeadsClientProps) {
  const showToast = useToast();
  const [isPending, startTransition] = useTransition();
  const [pendingLeadId, setPendingLeadId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);

  const runForLead = (leadId: string, task: () => Promise<{ error?: string } | undefined>) => {
    setPendingLeadId(leadId);
    startTransition(async () => {
      try {
        const result = await task();
        if (result?.error) {
          showToast(result.error, "error");
        }
      } finally {
        setPendingLeadId(null);
      }
    });
  };

  const handleAdvance = (lead: Lead) => {
    runForLead(lead.id, async () => {
      const result = await advanceLeadStatus(lead.id, lead.status);
      if (!result?.error) showToast("Статус обновлён");
      return result;
    });
  };

  const handleMarkLost = (leadId: string, reason: string) => {
    setDialog(null);
    runForLead(leadId, async () => {
      const result = await markLeadLost(leadId, reason);
      if (!result?.error) showToast("Заявка отмечена как отказ");
      return result;
    });
  };

  const handleDelete = (leadId: string) => {
    setDialog(null);
    runForLead(leadId, async () => {
      const result = await deleteLead(leadId);
      if (!result?.error) showToast("Лид удалён");
      return result;
    });
  };

  const handleConvertToStudent = (leadId: string) => {
    setDialog(null);
    runForLead(leadId, async () => {
      const result = await convertLeadToStudent(leadId);
      if (!result?.error) showToast("Лид зачислен как студент");
      return result;
    });
  };

  return (
    <div className="flex items-start gap-4 overflow-x-auto pb-4">
      {(Object.keys(groupedLeads) as LeadStatus[]).map((status) => (
        <div
          key={status}
          className="min-h-[500px] w-72 flex-shrink-0 rounded-xl border border-slate-200 bg-slate-100/60 p-3.5 md:w-80"
        >
          <h3 className="mb-3.5 flex items-center justify-between gap-2 px-0.5">
            <span className="overline">{LEAD_STATUS_LABELS[status]}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 shadow-sm">
              {groupedLeads[status].length}
            </span>
          </h3>

          <div className="space-y-2.5">
            {groupedLeads[status].map((lead) => {
              const isCardPending = isPending && pendingLeadId === lead.id;
              const isEnrolled = lead.status === "CONVERTED" && Boolean(lead.convertedUserId);
              const isTerminal = LEAD_STATUS_TERMINAL.includes(lead.status);

              return (
                <div
                  key={lead.id}
                  className={`group relative rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md ${
                    isCardPending ? "opacity-60 pointer-events-none" : ""
                  }`}
                >
                  {isCardPending && (
                    <div className="absolute right-8 top-2 flex items-center gap-1 text-[11px] text-slate-500">
                      <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-slate-200 border-t-accent/60" />
                      Сохранение...
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <LeadModal
                      lead={lead}
                      trigger={(open) => (
                        <button
                          onClick={open}
                          className="max-w-[85%] break-words text-left text-sm font-semibold text-slate-900 hover:underline"
                        >
                          {lead.name}
                        </button>
                      )}
                    />
                    <button
                      onClick={() => setDialog({ kind: "delete", leadId: lead.id })}
                      disabled={isCardPending}
                      className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 opacity-0 transition-all hover:bg-cancel/10 hover:text-cancel group-hover:opacity-100 disabled:opacity-0"
                      title="Удалить лид"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {lead.readinessScore !== null && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
                      <Target size={10} />
                      {lead.readinessScore}/100
                    </span>
                  )}

                  {lead.parentName && (
                    <p className="mt-1 text-xs text-slate-500">
                      Родитель: {lead.parentName}
                    </p>
                  )}
                  {lead.phone && (
                    <p className="mt-0.5 font-mono text-xs text-slate-600">
                      {lead.phone}
                    </p>
                  )}
                  {lead.subject && (
                    <p className="mt-2">
                      <span className="badge-info">{lead.subject}</span>
                    </p>
                  )}
                  {lead.notes && (
                    <p className="mt-2 break-words rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
                      {lead.notes}
                    </p>
                  )}
                  {isTerminal && lead.closedLostReason && (
                    <p className="mt-2 break-words rounded-lg border border-cancel/20 bg-cancel/5 p-2 text-xs text-cancel">
                      Причина: {lead.closedLostReason}
                    </p>
                  )}

                  {lead.status === "CONVERTED" && (
                    isEnrolled ? (
                      <p className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-center text-xs font-semibold text-emerald-700">
                        <Check size={14} />
                        Зачислен
                      </p>
                    ) : (
                      <button
                        onClick={() => setDialog({ kind: "convert", leadId: lead.id })}
                        disabled={isCardPending}
                        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all duration-200 hover:bg-accent/90 active:scale-[0.98] disabled:opacity-60"
                      >
                        <GraduationCap size={14} />
                        Зачислить как студента
                      </button>
                    )
                  )}

                  {!isTerminal && lead.status !== "CONVERTED" && (
                    <div className="mt-3 flex gap-2 border-t border-slate-100 pt-2.5">
                      <button
                        onClick={() => handleAdvance(lead)}
                        disabled={isCardPending}
                        className="flex-1 rounded-lg border border-emerald-500/25 bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 disabled:opacity-60"
                      >
                        Дальше →
                      </button>
                      <button
                        onClick={() => setDialog({ kind: "lost", leadId: lead.id })}
                        disabled={isCardPending}
                        className="flex-1 rounded-lg border border-cancel/25 bg-cancel/10 px-2 py-1.5 text-xs font-semibold text-cancel transition-colors hover:bg-cancel/15 disabled:opacity-60"
                      >
                        Отказ
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        title="Удалить лид?"
        message="Заявка будет удалена без возможности восстановления."
        confirmLabel="Удалить"
        danger
        onConfirm={() => dialog && handleDelete(dialog.leadId)}
        onClose={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog?.kind === "lost"}
        title="Отметить отказ"
        message="Заявка будет перемещена в терминальный статус «Отказ»."
        confirmLabel="Зафиксировать отказ"
        danger
        reasonLabel="Причина отказа"
        reasonPlaceholder="Например: дорого, выбрали другую школу..."
        onConfirm={(reason) =>
          dialog && reason && handleMarkLost(dialog.leadId, reason)
        }
        onClose={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog?.kind === "convert"}
        title="Зачислить как студента?"
        message="Будет создана карточка студента и аккаунт с доступом к LMS."
        confirmLabel="Зачислить"
        onConfirm={() => dialog && handleConvertToStudent(dialog.leadId)}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
