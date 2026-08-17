import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleApiMock = vi.fn();
const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const headObjectMock = vi.fn();

vi.mock("@/lms/server/auth/require-role-api", () => ({
  requireRoleApi: (...args: unknown[]) => requireRoleApiMock(...args),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    lessonAsset: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));
vi.mock("@/lms/server/r2/signed", () => ({
  headObject: (...args: unknown[]) => headObjectMock(...args),
}));

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/assets/asset-1/complete", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function ctxFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

const BASE_ROW = {
  id: "asset-1",
  lessonId: "lesson-1",
  kind: "pdf",
  storageKey: "lessons/lesson-1/assets/asset-1-a.pdf",
};

describe("POST /api/admin/assets/[id]/complete", () => {
  beforeEach(() => {
    requireRoleApiMock.mockReset();
    findUniqueMock.mockReset();
    updateMock.mockReset();
    headObjectMock.mockReset();
    requireRoleApiMock.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
  });

  it("returns 401/403 as thrown by requireRoleApi without touching the database", async () => {
    requireRoleApiMock.mockRejectedValue(Object.assign(new Error("forbidden"), { status: 403 }));
    const { POST } = await import("./route");

    const res = await POST(makeReq({ lessonId: "lesson-1", sizeBytes: 1000 }), ctxFor("asset-1"));

    expect(res.status).toBe(403);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("rejects sizeBytes <= 0 in the request body with 400 before hitting R2", async () => {
    const { POST } = await import("./route");

    const res = await POST(makeReq({ lessonId: "lesson-1", sizeBytes: 0 }), ctxFor("asset-1"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toEqual({ ok: false, error: "bad file size" });
    expect(headObjectMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the asset row doesn't exist or belongs to a different lesson", async () => {
    findUniqueMock.mockResolvedValue({ ...BASE_ROW, lessonId: "other-lesson" });
    const { POST } = await import("./route");

    const res = await POST(makeReq({ lessonId: "lesson-1", sizeBytes: 1000 }), ctxFor("asset-1"));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json).toEqual({ ok: false, error: "not_found" });
  });

  it("treats an empty object in R2 (ContentLength 0) as incomplete and returns 400 empty_file_in_r2", async () => {
    findUniqueMock.mockResolvedValue(BASE_ROW);
    headObjectMock.mockResolvedValue({ ContentLength: 0, ContentType: "application/pdf" });
    const { POST } = await import("./route");

    const res = await POST(makeReq({ lessonId: "lesson-1", sizeBytes: 1000 }), ctxFor("asset-1"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toEqual({ ok: false, error: "empty_file_in_r2" });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects a sizeBytes mismatch between the claimed and actual R2 object size", async () => {
    findUniqueMock.mockResolvedValue(BASE_ROW);
    headObjectMock.mockResolvedValue({ ContentLength: 999, ContentType: "application/pdf" });
    const { POST } = await import("./route");

    const res = await POST(makeReq({ lessonId: "lesson-1", sizeBytes: 1000 }), ctxFor("asset-1"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toEqual({ ok: false, error: "size mismatch" });
  });

  it("rejects a content-type mismatch", async () => {
    findUniqueMock.mockResolvedValue(BASE_ROW);
    headObjectMock.mockResolvedValue({ ContentLength: 1000, ContentType: "image/png" });
    const { POST } = await import("./route");

    const res = await POST(makeReq({ lessonId: "lesson-1", sizeBytes: 1000 }), ctxFor("asset-1"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toEqual({ ok: false, error: "unexpected_content_type" });
  });

  it("marks the asset complete when size and content-type match", async () => {
    findUniqueMock.mockResolvedValue(BASE_ROW);
    headObjectMock.mockResolvedValue({ ContentLength: 1000, ContentType: "application/pdf" });
    updateMock.mockResolvedValue({});
    const { POST } = await import("./route");

    const res = await POST(
      makeReq({ lessonId: "lesson-1", sizeBytes: 1000, isPublic: true }),
      ctxFor("asset-1")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: { sizeBytes: 1000, isPublic: true },
    });
  });
});
