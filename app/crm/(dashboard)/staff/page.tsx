import { db } from "@/shared/lib/db";
import { requireRoleForPage } from "@/shared/lib/rbac";
import type { User } from "@/crm/lib/types";
import { StaffClient } from "./StaffClient";

export default async function StaffPage() {
  await requireRoleForPage(["ADMIN"], {
    loginPath: "/admin/login",
    forbiddenPath: () => "/access-denied",
  });

  const staff = await db.user.findMany({
    select: { id: true, fullName: true, role: true },
    orderBy: { createdAt: "desc" },
  });

  return <StaffClient initialStaff={(staff ?? []) as User[]} />;
}
