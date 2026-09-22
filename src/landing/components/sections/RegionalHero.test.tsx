import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RegionalHero from "./RegionalHero";
import { REGIONS } from "@/landing/data/regions";

describe("RegionalHero", () => {
  it("renders the region's headline as the page's single h1", () => {
    render(<RegionalHero region={REGIONS.surgut} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe(REGIONS.surgut.heroHeadline);
  });

  it("shows the office address callout only when the region has one", () => {
    const { rerender } = render(<RegionalHero region={REGIONS.surgut} />);
    expect(screen.queryByText(/ул\. Калинина/)).toBeNull();

    rerender(<RegionalHero region={REGIONS["khanty-mansiysk"]} />);
    expect(screen.getByText(/ул\. Калинина, 26/)).not.toBeNull();
  });
});
