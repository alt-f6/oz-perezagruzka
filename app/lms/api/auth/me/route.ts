import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cookieName, verify, getUserBySession } from "@/lms/server/auth/session";
import { withApiErrors } from "@/lms/server/http/api-guard";

export const runtime = "nodejs";

export const GET = withApiErrors(async () => {
  const jar = await cookies();
  const raw = jar.get(cookieName())?.value;

  if (!raw) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const token = verify(raw);
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const user = await getUserBySession(token);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, user });
});
