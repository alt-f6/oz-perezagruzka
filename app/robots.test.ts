import { describe, expect, it, vi, beforeEach } from "vitest";

const headersMock = vi.fn();
vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

import robots from "./robots";

describe("robots", () => {
  beforeEach(() => {
    headersMock.mockReset();
  });

  it("allows crawling of the public apex site while blocking private endpoints", async () => {
    headersMock.mockReturnValue({ get: () => "perezagruzka-edu.ru" });
    const result = await robots();

    expect(result.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/login", "/api/auth/"],
    });
    expect(result.sitemap).toBe("https://perezagruzka-edu.ru/sitemap.xml");
    expect(result.host).toBe("https://perezagruzka-edu.ru");
  });

  it("disallows everything on the crm subdomain", async () => {
    headersMock.mockReturnValue({ get: () => "crm.perezagruzka-edu.ru" });
    const result = await robots();

    expect(result.rules).toEqual({ userAgent: "*", disallow: "/" });
    expect(result.sitemap).toBeUndefined();
  });

  it("disallows everything on the lms subdomain", async () => {
    headersMock.mockReturnValue({ get: () => "lms.perezagruzka-edu.ru" });
    const result = await robots();

    expect(result.rules).toEqual({ userAgent: "*", disallow: "/" });
    expect(result.sitemap).toBeUndefined();
  });

  it("treats a missing host header as the public apex (fail-open to the safe default)", async () => {
    headersMock.mockReturnValue({ get: () => null });
    const result = await robots();

    expect(result.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/login", "/api/auth/"],
    });
  });
});
