import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import type { LessonValues } from "@/crm/lib/schemas";
import { LessonDaySlots } from "./LessonDaySlots";

function Harness({ userTimezone }: { userTimezone?: string } = {}) {
  const { watch, setValue, formState: { errors } } = useForm<LessonValues>({
    defaultValues: {
      type: "GROUP",
      date: "2026-09-07",
      time: "15:00",
      durationMinutes: 60,
      recurrence: "CUSTOM",
      recurrenceDays: [1, 3],
      recurrenceEndDate: "2026-09-30",
      daySlots: [],
    },
  });

  return (
    <LessonDaySlots watch={watch} setValue={setValue} errors={errors} isSubmitting={false} userTimezone={userTimezone} />
  );
}

describe("LessonDaySlots non-Moscow timezone", () => {
  it("shows the Moscow-equivalent badge next to each day's preview", () => {
    render(<Harness userTimezone="Asia/Baku" />);
    const mondayCard = screen.getByText("Понедельник").closest("div.rounded-xl") as HTMLElement;
    // Default 15:00 Baku = 14:00–15:00 Moscow.
    expect(within(mondayCard).getByText(/14:00–15:00 \(60 мин\) МСК/)).toBeInTheDocument();
  });

  it("shows no Moscow badge for the default (Moscow) timezone", () => {
    render(<Harness />);
    const mondayCard = screen.getByText("Понедельник").closest("div.rounded-xl") as HTMLElement;
    expect(within(mondayCard).queryByText(/МСК/)).not.toBeInTheDocument();
  });
});
