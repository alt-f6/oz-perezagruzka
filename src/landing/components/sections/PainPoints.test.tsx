import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PainPoints from "./PainPoints";
import { ExamProvider } from "@/landing/lib/exam-context";

describe("PainPoints", () => {
  it("renders the three Было/Стало pairs", () => {
    render(
      <ExamProvider>
        <PainPoints />
      </ExamProvider>,
    );

    expect(screen.getByText("Репетитора не контролирует никто.")).toBeInTheDocument();
    expect(screen.getByText("Контролируем сами.")).toBeInTheDocument();
    expect(screen.getByText("Узнаёте через месяцы.")).toBeInTheDocument();
    expect(screen.getByText("Отчёт раз в 2 недели.")).toBeInTheDocument();
    expect(screen.getByText("Ребёнок — один из потока.")).toBeInTheDocument();
    expect(screen.getByText("Мини-группа.")).toBeInTheDocument();
  });

  it("shows the OGE title by default", () => {
    render(
      <ExamProvider>
        <PainPoints />
      </ExamProvider>,
    );

    expect(screen.getByText(/не хватило нескольких баллов/)).toBeInTheDocument();
  });
});
