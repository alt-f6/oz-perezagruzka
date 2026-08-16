"use client";

import { useState } from "react";
import { Copy, Send, UserPlus } from "lucide-react";
import { useToast } from "@/crm/components/ToastProvider";
import { inviteParentPortal, inviteStudentPortal } from "./portal-invite-actions";

export function PortalInviteSection({
  studentId,
  studentHasAccount,
}: {
  studentId: string;
  studentHasAccount: boolean;
}) {
  const showToast = useToast();
  const [studentEmail, setStudentEmail] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);

  const copyLink = async (link: string) => {
    setLastLink(link);
    try {
      await navigator.clipboard.writeText(link);
      showToast("Ссылка скопирована");
    } catch {
      showToast("Не удалось скопировать ссылку — скопируйте вручную", "error");
    }
  };

  const handleInviteStudent = async () => {
    if (!studentEmail) {
      showToast("Укажите email ученика", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await inviteStudentPortal(studentId, studentEmail);
      if (result.error) {
        showToast(result.error, "error");
        return;
      }
      if (result.inviteLink) await copyLink(result.inviteLink);
      setStudentEmail("");
    } finally {
      setBusy(false);
    }
  };

  const handleInviteParent = async () => {
    if (!parentName || !parentPhone || !parentEmail) {
      showToast("Заполните все поля родителя", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await inviteParentPortal(
        studentId,
        parentName,
        parentPhone,
        parentEmail,
      );
      if (result.error) {
        showToast(result.error, "error");
        return;
      }
      if (result.inviteLink) await copyLink(result.inviteLink);
      setParentName("");
      setParentPhone("");
      setParentEmail("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-4">
      <h2 className="section-title flex items-center gap-2 text-lg">
        <UserPlus size={20} className="text-slate-600" />
        Доступ к личному кабинету
      </h2>

      {!studentHasAccount && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label">
              Email ученика
            </label>
            <input
              type="email"
              value={studentEmail}
              disabled={busy}
              onChange={(e) => setStudentEmail(e.target.value)}
              placeholder="student@example.com"
              className="input w-60"
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleInviteStudent}
            className="btn-primary px-3.5 py-2"
          >
            <Send size={15} />
            Пригласить ученика
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t border-slate-200 pt-4">
        <div>
          <label className="label">
            Имя родителя
          </label>
          <input
            type="text"
            value={parentName}
            disabled={busy}
            onChange={(e) => setParentName(e.target.value)}
            className="input w-60"
          />
        </div>
        <div>
          <label className="label">
            Телефон родителя
          </label>
          <input
            type="text"
            value={parentPhone}
            disabled={busy}
            onChange={(e) => setParentPhone(e.target.value)}
            className="input w-60"
          />
        </div>
        <div>
          <label className="label">
            Email родителя
          </label>
          <input
            type="email"
            value={parentEmail}
            disabled={busy}
            onChange={(e) => setParentEmail(e.target.value)}
            className="input w-60"
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={handleInviteParent}
          className="btn-primary px-3.5 py-2"
        >
          <Send size={15} />
          Пригласить родителя
        </button>
      </div>

      {lastLink && (
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="truncate">{lastLink}</span>
          <button
            type="button"
            onClick={() => copyLink(lastLink)}
            className="shrink-0 text-slate-900 hover:opacity-70"
            title="Скопировать снова"
          >
            <Copy size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
