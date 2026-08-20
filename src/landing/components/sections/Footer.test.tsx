import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Footer from "./Footer";

describe("Footer", () => {
  it("renders a clickable tel: link using the verified contact phone number", () => {
    render(<Footer />);

    const phoneLink = screen.getByRole("link", { name: "+7 (952) 702-50-50" });
    expect(phoneLink).toHaveAttribute("href", "tel:+79527025050");
  });

  it("still renders the contact email in the legal line", () => {
    render(<Footer />);

    expect(screen.getByText(/perezagruzkahm@mail\.ru/)).toBeInTheDocument();
  });
});
