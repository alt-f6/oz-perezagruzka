import { describe, it, expect } from "vitest";
import { summarizeLessons, isLessonReadyToPublish, type LessonAuditRow } from "./audit-lms-lessons";

function row(overrides: Partial<LessonAuditRow> = {}): LessonAuditRow {
  return {
    id: "lesson-1",
    moduleId: "module-1",
    isPublished: false,
    content: "",
    mediaCount: 0,
    assetCount: 0,
    presentationEmbedUrl: null,
    ...overrides,
  };
}

describe("isLessonReadyToPublish", () => {
  it("is false for a lesson with no content, media, assets, or presentation", () => {
    expect(isLessonReadyToPublish(row())).toBe(false);
  });

  it("is true when the lesson has non-empty content", () => {
    expect(isLessonReadyToPublish(row({ content: "Some real content" }))).toBe(true);
  });

  it("is true when the lesson has at least one media row", () => {
    expect(isLessonReadyToPublish(row({ mediaCount: 1 }))).toBe(true);
  });

  it("is true when the lesson has at least one asset row", () => {
    expect(isLessonReadyToPublish(row({ assetCount: 1 }))).toBe(true);
  });

  it("is true when the lesson has a presentationEmbedUrl", () => {
    expect(isLessonReadyToPublish(row({ presentationEmbedUrl: "https://docs.google.com/presentation/d/x/embed" }))).toBe(
      true
    );
  });

  it("is false when moduleId is missing even if content exists", () => {
    expect(isLessonReadyToPublish(row({ moduleId: "", content: "Some real content" }))).toBe(false);
  });
});

describe("summarizeLessons", () => {
  it("counts total, draft, missing-module, and empty lessons", () => {
    const lessons: LessonAuditRow[] = [
      row({ id: "l1", isPublished: true, content: "has content" }),
      row({ id: "l2", isPublished: false }),
      row({ id: "l3", isPublished: false, moduleId: "" }),
      row({ id: "l4", isPublished: true, content: "" }),
    ];

    const summary = summarizeLessons(lessons);

    expect(summary.total).toBe(4);
    expect(summary.draftCount).toBe(2);
    expect(summary.missingModuleCount).toBe(1);
    expect(summary.emptyContentCount).toBe(2);
  });
});
