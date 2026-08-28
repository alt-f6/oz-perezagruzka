import { render, screen } from "@testing-library/react";
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
  overrides: Partial<StudentsClientProps["students"][number]> = {},
): StudentsClientProps["students"][number] {
  return {
    id: "student_1",
    fullName: "Иван Иванов",
    phone: "+79991234567",
    groups: [{ id: "g1", name: "Группа 1", teacherId: "t1" }],
    transactions: [{ amount: 5000 }],
    ...overrides,
  } as StudentsClientProps["students"][number];
}

describe("StudentsClient", () => {
  it("shows phone and balance columns for ADMIN/MANAGER", () => {
    render(
      <StudentsClient students={[makeStudent()]} groups={groups} userRole="ADMIN" />,
    );

    expect(screen.getByText("+79991234567")).toBeInTheDocument();
    expect(screen.getByText(/5 000/)).toBeInTheDocument();
  });

  it("hides phone number and balance from TEACHER", () => {
    render(
      <StudentsClient
        students={[makeStudent({ phone: null, transactions: [] })]}
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
      <StudentsClient students={[makeStudent()]} groups={groups} userRole="TEACHER" />,
    );

    expect(screen.queryByText("Добавить студента")).not.toBeInTheDocument();
  });
});
