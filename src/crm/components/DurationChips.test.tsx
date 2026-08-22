import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DurationChips } from "./DurationChips";

describe("DurationChips", () => {
  it("renders a chip for every allowed duration", () => {
    render(<DurationChips value={60} onChange={() => {}} />);
    for (const label of ["30 мин", "45 мин", "60 мин", "90 мин", "120 мин"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("marks the selected chip and calls onChange with the numeric value on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DurationChips value={60} onChange={onChange} />);

    const selected = screen.getByText("60 мин");
    expect(selected).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByText("90 мин"));
    expect(onChange).toHaveBeenCalledWith(90);
  });

  it("disables all chips when disabled is true", () => {
    render(<DurationChips value={60} onChange={() => {}} disabled />);
    expect(screen.getByText("30 мин").closest("button")).toBeDisabled();
  });
});
