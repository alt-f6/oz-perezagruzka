import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { canViewLesson } from "@/lms/server/access/can-view-lesson";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function readLessonId({ params }: Ctx) {
  const { id } = await params;
  if (!id) {
    return null;
  }

  return id;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const me = await requireRole(["STUDENT"], { adminBypass: true });

  const lessonId = await readLessonId(ctx);
  if (!lessonId) {
    return NextResponse.json({ ok: false, error: "bad lessonId" }, { status: 400 });
  }

  const allowed = await canViewLesson({ userId: me.id, role: me.role, lessonId });
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const items = await db.lessonAsset.findMany({
    where: { lessonId, isPublic: true },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: {
      id: true,
      kind: true,
      title: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      order: true,
      isPublic: true,
    },
  });

  return NextResponse.json({
    ok: true,
    items: items.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      original_name: item.originalName,
      mime_type: item.mimeType,
      size_bytes: item.sizeBytes,
      order: item.order,
      is_public: item.isPublic,
    })),
  });
}
