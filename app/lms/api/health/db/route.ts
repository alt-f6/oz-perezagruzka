import { NextResponse } from "next/server";
import { pool } from "@/lms/server/db/pool";
import { withApiErrors } from "@/lms/server/http/api-guard";

export const runtime = "nodejs";

export const GET = withApiErrors(async () => {
  const r = await pool.query("SELECT 1 as ok");
  return NextResponse.json({ ok: r.rows?.[0]?.ok === 1 });
});
