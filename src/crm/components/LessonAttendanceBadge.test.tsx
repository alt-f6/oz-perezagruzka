import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LessonAttendanceBadge } from "./LessonAttendanceBadge";

describe("LessonAttendanceBadge", () => {
  it("renders a neutral label for SCHEDULED", () => {
    render(<LessonAttendanceBadge status="SCHEDULED" enrolledCount={5} markedCount={0} />);
    expect(screen.getByText("Запланировано")).toBeInTheDocument();
  });

  it("renders a neutral label for CANCELLED", () => {
    render(<LessonAttendanceBadge status="CANCELLED" enrolledCount={5} markedCount={0} />);
    expect(screen.getByText("Отменено")).toBeInTheDocument();
  });

  it("renders an urgent label for UNMARKED", () => {
    render(<LessonAttendanceBadge status="UNMARKED" enrolledCount={5} markedCount={0} />);
    expect(screen.getByText("Не отмечено")).toBeInTheDocument();
  });

  it("renders the marked/enrolled ratio for PARTIALLY_MARKED", () => {
    render(<LessonAttendanceBadge status="PARTIALLY_MARKED" enrolledCount={8} markedCount={3} />);
    expect(screen.getByText("Частично: 3/8")).toBeInTheDocument();
  });

  it("renders the marked/enrolled ratio for COMPLETED", () => {
    render(<LessonAttendanceBadge status="COMPLETED" enrolledCount={8} markedCount={8} />);
    expect(screen.getByText("8/8 отмечено")).toBeInTheDocument();
  });
});
