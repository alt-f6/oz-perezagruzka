import { redirect } from "next/navigation";
import { CRM_ROLES, getSessionUser } from "@/shared/lib/auth";
import { db } from "@/shared/lib/db";
import { TeamClient } from "./TeamClient";

export default async function TeamPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/admin/login");
  }

  const role = sessionUser.role;

  if (role !== "ADMIN") {
    redirect("/");
  }

  const [profiles, invites] = await Promise.all([
    db.user.findMany({
      where: { role: { in: CRM_ROLES } },
      select: { id: true, fullName: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.invite.findMany({
      where: { acceptedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="page-title">Управление командой</h1>
        <p className="page-subtitle">
          Приглашайте администраторов и преподавателей, управляйте доступами
          центра.
        </p>
      </div>

      <TeamClient
        initialMembers={profiles.map((p) => ({
          id: p.id,
          fullName: p.fullName,
          role: p.role,
          createdAt: p.createdAt.toISOString(),
        }))}
        initialInvites={invites.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role as "ADMIN" | "TEACHER",
          token: i.token,
          createdAt: i.createdAt.toISOString(),
        }))}
        currentUserRole={role}
      />
    </div>
  );
}
