import React from "react";
import { requireRolePage } from "@/lms/server/auth/require-role-page";
import { ROLE_LABELS } from "@/lms/server/auth/types";
import { TopNav } from "@/lms/components/TopNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRolePage(["ADMIN", "MANAGER"]);

  const items =
    user.role === "MANAGER"
      ? [
          { href: "/admin/lessons", label: "Уроки" },
          { href: "/admin/messages", label: "Сообщения" },
        ]
      : [
          { href: "/admin/lessons", label: "Уроки" },
          { href: "/admin/students", label: "Ученики" },
          { href: "/admin/assignments", label: "Назначения" },
          { href: "/admin/messages", label: "Сообщения" },
        ];

  return (
    <div className="min-h-screen">
      <TopNav title={ROLE_LABELS[user.role]} items={items} />
      <main>{children}</main>
    </div>
  );
}
