import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DatePicker } from "./DatePicker";

describe("DatePicker", () => {
  it("shows a placeholder when no value is set, and opens a day grid on click", async () => {
    const user = userEvent.setup();
    render(<DatePicker value="" onChange={() => {}} />);

    expect(screen.getByText("Выберите дату")).toBeInTheDocument();
    await user.click(screen.getByText("Выберите дату").closest("button")!);

    expect(screen.getByRole("button", { name: "23" })).toBeInTheDocument();
  });

  it("calls onChange with an ISO date string when a day is clicked, and closes the popover", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker value="2026-08-23" onChange={onChange} />);

    await user.click(screen.getByText(/2026/).closest("button")!);
    await user.click(screen.getByRole("button", { name: "25" }));

    expect(onChange).toHaveBeenCalledWith("2026-08-25");
  });

  it("disables days before min", async () => {
    const user = userEvent.setup();
    render(<DatePicker value="2026-08-23" onChange={() => {}} min="2026-08-20" />);

    await user.click(screen.getByText(/2026/).closest("button")!);
    expect(screen.getByRole("button", { name: "10" })).toBeDisabled();
  });
});
