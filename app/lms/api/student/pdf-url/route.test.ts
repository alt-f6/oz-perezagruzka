import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireAuthMock = vi.fn();
const findUniqueMock = vi.fn();
const signGetObjectMock = vi.fn();
const canViewLessonMock = vi.fn();
const enforceRateLimitMock = vi.fn();

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
vi.mock("@/lms/server/http/rate-limit", () => ({
  enforceRateLimit: (...args: unknown[]) => enforceRateLimitMock(...args),
}));

function reqFor(assetId: string) {
  return new NextRequest(`http://localhost/api/student/pdf-url?assetId=${assetId}`);
}

const PUBLIC_PDF_ROW = {
  id: "asset-1",
  lessonId: "lesson-1",
  kind: "pdf",
  storageKey: "lessons/lesson-1/assets/asset-1-a.pdf",
  mimeType: "application/pdf",
  isPublic: true,
};

describe("GET /api/student/pdf-url", () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    findUniqueMock.mockReset();
    signGetObjectMock.mockReset();
    canViewLessonMock.mockReset();
    enforceRateLimitMock.mockReset();
    enforceRateLimitMock.mockResolvedValue(undefined);
  });

  it("returns 401 when there is no session", async () => {
    requireAuthMock.mockRejectedValue(Object.assign(new Error("unauthorized"), { status: 401 }));
    const { GET } = await import("./route");

    const res = await GET(reqFor("asset-1"));

    expect(res.status).toBe(401);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns 429 when the caller is rate-limited", async () => {
    requireAuthMock.mockResolvedValue({ id: "stu-1", role: "STUDENT" });
    enforceRateLimitMock.mockRejectedValue(Object.assign(new Error("rate_limited"), { status: 429 }));
    const { GET } = await import("./route");

    const res = await GET(reqFor("asset-1"));

    expect(res.status).toBe(429);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns 400 when assetId is missing", async () => {
    requireAuthMock.mockResolvedValue({ id: "stu-1", role: "STUDENT" });
    const { GET } = await import("./route");

    const res = await GET(new NextRequest("http://localhost/api/student/pdf-url"));

    expect(res.status).toBe(400);
  });

  it("returns 404 when the asset row doesn't exist", async () => {
    requireAuthMock.mockResolvedValue({ id: "stu-1", role: "STUDENT" });
    findUniqueMock.mockResolvedValue(null);
    const { GET } = await import("./route");

    const res = await GET(reqFor("missing"));

    expect(res.status).toBe(404);
  });

  it("returns 400 when the asset isn't a pdf", async () => {
    requireAuthMock.mockResolvedValue({ id: "stu-1", role: "STUDENT" });
    findUniqueMock.mockResolvedValue({ ...PUBLIC_PDF_ROW, kind: "video" });
    const { GET } = await import("./route");

    const res = await GET(reqFor("asset-1"));

    expect(res.status).toBe(400);
  });

  it("returns 403 when the asset isn't public", async () => {
    requireAuthMock.mockResolvedValue({ id: "stu-1", role: "STUDENT" });
    findUniqueMock.mockResolvedValue({ ...PUBLIC_PDF_ROW, isPublic: false });
    const { GET } = await import("./route");

    const res = await GET(reqFor("asset-1"));

    expect(res.status).toBe(403);
  });

  it("returns 403 for a STUDENT without an assignment for the lesson", async () => {
    requireAuthMock.mockResolvedValue({ id: "stu-1", role: "STUDENT" });
    findUniqueMock.mockResolvedValue(PUBLIC_PDF_ROW);
    canViewLessonMock.mockResolvedValue(false);
    const { GET } = await import("./route");

    const res = await GET(reqFor("asset-1"));

    expect(res.status).toBe(403);
    expect(canViewLessonMock).toHaveBeenCalledWith({ userId: "stu-1", role: "STUDENT", lessonId: "lesson-1" });
  });

  it("signs and returns a url for a STUDENT with an active assignment, via signGetObject", async () => {
    requireAuthMock.mockResolvedValue({ id: "stu-1", role: "STUDENT" });
    findUniqueMock.mockResolvedValue(PUBLIC_PDF_ROW);
    canViewLessonMock.mockResolvedValue(true);
    signGetObjectMock.mockResolvedValue("https://r2.example.com/signed-get");
    const { GET } = await import("./route");

    const res = await GET(reqFor("asset-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, url: "https://r2.example.com/signed-get" });
    expect(signGetObjectMock).toHaveBeenCalledWith(PUBLIC_PDF_ROW.storageKey, {
      responseContentType: "application/pdf",
      responseContentDisposition: "inline",
    });
  });

  it("signs and returns a url for ADMIN without consulting canViewLesson", async () => {
    requireAuthMock.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    findUniqueMock.mockResolvedValue(PUBLIC_PDF_ROW);
    signGetObjectMock.mockResolvedValue("https://r2.example.com/signed-get");
    const { GET } = await import("./route");

    const res = await GET(reqFor("asset-1"));

    expect(res.status).toBe(200);
    expect(canViewLessonMock).not.toHaveBeenCalled();
  });
});
