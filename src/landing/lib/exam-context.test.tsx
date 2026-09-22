import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExamProvider, useExam } from "./exam-context";

function ExamProbe() {
  const { exam } = useExam();
  return <span data-testid="exam">{exam}</span>;
}

describe("ExamProvider", () => {
  it("defaults to oge when no initialExam is given", () => {
    render(
      <ExamProvider>
        <ExamProbe />
      </ExamProvider>,
    );
    expect(screen.getByTestId("exam").textContent).toBe("oge");
  });

  it("forces the exam to the given initialExam", () => {
    render(
      <ExamProvider initialExam="ege">
        <ExamProbe />
      </ExamProvider>,
    );
    expect(screen.getByTestId("exam").textContent).toBe("ege");
  });

  it("ignores a ?exam=ege query param when initialExam is forced", () => {
    const original = window.location.href;
    window.history.pushState({}, "", "/oge?exam=ege");
    try {
      render(
        <ExamProvider initialExam="oge">
          <ExamProbe />
        </ExamProvider>,
      );
      expect(screen.getByTestId("exam").textContent).toBe("oge");
    } finally {
      window.history.pushState({}, "", original);
    }
  });
});
