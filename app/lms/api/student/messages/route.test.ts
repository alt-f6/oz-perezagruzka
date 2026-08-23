import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const findManyMock = vi.fn();
const canViewLessonMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    lessonMessage: { findMany: (...args: unknown[]) => findManyMock(...args) },
  },
}));
vi.mock("@/lms/server/access/can-view-lesson", () => ({
  canViewLesson: (...args: unknown[]) => canViewLessonMock(...args),
}));

function makeRequest(query: string) {
  return new NextRequest(`http://localhost/api/student/messages${query}`);
}

const row = (id: string) => ({
  id,
  text: "hi",
  senderRole: "STUDENT",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  lesson: { title: "Lesson 1" },
});

beforeEach(() => {
  requireRoleMock.mockReset();
  findManyMock.mockReset();
  canViewLessonMock.mockReset();
  requireRoleMock.mockResolvedValue({ id: "student_1", role: "STUDENT" });
  canViewLessonMock.mockResolvedValue(true);
});

describe("GET /api/student/messages", () => {
  it("requests limit+1 rows ordered by createdAt,id asc and returns nextCursor: null with no extra row", async () => {
    findManyMock.mockResolvedValue([row("m1")]);
    const { GET } = await import("./route");

    const res = await GET(makeRequest("?lessonId=lesson-1&limit=5"));
    const json = await res.json();

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 6,
      }),
    );
    expect(json.messages).toHaveLength(1);
    expect(json.nextCursor).toBeNull();
  });

  it("trims the extra row and returns the last item's id as nextCursor", async () => {
    findManyMock.mockResolvedValue([row("m1"), row("m2")]);
    const { GET } = await import("./route");

    const res = await GET(makeRequest("?lessonId=lesson-1&limit=1"));
    const json = await res.json();

    expect(json.messages).toHaveLength(1);
    expect(json.nextCursor).toBe("m1");
  });

  it("passes the cursor query param through to Prisma's cursor/skip", async () => {
    findManyMock.mockResolvedValue([]);
    const { GET } = await import("./route");

    await GET(makeRequest("?lessonId=lesson-1&cursor=m9"));

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "m9" }, skip: 1 }),
    );
  });

  it("defaults to the prior 500-row cap when no limit query param is supplied", async () => {
    findManyMock.mockResolvedValue([]);
    const { GET } = await import("./route");

    await GET(makeRequest("?lessonId=lesson-1"));

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: 501 }),
    );
  });
});
