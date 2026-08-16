import { NextRequest, NextResponse } from "next/server";

export function apiError(e: unknown) {
  const status =
    typeof e === "object" && e && "status" in e && typeof (e as any).status === "number"
      ? (e as any).status
      : 500;

  const message =
    e instanceof Error ? e.message : "server error";

  return NextResponse.json(
    { ok: false, error: message },
    { status }
  );
}
