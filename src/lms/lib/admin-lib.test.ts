import { describe, expect, it } from "vitest";

import { formatBytes, formatRelativeRu, pluralRu } from "./admin-format";
import { getLessonContentKinds, hasLessonContent } from "./lesson-readiness";
import { hasActiveLessonFilters, lessonFiltersToQuery, parseLessonFilters } from "./lesson-filters";
import { parseCourseFacets } from "./course-facets";

describe("pluralRu", () => {
  it.each([
    [1, "урок"],
    [2, "урока"],
    [5, "уроков"],
    [11, "уроков"],
    [21, "урок"],
    [104, "урока"],
    [112, "уроков"],
  ])("%i -> %s", (n, expected) => {
    expect(pluralRu(n, ["урок", "урока", "уроков"])).toBe(expected);
  });
});

describe("formatBytes", () => {
  it("formats across units with a Russian decimal comma", () => {
    expect(formatBytes(0)).toBe("0 Б");
    expect(formatBytes(512)).toBe("512 Б");
    expect(formatBytes(1536)).toBe("1,5 КБ");
    expect(formatBytes(38.2 * 1024 ** 3)).toBe("38 ГБ");
  });
});

describe("formatRelativeRu", () => {
  const now = new Date("2026-09-24T12:00:00Z");
  it("uses relative phrases for recent dates", () => {
    expect(formatRelativeRu(new Date("2026-09-24T11:59:30Z"), now)).toBe("только что");
    expect(formatRelativeRu(new Date("2026-09-24T11:55:00Z"), now)).toBe("5 минут назад");
    expect(formatRelativeRu(new Date("2026-09-24T10:00:00Z"), now)).toBe("2 часа назад");
    expect(formatRelativeRu(new Date("2026-09-23T10:00:00Z"), now)).toBe("вчера");
    expect(formatRelativeRu("2026-09-20T12:00:00Z", now)).toBe("4 дня назад");
  });
});

describe("getLessonContentKinds", () => {
  const base = { content: "", presentationEmbedUrl: null, media: [], assets: [] };

  it("reports no kinds for an empty lesson", () => {
    expect(getLessonContentKinds(base)).toEqual([]);
    expect(hasLessonContent(base)).toBe(false);
  });

  it("dedupes and orders kinds from media, assets, slides url and text", () => {
    expect(
      getLessonContentKinds({
        content: "  Конспект ",
        presentationEmbedUrl: "https://docs.google.com/presentation/d/x/embed",
        media: [{ kind: "video" }, { kind: "video" }],
        assets: [{ kind: "audio" }, { kind: "pdf" }, { kind: "pdf" }],
      }),
    ).toEqual(["video", "slides", "pdf", "audio", "text"]);
  });

  it("ignores whitespace-only text and treats presentation media as slides", () => {
    expect(getLessonContentKinds({ ...base, content: "   ", media: [{ kind: "presentation" }] })).toEqual(["slides"]);
  });
});

describe("parseLessonFilters", () => {
  it("accepts valid values and normalizes exam case", () => {
    expect(
      parseLessonFilters({ q: "  дроби ", exam: "ege", subject: "Математика", status: "draft", course: "c1" }),
    ).toEqual({ q: "дроби", exam: "EGE", subject: "Математика", status: "draft", course: "c1" });
  });

  it("drops unknown values instead of failing", () => {
    const f = parseLessonFilters({ exam: "SAT", subject: "Астрология", status: "archived", q: "   " });
    expect(f).toEqual({ q: null, exam: null, subject: null, status: null, course: null });
    expect(hasActiveLessonFilters(f)).toBe(false);
  });

  it("takes the first value of repeated params", () => {
    expect(parseLessonFilters({ exam: ["OGE", "EGE"] }).exam).toBe("OGE");
  });

  it("round-trips to a query string without empty values", () => {
    expect(lessonFiltersToQuery({ q: "a b", exam: "OGE", subject: null })).toBe("?q=a+b&exam=OGE");
    expect(lessonFiltersToQuery({})).toBe("");
  });
});

describe("parseCourseFacets", () => {
  it("leaves absent fields untouched", () => {
    expect(parseCourseFacets({ title: "x" })).toEqual({ ok: true, data: {} });
  });

  it("accepts valid values and clears on empty", () => {
    expect(parseCourseFacets({ subject: "История", exam_type: "oge", grade: "9" })).toEqual({
      ok: true,
      data: { subject: "История", examType: "OGE", grade: 9 },
    });
    expect(parseCourseFacets({ subject: "", exam_type: null, grade: "" })).toEqual({
      ok: true,
      data: { subject: null, examType: null, grade: null },
    });
  });

  it("rejects values outside the vocabulary", () => {
    expect(parseCourseFacets({ subject: "Math" })).toEqual({ ok: false, error: "invalid_subject" });
    expect(parseCourseFacets({ exam_type: "BOTH" })).toEqual({ ok: false, error: "invalid_exam_type" });
    expect(parseCourseFacets({ grade: 7 })).toEqual({ ok: false, error: "invalid_grade" });
  });
});
