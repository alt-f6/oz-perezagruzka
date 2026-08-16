import { afterEach, describe, expect, it } from "vitest";
import { getStats, recordFailure, resetMetrics } from "@/shared/lib/notification-metrics";

afterEach(() => {
  resetMetrics();
});

describe("notification-metrics", () => {
  it("starts with no recorded channels", () => {
    expect(getStats()).toEqual({ channels: {} });
  });

  it("records a failure with count, last reason, and an ISO timestamp", () => {
    recordFailure("telegram", "non-ok status 400");

    const stats = getStats();
    expect(stats.channels.telegram.failures).toBe(1);
    expect(stats.channels.telegram.lastReason).toBe("non-ok status 400");
    expect(() => new Date(stats.channels.telegram.lastFailureAt).toISOString()).not.toThrow();
  });

  it("accumulates failure counts per channel independently", () => {
    recordFailure("telegram", "timeout");
    recordFailure("telegram", "timeout");
    recordFailure("email", "invalid recipient");

    const stats = getStats();
    expect(stats.channels.telegram.failures).toBe(2);
    expect(stats.channels.email.failures).toBe(1);
  });

  it("overwrites lastReason/lastFailureAt with the most recent failure", () => {
    recordFailure("telegram", "first reason");
    recordFailure("telegram", "second reason");

    expect(getStats().channels.telegram.lastReason).toBe("second reason");
  });
});
