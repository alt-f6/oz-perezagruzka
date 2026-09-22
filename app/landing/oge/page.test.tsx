// app/landing/oge/page.test.tsx
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

import OgePage, { metadata } from "./page";

describe("/oge page", () => {
  it("exposes exam-specific metadata with the canonical /oge URL", () => {
    expect(metadata.title).toBe(
      "Подготовка к ОГЭ в онлайн-школе «Перезагрузка» | Ханты-Мансийск, Сургут, Нижневартовск",
    );
    expect(metadata.description).toBe(
      "Курсы подготовки к ОГЭ в мини-группах с гарантией результата в договоре. Личный наставник и ИИ-репетитор. Сдайте экзамен на максимум.",
    );
    expect(metadata.alternates?.canonical).toBe("https://perezagruzka-edu.ru/oge");
  });

  it("renders exactly one h1, forced to the OGE headline, with no exam toggle", () => {
    render(<OgePage />);

    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe("ОГЭ С ГАРАНТИЕЙ:");
  });

  it("emits FAQPage and address-scoped EducationalOrganization JSON-LD", () => {
    const { container } = render(<OgePage />);
    const scripts = Array.from(container.querySelectorAll('script[type="application/ld+json"]'));
    const parsed = scripts.map((s) => JSON.parse(s.innerHTML));

    expect(parsed.some((s) => s["@type"] === "FAQPage")).toBe(true);
    const org = parsed.find((s) => s["@type"] === "EducationalOrganization");
    expect(org?.address?.streetAddress).toBe("ул. Калинина, 26");
  });
});
