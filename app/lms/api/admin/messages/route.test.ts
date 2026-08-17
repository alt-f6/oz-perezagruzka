import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const dummyRequest = () => new NextRequest("http://localhost/api/admin/messages");

const requireRoleApiMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/lms/server/auth/require-role-api", () => ({
  requireRoleApi: (...args: unknown[]) => requireRoleApiMock(...args),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    lessonMessage: { findMany: (...args: unknown[]) => findManyMock(...args) },
  },
}));

describe("GET /api/admin/messages", () => {
  beforeEach(() => {
    requireRoleApiMock.mockReset();
    findManyMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    requireRoleApiMock.mockRejectedValue(Object.assign(new Error("unauthorized"), { status: 401 }));
    const { GET } = await import("./route");

    const res = await GET(dummyRequest());

    expect(res.status).toBe(401);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("returns 403 for a STUDENT", async () => {
    requireRoleApiMock.mockRejectedValue(Object.assign(new Error("forbidden"), { status: 403 }));
    const { GET } = await import("./route");

    const res = await GET(dummyRequest());

    expect(res.status).toBe(403);
  });

  it("returns 200 with mapped messages for MANAGER", async () => {
    requireRoleApiMock.mockResolvedValue({ id: "mgr-1", role: "MANAGER" });
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
});
