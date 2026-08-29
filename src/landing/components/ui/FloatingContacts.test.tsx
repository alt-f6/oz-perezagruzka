import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FloatingContacts from "./FloatingContacts";

describe("FloatingContacts", () => {
  it("renders a fixed phone call button", () => {
    render(<FloatingContacts />);

    const link = screen.getByRole("link", { name: "Позвонить" });
    expect(link).toHaveAttribute("href", "tel:+79527025050");
    expect(link.className).toContain("fixed");
    expect(link.className).toContain("z-40");
  });

  it("renders a fixed MAX messenger button", () => {
    render(<FloatingContacts />);

    const link = screen.getByRole("link", { name: "Написать в MAX" });
    expect(link).toHaveAttribute("href", "https://max.ru");
    expect(link.className).toContain("fixed");
    expect(link.className).toContain("z-40");
  });
});
