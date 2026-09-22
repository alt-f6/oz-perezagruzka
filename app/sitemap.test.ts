import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("lists the home page with daily frequency and top priority", () => {
    const result = sitemap();
    const home = result.find((entry) => entry.url === "https://perezagruzka-edu.ru");

    expect(home).toEqual({
      url: "https://perezagruzka-edu.ru",
      lastModified: "2026-09-20T00:00:00.000Z",
      changeFrequency: "daily",
      priority: 1.0,
    });
  });

  it("lists /oge and /ege with weekly frequency and 0.9 priority", () => {
    const result = sitemap();

    for (const path of ["/oge", "/ege"]) {
      const entry = result.find((e) => e.url === `https://perezagruzka-edu.ru${path}`);
      expect(entry).toEqual({
        url: `https://perezagruzka-edu.ru${path}`,
        lastModified: "2026-09-20T00:00:00.000Z",
        changeFrequency: "weekly",
        priority: 0.9,
      });
    }
  });

  it("lists the three regional pages with weekly frequency and 0.8 priority", () => {
    const result = sitemap();

    for (const path of ["/surgut", "/nizhnevartovsk", "/khanty-mansiysk"]) {
      const entry = result.find((e) => e.url === `https://perezagruzka-edu.ru${path}`);
      expect(entry).toEqual({
        url: `https://perezagruzka-edu.ru${path}`,
        lastModified: "2026-09-20T00:00:00.000Z",
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
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

  it("outputs exactly 9 URLs, all with the same static build date", () => {
    const result = sitemap();
    expect(result).toHaveLength(9);
    expect(result.every((entry) => entry.lastModified === "2026-09-20T00:00:00.000Z")).toBe(true);
  });
});
