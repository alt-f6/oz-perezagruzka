import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const routerMock = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));

const { TimezoneSwitcher } = await import("./TimezoneSwitcher");

beforeEach(() => {
  vi.clearAllMocks();
  document.cookie = "crm_display_tz=; path=/; max-age=0"; // clear
});

describe("TimezoneSwitcher", () => {
  it("shows the active zone's label", () => {
    render(<TimezoneSwitcher value="Asia/Baku" />);
    expect(screen.getByRole("button", { name: /Баку/ })).toBeInTheDocument();
  });

  it("writes the cookie and refreshes when a different zone is picked", async () => {
    const user = userEvent.setup();
    render(<TimezoneSwitcher value="Europe/Moscow" />);

    await user.click(screen.getByRole("button", { name: /Москва/ }));
    await user.click(screen.getByRole("option", { name: /Баку/ }));

    expect(document.cookie).toContain("crm_display_tz=Asia/Baku");
    expect(routerMock.refresh).toHaveBeenCalled();
  });
});
