import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    assignment: { findMany: (...args: unknown[]) => findManyMock(...args) },
  },
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
  requireRoleMock.mockResolvedValue({ id: "student_1", role: "STUDENT" });
});

describe("GET /api/student/lessons", () => {
  it("requests limit+1 rows ordered by lesson.order,lesson.id,id and returns nextCursor: null with no extra row", async () => {
    const rows = [assignmentRow("a1", "l1", 1)];
    findManyMock.mockResolvedValue(rows);
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

  it("trims the extra row and returns the last assignment's id (not lesson's id) as nextCursor", async () => {
    // The queried model is Assignment, whose own id is the cursor field — it deliberately
    // differs from the rendered item's id (lesson.id). This exercises the REAL
    // buildCursorPage against Assignment-shaped rows to prove the cursor is derived from
    // the assignment row, not the nested lesson.
    const rows = [
      assignmentRow("a1", "l1", 1),
      assignmentRow("a2", "l2", 2),
    ];
    findManyMock.mockResolvedValue(rows);
    const { GET } = await import("./route");

    const res = await GET(makeRequest("?limit=1"));
    const json = await res.json();

    expect(json.lessons).toHaveLength(1);
    expect(json.lessons[0].id).toBe("l1");
    expect(json.nextCursor).toBe("a1");
    expect(json.nextCursor).not.toBe("l1");
  });

  it("passes the cursor query param through to Prisma's cursor/skip", async () => {
    findManyMock.mockResolvedValue([]);
    const { GET } = await import("./route");

    await GET(makeRequest("?cursor=a9"));

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "a9" }, skip: 1 }),
    );
  });

  it("defaults to the prior 500-row cap when no limit query param is supplied", async () => {
    findManyMock.mockResolvedValue([]);
    const { GET } = await import("./route");

    await GET(makeRequest());

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: 501 }),
    );
  });
});
