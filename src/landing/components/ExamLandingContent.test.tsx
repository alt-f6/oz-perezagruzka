import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

function stub(name: string) {
  return { default: () => <div data-testid="section">{name}</div> };
}

vi.mock("@/landing/components/sections/Header", () => ({ default: () => null }));
vi.mock("@/landing/components/ui/ExamToggle", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/Hero", () => stub("Hero"));
vi.mock("@/landing/components/sections/BudgetVsPaidEGE", () => stub("BudgetVsPaidEGE"));
vi.mock("@/landing/components/sections/WhyOgeMatters", () => stub("WhyOgeMatters"));
vi.mock("@/landing/components/sections/Solution", () => stub("Solution"));
vi.mock("@/landing/components/sections/Pricing", () => stub("Pricing"));
vi.mock("@/landing/components/sections/TeachersCarousel", () => stub("TeachersCarousel"));
vi.mock("@/landing/components/sections/StudentCarousel", () => stub("StudentCarousel"));
vi.mock("@/landing/components/sections/YandexReviews", () => stub("YandexReviews"));
vi.mock("@/landing/components/sections/FAQ", () => stub("FAQ"));
vi.mock("@/landing/components/sections/FinalCTA", () => stub("FinalCTA"));
vi.mock("@/landing/components/sections/ReadinessMap/ReadinessMapSection", () => stub("ReadinessMap"));
vi.mock("@/landing/components/sections/Footer", () => stub("Footer"));

const { default: ExamLandingContent } = await import("./ExamLandingContent");

describe("ExamLandingContent", () => {
  it("places Pricing above Teachers and Reviews, with the quiz right before the footer (25.09 mentor review)", () => {
    render(<ExamLandingContent />);

    expect(screen.getAllByTestId("section").map((el) => el.textContent)).toEqual([
      "Hero",
      "BudgetVsPaidEGE",
      "WhyOgeMatters",
      "Solution",
      "Pricing",
      "TeachersCarousel",
      "StudentCarousel",
      "YandexReviews",
      "FAQ",
      "FinalCTA",
      "ReadinessMap",
      "Footer",
    ]);
  });
});
