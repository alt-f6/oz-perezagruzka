import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { nextLessonOrder } from "@/lms/server/repos/lesson-order";

export const runtime = "nodejs";

const ACTIONS = ["publish", "unpublish", "move"] as const;
type BulkAction = (typeof ACTIONS)[number];

const MAX_IDS = 500;

// Multi-select actions from the lessons directory:
//   { action: "publish" | "unpublish", ids }        -> flip isPublished
//   { action: "move", ids, module_id }              -> append to module, keeping relative order
export const POST = withApiErrors(async (req: NextRequest) => {
  await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "") as BulkAction;
  const ids: string[] = Array.isArray(body?.ids)
    ? [...new Set<string>(body.ids.map((x: unknown) => String(x).trim()).filter(Boolean))]
    : [];

  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }
  if (ids.length === 0 || ids.length > MAX_IDS) {
    return NextResponse.json({ ok: false, error: "invalid_ids" }, { status: 400 });
  }

  if (action === "publish" || action === "unpublish") {
    const result = await db.lesson.updateMany({
      where: { id: { in: ids } },
      data: { isPublished: action === "publish" },
    });
    return NextResponse.json({ ok: true, updated: result.count });
  }

  const moduleId = body?.module_id ? String(body.module_id).trim() : "";
  if (!moduleId) return NextResponse.json({ ok: false, error: "module_required" }, { status: 400 });

  const target = await db.module.findUnique({ where: { id: moduleId }, select: { id: true } });
  if (!target) return NextResponse.json({ ok: false, error: "module_not_found" }, { status: 400 });

  const updated = await db.$transaction(async (tx) => {
    // Lessons already in the target module stay where they are.
    const lessons = await tx.lesson.findMany({
      where: { id: { in: ids }, moduleId: { not: moduleId } },
      orderBy: [{ module: { course: { title: "asc" } } }, { module: { order: "asc" } }, { order: "asc" }, { id: "asc" }],
      select: { id: true },
    });

    let order = await nextLessonOrder(moduleId, tx);
    for (const lesson of lessons) {
      await tx.lesson.update({ where: { id: lesson.id }, data: { moduleId, order } });
      order += 1;
    }
    return lessons.length;
  });

  return NextResponse.json({ ok: true, updated });
});
