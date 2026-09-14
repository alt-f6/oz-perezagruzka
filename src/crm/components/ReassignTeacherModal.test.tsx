import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReassignTeacherModal } from "./ReassignTeacherModal";

describe("ReassignTeacherModal", () => {
  it("shows the selection count", () => {
    render(
      <ReassignTeacherModal
        open
        sessionCount={3}
        teachers={[{ id: "t1", fullName: "Иванова" }]}
        busy={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Занятий к переносу: 3/)).toBeInTheDocument();
  });

  it("disables the confirm button until a teacher is chosen", () => {
    render(
      <ReassignTeacherModal
        open
        sessionCount={1}
        teachers={[{ id: "t1", fullName: "Иванова" }]}
        busy={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Сменить").closest("button")).toBeDisabled();
  });

  it("calls onClose when Отмена is clicked", () => {
    const onClose = vi.fn();
    render(
      <ReassignTeacherModal
        open
        sessionCount={1}
        teachers={[]}
        busy={false}
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText("Отмена"));
    expect(onClose).toHaveBeenCalled();
  });
});
