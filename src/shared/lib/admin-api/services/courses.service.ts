import { db } from "@/shared/lib/db";
import { notFound } from "../errors";
import { toMoscowIso } from "../time";
import { normalizeLimit, optionalCursor, requireId, toPage, type Page } from "../validation";

// Read models for course content. No person data lives here except the course
// owner, which is deliberately not exposed.

export type PublishStatus = "published" | "draft";

const statusOf = (isPublished: boolean): PublishStatus => (isPublished ? "published" : "draft");

export interface CourseListItem {
  id: string;
  title: string;
  status: PublishStatus;
  subject: string | null;
  examType: string | null;
  grade: number | null;
  moduleCount: number;
  lessonCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function listCourses(input: { limit?: unknown; cursor?: unknown } = {}): Promise<Page<CourseListItem>> {
  const limit = normalizeLimit(input.limit);
  const cursor = optionalCursor(input.cursor, "cursor");

  const rows = await db.course.findMany({
    orderBy: [{ title: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      isPublished: true,
      subject: true,
      examType: true,
      grade: true,
      createdAt: true,
      updatedAt: true,
      modules: { select: { _count: { select: { lessons: true } } } },
    },
  });

  return toPage(rows, limit, (c) => ({
    id: c.id,
    title: c.title,
    status: statusOf(c.isPublished),
    subject: c.subject,
    examType: c.examType,
    grade: c.grade,
    moduleCount: c.modules.length,
    lessonCount: c.modules.reduce((sum, m) => sum + m._count.lessons, 0),
    createdAt: toMoscowIso(c.createdAt),
    updatedAt: toMoscowIso(c.updatedAt),
  }));
}

// Material metadata only: storage keys and signed URLs never leave the server.
const assetSelect = {
  id: true,
  kind: true,
  title: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  order: true,
  isPublic: true,
} as const;

const mediaSelect = {
  id: true,
  kind: true,
  title: true,
  provider: true,
  url: true,
  order: true,
  isPublic: true,
} as const;

type AssetRow = {
  id: string;
  kind: string;
  title: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: bigint;
  order: number;
  isPublic: boolean;
};

function mapAsset(a: AssetRow) {
  return {
    id: a.id,
    kind: a.kind,
    title: a.title,
    fileName: a.originalName,
    mimeType: a.mimeType,
    sizeBytes: Number(a.sizeBytes),
    order: a.order,
    isPublic: a.isPublic,
  };
}

export async function getCourseTree(rawId: unknown) {
  const id = requireId(rawId, "Курс");
  const course = await db.course.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      isPublished: true,
      subject: true,
      examType: true,
      grade: true,
      createdAt: true,
      updatedAt: true,
      modules: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
          isPublished: true,
          unlockMode: true,
          unlockAfterDays: true,
          unlockAt: true,
          lessons: {
            orderBy: [{ order: "asc" }, { id: "asc" }],
            select: {
              id: true,
              title: true,
              isPublished: true,
              order: true,
              videoUrl: true,
              videoDurationSec: true,
              presentationEmbedUrl: true,
              practiceLinkUrl: true,
              homeworkTask: true,
              updatedAt: true,
              assets: { orderBy: { order: "asc" }, select: assetSelect },
              media: { orderBy: { order: "asc" }, select: mediaSelect },
            },
          },
        },
      },
    },
  });
  if (!course) throw notFound("Курс");

  return {
    id: course.id,
    title: course.title,
    description: course.description,
    status: statusOf(course.isPublished),
    subject: course.subject,
    examType: course.examType,
    grade: course.grade,
    createdAt: toMoscowIso(course.createdAt),
    updatedAt: toMoscowIso(course.updatedAt),
    modules: course.modules.map((m, index) => ({
      id: m.id,
      position: index + 1,
      title: m.title,
      description: m.description,
      status: statusOf(m.isPublished),
      unlock: {
        mode: m.unlockMode,
        afterDays: m.unlockAfterDays,
        at: m.unlockAt ? toMoscowIso(m.unlockAt) : null,
      },
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        status: statusOf(l.isPublished),
        order: l.order,
        updatedAt: toMoscowIso(l.updatedAt),
        materials: {
          hasVideo: Boolean(l.videoUrl) || l.media.length > 0,
          videoDurationSec: l.videoDurationSec,
          hasPresentation: Boolean(l.presentationEmbedUrl),
          hasPractice: Boolean(l.practiceLinkUrl),
          hasHomework: Boolean(l.homeworkTask?.trim()),
          assets: l.assets.map(mapAsset),
          media: l.media,
        },
      })),
    })),
  };
}

export async function getLesson(rawId: unknown) {
  const id = requireId(rawId, "Урок");
  const lesson = await db.lesson.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      content: true,
      isPublished: true,
      order: true,
      videoUrl: true,
      videoProvider: true,
      videoEmbedUrl: true,
      videoDurationSec: true,
      videoPosterUrl: true,
      practiceLinkUrl: true,
      practiceLinkLabel: true,
      presentationEmbedUrl: true,
      homeworkTask: true,
      createdAt: true,
      updatedAt: true,
      module: { select: { id: true, title: true, course: { select: { id: true, title: true } } } },
      assets: { orderBy: { order: "asc" }, select: assetSelect },
      media: { orderBy: { order: "asc" }, select: { ...mediaSelect, embedUrl: true } },
    },
  });
  if (!lesson) throw notFound("Урок");

  // Ordered as a student sees the lesson page.
  const blocks: Array<Record<string, unknown>> = [];
  if (lesson.description.trim()) blocks.push({ type: "description", text: lesson.description });
  if (lesson.videoUrl) {
    blocks.push({
      type: "video",
      url: lesson.videoUrl,
      provider: lesson.videoProvider,
      embedUrl: lesson.videoEmbedUrl,
      durationSec: lesson.videoDurationSec,
      posterUrl: lesson.videoPosterUrl,
    });
  }
  for (const m of lesson.media) blocks.push({ type: "media", ...m });
  if (lesson.content.trim()) blocks.push({ type: "content", body: lesson.content });
  if (lesson.presentationEmbedUrl) blocks.push({ type: "presentation", embedUrl: lesson.presentationEmbedUrl });
  for (const a of lesson.assets) blocks.push({ type: "asset", ...mapAsset(a) });
  if (lesson.practiceLinkUrl) {
    blocks.push({ type: "practice", url: lesson.practiceLinkUrl, label: lesson.practiceLinkLabel });
  }
  if (lesson.homeworkTask?.trim()) blocks.push({ type: "homework", text: lesson.homeworkTask });

  return {
    id: lesson.id,
    title: lesson.title,
    status: statusOf(lesson.isPublished),
    order: lesson.order,
    module: { id: lesson.module.id, title: lesson.module.title },
    course: lesson.module.course,
    createdAt: toMoscowIso(lesson.createdAt),
    updatedAt: toMoscowIso(lesson.updatedAt),
    blocks,
  };
}
