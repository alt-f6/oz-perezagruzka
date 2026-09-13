import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { withApiErrors } from "@/lms/server/http/api-guard";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const UNLOCK_MODES = ["MANUAL", "DRIP_ENROLLMENT", "FIXED_DATE"] as const;

export const GET = withApiErrors(async (_req: NextRequest, ctx: Ctx) => {
  await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });
  const { id: courseId } = await ctx.params;

  const modules = await db.module.findMany({
    where: { courseId },
    select: { id: true, title: true, description: true, order: true, isPublished: true, unlockMode: true, unlockAfterDays: true, unlockAt: true },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ ok: true, modules });
});

export const POST = withApiErrors(async (req: NextRequest, ctx: Ctx) => {
  await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });
  const { id: courseId } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ ok: false, error: "title_required" }, { status: 400 });

  const unlockMode = String(body.unlockMode ?? "MANUAL");
  if (!UNLOCK_MODES.includes(unlockMode as (typeof UNLOCK_MODES)[number])) {
    return NextResponse.json({ ok: false, error: "invalid_unlock_mode" }, { status: 400 });
  }

  const description = body.description ? String(body.description) : null;
  const unlockAfterDays = unlockMode === "DRIP_ENROLLMENT" ? Number(body.unlockAfterDays ?? 0) : null;
  const unlockAt = unlockMode === "FIXED_DATE" && body.unlockAt ? new Date(String(body.unlockAt)) : null;

  if (unlockAfterDays !== null && (!Number.isInteger(unlockAfterDays) || unlockAfterDays < 0)) {
    return NextResponse.json({ ok: false, error: "invalid_unlock_after_days" }, { status: 400 });
  }

  if (unlockMode === "FIXED_DATE" && (!unlockAt || Number.isNaN(unlockAt.getTime()))) {
    return NextResponse.json({ ok: false, error: "invalid_unlock_at" }, { status: 400 });
  }

  const max = await db.module.aggregate({ where: { courseId }, _max: { order: true } });

  const createdModule = await db.module.create({
    data: {
      courseId,
      title,
      description,
      order: (max._max.order ?? -1) + 1,
      unlockMode: unlockMode as (typeof UNLOCK_MODES)[number],
      unlockAfterDays,
      unlockAt,
    },
    select: { id: true, title: true, order: true, unlockMode: true },
  });

  return NextResponse.json({ ok: true, module: createdModule });
});
