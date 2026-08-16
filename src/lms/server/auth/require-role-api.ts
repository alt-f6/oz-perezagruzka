import { getSessionUser } from "@/lms/server/auth/session";
import type { AuthedUser, Role } from "@/lms/server/auth/types";

export type { AuthedUser };

export async function requireRoleApi(role: Role | Role[]): Promise<AuthedUser> {
  const user = await getSessionUser();
  const allowed = Array.isArray(role) ? role : [role];

  if (!user) {
    const err = new Error("unauthorized");
    (err as any).status = 401;
    throw err;
  }

  const authed = user as AuthedUser;

  if (authed.role === "ADMIN") {
    return authed;
  }

  if (!allowed.includes(authed.role)) {
    const err = new Error("forbidden");
    (err as any).status = 403;
    throw err;
  }

  return authed;
}
