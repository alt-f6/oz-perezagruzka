import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/crm/components/ToastProvider", () => ({ useToast: () => toastMock }));

const actionsMock = vi.hoisted(() => ({ updateTimezone: vi.fn() }));
vi.mock("./actions", () => actionsMock);

const { ProfileClient } = await import("./ProfileClient");

describe("ProfileClient", () => {
  it("saves the selected timezone and shows a success toast", async () => {
    actionsMock.updateTimezone.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ProfileClient initialTimezone="Europe/Moscow" />);

    await user.selectOptions(screen.getByLabelText("Часовой пояс"), "Asia/Baku");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(actionsMock.updateTimezone).toHaveBeenCalledWith("Asia/Baku");
    expect(toastMock).toHaveBeenCalledWith("Часовой пояс сохранён");
  });

  it("shows the returned error instead of a success toast", async () => {
    actionsMock.updateTimezone.mockResolvedValue({ error: "Некорректный часовой пояс" });
    const user = userEvent.setup();
    render(<ProfileClient initialTimezone="Europe/Moscow" />);

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(toastMock).toHaveBeenCalledWith("Некорректный часовой пояс", "error");
  });
});
