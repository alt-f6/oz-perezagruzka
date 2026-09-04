"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  RefreshCw,
  Send,
  UserPlus,
  Users,
} from "lucide-react";
import { useToast } from "@/crm/components/ToastProvider";
import {
  inviteParentPortal,
  inviteStudentPortal,
  reissueStudentInvite,
  resetStudentPassword,
} from "./portal-invite-actions";

/**
 * Copies text to the clipboard resiliently across browsers. The async
 * Clipboard API is unavailable/blocked in several real cases (iOS WebKit
 * outside a user gesture, insecure origins, some in-app browsers), so we fall
 * back to a hidden-textarea + execCommand path with an iOS-specific selection
 * range. Returns whether the copy succeeded.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    // iOS Safari ignores .select() on non-editable-ish fields; an explicit
    // range + setSelectionRange is required for execCommand("copy") to work.
    const range = document.createRange();
    range.selectNodeContents(ta);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function formatExpiry(iso: string): { label: string; expired: boolean } {
  const date = new Date(iso);
  const expired = date.getTime() < Date.now();
  const label = date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return { label, expired };
}

export function PortalInviteSection({
  studentId,
  studentHasAccount,
  accountEmail,
  studentEmail,
  inviteLink,
  inviteExpiresAt,
}: {
  studentId: string;
  studentHasAccount: boolean;
  accountEmail?: string | null;
  studentEmail?: string | null;
  inviteLink?: string | null;
  inviteExpiresAt?: string | null;
}) {
  const showToast = useToast();

  // Live invite state — seeded from the server, updated in place when the
  // operator provisions/reissues so the panel reflects the new link without a
  // full reload (the action also revalidates the route).
  const [link, setLink] = useState<string | null>(inviteLink ?? null);
  const [expiresAt, setExpiresAt] = useState<string | null>(inviteExpiresAt ?? null);
  const [emailInput, setEmailInput] = useState(studentEmail ?? "");
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentLink, setParentLink] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const copy = async (value: string) => {
    const ok = await copyToClipboard(value);
    showToast(
      ok ? "Ссылка скопирована" : "Не удалось скопировать — выделите ссылку и скопируйте вручную",
      ok ? "success" : "error",
    );
  };

  const handleProvision = async () => {
    if (!emailInput.trim()) {
      showToast("Укажите email ученика", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await inviteStudentPortal(studentId, emailInput);
      if (result.error) {
        showToast(result.error, "error");
        return;
      }
      if (result.inviteLink) {
        setLink(result.inviteLink);
        setExpiresAt(result.inviteExpiresAt ?? null);
        await copy(result.inviteLink);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleReissue = async () => {
    setBusy(true);
    try {
      const result = await reissueStudentInvite(studentId);
      if (result.error) {
        showToast(result.error, "error");
        return;
      }
      if (result.inviteLink) {
        setLink(result.inviteLink);
        setExpiresAt(result.inviteExpiresAt ?? null);
        showToast("Ссылка обновлена");
        await copy(result.inviteLink);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    setBusy(true);
    try {
      const result = await resetStudentPassword(studentId);
      if (result.error) {
        showToast(result.error, "error");
        return;
      }
      if (result.tempPassword) {
        setTempPassword(result.tempPassword);
        showToast("Пароль сброшен — передайте временный пароль ученику");
      }
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
      const result = await inviteParentPortal(studentId, parentName, parentPhone, parentEmail);
      if (result.error) {
        showToast(result.error, "error");
        return;
      }
      if (result.inviteLink) {
        setParentLink(result.inviteLink);
        await copy(result.inviteLink);
        setParentName("");
        setParentPhone("");
        setParentEmail("");
      }
    } finally {
      setBusy(false);
    }
  };

  const expiry = expiresAt ? formatExpiry(expiresAt) : null;

  const linkRow = (value: string, onReissue?: () => void) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span className="min-w-0 flex-1 truncate select-all" title={value}>
          {value}
        </span>
        <button
          type="button"
          onClick={() => copy(value)}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-800 transition hover:bg-slate-100 disabled:opacity-50"
          title="Скопировать ссылку"
        >
          <Copy size={13} />
          Копировать
        </button>
        {onReissue && (
          <button
            type="button"
            onClick={onReissue}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-800 transition hover:bg-slate-100 disabled:opacity-50"
            title="Сгенерировать новую ссылку"
          >
            <RefreshCw size={13} />
            Обновить
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="card space-y-5">
      {/* ── Panel 1: Student Account (LMS access) ─────────────────────── */}
      <div className="space-y-3">
        <h2 className="section-title flex items-center gap-2 text-lg">
          <UserPlus size={20} className="text-slate-600" />
          Доступ ученика к личному кабинету
        </h2>

        {studentHasAccount ? (
          // Fully registered: active LMS status + password recovery.
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 size={16} />
              <span>
                Аккаунт активен
                {accountEmail ? (
                  <>
                    {" "}· <span className="font-medium">{accountEmail}</span>
                  </>
                ) : null}
              </span>
            </div>
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100 disabled:opacity-50"
            >
              <KeyRound size={15} />
              Сбросить пароль
            </button>
            {tempPassword && (
              <div className="space-y-1 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <p className="font-medium">Временный пароль (передайте ученику):</p>
                <div className="flex items-center gap-2">
                  <code className="select-all rounded bg-white px-2 py-1 font-mono text-slate-900">
                    {tempPassword}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy(tempPassword)}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs text-amber-800 hover:bg-amber-100"
                  >
                    <Copy size={12} />
                    Копировать
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : link ? (
          // Pending invite: show expiry, copy, reissue.
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  expiry?.expired
                    ? "bg-rose-100 text-rose-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {expiry?.expired ? "Срок ссылки истёк" : "Приглашение отправлено"}
              </span>
              {expiry && (
                <span className="text-slate-500">
                  {expiry.expired ? "Истекло" : "Действует до"}: {expiry.label}
                </span>
              )}
            </div>
            {linkRow(link, handleReissue)}
            <p className="text-xs text-slate-400">
              Ссылка ведёт на страницу создания пароля. Открытие ссылка не расходует
              приглашение — оно активируется только после установки пароля.
            </p>
          </div>
        ) : (
          // No access yet: provision.
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label">Email ученика</label>
              <input
                type="email"
                value={emailInput}
                disabled={busy}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="student@example.com"
                className="input w-60"
              />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleProvision}
              className="btn-primary px-3.5 py-2"
            >
              <Send size={15} />
              Выдать доступ
            </button>
          </div>
        )}
      </div>

      {/* ── Panel 2: Parent Portal ────────────────────────────────────── */}
      <div className="space-y-3 border-t border-slate-200 pt-4">
        <h3 className="section-title flex items-center gap-2 text-base">
          <Users size={18} className="text-slate-600" />
          Родительский портал
        </h3>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label">Имя родителя</label>
            <input
              type="text"
              value={parentName}
              disabled={busy}
              onChange={(e) => setParentName(e.target.value)}
              className="input w-60"
            />
          </div>
          <div>
            <label className="label">Телефон родителя</label>
            <input
              type="text"
              value={parentPhone}
              disabled={busy}
              onChange={(e) => setParentPhone(e.target.value)}
              className="input w-60"
            />
          </div>
          <div>
            <label className="label">Email родителя</label>
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
        {parentLink && linkRow(parentLink)}
      </div>
    </div>
  );
}
