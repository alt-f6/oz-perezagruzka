import React from "react";
import { requireRoleForPage } from "@/shared/lib/rbac";
import { ROLE_LABELS } from "@/lms/server/auth/types";
import { TopNav } from "@/lms/components/TopNav";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRoleForPage(["STUDENT"], { adminBypass: true, loginPath: "/login" });

  return (
    <div className="min-h-screen">
      <TopNav
        title={ROLE_LABELS[user.role]}
        items={[{ href: "/student/lessons", label: "Уроки" }]}
        role={user.role}
      />
      <main>{children}</main>
    </div>
  );
}
