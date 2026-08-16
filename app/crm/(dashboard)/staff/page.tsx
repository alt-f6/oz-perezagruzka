import { redirect } from "next/navigation";
import { db } from "@/shared/lib/db";
import { getSessionUser } from "@/shared/lib/auth";
import type { User } from "@/crm/lib/types";
import { StaffClient } from "./StaffClient";

export default async function StaffPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/admin/login");
  }

  if (sessionUser.role !== "ADMIN") {
    redirect("/");
  }

  const staff = await db.user.findMany({
    select: { id: true, fullName: true, role: true },
    orderBy: { createdAt: "desc" },
  });

  return <StaffClient initialStaff={(staff ?? []) as User[]} />;
}
