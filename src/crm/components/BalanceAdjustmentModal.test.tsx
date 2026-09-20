// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const showToastMock = vi.hoisted(() => vi.fn());
vi.mock("@/crm/components/ToastProvider", () => ({ useToast: () => showToastMock }));

const { BalanceAdjustmentModal } = await import("./BalanceAdjustmentModal");

beforeEach(() => {
  showToastMock.mockClear();
});

describe("BalanceAdjustmentModal", () => {
  it("opens the modal and submits amount/description to updateBalance", async () => {
    const updateBalance = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();
    render(<BalanceAdjustmentModal studentId="student_1" updateBalance={updateBalance} />);

    await user.click(screen.getByRole("button", { name: /скорректировать баланс/i }));
    await user.type(screen.getByLabelText(/сумма операции/i), "-500");
    await user.type(screen.getByLabelText(/основание/i), "случайный платеж");
    fireEvent.click(screen.getByRole("button", { name: /провести транзакцию/i }));

    await waitFor(() => {
      expect(updateBalance).toHaveBeenCalledWith("student_1", -500, "случайный платеж");
    });
  });

  it("shows a toast and keeps the modal open when the action returns an error", async () => {
    const updateBalance = vi.fn().mockResolvedValue({ error: "Недостаточно прав" });
    const user = userEvent.setup();
    render(<BalanceAdjustmentModal studentId="student_1" updateBalance={updateBalance} />);

    await user.click(screen.getByRole("button", { name: /скорректировать баланс/i }));
    await user.type(screen.getByLabelText(/сумма операции/i), "-500");
    fireEvent.click(screen.getByRole("button", { name: /провести транзакцию/i }));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith("Недостаточно прав", "error");
    });
    expect(screen.getByRole("button", { name: /провести транзакцию/i })).toBeInTheDocument();
  });
});
