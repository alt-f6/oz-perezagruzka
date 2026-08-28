import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { lessonSchema, type LessonValues } from "@/crm/lib/schemas";
import { LessonFormFields } from "./LessonFormFields";

function Harness({
  groups = [{ id: "g1", name: "Группа 1" }],
}: {
  groups?: { id: string; name: string; teacherId?: string | null }[];
} = {}) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LessonValues>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      recurrence: "NONE",
      recurrenceDays: [],
      durationMinutes: 60,
      date: "2026-09-01",
      time: "15:00",
    },
  });

  return (
    <LessonFormFields
      register={register}
      watch={watch}
      setValue={setValue}
      errors={errors}
      groups={groups}
      isSubmitting={false}
    />
  );
}

describe("LessonFormFields", () => {
  it("shows the live start-end time range for the default date/time/duration", () => {
    render(<Harness />);
    expect(screen.getByText("15:00–16:00 (60 мин)")).toBeInTheDocument();
  });

  it("updates the range label when a duration chip is clicked", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText("90 мин"));
    expect(screen.getByText("15:00–16:30 (90 мин)")).toBeInTheDocument();
  });

  it("updates the range label when a time chip is clicked", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText("09:00"));
    expect(screen.getByText("09:00–10:00 (60 мин)")).toBeInTheDocument();
  });

  it("disables a group option that has no assigned teacher", () => {
    render(
      <Harness
        groups={[
          { id: "g1", name: "Группа 1", teacherId: "t1" },
          { id: "g2", name: "Группа 2", teacherId: null },
        ]}
      />,
    );

    const withTeacher = screen.getByRole("option", { name: "Группа 1" });
    const withoutTeacher = screen.getByRole("option", { name: /Группа 2/ });

    expect(withTeacher).not.toBeDisabled();
    expect(withoutTeacher).toBeDisabled();
    expect(withoutTeacher.textContent).toContain("нет преподавателя");
  });
});
