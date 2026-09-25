// src/landing/components/analytics/AnalyticsTracker.test.tsx
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const trackPageViewMock = vi.hoisted(() => vi.fn());
const captureAttributionMock = vi.hoisted(() => vi.fn());
vi.mock("@/landing/lib/analytics", () => ({ trackPageView: trackPageViewMock }));
vi.mock("@/landing/lib/attribution", () => ({ captureAttribution: captureAttributionMock }));

let mockPathname = "/";
let mockSearch = "";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

const { AnalyticsTracker } = await import("./AnalyticsTracker");

const origin = window.location.origin;

beforeEach(() => {
  trackPageViewMock.mockClear();
  captureAttributionMock.mockClear();
  mockPathname = "/";
  mockSearch = "";
});

describe("AnalyticsTracker", () => {
  it("does not fire a pageview on initial mount but still captures attribution", () => {
    render(<AnalyticsTracker />);

    expect(trackPageViewMock).not.toHaveBeenCalled();
    expect(captureAttributionMock).toHaveBeenCalledTimes(1);
  });

  it("fires a pageview with the full URL when the pathname changes after mount", () => {
    const { rerender } = render(<AnalyticsTracker />);
    expect(trackPageViewMock).not.toHaveBeenCalled();

    mockPathname = "/pep";
    rerender(<AnalyticsTracker />);

    expect(trackPageViewMock).toHaveBeenCalledWith(`${origin}/pep`);
    expect(trackPageViewMock).toHaveBeenCalledTimes(1);
    expect(captureAttributionMock).toHaveBeenCalledTimes(2);
  });

  it("includes the query string when present", () => {
    const { rerender } = render(<AnalyticsTracker />);

    mockPathname = "/terms";
    mockSearch = "ref=email";
    rerender(<AnalyticsTracker />);

    expect(trackPageViewMock).toHaveBeenCalledWith(`${origin}/terms?ref=email`);
  });

  it("does not fire when the effect is invoked twice with an unchanged URL (React Strict Mode double-invoke)", () => {
    // Simulates React Strict Mode's development-only synthetic double
    // invocation of effects on mount: the effect runs, its cleanup runs,
    // then it runs again with identical pathname/searchParams. A naive
    // "reset the skip flag in cleanup" implementation would misfire here.
    const { rerender } = render(<AnalyticsTracker />);
    expect(trackPageViewMock).not.toHaveBeenCalled();

    rerender(<AnalyticsTracker />);

    expect(trackPageViewMock).not.toHaveBeenCalled();
  });
});
