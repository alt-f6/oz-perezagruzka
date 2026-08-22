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
    expect(screen.getByText("Педагогов контролируем мы сами.")).toBeInTheDocument();
    expect(screen.getByText("О проблеме узнаёте через месяцы.")).toBeInTheDocument();
    expect(screen.getByText("Отчёт каждые 2 недели.")).toBeInTheDocument();
    expect(screen.getByText("Ребёнок — один из сотни в потоке.")).toBeInTheDocument();
    expect(screen.getByText("Мини-группа до 8 человек.")).toBeInTheDocument();
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
