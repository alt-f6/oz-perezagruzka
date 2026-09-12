import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import BudgetVsPaidEGE from "./BudgetVsPaidEGE";
import ExamToggle from "@/landing/components/ui/ExamToggle";
import { ExamProvider } from "@/landing/lib/exam-context";

const reachGoalMock = vi.fn();
vi.mock("@/landing/lib/analytics", () => ({
  reachGoal: (...args: unknown[]) => reachGoalMock(...args),
}));

describe("BudgetVsPaidEGE", () => {
  it("is hidden on the ОГЭ tab by default", () => {
    render(
      <ExamProvider>
        <ExamToggle />
        <BudgetVsPaidEGE />
      </ExamProvider>,
    );

    expect(screen.queryByText(/Это не расходы на репетитора/)).not.toBeInTheDocument();
  });

  it("shows the heading, all three metric cards, the paragraph block, the CTA, and the footnote on the ЕГЭ tab", async () => {
    const user = userEvent.setup();
    render(
      <ExamProvider>
        <ExamToggle />
        <BudgetVsPaidEGE />
      </ExamProvider>,
    );

    await user.click(screen.getByRole("radio", { name: /ЕГЭ/ }));

    expect(screen.getByText(/Это не расходы на репетитора/)).toBeInTheDocument();
    expect(screen.getByText("36–42 балла")).toBeInTheDocument();
    expect(screen.getByText("1 000 000 ₽")).toBeInTheDocument();
    expect(screen.getByText("56–69 баллов")).toBeInTheDocument();
    expect(screen.getByText(/Разрыв между проходным на бюджет/)).toBeInTheDocument();
    expect(screen.getByText(/четыре года платного бакалавриата/)).toBeInTheDocument();
    expect(screen.getByText(/принимают больше 70% региональных вузов/)).toBeInTheDocument();
    expect(screen.getByText(/От балла зависит город/)).toBeInTheDocument();
    expect(screen.getByText(/Всё это решается не в мае/)).toBeInTheDocument();
    expect(
      screen.getByText("Источники: Рособрнадзор, Минобрнауки, «Табитуриент», 2026 год."),
    ).toBeInTheDocument();

    const cta = screen.getByRole("link", { name: "Записаться на бесплатный разбор" });
    expect(cta).toHaveAttribute("href", "#readiness-map");

    reachGoalMock.mockReset();
    await user.click(cta);
    expect(reachGoalMock).toHaveBeenCalledWith("cta_ege_block_click");
  });

  it("never renders a 4th school-results card", async () => {
    const user = userEvent.setup();
    render(
      <ExamProvider>
        <ExamToggle />
        <BudgetVsPaidEGE />
      </ExamProvider>,
    );

    await user.click(screen.getByRole("radio", { name: /ЕГЭ/ }));

    expect(screen.queryByText(/% выпускников/)).not.toBeInTheDocument();
  });
});
