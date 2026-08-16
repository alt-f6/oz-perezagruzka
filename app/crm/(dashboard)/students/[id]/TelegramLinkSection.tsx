"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useToast } from "@/crm/components/ToastProvider";
import { updateParentTelegramChatId } from "./telegram-actions";

interface ParentRow {
  id: string;
  fullName: string;
  telegramChatId: string | null;
}

export function TelegramLinkSection({
  studentId,
  parents,
}: {
  studentId: string;
  parents: ParentRow[];
}) {
  if (parents.length === 0) return null;

  return (
    <div className="card space-y-3">
      <h2 className="section-title flex items-center gap-2 text-lg">
        <Send size={18} className="text-slate-600" />
        Telegram-уведомления
      </h2>
      <p className="text-sm text-slate-600">
        Chat ID получателя для напоминаний о задолженности и чеков об оплате.
      </p>
      <div className="space-y-2">
        {parents.map((parent) => (
          <ParentTelegramRow key={parent.id} studentId={studentId} parent={parent} />
        ))}
      </div>
    </div>
  );
}

function ParentTelegramRow({
  studentId,
  parent,
}: {
  studentId: string;
  parent: ParentRow;
}) {
  const showToast = useToast();
  const [chatId, setChatId] = useState(parent.telegramChatId ?? "");
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    try {
      const result = await updateParentTelegramChatId(studentId, parent.id, chatId);
      if (result?.error) {
        showToast(result.error, "error");
        return;
      }
      showToast("Сохранено");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="label">
          {parent.fullName}
        </label>
        <input
          type="text"
          value={chatId}
          disabled={busy}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="Telegram chat ID"
          className="input w-60"
        />
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={handleSave}
        className="btn-primary px-3.5 py-2"
      >
        Сохранить
      </button>
    </div>
  );
}
