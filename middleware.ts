import { NextResponse, type NextRequest } from "next/server";
import { hasSignedSessionCookie } from "@/shared/lib/auth";

export const config = {
  matcher: ["/crm/:path*", "/lms/:path*"],
};

const PUBLIC_PREFIXES = [
  "/crm/api/auth",
  "/crm/register",
  "/crm/login",
  "/lms/api/auth",
  "/lms/login",
  "/crm/api/webhooks", // signature-verified separately, see app/crm/api/webhooks/**
];

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/crm/api") || pathname.startsWith("/lms/api");
}

function loginPathFor(pathname: string): string {
  return pathname.startsWith("/lms") ? "/lms/login" : "/crm/login";
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (hasSignedSessionCookie(req)) {
    return NextResponse.next();
  }

  if (isApiPath(pathname)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL(loginPathFor(pathname), req.url);
  return NextResponse.redirect(loginUrl);
}
