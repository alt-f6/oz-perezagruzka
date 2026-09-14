import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("does not clobber newer keystrokes with a late-arriving filters.q that matches an earlier emit", () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      const { rerender } = render(
        <LessonsFilterToolbar filters={defaultFilters()} teachers={[]} isTeacher={false} onChange={onChange} />,
      );
      const input = screen.getByLabelText("Поиск занятий");

      // User types "матем" and pauses long enough for the debounce to settle.
      fireEvent.change(input, { target: { value: "матем" } });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onChange).toHaveBeenCalledWith({ q: "матем" });

      // Before the parent's router.replace -> Server Component round trip
      // completes, the user resumes typing.
      fireEvent.change(input, { target: { value: "матема" } });
      expect(input).toHaveValue("матема");

      // The round trip finally completes, handing back new props with
      // filters.q equal to what was emitted in step one ("матем") — this is
      // this component's own earlier emission catching up, not an external
      // change, so it must not overwrite the user's newer input.
      rerender(
        <LessonsFilterToolbar
          filters={{ ...defaultFilters(), q: "матем" }}
          teachers={[]}
          isTeacher={false}
          onChange={onChange}
        />,
      );
      expect(input).toHaveValue("матема");
    } finally {
      vi.useRealTimers();
    }
  });
});
