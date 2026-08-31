import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { lessonSchema, type LessonValues } from "@/crm/lib/schemas";
import { LessonWizard } from "./LessonWizard";

const GROUP = { id: "b6f8f9d4-6f1a-4e2a-9b8a-0a1b2c3d4e5f", name: "Группа 1", teacherId: "t1" };

function Harness({ defaults }: { defaults?: Partial<LessonValues> }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<LessonValues>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      groupId: GROUP.id,
      date: "2026-09-07", // Monday
      time: "15:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
      daySlots: [],
      ...defaults,
    },
  });

  return (
    <LessonWizard
      register={register}
      watch={watch}
      setValue={setValue}
      trigger={trigger}
      errors={errors}
      groups={[GROUP]}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit(vi.fn())}
    />
  );
}

describe("LessonWizard step navigation", () => {
  it("Back moves strictly to the previous step and preserves entered data", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Step 1: change the default time, confirm the live range reflects it.
    await user.click(screen.getByRole("button", { name: "09:00" }));
    expect(screen.getByText("09:00–10:00 (60 мин)")).toBeInTheDocument();

    // Advance to step 2.
    await user.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.getByText("Время занятия")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Далее" })).not.toBeInTheDocument();

    // Back returns to step 1 (N -> N-1), not closing or losing state.
    await user.click(screen.getByRole("button", { name: "Назад" }));
    expect(screen.getByText("Группа")).toBeInTheDocument();
    // The 09:00 selection made before navigating is still applied.
    expect(screen.getByText("09:00–10:00 (60 мин)")).toBeInTheDocument();
  });

  it("lets a multi-day series set an independent time per weekday", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        defaults={{
          recurrence: "CUSTOM",
          recurrenceDays: [1, 6], // Mon + Sat
          recurrenceEndDate: "2026-09-30",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Далее" }));

    // One editor card per selected weekday.
    const mondayCard = screen.getByText("Понедельник").closest("div.rounded-xl") as HTMLElement;
    const saturdayCard = screen.getByText("Суббота").closest("div.rounded-xl") as HTMLElement;
    expect(mondayCard).toBeTruthy();
    expect(saturdayCard).toBeTruthy();

    // Give Saturday its own distinct time + duration.
    await user.click(within(saturdayCard).getByRole("button", { name: "10:00" }));
    await user.click(within(saturdayCard).getByRole("button", { name: "90 мин" }));

    // Saturday now reads 10:00–11:30; Monday keeps the default 15:00–16:00.
    expect(within(saturdayCard).getByText("10:00–11:30 (90 мин)")).toBeInTheDocument();
    expect(within(mondayCard).getByText("15:00–16:00 (60 мин)")).toBeInTheDocument();
  });
});
