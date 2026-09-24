import { describe, expect, it } from "vitest";

import { advanceAccess, describeAccess, mergeAccess, parseAccessThrough } from "./enrollment-access";
import { isWithinPaidAccess } from "@/lms/server/access/module-unlock";

describe("parseAccessThrough", () => {
  it("accepts whole-course markers and integers within the course", () => {
    expect(parseAccessThrough(null, 4)).toEqual({ ok: true, value: null });
    expect(parseAccessThrough("all", 4)).toEqual({ ok: true, value: null });
    expect(parseAccessThrough(0, 4)).toEqual({ ok: true, value: 0 });
    expect(parseAccessThrough("3", 4)).toEqual({ ok: true, value: 3 });
    expect(parseAccessThrough(4, 4)).toEqual({ ok: true, value: 4 });
  });

  it("rejects out-of-range and non-integer values", () => {
    for (const bad of [-1, 5, 1.5, "abc", "", undefined, {}]) {
      expect(parseAccessThrough(bad, 4)).toEqual({ ok: false });
    }
  });
});

describe("mergeAccess", () => {
  it("never narrows access", () => {
    expect(mergeAccess(2, 1)).toBe(2);
    expect(mergeAccess(1, 3)).toBe(3);
    expect(mergeAccess(null, 1)).toBeNull();
    expect(mergeAccess(2, null)).toBeNull();
  });
});

describe("advanceAccess", () => {
  it("steps within bounds and leaves whole-course untouched", () => {
    expect(advanceAccess(1, 4)).toBe(2);
    expect(advanceAccess(4, 4)).toBe(4);
    expect(advanceAccess(1, 4, -1)).toBe(0);
    expect(advanceAccess(0, 4, -1)).toBe(0);
    expect(advanceAccess(null, 4)).toBeNull();
  });
});

describe("describeAccess", () => {
  it("labels the cursor for the roster", () => {
    expect(describeAccess(null, 3)).toBe("Весь курс");
    expect(describeAccess(3, 3)).toBe("Весь курс");
    expect(describeAccess(0, 3)).toBe("Нет доступа к модулям");
    expect(describeAccess(2, 3)).toBe("2 из 3");
  });
});

describe("isWithinPaidAccess", () => {
  it("gates by 1-based module position", () => {
    expect(isWithinPaidAccess(1, null)).toBe(true);
    expect(isWithinPaidAccess(7, undefined)).toBe(true);
    expect(isWithinPaidAccess(1, 0)).toBe(false);
    expect(isWithinPaidAccess(2, 2)).toBe(true);
    expect(isWithinPaidAccess(3, 2)).toBe(false);
  });
});
