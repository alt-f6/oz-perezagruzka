import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionUserMock = vi.fn();

vi.mock("@/lms/server/auth/session", () => ({
  getSessionUser: (...args: unknown[]) => getSessionUserMock(...args),
}));

describe("requireRoleApi", () => {
  beforeEach(() => {
    getSessionUserMock.mockReset();
  });

  it("throws a 401 when there is no session", async () => {
    getSessionUserMock.mockResolvedValue(null);
    const { requireRoleApi } = await import("./require-role-api");

    await expect(requireRoleApi("ADMIN")).rejects.toMatchObject({ status: 401, message: "unauthorized" });
  });

  it("returns the user when their role matches a single allowed role", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "a@b.com", role: "MANAGER" });
    const { requireRoleApi } = await import("./require-role-api");

    const user = await requireRoleApi("MANAGER");

    expect(user).toEqual({ id: "u1", email: "a@b.com", role: "MANAGER" });
  });

  it("returns the user when their role matches one entry in an allowed-roles array", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u2", email: "s@b.com", role: "STUDENT" });
    const { requireRoleApi } = await import("./require-role-api");

    const user = await requireRoleApi(["ADMIN", "MANAGER", "STUDENT"]);

    expect(user.role).toBe("STUDENT");
  });

  it("throws a 403 when the role is authenticated but not in the allowed list", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u3", email: "t@b.com", role: "TEACHER" });
    const { requireRoleApi } = await import("./require-role-api");

    await expect(requireRoleApi(["ADMIN", "MANAGER"])).rejects.toMatchObject({
      status: 403,
      message: "forbidden",
    });
  });

  it("lets ADMIN bypass any allowed-roles list, even lists that don't include ADMIN", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u4", email: "admin@b.com", role: "ADMIN" });
    const { requireRoleApi } = await import("./require-role-api");

    const user = await requireRoleApi("STUDENT");

    expect(user.role).toBe("ADMIN");
  });
});
