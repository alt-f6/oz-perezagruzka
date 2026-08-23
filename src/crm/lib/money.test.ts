// src/crm/lib/money.test.ts
import { describe, it, expect } from "vitest";
import { rublesToKopecks, kopecksToRubles, type Kopecks } from "./money";

describe("rublesToKopecks", () => {
  it("converts whole rubles exactly", () => {
    expect(rublesToKopecks(5000)).toBe(500000);
  });

  it("rounds fractional-kopeck float noise (e.g. 19.99 -> 1999, not 1998 or 1999.0000001)", () => {
    expect(rublesToKopecks(19.99)).toBe(1999);
  });

  it("handles 0", () => {
    expect(rublesToKopecks(0)).toBe(0);
  });
});

describe("kopecksToRubles", () => {
  it("formats to a 2-decimal ruble string", () => {
    expect(kopecksToRubles(500000 as Kopecks)).toBe("5000.00");
  });

  it("formats fractional kopecks correctly", () => {
    expect(kopecksToRubles(1999 as Kopecks)).toBe("19.99");
  });

  it("round-trips with rublesToKopecks", () => {
    expect(kopecksToRubles(rublesToKopecks(150.5))).toBe("150.50");
  });
});
