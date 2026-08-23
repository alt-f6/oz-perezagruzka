import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionUserMock = vi.fn();
const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock("@/shared/lib/auth", () => ({
  getSessionUser: () => getSessionUserMock(),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirectMock(path),
}));

const ADMIN_USER = { id: "u1", role: "ADMIN", email: "a@x.com" };
const STUDENT_USER = { id: "u2", role: "STUDENT", email: "s@x.com" };

describe("requireRole", () => {
  beforeEach(() => {
    getSessionUserMock.mockReset();
    redirectMock.mockClear();
  });

  it("throws a 401 RbacError when there is no session", async () => {
    getSessionUserMock.mockResolvedValue(null);
    const { requireRole, RbacError } = await import("./rbac");

    await expect(requireRole(["ADMIN"])).rejects.toMatchObject({ status: 401 });
    await expect(requireRole(["ADMIN"])).rejects.toBeInstanceOf(RbacError);
  });

  it("throws a 403 RbacError when the role isn't in the allow-list", async () => {
    getSessionUserMock.mockResolvedValue(STUDENT_USER);
    const { requireRole } = await import("./rbac");

    await expect(requireRole(["ADMIN", "MANAGER"])).rejects.toMatchObject({ status: 403 });
  });

  it("returns the user when the role is in the allow-list", async () => {
    getSessionUserMock.mockResolvedValue(STUDENT_USER);
    const { requireRole } = await import("./rbac");

    await expect(requireRole(["STUDENT"])).resolves.toEqual(STUDENT_USER);
  });

  it("does NOT bypass for ADMIN by default", async () => {
    getSessionUserMock.mockResolvedValue(ADMIN_USER);
    const { requireRole } = await import("./rbac");

    await expect(requireRole(["STUDENT"])).rejects.toMatchObject({ status: 403 });
  });

  it("bypasses for ADMIN only when adminBypass: true is passed explicitly", async () => {
    getSessionUserMock.mockResolvedValue(ADMIN_USER);
    const { requireRole } = await import("./rbac");

    await expect(requireRole(["STUDENT"], { adminBypass: true })).resolves.toEqual(ADMIN_USER);
  });
});

describe("requireRoleForPage", () => {
  beforeEach(() => {
    getSessionUserMock.mockReset();
    redirectMock.mockClear();
  });

  it("redirects to the given loginPath when unauthenticated", async () => {
    getSessionUserMock.mockResolvedValue(null);
    const { requireRoleForPage } = await import("./rbac");

    await expect(requireRoleForPage(["ADMIN"], { loginPath: "/lms/login" })).rejects.toThrow(
      "NEXT_REDIRECT:/lms/login",
    );
    expect(redirectMock).toHaveBeenCalledWith("/lms/login");
  });

  it("redirects to the given loginPath when forbidden", async () => {
    getSessionUserMock.mockResolvedValue(STUDENT_USER);
    const { requireRoleForPage } = await import("./rbac");

    await expect(requireRoleForPage(["ADMIN"], { loginPath: "/lms/login" })).rejects.toThrow(
      "NEXT_REDIRECT:/lms/login",
    );
  });

  it("returns the user on success without calling redirect", async () => {
    getSessionUserMock.mockResolvedValue(STUDENT_USER);
    const { requireRoleForPage } = await import("./rbac");

    await expect(requireRoleForPage(["STUDENT"], { loginPath: "/lms/login" })).resolves.toEqual(
      STUDENT_USER,
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("rbacErrorResponse", () => {
  it("maps an RbacError to a matching-status JSON response", async () => {
    const { RbacError, rbacErrorResponse } = await import("./rbac");
    const res = rbacErrorResponse(new RbacError(403, "forbidden"));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "forbidden" });
  });

  it("defaults non-RbacError values to 500", async () => {
    const { rbacErrorResponse } = await import("./rbac");
    const res = rbacErrorResponse(new Error("boom"));

    expect(res.status).toBe(500);
  });
});
