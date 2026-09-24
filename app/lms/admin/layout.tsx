import React from "react";
import { requireRoleForPage } from "@/shared/lib/rbac";
import { ROLE_LABELS, roleHome } from "@/lms/server/auth/types";
import { AdminSidebar, type AdminNavKey } from "@/lms/components/admin/AdminSidebar";
import { getUnansweredSummary } from "@/lms/server/admin/catalog";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRoleForPage(["ADMIN", "MANAGER", "TEACHER"], {
    adminBypass: true,
    loginPath: "/login",
    forbiddenPath: (user) => roleHome(user.role),
  });

  // TEACHER sees a read-only catalog scoped to their own courses
  // (Course.teacherId) plus the AI tutor; students/assignments/messages stay
  // unscoped ADMIN/MANAGER tooling. MANAGER doesn't get the tutor link (not
  // part of its role scope).
  const items: AdminNavKey[] =
    user.role === "TEACHER"
      ? ["overview", "lessons", "tutor"]
      : user.role === "MANAGER"
        ? ["overview", "courses", "lessons", "messages"]
        : ["overview", "courses", "lessons", "students", "assignments", "messages", "tutor"];

  const unanswered = items.includes("messages") ? (await getUnansweredSummary(user)).count : 0;

  return (
    <div className="min-h-screen lg:pl-60">
      <AdminSidebar role={user.role} roleLabel={ROLE_LABELS[user.role]} items={items} unansweredCount={unanswered} />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
