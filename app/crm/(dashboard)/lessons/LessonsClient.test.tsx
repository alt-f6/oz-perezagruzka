import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClassSessionWithGroup, Group } from "@/crm/lib/types";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/crm/components/ToastProvider", () => ({ useToast: () => toastMock }));

const actionsMock = vi.hoisted(() => ({
  createLesson: vi.fn(),
  deleteLesson: vi.fn(),
  bulkCancelSessions: vi.fn(),
}));
vi.mock("./actions", () => actionsMock);

const { LessonsClient } = await import("./LessonsClient");

const groups: Group[] = [{ id: "g1", name: "Группа 1", teacherId: "t1" }];

function makeLesson(overrides: Partial<ClassSessionWithGroup>): ClassSessionWithGroup {
  return {
    id: "session_1",
    groupId: "g1",
    teacherId: "t1",
    scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
    status: "scheduled",
    durationMinutes: 60,
    recurrenceGroupId: null,
    group: { id: "g1", name: "Группа 1", teacherId: "t1" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LessonsClient", () => {
  it("shows the start-end time range instead of just the start time", () => {
    render(
      <LessonsClient
        // 12:00Z = 15:00 Europe/Moscow, the wall-clock the schedule renders.
        initialLessons={[makeLesson({ scheduledAt: "2026-09-01T12:00:00.000Z", durationMinutes: 90 })]}
        initialNextCursor={null}
        groups={groups}
      />,
    );
    expect(screen.getByText(/15:00–16:30/)).toBeInTheDocument();
  });

  it("hides cancelled sessions by default and reveals them via the toggle", async () => {
    const user = userEvent.setup();
    render(
      <LessonsClient
        initialLessons={[makeLesson({ id: "cancelled_1", status: "cancelled" })]}
        initialNextCursor={null}
        groups={groups}
      />,
    );

    expect(screen.queryByText("Группа 1")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Показать отменённые"));
    expect(screen.getByText("Группа 1")).toBeInTheDocument();
  });

  it("selects lessons via checkbox and shows a bulk-cancel bar with the selected count", async () => {
    const user = userEvent.setup();
    render(
      <LessonsClient
        initialLessons={[makeLesson({ id: "a" }), makeLesson({ id: "b" })]}
        initialNextCursor={null}
        groups={groups}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox", { name: /Выбрать занятие/ });
    await user.click(checkboxes[0]);

    expect(screen.getByText(/Отменить выбранные \(1\)/)).toBeInTheDocument();
  });

  it("calls bulkCancelSessions with the selected ids and confirms via ConfirmDialog before cancelling", async () => {
    const user = userEvent.setup();
    actionsMock.bulkCancelSessions.mockResolvedValue({ cancelledCount: 1, skippedCount: 0 });

    render(
      <LessonsClient
        initialLessons={[makeLesson({ id: "a" })]}
        initialNextCursor={null}
        groups={groups}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: /Выбрать занятие/ }));
    await user.click(screen.getByText(/Отменить выбранные/));

    await user.type(screen.getByPlaceholderText(/Например/), "Отпуск преподавателя");
    await user.click(screen.getByRole("button", { name: "Отменить" }));

    expect(actionsMock.bulkCancelSessions).toHaveBeenCalledWith({ sessionIds: ["a"] });
  });

  it("shows a 'cancel remaining series' button only for lessons with a recurrenceGroupId", () => {
    render(
      <LessonsClient
        initialLessons={[
          makeLesson({ id: "solo", recurrenceGroupId: null }),
          makeLesson({ id: "series", recurrenceGroupId: "series_1" }),
        ]}
        initialNextCursor={null}
        groups={groups}
      />,
    );

    const buttons = screen.getAllByTitle("Отменить оставшиеся занятия серии");
    expect(buttons).toHaveLength(1);
  });

  it("hides the create-lesson control for teachers", () => {
    render(
      <LessonsClient
        initialLessons={[makeLesson({})]}
        initialNextCursor={null}
        groups={groups}
        userRole="TEACHER"
      />,
    );

    expect(screen.queryByText("Новое занятие")).not.toBeInTheDocument();
  });

  it("shows the create-lesson control for admins/managers", () => {
    render(
      <LessonsClient
        initialLessons={[makeLesson({})]}
        initialNextCursor={null}
        groups={groups}
        userRole="ADMIN"
      />,
    );

    expect(screen.getByText("Новое занятие")).toBeInTheDocument();
  });

  it("shows a load-more button when nextCursor is set and appends fetched lessons on click", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        lessons: [makeLesson({ id: "loaded_1" })],
        nextCursor: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LessonsClient initialLessons={[]} initialNextCursor="l5" groups={groups} userRole="ADMIN" />,
    );

    await user.click(screen.getByRole("button", { name: /Показать ещё/i }));

    expect(fetchMock).toHaveBeenCalledWith("/crm/api/lessons?cursor=l5");
    expect(await screen.findByText("Группа 1")).toBeInTheDocument();
  });
});
