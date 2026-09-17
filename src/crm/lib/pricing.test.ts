import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { resolveSessionPrice } from "./pricing";

describe("resolveSessionPrice", () => {
  it("returns 0 for an explicitly free session even when a price is on record", () => {
    expect(
      resolveSessionPrice({ isFree: true, pricePerLesson: 1000, group: { pricePerLesson: 1500 } }),
    ).toBe(0);
  });

  it("prefers the group's price over the session's own price", () => {
    expect(
      resolveSessionPrice({ isFree: false, pricePerLesson: 500, group: { pricePerLesson: 1000 } }),
    ).toBe(1000);
  });

  it("falls back to the session's own price when there is no group", () => {
    expect(resolveSessionPrice({ isFree: false, pricePerLesson: 700, group: null })).toBe(700);
  });

  it("resolves to zero when neither the session nor a group has a price", () => {
    const result = resolveSessionPrice({ isFree: false, pricePerLesson: null, group: null });
    expect(Number(result)).toBe(0);
    expect(result).toBeInstanceOf(Prisma.Decimal);
  });
});
