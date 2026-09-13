import type { ReactNode } from "react";
import { Sidebar } from "@/crm/components/Sidebar";
import { CrmMobileNav } from "@/crm/components/CrmMobileNav";
import { CRM_ROLES } from "@/shared/lib/auth";
import { requireRoleForPage } from "@/shared/lib/rbac";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireRoleForPage(CRM_ROLES, {
    loginPath: "/admin/login",
    forbiddenPath: () => "/access-denied",
  });

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-50">
      <div className="hidden h-full w-64 shrink-0 md:flex">
        <Sidebar email={user.email ?? ""} role={user.role} />
      </div>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <CrmMobileNav email={user.email ?? ""} role={user.role} />
        <div className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4 md:px-8 md:py-7">
          {children}
        </div>
      </main>
    </div>
  );
}
