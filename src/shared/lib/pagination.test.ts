import { describe, it, expect } from "vitest";
import {
  buildCursorPage,
  parsePaginationParams,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from "./pagination";

describe("buildCursorPage", () => {
  it("returns all rows and a null cursor when there is no extra row", () => {
    const rows = [{ id: "a" }, { id: "b" }];

    const page = buildCursorPage(rows, 2);

    expect(page).toEqual({ items: [{ id: "a" }, { id: "b" }], nextCursor: null });
  });

  it("returns all rows and a null cursor when there are fewer rows than the limit", () => {
    const rows = [{ id: "a" }];

    const page = buildCursorPage(rows, 5);

    expect(page).toEqual({ items: [{ id: "a" }], nextCursor: null });
  });

  it("trims the extra row and returns the last item's id as nextCursor", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];

    const page = buildCursorPage(rows, 2);

    expect(page.items).toEqual([{ id: "a" }, { id: "b" }]);
    expect(page.nextCursor).toBe("b");
  });

  it("returns an empty page for zero rows", () => {
    const page = buildCursorPage([], 10);

    expect(page).toEqual({ items: [], nextCursor: null });
  });
});

describe("parsePaginationParams", () => {
  it("defaults to no cursor and DEFAULT_PAGE_LIMIT when the query string is empty", () => {
    const params = parsePaginationParams(new URLSearchParams());

    expect(params).toEqual({ cursor: undefined, limit: DEFAULT_PAGE_LIMIT });
  });

  it("reads the cursor and limit from the query string", () => {
    const params = parsePaginationParams(new URLSearchParams("cursor=row_5&limit=10"));

    expect(params).toEqual({ cursor: "row_5", limit: 10 });
  });

  it("clamps a limit above MAX_PAGE_LIMIT down to MAX_PAGE_LIMIT", () => {
    const params = parsePaginationParams(new URLSearchParams("limit=9999"));

    expect(params.limit).toBe(MAX_PAGE_LIMIT);
  });

  it.each(["0", "-5", "abc", "1.5"])(
    "falls back to the default limit for an invalid limit=%s",
    (raw) => {
      const params = parsePaginationParams(new URLSearchParams(`limit=${raw}`));

      expect(params.limit).toBe(DEFAULT_PAGE_LIMIT);
    },
  );

  it("honors custom default/max limits when provided", () => {
    const params = parsePaginationParams(new URLSearchParams(), 20, 30);
    expect(params.limit).toBe(20);

    const clamped = parsePaginationParams(new URLSearchParams("limit=100"), 20, 30);
    expect(clamped.limit).toBe(30);
  });
});
