import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  startOfMonth,
  startOfWeekMonday,
  toDateKey,
} from "./calendarGrid";

describe("toDateKey", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(toDateKey(new Date(Date.UTC(2026, 7, 23)))).toBe("2026-08-23");
  });
});

describe("startOfWeekMonday", () => {
  it("rolls a Sunday back to the preceding Monday", () => {
    // 2026-08-23 is a Sunday
    const result = startOfWeekMonday(new Date(2026, 7, 23));
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(17);
  });

  it("keeps a Wednesday's own Monday", () => {
    // 2026-08-19 is a Wednesday
    const result = startOfWeekMonday(new Date(2026, 7, 19));
    expect(result.getDate()).toBe(17);
  });
});

describe("startOfMonth", () => {
  it("returns the 1st of the given month", () => {
    const result = startOfMonth(new Date(2026, 7, 23));
    expect(result.getDate()).toBe(1);
    expect(result.getMonth()).toBe(7);
  });
});

describe("addDays / addMonths", () => {
  it("adds days across a month boundary", () => {
    const result = addDays(new Date(2026, 7, 30), 3);
    expect(result.getMonth()).toBe(8);
    expect(result.getDate()).toBe(2);
  });

  it("adds months and normalizes to the 1st", () => {
    const result = addMonths(new Date(2026, 7, 23), 1);
    expect(result.getMonth()).toBe(8);
    expect(result.getDate()).toBe(1);
  });
});

describe("buildMonthGrid", () => {
  it("always returns exactly 42 days starting on a Monday", () => {
    const grid = buildMonthGrid(new Date(2026, 7, 23));
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(1);
  });
});
