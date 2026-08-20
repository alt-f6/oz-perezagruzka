import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import FloatingWhatsApp from "./FloatingWhatsApp";

describe("FloatingWhatsApp", () => {
  const originalUrl = process.env.NEXT_PUBLIC_WHATSAPP_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_WHATSAPP_URL = originalUrl;
  });

  it("renders nothing when NEXT_PUBLIC_WHATSAPP_URL is not set", () => {
    process.env.NEXT_PUBLIC_WHATSAPP_URL = "";
    const { container } = render(<FloatingWhatsApp />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders a fixed-position link to the configured WhatsApp URL", () => {
    process.env.NEXT_PUBLIC_WHATSAPP_URL = "https://wa.me/79001234567";
    render(<FloatingWhatsApp />);

    const link = screen.getByRole("link", { name: "Написать в WhatsApp" });
    expect(link).toHaveAttribute("href", "https://wa.me/79001234567");
    expect(link.className).toContain("fixed");
    expect(link.className).toContain("z-40");
  });
});
