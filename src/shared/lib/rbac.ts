import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/shared/lib/auth";

export type Role = "ADMIN" | "MANAGER" | "TEACHER" | "STUDENT" | "PARENT";

export class RbacError extends Error {
  status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.name = "RbacError";
    this.status = status;
  }
}

function isAllowed(role: Role, allowed: Role[], adminBypass: boolean): boolean {
  if (adminBypass && role === "ADMIN") return true;
  return allowed.includes(role);
}

/**
 * Throwing guard for API route handlers and Server Actions. adminBypass
 * defaults to false — callers migrating off requireRoleApi/requireRolePage
 * (which both bypassed unconditionally) must pass { adminBypass: true }
 * explicitly to preserve prior behavior; this makes every remaining
 * bypass a visible, grep-able decision at the call site.
 */
export async function requireRole(
  allowed: Role[],
  opts?: { adminBypass?: boolean },
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new RbacError(401, "unauthorized");
  }
  if (!isAllowed(user.role as Role, allowed, opts?.adminBypass ?? false)) {
    throw new RbacError(403, "forbidden");
  }
  return user;
}

/**
 * Redirect-based guard for Server Component pages/layouts. loginPath is
 * required (no shared default) because CRM and LMS have different login
 * routes; pass the app's own login path explicitly at each call site.
 */
export async function requireRoleForPage(
  allowed: Role[],
  opts: { adminBypass?: boolean; loginPath: string },
): Promise<SessionUser> {
  try {
    return await requireRole(allowed, { adminBypass: opts.adminBypass });
  } catch (err) {
    if (err instanceof RbacError) {
      redirect(opts.loginPath);
    }
    throw err;
  }
}

export function rbacErrorResponse(e: unknown): NextResponse {
  const status = e instanceof RbacError ? e.status : 500;
  const error = e instanceof Error ? e.message : "server error";
  return NextResponse.json({ ok: false, error }, { status });
}
