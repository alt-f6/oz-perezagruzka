import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("lists the home page with weekly frequency and top priority", () => {
    const result = sitemap();
    const home = result.find((entry) => entry.url === "https://perezagruzka-edu.ru");

    expect(home).toEqual({
      url: "https://perezagruzka-edu.ru",
      lastModified: "2026-09-20T00:00:00.000Z",
      changeFrequency: "weekly",
      priority: 1.0,
    });
  });

  it("lists terms, privacy, and pep with monthly low-priority entries", () => {
    const result = sitemap();

    for (const path of ["/terms", "/privacy", "/pep"]) {
      const entry = result.find((e) => e.url === `https://perezagruzka-edu.ru${path}`);
      expect(entry).toEqual({
        url: `https://perezagruzka-edu.ru${path}`,
        lastModified: "2026-09-20T00:00:00.000Z",
        changeFrequency: "monthly",
        priority: 0.3,
      });
    }
  });

  it("uses a static, non-dynamic build date for every entry", () => {
    const result = sitemap();

    expect(result.every((entry) => entry.lastModified === "2026-09-20T00:00:00.000Z")).toBe(true);
  });
});
