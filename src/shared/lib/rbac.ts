import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/shared/lib/auth";

export type Role = "ADMIN" | "MANAGER" | "TEACHER" | "STUDENT" | "PARENT";

export class RbacError extends Error {
  status: 401 | 403;
  /**
   * The authenticated-but-wrong-role user, populated only for 403 errors
   * (never for 401, where there is no session). Lets requireRoleForPage's
   * catch block redirect a forbidden user somewhere role-aware instead of
   * to the login page.
   */
  user?: SessionUser;

  constructor(status: 401 | 403, message: string, user?: SessionUser) {
    super(message);
    this.name = "RbacError";
    this.status = status;
    this.user = user;
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
    throw new RbacError(403, "forbidden", user);
  }
  return user;
}

/**
 * Redirect-based guard for Server Component pages/layouts. loginPath is
 * required (no shared default) because CRM and LMS have different login
 * routes; pass the app's own login path explicitly at each call site.
 *
 * forbiddenPath is optional and only applies to the 403 (authenticated but
 * wrong role) case; it never applies to the 401 (no session) case, which
 * always redirects to loginPath. When omitted, 403 also falls back to
 * loginPath, preserving behavior for callers that don't pass it.
 */
export async function requireRoleForPage(
  allowed: Role[],
  opts: { adminBypass?: boolean; loginPath: string; forbiddenPath?: (user: SessionUser) => string },
): Promise<SessionUser> {
  try {
    return await requireRole(allowed, { adminBypass: opts.adminBypass });
  } catch (err) {
    if (err instanceof RbacError) {
      if (err.status === 403 && opts.forbiddenPath && err.user) {
        redirect(opts.forbiddenPath(err.user));
      }
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
