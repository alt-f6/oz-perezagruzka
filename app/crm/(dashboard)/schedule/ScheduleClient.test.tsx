import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/crm/components/ToastProvider", () => ({ useToast: () => toastMock }));

const actionsMock = vi.hoisted(() => ({
  createLesson: vi.fn(),
}));
vi.mock("../lessons/actions", () => actionsMock);

const { ScheduleClient } = await import("./ScheduleClient");

const groups = [{ id: "g1", name: "Группа 1" }];
const teachers = [{ id: "t1", fullName: "Иван Иванов" }];

function todayAt(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function makeLesson(overrides: Partial<Parameters<typeof ScheduleClient>[0]["lessons"][number]>) {
  return {
    id: "s1",
    scheduledAt: todayAt(15, 0),
    groupId: "g1",
    teacherId: "t1",
    status: "scheduled",
    durationMinutes: 60,
    group: { id: "g1", name: "Группа 1" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ScheduleClient", () => {
  it("hides cancelled sessions from the day view by default", () => {
    render(
      <ScheduleClient
        lessons={[makeLesson({ status: "cancelled" })]}
        groups={groups}
        teachers={teachers}
      />,
    );
    expect(screen.queryByTestId("session-block-s1")).not.toBeInTheDocument();
  });

  it("reveals cancelled sessions once the toggle is checked", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleClient
        lessons={[makeLesson({ status: "cancelled" })]}
        groups={groups}
        teachers={teachers}
      />,
    );

    await user.click(screen.getByLabelText("Показать отменённые"));
    expect(screen.getByTestId("session-block-s1")).toBeInTheDocument();
  });

  it("positions a day-view block using scheduledAt/durationMinutes-derived top and height", () => {
    render(
      <ScheduleClient lessons={[makeLesson({})]} groups={groups} teachers={teachers} />,
    );
    const block = screen.getByTestId("session-block-s1");
    expect(block.style.top).not.toBe("");
    expect(block.style.height).not.toBe("");
  });

  it("shows compact HH:mm–HH:mm range text in month view", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleClient lessons={[makeLesson({})]} groups={groups} teachers={teachers} />,
    );

    await user.click(screen.getByRole("button", { name: "Месяц" }));
    expect(screen.getByText(/15:00–16:00/)).toBeInTheDocument();
  });

  it("hides the create-lesson control for teachers", () => {
    render(
      <ScheduleClient
        lessons={[makeLesson({})]}
        groups={groups}
        teachers={teachers}
        userRole="TEACHER"
      />,
    );
    expect(screen.queryByText("Новое занятие")).not.toBeInTheDocument();
  });

  it("shows the create-lesson control for admins/managers", () => {
    render(
      <ScheduleClient
        lessons={[makeLesson({})]}
        groups={groups}
        teachers={teachers}
        userRole="ADMIN"
      />,
    );
    expect(screen.getByText("Новое занятие")).toBeInTheDocument();
  });
});
