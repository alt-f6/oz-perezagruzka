import { NextResponse, type NextRequest } from "next/server";
import {
  CRM_ROLES,
  LMS_ROLES,
  getSessionUserFromRequest,
} from "@/shared/lib/auth";

// True subdomains now separate the three apps (crm.*, lms.*, root), so each
// app's protected-route prefixes only need to be unambiguous within its own
// host. There are no more cross-app prefix collisions to avoid.
const CRM_PROTECTED_PREFIXES = [
  "/dashboard",
  "/groups",
  "/leads",
  "/lessons",
  "/salary",
  "/schedule",
  "/staff",
  "/team",
  "/students",
  "/parent",
  "/dev",
];

// /api/auth/* (login/logout/me) and /api/health/* stay unprotected here so the
// login flow and health probe remain reachable pre-auth; every other /api/**
// route already enforces its own requireRoleApi/getSessionUser check, this is
// a defense-in-depth backstop, not the primary gate.
const LMS_PROTECTED_PREFIXES = [
  "/admin",
  "/learn",
  "/student",
  "/api/admin",
  "/api/student",
  "/api/assets",
];

const CRM_LOGIN_PATH = "/admin/login";
const LMS_LOGIN_PATH = "/login";

type AppKind = "crm" | "lms" | "landing";

function resolveApp(host: string): AppKind {
  const hostname = host.split(":")[0] ?? "";
  if (hostname.startsWith("crm.")) return "crm";
  if (hostname.startsWith("lms.")) return "lms";
  return "landing";
}

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function rewriteToApp(request: NextRequest, app: AppKind, response: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = `/${app}${request.nextUrl.pathname}`;
  const rewritten = NextResponse.rewrite(url);
  response.cookies.getAll().forEach((cookie) => rewritten.cookies.set(cookie));
  return rewritten;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const app = resolveApp(host);
  const response = NextResponse.next();

  if (app === "landing") {
    return rewriteToApp(request, app, response);
  }

  const loginPath = app === "crm" ? CRM_LOGIN_PATH : LMS_LOGIN_PATH;
  if (pathname === loginPath) {
    return rewriteToApp(request, app, response);
  }

  // CRM has no page at its own root: send unauthenticated visitors to login
  // and authenticated ones straight to their home (staff dashboard or the
  // parent portal).
  if (app === "crm" && pathname === "/") {
    const user = await getSessionUserFromRequest(request, response);
    const target = request.nextUrl.clone();
    if (user && CRM_ROLES.includes(user.role)) {
      target.pathname = "/dashboard";
    } else if (user?.role === "PARENT") {
      target.pathname = "/parent/dashboard";
    } else {
      target.pathname = CRM_LOGIN_PATH;
    }
    target.search = "";
    return NextResponse.redirect(target);
  }

  const protectedPrefixes = app === "crm" ? CRM_PROTECTED_PREFIXES : LMS_PROTECTED_PREFIXES;
  if (matchesPrefix(pathname, protectedPrefixes)) {
    // PARENT is only ever allowed onto the CRM parent portal, nowhere else.
    const isParentPortal = app === "crm" && matchesPrefix(pathname, ["/parent"]);
    const allowedRoles: typeof CRM_ROLES = isParentPortal
      ? ["PARENT"]
      : app === "crm"
        ? CRM_ROLES
        : LMS_ROLES;
    const user = await getSessionUserFromRequest(request, response);

    if (!user || !allowedRoles.includes(user.role)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = loginPath;
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
  }

  return rewriteToApp(request, app, response);
}

// `/api/*` is no longer excluded: each app's API routes now live under its
// own solid directory (app/crm/api, app/lms/api, app/landing/api) instead of
// a shared top-level /api reachable via route groups, so they need the same
// host-based rewrite as pages to resolve at all.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
