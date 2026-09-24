// @vitest-environment jsdom
// This file lives under the src/**/*.test.ts glob, which defaults to the
// "node" environment (see vitest.config.ts); the facade touches `window`,
// so this test needs jsdom specifically.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = [
  "NEXT_PUBLIC_YM_ID",
  "NEXT_PUBLIC_YM_COUNTER_ID",
  "NEXT_PUBLIC_YANDEX_METRIKA_ID",
  "NEXT_PUBLIC_VK_PIXEL_ID",
] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function setYm() {
  const ymMock = vi.fn();
  (window as unknown as { ym: typeof ymMock }).ym = ymMock;
  return ymMock;
}

beforeEach(() => {
  vi.resetModules();
  for (const key of ENV_KEYS) delete process.env[key];
  delete (window as unknown as { ym?: unknown }).ym;
  delete window._tmr;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe("getYmId", () => {
  it("falls back to the production counter when no env var is set", async () => {
    const { getYmId } = await import("./analytics");
    expect(getYmId()).toBe("113001980");
  });

  it("prefers NEXT_PUBLIC_YM_ID, then NEXT_PUBLIC_YM_COUNTER_ID, then NEXT_PUBLIC_YANDEX_METRIKA_ID", async () => {
    const { getYmId } = await import("./analytics");

    process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID = "3";
    expect(getYmId()).toBe("3");
    process.env.NEXT_PUBLIC_YM_COUNTER_ID = "2";
    expect(getYmId()).toBe("2");
    process.env.NEXT_PUBLIC_YM_ID = "1";
    expect(getYmId()).toBe("1");
  });
});

describe("sanitizeParams", () => {
  it("strips phone/email/name keys at any depth, case-insensitively, and drops undefined", async () => {
    const { sanitizeParams } = await import("./analytics");

    expect(
      sanitizeParams({
        grade: "9",
        Phone: "+79990000000",
        email: "a@b.c",
        source: undefined,
        nested: { name: "Аня", subjects_count: 2 },
      }),
    ).toEqual({ grade: "9", nested: { subjects_count: 2 } });
  });
});

describe("track", () => {
  it("dispatches to both Metrika and VK Ads with sanitized params", async () => {
    process.env.NEXT_PUBLIC_YM_COUNTER_ID = "12345678";
    const ymMock = setYm();
    const { track } = await import("./analytics");

    track("lead_submit", { grade: "9", phone: "+79990000000" });

    expect(ymMock).toHaveBeenCalledWith(12345678, "reachGoal", "lead_submit", { grade: "9" });
    expect(window._tmr).toEqual([
      { id: "3796827", type: "reachGoal", goal: "lead_submit", params: { grade: "9" } },
    ]);
  });

  it("omits params entirely when nothing survives sanitization", async () => {
    const ymMock = setYm();
    const { track } = await import("./analytics");

    track("quiz_start", { name: "Аня" });

    expect(ymMock).toHaveBeenCalledWith(113001980, "reachGoal", "quiz_start");
    expect(window._tmr).toEqual([{ id: "3796827", type: "reachGoal", goal: "quiz_start" }]);
  });

  it("fires a `once` event only a single time until reset", async () => {
    const ymMock = setYm();
    const { track, resetTrackedEvents } = await import("./analytics");

    track("pricing_view", {}, true);
    track("pricing_view", {}, true);
    expect(ymMock).toHaveBeenCalledTimes(1);

    resetTrackedEvents();
    track("pricing_view", {}, true);
    expect(ymMock).toHaveBeenCalledTimes(2);
  });

  it("does not dedupe events fired without `once`", async () => {
    const ymMock = setYm();
    const { track } = await import("./analytics");

    track("contact_phone_click");
    track("contact_phone_click");

    expect(ymMock).toHaveBeenCalledTimes(2);
  });

  it("does not throw when neither counter is loaded", async () => {
    const { track } = await import("./analytics");

    expect(() => track("deep_scroll", {}, true)).not.toThrow();
  });

  it("uses a trimmed NEXT_PUBLIC_VK_PIXEL_ID when configured", async () => {
    process.env.NEXT_PUBLIC_VK_PIXEL_ID = "  42  ";
    const { track } = await import("./analytics");

    track("engaged_60s");

    expect(window._tmr?.[0]?.id).toBe("42");
  });
});

describe("reachGoal", () => {
  it("does not throw when window.ym is not present", async () => {
    const { reachGoal } = await import("./analytics");

    expect(() => reachGoal("quiz_start")).not.toThrow();
  });

  it("sends the legacy goal to Metrika and mirrors it to VK Ads", async () => {
    process.env.NEXT_PUBLIC_YM_COUNTER_ID = "12345678";
    const ymMock = setYm();
    const { reachGoal } = await import("./analytics");

    reachGoal("cta_analysis_click");

    expect(ymMock).toHaveBeenCalledWith(12345678, "reachGoal", "cta_analysis_click");
    expect(window._tmr).toEqual([{ id: "3796827", type: "reachGoal", goal: "cta_analysis_click" }]);
  });
});

describe("trackPageview", () => {
  it("does not throw when window.ym is not present", async () => {
    const { trackPageview } = await import("./analytics");

    expect(() => trackPageview("/pep")).not.toThrow();
  });

  it("sends a Metrika hit and a VK pageView with the URL", async () => {
    process.env.NEXT_PUBLIC_YM_COUNTER_ID = "12345678";
    const ymMock = setYm();
    const { trackPageview } = await import("./analytics");

    trackPageview("https://perezagruzka-edu.ru/pep");

    expect(ymMock).toHaveBeenCalledWith(12345678, "hit", "https://perezagruzka-edu.ru/pep");
    expect(window._tmr).toEqual([
      expect.objectContaining({
        id: "3796827",
        type: "pageView",
        url: "https://perezagruzka-edu.ru/pep",
        start: expect.any(Number),
      }),
    ]);
  });
});
