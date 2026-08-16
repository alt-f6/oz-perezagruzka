import { NextResponse } from "next/server";
import { db } from "@/shared/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Liveness/readiness probe: verifies the app can reach the database.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
