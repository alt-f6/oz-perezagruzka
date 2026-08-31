import React from "react";
import { requireRoleForPage } from "@/shared/lib/rbac";
import { ROLE_LABELS, roleHome } from "@/lms/server/auth/types";
import { TopNav } from "@/lms/components/TopNav";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRoleForPage(["STUDENT"], {
    adminBypass: true,
    loginPath: "/login",
    forbiddenPath: (user) => roleHome(user.role),
  });

  return (
    <div className="min-h-screen">
      <TopNav
        title={ROLE_LABELS[user.role]}
        items={[
          { href: "/student/lessons", label: "Уроки" },
          { href: "/student/tutor", label: "ИИ-репетитор" },
        ]}
        role={user.role}
      />
      <main>{children}</main>
    </div>
  );
}
