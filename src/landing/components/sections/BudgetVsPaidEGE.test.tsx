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

    expect(screen.queryByText(/Сейчас вы принимаете решение о том, как ваш ребёнок проживёт следующие пять лет/)).not.toBeInTheDocument();
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

    expect(screen.getByText(/Сейчас вы принимаете решение о том, как ваш ребёнок проживёт следующие пять лет/)).toBeInTheDocument();
    expect(screen.getByText("36–42 балла")).toBeInTheDocument();
    expect(screen.getByText("1 000 000 ₽")).toBeInTheDocument();
    expect(screen.getByText("56–69 баллов")).toBeInTheDocument();
    expect(screen.getByText(/отделяет проходной балл на платное от проходного на бюджет/)).toBeInTheDocument();
    expect(screen.getByText(/Миллион рублей в среднем переплачивают родители/)).toBeInTheDocument();
    // Side-by-side window: a year of prep (9 months of the cheapest and the
    // 3-subject EGE tariff) against a paid degree.
    expect(screen.getByText("от 117 000 ₽")).toBeInTheDocument();
    expect(screen.getByText(/Три предмета — 180 000 ₽ за тот же год/)).toBeInTheDocument();
    expect(screen.getByText("от 1 000 000 ₽")).toBeInTheDocument();
    expect(screen.getByText(/принимают больше 70% региональных вузов/)).toBeInTheDocument();
    expect(screen.getByText(/От балла зависит город/)).toBeInTheDocument();
    expect(screen.getByText(/задолго до мая/)).toBeInTheDocument();
    expect(
      screen.getByText("Источники: Рособрнадзор, Минобрнауки, «Табитуриент», 2026 год."),
    ).toBeInTheDocument();

    const cta = screen.getByRole("link", { name: "Записаться на пробный урок" });
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
