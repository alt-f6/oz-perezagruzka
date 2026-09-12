import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  AttendanceRecord,
  ClassSessionWithGroup,
  MakeupLessonOption,
} from "@/crm/lib/types";
import { AttendanceClient } from "./AttendanceClient";

// 21:30 UTC on Aug 23 is 00:30 the *next* day in Moscow (UTC+3, no DST). Under
// the test suite's forced TZ=UTC, an ambient (no timeZone) formatter renders
// this as "23.08.2026, 21:30" — a Moscow-pinned formatter must render
// "24.08.2026, 00:30" instead, so this fixture actually distinguishes the two.
const BOUNDARY_INSTANT = "2026-08-23T21:30:00.000Z";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/crm/components/ToastProvider", () => ({ useToast: () => toastMock }));

vi.mock("../actions", () => ({
  assignMakeupLesson: vi.fn(),
  setAttendance: vi.fn(),
}));

const baseLessonFixture: ClassSessionWithGroup = {
  id: "session_1",
  groupId: "g1",
  teacherId: "t1",
  scheduledAt: "2026-09-01T12:00:00.000Z",
  status: "scheduled",
  durationMinutes: 60,
  group: { id: "g1", name: "Группа 1", teacherId: "t1" },
};

const pastLessonFixture: ClassSessionWithGroup = {
  ...baseLessonFixture,
  scheduledAt: "2020-01-01T12:00:00.000Z",
};

describe("AttendanceClient", () => {
  it("shows the assigned teacher's name in the lesson header", () => {
    render(
      <AttendanceClient
        lesson={{ ...baseLessonFixture, teacher: { fullName: "Иван Иванов" } }}
        students={[]}
        attendance={[]}
        submissions={[]}
        makeupOptions={[]}
      />,
    );

    expect(screen.getByText("Иван Иванов")).toBeInTheDocument();
  });

  it("shows the fallback label when the lesson has no matching teacher", () => {
    render(
      <AttendanceClient
        lesson={{ ...baseLessonFixture, teacher: null }}
        students={[]}
        attendance={[]}
        submissions={[]}
        makeupOptions={[]}
      />,
    );

    expect(screen.getByText("Без преподавателя")).toBeInTheDocument();
  });

  it("renders the lesson header date/time pinned to Moscow, not the ambient TZ", () => {
    render(
      <AttendanceClient
        lesson={{ ...baseLessonFixture, scheduledAt: BOUNDARY_INSTANT }}
        students={[]}
        attendance={[]}
        submissions={[]}
        makeupOptions={[]}
      />,
    );

    expect(screen.getByText(/24\.08\.2026/)).toBeInTheDocument();
    expect(screen.getByText(/00:30/)).toBeInTheDocument();
    expect(screen.queryByText(/23\.08\.2026/)).not.toBeInTheDocument();
    expect(screen.queryByText(/21:30/)).not.toBeInTheDocument();
  });

  it("renders the makeup-lesson option date pinned to Moscow, not the ambient TZ", () => {
    const student = { id: "s1", fullName: "Петров Петр", phone: null };
    const attendance: AttendanceRecord[] = [
      {
        id: "a1",
        classSessionId: baseLessonFixture.id,
        studentId: student.id,
        status: "EXCUSED",
        priceAtTime: 0,
        homeworkCompleted: false,
        makeup: null,
      },
    ];
    const makeupOptions: MakeupLessonOption[] = [
      {
        id: "opt1",
        scheduledAt: BOUNDARY_INSTANT,
        group: { id: "g2", name: "Группа 2" },
      },
    ];

    render(
      <AttendanceClient
        lesson={baseLessonFixture}
        students={[student]}
        attendance={attendance}
        submissions={[]}
        makeupOptions={makeupOptions}
      />,
    );

    expect(screen.getByText(/Группа 2 · 24\.08\.2026/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Группа 2 · 23\.08\.2026/),
    ).not.toBeInTheDocument();
  });

  it("renders an already-assigned makeup lesson's target date pinned to Moscow", () => {
    const student = { id: "s1", fullName: "Петров Петр", phone: null };
    const attendance: AttendanceRecord[] = [
      {
        id: "a1",
        classSessionId: baseLessonFixture.id,
        studentId: student.id,
        status: "EXCUSED",
        priceAtTime: 0,
        homeworkCompleted: false,
        makeup: {
          id: "m1",
          excusedAbsenceId: "a1",
          targetClassSessionId: "session_2",
          targetClassSession: {
            id: "session_2",
            scheduledAt: BOUNDARY_INSTANT,
            group: { name: "Группа 3" },
          },
        },
      },
    ];

    render(
      <AttendanceClient
        lesson={baseLessonFixture}
        students={[student]}
        attendance={attendance}
        submissions={[]}
        makeupOptions={[]}
      />,
    );

    expect(screen.getByText(/Группа 3 · 24\.08\.2026/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Группа 3 · 23\.08\.2026/),
    ).not.toBeInTheDocument();
  });

  it("disables the attendance status select for a TEACHER on a past lesson", () => {
    const student = { id: "s1", fullName: "Петров Петр", phone: null };
    render(
      <AttendanceClient
        lesson={pastLessonFixture}
        students={[student]}
        attendance={[]}
        submissions={[]}
        userRole="TEACHER"
        makeupOptions={[]}
      />,
    );

    // Row order is status select, then grade select (makeup select only
    // renders for an EXCUSED record, which this fixture has none of) --
    // the first combobox is always the status select.
    expect(screen.getAllByRole("combobox")[0]).toBeDisabled();
  });

  it("shows the locked-editing notice for a TEACHER on a past lesson", () => {
    render(
      <AttendanceClient
        lesson={pastLessonFixture}
        students={[]}
        attendance={[]}
        submissions={[]}
        userRole="TEACHER"
        makeupOptions={[]}
      />,
    );

    expect(
      screen.getByText("Редактирование прошедших уроков доступно только администратору"),
    ).toBeInTheDocument();
  });

  it("does NOT show the locked-editing notice for an ADMIN on a past lesson", () => {
    render(
      <AttendanceClient
        lesson={pastLessonFixture}
        students={[]}
        attendance={[]}
        submissions={[]}
        userRole="ADMIN"
        makeupOptions={[]}
      />,
    );

    expect(
      screen.queryByText("Редактирование прошедших уроков доступно только администратору"),
    ).not.toBeInTheDocument();
  });

  it("does NOT show the locked-editing notice for a TEACHER on a future lesson", () => {
    // Explicit far-future date, not baseLessonFixture's fixed 2026-09-01 --
    // that date is already in the past by the time this plan is executed,
    // which would make this "future lesson" case flaky.
    render(
      <AttendanceClient
        lesson={{ ...baseLessonFixture, scheduledAt: "2099-01-01T12:00:00.000Z" }}
        students={[]}
        attendance={[]}
        submissions={[]}
        userRole="TEACHER"
        makeupOptions={[]}
      />,
    );

    expect(
      screen.queryByText("Редактирование прошедших уроков доступно только администратору"),
    ).not.toBeInTheDocument();
  });
});
