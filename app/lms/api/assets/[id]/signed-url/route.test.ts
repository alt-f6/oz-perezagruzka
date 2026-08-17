import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireAuthMock = vi.fn();
const findUniqueMock = vi.fn();
const signGetObjectMock = vi.fn();
const canViewLessonMock = vi.fn();

vi.mock("@/lms/server/auth/require-auth", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    lessonAsset: { findUnique: (...args: unknown[]) => findUniqueMock(...args) },
  },
}));
vi.mock("@/lms/server/r2/signed", () => ({
  signGetObject: (...args: unknown[]) => signGetObjectMock(...args),
}));
vi.mock("@/lms/server/access/can-view-lesson", () => ({
  canViewLesson: (...args: unknown[]) => canViewLessonMock(...args),
}));

function ctxFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

const req = new NextRequest("http://localhost/api/assets/asset-1/signed-url");

const COMPLETE_PUBLIC_ROW = {
  id: "asset-1",
  lessonId: "lesson-1",
  storageKey: "lessons/lesson-1/assets/asset-1-a.pdf",
  isPublic: true,
  mimeType: "application/pdf",
  originalName: "a.pdf",
  sizeBytes: 1000,
};

describe("GET /api/assets/[id]/signed-url", () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    findUniqueMock.mockReset();
    signGetObjectMock.mockReset();
    canViewLessonMock.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    requireAuthMock.mockRejectedValue(Object.assign(new Error("unauthorized"), { status: 401 }));
    const { GET } = await import("./route");

    const res = await GET(req, ctxFor("asset-1"));

    expect(res.status).toBe(401);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the asset row doesn't exist", async () => {
    requireAuthMock.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    findUniqueMock.mockResolvedValue(null);
    const { GET } = await import("./route");

    const res = await GET(req, ctxFor("missing"));

    expect(res.status).toBe(404);
  });

  it("returns 409 asset_not_completed when sizeBytes is 0 (mid-upload)", async () => {
    requireAuthMock.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    findUniqueMock.mockResolvedValue({ ...COMPLETE_PUBLIC_ROW, sizeBytes: 0 });
    const { GET } = await import("./route");

    const res = await GET(req, ctxFor("asset-1"));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toEqual({ ok: false, error: "asset_not_completed" });
    expect(signGetObjectMock).not.toHaveBeenCalled();
  });

  it("returns 403 for a STUDENT when the asset is not public", async () => {
    requireAuthMock.mockResolvedValue({ id: "stu-1", role: "STUDENT" });
    findUniqueMock.mockResolvedValue({ ...COMPLETE_PUBLIC_ROW, isPublic: false });
    const { GET } = await import("./route");

    const res = await GET(req, ctxFor("asset-1"));

    expect(res.status).toBe(403);
    expect(canViewLessonMock).not.toHaveBeenCalled();
  });

  it("returns 403 for a STUDENT without an assignment for the lesson", async () => {
    requireAuthMock.mockResolvedValue({ id: "stu-1", role: "STUDENT" });
    findUniqueMock.mockResolvedValue(COMPLETE_PUBLIC_ROW);
    canViewLessonMock.mockResolvedValue(false);
    const { GET } = await import("./route");

    const res = await GET(req, ctxFor("asset-1"));

    expect(res.status).toBe(403);
    expect(canViewLessonMock).toHaveBeenCalledWith({ userId: "stu-1", role: "STUDENT", lessonId: "lesson-1" });
  });

  it("signs and returns a url for a STUDENT with an active assignment", async () => {
    requireAuthMock.mockResolvedValue({ id: "stu-1", role: "STUDENT" });
    findUniqueMock.mockResolvedValue(COMPLETE_PUBLIC_ROW);
    canViewLessonMock.mockResolvedValue(true);
    signGetObjectMock.mockResolvedValue("https://r2.example.com/signed-get");
    const { GET } = await import("./route");

    const res = await GET(req, ctxFor("asset-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, url: "https://r2.example.com/signed-get" });
  });

  it("signs and returns a url for ADMIN without consulting canViewLesson", async () => {
    requireAuthMock.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    findUniqueMock.mockResolvedValue({ ...COMPLETE_PUBLIC_ROW, isPublic: false });
    signGetObjectMock.mockResolvedValue("https://r2.example.com/signed-get");
    const { GET } = await import("./route");

    const res = await GET(req, ctxFor("asset-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, url: "https://r2.example.com/signed-get" });
    expect(canViewLessonMock).not.toHaveBeenCalled();
  });

  it("returns 502 when signing fails", async () => {
    requireAuthMock.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    findUniqueMock.mockResolvedValue(COMPLETE_PUBLIC_ROW);
    signGetObjectMock.mockRejectedValue(new Error("r2 down"));
    const { GET } = await import("./route");

    const res = await GET(req, ctxFor("asset-1"));

    expect(res.status).toBe(502);
  });
});
