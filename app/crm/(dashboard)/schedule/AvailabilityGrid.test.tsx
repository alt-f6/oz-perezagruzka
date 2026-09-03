import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/crm/components/ToastProvider", () => ({ useToast: () => toastMock }));

const actionsMock = vi.hoisted(() => ({
  getTeacherAvailability: vi.fn(),
  saveTeacherAvailability: vi.fn(),
  copyTeacherAvailabilityWeek: vi.fn(),
}));
vi.mock("./availability-actions", () => actionsMock);

const { AvailabilityGrid } = await import("./AvailabilityGrid");
const { EMPTY_WEEK_SLOTS } = await import("@/crm/lib/availability");

const teachers = [{ id: "t1", fullName: "Иван Иванов" }];

beforeEach(() => {
  vi.clearAllMocks();
  actionsMock.getTeacherAvailability.mockResolvedValue({
    weeks: [{ weekStart: "2999-01-04", slots: EMPTY_WEEK_SLOTS }],
  });
  actionsMock.saveTeacherAvailability.mockResolvedValue({
    ok: true,
    weekStart: "x",
    slots: EMPTY_WEEK_SLOTS,
  });
});

describe("AvailabilityGrid", () => {
  it("renders a 7-day × 15-hour grid and loads the teacher's week", async () => {
    render(
      <AvailabilityGrid
        teachers={teachers}
        initialTeacherId="t1"
        canChooseTeacher={false}
      />,
    );

    await waitFor(() =>
      expect(actionsMock.getTeacherAvailability).toHaveBeenCalledWith(
        "t1",
        expect.any(Array),
      ),
    );

    // All 7 weekday headers and the 07:00 + 21:00 hour rows are present.
    for (const label of ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("07:00–08:00")).toBeInTheDocument();
    expect(screen.getByText("21:00–22:00")).toBeInTheDocument();
  });

  it("toggles a slot and saves the updated grid", async () => {
    const user = userEvent.setup();
    render(
      <AvailabilityGrid
        teachers={teachers}
        initialTeacherId="t1"
        canChooseTeacher={false}
      />,
    );
    await waitFor(() => expect(actionsMock.getTeacherAvailability).toHaveBeenCalled());

    const cell = screen.getByRole("button", { name: "Пн 15:00–16:00" });
    expect(cell).toHaveAttribute("aria-pressed", "false");
    await user.click(cell);
    expect(cell).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /Сохранить/ }));

    await waitFor(() =>
      expect(actionsMock.saveTeacherAvailability).toHaveBeenCalledOnce(),
    );
    const arg = actionsMock.saveTeacherAvailability.mock.calls[0][0];
    // Monday 15:00 is slot index 0*15 + (15-7) = 8.
    expect(arg.slots.charAt(8)).toBe("1");
  });
});
