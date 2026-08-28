// app/crm/api/students/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const listStudentsMock = vi.fn();

vi.mock("@/shared/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/rbac")>("@/shared/lib/rbac");
  return { ...actual, requireRole: (...args: unknown[]) => requireRoleMock(...args) };
});
vi.mock("@/crm/lib/services/student-list.service", () => ({
  listStudents: (...args: unknown[]) => listStudentsMock(...args),
}));

function makeRequest(query = "") {
  return new NextRequest(`http://localhost/crm/api/students${query}`);
}

beforeEach(() => {
  requireRoleMock.mockReset();
  listStudentsMock.mockReset();
  requireRoleMock.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
  listStudentsMock.mockResolvedValue({ students: [], nextCursor: null });
});

describe("GET /crm/api/students", () => {
  it("returns 401/403 via rbacErrorResponse when requireRole rejects", async () => {
    const { RbacError } = await import("@/shared/lib/rbac");
    requireRoleMock.mockRejectedValue(new RbacError(403, "forbidden"));
    const { GET } = await import("./route");

    const res = await GET(makeRequest());

    expect(res.status).toBe(403);
    expect(listStudentsMock).not.toHaveBeenCalled();
  });

  it("passes the parsed search/cursor/limit and session user through to listStudents", async () => {
    const { GET } = await import("./route");

    await GET(makeRequest("?search=Ann&cursor=s5&limit=10"));

    expect(listStudentsMock).toHaveBeenCalledWith({
      sessionUser: { id: "admin_1", role: "ADMIN" },
      search: "Ann",
      cursor: "s5",
      limit: 10,
    });
  });

  it("defaults search to undefined and returns the service result as ok:true json", async () => {
    listStudentsMock.mockResolvedValue({
      students: [{ id: "s1", fullName: "A", phone: null, groups: [], transactions: [] }],
      nextCursor: "s1",
    });
    const { GET } = await import("./route");

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(listStudentsMock).toHaveBeenCalledWith(
      expect.objectContaining({ search: undefined }),
    );
    expect(json).toEqual({
      ok: true,
      students: [{ id: "s1", fullName: "A", phone: null, groups: [], transactions: [] }],
      nextCursor: "s1",
    });
  });
});
