import { db } from "@/shared/lib/db";
import {
  SESSION_COOKIE_NAME,
  signToken,
  verifyToken,
  createUserSession,
  destroySession,
  getSessionUser as getUnifiedSessionUser,
  type SessionUser,
} from "@/shared/lib/auth";

/**
 * Thin LMS-facing re-export of the unified Prisma-backed session mechanism
 * (`@/shared/lib/auth`), kept under this path/name set so existing call
 * sites across app/lms/** don't need their imports touched.
 */

export function cookieName() {
  return SESSION_COOKIE_NAME;
}

export const sign = signToken;
export const verify = verifyToken;

export async function createSession(userId: string) {
  return createUserSession(userId);
}

export async function deleteSession(token: string) {
  return destroySession(token);
}

// Takes an already-verified (unsigned) session token, as the original
// contract did. Callers `verify()` the signed cookie first, then pass the
// resulting raw token here.
export async function getUserBySession(token: string): Promise<SessionUser | null> {
  const session = await db.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt <= new Date()) return null;
  return { id: session.user.id, email: session.user.email, role: session.user.role };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  return getUnifiedSessionUser();
}
