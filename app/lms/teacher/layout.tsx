import React from "react";

import { db } from "@/shared/lib/db";
import { requireRoleForPage } from "@/shared/lib/rbac";
import { ROLE_LABELS, roleHome } from "@/lms/server/auth/types";
import { TeacherTopNav } from "@/lms/components/teacher/TeacherTopNav";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  // TEACHER's read-only workspace; ADMIN may look in via bypass (sees every
  // course). Everyone else goes back to their own home.
  const user = await requireRoleForPage(["TEACHER"], {
    adminBypass: true,
    loginPath: "/login",
    forbiddenPath: (user) => roleHome(user.role),
  });

  const profile = await db.user.findUnique({ where: { id: user.id }, select: { fullName: true } });

  return (
    <div className="min-h-screen">
      <TeacherTopNav role={user.role} fullName={profile?.fullName ?? user.email ?? ""} roleLabel={ROLE_LABELS[user.role]} />
      <main>{children}</main>
    </div>
  );
}
