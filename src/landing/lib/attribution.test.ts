// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ATTR_FIRST_KEY,
  ATTR_LAST_KEY,
  captureAttribution,
  getAttribution,
  getYmClientId,
  hasCampaignParams,
  parseTouch,
} from "./attribution";

const NOW = new Date("2026-09-01T10:00:00.000Z");

function visit(url: string, referrer = "") {
  window.history.replaceState(null, "", url);
  Object.defineProperty(document, "referrer", { value: referrer, configurable: true });
}

beforeEach(() => {
  window.localStorage.clear();
  delete (window as unknown as { ym?: unknown }).ym;
});

afterEach(() => {
  vi.useRealTimers();
  visit("/");
});

describe("parseTouch", () => {
  it("extracts UTM params, the first click id, referrer and landing path", () => {
    expect(
      parseTouch(
        "?utm_source=vk&utm_medium=cpc&utm_campaign=oge_spring&utm_content=ad1&utm_term=%D0%BE%D0%B3%D1%8D&yclid=777&foo=bar",
        "https://vk.com/feed",
        "/ege",
        NOW,
      ),
    ).toEqual({
      utm_source: "vk",
      utm_medium: "cpc",
      utm_campaign: "oge_spring",
      utm_content: "ad1",
      utm_term: "огэ",
      click_id: "777",
      referrer: "https://vk.com/feed",
      landing_path: "/ege",
      ts: NOW.toISOString(),
    });
  });

  it("omits blank values and clips overly long ones", () => {
    const touch = parseTouch(`?utm_source=%20%20&utm_campaign=${"x".repeat(600)}`, "", "/", NOW);

    expect(touch.utm_source).toBeUndefined();
    expect(touch.referrer).toBeUndefined();
    expect(touch.utm_campaign).toHaveLength(500);
  });
});

describe("hasCampaignParams", () => {
  it("is true for any UTM or click id and false otherwise", () => {
    expect(hasCampaignParams("?utm_source=vk")).toBe(true);
    expect(hasCampaignParams("?gclid=1")).toBe(true);
    expect(hasCampaignParams("?exam=ege")).toBe(false);
    expect(hasCampaignParams("?utm_source=")).toBe(false);
  });
});

describe("captureAttribution / getAttribution", () => {
  it("writes attr_first once and never overwrites it", () => {
    visit("/?utm_source=vk&utm_campaign=first", "https://vk.com/");
    captureAttribution();
    visit("/?utm_source=yandex&utm_campaign=second");
    captureAttribution();

    const { attr_first, attr_last } = getAttribution();
    expect(attr_first).toMatchObject({ utm_source: "vk", utm_campaign: "first", referrer: "https://vk.com/" });
    expect(attr_last).toMatchObject({ utm_source: "yandex", utm_campaign: "second" });
  });

  it("records a first touch for a direct visit but leaves attr_last empty", () => {
    visit("/pep");
    captureAttribution();

    const { attr_first, attr_last } = getAttribution();
    expect(attr_first).toMatchObject({ landing_path: "/pep" });
    expect(attr_first?.utm_source).toBeUndefined();
    expect(attr_last).toBeNull();
  });

  it("keeps the last campaign when a later URL has no campaign params", () => {
    visit("/?utm_source=vk");
    captureAttribution();
    visit("/?exam=ege");
    captureAttribution();

    expect(getAttribution().attr_last).toMatchObject({ utm_source: "vk" });
  });

  it("returns nulls for corrupted storage instead of throwing", () => {
    window.localStorage.setItem(ATTR_FIRST_KEY, "{not json");
    window.localStorage.setItem(ATTR_LAST_KEY, "[1,2]");

    expect(getAttribution()).toEqual({ attr_first: null, attr_last: null });
  });

  it("survives a throwing localStorage", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(() => captureAttribution()).not.toThrow();
    expect(getAttribution()).toEqual({ attr_first: null, attr_last: null });
    spy.mockRestore();
  });
});

describe("getYmClientId", () => {
  it("resolves null immediately when Metrika is not loaded", async () => {
    await expect(getYmClientId()).resolves.toBeNull();
  });

  it("resolves the ClientID reported by Metrika", async () => {
    (window as unknown as { ym: unknown }).ym = vi.fn(
      (_id: number, _method: string, callback: (id: string) => void) => callback("1726000000123456789"),
    );

    await expect(getYmClientId()).resolves.toBe("1726000000123456789");
  });

  it("falls back to null after the timeout when Metrika never answers", async () => {
    vi.useFakeTimers();
    (window as unknown as { ym: unknown }).ym = vi.fn();

    const pending = getYmClientId(300);
    vi.advanceTimersByTime(300);

    await expect(pending).resolves.toBeNull();
  });
});
