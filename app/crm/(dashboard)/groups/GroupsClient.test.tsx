import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupWithDetails } from "@/crm/lib/types";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/crm/components/ToastProvider", () => ({ useToast: () => toastMock }));

const actionsMock = vi.hoisted(() => ({
  createGroup: vi.fn(),
  deleteGroup: vi.fn(),
  cancelGroupUpcomingSessions: vi.fn(),
  assignTeacherToGroup: vi.fn(),
  updateGroup: vi.fn(),
}));
vi.mock("./actions", () => actionsMock);
vi.mock("../students/actions", () => ({
  assignStudentToGroup: vi.fn(),
  removeStudentFromGroup: vi.fn(),
}));

const { GroupsClient } = await import("./GroupsClient");

const groups: GroupWithDetails[] = [
  {
    id: "g1",
    name: "Группа 1",
    teacherId: "t1",
    pricePerLesson: 1000,
    teacher: { fullName: "Иван Иванов" },
    students: [],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GroupsClient clear-upcoming-schedule", () => {
  it("shows a confirm dialog and calls cancelGroupUpcomingSessions on confirm", async () => {
    const user = userEvent.setup();
    actionsMock.cancelGroupUpcomingSessions.mockResolvedValue({ cancelledCount: 4, skippedCount: 0 });

    render(
      <GroupsClient groups={groups} teachers={[]} allStudents={[]} userRole="ADMIN" />,
    );

    await user.click(screen.getByTitle("Очистить будущее расписание"));
    expect(screen.getByText("Очистить будущее расписание группы?")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Например/), "Группа расформирована");
    await user.click(screen.getByRole("button", { name: "Очистить" }));

    expect(actionsMock.cancelGroupUpcomingSessions).toHaveBeenCalledWith("g1");
  });

  it("does not show the action for a TEACHER", () => {
    render(
      <GroupsClient groups={groups} teachers={[]} allStudents={[]} userRole="TEACHER" />,
    );
    expect(screen.queryByTitle("Очистить будущее расписание")).not.toBeInTheDocument();
  });
});
