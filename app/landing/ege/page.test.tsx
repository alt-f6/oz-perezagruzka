// app/landing/ege/page.test.tsx
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
vi.mock("@/landing/components/sections/BudgetVsPaidEGE", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/Solution", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/TeachersCarousel", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/StudentCarousel", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/YandexReviews", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/Pricing", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/FAQ", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/FinalCTA", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/Footer", () => ({ default: () => null }));

import EgePage, { metadata } from "./page";

describe("/ege page", () => {
  it("exposes exam-specific metadata with the canonical /ege URL", () => {
    expect(metadata.title).toBe("Подготовка к ЕГЭ в онлайн-школе «Перезагрузка» | Поступление на бюджет");
    expect(metadata.description).toBe(
      "Подготовка к ЕГЭ на целевые 80+ баллов для поступления на бюджет. Мини-группы, сильные педагоги, гарантия результата в договоре.",
    );
    expect(metadata.alternates?.canonical).toBe("https://perezagruzka-edu.ru/ege");
  });

  it("renders exactly one h1, forced to the EGE headline, with no exam toggle", () => {
    render(<EgePage />);

    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe("ЕГЭ С ГАРАНТИЕЙ:");
  });
});
