import { describe, it, expect } from "vitest";
import { isLikelyBot, MIN_SUBMIT_DELAY_MS } from "./bot-defense";

describe("isLikelyBot", () => {
  it("flags a filled honeypot field", () => {
    expect(isLikelyBot({ honeypot: "I am a bot", formRenderedAt: Date.now() - 5000 })).toBe(true);
  });

  it("flags a submission faster than the minimum delay", () => {
    expect(isLikelyBot({ honeypot: "", formRenderedAt: Date.now() })).toBe(true);
  });

  it("allows a genuine, empty-honeypot, human-paced submission", () => {
    expect(
      isLikelyBot({ honeypot: "", formRenderedAt: Date.now() - (MIN_SUBMIT_DELAY_MS + 1000) }),
    ).toBe(false);
  });

  it("treats a missing formRenderedAt as suspicious", () => {
    expect(isLikelyBot({ honeypot: "" })).toBe(true);
  });
});
