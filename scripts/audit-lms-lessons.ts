/**
 * Audits LMS lesson publishing readiness and (optionally, with --publish-ready)
 * publishes lessons that already have real content attached.
 *
 * Audit mode (default, no flags): prints a summary of total lessons, draft
 * lessons, lessons missing a module, and lessons with no attached content
 * (no lesson text, no video, no presentation link, no uploaded asset).
 *
 * Scoped publish mode: --publish-ready [--course=<id>|--course=all] [--dry-run]
 * Sets isPublished: true ONLY for lessons that have a moduleId AND at least
 * one of: non-empty content, a LessonMedia row, a LessonAsset row, or a
 * presentationEmbedUrl. --dry-run prints what would change without writing.
 *
 * Run: npx tsx scripts/audit-lms-lessons.ts [--publish-ready [--course=<id|all>] [--dry-run]]
 */
import "dotenv/config";
import { db } from "@/shared/lib/db";

export type LessonAuditRow = {
  id: string;
  moduleId: string;
  isPublished: boolean;
  content: string;
  mediaCount: number;
  assetCount: number;
  presentationEmbedUrl: string | null;
};

export type LessonAuditSummary = {
  total: number;
  draftCount: number;
  missingModuleCount: number;
  emptyContentCount: number;
};

export function isLessonReadyToPublish(lesson: LessonAuditRow): boolean {
  if (!lesson.moduleId) return false;

  const hasContent = lesson.content.trim().length > 0;
  const hasMedia = lesson.mediaCount > 0;
  const hasAsset = lesson.assetCount > 0;
  const hasPresentation = Boolean(lesson.presentationEmbedUrl?.trim());

  return hasContent || hasMedia || hasAsset || hasPresentation;
}

export function summarizeLessons(lessons: LessonAuditRow[]): LessonAuditSummary {
  let draftCount = 0;
  let missingModuleCount = 0;
  let emptyContentCount = 0;

  for (const lesson of lessons) {
    if (!lesson.isPublished) draftCount++;
    if (!lesson.moduleId) {
      missingModuleCount++;
    } else if (!isLessonReadyToPublish(lesson)) {
      emptyContentCount++;
    }
  }

  return { total: lessons.length, draftCount, missingModuleCount, emptyContentCount };
}

async function loadAuditRows(courseId?: string): Promise<LessonAuditRow[]> {
  const lessons = await db.lesson.findMany({
    where: courseId ? { module: { courseId } } : undefined,
    select: {
      id: true,
      moduleId: true,
      isPublished: true,
      content: true,
      presentationEmbedUrl: true,
      _count: { select: { media: true, assets: true } },
    },
  });

  return lessons.map((l) => ({
    id: l.id,
    moduleId: l.moduleId,
    isPublished: l.isPublished,
    content: l.content,
    mediaCount: l._count.media,
    assetCount: l._count.assets,
    presentationEmbedUrl: l.presentationEmbedUrl,
  }));
}

function parseCourseArg(): string | undefined {
  const arg = process.argv.find((a) => a.startsWith("--course="));
  if (!arg) return undefined;
  const value = arg.slice("--course=".length);
  return value === "all" ? undefined : value;
}

async function runAudit() {
  const rows = await loadAuditRows();
  const summary = summarizeLessons(rows);

  console.log("LMS lesson audit:");
  console.log(`  Total lessons:            ${summary.total}`);
  console.log(`  Draft (unpublished):      ${summary.draftCount}`);
  console.log(`  Missing a module:         ${summary.missingModuleCount}`);
  console.log(`  No content/media/asset:   ${summary.emptyContentCount}`);
}

async function runPublishReady(dryRun: boolean) {
  const courseId = parseCourseArg();
  const rows = await loadAuditRows(courseId);
  const candidates = rows.filter((r) => !r.isPublished && isLessonReadyToPublish(r));

  if (candidates.length === 0) {
    console.log("No draft lessons are ready to publish (need moduleId + content/media/asset/presentation).");
    return;
  }

  console.log(`${dryRun ? "Would publish" : "Publishing"} ${candidates.length} lesson(s):`);
  for (const lesson of candidates) {
    console.log(`  ${dryRun ? "WOULD PUBLISH" : "PUBLISH"} ${lesson.id}`);
  }

  if (!dryRun) {
    await db.lesson.updateMany({
      where: { id: { in: candidates.map((c) => c.id) } },
      data: { isPublished: true },
    });
  } else {
    console.log("Re-run without --dry-run to apply.");
  }
}

async function main() {
  const publishReady = process.argv.includes("--publish-ready");
  const dryRun = process.argv.includes("--dry-run");

  if (publishReady) {
    await runPublishReady(dryRun);
  } else {
    await runAudit();
  }
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
