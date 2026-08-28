import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/crm/components/ToastProvider", () => ({ useToast: () => toastMock }));

const actionsMock = vi.hoisted(() => ({
  createStudent: vi.fn(),
  deleteStudent: vi.fn(),
  updateStudentBalance: vi.fn(),
}));
vi.mock("./actions", () => actionsMock);

const { StudentsClient } = await import("./StudentsClient");
type StudentsClientProps = Parameters<typeof StudentsClient>[0];

const groups = [{ id: "g1", name: "Группа 1", teacherId: "t1" }];

function makeStudent(
  overrides: Partial<StudentsClientProps["initialStudents"][number]> = {},
): StudentsClientProps["initialStudents"][number] {
  return {
    id: "student_1",
    fullName: "Иван Иванов",
    phone: "+79991234567",
    groups: [{ id: "g1", name: "Группа 1", teacherId: "t1" }],
    transactions: [{ amount: 5000 }],
    ...overrides,
  } as StudentsClientProps["initialStudents"][number];
}

describe("StudentsClient", () => {
  it("shows phone and balance columns for ADMIN/MANAGER", () => {
    render(
      <StudentsClient
        initialStudents={[makeStudent()]}
        initialNextCursor={null}
        groups={groups}
        userRole="ADMIN"
      />,
    );

    expect(screen.getByText("+79991234567")).toBeInTheDocument();
    expect(screen.getByText(/5 000/)).toBeInTheDocument();
  });

  it("hides phone number and balance from TEACHER", () => {
    render(
      <StudentsClient
        initialStudents={[makeStudent({ phone: null, transactions: [] })]}
        initialNextCursor={null}
        groups={groups}
        userRole="TEACHER"
      />,
    );

    expect(screen.queryByText("+79991234567")).not.toBeInTheDocument();
    expect(screen.queryByText("Телефон")).not.toBeInTheDocument();
    expect(screen.queryByText("Баланс")).not.toBeInTheDocument();
  });

  it("hides the add-student control for TEACHER", () => {
    render(
      <StudentsClient
        initialStudents={[makeStudent()]}
        initialNextCursor={null}
        groups={groups}
        userRole="TEACHER"
      />,
    );

    expect(screen.queryByText("Добавить студента")).not.toBeInTheDocument();
  });

  it("debounces a search query by calling the students API and replacing the list", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        students: [{ id: "s9", fullName: "Filtered", groups: [] }],
        nextCursor: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <StudentsClient
        initialStudents={[]}
        initialNextCursor={null}
        groups={[]}
        userRole="ADMIN"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Поиск/), {
      target: { value: "Ann" },
    });
    await vi.advanceTimersByTimeAsync(300);
    expect(fetchMock).toHaveBeenCalledWith("/crm/api/students?search=Ann");

    vi.useRealTimers();
    expect(await screen.findByText("Filtered")).toBeInTheDocument();
  });
});
