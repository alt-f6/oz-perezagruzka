import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConsentBanner } from "./ConsentBanner";

vi.mock("@/landing/lib/cookie-consent", () => ({
  getCookieConsent: () => null,
  setCookieConsent: vi.fn(),
}));

describe("ConsentBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses a compact mobile footprint that leaves room for content below it", () => {
    render(<ConsentBanner />);

    const region = screen.getByRole("region", { name: "Уведомление об использовании cookie" });
    expect(region.className).toContain("p-3");
    expect(region.className).not.toContain("p-4 ");

    const acceptButton = screen.getByRole("button", { name: "Согласен" });
    expect(acceptButton.className).toContain("py-2.5");
  });

  it("still accepts and declines consent correctly", async () => {
    const { setCookieConsent } = await import("@/landing/lib/cookie-consent");
    render(<ConsentBanner />);

    screen.getByRole("button", { name: "Согласен" }).click();

    expect(setCookieConsent).toHaveBeenCalledWith("granted");
  });
});
