"use client";

import React, { useState, useTransition, useSyncExternalStore } from "react";
import { Users, Mail, UserPlus, Copy, Check } from "lucide-react";
import { useToast } from "@/crm/components/ToastProvider";
import type { Role } from "@/crm/lib/types";
import { createInvite } from "./actions";

interface Member {
  id: string;
  fullName: string | null;
  role: Role;
  createdAt: string;
}

interface Invite {
  id: string;
  email: string;
  // Narrower than `Role` on purpose: `createInvite` only ever issues
  // ADMIN/TEACHER invites (see team/actions.ts).
  role: "ADMIN" | "TEACHER";
  token: string;
  createdAt: string;
}

interface TeamClientProps {
  initialMembers: Member[];
  initialInvites: Invite[];
  currentUserRole: "ADMIN";
}

const ROLE_LABELS = {
  ADMIN: "Администратор",
  MANAGER: "Куратор",
  TEACHER: "Преподаватель",
  STUDENT: "Ученик",
  PARENT: "Родитель",
} satisfies Record<Role, string>;

const ROLE_CLASSES = {
  ADMIN: "bg-blue-50 text-blue-700 border-blue-200",
  MANAGER: "bg-purple-50 text-purple-700 border-purple-200",
  TEACHER: "bg-slate-100 text-slate-600 border-slate-200",
  STUDENT: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PARENT: "bg-amber-50 text-amber-700 border-amber-200",
} satisfies Record<Role, string>;

export function TeamClient({
  initialMembers,
  initialInvites,
  currentUserRole,
}: TeamClientProps) {
  const showToast = useToast();
  const [activeTab, setActiveTab] = useState<"members" | "invites">("members");
  const [isPending, startTransition] = useTransition();
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Client-only value read hydration-safely: "" on the server snapshot,
  // window.location.origin once mounted in the browser.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "TEACHER">("TEACHER");

  const handleInviteSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) return;

    setGeneratedLink(null);

    startTransition(async () => {
      try {
        const result = await createInvite(email, role);

        if (result.error) {
          showToast(result.error, "error");
        } else if (result.inviteLink) {
          showToast("Приглашение успешно сгенерировано!", "success");
          setGeneratedLink(result.inviteLink);
          setEmail("");
        }
      } catch (err) {
        console.error("Ошибка при создании приглашения:", err);
        showToast("Не удалось создать приглашение. Попробуйте снова.", "error");
      }
    });
  };

  const copyToClipboard = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      showToast("Ссылка скопирована в буфер обмена", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Не удалось скопировать ссылку", "error");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="card h-fit p-5">
        <h2 className="section-title mb-4 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-slate-600" />
          <span>Пригласить сотрудника</span>
        </h2>

        <form onSubmit={handleInviteSubmit} className="space-y-4">
          <div>
            <label className="label">
              Email сотрудника
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@example.com"
                className="input py-2.5 pl-9"
                required
                disabled={isPending}
              />
            </div>
          </div>

          <div>
            <label className="label">
              Роль в системе
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "ADMIN" | "TEACHER")}
              className="input py-2.5 font-medium"
              disabled={isPending}
            >
              <option value="TEACHER">Преподаватель</option>
              <option value="ADMIN">Администратор</option>
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              {role === "ADMIN"
                ? "Доступ к финансам, лидам, группам и студентам."
                : "Доступ только к своему расписанию и отметке уроков."}
            </p>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="btn-primary w-full"
          >
            {isPending ? "Генерация..." : "Создать ссылку-инвайт"}
          </button>
        </form>

        {generatedLink && (
          <div className="mt-4 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-medium text-emerald-800">
              Скопируйте ссылку и отправьте сотруднику:
            </p>
            <div className="flex gap-1.5 items-center">
              <input
                type="text"
                readOnly
                value={generatedLink}
                className="w-full rounded-lg border border-emerald-200 bg-white p-2 font-mono text-xs text-slate-600 outline-none"
              />
              <button
                onClick={() => copyToClipboard(generatedLink)}
                className="p-2 bg-white border border-emerald-200 hover:bg-emerald-100 rounded-lg text-emerald-700 transition"
                title="Скопировать"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card lg:col-span-2 flex h-fit flex-col overflow-hidden p-0">
        <div className="flex border-b border-slate-200 bg-slate-50 px-4">
          <button
            onClick={() => setActiveTab("members")}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-medium transition-colors ${
              activeTab === "members"
                ? "border-accent text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Users className="w-4 h-4" />
            Команда ({initialMembers.length})
          </button>
          <button
            onClick={() => setActiveTab("invites")}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-medium transition-colors ${
              activeTab === "invites"
                ? "border-accent text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Mail className="w-4 h-4" />
            Активные инвайты ({initialInvites.length})
          </button>
        </div>

        <div className="p-4">
          {activeTab === "members" ? (
            <div className="divide-y divide-slate-100">
              {initialMembers.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  Нет зарегистрированных участников команды.
                </p>
              ) : (
                initialMembers.map((member) => {
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-slate-900">
                          {member.fullName || "Имя не указано"}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${ROLE_CLASSES[member.role]}`}
                      >
                        {ROLE_LABELS[member.role]}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {initialInvites.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  Нет активных приглашений, ожидающих регистрации.
                </p>
              ) : (
                initialInvites.map((invite) => {
                  const inviteUrl = origin
                    ? `${origin}/register?token=${invite.token}`
                    : `/register?token=${invite.token}`;
                  return (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <div className="space-y-0.5 max-w-[65%]">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {invite.email}
                        </p>
                        <p className="truncate font-mono text-[11px] text-slate-500">
                          {inviteUrl}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_CLASSES[invite.role]}`}
                        >
                          {ROLE_LABELS[invite.role]}
                        </span>
                        <button
                          onClick={() => copyToClipboard(inviteUrl)}
                          className="icon-btn h-8 w-8"
                          title="Скопировать ссылку-приглашение заново"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
