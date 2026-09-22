import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/crm/components/ToastProvider", () => ({ useToast: () => toastMock }));

const actionsMock = vi.hoisted(() => ({ updateLesson: vi.fn() }));
vi.mock("../actions", () => actionsMock);

const { LessonScheduleEditor } = await import("./LessonScheduleEditor");

describe("LessonScheduleEditor non-Moscow timezone", () => {
  it("shows the lesson's start time converted into the acting user's zone", async () => {
    const user = userEvent.setup();
    render(
      <LessonScheduleEditor
        classSessionId="lesson_1"
        scheduledAt="2026-09-07T08:00:00.000Z" // 11:00 Moscow
        durationMinutes={60}
        locked={false}
        userTimezone="Asia/Baku"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Изменить дату и время" }));
    // 11:00 Moscow (UTC+3) = 12:00 Baku (UTC+4).
    expect(screen.getByRole("button", { name: "12:00" })).toHaveAttribute("aria-pressed", "true");
  });
});
