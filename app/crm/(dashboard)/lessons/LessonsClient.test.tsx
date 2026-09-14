import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { lessonListFiltersSchema } from "@/crm/lib/schemas";
import type { LessonListRow } from "@/crm/lib/services/lesson-list.service";
import { ToastProvider } from "@/crm/components/ToastProvider";

const replaceMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock }),
  usePathname: () => "/lessons",
  useSearchParams: () => new URLSearchParams(""),
}));

const bulkCancelSessionsWithBillingMock = vi.hoisted(() => vi.fn());

vi.mock("./actions", () => ({
  createLesson: vi.fn(),
  deleteLesson: vi.fn(),
  bulkCancelSessions: vi.fn(),
  bulkCancelSessionsWithBilling: bulkCancelSessionsWithBillingMock,
  reassignTeacher: vi.fn(),
}));

import { LessonsClient } from "./LessonsClient";

// NOTE: the brief's original fixture returned a plain object literal (no
// LessonListRow typing), whose `type`/`status`/`attendanceStatus` fields
// infer as bare `string` -- that doesn't satisfy LessonListRow's
// `LessonType`/`AttendanceCardinalityStatus` literal-union fields, so
// `initialLessons={[baseLesson()]}` fails to typecheck against
// LessonsClient's real props. Casting through `unknown` here preserves the
// brief's literal string values (still valid members of those unions) while
// satisfying the compiler; it changes no runtime behavior or assertions.
function baseLesson(overrides: Record<string, unknown> = {}): LessonListRow {
  return {
    id: "s1",
    type: "GROUP",
    groupId: "g1",
    studentId: null,
    teacherId: "t1",
    scheduledAt: new Date("2026-03-20T10:00:00.000Z"),
    durationMinutes: 60,
    pricePerLesson: null,
    isTrial: false,
    status: "scheduled",
    recurrenceGroupId: null,
    teacher: { id: "t1", fullName: "Иванова И.И." },
    group: { id: "g1", name: "Группа A", teacherId: "t1", studentCount: 4 },
    student: null,
    enrolledCount: 4,
    markedCount: 0,
    attendanceStatus: "SCHEDULED",
    ...overrides,
  } as unknown as LessonListRow;
}

function renderClient(props: Partial<Parameters<typeof LessonsClient>[0]> = {}) {
  return render(
    <ToastProvider>
      <LessonsClient
        initialLessons={[baseLesson()]}
        initialTotal={1}
        initialFilters={lessonListFiltersSchema.parse({})}
        groups={[{ id: "g1", name: "Группа A", teacherId: "t1" }]}
        teachers={[{ id: "t1", fullName: "Иванова И.И." }]}
        students={[]}
        userRole="ADMIN"
        {...props}
      />
    </ToastProvider>,
  );
}

beforeEach(() => {
  replaceMock.mockReset();
  refreshMock.mockReset();
  bulkCancelSessionsWithBillingMock.mockReset();
});

describe("LessonsClient", () => {
  it("shows the bulk toolbar trigger checkboxes for ADMIN", () => {
    renderClient({ userRole: "ADMIN" });
    expect(screen.getByLabelText("Выбрать все занятия")).toBeInTheDocument();
  });

  it("hides selection checkboxes and the create button for TEACHER", () => {
    renderClient({ userRole: "TEACHER" });
    expect(screen.queryByLabelText("Выбрать все занятия")).not.toBeInTheDocument();
    expect(screen.queryByText("Новое занятие")).not.toBeInTheDocument();
  });

  it("renders the pagination summary from total/page/pageSize", () => {
    // NOTE: the brief's original fixture used
    // `lessonListFiltersSchema.parse({ page: "1" })`, which leaves pageSize at
    // its schema default (25). With initialTotal=30, the implementation's
    // formula (pageEnd = Math.min(page*pageSize, total)) then yields
    // Math.min(1*25, 30) = 25, producing "Показано 1–25 из 30 занятий" -- not
    // the asserted "Показано 1–1 из 30 занятий". Pinning pageSize to "1" here
    // makes the fixture internally consistent with the asserted string:
    // Math.min(1*1, 30) = 1.
    renderClient({
      initialTotal: 30,
      initialFilters: lessonListFiltersSchema.parse({ page: "1", pageSize: "1" }),
    });
    expect(screen.getByText("Показано 1–1 из 30 занятий")).toBeInTheDocument();
  });

  it("navigates via router.replace with the next page when the next-page button is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderClient({
      userRole: "ADMIN",
      initialTotal: 2,
      initialFilters: lessonListFiltersSchema.parse({ page: "1", pageSize: "1" }),
    });

    const nextPageButton = screen.getByLabelText("Следующая страница");
    expect(nextPageButton).toBeEnabled();
    await user.click(nextPageButton);

    expect(replaceMock).toHaveBeenCalledTimes(1);
    const [url] = replaceMock.mock.calls[0] as [string];
    expect(url).toContain("page=2");
  });

  it("shows a combined cancelled/skipped toast when a bulk cancellation skips some sessions", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    bulkCancelSessionsWithBillingMock.mockResolvedValue({ cancelledCount: 1, skippedCount: 1 });

    renderClient({
      userRole: "ADMIN",
      initialLessons: [baseLesson({ scheduledAt: new Date("2099-01-01T10:00:00.000Z") })],
    });

    await user.click(screen.getByLabelText(/Выбрать занятие/));
    await user.click(screen.getByText("Отменить выбранные"));
    await user.type(screen.getByPlaceholderText("Например: отпуск преподавателя"), "Причина теста");
    await user.click(screen.getByRole("button", { name: "Отменить" }));

    expect(await screen.findByText("Отменено: 1, пропущено: 1")).toBeInTheDocument();
  });
});
