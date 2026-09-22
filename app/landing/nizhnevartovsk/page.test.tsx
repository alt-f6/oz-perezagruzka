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

import NizhnevartovskPage, { metadata } from "./page";

describe("/nizhnevartovsk page", () => {
  it("exposes the spec's exact title/description/canonical", () => {
    expect(metadata.title).toBe("Подготовка к ОГЭ и ЕГЭ в Нижневартовске | Онлайн-школа «Перезагрузка»");
    expect(metadata.description).toBe(
      "Эффективная подготовка к ОГЭ и ЕГЭ в Нижневартовске. Поступление в НВГУ и вузы РФ. Мини-группы с сильными преподавателями.",
    );
    expect(metadata.alternates?.canonical).toBe("https://perezagruzka-edu.ru/nizhnevartovsk");
  });

  it("renders exactly one h1", () => {
    render(<NizhnevartovskPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("uses areaServed instead of a street address in its org schema", () => {
    const { container } = render(<NizhnevartovskPage />);
    const scripts = Array.from(container.querySelectorAll('script[type="application/ld+json"]'));
    const org = scripts.map((s) => JSON.parse(s.innerHTML)).find((s) => s["@type"] === "EducationalOrganization");

    expect(org.areaServed).toEqual({ "@type": "City", name: "Нижневартовск" });
    expect(org.address).toBeUndefined();
  });
});
