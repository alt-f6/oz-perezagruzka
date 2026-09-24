import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { useRef } from "react";

const trackMock = vi.hoisted(() => vi.fn());
vi.mock("@/landing/lib/analytics", () => ({ track: trackMock }));

const { isMeaningfullyVisible, useSectionViewGoal } = await import("./section-view");

type Entry = Pick<IntersectionObserverEntry, "isIntersecting" | "intersectionRatio" | "intersectionRect">;

function entry(isIntersecting: boolean, intersectionRatio: number, visibleHeight: number): Entry {
  return { isIntersecting, intersectionRatio, intersectionRect: { height: visibleHeight } as DOMRectReadOnly };
}

describe("isMeaningfullyVisible", () => {
  it("accepts a short section that is at least half visible", () => {
    expect(isMeaningfullyVisible(entry(true, 0.5, 300), 800)).toBe(true);
  });

  it("accepts a tall mobile section filling half the viewport even though its ratio is < 0.5", () => {
    // 1400px section, 700px viewport: 350px visible is only a 0.25 ratio.
    expect(isMeaningfullyVisible(entry(true, 0.25, 350), 700)).toBe(true);
  });

  it("rejects a sliver of a tall section", () => {
    expect(isMeaningfullyVisible(entry(true, 0.1, 140), 700)).toBe(false);
  });

  it("rejects a non-intersecting entry", () => {
    expect(isMeaningfullyVisible(entry(false, 0, 0), 700)).toBe(false);
  });
});

describe("useSectionViewGoal", () => {
  let callback: (entries: Partial<IntersectionObserverEntry>[]) => void;
  const disconnect = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    trackMock.mockClear();
    disconnect.mockClear();
    Object.defineProperty(window, "innerHeight", { value: 700, configurable: true });
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: typeof callback) {
          callback = cb;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function Probe() {
    const ref = useRef<HTMLDivElement>(null);
    useSectionViewGoal(ref, "pricing_view");
    return <div ref={ref} />;
  }

  it("fires once after a 2s uninterrupted dwell on a tall mobile section", () => {
    render(<Probe />);

    callback([entry(true, 0.25, 350)]);
    vi.advanceTimersByTime(1999);
    expect(trackMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(trackMock).toHaveBeenCalledWith("pricing_view", {}, true);
    expect(disconnect).toHaveBeenCalled();
  });

  it("cancels the timer when the section leaves the viewport before 2s", () => {
    render(<Probe />);

    callback([entry(true, 0.25, 350)]);
    vi.advanceTimersByTime(1500);
    callback([entry(false, 0, 0)]);
    vi.advanceTimersByTime(5000);

    expect(trackMock).not.toHaveBeenCalled();
  });

  it("cancels the timer when visibility drops below the threshold", () => {
    render(<Probe />);

    callback([entry(true, 0.3, 420)]);
    vi.advanceTimersByTime(1000);
    callback([entry(true, 0.1, 140)]);
    vi.advanceTimersByTime(5000);

    expect(trackMock).not.toHaveBeenCalled();
  });

  it("does not restart the dwell timer on repeated visible callbacks", () => {
    render(<Probe />);

    callback([entry(true, 0.3, 420)]);
    vi.advanceTimersByTime(1000);
    callback([entry(true, 0.35, 490)]);
    vi.advanceTimersByTime(1000);

    expect(trackMock).toHaveBeenCalledTimes(1);
  });
});
