import { describe, expect, it } from "vitest";
import { describeTouch, formatLeadSourceNotes } from "./lead-source";
import { readinessActionInputSchema } from "./validations/readiness";

describe("describeTouch", () => {
  it("summarises UTM source, medium, campaign and content", () => {
    expect(
      describeTouch({ utm_source: "vk", utm_medium: "cpc", utm_campaign: "oge_spring", utm_content: "ad1" }),
    ).toBe("vk / cpc, кампания «oge_spring», объявление «ad1»");
  });

  it("falls back to the referrer host, then to a direct visit", () => {
    expect(describeTouch({ referrer: "https://yandex.ru/search?text=огэ" })).toBe("переход с yandex.ru");
    expect(describeTouch({ landing_path: "/" })).toBe("прямой заход");
    expect(describeTouch(null)).toBe("прямой заход");
  });
});

describe("formatLeadSourceNotes", () => {
  it("returns nothing without attribution", () => {
    expect(formatLeadSourceNotes(undefined)).toEqual([]);
  });

  it("lists last touch, a differing first touch, and the Metrika ClientID", () => {
    expect(
      formatLeadSourceNotes({
        attr_first: { referrer: "https://yandex.ru/" },
        attr_last: { utm_source: "vk", utm_campaign: "oge" },
        ym_client_id: "123",
      }),
    ).toEqual(["Источник: vk, кампания «oge»", "Первое касание: переход с yandex.ru", "YM ClientID: 123"]);
  });

  it("uses the first touch as the source when there is no campaign touch, without repeating it", () => {
    expect(formatLeadSourceNotes({ attr_first: { landing_path: "/" }, attr_last: null, ym_client_id: null })).toEqual([
      "Источник: прямой заход",
    ]);
  });
});

describe("readinessActionInputSchema attribution", () => {
  const base = {
    input: { name: "", grade: "9", subjects: "Математика", studyStyle: "Учится сам, но нет четкой системы знаний", hobbies: "Спорт и активный отдых", deadline: "3-6m" },
    sessionId: "s1",
    utm: {},
    consent: true,
    phone: "+79527025050",
  };

  it("accepts a payload without attribution (older clients)", () => {
    const parsed = readinessActionInputSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.attribution).toBeUndefined();
  });

  it("keeps valid attribution and strips unknown keys", () => {
    const parsed = readinessActionInputSchema.safeParse({
      ...base,
      attribution: { attr_first: null, attr_last: { utm_source: "vk", evil: "x" }, ym_client_id: "1", extra: 1 },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.attribution).toEqual({
      attr_first: null,
      attr_last: { utm_source: "vk" },
      ym_client_id: "1",
    });
  });

  it("drops malformed attribution instead of rejecting the lead", () => {
    const parsed = readinessActionInputSchema.safeParse({ ...base, attribution: { attr_last: "not-an-object" } });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.attribution).toBeUndefined();
  });
});
