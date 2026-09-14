import { describe, expect, it } from "vitest";
import {
  buildLessonsQuery,
  classifyLessonAttendance,
  needsAttention,
  parseLessonListFilters,
  resolveLessonDateWindow,
} from "./lessonFilters";

describe("parseLessonListFilters", () => {
  it("flattens array-valued query params to their first value", () => {
    const result = parseLessonListFilters({ q: ["a", "b"], page: "2" });
    expect(result.q).toBe("a");
    expect(result.page).toBe(2);
  });

  it("defaults a fully empty query", () => {
    const result = parseLessonListFilters({});
    expect(result.format).toBe("ALL");
    expect(result.page).toBe(1);
  });
});

describe("resolveLessonDateWindow", () => {
  const now = new Date("2026-03-12T09:00:00.000Z"); // some Thursday-ish MSK midday

  it("defaults to today onward, ascending, when nothing is set", () => {
    const window = resolveLessonDateWindow({ range: null, status: "ALL", from: undefined, to: undefined }, now);
    expect(window.orderDirection).toBe("asc");
    expect(window.gte).toBeDefined();
    expect(window.lt).toBeUndefined();
    expect(window.gte!.getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it("TODAY preset bounds to just that MSK day", () => {
    const window = resolveLessonDateWindow({ range: "TODAY", status: "ALL", from: undefined, to: undefined }, now);
    expect(window.lt!.getTime() - window.gte!.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("TOMORROW preset starts one MSK day after TODAY's window", () => {
    const today = resolveLessonDateWindow({ range: "TODAY", status: "ALL", from: undefined, to: undefined }, now);
    const tomorrow = resolveLessonDateWindow(
      { range: "TOMORROW", status: "ALL", from: undefined, to: undefined },
      now,
    );
    expect(tomorrow.gte!.getTime()).toBe(today.lt!.getTime());
  });

  it("THIS_WEEK preset spans exactly 7 days", () => {
    const window = resolveLessonDateWindow(
      { range: "THIS_WEEK", status: "ALL", from: undefined, to: undefined },
      now,
    );
    expect(window.lt!.getTime() - window.gte!.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("an explicit custom range always wins over status/preset", () => {
    const window = resolveLessonDateWindow(
      { range: "TODAY", status: "COMPLETED", from: "2026-01-01", to: "2026-01-02" },
      now,
    );
    expect(window.lt!.getTime() - window.gte!.getTime()).toBe(2 * 24 * 60 * 60 * 1000);
  });

  it("a from-only custom range has no upper bound", () => {
    const window = resolveLessonDateWindow({ range: null, status: "ALL", from: "2026-01-01", to: undefined }, now);
    expect(window.gte).toBeDefined();
    expect(window.lt).toBeUndefined();
  });

  it("COMPLETED with no preset/range shows full history, most recent first", () => {
    const window = resolveLessonDateWindow({ range: null, status: "COMPLETED", from: undefined, to: undefined }, now);
    expect(window.gte).toBeUndefined();
    expect(window.lt).toBeUndefined();
    expect(window.orderDirection).toBe("desc");
  });

  it("CANCELLED with no preset/range shows full history, most recent first", () => {
    const window = resolveLessonDateWindow({ range: null, status: "CANCELLED", from: undefined, to: undefined }, now);
    expect(window.gte).toBeUndefined();
    expect(window.orderDirection).toBe("desc");
  });

  it("NEEDS_ATTENTION is bounded to the past, oldest-first", () => {
    const window = resolveLessonDateWindow(
      { range: null, status: "NEEDS_ATTENTION", from: undefined, to: undefined },
      now,
    );
    expect(window.gte).toBeUndefined();
    expect(window.lt).toEqual(now);
    expect(window.orderDirection).toBe("asc");
  });
});

describe("classifyLessonAttendance", () => {
  it("is CANCELLED regardless of counts when the session itself is cancelled", () => {
    expect(
      classifyLessonAttendance({ sessionStatus: "cancelled", concluded: true, enrolledCount: 5, markedCount: 0 }),
    ).toBe("CANCELLED");
  });

  it("is SCHEDULED for a not-yet-concluded session", () => {
    expect(
      classifyLessonAttendance({ sessionStatus: "scheduled", concluded: false, enrolledCount: 5, markedCount: 0 }),
    ).toBe("SCHEDULED");
  });

  it("is UNMARKED when concluded with zero attendance rows", () => {
    expect(
      classifyLessonAttendance({ sessionStatus: "scheduled", concluded: true, enrolledCount: 5, markedCount: 0 }),
    ).toBe("UNMARKED");
  });

  it("is PARTIALLY_MARKED when some but not all enrolled students are marked", () => {
    expect(
      classifyLessonAttendance({ sessionStatus: "scheduled", concluded: true, enrolledCount: 5, markedCount: 3 }),
    ).toBe("PARTIALLY_MARKED");
  });

  it("is COMPLETED when every enrolled student is marked", () => {
    expect(
      classifyLessonAttendance({ sessionStatus: "scheduled", concluded: true, enrolledCount: 5, markedCount: 5 }),
    ).toBe("COMPLETED");
  });

  it("is COMPLETED (never UNMARKED) when nobody is enrolled at all", () => {
    expect(
      classifyLessonAttendance({ sessionStatus: "scheduled", concluded: true, enrolledCount: 0, markedCount: 0 }),
    ).toBe("COMPLETED");
  });
});

describe("needsAttention", () => {
  it("is true only for UNMARKED and PARTIALLY_MARKED", () => {
    expect(needsAttention("UNMARKED")).toBe(true);
    expect(needsAttention("PARTIALLY_MARKED")).toBe(true);
    expect(needsAttention("COMPLETED")).toBe(false);
    expect(needsAttention("SCHEDULED")).toBe(false);
    expect(needsAttention("CANCELLED")).toBe(false);
  });
});

describe("buildLessonsQuery", () => {
  it("resets page to 1 when a filter changes", () => {
    const next = buildLessonsQuery({ q: "old", page: "3" }, { q: "new" });
    expect(next).toEqual({ q: "new", page: "1" });
  });

  it("does not reset page when only page itself changes", () => {
    const next = buildLessonsQuery({ q: "x", page: "2" }, { page: "3" });
    expect(next).toEqual({ q: "x", page: "3" });
  });

  it("removes a key when patched with null/undefined/empty string", () => {
    const next = buildLessonsQuery({ q: "x", teacherId: "t1", page: "2" }, { teacherId: null });
    expect(next).toEqual({ q: "x", page: "1" });
  });

  it("resets page to 1 when pageSize changes", () => {
    const next = buildLessonsQuery({ page: "5", pageSize: "25" }, { pageSize: "50" });
    expect(next).toEqual({ pageSize: "50", page: "1" });
  });
});
