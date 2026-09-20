import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots", () => {
  it("allows crawling of the public site while blocking private endpoints", () => {
    const result = robots();

    expect(result.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/login", "/api/auth/"],
    });
  });

  it("points at the canonical sitemap and host", () => {
    const result = robots();

    expect(result.sitemap).toBe("https://perezagruzka-edu.ru/sitemap.xml");
    expect(result.host).toBe("https://perezagruzka-edu.ru");
  });
});
