import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({
  default: (_loader: unknown, opts: { loading?: () => React.ReactNode }) => {
    return function DynamicLoadingFallback() {
      return opts.loading ? opts.loading() : null;
    };
  },
}));

vi.mock("@/landing/components/sections/Header", () => ({ default: () => null }));
vi.mock("@/landing/components/ui/ExamToggle", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/Hero", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/BudgetVsPaidEGE", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/Solution", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/TeachersCarousel", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/StudentCarousel", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/YandexReviews", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/Pricing", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/FAQ", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/FinalCTA", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/Footer", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/WhyOgeMatters", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/ReadinessMap/ReadinessMapSection", () => ({ default: () => null }));

import KhantyMansiyskPage, { metadata } from "./page";

describe("/khanty-mansiysk page", () => {
  it("exposes the spec's exact title/description/canonical", () => {
    expect(metadata.title).toBe("Подготовка к ОГЭ и ЕГЭ в Ханты-Мансийске | Ул. Калинина, 26");
    expect(metadata.description).toBe(
      "Центр подготовки к экзаменам ОГЭ и ЕГЭ в Ханты-Мансийске. Ул. Калинина, 26. Мини-группы, сильные педагоги, гарантия целевого балла.",
    );
    expect(metadata.alternates?.canonical).toBe("https://perezagruzka-edu.ru/khanty-mansiysk");
  });

  it("renders exactly one h1 and surfaces the office address", () => {
    render(<KhantyMansiyskPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryAllByText(/ул\. Калинина, 26/).length).toBeGreaterThan(0);
  });

  it("publishes a verified PostalAddress in its org schema, not areaServed", () => {
    const { container } = render(<KhantyMansiyskPage />);
    const scripts = Array.from(container.querySelectorAll('script[type="application/ld+json"]'));
    const org = scripts.map((s) => JSON.parse(s.innerHTML)).find((s) => s["@type"] === "EducationalOrganization");

    expect(org.address.streetAddress).toBe("ул. Калинина, 26");
    expect(org.areaServed).toBeUndefined();
  });
});
