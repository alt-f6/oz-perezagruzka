import { NextResponse } from "next/server";
import { requireRole, rbacErrorResponse } from "@/shared/lib/rbac";
import { getStats } from "@/shared/lib/notification-metrics";

export const runtime = "nodejs";

// Read-only visibility into in-process notification failure counters, for
// ops to check delivery health without a full metrics stack.
export async function GET(): Promise<NextResponse> {
  try {
    await requireRole(["ADMIN"]);
  } catch (err) {
    return rbacErrorResponse(err);
  }

  return NextResponse.json(getStats());
}
