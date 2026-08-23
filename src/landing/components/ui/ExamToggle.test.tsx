import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ExamToggle from "./ExamToggle";
import { ExamProvider, useExam } from "@/landing/lib/exam-context";

const reachGoalMock = vi.fn();
vi.mock("@/landing/lib/analytics", () => ({
  reachGoal: (...args: unknown[]) => reachGoalMock(...args),
}));

function ExamProbe() {
  const { exam } = useExam();
  return <span data-testid="exam-probe">{exam}</span>;
}

describe("ExamToggle", () => {
  it("defaults to the ОГЭ option selected", () => {
    render(
      <ExamProvider>
        <ExamToggle />
      </ExamProvider>,
    );

    expect(screen.getByRole("radio", { name: /ОГЭ/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /ЕГЭ/ })).toHaveAttribute("aria-checked", "false");
  });

  it("switches the shared exam context to ege and fires the tracking goal when clicked", async () => {
    reachGoalMock.mockReset();
    const user = userEvent.setup();
    render(
      <ExamProvider>
        <ExamToggle />
        <ExamProbe />
      </ExamProvider>,
    );

    await user.click(screen.getByRole("radio", { name: /ЕГЭ/ }));

    expect(screen.getByTestId("exam-probe")).toHaveTextContent("ege");
    expect(screen.getByRole("radio", { name: /ЕГЭ/ })).toHaveAttribute("aria-checked", "true");
    expect(reachGoalMock).toHaveBeenCalledWith("exam_toggle_ege");
  });

  it("does not fire the tracking goal when switching back to oge", async () => {
    reachGoalMock.mockReset();
    const user = userEvent.setup();
    render(
      <ExamProvider>
        <ExamToggle />
      </ExamProvider>,
    );

    await user.click(screen.getByRole("radio", { name: /ЕГЭ/ }));
    reachGoalMock.mockReset();
    await user.click(screen.getByRole("radio", { name: /ОГЭ/ }));

    expect(reachGoalMock).not.toHaveBeenCalled();
  });
});
