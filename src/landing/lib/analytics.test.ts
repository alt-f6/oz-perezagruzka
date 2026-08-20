// @vitest-environment jsdom
// This file lives under the src/**/*.test.ts glob, which defaults to the
// "node" environment (see vitest.config.ts); reachGoal() touches `window`,
// so this test needs jsdom specifically.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("reachGoal", () => {
  const originalEnv = process.env.NEXT_PUBLIC_YM_COUNTER_ID;

  beforeEach(() => {
    vi.resetModules();
    delete (window as unknown as { ym?: unknown }).ym;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_YM_COUNTER_ID = originalEnv;
  });

  it("does nothing when the counter ID env var is not set", async () => {
    process.env.NEXT_PUBLIC_YM_COUNTER_ID = "";
    const { reachGoal } = await import("./analytics");

    expect(() => reachGoal("quiz_start")).not.toThrow();
  });

  it("does nothing when window.ym is not present, even with a counter ID", async () => {
    process.env.NEXT_PUBLIC_YM_COUNTER_ID = "12345678";
    const { reachGoal } = await import("./analytics");

    expect(() => reachGoal("quiz_start")).not.toThrow();
  });

  it("calls window.ym with the counter ID, reachGoal, and target when both are present", async () => {
    process.env.NEXT_PUBLIC_YM_COUNTER_ID = "12345678";
    const ymMock = vi.fn();
    (window as unknown as { ym: typeof ymMock }).ym = ymMock;
    const { reachGoal } = await import("./analytics");

    reachGoal("quiz_start");

    expect(ymMock).toHaveBeenCalledWith(12345678, "reachGoal", "quiz_start");
  });
});
