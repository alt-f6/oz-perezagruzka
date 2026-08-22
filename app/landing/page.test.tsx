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
vi.mock("@/landing/components/sections/PainPoints", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/WhatYouGet", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/AttestatPredictable", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/StudyingAlone", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/Solution", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/PreparationComposition", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/HowItWorks", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/StudentCarousel", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/YandexReviews", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/PreQuestions", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/Pricing", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/Guarantee", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/FAQ", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/FinalCTA", () => ({ default: () => null }));
vi.mock("@/landing/components/sections/Footer", () => ({ default: () => null }));

import Home from "./page";

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
});
