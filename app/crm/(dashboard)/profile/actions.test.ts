import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({ user: { update: vi.fn() } }));
const rbacMock = vi.hoisted(() => ({ requireRole: vi.fn() }));

vi.mock("@/shared/lib/db", () => ({ db: dbMock }));
vi.mock("@/shared/lib/rbac", () => rbacMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { updateTimezone } = await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
  rbacMock.requireRole.mockResolvedValue({ id: "user_1", email: "a@a.com", role: "TEACHER" });
});

describe("updateTimezone", () => {
  it("saves an allowed zone", async () => {
    dbMock.user.update.mockResolvedValue({});
    const result = await updateTimezone("Asia/Baku");
    expect(result.error).toBeUndefined();
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { timezone: "Asia/Baku" },
    });
  });

  it("rejects a zone outside the allowed 4", async () => {
    const result = await updateTimezone("America/New_York");
    expect(result.error).toBeTruthy();
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });
});
