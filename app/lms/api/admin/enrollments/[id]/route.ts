import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { parseAccessThrough } from "@/lms/lib/enrollment-access";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const STATUSES = ["ACTIVE", "SUSPENDED", "COMPLETED"] as const;

// Partial update of one enrollment: { status?, access_through_module? }.
export const PATCH = withApiErrors(async (req: NextRequest, ctx: Ctx) => {
  await requireRole(["ADMIN"], { adminBypass: true });
  const { id } = await ctx.params;

  const enrollment = await db.enrollment.findUnique({
    where: { id },
    select: { id: true, course: { select: { _count: { select: { modules: true } } } } },
  });
  if (!enrollment) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Prisma.EnrollmentUpdateInput = {};

  if ("status" in body) {
    const status = String(body.status ?? "");
    if (!(STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
    }
    data.status = status as (typeof STATUSES)[number];
    data.completedAt = status === "COMPLETED" ? new Date() : null;
  }

  if ("access_through_module" in body) {
    const access = parseAccessThrough(body.access_through_module, enrollment.course._count.modules);
    if (!access.ok) return NextResponse.json({ ok: false, error: "invalid_access" }, { status: 400 });
    data.accessThroughModule = access.value;
  }

  const updated = await db.enrollment.update({
    where: { id },
    data,
    select: { id: true, status: true, accessThroughModule: true },
  });
  return NextResponse.json({ ok: true, enrollment: updated });
});

export const DELETE = withApiErrors(async (_req: NextRequest, ctx: Ctx) => {
  await requireRole(["ADMIN"], { adminBypass: true });
  const { id } = await ctx.params;

  const r = await db.enrollment.deleteMany({ where: { id } });
  if (r.count === 0) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
});
