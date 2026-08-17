import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "@/crm/components/Sidebar";
import { CRM_ROLES, getSessionUser } from "@/shared/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/admin/login");
  }

  if (!CRM_ROLES.includes(user.role)) {
    redirect("/");
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      <div className="h-full w-64 shrink-0">
        <Sidebar email={user.email ?? ""} role={user.role} />
      </div>

      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-8 py-7">{children}</div>
      </main>
    </div>
  );
}
