import { describe, expect, it } from "vitest";
import { assignOverlapColumns } from "./calendarLayout";

function s(id: string, hour: number, minute: number, durationMinutes: number) {
  return {
    id,
    scheduledAt: new Date(2026, 7, 23, hour, minute),
    durationMinutes,
  };
}

describe("assignOverlapColumns", () => {
  it("gives every non-overlapping session column 0 and columnCount 1", () => {
    const result = assignOverlapColumns([s("a", 9, 0, 60), s("b", 11, 0, 60)]);
    expect(result.find((r) => r.session.id === "a")).toMatchObject({ column: 0, columnCount: 1 });
    expect(result.find((r) => r.session.id === "b")).toMatchObject({ column: 0, columnCount: 1 });
  });

  it("splits two fully-overlapping sessions into columns 0 and 1, both with columnCount 2", () => {
    const result = assignOverlapColumns([s("a", 9, 0, 60), s("b", 9, 0, 60)]);
    const a = result.find((r) => r.session.id === "a")!;
    const b = result.find((r) => r.session.id === "b")!;
    expect([a.column, b.column].sort()).toEqual([0, 1]);
    expect(a.columnCount).toBe(2);
    expect(b.columnCount).toBe(2);
  });

  it("reuses a freed column once its previous occupant has ended", () => {
    const result = assignOverlapColumns([
      s("a", 9, 0, 30), // 9:00-9:30
      s("b", 9, 15, 30), // 9:15-9:45, overlaps a -> column 1
      s("c", 9, 30, 30), // 9:30-10:00, a has ended -> can reuse column 0
    ]);
    const byId = Object.fromEntries(result.map((r) => [r.session.id, r]));
    expect(byId.a.column).toBe(0);
    expect(byId.b.column).toBe(1);
    expect(byId.c.column).toBe(0);
  });

  it("keeps two separate overlap clusters from inflating each other's columnCount", () => {
    const result = assignOverlapColumns([
      s("a", 9, 0, 30),
      s("b", 9, 0, 30),
      s("c", 12, 0, 30), // no overlap with a/b
    ]);
    const byId = Object.fromEntries(result.map((r) => [r.session.id, r]));
    expect(byId.a.columnCount).toBe(2);
    expect(byId.b.columnCount).toBe(2);
    expect(byId.c.columnCount).toBe(1);
  });
});
