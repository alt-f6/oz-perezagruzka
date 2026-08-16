import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifyToken, destroySession } from "@/shared/lib/auth";
import { withApiErrors } from "@/lms/server/http/api-guard";

export const runtime = "nodejs";

async function requireSameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("host");

  if (!origin || !host) return false;

  try {
    const u = new URL(origin);
    return u.host === host;
  } catch {
    return false;
  }
}

export const POST = withApiErrors(async () => {
  if (!(await requireSameOrigin())) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;

  if (raw) {
    const token = verifyToken(raw);
    if (token) await destroySession(token);
  }

  const res = NextResponse.json({ ok: true });

  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });

  return res;
});
