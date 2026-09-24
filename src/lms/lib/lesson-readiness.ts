// Which kinds of material a lesson carries, for the admin directory's content
// chips and "без материалов" filter. Mirrors isLessonReadyToPublish in
// scripts/audit-lms-lessons.ts: a lesson is "ready" when it has at least one.

export type LessonContentKind = "video" | "pdf" | "audio" | "slides" | "text";

export type LessonContentInput = {
  content: string;
  presentationEmbedUrl: string | null;
  media: { kind: string }[];
  assets: { kind: string }[];
};

const KIND_ORDER: LessonContentKind[] = ["video", "slides", "pdf", "audio", "text"];

export function getLessonContentKinds(lesson: LessonContentInput): LessonContentKind[] {
  const kinds = new Set<LessonContentKind>();

  for (const m of lesson.media) {
    kinds.add(m.kind === "presentation" ? "slides" : "video");
  }
  for (const a of lesson.assets) {
    if (a.kind === "pdf") kinds.add("pdf");
    else if (a.kind === "audio") kinds.add("audio");
    else if (a.kind === "presentation") kinds.add("slides");
  }
  if (lesson.presentationEmbedUrl?.trim()) kinds.add("slides");
  if (lesson.content.trim()) kinds.add("text");

  return KIND_ORDER.filter((k) => kinds.has(k));
}

export function hasLessonContent(lesson: LessonContentInput): boolean {
  return getLessonContentKinds(lesson).length > 0;
}
