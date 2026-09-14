import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LessonsFilterToolbar } from "./LessonsFilterToolbar";
import { lessonListFiltersSchema } from "@/crm/lib/schemas";

function defaultFilters() {
  return lessonListFiltersSchema.parse({});
}

describe("LessonsFilterToolbar", () => {
  it("hides the teacher selector for a TEACHER session user", () => {
    render(
      <LessonsFilterToolbar filters={defaultFilters()} teachers={[{ id: "t1", fullName: "Иванова" }]} isTeacher onChange={vi.fn()} />,
    );
    expect(screen.queryByText("Все преподаватели")).not.toBeInTheDocument();
  });

  it("shows the teacher selector for a non-teacher", () => {
    render(
      <LessonsFilterToolbar
        filters={defaultFilters()}
        teachers={[{ id: "t1", fullName: "Иванова" }]}
        isTeacher={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Все преподаватели")).toBeInTheDocument();
  });

  it("toggles a date preset chip and clears any custom range", () => {
    const onChange = vi.fn();
    render(<LessonsFilterToolbar filters={defaultFilters()} teachers={[]} isTeacher={false} onChange={onChange} />);

    fireEvent.click(screen.getByText("Сегодня"));
    expect(onChange).toHaveBeenCalledWith({ range: "TODAY", from: null, to: null });
  });

  it("un-toggles an already-active preset chip back to null", () => {
    const onChange = vi.fn();
    render(
      <LessonsFilterToolbar
        filters={{ ...defaultFilters(), range: "TODAY" }}
        teachers={[]}
        isTeacher={false}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("Сегодня"));
    expect(onChange).toHaveBeenCalledWith({ range: null, from: null, to: null });
  });

  it("shows the reset button only when a filter is non-default", () => {
    const { rerender } = render(
      <LessonsFilterToolbar filters={defaultFilters()} teachers={[]} isTeacher={false} onChange={vi.fn()} />,
    );
    expect(screen.queryByText("Сбросить")).not.toBeInTheDocument();

    rerender(
      <LessonsFilterToolbar
        filters={{ ...defaultFilters(), status: "NEEDS_ATTENTION" }}
        teachers={[]}
        isTeacher={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Сбросить")).toBeInTheDocument();
  });

  it("resyncs the search input when filters.q changes externally (e.g. Reset)", () => {
    const { rerender } = render(
      <LessonsFilterToolbar
        filters={{ ...defaultFilters(), q: "матем" }}
        teachers={[]}
        isTeacher={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Поиск занятий")).toHaveValue("матем");

    rerender(
      <LessonsFilterToolbar filters={{ ...defaultFilters(), q: "" }} teachers={[]} isTeacher={false} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText("Поиск занятий")).toHaveValue("");
  });
});
