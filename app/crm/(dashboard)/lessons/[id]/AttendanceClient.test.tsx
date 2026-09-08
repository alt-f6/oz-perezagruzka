import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClassSessionWithGroup } from "@/crm/lib/types";
import { AttendanceClient } from "./AttendanceClient";

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

describe("AttendanceClient", () => {
  it("shows the assigned teacher's name in the lesson header", () => {
    render(
      <AttendanceClient
        lesson={{ ...baseLessonFixture, teacher: { fullName: "Иван Иванов" } }}
        students={[]}
        attendance={[]}
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
        makeupOptions={[]}
      />,
    );

    expect(screen.getByText("Без преподавателя")).toBeInTheDocument();
  });
});
