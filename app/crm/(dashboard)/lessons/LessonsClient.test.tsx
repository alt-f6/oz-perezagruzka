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

  it("shows the per-lesson cancel button for a PAST lesson too, and calls deleteLesson on confirm", async () => {
    // Operators often only discover a mis-scheduled lesson after it's
    // already passed; the trash button used to only render for future
    // lessons, blocking exactly that case.
    const user = userEvent.setup();
    actionsMock.deleteLesson.mockResolvedValue({});

    render(
      <LessonsClient
        initialLessons={[
          makeLesson({ id: "past_1", scheduledAt: new Date(Date.now() - 3_600_000).toISOString() }),
        ]}
        initialNextCursor={null}
        groups={groups}
      />,
    );

    await user.click(screen.getByTitle("Отменить занятие"));
    await user.click(screen.getByRole("button", { name: "Отменить" }));

    expect(actionsMock.deleteLesson).toHaveBeenCalledWith("past_1");
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

  it("shows the assigned teacher's name on a list row", () => {
    render(
      <LessonsClient
        initialLessons={[
          makeLesson({ id: "l1", teacher: { fullName: "Мария Петрова" } }),
        ]}
        initialNextCursor={null}
        groups={groups}
      />,
    );

    expect(screen.getByText("Мария Петрова")).toBeInTheDocument();
  });

  it("shows the fallback label when a row has no matching teacher", () => {
    render(
      <LessonsClient
        initialLessons={[makeLesson({ id: "l1", teacher: null })]}
        initialNextCursor={null}
        groups={groups}
      />,
    );

    expect(screen.getByText("Без преподавателя")).toBeInTheDocument();
  });

  it("shows the group's CURRENT teacher, not the session's stale teacherId snapshot, when the group was reassigned", () => {
    // Mirrors production reports of a lesson row showing an old/admin teacher
    // for a session whose group has since been reassigned: the ClassSession
    // row itself still carries the old teacherId/teacher relation, but the
    // group's live teacherId (embedded in lesson.group.teacherId) is current.
    render(
      <LessonsClient
        initialLessons={[
          makeLesson({
            id: "l1",
            teacherId: "t1",
            teacher: { fullName: "Главный администратор" },
            group: { id: "g1", name: "Олимпиада права", teacherId: "t2" },
          }),
        ]}
        initialNextCursor={null}
        groups={[{ id: "g1", name: "Олимпиада права", teacherId: "t2" }]}
        teachers={[
          { id: "t1", fullName: "Главный администратор" },
          { id: "t2", fullName: "Алёна Алексеевна Бычкова" },
        ]}
      />,
    );

    expect(screen.getByText("Алёна Алексеевна Бычкова")).toBeInTheDocument();
    expect(screen.queryByText("Главный администратор")).not.toBeInTheDocument();
  });

  it("renders the row date pinned to Moscow time, not the ambient/browser timezone", () => {
    render(
      <LessonsClient
        // 21:30Z on the 23rd = 00:30 the next day in Europe/Moscow (UTC+3, no
        // DST). The test env runs with TZ=UTC, so an ambient (no timeZone)
        // formatter would render 23.08.2026 — the Moscow-pinned date must be
        // 24.08.2026, matching the time range shown right next to it.
        initialLessons={[makeLesson({ scheduledAt: "2026-08-23T21:30:00.000Z" })]}
        initialNextCursor={null}
        groups={groups}
      />,
    );

    expect(screen.getByText(/24\.08\.2026/)).toBeInTheDocument();
    expect(screen.queryByText(/23\.08\.2026/)).not.toBeInTheDocument();
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
