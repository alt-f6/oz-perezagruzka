// src/landing/components/analytics/MetrikaPageviewTracker.test.tsx
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const trackPageviewMock = vi.hoisted(() => vi.fn());
vi.mock("@/landing/lib/analytics", () => ({ trackPageview: trackPageviewMock }));

let mockPathname = "/";
let mockSearch = "";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

const { MetrikaPageviewTracker } = await import("./MetrikaPageviewTracker");

beforeEach(() => {
  trackPageviewMock.mockClear();
  mockPathname = "/";
  mockSearch = "";
});

describe("MetrikaPageviewTracker", () => {
  it("does not fire a pageview on initial mount", () => {
    render(<MetrikaPageviewTracker />);

    expect(trackPageviewMock).not.toHaveBeenCalled();
  });

  it("fires a pageview when the pathname changes after mount", () => {
    const { rerender } = render(<MetrikaPageviewTracker />);
    expect(trackPageviewMock).not.toHaveBeenCalled();

    mockPathname = "/pep";
    rerender(<MetrikaPageviewTracker />);

    expect(trackPageviewMock).toHaveBeenCalledWith("/pep");
    expect(trackPageviewMock).toHaveBeenCalledTimes(1);
  });

  it("includes the query string when present", () => {
    const { rerender } = render(<MetrikaPageviewTracker />);

    mockPathname = "/terms";
    mockSearch = "ref=email";
    rerender(<MetrikaPageviewTracker />);

    expect(trackPageviewMock).toHaveBeenCalledWith("/terms?ref=email");
  });

  it("does not fire when the effect is invoked twice with an unchanged URL (React Strict Mode double-invoke)", () => {
    // Simulates React Strict Mode's development-only synthetic double
    // invocation of effects on mount: the effect runs, its cleanup runs,
    // then it runs again with identical pathname/searchParams. A naive
    // "reset the skip flag in cleanup" implementation would misfire here.
    const { rerender } = render(<MetrikaPageviewTracker />);
    expect(trackPageviewMock).not.toHaveBeenCalled();

    rerender(<MetrikaPageviewTracker />);

    expect(trackPageviewMock).not.toHaveBeenCalled();
  });
});
