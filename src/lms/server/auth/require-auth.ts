import { getSessionUser } from "@/lms/server/auth/session";
import type { AuthedUser } from "@/lms/server/auth/types";

export type { AuthedUser };

export async function requireAuth(): Promise<AuthedUser> {
  const user = await getSessionUser();
  if (!user) {
    const err = new Error("unauthorized");
    (err as any).status = 401;
    throw err;
  }
  return user as AuthedUser;
}
