import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleApiMock = vi.fn();
const lessonFindUniqueMock = vi.fn();
const transactionMock = vi.fn();
const lessonAssetDeleteMock = vi.fn();
const signPutObjectMock = vi.fn();

vi.mock("@/lms/server/auth/require-role-api", () => ({
  requireRoleApi: (...args: unknown[]) => requireRoleApiMock(...args),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    lesson: { findUnique: (...args: unknown[]) => lessonFindUniqueMock(...args) },
    $transaction: (...args: unknown[]) => transactionMock(...args),
    lessonAsset: { delete: (...args: unknown[]) => lessonAssetDeleteMock(...args) },
  },
}));
vi.mock("@/lms/server/r2/signed", () => ({
  signPutObject: (...args: unknown[]) => signPutObjectMock(...args),
}));

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/lessons/lesson-1/assets/presign", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function ctxFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/admin/lessons/[id]/assets/presign", () => {
  beforeEach(() => {
    requireRoleApiMock.mockReset();
    lessonFindUniqueMock.mockReset();
    transactionMock.mockReset();
    lessonAssetDeleteMock.mockReset();
    signPutObjectMock.mockReset();
  });

  it("returns 401 when requireRoleApi rejects an unauthenticated caller", async () => {
    requireRoleApiMock.mockRejectedValue(Object.assign(new Error("unauthorized"), { status: 401 }));
    const { POST } = await import("./route");

    const res = await POST(makeReq({}), ctxFor("lesson-1"));

    expect(res.status).toBe(401);
    expect(requireRoleApiMock).toHaveBeenCalledWith(["ADMIN", "MANAGER"]);
  });

  it("returns 403 when requireRoleApi rejects a STUDENT caller", async () => {
    requireRoleApiMock.mockRejectedValue(Object.assign(new Error("forbidden"), { status: 403 }));
    const { POST } = await import("./route");

    const res = await POST(makeReq({}), ctxFor("lesson-1"));

    expect(res.status).toBe(403);
  });

  it("rejects a non-PDF mimeType with 400", async () => {
    requireRoleApiMock.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    const { POST } = await import("./route");

    const res = await POST(
      makeReq({ filename: "notes.txt", mimeType: "text/plain", sizeBytes: 1000 }),
      ctxFor("lesson-1")
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toEqual({ ok: false, error: "only pdf allowed" });
    expect(lessonFindUniqueMock).not.toHaveBeenCalled();
  });

  it("rejects sizeBytes <= 0 with 400", async () => {
    requireRoleApiMock.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    const { POST } = await import("./route");

    const res = await POST(
      makeReq({ filename: "a.pdf", mimeType: "application/pdf", sizeBytes: 0 }),
      ctxFor("lesson-1")
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toEqual({ ok: false, error: "bad file size" });
  });

  it("rejects sizeBytes over the max limit with 400", async () => {
    requireRoleApiMock.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    const { POST } = await import("./route");
    const { LESSON_ASSET_MAX_SIZE_BYTES } = await import("@/lms/lib/lesson-assets");

    const res = await POST(
      makeReq({ filename: "a.pdf", mimeType: "application/pdf", sizeBytes: LESSON_ASSET_MAX_SIZE_BYTES + 1 }),
      ctxFor("lesson-1")
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("file too large");
  });

  it("returns 404 when the lesson does not exist", async () => {
    requireRoleApiMock.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    lessonFindUniqueMock.mockResolvedValue(null);
    const { POST } = await import("./route");

    const res = await POST(
      makeReq({ filename: "a.pdf", mimeType: "application/pdf", sizeBytes: 1000 }),
      ctxFor("missing-lesson")
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json).toEqual({ ok: false, error: "lesson_not_found" });
  });

  it("creates the asset row and returns a signed PUT url on success", async () => {
    requireRoleApiMock.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    lessonFindUniqueMock.mockResolvedValue({ id: "lesson-1" });
    transactionMock.mockResolvedValue({ id: "asset-1", storageKey: "lessons/lesson-1/assets/asset-1-a.pdf" });
    signPutObjectMock.mockResolvedValue("https://r2.example.com/signed-put");
    const { POST } = await import("./route");

    const res = await POST(
      makeReq({ filename: "a.pdf", mimeType: "application/pdf", sizeBytes: 1000 }),
      ctxFor("lesson-1")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.uploadUrl).toBe("https://r2.example.com/signed-put");
    expect(lessonAssetDeleteMock).not.toHaveBeenCalled();
  });

  it("deletes the just-created asset row and returns 502 if signing fails", async () => {
    requireRoleApiMock.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    lessonFindUniqueMock.mockResolvedValue({ id: "lesson-1" });
    transactionMock.mockResolvedValue({ id: "asset-1", storageKey: "lessons/lesson-1/assets/asset-1-a.pdf" });
    signPutObjectMock.mockRejectedValue(new Error("r2 down"));
    const { POST } = await import("./route");

    const res = await POST(
      makeReq({ filename: "a.pdf", mimeType: "application/pdf", sizeBytes: 1000 }),
      ctxFor("lesson-1")
    );
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json).toEqual({ ok: false, error: "upload_url_generation_failed" });
    expect(lessonAssetDeleteMock).toHaveBeenCalledWith({ where: { id: "asset-1" } });
  });
});
