import React from "react";
import { requireRoleForPage } from "@/shared/lib/rbac";
import { ROLE_LABELS, roleHome } from "@/lms/server/auth/types";
import { TopNav } from "@/lms/components/TopNav";
import { hasTutorAccess } from "@/lms/server/access/has-tutor-access";
import { STAFF_PREVIEW_ROLES } from "@/lms/server/access/can-view-lesson";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  // Staff (MANAGER/TEACHER; ADMIN via bypass) are let through so the admin
  // "Предпросмотр" link can open a lesson exactly as a student sees it --
  // the lesson page itself already grants them preview via canViewLesson.
  const user = await requireRoleForPage(["STUDENT", ...STAFF_PREVIEW_ROLES], {
    adminBypass: true,
    loginPath: "/login",
    forbiddenPath: (user) => roleHome(user.role),
  });

  // adminBypass means an ADMIN can reach this layout too; they always keep
  // the tutor link (support/QA) without an entitlement lookup.
  const tutorAccess = user.role === "ADMIN" || (user.role === "STUDENT" && (await hasTutorAccess(user.id)));

  const isStaffPreview = user.role !== "STUDENT";

  const items = [
    ...(isStaffPreview ? [{ href: "/admin", label: "← Админка" }] : []),
    { href: "/student/lessons", label: "Уроки" },
    ...(tutorAccess ? [{ href: "/student/tutor", label: "ИИ-репетитор" }] : []),
  ];

  return (
    <div className="min-h-screen">
      <TopNav title={ROLE_LABELS[user.role]} items={items} role={user.role} />
      <main>{children}</main>
    </div>
  );
}
