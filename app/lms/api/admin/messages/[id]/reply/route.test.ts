import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const findUniqueMock = vi.fn();
const createMock = vi.fn();
const enforceRateLimitMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    lessonMessage: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));
vi.mock("@/lms/server/http/rate-limit", () => ({
  enforceRateLimit: (...args: unknown[]) => enforceRateLimitMock(...args),
}));

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/messages/msg-1/reply", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
function ctxFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/admin/messages/[id]/reply", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    findUniqueMock.mockReset();
    createMock.mockReset();
    enforceRateLimitMock.mockReset();
    enforceRateLimitMock.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    requireRoleMock.mockRejectedValue(Object.assign(new Error("unauthorized"), { status: 401 }));
    const { POST } = await import("./route");

    const res = await POST(makeReq({ text: "hi" }), ctxFor("msg-1"));

    expect(res.status).toBe(401);
  });

  it("returns 403 for a STUDENT", async () => {
    requireRoleMock.mockRejectedValue(Object.assign(new Error("forbidden"), { status: 403 }));
    const { POST } = await import("./route");

    const res = await POST(makeReq({ text: "hi" }), ctxFor("msg-1"));

    expect(res.status).toBe(403);
  });

  it("returns 429 when the caller is rate-limited", async () => {
    requireRoleMock.mockResolvedValue({ id: "mgr-1", role: "MANAGER" });
    enforceRateLimitMock.mockRejectedValue(Object.assign(new Error("rate_limited"), { status: 429 }));
    const { POST } = await import("./route");

    const res = await POST(makeReq({ text: "hi" }), ctxFor("msg-1"));

    expect(res.status).toBe(429);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns 400 for blank text", async () => {
    requireRoleMock.mockResolvedValue({ id: "mgr-1", role: "MANAGER" });
    const { POST } = await import("./route");

    const res = await POST(makeReq({ text: "   " }), ctxFor("msg-1"));

    expect(res.status).toBe(400);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the parent message doesn't exist", async () => {
    requireRoleMock.mockResolvedValue({ id: "mgr-1", role: "MANAGER" });
    findUniqueMock.mockResolvedValue(null);
    const { POST } = await import("./route");

    const res = await POST(makeReq({ text: "hi" }), ctxFor("missing"));

    expect(res.status).toBe(404);
  });

  it("creates a reply message on success", async () => {
    requireRoleMock.mockResolvedValue({ id: "mgr-1", role: "MANAGER" });
    findUniqueMock.mockResolvedValue({ id: "msg-1", lessonId: "lesson-1", studentId: "stu-1" });
    createMock.mockResolvedValue({});
    const { POST } = await import("./route");

    const res = await POST(makeReq({ text: "reply text" }), ctxFor("msg-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(createMock).toHaveBeenCalledWith({
      data: { lessonId: "lesson-1", studentId: "stu-1", text: "reply text", senderRole: "MANAGER" },
    });
  });
});
