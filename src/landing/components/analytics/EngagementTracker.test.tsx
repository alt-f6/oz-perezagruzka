import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

const trackMock = vi.hoisted(() => vi.fn());
vi.mock("@/landing/lib/analytics", () => ({ track: trackMock }));

const { EngagementTracker, classifyContactHref } = await import("./EngagementTracker");

describe("classifyContactHref", () => {
  it.each([
    ["tel:+79527025050", "contact_phone_click"],
    ["TEL:+79527025050", "contact_phone_click"],
    ["https://max.ru/u/abc", "contact_messenger_click"],
    ["https://wa.me/79527025050", "contact_messenger_click"],
    ["https://api.whatsapp.com/send?phone=79527025050", "contact_messenger_click"],
    ["https://t.me/perezagruzka_school", "contact_messenger_click"],
  ])("classifies %s as %s", (href, goal) => {
    expect(classifyContactHref(href)).toBe(goal);
  });

  it.each([
    "https://t.me/share/url?url=x&text=y",
    "https://api.whatsapp.com/send?text=hello",
    "#pricing",
    "/privacy",
    "https://vk.com/perezagruzka",
    "mailto:hi@example.com",
  ])("ignores %s", (href) => {
    expect(classifyContactHref(href)).toBeNull();
  });
});

describe("EngagementTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    trackMock.mockClear();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tracks tel: and messenger link clicks via delegation", () => {
    const { getByText } = render(
      <>
        <EngagementTracker />
        <a href="tel:+79527025050">
          <span>Позвонить</span>
        </a>
        <a href="https://max.ru/u/abc">MAX</a>
        <a href="#faq">FAQ</a>
      </>,
    );

    fireEvent.click(getByText("Позвонить"));
    fireEvent.click(getByText("MAX"));
    fireEvent.click(getByText("FAQ"));

    expect(trackMock.mock.calls).toEqual([["contact_phone_click"], ["contact_messenger_click"]]);
  });

  it("fires engaged_60s once after 60s of visible, active time", () => {
    render(<EngagementTracker />);

    for (let second = 0; second < 59; second++) {
      fireEvent.pointerMove(window);
      vi.advanceTimersByTime(1000);
    }
    expect(trackMock).not.toHaveBeenCalledWith("engaged_60s", {}, true);

    fireEvent.pointerMove(window);
    vi.advanceTimersByTime(1000);
    expect(trackMock).toHaveBeenCalledWith("engaged_60s", {}, true);
  });

  it("does not count time while the user is idle", () => {
    render(<EngagementTracker />);

    vi.advanceTimersByTime(120_000);

    expect(trackMock).not.toHaveBeenCalledWith("engaged_60s", {}, true);
  });

  it("fires deep_scroll once the viewport bottom passes 75% of the document", () => {
    Object.defineProperty(document.documentElement, "scrollHeight", { value: 4000, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    render(<EngagementTracker />);

    Object.defineProperty(window, "scrollY", { value: 1000, configurable: true });
    fireEvent.scroll(window);
    vi.advanceTimersByTime(50);
    expect(trackMock).not.toHaveBeenCalledWith("deep_scroll", {}, true);

    Object.defineProperty(window, "scrollY", { value: 2200, configurable: true });
    fireEvent.scroll(window);
    vi.advanceTimersByTime(50);
    expect(trackMock).toHaveBeenCalledWith("deep_scroll", {}, true);
  });
});
