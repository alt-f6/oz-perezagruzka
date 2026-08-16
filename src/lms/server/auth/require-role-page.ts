import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieName, verify, getUserBySession } from "@/lms/server/auth/session";
import type { AuthedUser, Role } from "@/lms/server/auth/types";
import { roleHome } from "@/lms/server/auth/types";

export async function requireRolePage(role: Role | Role[]) {
  const allowed = Array.isArray(role) ? role : [role];
  const jar = await cookies();
  const raw = jar.get(cookieName())?.value;
  if (!raw) redirect("/login");

  const token = verify(raw);
  if (!token) redirect("/login");

  const user = (await getUserBySession(token)) as AuthedUser | null;
  if (!user) redirect("/login");

  if (user.role === "ADMIN") {
    return user;
  }

  if (!allowed.includes(user.role)) {
    redirect(roleHome(user.role));
  }

  return user;
}
