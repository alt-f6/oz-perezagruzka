"use client";

import React, { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Modal } from "@/crm/components/Modal";
import { useToast } from "@/crm/components/ToastProvider";
import { leadSchema, type LeadValues } from "@/crm/lib/schemas";
import { LEAD_STATUS_LABELS, type Lead, type LeadStatus } from "@/crm/lib/types";
import { createLead, updateLead } from "./actions";

interface LeadModalProps {
  lead?: Lead;
  trigger?: (open: () => void) => React.ReactNode;
  triggerLabel?: string;
  triggerClassName?: string;
}

export function LeadModal({ lead, trigger, triggerLabel, triggerClassName }: LeadModalProps) {
  const showToast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const isEdit = Boolean(lead);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: lead
      ? {
          studentName: lead.name,
          parentName: lead.parentName ?? "",
          phone: lead.phone,
          subject: lead.subject ?? "",
          notes: lead.notes ?? "",
          status: lead.status,
          closedLostReason: lead.closedLostReason ?? "",
          utmSource: lead.utmSource ?? "",
          utmMedium: lead.utmMedium ?? "",
          utmCampaign: lead.utmCampaign ?? "",
        }
      : {
          studentName: "",
          parentName: "",
          phone: "",
          subject: "",
          notes: "",
          status: "NEW",
          closedLostReason: "",
          utmSource: "",
          utmMedium: "",
          utmCampaign: "",
        },
  });

  const status = watch("status");

  const close = () => {
    setIsOpen(false);
    reset();
  };

  const onSubmit = async (data: LeadValues) => {
    const result = isEdit
      ? await updateLead(lead!.id, data)
      : await createLead(data);

    if (result?.error) {
      showToast(result.error, "error");
      return;
    }

    if (!isEdit && "merged" in result && result.merged) {
      showToast("Заявка с этим номером телефона уже существует — данные обновлены");
      close();
      return;
    }

    showToast(isEdit ? "Заявка обновлена" : "Заявка создана");
    close();
  };

  return (
    <>
      {trigger
        ? trigger(() => setIsOpen(true))
        : (
            <button onClick={() => setIsOpen(true)} className={triggerClassName}>
              {triggerLabel}
            </button>
          )}

      <Modal
        open={isOpen}
        title={isEdit ? "Редактировать заявку" : "Новая заявка"}
        onClose={close}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">
              Имя ученика *
            </label>
            <input
              disabled={isSubmitting}
              {...register("studentName")}
              className="input"
              placeholder="Иван Иванов"
            />
            {errors.studentName && (
              <p className="field-error">
                {errors.studentName.message}
              </p>
            )}
          </div>

          <div>
            <label className="label">
              Имя родителя
            </label>
            <input
              disabled={isSubmitting}
              {...register("parentName")}
              className="input"
              placeholder="Светлана Александровна"
            />
          </div>

          <div>
            <label className="label">
              Телефон *
            </label>
            <input
              disabled={isSubmitting}
              {...register("phone")}
              className="input font-mono"
              placeholder="+79991234567"
            />
            {errors.phone && (
              <p className="field-error">{errors.phone.message}</p>
            )}
          </div>

          <div>
            <label className="label">
              Предмет / Направление
            </label>
            <input
              disabled={isSubmitting}
              {...register("subject")}
              className="input"
              placeholder="Математика ОГЭ, 9 класс"
            />
          </div>

          <div>
            <label className="label">
              Примечание менеджера
            </label>
            <textarea
              disabled={isSubmitting}
              rows={3}
              {...register("notes")}
              className="input resize-none"
              placeholder="Нужна диагностика, хочет заниматься по выходным..."
            />
          </div>

          {isEdit && (
            <div>
              <label className="label">
                Статус
              </label>
              <select
                disabled={isSubmitting}
                {...register("status")}
                className="input"
              >
                {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isEdit && status === "CLOSED_LOST" && (
            <div>
              <label className="label">
                Причина отказа *
              </label>
              <input
                disabled={isSubmitting}
                {...register("closedLostReason")}
                className="input"
                placeholder="Дорого, выбрали другой центр..."
              />
              {errors.closedLostReason && (
                <p className="field-error">
                  {errors.closedLostReason.message}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 divider pt-4">
            <div>
              <label className="overline mb-1 block">
                UTM Source
              </label>
              <input
                disabled={isSubmitting}
                {...register("utmSource")}
                className="input px-2.5 py-1.5 text-xs"
                placeholder="vk"
              />
            </div>
            <div>
              <label className="overline mb-1 block">
                UTM Medium
              </label>
              <input
                disabled={isSubmitting}
                {...register("utmMedium")}
                className="input px-2.5 py-1.5 text-xs"
                placeholder="cpc"
              />
            </div>
            <div>
              <label className="overline mb-1 block">
                UTM Campaign
              </label>
              <input
                disabled={isSubmitting}
                {...register("utmCampaign")}
                className="input px-2.5 py-1.5 text-xs"
                placeholder="summer_2026"
              />
            </div>
          </div>

          {isEdit && lead && (lead.readinessScore !== null || lead.sessionId || lead.utmContent || lead.utmTerm || lead.clickId || lead.referrer || lead.landingPage) && (
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Атрибуция (только чтение)
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                {lead.readinessScore !== null && (
                  <>
                    <dt className="text-slate-500">Балл готовности</dt>
                    <dd className="font-mono text-slate-700">{lead.readinessScore}/100</dd>
                  </>
                )}
                {lead.sessionId && (
                  <>
                    <dt className="text-slate-500">Session ID</dt>
                    <dd className="font-mono text-slate-700 truncate" title={lead.sessionId}>{lead.sessionId}</dd>
                  </>
                )}
                {lead.utmContent && (
                  <>
                    <dt className="text-slate-500">UTM Content</dt>
                    <dd className="text-slate-700">{lead.utmContent}</dd>
                  </>
                )}
                {lead.utmTerm && (
                  <>
                    <dt className="text-slate-500">UTM Term</dt>
                    <dd className="text-slate-700">{lead.utmTerm}</dd>
                  </>
                )}
                {lead.clickId && (
                  <>
                    <dt className="text-slate-500">Click ID</dt>
                    <dd className="font-mono text-slate-700 truncate" title={lead.clickId}>{lead.clickId}</dd>
                  </>
                )}
                {lead.referrer && (
                  <>
                    <dt className="text-slate-500">Referrer</dt>
                    <dd className="text-slate-700 truncate" title={lead.referrer}>{lead.referrer}</dd>
                  </>
                )}
                {lead.landingPage && (
                  <>
                    <dt className="text-slate-500">Landing Page</dt>
                    <dd className="text-slate-700 truncate" title={lead.landingPage}>{lead.landingPage}</dd>
                  </>
                )}
              </dl>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={close}
              disabled={isSubmitting}
              className="btn-secondary px-4 py-2"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-4 py-2"
            >
              {isSubmitting ? "Сохранение..." : isEdit ? "Сохранить" : "Создать"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
