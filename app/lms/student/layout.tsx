import React from "react";
import { requireRoleForPage } from "@/shared/lib/rbac";
import { ROLE_LABELS, roleHome } from "@/lms/server/auth/types";
import { TopNav } from "@/lms/components/TopNav";
import { hasTutorAccess } from "@/lms/server/access/has-tutor-access";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRoleForPage(["STUDENT"], {
    adminBypass: true,
    loginPath: "/login",
    forbiddenPath: (user) => roleHome(user.role),
  });

  // adminBypass means an ADMIN can reach this layout too; they always keep
  // the tutor link (support/QA) without an entitlement lookup.
  const tutorAccess = user.role === "ADMIN" || (await hasTutorAccess(user.id));

  const items = [
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
