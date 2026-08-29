import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Hero from "./Hero";
import { ExamProvider } from "@/landing/lib/exam-context";

describe("Hero", () => {
  it("renders the ОГЭ guarantee headline by default, not ЕГЭ", () => {
    render(
      <ExamProvider>
        <Hero />
      </ExamProvider>,
    );

    expect(screen.getByText("ОГЭ С ГАРАНТИЕЙ:")).toBeInTheDocument();
    expect(screen.queryByText("ЕГЭ С ГАРАНТИЕЙ:")).not.toBeInTheDocument();
  });

  it("frames the recommendation stat as a percentage instead of '4 из 5'", () => {
    render(
      <ExamProvider>
        <Hero />
      </ExamProvider>,
    );

    expect(screen.getAllByText("80% родителей — по рекомендации").length).toBeGreaterThan(0);
    expect(screen.queryByText(/4 из 5/)).not.toBeInTheDocument();
  });

  it("does not show the unconfirmed '2000 учеников' stat", () => {
    render(
      <ExamProvider>
        <Hero />
      </ExamProvider>,
    );

    expect(screen.queryByText(/2000 учеников/)).not.toBeInTheDocument();
  });

  it("shows the target-score guarantee bullet and the free-analysis CTA", () => {
    render(
      <ExamProvider>
        <Hero />
      </ExamProvider>,
    );

    expect(
      screen.getByText("Целевой балл прописываем в договоре."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Записаться на бесплатный разбор" }),
    ).toBeInTheDocument();
  });
});
