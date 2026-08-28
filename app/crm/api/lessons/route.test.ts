import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const listLessonsMock = vi.fn();

vi.mock("@/shared/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/rbac")>("@/shared/lib/rbac");
  return { ...actual, requireRole: (...args: unknown[]) => requireRoleMock(...args) };
});
vi.mock("@/crm/lib/services/lesson-list.service", () => ({
  listLessons: (...args: unknown[]) => listLessonsMock(...args),
}));

function makeRequest(query = "") {
  return new NextRequest(`http://localhost/crm/api/lessons${query}`);
}

beforeEach(() => {
  requireRoleMock.mockReset();
  listLessonsMock.mockReset();
  requireRoleMock.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
  listLessonsMock.mockResolvedValue({ lessons: [], nextCursor: null });
});

describe("GET /crm/api/lessons", () => {
  it("returns 401/403 via rbacErrorResponse when requireRole rejects", async () => {
    const { RbacError } = await import("@/shared/lib/rbac");
    requireRoleMock.mockRejectedValue(new RbacError(401, "unauthorized"));
    const { GET } = await import("./route");

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    expect(listLessonsMock).not.toHaveBeenCalled();
  });

  it("passes the parsed cursor/limit and session user through to listLessons", async () => {
    const { GET } = await import("./route");

    await GET(makeRequest("?cursor=l5&limit=10"));

    expect(listLessonsMock).toHaveBeenCalledWith({
      sessionUser: { id: "admin_1", role: "ADMIN" },
      cursor: "l5",
      limit: 10,
    });
  });
});
