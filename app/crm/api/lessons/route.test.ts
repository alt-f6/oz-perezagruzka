import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const listLessonsPageMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/rbac")>();
  return { ...actual, requireRole: requireRoleMock };
});
vi.mock("@/crm/lib/services/lesson-list.service", () => ({ listLessonsPage: listLessonsPageMock }));

import { GET } from "./route";

beforeEach(() => {
  requireRoleMock.mockReset();
  listLessonsPageMock.mockReset();
});

describe("GET /crm/api/lessons", () => {
  it("returns an RBAC error response for an unauthenticated request", async () => {
    const { RbacError } = await import("@/shared/lib/rbac");
    requireRoleMock.mockRejectedValue(new RbacError(401, "unauthorized"));

    const res = await GET(new Request("http://x/crm/api/lessons") as never);

    expect(res.status).toBe(401);
  });

  it("parses filters from the query string and forwards them, ignoring teacherId for a TEACHER", async () => {
    requireRoleMock.mockResolvedValue({ id: "t1", role: "TEACHER" });
    listLessonsPageMock.mockResolvedValue({ lessons: [], total: 0, page: 1, pageSize: 25 });

    const res = await GET(
      new Request("http://x/crm/api/lessons?q=abc&teacherId=550e8400-e29b-41d4-a716-446655440000&page=2") as never,
    );
    const json = await res.json();

    expect(json.ok).toBe(true);
    const call = listLessonsPageMock.mock.calls[0][0];
    expect(call.filters.q).toBe("abc");
    expect(call.filters.teacherId).toBeUndefined();
    expect(call.filters.page).toBe(2);
  });

  it("forwards an explicit teacherId filter for ADMIN/MANAGER", async () => {
    requireRoleMock.mockResolvedValue({ id: "a1", role: "ADMIN" });
    listLessonsPageMock.mockResolvedValue({ lessons: [], total: 0, page: 1, pageSize: 25 });

    await GET(new Request("http://x/crm/api/lessons?teacherId=550e8400-e29b-41d4-a716-446655440000") as never);

    const call = listLessonsPageMock.mock.calls[0][0];
    expect(call.filters.teacherId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
});
