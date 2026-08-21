import { NextResponse, type NextRequest } from "next/server";
import {
  CRM_ROLES,
  LMS_ROLES,
  getSessionUserFromRequest,
} from "@/shared/lib/auth";

// Fail-closed model: every CRM/LMS path requires a session UNLESS it's
// explicitly listed here as public, or is a static asset request (has a file
// extension, e.g. /pdf.worker.min.mjs). This is the inverse of an
// allowlist-of-protected-prefixes, which silently leaves a newly added page
// or API route unauthenticated at the edge until someone remembers to list
// it. New routes are protected by default; only these known, intentionally
// public surfaces opt out.
const CRM_PUBLIC_PAGE_PREFIXES = ["/admin/login", "/register"];
// /api/auth/* (login/logout/register) and /api/health/* must stay reachable
// pre-auth; /api/cron/* is gated by CRON_SECRET, /api/webhooks/* by its own
// signature/IP checks -- neither uses session auth at all.
const CRM_PUBLIC_API_PREFIXES = ["/api/auth", "/api/health", "/api/cron", "/api/webhooks"];

const LMS_PUBLIC_PAGE_PREFIXES = ["/login"];
const LMS_PUBLIC_API_PREFIXES = ["/api/auth", "/api/health"];

// PARENT is only ever allowed onto the CRM parent portal, nowhere else.
const CRM_PARENT_PORTAL_PREFIX = "/parent";

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

// Static files (icons, worker scripts, sandbox HTML, ...) served from
// public/<app>/** carry a file extension and are never gated behind a
// session -- they're either public by nature or only ever fetched by an
// already-authenticated page that will itself have been gated.
function isStaticAssetPath(pathname: string) {
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

function isPublicPath(app: "crm" | "lms", pathname: string) {
  if (isStaticAssetPath(pathname)) return true;
  const publicPrefixes =
    app === "crm"
      ? [...CRM_PUBLIC_PAGE_PREFIXES, ...CRM_PUBLIC_API_PREFIXES]
      : [...LMS_PUBLIC_PAGE_PREFIXES, ...LMS_PUBLIC_API_PREFIXES];
  return matchesPrefix(pathname, publicPrefixes);
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

  if (!isPublicPath(app, pathname)) {
    const isParentPortal = app === "crm" && matchesPrefix(pathname, [CRM_PARENT_PORTAL_PREFIX]);
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
