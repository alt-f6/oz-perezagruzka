import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const dummyRequest = () => new NextRequest("http://localhost/api/admin/messages");

const requireRoleMock = vi.fn();
const findManyMock = vi.fn();
const enforceRateLimitMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    lessonMessage: { findMany: (...args: unknown[]) => findManyMock(...args) },
  },
}));
vi.mock("@/lms/server/http/rate-limit", () => ({
  enforceRateLimit: (...args: unknown[]) => enforceRateLimitMock(...args),
}));

describe("GET /api/admin/messages", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    findManyMock.mockReset();
    enforceRateLimitMock.mockReset();
    enforceRateLimitMock.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    requireRoleMock.mockRejectedValue(Object.assign(new Error("unauthorized"), { status: 401 }));
    const { GET } = await import("./route");

    const res = await GET(dummyRequest());

    expect(res.status).toBe(401);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("returns 403 for a STUDENT", async () => {
    requireRoleMock.mockRejectedValue(Object.assign(new Error("forbidden"), { status: 403 }));
    const { GET } = await import("./route");

    const res = await GET(dummyRequest());

    expect(res.status).toBe(403);
  });

  it("returns 429 when the caller is rate-limited", async () => {
    requireRoleMock.mockResolvedValue({ id: "mgr-1", role: "MANAGER" });
    enforceRateLimitMock.mockRejectedValue(Object.assign(new Error("rate_limited"), { status: 429 }));
    const { GET } = await import("./route");

    const res = await GET(dummyRequest());

    expect(res.status).toBe(429);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("returns 200 with mapped messages for MANAGER", async () => {
    requireRoleMock.mockResolvedValue({ id: "mgr-1", role: "MANAGER" });
    findManyMock.mockResolvedValue([
      {
        id: "msg-1",
        lessonId: "lesson-1",
        studentId: "stu-1",
        text: "hi",
        senderRole: "STUDENT",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        lesson: { title: "Lesson 1" },
        student: { email: "stu1@example.com" },
      },
    ]);
    const { GET } = await import("./route");

    const res = await GET(dummyRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.messages).toHaveLength(1);
    expect(json.messages[0]).toMatchObject({
      id: "msg-1",
      lesson_id: "lesson-1",
      student_id: "stu-1",
      lesson_title: "Lesson 1",
      student_email: "stu1@example.com",
    });
  });

  it("requests limit+1 rows ordered by createdAt,id desc and returns nextCursor: null with no extra row", async () => {
    requireRoleMock.mockResolvedValue({ id: "mgr-1", role: "MANAGER" });
    findManyMock.mockResolvedValue([
      {
        id: "msg-1",
        lessonId: "lesson-1",
        studentId: "stu-1",
        text: "hi",
        senderRole: "STUDENT",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        lesson: { title: "Lesson 1" },
        student: { email: "stu1@example.com" },
      },
    ]);
    const { GET } = await import("./route");

    const res = await GET(new NextRequest("http://localhost/api/admin/messages?limit=5"));
    const json = await res.json();

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 6,
      }),
    );
    expect(json.nextCursor).toBeNull();
  });

  it("trims the extra row and returns the last item's id as nextCursor", async () => {
    requireRoleMock.mockResolvedValue({ id: "mgr-1", role: "MANAGER" });
    const row = (id: string) => ({
      id,
      lessonId: "lesson-1",
      studentId: "stu-1",
      text: "hi",
      senderRole: "STUDENT",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      lesson: { title: "Lesson 1" },
      student: { email: "stu1@example.com" },
    });
    findManyMock.mockResolvedValue([row("msg-1"), row("msg-2")]);
    const { GET } = await import("./route");

    const res = await GET(new NextRequest("http://localhost/api/admin/messages?limit=1"));
    const json = await res.json();

    expect(json.messages).toHaveLength(1);
    expect(json.nextCursor).toBe("msg-1");
  });

  it("passes the cursor query param through to Prisma's cursor/skip", async () => {
    requireRoleMock.mockResolvedValue({ id: "mgr-1", role: "MANAGER" });
    findManyMock.mockResolvedValue([]);
    const { GET } = await import("./route");

    await GET(new NextRequest("http://localhost/api/admin/messages?cursor=msg-9"));

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "msg-9" }, skip: 1 }),
    );
  });

  it("defaults to the prior 200-row cap when no limit query param is supplied", async () => {
    requireRoleMock.mockResolvedValue({ id: "mgr-1", role: "MANAGER" });
    findManyMock.mockResolvedValue([]);
    const { GET } = await import("./route");

    await GET(dummyRequest());

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: 201 }),
    );
  });
});
