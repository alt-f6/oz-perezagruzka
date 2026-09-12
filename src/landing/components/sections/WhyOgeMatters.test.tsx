import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import WhyOgeMatters from "./WhyOgeMatters";
import ExamToggle from "@/landing/components/ui/ExamToggle";
import { ExamProvider } from "@/landing/lib/exam-context";

const reachGoalMock = vi.fn();
vi.mock("@/landing/lib/analytics", () => ({
  reachGoal: (...args: unknown[]) => reachGoalMock(...args),
}));

describe("WhyOgeMatters", () => {
  afterEach(() => {
    window.history.replaceState(null, "", window.location.pathname);
  });
  it("shows the heading and the grade-10 panel by default on the ОГЭ tab", () => {
    render(
      <ExamProvider>
        <WhyOgeMatters />
      </ExamProvider>,
    );

    expect(screen.getByText(/ОГЭ решает больше, чем кажется/)).toBeInTheDocument();
    expect(screen.getByText("Оценка за ОГЭ идёт в аттестат")).toBeInTheDocument();
    expect(screen.getByText("В профильный 10 класс берут по результатам ОГЭ")).toBeInTheDocument();
    expect(screen.getByText("ОГЭ — первая честная оценка уровня")).toBeInTheDocument();
    expect(
      screen.getByText("После ОГЭ ребёнок понимает, что ему сдавать на ЕГЭ"),
    ).toBeInTheDocument();
    expect(screen.getByText("ЕГЭ строится на той же базе")).toBeInTheDocument();
    expect(screen.getByText("Формат экзамена отрабатывается один раз")).toBeInTheDocument();
    expect(screen.queryByText("62,5%")).not.toBeInTheDocument();
    expect(
      screen.getByText("Источники: Минпросвещения, 2026 год."),
    ).toBeInTheDocument();
  });

  it("is hidden on the ЕГЭ tab", async () => {
    const user = userEvent.setup();
    render(
      <ExamProvider>
        <ExamToggle />
        <WhyOgeMatters />
      </ExamProvider>,
    );

    await user.click(screen.getByRole("radio", { name: /ЕГЭ/ }));

    expect(screen.queryByText(/ОГЭ решает больше, чем кажется/)).not.toBeInTheDocument();
  });

  it("switches to the college panel and back via the inner tabs", async () => {
    const user = userEvent.setup();
    render(
      <ExamProvider>
        <WhyOgeMatters />
      </ExamProvider>,
    );

    await user.click(screen.getByRole("tab", { name: "В колледж" }));

    expect(screen.getByText("62,5%")).toBeInTheDocument();
    expect(screen.getByText("Конкурс по среднему баллу аттестата")).toBeInTheDocument();
    expect(screen.getByText("4,85")).toBeInTheDocument();
    expect(screen.getByText("В 1,3–2 раза")).toBeInTheDocument();
    expect(screen.getByText(/Бюджет в колледже — это тот же бюджет/)).toBeInTheDocument();
    expect(screen.queryByText("Оценка за ОГЭ идёт в аттестат")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "В 10 класс" }));

    expect(screen.getByText("Оценка за ОГЭ идёт в аттестат")).toBeInTheDocument();
    expect(screen.queryByText("62,5%")).not.toBeInTheDocument();
  });

  it("fires the tracking goal when the CTA is clicked, regardless of active inner tab", async () => {
    const user = userEvent.setup();
    render(
      <ExamProvider>
        <WhyOgeMatters />
      </ExamProvider>,
    );

    await user.click(screen.getByRole("tab", { name: "В колледж" }));
    reachGoalMock.mockReset();

    const cta = screen.getByRole("link", { name: "Записаться на бесплатный разбор" });
    expect(cta).toHaveAttribute("href", "#readiness-map");
    await user.click(cta);

    expect(reachGoalMock).toHaveBeenCalledWith("cta_oge_block_click");
  });
});
