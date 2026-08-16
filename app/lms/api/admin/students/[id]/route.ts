import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRoleApi } from "@/lms/server/auth/require-role-api";
import { withApiErrors } from "@/lms/server/http/api-guard";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function readId({ params }: Ctx) {
  const { id } = await params;
  if (!id) return null;
  return id;
}

export const DELETE = withApiErrors(async (_: NextRequest, ctx: Ctx) => {
  const user = await requireRoleApi("ADMIN");
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const id = await readId(ctx);
  if (!id) return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });

  try {
    const existing = await db.user.findUnique({ where: { id } });

    if (!existing || existing.role !== "STUDENT") {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    await db.user.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 409 });
  }
});
