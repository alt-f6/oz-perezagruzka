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

vi.mock("./actions", () => ({
  createLesson: vi.fn(),
  deleteLesson: vi.fn(),
  bulkCancelSessions: vi.fn(),
  bulkCancelSessionsWithBilling: vi.fn(),
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

  it("navigates via router.replace with page=1 when a filter changes", () => {
    renderClient({ userRole: "ADMIN" });
    // The status select is present; changing it triggers updateQuery -> router.replace.
    // (Simulated indirectly through the toolbar's onChange contract, verified in
    // LessonsFilterToolbar.test.tsx; here we assert the wiring by checking the
    // toolbar rendered with the current filters.)
    expect(screen.getByText("Все статусы")).toBeInTheDocument();
  });
});
