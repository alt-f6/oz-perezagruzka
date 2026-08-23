import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    lesson: { findMany: (...args: unknown[]) => findManyMock(...args) },
  },
}));

function makeRequest(query = "") {
  return new NextRequest(`http://localhost/api/admin/lessons${query}`);
}

const lessonRow = (id: string, order: number) => ({
  id,
  title: `Lesson ${id}`,
  description: "",
  content: "",
  order,
  isPublished: true,
});

beforeEach(() => {
  requireRoleMock.mockReset();
  findManyMock.mockReset();
  requireRoleMock.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
});

describe("GET /api/admin/lessons", () => {
  it("requests limit+1 rows ordered by order,id and returns nextCursor: null with no extra row", async () => {
    findManyMock.mockResolvedValue([lessonRow("l1", 1)]);
    const { GET } = await import("./route");

    const res = await GET(makeRequest("?limit=5"));
    const json = await res.json();

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ order: "asc" }, { id: "asc" }],
        take: 6,
      }),
    );
    expect(json.lessons).toHaveLength(1);
    expect(json.nextCursor).toBeNull();
  });

  it("trims the extra row and returns the last item's id as nextCursor", async () => {
    findManyMock.mockResolvedValue([lessonRow("l1", 1), lessonRow("l2", 2)]);
    const { GET } = await import("./route");

    const res = await GET(makeRequest("?limit=1"));
    const json = await res.json();

    expect(json.lessons).toHaveLength(1);
    expect(json.nextCursor).toBe("l1");
  });

  it("passes the cursor query param through to Prisma's cursor/skip", async () => {
    findManyMock.mockResolvedValue([]);
    const { GET } = await import("./route");

    await GET(makeRequest("?cursor=l9"));

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "l9" }, skip: 1 }),
    );
  });
});
