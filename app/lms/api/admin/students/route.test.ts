import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    user: { findMany: (...args: unknown[]) => findManyMock(...args) },
  },
}));

function makeRequest(query = "") {
  return new NextRequest(`http://localhost/api/admin/students${query}`);
}

beforeEach(() => {
  requireRoleMock.mockReset();
  findManyMock.mockReset();
  requireRoleMock.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
});

describe("GET /api/admin/students", () => {
  it("requests limit+1 rows and returns nextCursor: null when there is no extra row", async () => {
    findManyMock.mockResolvedValue([
      { id: "u1", email: "a@example.com", role: "STUDENT", fullName: "A" },
    ]);
    const { GET } = await import("./route");

    const res = await GET(makeRequest("?limit=5"));
    const json = await res.json();

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: 6 }),
    );
    expect(json.ok).toBe(true);
    expect(json.students).toHaveLength(1);
    expect(json.nextCursor).toBeNull();
  });

  it("trims the extra row and returns the last item's id as nextCursor", async () => {
    findManyMock.mockResolvedValue([
      { id: "u1", email: "a@example.com", role: "STUDENT", fullName: "A" },
      { id: "u2", email: "b@example.com", role: "STUDENT", fullName: "B" },
    ]);
    const { GET } = await import("./route");

    const res = await GET(makeRequest("?limit=1"));
    const json = await res.json();

    expect(json.students).toHaveLength(1);
    expect(json.nextCursor).toBe("u1");
  });

  it("passes the cursor query param through to Prisma's cursor/skip", async () => {
    findManyMock.mockResolvedValue([]);
    const { GET } = await import("./route");

    await GET(makeRequest("?cursor=u5"));

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "u5" }, skip: 1 }),
    );
  });

  it("omits cursor/skip when no cursor query param is given", async () => {
    findManyMock.mockResolvedValue([]);
    const { GET } = await import("./route");

    await GET(makeRequest());

    const call = findManyMock.mock.calls[0][0];
    expect(call.cursor).toBeUndefined();
    expect(call.skip).toBeUndefined();
  });
});
