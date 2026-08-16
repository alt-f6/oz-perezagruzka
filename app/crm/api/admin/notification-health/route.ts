import { NextResponse } from "next/server";
import { getSessionUser } from "@/shared/lib/auth";
import { getStats } from "@/shared/lib/notification-metrics";

export const runtime = "nodejs";

// Read-only visibility into in-process notification failure counters, for
// ops to check delivery health without a full metrics stack.
export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json(getStats());
}
