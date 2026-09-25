import type { Prisma } from "@prisma/client";

import { db } from "@/shared/lib/db";
import { normalizePresentationUrl } from "@/lms/lib/presentation-url";
import type { CurriculumLesson } from "@/lms/components/student/CurriculumSidebar";

// Lesson content shared by the student lesson page and the teacher preview:
// the lesson row plus its public media, presentations, PDFs and audio, shaped
// for LessonTheaterViewer. Access checks are the caller's job.

export async function loadLessonForView(lessonId: string, opts: { includeDrafts: boolean }) {
  return db.lesson.findUnique({
    where: opts.includeDrafts ? { id: lessonId } : { id: lessonId, isPublished: true },
    select: {
      id: true,
      title: true,
      description: true,
      content: true,
      order: true,
      isPublished: true,
      practiceLinkUrl: true,
      practiceLinkLabel: true,
      presentationEmbedUrl: true,
      homeworkTask: true,
      module: { select: { courseId: true } },
    },
  });
}

export type LessonForView = NonNullable<Awaited<ReturnType<typeof loadLessonForView>>>;

export async function loadLessonMaterials(lesson: Pick<LessonForView, "id" | "presentationEmbedUrl">) {
  const lessonId = lesson.id;

  const [mediaRows, pdfs, audio] = await Promise.all([
    db.lessonMedia.findMany({
      where: { lessonId, isPublic: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      select: { id: true, title: true, embedUrl: true, provider: true, kind: true, order: true },
    }),
    db.lessonAsset.findMany({
      where: { lessonId, kind: "pdf", isPublic: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      select: { id: true, title: true, order: true },
    }),
    db.lessonAsset.findMany({
      where: { lessonId, kind: "audio", isPublic: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      select: { id: true, title: true, order: true },
    }),
  ]);

  const media = mediaRows
    .filter((m) => m.kind !== "presentation")
    .map((m) => ({ id: m.id, title: m.title, embed_url: m.embedUrl, provider: m.provider, order: m.order }));

  // Lesson.presentationEmbedUrl (set via the admin form's "Ссылка на встроенную
  // презентацию" field) is the only mechanism the admin UI actually offers for
  // attaching a presentation -- nothing in the admin UI ever creates a
  // LessonMedia row with kind "presentation". The LessonMedia-based mapping
  // below is kept for any such row that might exist, but the Lesson-level URL
  // is the one that must render for this to work at all.
  const presentations = [
    ...(lesson.presentationEmbedUrl
      ? [
          {
            id: `${lesson.id}-presentation`,
            title: null as string | null,
            url: normalizePresentationUrl(lesson.presentationEmbedUrl),
            order: 0,
          },
        ]
      : []),
    ...mediaRows
      .filter((m) => m.kind === "presentation")
      .map((m) => ({ id: m.id, title: m.title, url: normalizePresentationUrl(m.embedUrl), order: m.order })),
  ];

  return { media, presentations, pdfs, audio };
}

/** Curriculum icon for a lesson row selected with the video media / asset kinds below. */
export function curriculumLessonFormat(row: { media: unknown[]; assets: { kind: string }[] }): CurriculumLesson["format"] {
  if (row.media.length > 0) return "video";
  if (row.assets.length === 0) return "text";
  return row.assets[0].kind === "audio" ? "audio" : "presentation";
}

export const CURRICULUM_FORMAT_SELECT = {
  media: { where: { kind: "video" }, select: { id: true }, take: 1 },
  assets: { where: { kind: { in: ["audio", "pdf", "presentation"] } }, select: { kind: true }, take: 1 },
} satisfies Prisma.LessonSelect;

export function practiceLinkOf(lesson: Pick<LessonForView, "practiceLinkUrl" | "practiceLinkLabel">) {
  return lesson.practiceLinkUrl ? { url: lesson.practiceLinkUrl, label: lesson.practiceLinkLabel } : null;
}
