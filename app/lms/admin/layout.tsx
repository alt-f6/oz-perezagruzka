import React from "react";
import { requireRoleForPage } from "@/shared/lib/rbac";
import { ROLE_LABELS, roleHome } from "@/lms/server/auth/types";
import { TopNav } from "@/lms/components/TopNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRoleForPage(["ADMIN", "MANAGER", "TEACHER"], {
    adminBypass: true,
    loginPath: "/login",
    forbiddenPath: (user) => roleHome(user.role),
  });

  // TEACHER gets no access to the global curriculum CMS (lessons/students/
  // assignments/messages are unscoped ADMIN/MANAGER tooling) — just the
  // landing page, so the LMS App Switcher link resolves instead of bouncing
  // through roleHome("TEACHER") = "/admin" in an infinite redirect loop.
  const items =
    user.role === "TEACHER"
      ? []
      : user.role === "MANAGER"
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
      <TopNav title={ROLE_LABELS[user.role]} items={items} role={user.role} />
      <main>{children}</main>
    </div>
  );
}
