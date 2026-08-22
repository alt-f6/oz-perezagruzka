import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TimeSlotPicker } from "./TimeSlotPicker";

describe("TimeSlotPicker", () => {
  it("renders 15-minute slots by default and marks the selected one", () => {
    render(<TimeSlotPicker value="09:30" onChange={() => {}} />);
    expect(screen.getByText("09:30")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("09:15")).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the clicked slot", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeSlotPicker value="09:00" onChange={onChange} />);

    await user.click(screen.getByText("10:30"));
    expect(onChange).toHaveBeenCalledWith("10:30");
  });

  it("builds 30-minute slots when stepMinutes=30", () => {
    render(<TimeSlotPicker value="" onChange={() => {}} stepMinutes={30} />);
    expect(screen.getByText("09:00")).toBeInTheDocument();
    expect(screen.queryByText("09:15")).not.toBeInTheDocument();
  });

  it("disables all chips when disabled is true", () => {
    render(<TimeSlotPicker value="09:00" onChange={() => {}} disabled />);
    expect(screen.getByText("09:00").closest("button")).toBeDisabled();
  });
});
