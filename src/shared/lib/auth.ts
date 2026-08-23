import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import type { Role as PrismaRole } from "@prisma/client";
import { db } from "@/shared/lib/db";

/**
 * Unified auth utility for the merged CRM + LMS app.
 *
 * Single identity mechanism: a bcrypt-hashed password on `User.passwordHash`,
 * paired with an HMAC-signed session-token cookie backed by the `Session`
 * table. Both CRM and LMS route handlers funnel through this module.
 */

// Single source of truth for the Role union: the Prisma-generated enum
// (`prisma/schema.prisma`). Every other `Role`/`UserRole` type in the repo
// re-exports this one instead of hand-duplicating the member list, so it
// can't drift from the DB schema again.
export type Role = PrismaRole;

export const CRM_ROLES: Role[] = ["ADMIN", "MANAGER", "TEACHER"];
export const LMS_ROLES: Role[] = ["ADMIN", "MANAGER", "TEACHER", "STUDENT"];

// Exhaustiveness check: if a role is ever added/removed from the Prisma
// enum without updating this list, the object literal fails to compile.
const _ALL_ROLES_CHECK: Record<Role, true> = {
  ADMIN: true,
  MANAGER: true,
  TEACHER: true,
  STUDENT: true,
  PARENT: true,
};
export const ALL_ROLES = Object.keys(_ALL_ROLES_CHECK) as Role[];

export const SESSION_COOKIE_NAME = process.env.COOKIE_NAME || "session";
const COOKIE_SECRET = process.env.COOKIE_SECRET || "";
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || "168");

export type SessionUser = {
  id: string;
  email: string | null;
  role: Role;
};

function mustSecret() {
  if (!COOKIE_SECRET || COOKIE_SECRET.length < 32) {
    throw new Error("COOKIE_SECRET missing or too short (min 32 chars)");
  }
}

export function signToken(token: string) {
  mustSecret();
  const sig = crypto.createHmac("sha256", COOKIE_SECRET).update(token).digest("hex");
  return `${token}.${sig}`;
}

export function verifyToken(signed: string): string | null {
  mustSecret();
  const parts = signed.split(".");
  if (parts.length !== 2) return null;

  const [token, sig] = parts;
  const expected = crypto.createHmac("sha256", COOKIE_SECRET).update(token).digest("hex");

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  return token;
}

// ─────────────────────────────────────────────────────────────
// Passwords
// ─────────────────────────────────────────────────────────────

const BCRYPT_COST = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Hashed once (cost 10, matching real user hashes) and cached for the life of the
// warm instance, instead of a hand-typed bcrypt literal. One mistyped character in a
// hardcoded hash throws on compare instead of failing closed like a real mismatch,
// which would reopen the exact timing gap this is meant to close.
const DUMMY_PASSWORD = "login-timing-normalization-placeholder";
let dummyHashPromise: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash(DUMMY_PASSWORD, BCRYPT_COST);
  }
  return dummyHashPromise;
}

/**
 * Looks up a user by email and verifies the password, always doing a bcrypt
 * compare (against a dummy hash when the email doesn't match) so response
 * timing doesn't leak account existence.
 */
export async function authenticateWithPassword(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const user = await db.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash || user.isArchived) {
    await bcrypt.compare(password, await getDummyHash());
    return null;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return { id: user.id, email: user.email, role: user.role };
}

// ─────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────

export async function createUserSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  await db.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await db.session.create({ data: { token, userId, expiresAt } });

  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { token } });
}

async function getUserBySessionToken(token: string): Promise<SessionUser | null> {
  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date() || session.user.isArchived) return null;
  return { id: session.user.id, email: session.user.email, role: session.user.role };
}

/**
 * Server Components / Route Handlers / Server Actions: reads the session
 * cookie via `next/headers`.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();

  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  const token = verifyToken(raw);
  if (!token) return null;

  return getUserBySessionToken(token);
}

/**
 * Middleware: operates on a NextRequest/NextResponse pair.
 */
export async function getSessionUserFromRequest(
  request: NextRequest,
  _response: NextResponse
): Promise<SessionUser | null> {
  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  const token = verifyToken(raw);
  if (!token) return null;

  return getUserBySessionToken(token);
}

export function isRoleAllowed(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}

/**
 * Server Components / Server Actions gate: reads the current session and
 * throws if unauthenticated or not in `allowedRoles`. Centralizes the
 * "am I logged in, what's my role" check that used to be duplicated per
 * CRM action/page file via ad-hoc Supabase `authId` lookups.
 */
export async function requireSessionUser(allowedRoles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("unauthorized");
  }
  if (allowedRoles && !isRoleAllowed(user.role, allowedRoles)) {
    throw new Error("forbidden");
  }
  return user;
}
