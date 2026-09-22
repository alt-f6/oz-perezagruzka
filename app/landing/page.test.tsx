import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExamProvider } from "@/landing/lib/exam-context";

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
vi.mock("@/landing/components/sections/WhyOgeMatters", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/StudentCarousel", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/YandexReviews", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/Pricing", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/FAQ", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/FinalCTA", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/Footer", () => ({ default: () => null }));

import Home, { generateMetadata } from "./page";

describe("Home", () => {
  it("gives the readiness-map dynamic-import loading fallback the anchor id, so #readiness-map has a scroll target before the chunk loads", () => {
    render(
      <ExamProvider>
        <Home />
      </ExamProvider>,
    );

    const fallback = document.getElementById("readiness-map");
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toContain("Загрузка...");
  });

  it("emits both FAQPage and EducationalOrganization JSON-LD with the real review count", () => {
    const { container } = render(
      <ExamProvider>
        <Home />
      </ExamProvider>,
    );

    const scripts = Array.from(container.querySelectorAll('script[type="application/ld+json"]'));
    const parsed = scripts.map((s) => JSON.parse(s.innerHTML));

    expect(parsed.some((s) => s["@type"] === "FAQPage")).toBe(true);
    const org = parsed.find((s) => s["@type"] === "EducationalOrganization");
    expect(org).toBeTruthy();
    expect(org.aggregateRating.reviewCount).toBe("70");
    expect(org.address.streetAddress).toBe("ул. Калинина, 26");
  });

  it("canonicalizes the ?exam=ege query variant onto the dedicated /ege route, not itself", async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ exam: "ege" }),
    });

    expect(metadata.alternates?.canonical).toBe("https://perezagruzka-edu.ru/ege");
    expect(metadata.openGraph?.url).toBe("https://perezagruzka-edu.ru/ege");
  });
});
