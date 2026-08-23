import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const findManyMock = vi.fn();
const buildCursorPageMock = vi.fn();
const parsePaginationParamsMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    assignment: { findMany: (...args: unknown[]) => findManyMock(...args) },
  },
}));
vi.mock("@/shared/lib/pagination", () => ({
  buildCursorPage: (...args: unknown[]) => buildCursorPageMock(...args),
  parsePaginationParams: (...args: unknown[]) => parsePaginationParamsMock(...args),
}));

function makeRequest(query = "") {
  return new NextRequest(`http://localhost/api/student/lessons${query}`);
}

const assignmentRow = (assignmentId: string, lessonId: string, order: number) => ({
  id: assignmentId,
  lesson: {
    id: lessonId,
    title: `Lesson ${lessonId}`,
    description: "",
    order,
    progress: [],
  },
});

beforeEach(() => {
  requireRoleMock.mockReset();
  findManyMock.mockReset();
  buildCursorPageMock.mockReset();
  parsePaginationParamsMock.mockReset();
  requireRoleMock.mockResolvedValue({ id: "student_1", role: "STUDENT" });
});

describe("GET /api/student/lessons", () => {
  it("requests limit+1 rows ordered by lesson.order,lesson.id,id and returns nextCursor: null with no extra row", async () => {
    const rows = [assignmentRow("a1", "l1", 1)];
    findManyMock.mockResolvedValue(rows);
    parsePaginationParamsMock.mockReturnValue({ cursor: undefined, limit: 5 });
    buildCursorPageMock.mockReturnValue({ items: rows, nextCursor: null });
    const { GET } = await import("./route");

    const res = await GET(makeRequest("?limit=5"));
    const json = await res.json();

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ lesson: { order: "asc" } }, { lesson: { id: "asc" } }, { id: "asc" }],
        take: 6,
      }),
    );
    expect(json.lessons).toHaveLength(1);
    expect(json.nextCursor).toBeNull();
  });

  it("trims the extra row and returns the last assignment's id as nextCursor", async () => {
    const rows = [
      assignmentRow("a1", "l1", 1),
      assignmentRow("a2", "l2", 2),
    ];
    const trimmedRows = [rows[0]];
    findManyMock.mockResolvedValue(rows);
    parsePaginationParamsMock.mockReturnValue({ cursor: undefined, limit: 1 });
    buildCursorPageMock.mockReturnValue({ items: trimmedRows, nextCursor: "a1" });
    const { GET } = await import("./route");

    const res = await GET(makeRequest("?limit=1"));
    const json = await res.json();

    expect(json.lessons).toHaveLength(1);
    expect(json.lessons[0].id).toBe("l1");
    expect(json.nextCursor).toBe("a1");
  });

  it("passes the cursor query param through to Prisma's cursor/skip", async () => {
    findManyMock.mockResolvedValue([]);
    parsePaginationParamsMock.mockReturnValue({ cursor: "a9", limit: 50 });
    buildCursorPageMock.mockReturnValue({ items: [], nextCursor: null });
    const { GET } = await import("./route");

    await GET(makeRequest("?cursor=a9"));

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "a9" }, skip: 1 }),
    );
  });
});
