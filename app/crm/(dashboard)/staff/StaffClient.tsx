"use client";

import { Shield } from "lucide-react";
import React, { useState } from "react";
import { useToast } from "@/crm/components/ToastProvider";
import type { User, UserRole } from "@/crm/lib/types";
import { updateUserRole } from "./actions";

export function StaffClient({ initialStaff }: { initialStaff: User[] }) {
  const showToast = useToast();
  const [staffList, setStaffList] = useState<User[]>(initialStaff);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setLoadingId(userId);
    try {
      const result = await updateUserRole(userId, newRole);
      if (result?.error) {
        showToast(result.error, "error");
      } else {
        showToast("Роль сотрудника обновлена");
        setStaffList((prev) =>
          prev.map((item) =>
            item.id === userId ? { ...item, role: newRole } : item,
          ),
        );
      }
    } catch {
      showToast("Не удалось обновить роль", "error");
    } finally {
      setLoadingId(null);
    }
  };

  const getRoleBadge = (role?: UserRole) => {
    switch (role) {
      case "ADMIN":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "MANAGER":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "TEACHER":
        return "bg-slate-100 text-slate-600 border-slate-200";
      case "STUDENT":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "PARENT":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case undefined:
        return "bg-slate-100 text-slate-600 border-slate-200";
      default: {
        const _exhaustive: never = role;
        return _exhaustive;
      }
    }
  };

  const roleLabel = (role?: UserRole) => {
    switch (role) {
      case "ADMIN":
        return "Администратор";
      case "MANAGER":
        return "Менеджер";
      case "TEACHER":
        return "Преподаватель";
      case "STUDENT":
        return "Ученик";
      case "PARENT":
        return "Родитель";
      case undefined:
        return "Преподаватель";
      default: {
        const _exhaustive: never = role;
        return _exhaustive;
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Сотрудники</h1>
        <p className="page-subtitle">Роли и уровни доступа команды</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {staffList.map((member) => (
          <div
            key={member.id}
            className="card card-hover flex flex-col justify-between p-5"
          >
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-semibold text-slate-900">
                  {member.fullName ? member.fullName[0].toUpperCase() : "U"}
                </div>
                <h3 className="font-semibold tracking-tight text-slate-900">
                  {member.fullName || "Без имени"}
                </h3>
              </div>

              <div className="divider mt-4 flex items-center justify-between pt-3.5">
                <span className="overline">Роль в системе</span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${getRoleBadge(
                    member.role,
                  )}`}
                >
                  {roleLabel(member.role)}
                </span>
              </div>
            </div>

            <div className="divider mt-4 flex items-center justify-between gap-3 pt-3.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Shield size={14} /> Изменить роль:
              </label>
              <select
                disabled={loadingId === member.id}
                value={member.role || "TEACHER"}
                onChange={(e) =>
                  handleRoleChange(member.id, e.target.value as UserRole)
                }
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm outline-none transition-all duration-200 focus:border-accent/50 focus:ring-2 focus:ring-accent/10 disabled:opacity-50"
              >
                <option value="TEACHER">Преподаватель</option>
                <option value="MANAGER">Менеджер</option>
                <option value="ADMIN">Администратор</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
